import { sql } from '../db.ts'
import { publish } from '../events.ts'
import { clock } from './prompt.ts'
import { aiConfigured, nextMessage } from './reply.ts'
import { insertMessage, loadMessages } from './store.ts'
import { applyTimerActions, loadTimers, saveTimers, timeLeft, toWire, type Timer } from './timers.ts'

// The server answers and keeps time on its own, whether or not the app is open.

// Each agent's reply in progress. Anything new in the chat (the user writes, a timer runs out) cancels it.
const runs = new Map<string, AbortController>()

export const isReplying = (agentId: string) => runs.has(agentId)

export function cancelReply(agentId: string) {
  runs.get(agentId)?.abort()
  runs.delete(agentId)
}

// The agent reads the whole chat and sends messages one API call at a time, until it says it's done
// (or chooses to say nothing). The app sees typing dots meanwhile.
export function startReply(userId: string, agentId: string) {
  cancelReply(agentId)
  const controller = new AbortController()
  runs.set(agentId, controller)
  publish(userId, { type: 'typing', agentId, on: true })
  reply(userId, agentId, controller.signal)
    .catch((err) => {
      if (controller.signal.aborted) return
      console.error('agent reply failed', err)
      publish(userId, { type: 'reply_error', agentId, error: 'ai_failed' })
    })
    .finally(() => {
      if (runs.get(agentId) !== controller) return
      runs.delete(agentId)
      publish(userId, { type: 'typing', agentId, on: false })
    })
}

// What the agent is told about a timer.
const timerState = (t: Timer) => ({ ...t, remaining: Math.ceil(timeLeft(t) / 1000) })

async function reply(userId: string, agentId: string, signal: AbortSignal) {
  if (!aiConfigured()) {
    publish(userId, { type: 'reply_error', agentId, error: 'ai_not_configured' })
    return
  }
  while (true) {
    const [agent] = await sql<{ name: string; userName: string | null; email: string; timeZone: string }[]>`
      select a.name, u.name as user_name, u.email, u.time_zone
      from agents a join users u on u.id = a.user_id where a.id = ${agentId}`
    if (!agent) return
    const [messages, timers] = await Promise.all([loadMessages(sql, agentId), loadTimers(sql, agentId)])
    const { timeZone } = agent
    const now = new Date().toLocaleString('en-US', { timeZone, dateStyle: 'full', timeStyle: 'short' })
    const next = await nextMessage(
      { agentName: agent.name, userName: agent.userName ?? 'the user', email: agent.email, now, timeZone, timers: timers.map(timerState) },
      messages.map(({ from, text, timers }) => ({ from, text, timers })),
      signal,
    )

    // The agent row lock keeps the user's timer buttons and running-out timers from interleaving.
    // A newer reply may have started while this one waited for it.
    const sent = await sql.begin(async (tx) => {
      await tx`select 1 from agents where id = ${agentId} for update`
      if (signal.aborted) return null
      const before = await loadTimers(tx, agentId)
      const applied = applyTimerActions(before, next.timers)
      if (!next.message && !applied.actions.length) return null
      await saveTimers(tx, agentId, before, applied.timers)
      const message = await insertMessage(tx, agentId, 'agent', next.message ?? '', applied.actions)
      await tx`update agents set unread = true where id = ${agentId}`
      return { message, timers: applied.timers.map(toWire), changedTimers: applied.actions.length > 0 }
    })
    if (!sent) return
    publish(userId, { type: 'message', agentId, message: sent.message, timers: sent.timers })
    if (sent.changedTimers) scheduleTimers()
    if (!next.more) return
  }
}

// One timeout, for whichever running timer runs out first. Reschedules run one after another, so
// the last one always sees the latest timers. Call it after every change to running timers.
let wake: NodeJS.Timeout | undefined
let scheduling = Promise.resolve()

export function scheduleTimers() {
  scheduling = scheduling.then(reschedule).catch((err) => console.error('scheduling timers failed', err))
}

async function reschedule() {
  const [{ next }] = await sql<{ next: Date | null }[]>`select min(ends_at) as next from timers where status = 'running'`
  clearTimeout(wake)
  if (!next) return
  // Timers are at most 7 days long, well within setTimeout's ~24.8-day limit.
  wake = setTimeout(() => {
    fireDue().catch((err) => console.error('finishing timers failed', err))
  }, Math.max(0, next.getTime() - Date.now()))
}

// When timers run out: mark them done and tell each agent, which then texts the user. Open apps
// show a notification. A timeout that fires a moment early finds nothing due and just reschedules.
async function fireDue() {
  const at = new Date()
  const finished = await sql.begin(async (tx) => {
    const agents = await tx<{ id: string; userId: string; name: string }[]>`
      select id, user_id, name from agents
      where id in (select agent_id from timers where status = 'running' and ends_at <= ${at})
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
      result.push({ agent, done, events })
    }
    return result
  })
  for (const { agent, done, events } of finished) {
    const timers = (await loadTimers(sql, agent.id)).map(toWire)
    for (const message of events) publish(agent.userId, { type: 'message', agentId: agent.id, message, timers })
    for (const t of done) publish(agent.userId, { type: 'timer_done', agentId: agent.id, agentName: agent.name, label: t.label })
    startReply(agent.userId, agent.id)
  }
  scheduleTimers()
}
