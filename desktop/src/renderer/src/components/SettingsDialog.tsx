import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react'
import { api, errorMessage, type User } from '../api'
import { Avatar } from './Avatar'
import { Button } from './Button'
import { ConfirmDialog } from './ConfirmDialog'
import { CheckIcon, CloseIcon, CopyIcon, LogOutIcon, PencilIcon, UserIcon } from './icons'

const MAX_NAME = 50
// Photos are cropped to a square and shrunk to this before uploading.
const PHOTO_SIZE = 512

type Tab = 'account'
const TABS: { id: Tab; name: string; icon: ReactNode }[] = [{ id: 'account', name: 'Account', icon: <UserIcon size={18} /> }]

// The middle square of the image, at most PHOTO_SIZE across, as WebP.
async function squarePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const size = Math.min(side, PHOTO_SIZE)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encoding failed'))), 'image/webp', 0.9),
  )
}

type Props = {
  user: User
  onUserChange: (user: User) => void
  onSignedOut: () => void
  onClose: () => void
}

// Opens over the app from the account menu. Tabs on the left; only Account for now.
export function SettingsDialog({ user, onUserChange, onSignedOut, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('account')
  const [confirming, setConfirming] = useState(false)

  // Escape closes the dialog, unless the delete question is open (it closes itself first).
  // The name field keeps its own Escape from getting here.
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !confirming) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirming, onClose])

  return (
    <div className="dialog-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <nav className="settings-tabs" role="tablist" aria-orientation="vertical">
          <h2 id="settings-title" className="settings-title">
            Settings
          </h2>
          {TABS.map((t) => (
            <button
              key={t.id}
              className="settings-tab"
              role="tab"
              aria-selected={t.id === tab}
              onClick={() => setTab(t.id)}
            >
              {t.icon}
              <span>{t.name}</span>
            </button>
          ))}
        </nav>

        <div className="settings-content" role="tabpanel">
          <button className="icon-btn settings-close" aria-label="Close" title="Close" onClick={onClose}>
            <CloseIcon size={18} />
          </button>
          {tab === 'account' && (
            <AccountTab
              user={user}
              onUserChange={onUserChange}
              onSignedOut={onSignedOut}
              confirming={confirming}
              onConfirming={setConfirming}
            />
          )}
        </div>
      </div>
    </div>
  )
}

type AccountProps = {
  user: User
  onUserChange: (user: User) => void
  onSignedOut: () => void
  confirming: boolean
  onConfirming: (confirming: boolean) => void
}

function AccountTab({ user, onUserChange, onSignedOut, confirming, onConfirming }: AccountProps) {
  const name = user.name ?? user.email
  const [error, setError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [busy, setBusy] = useState<'logout' | 'delete' | null>(null)

  // Name: click to edit in place. Enter or clicking away saves; Escape puts it back.
  const [draft, setDraft] = useState<string | null>(null)
  // Shown while the new name saves.
  const [savingName, setSavingName] = useState<string | null>(null)
  const cancelled = useRef(false)

  const editName = () => {
    cancelled.current = false
    setDraft(name)
  }

  const saveName = async () => {
    const next = draft?.trim() ?? ''
    setDraft(null)
    if (cancelled.current || !next || next === user.name) return
    setError('')
    setSavingName(next)
    const { status, data } = await api.request('PATCH', '/me', { name: next })
    setSavingName(null)
    if (status === 200) onUserChange(data.user)
    else setError(errorMessage(data))
  }

  const onNameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
    else if (e.key === 'Escape') {
      e.stopPropagation()
      cancelled.current = true
      e.currentTarget.blur()
    }
  }

  // Photo: click the avatar to pick an image. It shows right away and uploads in the background.
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const pickPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    let photo: Blob
    try {
      photo = await squarePhoto(file)
    } catch {
      return setError(errorMessage({ error: 'invalid_image' }))
    }
    const url = URL.createObjectURL(photo)
    setPreview(url)
    const { status, data } = await api.uploadAvatar(photo.type, await photo.arrayBuffer())
    if (status === 200) onUserChange(data.user)
    else setError(errorMessage(data))
    setPreview(null)
    URL.revokeObjectURL(url)
  }

  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  const copyEmail = async () => {
    await navigator.clipboard.writeText(user.email)
    setCopied(true)
  }

  const logout = async () => {
    setBusy('logout')
    await api.request('POST', '/auth/logout')
    onSignedOut()
  }

  const deleteAccount = async () => {
    onConfirming(false)
    setBusy('delete')
    setDeleteError('')
    const { status, data } = await api.request('DELETE', '/me')
    if (status === 200) return onSignedOut()
    setBusy(null)
    setDeleteError(errorMessage(data))
  }

  return (
    <>
      <section className="settings-section">
        <div className="settings-profile">
          <button
            type="button"
            className={`avatar-edit settings-avatar${preview ? ' busy' : ''}`}
            aria-label="Change photo"
            title="Change photo"
            disabled={!!preview}
            onClick={() => fileRef.current?.click()}
          >
            <Avatar url={preview ?? user.avatarUrl} size={64} />
            <span className="avatar-edit-overlay">{preview ? <span className="spinner" /> : <PencilIcon size={20} />}</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={pickPhoto}
          />

          <div className="settings-who">
            {draft !== null ? (
              <input
                className="settings-name settings-name-input"
                aria-label="Name"
                autoFocus
                maxLength={MAX_NAME}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={onNameKeyDown}
                onBlur={saveName}
              />
            ) : (
              <button className="settings-name" title="Change name" onClick={editName} disabled={!!savingName}>
                <span>{savingName ?? name}</span>
                <PencilIcon size={14} />
              </button>
            )}
            <div className="settings-email">
              <span>{user.email}</span>
              <button
                className="settings-copy"
                aria-label={copied ? 'Copied' : 'Copy email'}
                title={copied ? 'Copied' : 'Copy email'}
                onClick={copyEmail}
              >
                {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
              </button>
            </div>
          </div>

          <Button
            variant="secondary"
            className="settings-logout"
            icon={<LogOutIcon size={16} />}
            loading={busy === 'logout'}
            disabled={!!busy}
            onClick={logout}
          >
            Log out
          </Button>
        </div>
        {error && (
          <p className="settings-error" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="settings-section settings-danger">
        <div className="settings-danger-row">
          <div>
            <h3>Delete account</h3>
            <p>Permanently delete your account along with all agents, chats and files.</p>
          </div>
          <Button variant="danger" loading={busy === 'delete'} disabled={!!busy} onClick={() => onConfirming(true)}>
            Delete account
          </Button>
        </div>
        {deleteError && (
          <p className="settings-error" role="alert">
            {deleteError}
          </p>
        )}
      </section>

      {confirming && (
        <ConfirmDialog
          title="Delete account?"
          confirmLabel="Delete account"
          onClose={() => onConfirming(false)}
          onConfirm={deleteAccount}
        >
          <strong>{user.email}</strong> and all of its agents, chats and files will be deleted. This can’t be undone.
        </ConfirmDialog>
      )}
    </>
  )
}
