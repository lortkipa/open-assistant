import { useState } from 'react'
import { api, errorMessage, type User } from '../api'
import { Avatar } from '../components/Avatar'
import { Button } from '../components/Button'

export function Home({ user, onSignedOut }: { user: User; onSignedOut: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState<'logout' | 'delete' | null>(null)
  const [error, setError] = useState('')

  const logout = async () => {
    setBusy('logout')
    await api.request('POST', '/auth/logout')
    onSignedOut()
  }

  const remove = async () => {
    setBusy('delete')
    setError('')
    const { status, data } = await api.request('DELETE', '/me')
    if (status === 200 || status === 401) return onSignedOut()
    setBusy(null)
    setError(errorMessage(data))
  }

  return (
    <main className="screen">
      <div className="panel">
        <Avatar url={user.avatarUrl} size={96} />
        <h1>{user.name}</h1>
        <p className="muted">{user.email}</p>

        {confirming ? (
          <div className="confirm">
            <p>Delete your account? This permanently removes your data and can’t be undone.</p>
            <div className="row">
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={!!busy}>
                Cancel
              </Button>
              <Button variant="danger" onClick={remove} loading={busy === 'delete'}>
                Delete account
              </Button>
            </div>
          </div>
        ) : (
          <div className="row">
            <Button variant="secondary" onClick={logout} loading={busy === 'logout'}>
              Log out
            </Button>
            <Button variant="danger" onClick={() => setConfirming(true)} disabled={!!busy}>
              Delete account
            </Button>
          </div>
        )}

        <p className="error" role="alert">
          {error}
        </p>
      </div>
    </main>
  )
}
