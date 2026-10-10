import type { WebContents } from 'electron'
import { API_URL } from './api'
import { clearToken, getToken } from './session'

// The server's live updates (GET /agents/events), passed to the renderer as 'api:event' messages.
// Every (re)connect sends { type: 'open' } first, so the renderer reloads what it may have missed.

let controller: AbortController | null = null

export function startEvents(target: WebContents) {
  stopEvents()
  const current = new AbortController()
  controller = current
  void listen(target, current.signal)
}

export function stopEvents() {
  controller?.abort()
  controller = null
}

async function listen(target: WebContents, signal: AbortSignal) {
  let delay = 1000
  while (!signal.aborted && !target.isDestroyed()) {
    try {
      const token = getToken()
      const res = await fetch(`${API_URL}/agents/events`, {
        headers: { ...(token && { authorization: `Bearer ${token}` }) },
        signal,
      })
      if (res.status === 401) {
        clearToken()
        return
      }
      if (res.ok && res.body) {
        delay = 1000
        target.send('api:event', { type: 'open' })
        await read(res.body, (event) => !target.isDestroyed() && target.send('api:event', event))
      }
    } catch {}
    if (signal.aborted) return
    await new Promise((resolve) => setTimeout(resolve, delay))
    delay = Math.min(delay * 2, 30_000)
  }
}

// Server-sent events are blank-line separated; only `data:` lines matter here (the rest are pings).
async function read(body: ReadableStream<Uint8Array>, onEvent: (event: unknown) => void) {
  const decoder = new TextDecoder()
  let buffer = ''
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n?/g, '\n')
    let end: number
    while ((end = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      const data = block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).replace(/^ /, ''))
        .join('\n')
      if (!data) continue
      try {
        onEvent(JSON.parse(data))
      } catch {}
    }
  }
}
