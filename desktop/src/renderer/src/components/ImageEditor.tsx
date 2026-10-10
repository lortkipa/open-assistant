import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import {
  ArrowIcon,
  CircleIcon,
  LineIcon,
  PencilIcon,
  RedoIcon,
  SquareIcon,
  TextIcon,
  MinimizeIcon,
  ResetIcon,
  UndoIcon,
} from './icons'
import { useT, type Key } from '../i18n'

// Opening an image opens it here, ready to draw on: marks point the agent at something. They're
// kept as shapes in the image's own pixels, so they stay editable until the message is sent, and get
// flattened into the uploaded copy. There's no save: leaving keeps whatever is drawn.

type Point = [number, number]
type Tool = 'pen' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text'
export type Mark =
  | { tool: 'pen'; color: string; width: number; points: Point[] }
  | { tool: 'line' | 'arrow' | 'rect' | 'ellipse'; color: string; width: number; from: Point; to: Point }
  | { tool: 'text'; color: string; size: number; at: Point; text: string }

const COLORS: { value: string; name: Key }[] = [
  { value: '#ef4444', name: 'editor.red' },
  { value: '#3b82f6', name: 'editor.blue' },
  { value: '#22c55e', name: 'editor.green' },
  { value: '#111111', name: 'editor.black' },
  { value: '#ffffff', name: 'editor.white' },
]

const TOOLS: { tool: Tool; name: Key; icon: ReactNode }[] = [
  { tool: 'pen', name: 'editor.pen', icon: <PencilIcon size={18} /> },
  { tool: 'line', name: 'editor.line', icon: <LineIcon size={18} /> },
  { tool: 'arrow', name: 'editor.arrow', icon: <ArrowIcon size={18} /> },
  { tool: 'rect', name: 'editor.rect', icon: <SquareIcon size={18} /> },
  { tool: 'ellipse', name: 'editor.ellipse', icon: <CircleIcon size={18} /> },
  { tool: 'text', name: 'editor.text', icon: <TextIcon size={18} /> },
]

// Marks look the same on a small screenshot and a large photo.
const strokeWidth = (w: number, h: number) => Math.max(2, Math.round(Math.max(w, h) / 300))
const fontFor = (size: number) => `600 ${size}px system-ui, sans-serif`

function drawMark(ctx: CanvasRenderingContext2D, mark: Mark) {
  ctx.save()
  ctx.strokeStyle = ctx.fillStyle = mark.color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (mark.tool === 'text') {
    ctx.font = fontFor(mark.size)
    ctx.textBaseline = 'top'
    // A soft outline keeps text readable on any background.
    ctx.shadowColor = mark.color === '#ffffff' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'
    ctx.shadowBlur = mark.size / 8
    mark.text.split('\n').forEach((line, i) => ctx.fillText(line, mark.at[0], mark.at[1] + i * mark.size * 1.2))
    ctx.restore()
    return
  }
  ctx.lineWidth = mark.width
  ctx.beginPath()
  if (mark.tool === 'pen') {
    const [first, ...rest] = mark.points
    ctx.moveTo(...first)
    // A single click still leaves a dot.
    if (!rest.length) ctx.lineTo(first[0] + 0.01, first[1])
    for (const p of rest) ctx.lineTo(...p)
  } else {
    const [x1, y1] = mark.from
    const [x2, y2] = mark.to
    if (mark.tool === 'rect') ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1))
    else if (mark.tool === 'ellipse') {
      ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2)
    } else {
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      if (mark.tool === 'arrow') {
        const angle = Math.atan2(y2 - y1, x2 - x1)
        const head = mark.width * 4.5
        for (const side of [-1, 1]) {
          ctx.moveTo(x2, y2)
          ctx.lineTo(x2 - head * Math.cos(angle + side * 0.5), y2 - head * Math.sin(angle + side * 0.5))
        }
      }
    }
  }
  ctx.stroke()
  ctx.restore()
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

// The image with its marks, at full size. Photos stay JPEG or WebP; anything else becomes PNG.
export async function flatten(src: string, type: string, marks: Mark[]): Promise<Blob> {
  const img = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  for (const mark of marks) drawMark(ctx, mark)
  const out = type === 'image/jpeg' || type === 'image/webp' ? type : 'image/png'
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), out, 0.92))
}

type Props = {
  src: string
  name: string
  marks: Mark[]
  // Leaving, with the marks as they are now.
  onClose: (marks: Mark[]) => void
}

export function ImageEditor({ src, name, marks: initial, onClose }: Props) {
  const t = useT()
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(COLORS[0].value)
  const [marks, setMarks] = useState(initial)
  const [past, setPast] = useState<Mark[][]>([])
  const [future, setFuture] = useState<Mark[][]>([])
  // The mark being drawn right now.
  const [drawing, setDrawing] = useState<Mark | null>(null)
  // Text being typed, at a point on the image.
  const [typing, setTyping] = useState<{ at: Point; text: string } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  // Image pixels per screen pixel, for placing the text box.
  const [scale, setScale] = useState(1)

  useEffect(() => {
    let live = true
    loadImage(src).then((loaded) => live && setImg(loaded))
    return () => {
      live = false
    }
  }, [src])

  const width = img ? strokeWidth(img.naturalWidth, img.naturalHeight) : 4
  const fontSize = width * 7

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    for (const mark of marks) drawMark(ctx, mark)
    if (drawing) drawMark(ctx, drawing)
  }, [img, marks, drawing])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !img) return
    const observer = new ResizeObserver(() => setScale(img.naturalWidth / canvas.getBoundingClientRect().width))
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [img])

  const commit = (next: Mark[]) => {
    setPast((p) => [...p, marks])
    setMarks(next)
    setFuture([])
  }

  const undo = () => {
    if (!past.length) return
    setFuture((f) => [marks, ...f])
    setMarks(past.at(-1)!)
    setPast((p) => p.slice(0, -1))
  }

  const redo = () => {
    if (!future.length) return
    setPast((p) => [...p, marks])
    setMarks(future[0])
    setFuture((f) => f.slice(1))
  }

  // Blur and a click can both finish the same text in one go; the ref makes the second a no-op.
  const typingRef = useRef(typing)
  typingRef.current = typing
  const finishText = () => {
    const current = typingRef.current
    if (!current) return
    typingRef.current = null
    const text = current.text.replace(/\s+$/, '')
    setTyping(null)
    if (text) commit([...marks, { tool: 'text', color, size: fontSize, at: current.at, text }])
  }

  useEffect(() => {
    if (typing) textRef.current?.focus()
  }, [typing?.at])

  const toImage = (e: PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect()
    const s = img!.naturalWidth / rect.width
    return [(e.clientX - rect.left) * s, (e.clientY - rect.top) * s]
  }

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || !img) return
    const p = toImage(e)
    if (tool === 'text') {
      // Clicking elsewhere finishes the text being typed; the next click starts a new one.
      e.preventDefault()
      if (typingRef.current) finishText()
      else if (!typing) setTyping({ at: p, text: '' })
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrawing(tool === 'pen' ? { tool, color, width, points: [p] } : { tool, color, width, from: p, to: p })
  }

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return
    const p = toImage(e)
    setDrawing(drawing.tool === 'pen' ? { ...drawing, points: [...drawing.points, p] } : drawing.tool === 'text' ? drawing : { ...drawing, to: p })
  }

  const onPointerUp = () => {
    if (!drawing) return
    setDrawing(null)
    // A click without dragging makes no shape (a pen click still leaves a dot).
    if (drawing.tool !== 'pen' && drawing.tool !== 'text') {
      const [x1, y1] = drawing.from
      const [x2, y2] = drawing.to
      if (Math.hypot(x2 - x1, y2 - y1) < width * 2) return
    }
    commit([...marks, drawing])
  }

  const close = () => {
    // Text still being typed counts.
    const text = typingRef.current?.text.replace(/\s+$/, '')
    const at = typingRef.current?.at
    onClose(at && text ? [...marks, { tool: 'text', color, size: fontSize, at, text }] : marks)
  }

  const latest = useRef({ undo, redo, close, typing })
  latest.current = { undo, redo, close, typing }
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      const { undo, redo, close, typing } = latest.current
      if (typing) return
      const mod = e.ctrlKey || e.metaKey
      if (e.key === 'Escape') close()
      else if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) undo()
      else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) redo()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const onTextKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter finishes; Shift+Enter starts another line.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      finishText()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setTyping(null)
    }
  }

  return (
    <div
      className="image-overlay editor"
      role="dialog"
      aria-modal="true"
      aria-label={name}
      // A click around the image leaves, like the button.
      onPointerDown={(e) => (e.target === e.currentTarget || (e.target as Element).classList.contains('editor-stage')) && close()}
    >
      <div className="editor-stage">
        {img && (
          <div className="editor-canvas-wrap">
            <canvas
              ref={canvasRef}
              className={`editor-canvas tool-${tool}`}
              width={img.naturalWidth}
              height={img.naturalHeight}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => setDrawing(null)}
            />
            {typing && (
              <textarea
                ref={textRef}
                className="editor-text"
                rows={Math.max(1, typing.text.split('\n').length)}
                value={typing.text}
                onChange={(e) => setTyping({ ...typing, text: e.target.value })}
                onKeyDown={onTextKeyDown}
                onBlur={finishText}
                style={{
                  left: typing.at[0] / scale,
                  top: typing.at[1] / scale,
                  color,
                  font: fontFor(fontSize / scale),
                  lineHeight: 1.2,
                }}
              />
            )}
            <button type="button" className="overlay-btn editor-exit" aria-label={t('editor.exit')} title={t('editor.exitHint')} onClick={close}>
              <MinimizeIcon size={18} />
            </button>
          </div>
        )}
      </div>

      <div className="editor-toolbar" role="toolbar">
        {TOOLS.map((item) => (
          <button
            key={item.tool}
            type="button"
            className={`editor-btn${tool === item.tool ? ' active' : ''}`}
            aria-label={t(item.name)}
            aria-pressed={tool === item.tool}
            title={t(item.name)}
            onClick={() => {
              finishText()
              setTool(item.tool)
            }}
          >
            {item.icon}
          </button>
        ))}
        <span className="editor-sep" />
        {COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            className={`editor-color${color === c.value ? ' active' : ''}`}
            style={{ background: c.value }}
            aria-label={t(c.name)}
            aria-pressed={color === c.value}
            title={t(c.name)}
            onClick={() => setColor(c.value)}
          />
        ))}
        <span className="editor-sep" />
        <button type="button" className="editor-btn" aria-label={t('editor.undo')} title={t('editor.undo')} disabled={!past.length} onClick={undo}>
          <UndoIcon size={18} />
        </button>
        <button type="button" className="editor-btn" aria-label={t('editor.redo')} title={t('editor.redo')} disabled={!future.length} onClick={redo}>
          <RedoIcon size={18} />
        </button>
        <button
          type="button"
          className="editor-btn"
          aria-label={t('editor.reset')}
          title={t('editor.resetHint')}
          disabled={!marks.length}
          onClick={() => commit([])}
        >
          <ResetIcon size={18} />
        </button>
      </div>
    </div>
  )
}
