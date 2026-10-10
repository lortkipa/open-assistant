import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// The session token lives only in the main process, encrypted with the OS keychain when available.
const file = () => join(app.getPath('userData'), 'session.bin')
let cached: string | null | undefined

// Server tokens are 32 random bytes in base64url. Anything else is corrupt or left over from an older build.
const isToken = (s: string) => /^[A-Za-z0-9_-]{43}$/.test(s)

export function getToken(): string | null {
  if (cached !== undefined) return cached
  try {
    const raw = existsSync(file()) ? readFileSync(file()) : null
    cached = raw ? (safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString()) : null
  } catch {
    cached = null
  }
  if (cached !== null && !isToken(cached)) clearToken()
  return cached
}

export function setToken(token: string) {
  cached = token
  const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(token) : Buffer.from(token)
  writeFileSync(file(), data, { mode: 0o600 })
}

export function clearToken() {
  cached = null
  rmSync(file(), { force: true })
}
