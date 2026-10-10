import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'

const LENGTH = 6

type Props = {
  onComplete: (code: string) => void
  disabled?: boolean
  error?: boolean
  // Changing this clears the boxes and focuses the first one.
  resetKey?: number
}

export function CodeInput({ onComplete, disabled, error, resetKey }: Props) {
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''))
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    setDigits(Array(LENGTH).fill(''))
    refs.current[0]?.focus()
  }, [resetKey])

  useEffect(() => {
    if (!disabled && !digits.some(Boolean)) refs.current[0]?.focus()
  }, [disabled])

  const fill = (start: number, text: string) => {
    const incoming = text.replace(/\D/g, '').slice(0, LENGTH - start)
    if (!incoming) return
    const next = [...digits]
    for (let i = 0; i < incoming.length; i++) next[start + i] = incoming[i]
    setDigits(next)
    const end = Math.min(start + incoming.length, LENGTH - 1)
    refs.current[end]?.focus()
    if (next.every(Boolean)) onComplete(next.join(''))
  }

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const next = [...digits]
      if (next[i]) next[i] = ''
      else if (i > 0) {
        next[i - 1] = ''
        refs.current[i - 1]?.focus()
      }
      setDigits(next)
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
    else if (e.key === 'ArrowRight' && i < LENGTH - 1) refs.current[i + 1]?.focus()
  }

  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    // A full code pasted anywhere fills from the start.
    fill(text.replace(/\D/g, '').length >= LENGTH ? 0 : i, text)
  }

  return (
    <div className={`code-input ${error ? 'has-error' : ''}`} role="group" aria-label="Verification code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          value={d}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={LENGTH}
          aria-label={`Digit ${i + 1}`}
          disabled={disabled}
          onChange={(e) => fill(i, e.target.value.replace(d, '') || e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={(e) => onPaste(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  )
}
