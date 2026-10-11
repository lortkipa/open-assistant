import type { Reminder } from '../agents'
import { useLanguage, useT, type Key } from '../i18n'
import { BellIcon, CloseIcon } from './icons'

type Props = {
  reminder: Reminder
  onCancel: () => void
}

const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

// A reminder an agent set, under the message it set it with. The user can cancel it from here.
export function ReminderCard({ reminder, onCancel }: Props) {
  const t = useT()
  const language = useLanguage()
  const at = new Date(reminder.at)
  // The clock follows the computer's settings (24-hour or not); day and month names the app's language.
  const time = at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const days = Math.round((dayStart(at) - dayStart(new Date())) / 86_400_000)
  const when =
    days === 0
      ? t('reminder.today', { time })
      : days === 1
        ? t('reminder.tomorrow', { time })
        : `${at.toLocaleDateString(language, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            ...(at.getFullYear() !== new Date().getFullYear() && { year: 'numeric' }),
          })}, ${time}`
  const details = [
    when,
    reminder.repeat !== 'none' && t(`reminder.repeat.${reminder.repeat}` as Key),
    reminder.status !== 'pending' && t(`reminder.${reminder.status}`),
  ].filter(Boolean)

  return (
    <div className={`reminder reminder-${reminder.status}`}>
      <span className="reminder-icon">
        <BellIcon size={16} />
      </span>
      <div className="reminder-text">
        <span className="reminder-note" title={reminder.note}>
          {reminder.note}
        </span>
        <span className="reminder-when">{details.join(' · ')}</span>
      </div>
      {reminder.status === 'pending' && (
        <button className="reminder-cancel" aria-label={t('reminder.cancel')} title={t('reminder.cancel')} onClick={onCancel}>
          <CloseIcon size={16} />
        </button>
      )}
    </div>
  )
}
