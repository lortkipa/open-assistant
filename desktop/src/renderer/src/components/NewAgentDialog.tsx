import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AgentIcon, SHAPES, type Shape } from './AgentIcon'
import { Button } from './Button'
import { PencilIcon } from './icons'

const MAX_NAME = 40

type Props = {
  // Given, the dialog edits this agent instead of creating one.
  agent?: { name: string; shape: Shape }
  onCreate: (agent: { name: string; shape: Shape }) => void
  onClose: () => void
}

// A big character up top (click it to pick another) and a name. A new agent opens with a random character.
export function NewAgentDialog({ agent, onCreate, onClose }: Props) {
  const [shape, setShape] = useState<Shape>(() => agent?.shape ?? SHAPES[Math.floor(Math.random() * SHAPES.length)])
  const [name, setName] = useState(agent?.name ?? '')
  const [picking, setPicking] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLButtonElement>(null)
  const trimmed = name.trim()

  // Escape closes the picker first, then the dialog.
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (picking) setPicking(false)
      else onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [picking, onClose])

  // A click anywhere but the picker closes it; the avatar toggles it itself.
  useEffect(() => {
    if (!picking) return
    const onPointerDown = (e: globalThis.PointerEvent) => {
      const target = e.target as Node
      if (!pickerRef.current?.contains(target) && !avatarRef.current?.contains(target)) setPicking(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [picking])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (trimmed) onCreate({ name: trimmed, shape })
  }

  return (
    <div className="dialog-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="new-agent-title" onSubmit={submit}>
        <h2 id="new-agent-title" className="dialog-title">
          {agent ? 'Edit agent' : 'New agent'}
        </h2>

        <div className="avatar-area">
          <button
            ref={avatarRef}
            type="button"
            className={`avatar-edit${picking ? ' open' : ''}`}
            aria-label="Change icon"
            aria-expanded={picking}
            onClick={() => setPicking(!picking)}
          >
            {/* Keyed so it pops again on every new pick. */}
            <AgentIcon key={shape} shape={shape} size={104} />
            <span className="avatar-edit-overlay">
              <PencilIcon size={22} />
            </span>
          </button>

          {picking && (
            <div className="icon-picker" ref={pickerRef} role="group" aria-label="Icon">
              {SHAPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="icon-choice"
                  aria-pressed={s === shape}
                  aria-label={s}
                  title={s}
                  onClick={() => {
                    setShape(s)
                    setPicking(false)
                  }}
                >
                  <AgentIcon shape={s} size={44} />
                </button>
              ))}
            </div>
          )}
        </div>

        <input
          className="name-field"
          placeholder="Name your agent"
          aria-label="Name"
          autoFocus
          maxLength={MAX_NAME}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!trimmed}>
            {agent ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </div>
  )
}
