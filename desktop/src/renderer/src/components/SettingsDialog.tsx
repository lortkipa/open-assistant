import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react'
import { api, errorMessage, type User } from '../api'
import { rich, useT, type Key } from '../i18n'
import { Avatar } from './Avatar'
import { Button } from './Button'
import { ConfirmDialog } from './ConfirmDialog'
import { CheckIcon, CloseIcon, CopyIcon, LogOutIcon, PencilIcon, SlidersIcon, UserIcon } from './icons'

const MAX_NAME = 50
// Photos are cropped to a square and shrunk to this before uploading.
const PHOTO_SIZE = 512

type Tab = 'account' | 'general'
const TABS: { id: Tab; name: Key; icon: ReactNode }[] = [
  { id: 'account', name: 'settings.account', icon: <UserIcon size={18} /> },
  { id: 'general', name: 'settings.general', icon: <SlidersIcon size={18} /> },
]

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

// Opens over the app from the account menu. Tabs on the left: Account, and General for preferences.
export function SettingsDialog({ user, onUserChange, onSignedOut, onClose }: Props) {
  const t = useT()
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
            {t('settings.title')}
          </h2>
          {TABS.map((item) => (
            <button
              key={item.id}
              className="settings-tab"
              role="tab"
              aria-selected={item.id === tab}
              onClick={() => setTab(item.id)}
            >
              {item.icon}
              <span>{t(item.name)}</span>
            </button>
          ))}
        </nav>

        <div className="settings-content" role="tabpanel">
          <button className="icon-btn settings-close" aria-label={t('settings.close')} title={t('settings.close')} onClick={onClose}>
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
          {tab === 'general' && <GeneralTab user={user} onUserChange={onUserChange} />}
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
  const t = useT()
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
            aria-label={t('settings.changePhoto')}
            title={t('settings.changePhoto')}
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
                aria-label={t('settings.name')}
                autoFocus
                maxLength={MAX_NAME}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={onNameKeyDown}
                onBlur={saveName}
              />
            ) : (
              <button className="settings-name" title={t('settings.changeName')} onClick={editName} disabled={!!savingName}>
                <span>{savingName ?? name}</span>
                <PencilIcon size={14} />
              </button>
            )}
            <div className="settings-email">
              <span>{user.email}</span>
              <button
                className="settings-copy"
                aria-label={t(copied ? 'common.copied' : 'settings.copyEmail')}
                title={t(copied ? 'common.copied' : 'settings.copyEmail')}
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
            {t('settings.logOut')}
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
            <h3>{t('settings.deleteAccount')}</h3>
            <p>{t('settings.deleteAccountText')}</p>
          </div>
          <Button variant="danger" loading={busy === 'delete'} disabled={!!busy} onClick={() => onConfirming(true)}>
            {t('settings.deleteAccount')}
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
          title={t('settings.deleteAccountTitle')}
          confirmLabel={t('settings.deleteAccount')}
          onClose={() => onConfirming(false)}
          onConfirm={deleteAccount}
        >
          {rich(t('settings.deleteAccountBody'), { email: <strong>{user.email}</strong> })}
        </ConfirmDialog>
      )}
    </>
  )
}

type Preferences = Pick<User, 'theme' | 'accent' | 'language' | 'spellcheck'>

// Whether the app is dark right now (the theme setting, or the system's when it's System).
function useDark() {
  const query = '(prefers-color-scheme: dark)'
  const [dark, setDark] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const media = matchMedia(query)
    const onChange = () => setDark(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return dark
}

// One choice out of a few, as a row of buttons.
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function SettingRow({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="settings-row">
      <div className="settings-row-text">
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      {children}
    </div>
  )
}

// Preferences apply as soon as they're picked and save to the account in the background.
function GeneralTab({ user, onUserChange }: { user: User; onUserChange: (user: User) => void }) {
  const t = useT()
  const dark = useDark()
  const [error, setError] = useState('')
  // Only the latest change's answer counts: an older one arriving late would undo a newer pick.
  const latest = useRef(0)

  const change = async (changes: Partial<Preferences>) => {
    const before = user
    const request = ++latest.current
    setError('')
    onUserChange({ ...user, ...changes })
    const { status, data } = await api.request('PATCH', '/me', changes)
    if (request !== latest.current) return
    if (status === 200) onUserChange(data.user)
    else {
      onUserChange(before)
      setError(errorMessage(data))
    }
  }

  return (
    <>
      <section className="settings-section settings-rows">
        <SettingRow title={t('settings.theme')} text={t('settings.themeText')}>
          <Segmented
            label={t('settings.theme')}
            value={user.theme}
            onChange={(theme) => change({ theme })}
            options={[
              { value: 'system', label: t('settings.themeSystem') },
              { value: 'light', label: t('settings.themeLight') },
              { value: 'dark', label: t('settings.themeDark') },
            ]}
          />
        </SettingRow>

        <SettingRow title={t('settings.accent')} text={t('settings.accentText')}>
          <Segmented
            label={t('settings.accent')}
            value={user.accent}
            onChange={(accent) => change({ accent })}
            options={[
              {
                value: 'bot',
                label: (
                  <>
                    <span className="swatch swatch-bot" />
                    {t('settings.accentBot')}
                  </>
                ),
              },
              {
                value: 'neutral',
                label: (
                  <>
                    <span className="swatch swatch-neutral" />
                    {t(dark ? 'settings.accentWhite' : 'settings.accentBlack')}
                  </>
                ),
              },
            ]}
          />
        </SettingRow>

        <SettingRow title={t('settings.language')} text={t('settings.languageText')}>
          <Segmented
            label={t('settings.language')}
            value={user.language}
            onChange={(language) => change({ language })}
            // Each language in its own words, so it's findable whichever one is on.
            options={[
              { value: 'en', label: 'English' },
              { value: 'ka', label: 'ქართული' },
            ]}
          />
        </SettingRow>

        <SettingRow title={t('settings.spellcheck')} text={t('settings.spellcheckText')}>
          <button
            type="button"
            className="switch"
            role="switch"
            aria-checked={user.spellcheck}
            aria-label={t('settings.spellcheck')}
            onClick={() => change({ spellcheck: !user.spellcheck })}
          >
            <span />
          </button>
        </SettingRow>
      </section>
      {error && (
        <p className="settings-error" role="alert">
          {error}
        </p>
      )}
    </>
  )
}
