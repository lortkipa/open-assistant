import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { ChevronRightIcon, GaugeIcon, HelpIcon, InfoIcon, LogOutIcon, MessageIcon, SettingsIcon } from './icons'

// Placeholder until usage is tracked.
const WEEKLY_USAGE = 44

// Pops up above the profile button. Only "Log out" does anything yet.
export function AccountMenu({ onClose, onSignedOut }: { onClose: () => void; onSignedOut: () => void }) {
  const [supportOpen, setSupportOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // The profile button toggles the menu itself, so clicks on it don't count as outside.
    const onPointerDown = (e: globalThis.PointerEvent) => {
      const target = e.target as Element
      if (!ref.current?.contains(target) && !target.closest('.sidebar-profile')) onClose()
    }
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const logout = async () => {
    setBusy(true)
    await api.request('POST', '/auth/logout')
    onSignedOut()
  }

  return (
    <div className="menu account-menu" role="menu" ref={ref}>
      <div className="menu-usage">
        <div className="menu-usage-row">
          <GaugeIcon size={18} />
          <span>Weekly usage</span>
          <span className="menu-usage-value">{WEEKLY_USAGE}%</span>
        </div>
        <div className="menu-usage-bar" role="progressbar" aria-valuenow={WEEKLY_USAGE} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${WEEKLY_USAGE}%` }} />
        </div>
      </div>

      <div className="menu-sep" />

      {/* Support opens a separate menu to the right, on hover or click. */}
      <div className="menu-group" onMouseEnter={() => setSupportOpen(true)} onMouseLeave={() => setSupportOpen(false)}>
        <button
          className={`menu-item${supportOpen ? ' open' : ''}`}
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={supportOpen}
          onClick={() => setSupportOpen(true)}
        >
          <HelpIcon size={18} />
          <span>Support</span>
          <ChevronRightIcon size={16} />
        </button>
        {supportOpen && (
          <div className="menu-flyout">
            <div className="menu" role="menu">
              <button className="menu-item" role="menuitem">
                <MessageIcon size={18} />
                <span>Send feedback</span>
              </button>
              <button className="menu-item" role="menuitem">
                <InfoIcon size={18} />
                <span>About</span>
              </button>
            </div>
          </div>
        )}
      </div>
      <button className="menu-item" role="menuitem">
        <SettingsIcon size={18} />
        <span>Settings</span>
      </button>

      <div className="menu-sep" />

      <button className="menu-item" role="menuitem" onClick={logout} disabled={busy}>
        <LogOutIcon size={18} />
        <span>Log out</span>
      </button>
    </div>
  )
}
