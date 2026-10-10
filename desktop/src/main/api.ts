import { clearToken, getToken, setToken } from './session'

export const API_URL = (import.meta.env.MAIN_VITE_API_URL || 'http://localhost:8787').replace(/\/$/, '')

// All server calls go through the main process so the renderer never sees the session token.
export async function request(method: string, path: string, body?: unknown, signal?: AbortSignal) {
  const token = getToken()
  let res: Response
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: {
        ...(body !== undefined && { 'content-type': 'application/json' }),
        ...(token && { authorization: `Bearer ${token}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch {
    return { status: 0, data: { error: signal?.aborted ? 'aborted' : 'network' } }
  }
  const data = await res.json().catch(() => (signal?.aborted ? { error: 'aborted' } : {}))

  if (typeof data?.token === 'string') {
    setToken(data.token)
    delete data.token
  }
  const signedOut =
    res.status === 401 ||
    (res.ok && path === '/auth/logout') ||
    (res.ok && method === 'DELETE' && path === '/me')
  if (signedOut) clearToken()
  return { status: res.status, data }
}
