import { clearToken, getToken, setToken } from './session'

export const API_URL = (import.meta.env.MAIN_VITE_API_URL || 'http://localhost:8787').replace(/\/$/, '')

// All server calls go through the main process so the renderer never sees the session token.
export async function request(method: string, path: string, body?: unknown) {
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
    })
  } catch {
    return { status: 0, data: { error: 'network' } }
  }
  const data = await res.json().catch(() => ({}))

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

// One attached file, as multipart. Uploaded right after it's attached; a message claims it later.
export async function upload(name: string, type: string, bytes: ArrayBuffer) {
  const token = getToken()
  const form = new FormData()
  form.append('file', new File([bytes], name, { type }))
  let res: Response
  try {
    res = await fetch(`${API_URL}/agents/attachments`, {
      method: 'POST',
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: form,
    })
  } catch {
    return { status: 0, data: { error: 'network' } }
  }
  if (res.status === 401) clearToken()
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

// An attachment's bytes, straight from the server.
export async function fetchAttachment(id: string) {
  const token = getToken()
  return fetch(`${API_URL}/agents/attachments/${encodeURIComponent(id)}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}
