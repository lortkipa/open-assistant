import { Hono, type Context } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import { sql, type User } from '../db.ts'
import { requireUser } from '../auth.ts'
import { publish, subscribe, type Event } from '../events.ts'
import { cancelReply, isReplying, scheduleTimers, startReply } from '../agents/runner.ts'
import { agentState, insertMessage, type AgentRow } from '../agents/store.ts'
import { changeTimer, loadTimers, saveTimers, toWire } from '../agents/timers.ts'

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

// Everything: agents in creation order, each with its whole chat, its timers and whether it's typing.
agents.get('/', async (c) => {
  const rows = await sql<AgentRow[]>`
    select id, name, shape, pinned, unread from agents where user_id = ${c.get('user').id} order by created_at, id`
  const states = await Promise.all(rows.map(agentState))
  return c.json({ agents: states.map((agent) => ({ ...agent, typing: isReplying(agent.id) })) })
})

// Live updates for the app: new messages, typing, timers, and changes made elsewhere.
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
  await sql`delete from agents where id = ${agent.id}`
  publish(c.get('user').id, { type: 'agent_deleted', id: agent.id })
  scheduleTimers()
  return c.json({ ok: true })
})

// The user writes. A reply in flight is dropped (aborting its model call), and the agent starts
// over with the whole chat; messages it already sent stay.
agents.post('/:id/messages', async (c) => {
  const body = await parse(c, z.object({ text: z.string().trim().min(1).max(100_000), timeZone: z.string().max(100) }))
  if (!body.success) return c.json({ error: 'invalid_request' }, 400)
  const agent = await findAgent(c)
  if (!agent) return c.json({ error: 'not_found' }, 404)
  const user = c.get('user')
  cancelReply(agent.id)
  // Saved for replies the server starts on its own, like when a timer runs out.
  if (Intl.supportedValuesOf('timeZone').includes(body.data.timeZone)) {
    await sql`update users set time_zone = ${body.data.timeZone} where id = ${user.id}`
  }
  const message = await insertMessage(sql, agent.id, 'user', body.data.text)
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
  scheduleTimers()
  return c.json({ timers })
})
