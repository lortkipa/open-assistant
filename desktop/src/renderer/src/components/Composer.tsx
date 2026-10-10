import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type MouseEvent,
  type WheelEvent,
} from 'react'
import { ArrowUpIcon, CloseIcon, FileIcon, PlusIcon } from './icons'

type Props = {
  files: File[]
  onAddFiles: (files: File[]) => void
  onRemoveFile: (index: number) => void
  onSubmit: (text: string, files: File[]) => void
  // Shown under the box, e.g. why some files weren't attached.
  notice?: string
  placeholder?: string
}

export function Composer({
  files,
  onAddFiles,
  onRemoveFile,
  onSubmit,
  notice,
  placeholder = 'Message Open Assistant',
}: Props) {
  const [text, setText] = useState('')
  // Text sits on its own row above the buttons once it no longer fits on one line beside them.
  const [stacked, setStacked] = useState(false)
  const [rowWidth, setRowWidth] = useState(0)
  const rowRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Hidden copy of the text at the single-row width, so measuring doesn't depend on the current layout.
  const mirrorRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLInputElement>(null)

  const canSend = text.trim().length > 0 || files.length > 0

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
    onSubmit(text.trim(), files)
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
      {files.length > 0 && (
        <div className="composer-files" onMouseDown={focusInput} onWheel={scrollSideways}>
          {files.map((file, i) => (
            <Attachment key={fileKey(file)} file={file} onRemove={() => onRemoveFile(i)} />
          ))}
        </div>
      )}

      <div ref={rowRef} className={`composer-row${stacked ? ' stacked' : ''}`} onMouseDown={focusInput}>
        <button
          type="button"
          className="icon-btn composer-attach"
          aria-label="Attach files"
          title="Attach files"
          onClick={() => pickerRef.current!.click()}
        >
          <PlusIcon />
        </button>

        <textarea
          ref={inputRef}
          className="composer-input"
          rows={1}
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        />

        <button
          type="button"
          className="composer-send"
          aria-label="Send"
          title="Send"
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

// Stable keys, so removing one file doesn't remount (and re-read) the ones after it.
const fileKeys = new WeakMap<File, number>()
let nextKey = 0
function fileKey(file: File) {
  if (!fileKeys.has(file)) fileKeys.set(file, nextKey++)
  return fileKeys.get(file)!
}

function Attachment({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div className="attachment" title={file.name}>
      {preview ? (
        <img className="attachment-thumb" src={preview} alt="" />
      ) : (
        <span className="attachment-icon">
          <FileIcon size={18} />
        </span>
      )}
      <span className="attachment-meta">
        <span className="attachment-name">{file.name}</span>
        <span className="attachment-size">{formatSize(file.size)}</span>
      </span>
      <button type="button" className="attachment-remove" aria-label={`Remove ${file.name}`} onClick={onRemove}>
        <CloseIcon size={14} />
      </button>
    </div>
  )
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
