import { Hono } from 'hono'
import { getConnInfo } from '@hono/node-server/conninfo'
import { z } from 'zod'
import { sql, type User } from '../db.ts'
import { sendCode } from '../mail.ts'
import { exchangeGoogleCode } from '../google.ts'
import { bearer, createSession, hash, newCode, rateLimited, sameHash } from '../auth.ts'

const CODE_TTL_MIN = 10
const RESEND_COOLDOWN_S = 30
const MAX_ATTEMPTS = 5

const email = z.string().trim().toLowerCase().max(254).pipe(z.email())

export const auth = new Hono()

auth.post('/email/start', async (c) => {
  const body = z.object({ email }).safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'invalid_email' }, 400)
  const addr = body.data.email
  const ip = getConnInfo(c).remote.address ?? 'unknown'
  if (rateLimited(`start-ip:${ip}`, 20, 60 * 60_000) || rateLimited(`start-email:${addr}`, 8, 60 * 60_000)) {
    return c.json({ error: 'rate_limited' }, 429)
  }

  const [existing] = await sql<{ wait: number }[]>`
    select ceil(${RESEND_COOLDOWN_S} - extract(epoch from now() - last_sent_at))::int as wait
    from email_codes where email = ${addr}`
  if (existing && existing.wait > 0) return c.json({ error: 'cooldown', retryAfter: existing.wait }, 429)

  const code = newCode()
  await sql`
    insert into email_codes (email, code_hash, expires_at)
    values (${addr}, ${hash(code)}, now() + make_interval(mins => ${CODE_TTL_MIN}))
    on conflict (email) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at,
      attempts = 0, last_sent_at = now()`
  try {
    await sendCode(addr, code)
  } catch (err) {
    console.error('sending code failed', err)
    await sql`delete from email_codes where email = ${addr}`
    return c.json({ error: 'email_failed' }, 502)
  }
  return c.json({ ok: true, resendAfter: RESEND_COOLDOWN_S })
})

auth.post('/email/verify', async (c) => {
  const body = z
    .object({ email, code: z.string().regex(/^\d{6}$/) })
    .safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'invalid_code' }, 400)
  const { email: addr, code } = body.data

  const [row] = await sql<{ codeHash: string; attempts: number; expired: boolean }[]>`
    select code_hash, attempts, expires_at < now() as expired from email_codes where email = ${addr}`
  if (!row || row.expired) return c.json({ error: 'code_expired' }, 400)
  if (row.attempts >= MAX_ATTEMPTS) return c.json({ error: 'too_many_attempts' }, 429)
  if (!sameHash(row.codeHash, hash(code))) {
    await sql`update email_codes set attempts = attempts + 1 where email = ${addr}`
    const left = MAX_ATTEMPTS - row.attempts - 1
    return c.json({ error: left > 0 ? 'invalid_code' : 'too_many_attempts', attemptsLeft: left }, 400)
  }

  await sql`delete from email_codes where email = ${addr}`
  await sql`insert into users (email) values (${addr}) on conflict (email) do nothing`
  const [user] = await sql<User[]>`select id, email, name, avatar_url from users where email = ${addr}`
  return c.json({ token: await createSession(user.id), user })
})

// The desktop app needs the (public) client ID to open Google's consent page.
auth.get('/google/client', (c) => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  return clientId ? c.json({ clientId }) : c.json({ error: 'google_not_configured' }, 503)
})

auth.post('/google', async (c) => {
  const body = z
    .object({
      code: z.string().min(1),
      codeVerifier: z.string().min(43).max(128),
      redirectUri: z.string().regex(/^http:\/\/127\.0\.0\.1:\d+\/callback$/),
    })
    .safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'invalid_request' }, 400)

  let profile
  try {
    profile = await exchangeGoogleCode(body.data.code, body.data.codeVerifier, body.data.redirectUri)
  } catch (err) {
    console.error('google sign-in failed', err)
    return c.json({ error: 'google_failed' }, 400)
  }

  // Match by Google account first, then link an existing email account, else create one.
  const [user] = await sql<User[]>`
    insert into users (email, google_sub, avatar_url)
    values (${profile.email}, ${profile.sub}, ${profile.picture})
    on conflict (email) do update set
      google_sub = excluded.google_sub,
      avatar_url = case when users.google_sub is null and users.avatar_url is not null
                        then users.avatar_url else excluded.avatar_url end
    returning id, email, name, avatar_url`
  return c.json({ token: await createSession(user.id), user, suggestedName: profile.name })
})

auth.post('/logout', async (c) => {
  const token = bearer(c.req.header('authorization'))
  if (token) await sql`delete from sessions where token_hash = ${hash(token)}`
  return c.json({ ok: true })
})
