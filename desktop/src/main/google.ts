import { createHash, randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { shell } from 'electron'
import logo from '../renderer/src/logo.png?inline'

const TIMEOUT_MS = 5 * 60_000

export const DEEP_LINK = 'openassistant://auth/done'

// The tab Google redirects to. On success it hands off to the app through the deep link,
// which lets the OS bring the app to the front.
function page(ok: boolean, deepLink: boolean, nonce: string) {
  const title = ok ? 'You’re signed in' : 'Sign-in didn’t complete'
  const text = ok
    ? deepLink
      ? 'Returning to Open Assistant…'
      : 'You can close this tab and return to Open Assistant.'
    : 'Return to Open Assistant and try again.'
  const handoff = ok && deepLink
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Open Assistant</title>
<style>
  html,body{margin:0;height:100%;background:#000;color:#f4f4f5;font:15px/1.5 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased}
  main{height:100%;display:grid;place-items:center;text-align:center;padding:0 16px}
  img{display:block;margin:0 auto 24px}
  h1{font-size:24px;font-weight:650;letter-spacing:-.02em;margin:0 0 8px}
  p{color:#a1a1aa;margin:0}
  a{display:inline-flex;align-items:center;height:44px;padding:0 20px;margin-top:28px;border-radius:10px;background:#f4f4f5;color:#000;font-weight:550;text-decoration:none}
  a:hover{background:#fff}
</style>
<main><div>
  <img src="${logo}" width="64" height="64" alt="">
  <h1>${title}</h1>
  <p>${text}</p>
  ${handoff ? `<a href="${DEEP_LINK}">Open Open Assistant</a>` : ''}
</div></main>
${handoff ? `<script nonce="${nonce}">location.href=${JSON.stringify(DEEP_LINK)};setTimeout(()=>window.close(),1500)</script>` : ''}
</html>`
}

export const pkce = () => {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

let active: { server: Server; reject: (e: Error) => void } | null = null

export function cancelGoogle() {
  active?.reject(new Error('cancelled'))
}

// Desktop OAuth: open Google in the system browser and catch the redirect on a loopback port.
// deepLink: whether openassistant:// is registered, so the success page can hand off to the app.
export async function googleAuthorize(clientId: string, deepLink: boolean) {
  cancelGoogle()
  const { verifier, challenge } = pkce()
  const state = randomBytes(16).toString('base64url')

  return new Promise<{ code: string; codeVerifier: string; redirectUri: string }>((resolve, reject) => {
    let redirectUri = ''
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (url.pathname !== '/callback') return void res.writeHead(404).end()
      const code = url.searchParams.get('code')
      const ok = url.searchParams.get('state') === state && !!code
      const nonce = randomBytes(16).toString('base64')
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'content-security-policy': `default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'`,
      })
      // Wait until the page is flushed before closing the server, or the tab can end up blank.
      res.end(page(ok, deepLink, nonce), () =>
        ok ? finish(null, code!) : finish(new Error(url.searchParams.get('error') ?? 'invalid_state')),
      )
    })
    const timer = setTimeout(() => finish(new Error('timeout')), TIMEOUT_MS)
    let done = false
    const finish = (err: Error | null, code?: string) => {
      if (done) return
      done = true
      clearTimeout(timer)
      server.close()
      server.closeAllConnections()
      if (active?.server === server) active = null
      err ? reject(err) : resolve({ code: code!, codeVerifier: verifier, redirectUri })
    }
    active = { server, reject: (e) => finish(e) }

    server.listen(0, '127.0.0.1', () => {
      redirectUri = `http://127.0.0.1:${(server.address() as AddressInfo).port}/callback`
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
        prompt: 'select_account',
      })
      shell.openExternal(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
    })
  })
}
