import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { Agent, Message } from '../agents'
import { AgentIcon } from './AgentIcon'
import { Markdown } from './Markdown'

type Props = {
  agent: Agent
  messages: Message[]
  typing: boolean
  onEditMessage: (index: number, text: string) => void
}

export function Chat({ agent, messages, typing, onEditMessage }: Props) {
  // Stable across renders, so finished messages don't re-render when the chat changes.
  const editRef = useRef(onEditMessage)
  editRef.current = onEditMessage
  const edit = useCallback((index: number, text: string) => editRef.current(index, text), [])

  const endRef = useRef<HTMLDivElement>(null)
  const opened = useRef(false)

  // Open on the latest message, and follow new ones as they arrive.
  useLayoutEffect(() => {
    endRef.current!.scrollIntoView({ block: 'end', behavior: opened.current ? 'smooth' : 'instant' })
    opened.current = true
  }, [messages.length, typing])

  // The rest of the app is unselectable, and clicking there wouldn't clear a selection by itself.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest('.main-body')) getSelection()?.removeAllRanges()
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [])

  return (
    <div className="chat">
      <header className="chat-header">
        <AgentIcon shape={agent.shape} size={28} />
        <div className="chat-name">{agent.name}</div>
      </header>

      <div className="chat-messages">
        {messages.map((message, i) => (
          // A new speaker starts a new group, spaced from the one before.
          <div key={i} className={`msg msg-${message.from}${messages[i - 1]?.from !== message.from ? ' first' : ''}`}>
            <div className="msg-text">
              {message.from === 'agent' ? <Markdown text={message.text} index={i} onEdit={edit} /> : message.text}
            </div>
          </div>
        ))}
        {typing && (
          <div className={`msg msg-agent${messages.at(-1)?.from !== 'agent' ? ' first' : ''}`}>
            <div className="msg-typing" aria-label={`${agent.name} is typing`}>
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}
