import { sql, type Db } from '../db.ts'
import type { ChatMessage, TimerAction } from './reply.ts'
import { loadTimers, toWire } from './timers.ts'

export type Message = ChatMessage & { id: string; createdAt: string }

type MessageRow = { id: string; sender: ChatMessage['from']; text: string; timers: TimerAction[] | null; createdAt: Date }

const toMessage = (r: MessageRow): Message => ({
  id: r.id,
  from: r.sender,
  text: r.text,
  ...(r.timers?.length && { timers: r.timers }),
  createdAt: r.createdAt.toISOString(),
})

export async function loadMessages(db: Db, agentId: string) {
  const rows = await db<MessageRow[]>`
    select id, sender, text, timers, created_at from messages where agent_id = ${agentId} order by id`
  return rows.map(toMessage)
}

export async function insertMessage(db: Db, agentId: string, from: ChatMessage['from'], text: string, timers?: TimerAction[]) {
  const [row] = await db<MessageRow[]>`
    insert into messages (agent_id, sender, text, timers)
    values (${agentId}, ${from}, ${text}, ${timers?.length ? db.json(timers) : null})
    returning id, sender, text, timers, created_at`
  return toMessage(row)
}

export type AgentRow = { id: string; name: string; shape: string; pinned: boolean; unread: boolean }

// Everything the app shows for one agent.
export async function agentState(agent: AgentRow) {
  const [messages, timers] = await Promise.all([loadMessages(sql, agent.id), loadTimers(sql, agent.id)])
  return { ...agent, messages, timers: timers.map(toWire) }
}
