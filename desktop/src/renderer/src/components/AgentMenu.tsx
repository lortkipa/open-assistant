import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Agent } from '../agents'
import { useT } from '../i18n'
import { PencilIcon, PinIcon, ReadIcon, TrashIcon, UnreadIcon } from './icons'

type Props = {
  agent: Agent
  // Where the right-click happened, in viewport pixels.
  x: number
  y: number
  onClose: () => void
  onTogglePin: () => void
  onToggleUnread: () => void
  onEdit: () => void
  onDelete: () => void
}

// Right-click menu for an agent in the sidebar. Opens at the pointer, nudged to stay on screen.
export function AgentMenu({ agent, x, y, onClose, onTogglePin, onToggleUnread, onEdit, onDelete }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const t = useT()
  const [pos, setPos] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const { width, height } = ref.current!.getBoundingClientRect()
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - height - 8)),
    })
  }, [x, y])

  useEffect(() => {
    const onPointerDown = (e: globalThis.PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('blur', onClose)
    window.addEventListener('resize', onClose)
    // Capture, so scrolling the agent list closes it too.
    window.addEventListener('scroll', onClose, true)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('blur', onClose)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  // Each item acts, then closes the menu.
  const act = (fn: () => void) => () => {
    fn()
    onClose()
  }

  return (
    <div
      className="menu agent-menu"
      role="menu"
      ref={ref}
      style={pos}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button className="menu-item" role="menuitem" onClick={act(onTogglePin)}>
        <PinIcon size={18} />
        <span>{t(agent.pinned ? 'agentMenu.unpin' : 'agentMenu.pin')}</span>
      </button>
      <button className="menu-item" role="menuitem" onClick={act(onToggleUnread)}>
        {agent.unread ? <ReadIcon size={18} /> : <UnreadIcon size={18} />}
        <span>{t(agent.unread ? 'agentMenu.markRead' : 'agentMenu.markUnread')}</span>
      </button>
      <button className="menu-item" role="menuitem" onClick={act(onEdit)}>
        <PencilIcon size={18} />
        <span>{t('agentMenu.edit')}</span>
      </button>
      <div className="menu-sep" />
      <button className="menu-item danger" role="menuitem" onClick={act(onDelete)}>
        <TrashIcon size={18} />
        <span>{t('common.delete')}</span>
      </button>
    </div>
  )
}
