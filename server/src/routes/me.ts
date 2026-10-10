import { Hono } from 'hono'
import { z } from 'zod'
import { sql, type User } from '../db.ts'
import { requireUser } from '../auth.ts'

export const me = new Hono<{ Variables: { user: User; tokenHash: string } }>()

me.use(requireUser)

me.get('/', (c) => c.json({ user: c.get('user') }))

me.patch('/', async (c) => {
  const body = z
    .object({ name: z.string().trim().min(1).max(50) })
    .safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'invalid_name' }, 400)
  const [user] = await sql<User[]>`
    update users set name = ${body.data.name} where id = ${c.get('user').id}
    returning id, email, name, avatar_url`
  return c.json({ user })
})

me.delete('/', async (c) => {
  await sql`delete from users where id = ${c.get('user').id}`
  return c.json({ ok: true })
})
