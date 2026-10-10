import type { Shape } from './components/AgentIcon'

// Agents live only in the app's memory for now; replies come from the server.

// What an agent did to its timers along with a message. A create carries the id the app gave the timer.
export type TimerAction = {
  action: 'create' | 'start' | 'stop' | 'reset'
  timer: string | null
  label: string | null
  seconds: number | null
}

// 'event' is something that happened in the app (a timer ran out), which the agent reads too.
export type Message = { from: 'user' | 'agent' | 'event'; text: string; time: string; timers?: TimerAction[] }

export type Timer = {
  id: string
  label: string
  seconds: number
  status: 'running' | 'stopped' | 'reset' | 'done'
  // While running, when it runs out; otherwise how many milliseconds are left.
  endsAt: number
  remaining: number
}

export type Agent = {
  id: string
  name: string
  shape: Shape
  messages: Message[]
  timers: Timer[]
  pinned?: boolean
  unread?: boolean
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

export const finishTimer = (timer: Timer): Timer => ({ ...timer, status: 'done', remaining: 0 })

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
    const change = a.action === 'start' ? startTimer : a.action === 'stop' ? stopTimer : resetTimer
    if (!timers.some((t) => t.id === a.timer)) continue
    timers = timers.map((t) => (t.id === a.timer ? change(t) : t))
    applied.push(a)
  }
  return { timers, actions: applied }
}

export const formatClock = (ms: number) => {
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}
