export type User = {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
}

const messages: Record<string, string> = {
  network: 'Can’t reach the server. Check your connection and try again.',
  invalid_email: 'Enter a valid email address.',
  rate_limited: 'Too many attempts. Please try again later.',
  email_failed: 'We couldn’t send the email. Please try again.',
  invalid_code: 'That code isn’t right.',
  code_expired: 'This code has expired. Request a new one.',
  too_many_attempts: 'Too many wrong attempts. Request a new code.',
  invalid_name: 'Enter a name up to 50 characters.',
  google_failed: 'Google sign-in didn’t complete. Please try again.',
  google_not_configured: 'Google sign-in isn’t set up on this server yet.',
  ai_not_configured: 'AI replies aren’t set up on this server yet.',
  ai_failed: 'The agent couldn’t reply. Please try again.',
  too_large: 'This message is too long to send.',
  not_found: 'That agent or timer no longer exists.',
}

export function errorMessage(data: any): string {
  const error = data?.error as string | undefined
  if (error === 'cooldown') return `Please wait ${data.retryAfter}s before requesting another code.`
  if (error === 'invalid_code' && data.attemptsLeft > 0) {
    return `That code isn’t right. ${data.attemptsLeft} ${data.attemptsLeft === 1 ? 'attempt' : 'attempts'} left.`
  }
  if (error && messages[error]) return messages[error]
  return `Something went wrong (${error ?? 'unknown error'}). Please try again.`
}

export const api = window.api
