import { useState, type FormEvent } from 'react'
import { api, errorMessage, type User } from '../api'
import { Logo } from '../components/Logo'
import { Button } from '../components/Button'

type Props = {
  suggested?: string | null
  onDone: (user: User) => void
  onSignedOut: () => void
}

export function Name({ suggested, onDone, onSignedOut }: Props) {
  const [name, setName] = useState(suggested ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Please enter a name.')
    setBusy(true)
    setError('')
    const { status, data } = await api.request('PATCH', '/me', { name })
    setBusy(false)
    if (status === 200) onDone(data.user)
    else if (status === 401) onSignedOut()
    else setError(errorMessage(data))
  }

  const logout = async () => {
    setBusy(true)
    await api.request('POST', '/auth/logout')
    onSignedOut()
  }

  return (
    <main className="screen">
      <div className="panel">
        <Logo />
        <h1>What should we call you?</h1>

        <form onSubmit={submit} className="stack" noValidate>
          <input
            className="field"
            placeholder="Your name"
            autoFocus
            autoComplete="name"
            maxLength={50}
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            onFocus={(e) => e.target.select()}
            aria-invalid={!!error}
          />
          <Button type="submit" loading={busy}>
            Continue
          </Button>
        </form>

        <p className="error" role="alert">
          {error}
        </p>
        <p className="hint">
          <button className="text-link" onClick={logout} disabled={busy}>
            Use a different account
          </button>
        </p>
      </div>
    </main>
  )
}
