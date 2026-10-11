import type { Db } from '../db.ts'
import type { ReminderAction } from './reply.ts'

export const REPEATS = ['none', 'daily', 'weekdays', 'weekly', 'monthly', 'yearly'] as const
export type Repeat = (typeof REPEATS)[number]

// Times are wall-clock times ('YYYY-MM-DDTHH:MM') in the user's zone, so a daily 9:00 stays at
// 9:00 when the clocks change.
export type Reminder = {
  id: string
  note: string
  repeat: Repeat
  // The first time; monthly and yearly ones keep its day (the 31st, or Feb 29) in shorter months.
  anchor: string
  // The next time, or the last one once done or cancelled.
  localAt: string
  timeZone: string
  status: 'pending' | 'done' | 'cancelled'
}

// A reminder set this far in the past is a mistake rather than a slow reply.
const PAST_SLACK_MS = 60_000

type Wall = { y: number; mo: number; d: number; h: number; mi: number }

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

function parseLocal(local: string): Wall | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local)
  if (!m) return null
  const [y, mo, d, h, mi] = m.slice(1).map(Number)
  // Date.UTC rolls over (Feb 30 becomes Mar 2); a real date comes back unchanged.
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d || h > 23 || mi > 59) return null
  return { y, mo, d, h, mi }
}

const formatLocal = ({ y, mo, d, h, mi }: Wall) => `${pad(y, 4)}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}`

export const validLocal = (local: string) => parseLocal(local) !== null

const parts = (date: Date, timeZone: string) => {
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  })
  const all = format.formatToParts(date)
  const get = (type: string) => Number(all.find((p) => p.type === type)!.value)
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') }
}

// How far the zone's clock is ahead of UTC at this moment, in milliseconds.
function offset(utc: number, timeZone: string) {
  const p = parts(new Date(utc), timeZone)
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(utc / 1000) * 1000
}

// The user's local time as of now, like '2026-10-11T09:30'.
export const localIso = (date: Date, timeZone: string) => formatLocal(parts(date, timeZone))

// When a wall-clock time happens. Around a clock change the offset either side of it gives the
// candidates: when the clocks go back, the time happens twice and the first one counts; when they
// go forward, it's skipped, and the time moves forward by the gap (2:30 becomes 3:30).
export function zonedToUtc(local: string, timeZone: string) {
  const w = parseLocal(local)!
  const wall = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi)
  const candidates = [offset(wall - 86_400_000, timeZone), offset(wall + 86_400_000, timeZone)].map((o) => ({ o, utc: wall - o }))
  const valid = candidates.filter((c) => offset(c.utc, timeZone) === c.o).map((c) => c.utc)
  return valid.length ? Math.min(...valid) : Math.max(...candidates.map((c) => c.utc))
}

export const reminderTime = (r: Reminder) => zonedToUtc(r.localAt, r.timeZone)

const daysIn = (y: number, mo: number) => new Date(Date.UTC(y, mo, 0)).getUTCDate()

const addDays = (w: Wall, days: number): Wall => {
  const date = new Date(Date.UTC(w.y, w.mo - 1, w.d + days))
  return { ...w, y: date.getUTCFullYear(), mo: date.getUTCMonth() + 1, d: date.getUTCDate() }
}

// The repeat after `w`, by the calendar.
function step(w: Wall, repeat: Repeat, anchor: Wall): Wall {
  switch (repeat) {
    case 'daily':
      return addDays(w, 1)
    case 'weekly':
      return addDays(w, 7)
    case 'weekdays': {
      let next = addDays(w, 1)
      while ([0, 6].includes(new Date(Date.UTC(next.y, next.mo - 1, next.d)).getUTCDay())) next = addDays(next, 1)
      return next
    }
    case 'monthly': {
      const [y, mo] = w.mo === 12 ? [w.y + 1, 1] : [w.y, w.mo + 1]
      return { ...w, y, mo, d: Math.min(anchor.d, daysIn(y, mo)) }
    }
    case 'yearly':
      return { ...w, y: w.y + 1, d: Math.min(anchor.d, daysIn(w.y + 1, w.mo)) }
    case 'none':
      return w
  }
}

// The first repeat after `after`. Times missed meanwhile (the server was down) are skipped.
export function nextOccurrence(r: Pick<Reminder, 'repeat' | 'anchor' | 'localAt' | 'timeZone'>, after: number) {
  const anchor = parseLocal(r.anchor)!
  let w = parseLocal(r.localAt)!
  do w = step(w, r.repeat, anchor)
  while (zonedToUtc(formatLocal(w), r.timeZone) <= after)
  return formatLocal(w)
}

// Applies an agent's actions in order. Creates get the next free id. A one-off reminder in the past
// is dropped; a repeating one starts from its next time. Cancels only apply to pending reminders.
export function applyReminderActions(reminders: Reminder[], actions: ReminderAction[], timeZone: string, now = Date.now()) {
  const applied: ReminderAction[] = []
  for (const a of actions) {
    if (a.action === 'create') {
      const at = a.at!
      const repeat = a.repeat ?? 'none'
      let localAt = at
      if (zonedToUtc(at, timeZone) < now - PAST_SLACK_MS) {
        if (repeat === 'none') continue
        localAt = nextOccurrence({ repeat, anchor: at, localAt: at, timeZone }, now)
      }
      const id = `r${reminders.length + 1}`
      const note = a.note!.trim().slice(0, 500)
      reminders = [...reminders, { id, note, repeat, anchor: at, localAt, timeZone, status: 'pending' }]
      applied.push({ ...a, reminder: id, at: localAt, repeat, note })
      continue
    }
    if (!reminders.some((r) => r.id === a.reminder && r.status === 'pending')) continue
    reminders = reminders.map((r) => (r.id === a.reminder ? { ...r, status: 'cancelled' } : r))
    applied.push(a)
  }
  return { reminders, actions: applied }
}

// Fires a due reminder: a one-off one is done, a repeating one moves on to its next time.
export const fireReminder = (r: Reminder, now: number): Reminder =>
  r.repeat === 'none' ? { ...r, status: 'done' } : { ...r, localAt: nextOccurrence(r, now) }

export const cancelReminder = (r: Reminder): Reminder => (r.status === 'pending' ? { ...r, status: 'cancelled' } : r)

// How the agent is told the time, in the reminder's zone: "Mon, Oct 12, 2026, 9:00 AM".
export const describeTime = (r: Reminder) =>
  new Date(reminderTime(r)).toLocaleString('en-US', {
    timeZone: r.timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

// What the app gets: when it's due (or was), as epoch milliseconds.
export const toWire = (r: Reminder) => ({ id: r.id, note: r.note, repeat: r.repeat, status: r.status, at: reminderTime(r) })

export async function loadReminders(db: Db, agentId: string): Promise<Reminder[]> {
  return db<Reminder[]>`
    select id, note, repeat, anchor, local_at, time_zone, status from reminders
    where agent_id = ${agentId} order by length(id), id`
}

// Writes the reminders that changed since `before` (the changes above return new objects).
export async function saveReminders(db: Db, agentId: string, before: Reminder[], after: Reminder[]) {
  for (const r of after) {
    if (before.includes(r)) continue
    const firesAt = r.status === 'pending' ? new Date(reminderTime(r)) : null
    await db`
      insert into reminders (agent_id, id, note, repeat, anchor, local_at, time_zone, fires_at, status)
      values (${agentId}, ${r.id}, ${r.note}, ${r.repeat}, ${r.anchor}, ${r.localAt}, ${r.timeZone}, ${firesAt}, ${r.status})
      on conflict (agent_id, id) do update
      set local_at = excluded.local_at, fires_at = excluded.fires_at, status = excluded.status`
  }
}
