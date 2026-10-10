import { serve } from '@hono/node-server'
import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { logger } from 'hono/logger'
import { migrate } from './migrate.ts'
import { agents } from './routes/agents.ts'
import { auth } from './routes/auth.ts'
import { me } from './routes/me.ts'

await migrate()

const app = new Hono()
app.use(logger())
// Agent replies carry the whole chat; everything else stays small.
const tooLarge = (c: Context) => c.json({ error: 'too_large' }, 413)
const smallBody = bodyLimit({ maxSize: 16 * 1024, onError: tooLarge })
const chatBody = bodyLimit({ maxSize: 2 * 1024 * 1024, onError: tooLarge })
app.use((c, next) => (c.req.path.startsWith('/agents/') ? chatBody : smallBody)(c, next))
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
