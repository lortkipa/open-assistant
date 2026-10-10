import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { createMiddleware } from 'hono/factory'
import { sql, type User } from './db.ts'

export const hash = (s: string) => createHash('sha256').update(s).digest('hex')

export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0')

export function sameHash(a: string, b: string) {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url')
  await sql`insert into sessions (token_hash, user_id) values (${hash(token)}, ${userId})`
  return token
}

export function bearer(header: string | undefined) {
  return header?.startsWith('Bearer ') ? header.slice(7) : null
}

export const requireUser = createMiddleware<{ Variables: { user: User; tokenHash: string } }>(async (c, next) => {
  const token = bearer(c.req.header('authorization'))
  if (!token) return c.json({ error: 'unauthorized' }, 401)
  const tokenHash = hash(token)
  const [user] = await sql<User[]>`
    update sessions s set last_used_at = now() from users u
    where s.token_hash = ${tokenHash} and u.id = s.user_id
    returning u.id, u.email, u.name, u.avatar_url, u.theme, u.accent, u.language, u.spellcheck`
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  c.set('user', user)
  c.set('tokenHash', tokenHash)
  await next()
})

// Fixed-window in-memory limiter. Enough for one server process.
const hits = new Map<string, { count: number; reset: number }>()
export function rateLimited(key: string, max: number, windowMs: number) {
  const now = Date.now()
  const entry = hits.get(key)
  if (!entry || entry.reset < now) {
    hits.set(key, { count: 1, reset: now + windowMs })
    return false
  }
  return ++entry.count > max
}
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of hits) if (v.reset < now) hits.delete(k)
}, 60_000).unref()
