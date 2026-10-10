import type { Shape } from './components/AgentIcon'

// Agents, chats and timers live on the server, which also runs replies and timers. The app shows them
// and gets live updates (see Home).

// What an agent did to its timers along with a message. A create carries the id the server gave the timer.
export type TimerAction = {
  action: 'create' | 'start' | 'stop' | 'reset'
  timer: string | null
  label: string | null
  seconds: number | null
}

// 'event' is something that happened (a timer ran out), which the agent reads too.
// A file the user sent, stored on the server. Shown as <img src="oa-file://<id>"> (see the main process).
export type Attachment = { id: string; name: string; type: string; size: number }

export type Message = {
  id: string
  from: 'user' | 'agent' | 'event'
  text: string
  timers?: TimerAction[]
  attachments?: Attachment[]
  createdAt: string
}

export const attachmentUrl = (id: string) => `oa-file://${id}`

// Images the editor can draw on (and that show as pictures).
export const isImage = (type: string) => ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/avif'].includes(type)

export type Timer = {
  id: string
  label: string
  seconds: number
  status: 'running' | 'stopped' | 'reset' | 'done'
  // While running, when it runs out by this computer's clock; otherwise how many milliseconds are left.
  endsAt: number
  remaining: number
}

// How the server sends a timer: time left as of sending, in milliseconds.
export type WireTimer = Omit<Timer, 'endsAt'>

export const fromWire = (t: WireTimer): Timer => ({ ...t, endsAt: Date.now() + t.remaining })

export type Agent = {
  id: string
  name: string
  shape: Shape
  messages: Message[]
  timers: Timer[]
  pinned: boolean
  unread: boolean
}

export const timeLeft = (timer: Timer, now = Date.now()) =>
  timer.status === 'running' ? Math.max(0, timer.endsAt - now) : timer.remaining

export const formatClock = (ms: number) => {
  const total = Math.ceil(ms / 1000)
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  if (d) return `${d}d ${h}:${String(m).padStart(2, '0')}:${s}`
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}
