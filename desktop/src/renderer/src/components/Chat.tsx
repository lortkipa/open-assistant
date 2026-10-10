import { useEffect, useLayoutEffect, useRef } from 'react'
import type { Agent, Message } from '../agents'
import { AgentIcon } from './AgentIcon'

type Props = { agent: Agent; messages: Message[]; typing: boolean }

export function Chat({ agent, messages, typing }: Props) {
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
            <div className="msg-text">{message.text}</div>
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
