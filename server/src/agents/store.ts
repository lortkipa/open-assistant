import { sql, type Db } from '../db.ts'
import type { AttachmentMeta } from './attachments.ts'
import type { ChatMessage, ReminderAction, TimerAction } from './reply.ts'
import { loadReminders, toWire as reminderToWire } from './reminders.ts'
import { loadTimers, toWire } from './timers.ts'

export type Message = Omit<ChatMessage, 'attachments'> & { id: string; attachments?: AttachmentMeta[]; createdAt: string }

type MessageRow = {
  id: string
  sender: ChatMessage['from']
  text: string
  timers: TimerAction[] | null
  reminders: ReminderAction[] | null
  attachments: AttachmentMeta[] | null
  createdAt: Date
}

const toMessage = (r: MessageRow): Message => ({
  id: r.id,
  from: r.sender,
  text: r.text,
  ...(r.timers?.length && { timers: r.timers }),
  ...(r.reminders?.length && { reminders: r.reminders }),
  ...(r.attachments?.length && { attachments: r.attachments }),
  createdAt: r.createdAt.toISOString(),
})

export async function loadMessages(db: Db, agentId: string) {
  const rows = await db<MessageRow[]>`
    select m.id, m.sender, m.text, m.timers, m.reminders, m.created_at,
      (select json_agg(json_build_object('id', a.id, 'name', a.name, 'type', a.type, 'size', a.size) order by a.position)
       from attachments a where a.message_id = m.id) as attachments
    from messages m where m.agent_id = ${agentId} order by m.id`
  return rows.map(toMessage)
}

// The attachments are the user's uploads that no message has claimed yet; others are ignored.
export async function insertMessage(
  db: Db,
  agentId: string,
  from: ChatMessage['from'],
  text: string,
  actions: { timers?: TimerAction[]; reminders?: ReminderAction[] } = {},
  attachmentIds: string[] = [],
) {
  const { timers, reminders } = actions
  const [row] = await db<MessageRow[]>`
    insert into messages (agent_id, sender, text, timers, reminders)
    values (${agentId}, ${from}, ${text}, ${timers?.length ? db.json(timers) : null}, ${reminders?.length ? db.json(reminders) : null})
    returning id, sender, text, timers, reminders, created_at`
  if (!attachmentIds.length) return toMessage({ ...row, attachments: null })
  const attachments = await db<AttachmentMeta[]>`
    update attachments
    set message_id = ${row.id}, agent_id = ${agentId}, position = array_position(${attachmentIds}::uuid[], id)
    where id = any(${attachmentIds}::uuid[]) and message_id is null
      and user_id = (select user_id from agents where id = ${agentId})
    returning id, name, type, size`
  attachments.sort((a, b) => attachmentIds.indexOf(a.id) - attachmentIds.indexOf(b.id))
  return toMessage({ ...row, attachments })
}

export type AgentRow = { id: string; name: string; shape: string; pinned: boolean; unread: boolean }

// Everything the app shows for one agent.
export async function agentState(agent: AgentRow) {
  const [messages, timers, reminders] = await Promise.all([
    loadMessages(sql, agent.id),
    loadTimers(sql, agent.id),
    loadReminders(sql, agent.id),
  ])
  return { ...agent, messages, timers: timers.map(toWire), reminders: reminders.map(reminderToWire) }
}
