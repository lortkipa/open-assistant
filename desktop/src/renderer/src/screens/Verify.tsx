import { useEffect, useState } from 'react'
import { api, errorMessage, type User } from '../api'
import { CodeInput } from '../components/CodeInput'
import { Logo } from '../components/Logo'

type Props = {
  email: string
  onBack: () => void
  onSignedIn: (user: User) => void
}

export function Verify({ email, onBack, onSignedIn }: Props) {
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [cooldown, setCooldown] = useState(30)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const verify = async (code: string) => {
    setBusy(true)
    setError('')
    setNotice('')
    const { status, data } = await api.request('POST', '/auth/email/verify', { email, code })
    if (status === 200) return onSignedIn(data.user)
    setBusy(false)
    setError(errorMessage(data))
    setResetKey((k) => k + 1)
  }

  const resend = async () => {
    setError('')
    setNotice('')
    const { status, data } = await api.request('POST', '/auth/email/start', { email })
    if (status === 200) {
      setNotice('We sent you a new code.')
      setCooldown(data.resendAfter ?? 30)
      setResetKey((k) => k + 1)
    } else {
      if (data.retryAfter) setCooldown(data.retryAfter)
      setError(errorMessage(data))
    }
  }

  return (
    <main className="screen">
      <div className="panel">
        <Logo />
        <h1>Check your email</h1>
        <p className="muted">
          Enter the 6-digit code we sent to
          <br />
          <strong>{email}</strong>
        </p>

        <CodeInput onComplete={verify} disabled={busy} error={!!error} resetKey={resetKey} />

        <p className={error ? 'error' : 'notice'} role="alert">
          {error || notice || (busy ? 'Verifying…' : '')}
        </p>

        <div className="links">
          <button className="text-link" onClick={resend} disabled={cooldown > 0 || busy}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>
          <span className="dot">·</span>
          <button className="text-link" onClick={onBack} disabled={busy}>
            Use a different email
          </button>
        </div>
      </div>
    </main>
  )
}
