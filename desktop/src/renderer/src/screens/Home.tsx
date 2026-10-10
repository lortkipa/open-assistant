import { useEffect, useRef, useState, type DragEvent } from 'react'
import type { User } from '../api'
import { Sidebar } from '../components/Sidebar'
import { Composer } from '../components/Composer'
import { Chat } from '../components/Chat'
import { NewAgentDialog } from '../components/NewAgentDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { fakeReply, type Agent, type Message } from '../agents'
import { UploadIcon } from '../components/icons'

// 20 keeps every image under Claude's full-size limit (stricter past 20); 25 MB keeps requests sane.
const MAX_FILES = 20
const MAX_FILE_SIZE = 25 * 1024 * 1024

const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files')

export function Home({ user, onSignedOut }: { user: User; onSignedOut: () => void }) {
  const [files, setFiles] = useState<File[]>([])
  const [dropping, setDropping] = useState(false)
  // Agents live only in memory until there is a server side for them.
  const [agents, setAgents] = useState<Agent[]>([])
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const agent = agents.find((a) => a.id === selectedId)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const editing = agents.find((a) => a.id === editingId)
  const deleting = agents.find((a) => a.id === deletingId)
  // Read from the reply timer, which outlives the render that started it.
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId

  const update = (id: string, changes: Partial<Agent>) =>
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...changes } : a)))

  // Opening an agent reads it.
  const select = (id: string | null) => {
    setSelectedId(id)
    if (id) update(id, { unread: false })
  }

  const remove = (id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id))
    setSent(({ [id]: _, ...rest }) => rest)
    if (selectedId === id) setSelectedId(null)
  }
  // Messages sent this session, per agent.
  const [sent, setSent] = useState<Record<string, Message[]>>({})
  // Agents currently "typing" a fake reply.
  const [typing, setTyping] = useState<Set<string>>(new Set())

  const append = (id: string, message: Message) =>
    setSent((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), message] }))

  const send = (text: string, attached: File[]) => {
    if (!agent) return
    const id = agent.id
    const names = attached.map((file) => `📎 ${file.name}`).join('\n')
    append(id, { from: 'user', text: [text, names].filter(Boolean).join('\n\n'), time: now() })
    setTyping((prev) => new Set(prev).add(id))
    setTimeout(() => {
      append(id, { from: 'agent', text: fakeReply(text), time: now() })
      // A reply to an agent you've since left marks it unread.
      if (selectedRef.current !== id) update(id, { unread: true })
      setTyping((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 1200 + Math.random() * 800)
  }
  // An object, so the same message shown again restarts its timer.
  const [notice, setNotice] = useState<{ text: string } | null>(null)
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
        <NewAgentDialog
          onClose={() => setCreating(false)}
          onCreate={({ name, shape }) => {
            const id = crypto.randomUUID()
            setAgents((prev) => [...prev, { id, name, shape, messages: [] }])
            setSelectedId(id)
            setCreating(false)
          }}
        />
      )}
      <main className="main" onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
        <div className="main-body">
          {agent && (
            <Chat
              key={agent.id}
              agent={agent}
              messages={[...agent.messages, ...(sent[agent.id] ?? [])]}
              typing={typing.has(agent.id)}
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
            // Only the fake chats answer, with canned replies.
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

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
