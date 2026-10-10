import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { User } from '../api'
import type { Agent } from '../agents'
import { AccountMenu } from './AccountMenu'
import { AgentIcon } from './AgentIcon'
import { Avatar } from './Avatar'
import { PlusIcon, SearchIcon } from './icons'

const RAIL = 64
const MIN = 220
const MAX = 420
const DEFAULT = 264
// Dragged narrower than this, the sidebar collapses to the rail.
const COLLAPSE_AT = 160
// Keep this much room for the main pane.
const MAIN_MIN = 360
const STORAGE_KEY = 'oa.sidebar'

type Layout = { width: number; collapsed: boolean }

function loadLayout(): Layout {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (typeof saved?.width === 'number' && typeof saved?.collapsed === 'boolean') return saved
  } catch {}
  return { width: DEFAULT, collapsed: false }
}

const clampWidth = (width: number) => Math.round(Math.max(MIN, Math.min(width, MAX, window.innerWidth - MAIN_MIN)))

type Props = {
  user: User
  onSignedOut: () => void
  agents: Agent[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function Sidebar({ user, onSignedOut, agents, selectedId, onSelect }: Props) {
  const [layout, setLayout] = useState(loadLayout)
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const [dragging, setDragging] = useState(false)
  // Briefly animate the jump to and from the rail, even mid-drag.
  const [snapping, setSnapping] = useState(false)
  const drag = useRef<{ x: number; start: number } | null>(null)
  const { width, collapsed } = layout

  // Size the sidebar to `next` px: below the threshold it becomes the rail.
  const resizeTo = (next: number) => {
    const toRail = next < COLLAPSE_AT
    if (toRail !== collapsed) setSnapping(true)
    setLayout(toRail ? { width, collapsed: true } : { width: clampWidth(next), collapsed: false })
  }

  useEffect(() => {
    if (!snapping) return
    const t = setTimeout(() => setSnapping(false), 180)
    return () => clearTimeout(t)
  }, [snapping])

  useEffect(() => {
    if (dragging) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
    } catch {}
  }, [layout, dragging])

  useEffect(() => {
    document.body.classList.toggle('resizing', dragging)
  }, [dragging])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, start: collapsed ? RAIL : width }
    setDragging(true)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) resizeTo(drag.current.start + e.clientX - drag.current.x)
  }

  const endDrag = () => {
    drag.current = null
    setDragging(false)
  }

  const toggle = () => {
    setSnapping(true)
    setLayout({ width, collapsed: !collapsed })
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowLeft' ? -16 : e.key === 'ArrowRight' ? 16 : 0
    if (e.key === 'Enter') toggle()
    else if (step) resizeTo((collapsed ? RAIL : width) + step)
    else return
    e.preventDefault()
  }

  const name = user.name ?? user.email

  return (
    <aside
      className={`sidebar${collapsed ? ' collapsed' : ''}${dragging && !snapping ? ' dragging' : ''}`}
      style={{ width: collapsed ? RAIL : width }}
    >
      <div className="sidebar-top">
        <button className="icon-btn" aria-label="Search" title="Search">
          <SearchIcon />
        </button>
        <button className="icon-btn" aria-label="New" title="New" onClick={() => onSelect(null)}>
          <PlusIcon />
        </button>
      </div>

      <nav className="sidebar-body agent-list" aria-label="Agents">
        {agents.map((agent) => (
          <button
            key={agent.id}
            className="agent-item"
            aria-current={agent.id === selectedId ? 'page' : undefined}
            title={collapsed ? agent.name : undefined}
            onClick={() => onSelect(agent.id)}
          >
            <AgentIcon shape={agent.shape} size={28} />
            {!collapsed && <span className="agent-name">{agent.name}</span>}
          </button>
        ))}
      </nav>

      {menuOpen && <AccountMenu onClose={closeMenu} onSignedOut={onSignedOut} />}
      <button
        className={`sidebar-profile${menuOpen ? ' active' : ''}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title={collapsed ? `${name}\n${user.email}` : undefined}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <Avatar url={user.avatarUrl} size={36} />
        {!collapsed && (
          <div className="sidebar-who">
            <div className="sidebar-name">{name}</div>
            <div className="sidebar-email">{user.email}</div>
          </div>
        )}
      </button>

      <div
        className="sidebar-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuemin={RAIL}
        aria-valuemax={MAX}
        aria-valuenow={collapsed ? RAIL : width}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={toggle}
        onKeyDown={onKeyDown}
      />
    </aside>
  )
}
