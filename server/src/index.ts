import { serve } from '@hono/node-server'
import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { logger } from 'hono/logger'
import { migrate } from './migrate.ts'
import { scheduleTimers } from './agents/runner.ts'
import { MAX_ATTACHMENT_SIZE, startSweeping } from './agents/attachments.ts'
import { agents } from './routes/agents.ts'
import { auth } from './routes/auth.ts'
import { MAX_AVATAR_SIZE, me } from './routes/me.ts'

await migrate()
// Timers that ran out while the server was down finish right away.
scheduleTimers()
startSweeping()

const app = new Hono()
app.use(logger())
// A message can be long and an attachment large; everything else stays small.
const tooLarge = (c: Context) => c.json({ error: 'too_large' }, 413)
const smallBody = bodyLimit({ maxSize: 16 * 1024, onError: tooLarge })
const chatBody = bodyLimit({ maxSize: 2 * 1024 * 1024, onError: tooLarge })
// One attached file, plus room for the multipart wrapping.
const uploadBody = bodyLimit({ maxSize: MAX_ATTACHMENT_SIZE + 64 * 1024, onError: tooLarge })
const avatarBody = bodyLimit({ maxSize: MAX_AVATAR_SIZE + 64 * 1024, onError: tooLarge })
const limitFor = (path: string) =>
  path === '/agents/attachments'
    ? uploadBody
    : path === '/me/avatar'
      ? avatarBody
      : path.startsWith('/agents/')
        ? chatBody
        : smallBody
app.use((c, next) => limitFor(c.req.path)(c, next))
app.get('/health', (c) => c.json({ ok: true }))
app.route('/auth', auth)
app.route('/me', me)
app.route('/agents', agents)
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'server_error' }, 500)
})

const port = Number(process.env.PORT ?? 8787)
serve({ fetch: app.fetch, port }, () => console.log(`server listening on :${port}`))
