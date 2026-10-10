import { useEffect, useRef, useState, type DragEvent } from 'react'
import { api, errorMessage, type User } from '../api'
import { Sidebar } from '../components/Sidebar'
import { Composer, type Draft } from '../components/Composer'
import { flatten, ImageEditor, type Mark } from '../components/ImageEditor'
import { Chat, type TimerControl } from '../components/Chat'
import { NewAgentDialog } from '../components/NewAgentDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { SettingsDialog } from '../components/SettingsDialog'
import { fromWire, isImage, type Agent, type Attachment, type Message, type WireTimer } from '../agents'
import { UploadIcon } from '../components/icons'

// 20 keeps every image under Claude's full-size limit (stricter past 20); 25 MB keeps requests sane.
const MAX_FILES = 20
const MAX_FILE_SIZE = 25 * 1024 * 1024

const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files')

// An image open over the app, to look at and draw on.
type Overlay = { src: string; name: string; marks: Mark[]; onClose: (marks: Mark[]) => void }

let nextDraftKey = 0

// "shot.gif" marked up comes back as PNG: "shot.png".
const renamed = (name: string, type: string) => {
  const ext = type === 'image/jpeg' ? null : type.split('/')[1]
  if (!ext || name.toLowerCase().endsWith(`.${ext}`)) return name
  return `${name.replace(/\.[^.]*$/, '')}.${ext}`
}

type WireAgent = Omit<Agent, 'timers' | 'messages'> & { messages?: Message[]; timers?: WireTimer[] }
type AgentChanges = Partial<Pick<Agent, 'name' | 'shape' | 'pinned' | 'unread'>>

const fromWireAgent = ({ messages = [], timers = [], ...agent }: WireAgent): Agent => ({
  ...agent,
  messages,
  timers: timers.map(fromWire),
})

// Agents, chats and timers live on the server, which runs replies and timers even while the app is
// closed. This screen loads them, follows live updates, and sends the user's actions back.
type Props = { user: User; onUserChange: (user: User) => void; onSignedOut: () => void }

export function Home({ user, onUserChange, onSignedOut }: Props) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const draftsRef = useRef(drafts)
  draftsRef.current = drafts
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [dropping, setDropping] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [creating, setCreating] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
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
  // Files are already uploaded (the composer waits for them); the message claims them by id.
  const send = async (text: string, attached: Draft[]) => {
    if (!agent) return
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const body = { text, timeZone, attachmentIds: attached.map((d) => d.attachmentId!) }
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

  const patchDraft = (key: number, change: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...change } : d)))

  // Uploads what the draft sends now. A newer version (marked up again meanwhile) wins.
  const upload = async (key: number, file: File) => {
    patchDraft(key, { file, status: 'uploading', attachmentId: null })
    const { status, data } = await api.upload(file.name, file.type, await file.arrayBuffer())
    const current = draftsRef.current.find((d) => d.key === key)
    if (current?.file !== file) return
    if (status === 200) patchDraft(key, { status: 'done', attachmentId: data.attachment.id })
    else {
      patchDraft(key, { status: 'error' })
      fail(data)
    }
  }

  const dispose = (draft: Draft) => {
    if (draft.preview && draft.preview !== draft.originalUrl) URL.revokeObjectURL(draft.preview)
    if (draft.originalUrl) URL.revokeObjectURL(draft.originalUrl)
  }

  const removeDraft = (key: number) => {
    const draft = draftsRef.current.find((d) => d.key === key)
    if (draft) dispose(draft)
    setNotice(null)
    setDrafts((prev) => prev.filter((d) => d.key !== key))
  }

  // Marks drawn on a draft image: send a copy with them drawn in (or the original again, if none).
  const markDraft = async (key: number, marks: Mark[]) => {
    const draft = draftsRef.current.find((d) => d.key === key)
    if (!draft || !draft.originalUrl) return
    let file = draft.original
    if (marks.length) {
      const blob = await flatten(draft.originalUrl, draft.original.type, marks)
      file = new File([blob], renamed(draft.original.name, blob.type), { type: blob.type })
      if (file.size > MAX_FILE_SIZE) {
        setNotice({ text: 'The marked-up image is over 25 MB.' })
        if (!draft.attachmentId) patchDraft(key, { status: 'error' })
        return
      }
    }
    if (draft.preview && draft.preview !== draft.originalUrl) URL.revokeObjectURL(draft.preview)
    const preview = marks.length ? URL.createObjectURL(file) : draft.originalUrl
    patchDraft(key, { marks, preview })
    upload(key, file)
  }

  const addDrafts = (added: { file: File; originalUrl?: string; marks?: Mark[] }[]) => {
    const fitting = added.filter(({ file }) => file.size <= MAX_FILE_SIZE)
    const room = MAX_FILES - draftsRef.current.length
    const accepted = fitting.slice(0, Math.max(0, room))
    const notes: string[] = []
    if (fitting.length < added.length) notes.push('Files must be 25 MB or smaller.')
    if (accepted.length < fitting.length) notes.push(`You can attach up to ${MAX_FILES} files.`)
    setNotice(notes.length ? { text: notes.join(' ') } : null)
    for (const { originalUrl } of added.filter((a) => !accepted.includes(a))) {
      if (originalUrl) URL.revokeObjectURL(originalUrl)
    }
    const created = accepted.map(({ file, originalUrl }): Draft => {
      const url = originalUrl ?? (file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
      return {
        key: nextDraftKey++,
        original: file,
        file,
        marks: [],
        originalUrl: url,
        preview: url,
        status: 'uploading',
        attachmentId: null,
      }
    })
    if (!created.length) return
    draftsRef.current = [...draftsRef.current, ...created]
    setDrafts(draftsRef.current)
    created.forEach((draft, i) => {
      const marks = accepted[i].marks ?? []
      if (marks.length) markDraft(draft.key, marks)
      else upload(draft.key, draft.file)
    })
  }

  const addFiles = (added: File[]) => addDrafts(added.map((file) => ({ file })))

  // Clicking a draft image opens it, ready to draw on. Leaving with changed marks re-uploads it.
  const openDraft = (key: number) => {
    const draft = draftsRef.current.find((d) => d.key === key)
    if (!draft?.originalUrl || !isImage(draft.original.type)) return
    setOverlay({
      src: draft.originalUrl,
      name: draft.original.name,
      marks: draft.marks,
      onClose: (marks) => {
        setOverlay(null)
        if (JSON.stringify(marks) !== JSON.stringify(draft.marks)) markDraft(key, marks)
      },
    })
  }

  // An image already in the chat. Drawing on it attaches a marked-up copy to the next message.
  const openSent = async (attachment: Attachment) => {
    const bytes = await api.readAttachment(attachment.id)
    if (!bytes) return fail({ error: 'not_found' })
    const file = new File([bytes], attachment.name, { type: attachment.type })
    const url = URL.createObjectURL(file)
    setOverlay({
      src: url,
      name: attachment.name,
      marks: [],
      onClose: (marks) => {
        setOverlay(null)
        if (marks.length) addDrafts([{ file, originalUrl: url, marks }])
        else URL.revokeObjectURL(url)
      },
    })
  }

  const openDocument = async (attachment: Attachment) => {
    if (!(await api.openAttachment(attachment.id, attachment.name))) setNotice({ text: `Couldn’t open ${attachment.name}.` })
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
        onSettings={() => setSettingsOpen(true)}
      />
      {settingsOpen && (
        <SettingsDialog
          user={user}
          onUserChange={onUserChange}
          onSignedOut={onSignedOut}
          onClose={() => setSettingsOpen(false)}
        />
      )}
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
              onOpenAttachment={(a) => (isImage(a.type) ? openSent(a) : openDocument(a))}
              onTimer={(timerId, control) => controlTimer(agent.id, timerId, control)}
            />
          )}
        </div>
        <div className="main-composer">
          <Composer
            drafts={drafts}
            onAddFiles={addFiles}
            onRemoveDraft={removeDraft}
            onOpenDraft={openDraft}
            onRetryDraft={(key) => {
              const draft = draftsRef.current.find((d) => d.key === key)
              if (draft) upload(key, draft.file)
            }}
            notice={notice?.text}
            placeholder={agent && `Message ${agent.name}`}
            onSubmit={(text) => {
              const sent = draftsRef.current
              setNotice(null)
              setDrafts([])
              sent.forEach(dispose)
              send(text, sent)
            }}
          />
        </div>
        {overlay && (
          <ImageEditor src={overlay.src} name={overlay.name} marks={overlay.marks} onClose={overlay.onClose} />
        )}
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
