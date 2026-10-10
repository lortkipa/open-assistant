import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { logger } from 'hono/logger'
import { migrate } from './migrate.ts'
import { auth } from './routes/auth.ts'
import { me } from './routes/me.ts'

await migrate()

const app = new Hono()
app.use(logger())
app.use(bodyLimit({ maxSize: 16 * 1024 }))
app.get('/health', (c) => c.json({ ok: true }))
app.route('/auth', auth)
app.route('/me', me)
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'server_error' }, 500)
})

const port = Number(process.env.PORT ?? 8787)
serve({ fetch: app.fetch, port }, () => console.log(`server listening on :${port}`))
