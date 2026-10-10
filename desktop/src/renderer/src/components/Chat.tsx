import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { attachmentUrl, isImage, type Agent, type Attachment, type Message, type Timer } from '../agents'
import { useT } from '../i18n'
import { AgentIcon } from './AgentIcon'
import { FilePreview } from './Composer'
import { Markdown } from './Markdown'
import { TimerCard } from './TimerCard'

export type TimerControl = 'start' | 'stop' | 'reset'

type Props = {
  agent: Agent
  messages: Message[]
  timers: Timer[]
  typing: boolean
  onEditMessage: (id: string, text: string) => void
  onTimer: (id: string, control: TimerControl) => void
  onOpenAttachment: (attachment: Attachment) => void
}

export function Chat({ agent, messages, timers, typing, onEditMessage, onTimer, onOpenAttachment }: Props) {
  const t = useT()
  // Stable across renders, so finished messages don't re-render when the chat changes.
  const editRef = useRef(onEditMessage)
  editRef.current = onEditMessage
  const edit = useCallback((id: string, text: string) => editRef.current(id, text), [])

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
        {messages.map((message, i) => {
          // Events (a timer ran out) are only for the agent to read; the timer itself shows it.
          if (message.from === 'event') return null
          // A new speaker starts a new group, spaced from the one before.
          const previous = messages.findLast((m, j) => j < i && m.from !== 'event')
          const className = `msg msg-${message.from}${previous?.from !== message.from ? ' first' : ''}`
          if (message.from === 'user') {
            return (
              <div key={message.id} className={className}>
                <div className="msg-user-body">
                  {message.attachments && (
                    <div className="msg-attachments">
                      {message.attachments.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          className={`msg-attachment${isImage(a.type) ? ' image' : ''}`}
                          title={a.name}
                          aria-label={t('common.open', { name: a.name })}
                          onClick={() => onOpenAttachment(a)}
                        >
                          <FilePreview name={a.name} size={a.size} src={isImage(a.type) ? attachmentUrl(a.id) : null} />
                        </button>
                      ))}
                    </div>
                  )}
                  {message.text && <div className="msg-text">{message.text}</div>}
                </div>
              </div>
            )
          }
          // The timers an agent made show under the message it made them with.
          const created = (message.timers ?? [])
            .filter((a) => a.action === 'create')
            .map((a) => timers.find((t) => t.id === a.timer))
            .filter((t) => t !== undefined)
          return (
            <div key={message.id} className={className}>
              <div className="msg-agent-body">
                {message.text && (
                  <div className="msg-text">
                    <Markdown text={message.text} id={message.id} onEdit={edit} />
                  </div>
                )}
                {created.length > 0 && (
                  <div className="timers">
                    {created.map((timer) => (
                      <TimerCard
                        key={timer.id}
                        timer={timer}
                        onStart={() => onTimer(timer.id, 'start')}
                        onStop={() => onTimer(timer.id, 'stop')}
                        onReset={() => onTimer(timer.id, 'reset')}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {typing && (
          <div className={`msg msg-agent${messages.at(-1)?.from !== 'agent' ? ' first' : ''}`}>
            <div className="msg-typing" aria-label={t('chat.typing', { name: agent.name })}>
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
