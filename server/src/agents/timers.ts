import type { Db } from '../db.ts'
import type { TimerAction } from './reply.ts'

export type Timer = {
  id: string
  label: string
  seconds: number
  status: 'running' | 'stopped' | 'reset' | 'done'
  // While running, when it runs out (epoch ms); otherwise how many milliseconds are left.
  endsAt: number
  remaining: number
}

export const timeLeft = (timer: Timer, now = Date.now()) =>
  timer.status === 'running' ? Math.max(0, timer.endsAt - now) : timer.remaining

// A finished or reset timer starts over from the full time; a stopped one resumes.
export const startTimer = (timer: Timer): Timer => {
  if (timer.status === 'running') return timer
  const remaining = timer.status === 'stopped' ? timer.remaining : timer.seconds * 1000
  return { ...timer, status: 'running', endsAt: Date.now() + remaining, remaining }
}

// A timer already at zero keeps running so it still finishes (and the agent hears about it).
export const stopTimer = (timer: Timer): Timer =>
  timer.status === 'running' && timeLeft(timer) > 0 ? { ...timer, status: 'stopped', remaining: timeLeft(timer) } : timer

export const resetTimer = (timer: Timer): Timer => ({ ...timer, status: 'reset', remaining: timer.seconds * 1000 })

export const changeTimer = { start: startTimer, stop: stopTimer, reset: resetTimer }

// Applies an agent's actions in order. Creates get the next free id; actions on unknown timers are dropped.
export function applyTimerActions(timers: Timer[], actions: TimerAction[]) {
  const applied: TimerAction[] = []
  for (const a of actions) {
    if (a.action === 'create') {
      const id = `t${timers.length + 1}`
      const seconds = a.seconds!
      timers = [...timers, startTimer({ id, label: a.label!.trim().slice(0, 100), seconds, status: 'reset', endsAt: 0, remaining: seconds * 1000 })]
      applied.push({ ...a, timer: id })
      continue
    }
    if (!timers.some((t) => t.id === a.timer)) continue
    timers = timers.map((t) => (t.id === a.timer ? changeTimer[a.action as keyof typeof changeTimer](t) : t))
    applied.push(a)
  }
  return { timers, actions: applied }
}

// What the app gets: time left as of now, so the server's and the app's clocks needn't agree.
export const toWire = (t: Timer) => ({
  id: t.id,
  label: t.label,
  seconds: t.seconds,
  status: t.status,
  remaining: timeLeft(t),
})

type TimerRow = { id: string; label: string; seconds: number; status: Timer['status']; endsAt: Date | null; remainingMs: number }

const fromRow = (r: TimerRow): Timer => ({
  id: r.id,
  label: r.label,
  seconds: r.seconds,
  status: r.status,
  endsAt: r.endsAt?.getTime() ?? 0,
  remaining: r.remainingMs,
})

export async function loadTimers(db: Db, agentId: string) {
  const rows = await db<TimerRow[]>`
    select id, label, seconds, status, ends_at, remaining_ms from timers
    where agent_id = ${agentId} order by length(id), id`
  return rows.map(fromRow)
}

// Writes the timers that changed since `before` (the changes above return new objects).
export async function saveTimers(db: Db, agentId: string, before: Timer[], after: Timer[]) {
  for (const t of after) {
    if (before.includes(t)) continue
    const endsAt = t.status === 'running' ? new Date(t.endsAt) : null
    await db`
      insert into timers (agent_id, id, label, seconds, status, ends_at, remaining_ms)
      values (${agentId}, ${t.id}, ${t.label}, ${t.seconds}, ${t.status}, ${endsAt}, ${Math.round(t.remaining)})
      on conflict (agent_id, id) do update
      set status = excluded.status, ends_at = excluded.ends_at, remaining_ms = excluded.remaining_ms`
  }
}
