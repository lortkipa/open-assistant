import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type WheelEvent,
} from 'react'
import { useT } from '../i18n'
import { ArrowUpIcon, CloseIcon, FileIcon, PlusIcon } from './icons'
import type { Mark } from './ImageEditor'

// A file in the composer. It uploads as soon as it's attached; sending only needs its id.
export type Draft = {
  key: number
  // As attached.
  original: File
  // What gets sent: the original, or a copy with the user's marks drawn in.
  file: File
  marks: Mark[]
  // Object URLs, for images.
  originalUrl: string | null
  preview: string | null
  status: 'uploading' | 'done' | 'error'
  attachmentId: string | null
}

type Props = {
  drafts: Draft[]
  onAddFiles: (files: File[]) => void
  onRemoveDraft: (key: number) => void
  onOpenDraft: (key: number) => void
  onRetryDraft: (key: number) => void
  onSubmit: (text: string) => void
  // Shown under the box, e.g. why some files weren't attached.
  notice?: string
  placeholder?: string
}

export function Composer({
  drafts,
  onAddFiles,
  onRemoveDraft,
  onOpenDraft,
  onRetryDraft,
  onSubmit,
  notice,
  placeholder,
}: Props) {
  const t = useT()
  const [text, setText] = useState('')
  // Text sits on its own row above the buttons once it no longer fits on one line beside them.
  const [stacked, setStacked] = useState(false)
  const [rowWidth, setRowWidth] = useState(0)
  const rowRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Hidden copy of the text at the single-row width, so measuring doesn't depend on the current layout.
  const mirrorRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLInputElement>(null)

  // Like Claude: files must finish uploading before the message can go.
  const uploaded = drafts.every((d) => d.status === 'done')
  const canSend = (text.trim().length > 0 || drafts.length > 0) && uploaded

  useEffect(() => {
    const row = rowRef.current!
    const observer = new ResizeObserver(([entry]) => setRowWidth(entry.contentRect.width))
    observer.observe(row)
    inputRef.current!.focus()
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const mirror = mirrorRef.current!
    const lineHeight = parseFloat(getComputedStyle(mirror).lineHeight)
    setStacked(text.includes('\n') || mirror.scrollHeight > lineHeight * 1.5)
  }, [text, rowWidth])

  // Grow with the text; CSS max-height caps it and the textarea scrolls from there.
  useLayoutEffect(() => {
    const input = inputRef.current!
    input.style.height = 'auto'
    input.style.height = `${input.scrollHeight}px`
  }, [text, stacked, rowWidth])

  const submit = () => {
    if (!canSend) return
    onSubmit(text.trim())
    setText('')
    inputRef.current!.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  const onPaste = (e: ClipboardEvent) => {
    if (e.clipboardData.files.length === 0) return
    e.preventDefault()
    onAddFiles([...e.clipboardData.files])
  }

  // A plain mouse wheel scrolls the one-row file strip sideways.
  const scrollSideways = (e: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY
  }

  // Clicking the box's padding still lands in the text.
  const focusInput = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      e.preventDefault()
      inputRef.current!.focus()
    }
  }

  return (
    <div className="composer" onMouseDown={focusInput}>
      {notice && (
        <p className="composer-notice" role="alert">
          {notice}
        </p>
      )}
      {drafts.length > 0 && (
        <div className="composer-files" onMouseDown={focusInput} onWheel={scrollSideways}>
          {drafts.map((draft) => (
            <Attachment
              key={draft.key}
              draft={draft}
              onOpen={() => onOpenDraft(draft.key)}
              onRetry={() => onRetryDraft(draft.key)}
              onRemove={() => onRemoveDraft(draft.key)}
            />
          ))}
        </div>
      )}

      <div ref={rowRef} className={`composer-row${stacked ? ' stacked' : ''}`} onMouseDown={focusInput}>
        <button
          type="button"
          className="icon-btn composer-attach"
          aria-label={t('composer.attach')}
          title={t('composer.attach')}
          onClick={() => pickerRef.current!.click()}
        >
          <PlusIcon />
        </button>

        <textarea
          ref={inputRef}
          className="composer-input"
          rows={1}
          placeholder={placeholder ?? t('composer.placeholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        />

        <button
          type="button"
          className="composer-send"
          aria-label={t('composer.send')}
          title={t(uploaded ? 'composer.send' : 'composer.waiting')}
          disabled={!canSend}
          onClick={submit}
        >
          <ArrowUpIcon size={18} />
        </button>

        <div ref={mirrorRef} className="composer-mirror" aria-hidden>
          {text}
        </div>
      </div>

      <input
        ref={pickerRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onAddFiles([...e.target.files])
          e.target.value = ''
          inputRef.current!.focus()
        }}
      />
    </div>
  )
}

// A file's tile: images show themselves, other files their name and type.
function Attachment({ draft, onOpen, onRetry, onRemove }: { draft: Draft; onOpen: () => void; onRetry: () => void; onRemove: () => void }) {
  const t = useT()
  const { file, preview, status } = draft
  return (
    <div className={`attachment ${status}`} title={status === 'error' ? t('composer.uploadFailed', { name: file.name }) : file.name}>
      <button
        type="button"
        className="attachment-body"
        aria-label={
          status === 'error'
            ? t('composer.retryUpload', { name: file.name })
            : preview
              ? t('common.open', { name: file.name })
              : file.name
        }
        onClick={status === 'error' ? onRetry : preview ? onOpen : undefined}
      >
        <FilePreview name={file.name} size={file.size} src={preview} />
        {status === 'uploading' && (
          <span className="attachment-status">
            <span className="spinner" />
          </span>
        )}
        {status === 'error' && <span className="attachment-status error">{t('composer.retry')}</span>}
      </button>
      <button type="button" className="attachment-remove" aria-label={t('composer.remove', { name: file.name })} onClick={onRemove}>
        <CloseIcon size={12} />
      </button>
    </div>
  )
}

// Tints for the file icon, by kind of file.
const FILE_KINDS: [RegExp, string][] = [
  [/^pdf$/, '#f87171'],
  [/^(json|jsonc|csv|tsv|ya?ml|toml|xml|xlsx?|ods|sql|db|sqlite)$/, '#fbbf24'],
  [/^(docx?|odt|rtf|txt|md|markdown|pages|tex|epub)$/, '#60a5fa'],
  [/^(zip|tar|gz|tgz|bz2|xz|7z|rar)$/, '#c084fc'],
  [/^(pptx?|odp|key)$/, '#fb923c'],
  [/^(mp3|wav|flac|ogg|m4a|mp4|mov|mkv|webm|avi)$/, '#f472b6'],
  [/^(ts|tsx|js|jsx|mjs|cjs|py|rb|go|rs|java|kt|swift|c|h|cc|cpp|hpp|cs|php|sh|lua|dart|vue|svelte|html|css|scss)$/, '#8b9cff'],
]

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// The inside of a file tile, shared with the chat: images show themselves; other files a card with
// a tinted icon, the name (the extension goes on the last line, with the size) and the size.
export function FilePreview({ name, size, src }: { name: string; size: number; src: string | null }) {
  if (src) return <img className="attachment-thumb" src={src} alt="" draggable={false} />
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
  const base = dot > 0 ? name.slice(0, dot) : name
  const color = FILE_KINDS.find(([re]) => re.test(ext))?.[1] ?? 'var(--muted)'
  return (
    <span className="file-card" style={{ '--file-color': color } as CSSProperties}>
      <span className="file-card-icon">
        <FileIcon size={18} />
      </span>
      <span className="file-card-name">{base}</span>
      <span className="file-card-meta">{[ext.slice(0, 10).toUpperCase(), formatSize(size)].filter(Boolean).join(' · ')}</span>
    </span>
  )
}
