import type { Shape } from './components/AgentIcon'

// Agent types and a stand-in reply until real agents exist.

export type Message = { from: 'user' | 'agent'; text: string; time: string }

export type Agent = {
  id: string
  name: string
  shape: Shape
  messages: Message[]
}

const REPLIES = [
  "Got it. I'll start on that now and message you when there's something worth your attention.",
  "On it. This may take a while, so feel free to close the app. I'll keep working in the background.",
  'Sure. I added it to my list and will report back with what I find.',
  "Understood. I'll check on it every hour and only ping you if something changes.",
]

// A canned answer until agents are real; questions get their own.
export function fakeReply(text: string) {
  if (text.trim().endsWith('?')) return "Good question. Let me look into it and I'll get back to you shortly."
  return REPLIES[Math.floor(Math.random() * REPLIES.length)]
}
