import type { Shape } from './components/AgentIcon'

// Agents live only in the app's memory for now; replies come from the server.

export type Message = { from: 'user' | 'agent'; text: string; time: string }

export type Agent = {
  id: string
  name: string
  shape: Shape
  messages: Message[]
  pinned?: boolean
  unread?: boolean
}
