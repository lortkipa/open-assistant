import { Hono, type Context } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import { sql, type User } from '../db.ts'
import { requireUser } from '../auth.ts'
import { publish, subscribe, type Event } from '../events.ts'
import { cancelReply, isReplying, scheduleWake, startReply } from '../agents/runner.ts'
import { agentState, insertMessage, type AgentRow } from '../agents/store.ts'
import { deleteOpenAiFiles, MAX_ATTACHMENT_SIZE, MAX_ATTACHMENTS, type AttachmentMeta } from '../agents/attachments.ts'
import { changeTimer, loadTimers, saveTimers, toWire } from '../agents/timers.ts'
import { cancelReminder, loadReminders, saveReminders, toWire as reminderToWire } from '../agents/reminders.ts'

type Env = { Variables: { user: User; tokenHash: string } }

export const agents = new Hono<Env>()

agents.use(requireUser)

// The characters in the app (desktop/src/renderer/src/components/AgentIcon.tsx).
const shape = z.enum(['blob', 'bean', 'square', 'pill', 'crescent', 'pear', 'plus', 'diamond', 'egg', 'peanut', 'dome', 'clover'])
const name = z.string().trim().min(1).max(40)

const parse = async <T extends z.ZodType>(c: Context, schema: T) => schema.safeParse(await c.req.json().catch(() => null))

// The user's agent with this id, or undefined.
async function findAgent(c: Context<Env>) {
  const id = c.req.param('id')!
  // A malformed id would make Postgres throw instead of finding nothing.
  if (!z.uuid().safeParse(id).success) return undefined
  const [agent] = await sql<AgentRow[]>`
    select id, name, shape, pinned, unread from agents where id = ${id} and user_id = ${c.get('user').id}`
  return agent
}

// Everything: agents in creation order, each with its whole chat, its timers and reminders, and whether it's typing.
agents.get('/', async (c) => {
  const rows = await sql<AgentRow[]>`
    select id, name, shape, pinned, unread from agents where user_id = ${c.get('user').id} order by created_at, id`
  const states = await Promise.all(rows.map(agentState))
  return c.json({ agents: states.map((agent) => ({ ...agent, typing: isReplying(agent.id) })) })
})

// Live updates for the app: new messages, typing, timers, reminders, and changes made elsewhere.
agents.get('/events', (c) => {
  const userId = c.get('user').id
  return streamSSE(c, async (stream) => {
    let queue = Promise.resolve()
    const send = (event: Event) => {
      queue = queue.then(() => stream.writeSSE({ data: JSON.stringify(event) })).catch(() => {})
    }
    const unsubscribe = subscribe(userId, send)
    stream.onAbort(unsubscribe)
    // Comments keep idle connections from being cut by proxies.
    while (!stream.aborted) {
      await stream.sleep(25_000)
      if (!stream.aborted) await stream.write(': ping\n\n').catch(() => {})
    }
  })
})

// The app uploads each file as soon as it's attached; sending a message then claims it. Until
// then it belongs to the user, not to an agent (the composer keeps files across chats).
agents.post('/attachments', async (c) => {
  const body = await c.req.parseBody().catch(() => null)
  const file = body?.file
  if (!(file instanceof File)) return c.json({ error: 'invalid_request' }, 400)
  if (file.size > MAX_ATTACHMENT_SIZE) return c.json({ error: 'too_large' }, 413)
  const data = Buffer.from(await file.arrayBuffer())
  const name = file.name.trim().slice(0, 255) || 'file'
  const type = file.type.slice(0, 255) || 'application/octet-stream'
  const [attachment] = await sql<AttachmentMeta[]>`
    insert into attachments (user_id, name, type, size, data)
    values (${c.get('user').id}, ${name}, ${type}, ${data.length}, ${data})
    returning id, name, type, size`
  return c.json({ attachment })
})

// The file itself, only to its owner.
agents.get('/attachments/:attachmentId', async (c) => {
  const id = c.req.param('attachmentId')
  if (!z.uuid().safeParse(id).success) return c.json({ error: 'not_found' }, 404)
  const [row] = await sql<{ type: string; data: Buffer }[]>`
    select type, data from attachments where id = ${id} and user_id = ${c.get('user').id}`
  if (!row) return c.json({ error: 'not_found' }, 404)
  return c.body(new Uint8Array(row.data), 200, {
    'content-type': row.type,
    'content-length': String(row.data.length),
    // Never changes: an edited image is uploaded as a new attachment.
    'cache-control': 'private, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
    'content-security-policy': 'sandbox',
  })
})

agents.post('/', async (c) => {
  const body = await parse(c, z.object({ name, shape }))
  if (!body.success) return c.json({ error: 'invalid_request' }, 400)
  const userId = c.get('user').id
  const [agent] = await sql<AgentRow[]>`
    insert into agents (user_id, name, shape) values (${userId}, ${body.data.name}, ${body.data.shape})
    returning id, name, shape, pinned, unread`
  const state = await agentState(agent)
  publish(userId, { type: 'agent', agent: state })
  return c.json({ agent: state })
})

// Only the given fields change, so this can't undo an unread mark a reply just set.
agents.patch('/:id', async (c) => {
  const body = await parse(c, z.object({ name, shape, pinned: z.boolean(), unread: z.boolean() }).partial())
  if (!body.success) return c.json({ error: 'invalid_request' }, 400)
  const current = await findAgent(c)
  if (!current) return c.json({ error: 'not_found' }, 404)
  const { name: newName = null, shape: newShape = null, pinned = null, unread = null } = body.data
  const [agent] = await sql<AgentRow[]>`
    update agents set name = coalesce(${newName}, name), shape = coalesce(${newShape}, shape),
      pinned = coalesce(${pinned}, pinned), unread = coalesce(${unread}, unread)
    where id = ${current.id} returning id, name, shape, pinned, unread`
  publish(c.get('user').id, { type: 'agent', agent })
  return c.json({ agent })
})

agents.delete('/:id', async (c) => {
  const agent = await findAgent(c)
  if (!agent) return c.json({ error: 'not_found' }, 404)
  cancelReply(agent.id)
  const [files] = await sql<{ ids: string[] | null }[]>`
    select array_agg(openai_file_id) as ids from attachments where agent_id = ${agent.id} and openai_file_id is not null`
  await sql`delete from agents where id = ${agent.id}`
  deleteOpenAiFiles(files?.ids ?? [])
  publish(c.get('user').id, { type: 'agent_deleted', id: agent.id })
  scheduleWake()
  return c.json({ ok: true })
})

// The user writes, maybe with attachments uploaded beforehand. A reply in flight is dropped (aborting its model call), and the agent starts
// over with the whole chat; messages it already sent stay.
agents.post('/:id/messages', async (c) => {
  const schema = z
    .object({
      text: z.string().trim().max(100_000),
      attachmentIds: z.array(z.uuid()).max(MAX_ATTACHMENTS).default([]),
      timeZone: z.string().max(100),
    })
    .refine((b) => b.text || b.attachmentIds.length)
  const body = await parse(c, schema)
  if (!body.success) return c.json({ error: 'invalid_request' }, 400)
  const agent = await findAgent(c)
  if (!agent) return c.json({ error: 'not_found' }, 404)
  const user = c.get('user')
  cancelReply(agent.id)
  // Saved for replies the server starts on its own, like when a timer runs out.
  if (Intl.supportedValuesOf('timeZone').includes(body.data.timeZone)) {
    await sql`update users set time_zone = ${body.data.timeZone} where id = ${user.id}`
  }
  const ids = [...new Set(body.data.attachmentIds)]
  const message = await sql.begin((tx) => insertMessage(tx, agent.id, 'user', body.data.text, {}, ids))
  const timers = (await loadTimers(sql, agent.id)).map(toWire)
  publish(user.id, { type: 'message', agentId: agent.id, message, timers })
  startReply(user.id, agent.id)
  return c.json({ message })
})

// Ticking a task-list checkbox in an agent's message rewrites its text, so the agent sees it too.
agents.patch('/:id/messages/:messageId', async (c) => {
  const body = await parse(c, z.object({ text: z.string().max(100_000) }))
  const messageId = c.req.param('messageId')
  if (!body.success || !/^\d{1,18}$/.test(messageId)) return c.json({ error: 'invalid_request' }, 400)
  const agent = await findAgent(c)
  if (!agent) return c.json({ error: 'not_found' }, 404)
  const [edited] = await sql`
    update messages set text = ${body.data.text}
    where id = ${messageId} and agent_id = ${agent.id} and sender = 'agent' returning id`
  if (!edited) return c.json({ error: 'not_found' }, 404)
  publish(c.get('user').id, { type: 'message_edited', agentId: agent.id, id: messageId, text: body.data.text })
  return c.json({ ok: true })
})

// The user runs a timer from its card. The agent sees the new state next time it replies.
agents.post('/:id/timers/:timerId', async (c) => {
  const body = await parse(c, z.object({ action: z.enum(['start', 'stop', 'reset']) }))
  if (!body.success) return c.json({ error: 'invalid_request' }, 400)
  const agent = await findAgent(c)
  if (!agent) return c.json({ error: 'not_found' }, 404)
  const timerId = c.req.param('timerId')
  const timers = await sql.begin(async (tx) => {
    await tx`select 1 from agents where id = ${agent.id} for update`
    const before = await loadTimers(tx, agent.id)
    if (!before.some((t) => t.id === timerId)) return null
    const after = before.map((t) => (t.id === timerId ? changeTimer[body.data.action](t) : t))
    await saveTimers(tx, agent.id, before, after)
    return after.map(toWire)
  })
  if (!timers) return c.json({ error: 'not_found' }, 404)
  publish(c.get('user').id, { type: 'timers', agentId: agent.id, timers })
  scheduleWake()
  return c.json({ timers })
})

// The user cancels a reminder from its card. The chat gets an event saying so: the agent's own
// earlier texts still say it's set, and it would go by those otherwise. It reads it next time it replies.
agents.post('/:id/reminders/:reminderId', async (c) => {
  const body = await parse(c, z.object({ action: z.literal('cancel') }))
  if (!body.success) return c.json({ error: 'invalid_request' }, 400)
  const agent = await findAgent(c)
  if (!agent) return c.json({ error: 'not_found' }, 404)
  const reminderId = c.req.param('reminderId')
  const cancelled = await sql.begin(async (tx) => {
    await tx`select 1 from agents where id = ${agent.id} for update`
    const before = await loadReminders(tx, agent.id)
    const reminder = before.find((r) => r.id === reminderId)
    if (!reminder) return null
    const after = before.map((r) => (r === reminder ? cancelReminder(r) : r))
    await saveReminders(tx, agent.id, before, after)
    const event =
      reminder.status === 'pending'
        ? await insertMessage(tx, agent.id, 'event', `The user cancelled reminder ${reminder.id} (“${reminder.note}”) from its card.`)
        : null
    return { reminders: after.map(reminderToWire), event }
  })
  if (!cancelled) return c.json({ error: 'not_found' }, 404)
  const { reminders, event } = cancelled
  const userId = c.get('user').id
  if (event) publish(userId, { type: 'message', agentId: agent.id, message: event, reminders })
  publish(userId, { type: 'reminders', agentId: agent.id, reminders })
  scheduleWake()
  return c.json({ reminders })
})
