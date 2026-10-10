import { useState, type FormEvent } from 'react'
import { api, errorMessage, type User } from '../api'
import { Button, GoogleIcon } from '../components/Button'
import { Logo } from '../components/Logo'

type Props = {
  initialEmail?: string
  onCodeSent: (email: string) => void
  onSignedIn: (user: User, suggestedName?: string | null) => void
}

export function Login({ initialEmail = '', onCodeSent, onSignedIn }: Props) {
  const [email, setEmail] = useState(initialEmail)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<'email' | 'google' | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const value = email.trim()
    if (!/^\S+@\S+\.\S+$/.test(value)) return setError(errorMessage({ error: 'invalid_email' }))
    setBusy('email')
    setError('')
    const { status, data } = await api.request('POST', '/auth/email/start', { email: value })
    setBusy(null)
    // A code that was sent moments ago is still valid, so go enter it.
    if (status === 200 || data.error === 'cooldown') onCodeSent(value.toLowerCase())
    else setError(errorMessage(data))
  }

  const google = async () => {
    setBusy('google')
    setError('')
    const { status, data } = await api.googleSignIn()
    setBusy(null)
    if (status === 200) onSignedIn(data.user, data.suggestedName)
    else if (data.error !== 'cancelled') setError(errorMessage(data))
  }

  return (
    <main className="screen">
      <div className="panel">
        <Logo />
        <h1>Sign in to Open Assistant</h1>

        <form onSubmit={submit} className="stack" noValidate>
          <input
            className="field"
            type="email"
            placeholder="Email address"
            autoFocus
            autoComplete="email"
            value={email}
            disabled={!!busy}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!error}
          />
          <Button type="submit" loading={busy === 'email'} disabled={busy === 'google'}>
            Continue with email
          </Button>
        </form>

        <div className="divider">
          <span>or</span>
        </div>

        {busy === 'google' ? (
          <div className="stack">
            <Button variant="secondary" loading>
              Waiting for Google…
            </Button>
            <p className="hint">
              Finish signing in in your browser.{' '}
              <button className="text-link" onClick={() => api.googleCancel()}>
                Cancel
              </button>
            </p>
          </div>
        ) : (
          <Button variant="secondary" icon={<GoogleIcon />} onClick={google} disabled={!!busy}>
            Continue with Google
          </Button>
        )}

        <p className="error" role="alert">
          {error}
        </p>
      </div>
    </main>
  )
}
