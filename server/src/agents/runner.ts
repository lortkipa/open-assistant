import { sql } from '../db.ts'
import { publish } from '../events.ts'
import { clock } from './prompt.ts'
import { forModel } from './attachments.ts'
import { aiConfigured, nextMessage } from './reply.ts'
import {
  applyReminderActions,
  describeTime,
  fireReminder,
  loadReminders,
  localIso,
  reminderTime,
  saveReminders,
  toWire as reminderToWire,
  type Reminder,
} from './reminders.ts'
import { insertMessage, loadMessages } from './store.ts'
import { applyTimerActions, loadTimers, saveTimers, timeLeft, toWire, type Timer } from './timers.ts'

// The server answers and keeps time on its own, whether or not the app is open.

// Each agent's reply in progress. Anything new in the chat (the user writes, a timer runs out) cancels it.
// A reply started by reminders keeps their notes until it has texted the user about them.
type Run = { controller: AbortController; notes: string[]; notified: boolean }
const runs = new Map<string, Run>()

export const isReplying = (agentId: string) => runs.has(agentId)

export function cancelReply(agentId: string) {
  runs.get(agentId)?.controller.abort()
  runs.delete(agentId)
}

// The agent reads the whole chat and sends messages one API call at a time, until it says it's done
// (or chooses to say nothing). The app sees typing dots meanwhile.
// For reminders coming due, the first text the agent sends shows as a notification. If none comes
// (no AI, an error, or the agent stays quiet), the app shows the reminder's note instead.
export function startReply(userId: string, agentId: string, reminderNotes: string[] = []) {
  // Reminders a cancelled reply hadn't texted about yet carry over (a user message cancels them
  // first, so they don't: the user is in the app).
  const previous = runs.get(agentId)
  const notes = [...(previous && !previous.notified ? previous.notes : []), ...reminderNotes]
  cancelReply(agentId)
  const run: Run = { controller: new AbortController(), notes, notified: false }
  runs.set(agentId, run)
  publish(userId, { type: 'typing', agentId, on: true })
  reply(userId, agentId, run)
    .catch((err) => {
      if (run.controller.signal.aborted) return
      console.error('agent reply failed', err)
      publish(userId, { type: 'reply_error', agentId, error: 'ai_failed' })
    })
    .finally(() => {
      if (runs.get(agentId) !== run) return
      runs.delete(agentId)
      publish(userId, { type: 'typing', agentId, on: false })
      if (!run.notified) for (const note of run.notes) publish(userId, { type: 'reminder_due', agentId, note })
    })
}

// What the agent is told about a timer.
const timerState = (t: Timer) => ({ ...t, remaining: Math.ceil(timeLeft(t) / 1000) })

// What the agent is told about a reminder.
const reminderState = (r: Reminder) => ({ id: r.id, note: r.note, when: describeTime(r), repeat: r.repeat, status: r.status })

async function reply(userId: string, agentId: string, run: Run) {
  const { signal } = run.controller
  if (!aiConfigured()) {
    publish(userId, { type: 'reply_error', agentId, error: 'ai_not_configured' })
    return
  }
  while (true) {
    const [agent] = await sql<{ name: string; userName: string | null; email: string; timeZone: string }[]>`
      select a.name, u.name as user_name, u.email, u.time_zone
      from agents a join users u on u.id = a.user_id where a.id = ${agentId}`
    if (!agent) return
    const [messages, timers, reminders] = await Promise.all([
      loadMessages(sql, agentId),
      loadTimers(sql, agentId),
      loadReminders(sql, agentId),
    ])
    const { timeZone } = agent
    const date = new Date()
    const now = date.toLocaleString('en-US', { timeZone, dateStyle: 'full', timeStyle: 'short' })
    const attachments = await forModel(messages.flatMap((m) => m.attachments ?? []), signal)
    const next = await nextMessage(
      {
        agentName: agent.name,
        userName: agent.userName ?? 'the user',
        email: agent.email,
        now,
        nowLocal: localIso(date, timeZone),
        timeZone,
        timers: timers.map(timerState),
        reminders: reminders.map(reminderState),
      },
      messages.map(({ from, text, timers, reminders, attachments: attached }) => ({
        from,
        text,
        timers,
        reminders,
        attachments: attached?.map((a) => attachments.get(a.id)!).filter(Boolean),
      })),
      signal,
    )

    // The agent row lock keeps the user's timer and reminder buttons, and timers and reminders coming
    // due, from interleaving. A newer reply may have started while this one waited for it.
    const sent = await sql.begin(async (tx) => {
      await tx`select 1 from agents where id = ${agentId} for update`
      if (signal.aborted) return null
      const beforeTimers = await loadTimers(tx, agentId)
      const appliedTimers = applyTimerActions(beforeTimers, next.timers)
      const beforeReminders = await loadReminders(tx, agentId)
      const appliedReminders = applyReminderActions(beforeReminders, next.reminders, timeZone)
      const changed = appliedTimers.actions.length > 0 || appliedReminders.actions.length > 0
      if (!next.message && !changed) return null
      await saveTimers(tx, agentId, beforeTimers, appliedTimers.timers)
      await saveReminders(tx, agentId, beforeReminders, appliedReminders.reminders)
      const message = await insertMessage(tx, agentId, 'agent', next.message ?? '', {
        timers: appliedTimers.actions,
        reminders: appliedReminders.actions,
      })
      await tx`update agents set unread = true where id = ${agentId}`
      return {
        message,
        timers: appliedTimers.timers.map(toWire),
        reminders: appliedReminders.reminders.map(reminderToWire),
        changed,
      }
    })
    if (!sent) return
    const notify = run.notes.length > 0 && !run.notified && !!sent.message.text
    if (notify) run.notified = true
    publish(userId, { type: 'message', agentId, message: sent.message, timers: sent.timers, reminders: sent.reminders, ...(notify && { notify }) })
    if (sent.changed) scheduleWake()
    if (!next.more) return
  }
}

// One timeout, for whichever comes first: a running timer running out or a reminder coming due.
// Reschedules run one after another, so the last one always sees the latest state. Call it after
// every change to running timers or pending reminders.
let wake: NodeJS.Timeout | undefined
let scheduling = Promise.resolve()

// setTimeout can't wait much past 24.8 days, and a reminder can be months away. Waking up early
// finds nothing due and goes back to sleep.
const MAX_SLEEP_MS = 24 * 24 * 60 * 60 * 1000

// A reminder this late went off while the server was down.
const LATE_MS = 5 * 60 * 1000

export function scheduleWake() {
  scheduling = scheduling.then(reschedule).catch((err) => console.error('scheduling timers and reminders failed', err))
}

async function reschedule() {
  const [{ next }] = await sql<{ next: Date | null }[]>`
    select least(
      (select min(ends_at) from timers where status = 'running'),
      (select min(fires_at) from reminders where status = 'pending')
    ) as next`
  clearTimeout(wake)
  if (!next) return
  wake = setTimeout(
    () => {
      fireDue().catch((err) => console.error('firing timers and reminders failed', err))
    },
    Math.min(MAX_SLEEP_MS, Math.max(0, next.getTime() - Date.now())),
  )
}

// What the agent is told when a reminder is due (before it moves on to its next time).
function reminderEvent(r: Reminder, at: number) {
  const due = reminderTime(r)
  const when = new Date(due).toLocaleString('en-US', { timeZone: r.timeZone, dateStyle: 'full', timeStyle: 'short' })
  const repeats = r.repeat === 'none' ? '' : `, repeats ${r.repeat}`
  const late = at - due > LATE_MS ? ' It went off late: the app was offline at that time.' : ''
  return `Reminder ${r.id} is due (set for ${when}${repeats}): “${r.note}”${late}`
}

// When timers run out and reminders come due: mark them and tell each agent, which then texts the
// user. Open apps show a notification. A timeout that fires a moment early finds nothing due and
// just reschedules.
async function fireDue() {
  const at = new Date()
  const fired = await sql.begin(async (tx) => {
    const agents = await tx<{ id: string; userId: string; name: string }[]>`
      select id, user_id, name from agents
      where id in (
        select agent_id from timers where status = 'running' and ends_at <= ${at}
        union select agent_id from reminders where status = 'pending' and fires_at <= ${at})
      order by id for update`
    const result = []
    for (const agent of agents) {
      const done = await tx<{ id: string; label: string; seconds: number }[]>`
        update timers set status = 'done', ends_at = null, remaining_ms = 0
        where agent_id = ${agent.id} and status = 'running' and ends_at <= ${at}
        returning id, label, seconds`
      const events = []
      for (const t of done) {
        events.push(await insertMessage(tx, agent.id, 'event', `Timer ${t.id} “${t.label}” (${clock(t.seconds)}) ran out.`))
      }
      const dueIds = (
        await tx<{ id: string }[]>`
          select id from reminders where agent_id = ${agent.id} and status = 'pending' and fires_at <= ${at}`
      ).map((r) => r.id)
      const before = await loadReminders(tx, agent.id)
      const due = before.filter((r) => dueIds.includes(r.id))
      await saveReminders(tx, agent.id, before, before.map((r) => (due.includes(r) ? fireReminder(r, at.getTime()) : r)))
      for (const r of due) events.push(await insertMessage(tx, agent.id, 'event', reminderEvent(r, at.getTime())))
      result.push({ agent, done, due, events })
    }
    return result
  })
  for (const { agent, done, due, events } of fired) {
    const [timers, reminders] = await Promise.all([loadTimers(sql, agent.id), loadReminders(sql, agent.id)])
    for (const message of events) {
      publish(agent.userId, { type: 'message', agentId: agent.id, message, timers: timers.map(toWire), reminders: reminders.map(reminderToWire) })
    }
    for (const t of done) publish(agent.userId, { type: 'timer_done', agentId: agent.id, agentName: agent.name, label: t.label })
    startReply(agent.userId, agent.id, due.map((r) => r.note))
  }
  scheduleWake()
}
