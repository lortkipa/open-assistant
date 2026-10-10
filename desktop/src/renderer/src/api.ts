import { t, type Key } from './i18n'

export type User = {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  // Settings → General.
  theme: 'system' | 'light' | 'dark'
  accent: 'bot' | 'neutral'
  language: 'en' | 'ka'
  spellcheck: boolean
}

// Server error codes with a message of their own.
const KNOWN = [
  'network',
  'invalid_email',
  'rate_limited',
  'email_failed',
  'invalid_code',
  'code_expired',
  'too_many_attempts',
  'invalid_name',
  'invalid_settings',
  'google_failed',
  'google_not_configured',
  'ai_not_configured',
  'ai_failed',
  'too_large',
  'not_found',
  'invalid_image',
]

export function errorMessage(data: any): string {
  const error = data?.error as string | undefined
  if (error === 'cooldown') return t('error.cooldown', { seconds: data.retryAfter })
  if (error === 'invalid_code' && data.attemptsLeft > 0) {
    const count = data.attemptsLeft
    return t(count === 1 ? 'error.invalid_code_left.one' : 'error.invalid_code_left.other', { count })
  }
  if (error && KNOWN.includes(error)) return t(`error.${error}` as Key)
  return t('error.unknown', { error: error ?? 'unknown error' })
}

export const api = window.api
