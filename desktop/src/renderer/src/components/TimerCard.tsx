import { useEffect, useReducer } from 'react'
import { formatClock, timeLeft, type Timer } from '../agents'
import { PauseIcon, PlayIcon, ResetIcon } from './icons'

type Props = {
  timer: Timer
  onStart: () => void
  onStop: () => void
  onReset: () => void
}

const RADIUS = 11
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// A timer an agent made, counting down in the chat. The user can run it from here too.
export function TimerCard({ timer, onStart, onStop, onReset }: Props) {
  const running = timer.status === 'running'
  // Re-render while running. The time is read fresh on every render: a tick saved from before a
  // restart would put the new end time more than a full timer away, and the ring would overshoot.
  const [, tick] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    if (!running) return
    const interval = setInterval(tick, 250)
    return () => clearInterval(interval)
  }, [running])

  const left = timeLeft(timer)
  // The ring empties as time runs out; a finished timer shows it full again.
  const progress = timer.status === 'done' ? 1 : Math.min(1, Math.max(0, left / (timer.seconds * 1000)))

  return (
    <div className={`timer timer-${timer.status}`}>
      <svg className="timer-ring" viewBox="0 0 28 28" aria-hidden>
        <circle className="timer-track" cx="14" cy="14" r={RADIUS} />
        <circle
          className="timer-progress"
          cx="14"
          cy="14"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
        />
      </svg>
      <span className="timer-label">{timer.label}</span>
      <span className="timer-clock">{formatClock(left)}</span>
      <div className="timer-actions">
        {running ? (
          <button className="timer-btn timer-btn-main" aria-label="Stop" title="Stop" onClick={onStop}>
            <PauseIcon size={16} />
          </button>
        ) : (
          timer.status !== 'done' && (
            <button className="timer-btn timer-btn-main" aria-label="Start" title="Start" onClick={onStart}>
              <PlayIcon size={16} />
            </button>
          )
        )}
        {timer.status !== 'reset' && (
          <button className="timer-btn" aria-label="Reset" title="Reset" onClick={onReset}>
            <ResetIcon size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
