import { useEffect, useRef, useState, type DragEvent } from 'react'
import { api, errorMessage, type User } from '../api'
import { Sidebar } from '../components/Sidebar'
import { Composer } from '../components/Composer'
import { Chat, type TimerControl } from '../components/Chat'
import { NewAgentDialog } from '../components/NewAgentDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import {
  applyTimerActions,
  finishTimer,
  formatClock,
  resetTimer,
  startTimer,
  stopTimer,
  timeLeft,
  type Agent,
  type Message,
  type Timer,
} from '../agents'
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
  // Read from reply loops and timers, which outlive the render that started them.
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId
  const agentsRef = useRef(agents)
  agentsRef.current = agents

  const update = (id: string, changes: Partial<Agent>) =>
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...changes } : a)))

  // Opening an agent reads it.
  const select = (id: string | null) => {
    setSelectedId(id)
    if (id) update(id, { unread: false })
  }

  const remove = (id: string) => {
    cancelReply(id)
    setAgents((prev) => prev.filter((a) => a.id !== id))
    if (selectedId === id) setSelectedId(null)
  }
  // Agents currently searching or typing a reply.
  const [typing, setTyping] = useState<Set<string>>(new Set())
  // Each agent's reply in progress, by the id of its current request. Writing again cancels it.
  const replies = useRef(new Map<string, string>())

  const setTypingFor = (id: string, on: boolean) =>
    setTyping((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const append = (id: string, message: Message) =>
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, messages: [...a.messages, message] } : a)))

  const editMessage = (id: string, index: number, text: string) =>
    setAgents((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, messages: a.messages.map((m, i) => (i === index ? { ...m, text } : m)) } : a,
      ),
    )

  const cancelReply = (id: string) => {
    const requestId = replies.current.get(id)
    if (!requestId) return
    replies.current.delete(id)
    api.abort(requestId)
  }

  // Stop all replies when signing out.
  useEffect(() => {
    const inProgress = replies.current
    return () => [...inProgress.keys()].forEach(cancelReply)
  }, [])

  // The agent reads the whole chat and sends messages one API call at a time, until it says it's done
  // (or chooses to say nothing). A newer reply for the same agent makes this one drop out unseen.
  const reply = async (id: string, name: string, transcript: Message[]) => {
    cancelReply(id)
    setTypingFor(id, true)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    while (true) {
      const requestId = crypto.randomUUID()
      replies.current.set(id, requestId)
      const messages = transcript.map(({ from, text, timers }) => ({ from, text, timers }))
      const timers = (agentsRef.current.find((a) => a.id === id)?.timers ?? []).map(timerState)
      const body = { agent: { name }, timeZone, messages, timers }
      const { status, data } = await api.request('POST', '/agents/reply', body, requestId)
      if (replies.current.get(id) !== requestId) return
      if (status !== 200) {
        setNotice({ text: errorMessage(data) })
        break
      }
      const current = agentsRef.current.find((a) => a.id === id)
      if (!current) break
      const applied = applyTimerActions(current.timers, data.timers ?? [])
      if (data.message || applied.actions.length) {
        const message: Message = { from: 'agent', text: data.message ?? '', time: now() }
        if (applied.actions.length) message.timers = applied.actions
        transcript = [...transcript, message]
        setAgents((prev) =>
          prev.map((a) => (a.id === id ? { ...a, timers: applied.timers, messages: [...a.messages, message] } : a)),
        )
        // A reply to an agent you've since left marks it unread.
        if (selectedRef.current !== id) update(id, { unread: true })
      }
      if (!data.more || (!data.message && !applied.actions.length)) break
    }
    replies.current.delete(id)
    setTypingFor(id, false)
  }

  const send = (text: string, attached: File[]) => {
    if (!agent) return
    const names = attached.map((file) => `📎 ${file.name}`).join('\n')
    const message: Message = { from: 'user', text: [text, names].filter(Boolean).join('\n\n'), time: now() }
    append(agent.id, message)
    reply(agent.id, agent.name, [...agent.messages, message])
  }
  // The user runs a timer from its card. The agent sees the new state next time it replies.
  const controlTimer = (id: string, timerId: string, control: TimerControl) => {
    const change = control === 'start' ? startTimer : control === 'stop' ? stopTimer : resetTimer
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, timers: a.timers.map((t) => (t.id === timerId ? change(t) : t)) } : a)),
    )
  }

  // When a timer runs out: mark it done, tell the agent (which then texts the user) and show a notification.
  // Returns whether any timer was due.
  const finishDue = () => {
    const at = Date.now()
    let finished = false
    for (const a of agentsRef.current) {
      const due = a.timers.filter((t) => t.status === 'running' && t.endsAt <= at)
      if (!due.length) continue
      finished = true
      const events: Message[] = due.map((t) => ({
        from: 'event',
        text: `Timer ${t.id} “${t.label}” (${formatClock(t.seconds * 1000)}) ran out.`,
        time: now(),
      }))
      const transcript = [...a.messages, ...events]
      const changes = { timers: a.timers.map((t) => (due.includes(t) ? finishTimer(t) : t)), messages: transcript }
      update(a.id, changes)
      // The reply below reads the timers before React re-renders; it must already see these as done.
      agentsRef.current = agentsRef.current.map((x) => (x.id === a.id ? { ...x, ...changes } : x))
      for (const t of due) {
        const notification = new Notification(a.name, { body: `⏰ ${t.label}: time’s up` })
        notification.onclick = () => {
          select(a.id)
          api.focus()
        }
      }
      reply(a.id, a.name, transcript)
    }
    return finished
  }

  // Wake up for the next timer to run out, across all agents. Timeouts can fire a moment early;
  // then nothing is due yet and no state changes, so `wake` schedules another try.
  const [wake, setWake] = useState(0)
  useEffect(() => {
    const ends = agents.flatMap((a) => a.timers.filter((t) => t.status === 'running').map((t) => t.endsAt))
    if (!ends.length) return
    const t = setTimeout(
      () => finishDue() || setWake((n) => n + 1),
      Math.max(0, Math.min(...ends) - Date.now()),
    )
    return () => clearTimeout(t)
  }, [agents, wake])

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
            setAgents((prev) => [...prev, { id, name, shape, messages: [], timers: [] }])
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
              messages={agent.messages}
              timers={agent.timers}
              typing={typing.has(agent.id)}
              onEditMessage={(index, text) => editMessage(agent.id, index, text)}
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

// What the agent is told about a timer.
const timerState = (t: Timer) => ({
  id: t.id,
  label: t.label,
  seconds: t.seconds,
  status: t.status,
  remaining: Math.ceil(timeLeft(t) / 1000),
})

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
