import { Hono } from 'hono'
import { z } from 'zod'
import type { User } from '../db.ts'
import { requireUser } from '../auth.ts'
import { aiConfigured, MAX_TIMER_SECONDS, nextMessage } from '../agents/reply.ts'

export const agents = new Hono<{ Variables: { user: User; tokenHash: string } }>()

agents.use(requireUser)

const timerAction = z.object({
  action: z.enum(['create', 'start', 'stop', 'reset']),
  timer: z.string().max(20).nullable(),
  label: z.string().max(200).nullable(),
  seconds: z.number().int().nullable(),
})

const replyBody = z.object({
  agent: z.object({ name: z.string().trim().min(1).max(50) }),
  timeZone: z.string().max(100),
  messages: z
    .array(
      z.object({
        from: z.enum(['user', 'agent', 'event']),
        text: z.string().max(100_000),
        timers: z.array(timerAction).max(50).optional(),
      }),
    )
    .min(1)
    .max(5000),
  // The chat's timers as they are now.
  timers: z
    .array(
      z.object({
        id: z.string().max(20),
        label: z.string().max(200),
        seconds: z.number().int().min(1).max(MAX_TIMER_SECONDS),
        status: z.enum(['running', 'stopped', 'reset', 'done']),
        remaining: z.number().int().min(0).max(MAX_TIMER_SECONDS),
      }),
    )
    .max(200)
    .default([]),
})

// The agent's next message in a chat. The app calls this again while `more` is true,
// and drops the request (which aborts the model call) when the user writes in the meantime.
agents.post('/reply', async (c) => {
  const body = replyBody.safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'invalid_request' }, 400)
  if (!aiConfigured()) return c.json({ error: 'ai_not_configured' }, 503)

  const user = c.get('user')
  const { agent, messages, timers } = body.data
  const timeZone = Intl.supportedValuesOf('timeZone').includes(body.data.timeZone) ? body.data.timeZone : 'UTC'
  const now = new Date().toLocaleString('en-US', { timeZone, dateStyle: 'full', timeStyle: 'short' })
  const signal = c.req.raw.signal
  try {
    const next = await nextMessage(
      { agentName: agent.name, userName: user.name ?? 'the user', email: user.email, now, timeZone, timers },
      messages,
      signal,
    )
    return c.json(next)
  } catch (err) {
    // The app already moved on; nobody reads this response.
    if (signal.aborted) return c.body(null)
    console.error('agent reply failed', err)
    return c.json({ error: 'ai_failed' }, 502)
  }
})
