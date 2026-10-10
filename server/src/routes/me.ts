import { Hono } from 'hono'
import { z } from 'zod'
import { sql, type User } from '../db.ts'
import { requireUser } from '../auth.ts'
import { deleteOpenAiFiles } from '../agents/attachments.ts'

// The app crops and shrinks photos to 512px before uploading, so this is plenty.
export const MAX_AVATAR_SIZE = 1024 * 1024
const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

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

// A new photo replaces the old one. It gets a new id, so the app never shows a stale cached copy.
me.put('/avatar', async (c) => {
  const body = await c.req.parseBody().catch(() => null)
  const file = body?.file
  if (!(file instanceof File) || !AVATAR_TYPES.includes(file.type)) return c.json({ error: 'invalid_image' }, 400)
  if (file.size > MAX_AVATAR_SIZE) return c.json({ error: 'too_large' }, 413)
  const data = Buffer.from(await file.arrayBuffer())
  const userId = c.get('user').id
  const user = await sql.begin(async (tx) => {
    await tx`delete from avatars where user_id = ${userId}`
    const [avatar] = await tx<{ id: string }[]>`
      insert into avatars (user_id, type, data) values (${userId}, ${file.type}, ${data}) returning id`
    const [user] = await tx<User[]>`
      update users set avatar_url = ${`/me/avatar/${avatar.id}`} where id = ${userId}
      returning id, email, name, avatar_url`
    return user
  })
  return c.json({ user })
})

// The photo itself, only to its owner.
me.get('/avatar/:avatarId', async (c) => {
  const id = c.req.param('avatarId')
  if (!z.uuid().safeParse(id).success) return c.json({ error: 'not_found' }, 404)
  const [row] = await sql<{ type: string; data: Buffer }[]>`
    select type, data from avatars where id = ${id} and user_id = ${c.get('user').id}`
  if (!row) return c.json({ error: 'not_found' }, 404)
  return c.body(new Uint8Array(row.data), 200, {
    'content-type': row.type,
    'content-length': String(row.data.length),
    // Never changes: a new photo gets a new id.
    'cache-control': 'private, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
    'content-security-policy': 'sandbox',
  })
})

me.delete('/', async (c) => {
  const [files] = await sql<{ ids: string[] | null }[]>`
    select array_agg(openai_file_id) as ids from attachments where user_id = ${c.get('user').id} and openai_file_id is not null`
  await sql`delete from users where id = ${c.get('user').id}`
  deleteOpenAiFiles(files?.ids ?? [])
  return c.json({ ok: true })
})
