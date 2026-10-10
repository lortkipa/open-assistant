import { useEffect, useRef, useState, type DragEvent } from 'react'
import { api, errorMessage, type User } from '../api'
import { Sidebar } from '../components/Sidebar'
import { Composer } from '../components/Composer'
import { Chat, type TimerControl } from '../components/Chat'
import { NewAgentDialog } from '../components/NewAgentDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { fromWire, type Agent, type Message, type WireTimer } from '../agents'
import { UploadIcon } from '../components/icons'

// 20 keeps every image under Claude's full-size limit (stricter past 20); 25 MB keeps requests sane.
const MAX_FILES = 20
const MAX_FILE_SIZE = 25 * 1024 * 1024

const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files')

type WireAgent = Omit<Agent, 'timers' | 'messages'> & { messages?: Message[]; timers?: WireTimer[] }
type AgentChanges = Partial<Pick<Agent, 'name' | 'shape' | 'pinned' | 'unread'>>

const fromWireAgent = ({ messages = [], timers = [], ...agent }: WireAgent): Agent => ({
  ...agent,
  messages,
  timers: timers.map(fromWire),
})

// Agents, chats and timers live on the server, which runs replies and timers even while the app is
// closed. This screen loads them, follows live updates, and sends the user's actions back.
export function Home({ user, onSignedOut }: { user: User; onSignedOut: () => void }) {
  const [files, setFiles] = useState<File[]>([])
  const [dropping, setDropping] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const agent = agents.find((a) => a.id === selectedId)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const editing = agents.find((a) => a.id === editingId)
  const deleting = agents.find((a) => a.id === deletingId)
  // Agents currently searching or typing a reply.
  const [typing, setTyping] = useState<Set<string>>(new Set())
  // An object, so the same message shown again restarts its timer.
  const [notice, setNotice] = useState<{ text: string } | null>(null)
  // Read from live updates, which are handled outside of any one render.
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId
  const agentsRef = useRef(agents)
  agentsRef.current = agents

  const fail = (data: unknown) => setNotice({ text: errorMessage(data) })

  const patch = (id: string, change: (agent: Agent) => Partial<Agent>) =>
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...change(a) } : a)))

  // Shows the change right away and saves it.
  const update = (id: string, changes: AgentChanges) => {
    patch(id, () => changes)
    api.request('PATCH', `/agents/${id}`, changes).then(({ status, data }) => status !== 200 && fail(data))
  }

  // Opening an agent reads it.
  const select = (id: string | null) => {
    setSelectedId(id)
    selectedRef.current = id
    if (id && agentsRef.current.find((a) => a.id === id)?.unread) update(id, { unread: false })
  }

  const upsert = ({ messages, timers, ...changes }: WireAgent) =>
    setAgents((prev) =>
      prev.some((a) => a.id === changes.id)
        ? prev.map((a) => (a.id === changes.id ? { ...a, ...changes } : a))
        : [...prev, fromWireAgent({ ...changes, messages, timers })],
    )

  // The same message can come back both as a response and as a live update.
  const addMessage = (id: string, message: Message, timers?: WireTimer[]) =>
    patch(id, (a) => ({
      messages: a.messages.some((m) => m.id === message.id) ? a.messages : [...a.messages, message],
      ...(timers && { timers: timers.map(fromWire) }),
    }))

  const removeLocal = (id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id))
    if (selectedRef.current === id) select(null)
  }

  const remove = (id: string) => {
    removeLocal(id)
    api.request('DELETE', `/agents/${id}`).then(({ status, data }) => status !== 200 && fail(data))
  }

  const create = async (changes: { name: string; shape: Agent['shape'] }) => {
    setCreating(false)
    const { status, data } = await api.request('POST', '/agents', changes)
    if (status !== 200) return fail(data)
    upsert(data.agent)
    select(data.agent.id)
  }

  const setTypingFor = (id: string, on: boolean) =>
    setTyping((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  // Ticking a task-list checkbox in an agent's message.
  const editMessage = (id: string, messageId: string, text: string) => {
    patch(id, (a) => ({ messages: a.messages.map((m) => (m.id === messageId ? { ...m, text } : m)) }))
    api
      .request('PATCH', `/agents/${id}/messages/${messageId}`, { text })
      .then(({ status, data }) => status !== 200 && fail(data))
  }

  // The server cancels a reply in flight, and the agent starts over with the whole chat.
  const send = async (text: string, attached: File[]) => {
    if (!agent) return
    const names = attached.map((file) => `📎 ${file.name}`).join('\n')
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const body = { text: [text, names].filter(Boolean).join('\n\n'), timeZone }
    const { status, data } = await api.request('POST', `/agents/${agent.id}/messages`, body)
    if (status !== 200) return fail(data)
    addMessage(agent.id, data.message)
  }

  // The user runs a timer from its card. The agent sees the new state next time it replies.
  const controlTimer = async (id: string, timerId: string, control: TimerControl) => {
    const { status, data } = await api.request('POST', `/agents/${id}/timers/${timerId}`, { action: control })
    if (status !== 200) return fail(data)
    patch(id, () => ({ timers: (data.timers as WireTimer[]).map(fromWire) }))
  }

  // Live updates from the server, for as long as this screen is open (signing out closes it).
  useEffect(
    () =>
      api.listen((event) => {
        switch (event.type) {
          // (Re)connected: anything could have happened meanwhile, so load it all again.
          case 'open':
            api.request('GET', '/agents').then(({ status, data }) => {
              if (status !== 200) return fail(data)
              const loaded = data.agents as (WireAgent & { typing: boolean })[]
              setAgents(loaded.map(fromWireAgent))
              setTyping(new Set(loaded.filter((a) => a.typing).map((a) => a.id)))
              if (selectedRef.current && !loaded.some((a) => a.id === selectedRef.current)) select(null)
            })
            break
          case 'agent':
            upsert(event.agent)
            break
          case 'agent_deleted':
            removeLocal(event.id)
            break
          case 'message':
            addMessage(event.agentId, event.message, event.timers)
            // The server marks every agent message unread; the open chat reads it at once.
            if (event.message.from !== 'agent') break
            if (selectedRef.current === event.agentId) update(event.agentId, { unread: false })
            else patch(event.agentId, () => ({ unread: true }))
            break
          case 'message_edited':
            patch(event.agentId, (a) => ({
              messages: a.messages.map((m) => (m.id === event.id ? { ...m, text: event.text } : m)),
            }))
            break
          case 'timers':
            patch(event.agentId, () => ({ timers: (event.timers as WireTimer[]).map(fromWire) }))
            break
          case 'typing':
            setTypingFor(event.agentId, event.on)
            break
          case 'timer_done': {
            const notification = new Notification(event.agentName, { body: `⏰ ${event.label}: time’s up` })
            notification.onclick = () => {
              select(event.agentId)
              api.focus()
            }
            break
          }
          case 'reply_error':
            fail({ error: event.error })
            break
        }
      }),
    [],
  )

  // dragenter/dragleave fire for every child crossed; count them to know when the drag really left.
  const dragDepth = useRef(0)

  // A file dropped anywhere outside the drop zone does nothing (instead of the browser opening it).
  useEffect(() => {
    const block = (e: globalThis.DragEvent) => e.preventDefault()
    window.addEventListener('dragover', block)
    window.addEventListener('drop', block)
    return () => {
      window.removeEventListener('dragover', block)
      window.removeEventListener('drop', block)
    }
  }, [])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 3000)
    return () => clearTimeout(t)
  }, [notice])

  const addFiles = (added: File[]) => {
    const fitting = added.filter((file) => file.size <= MAX_FILE_SIZE)
    const room = MAX_FILES - files.length
    const accepted = fitting.slice(0, Math.max(0, room))
    const notes: string[] = []
    if (fitting.length < added.length) notes.push('Files must be 25 MB or smaller.')
    if (accepted.length < fitting.length) notes.push(`You can attach up to ${MAX_FILES} files.`)
    setNotice(notes.length ? { text: notes.join(' ') } : null)
    if (accepted.length) setFiles([...files, ...accepted])
  }

  const onDragEnter = (e: DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragDepth.current++
    setDropping(true)
  }

  const onDragOver = (e: DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const onDragLeave = (e: DragEvent) => {
    if (!hasFiles(e)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDropping(false)
  }

  const onDrop = (e: DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragDepth.current = 0
    setDropping(false)
    if (e.dataTransfer.files.length) addFiles([...e.dataTransfer.files])
  }

  return (
    <div className="app">
      <Sidebar
        user={user}
        onSignedOut={onSignedOut}
        agents={agents}
        selectedId={selectedId}
        onSelect={select}
        onNew={() => setCreating(true)}
        onUpdate={update}
        onEdit={setEditingId}
        onDelete={setDeletingId}
      />
      {editing && (
        <NewAgentDialog
          agent={editing}
          onClose={() => setEditingId(null)}
          onCreate={(changes) => {
            update(editing.id, changes)
            setEditingId(null)
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete agent?"
          confirmLabel="Delete"
          onClose={() => setDeletingId(null)}
          onConfirm={() => {
            remove(deleting.id)
            setDeletingId(null)
          }}
        >
          <strong>{deleting.name}</strong> and its messages will be deleted. This can’t be undone.
        </ConfirmDialog>
      )}
      {creating && (
        <NewAgentDialog onClose={() => setCreating(false)} onCreate={create} />
      )}
      <main className="main" onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
        <div className="main-body">
          {agent && (
            <Chat
              key={agent.id}
              agent={agent}
              messages={agent.messages}
              timers={agent.timers}
              typing={typing.has(agent.id)}
              onEditMessage={(messageId, text) => editMessage(agent.id, messageId, text)}
              onTimer={(timerId, control) => controlTimer(agent.id, timerId, control)}
            />
          )}
        </div>
        <div className="main-composer">
          <Composer
            files={files}
            onAddFiles={addFiles}
            onRemoveFile={(index) => {
              setNotice(null)
              setFiles((prev) => prev.filter((_, i) => i !== index))
            }}
            notice={notice?.text}
            placeholder={agent && `Message ${agent.name}`}
            onSubmit={(text, attached) => {
              setNotice(null)
              setFiles([])
              send(text, attached)
            }}
          />
        </div>
        {dropping && (
          <div className="drop-overlay">
            <div className="drop-card">
              <UploadIcon size={28} />
              <span>Drop files to attach</span>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
