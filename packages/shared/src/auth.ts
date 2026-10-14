// Sign-in rules and a mock auth client shared by every app.
// The mock stands in for Better Auth (Google OAuth + email OTP) until the API exists.

export const OTP_LENGTH = 6;
export const MAX_CODE_ATTEMPTS = 3;
export const RESEND_COOLDOWN_S = 30;
export const CODE_TTL_MIN = 10;

export function emailProblem(value: string): string {
  if (!value) return "Enter your email address.";
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value)) return "Enter a valid email address.";
  return "";
}

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export type VerifyResult = { ok: true } | { ok: false; attemptsLeft: number };

export interface AuthClient {
  sendEmailCode(email: string): Promise<void>;
  verifyEmailCode(email: string, code: string): Promise<VerifyResult>;
  signInWithGoogle(): Promise<void>;
}

// Accepts TEST_CODE for any email; each send resets the attempt count.
export class MockAuthClient implements AuthClient {
  static readonly TEST_CODE = "123456";
  private attempts = new Map<string, number>();

  async sendEmailCode(email: string): Promise<void> {
    this.attempts.set(email, 0);
  }

  async verifyEmailCode(email: string, code: string): Promise<VerifyResult> {
    const used = this.attempts.get(email) ?? 0;
    if (used >= MAX_CODE_ATTEMPTS) return { ok: false, attemptsLeft: 0 };
    if (code === MockAuthClient.TEST_CODE) return { ok: true };
    this.attempts.set(email, used + 1);
    return { ok: false, attemptsLeft: MAX_CODE_ATTEMPTS - used - 1 };
  }

  async signInWithGoogle(): Promise<void> {}
}
