import {
  type AuthClient,
  CODE_TTL_MIN,
  OTP_LENGTH,
  RESEND_COOLDOWN_S,
} from "@open-assistant/shared";
import { type ClipboardEvent, type FormEvent, useEffect, useRef, useState } from "react";

type Props = {
  auth: AuthClient;
  email: string;
  onVerified: () => void;
  onBack: () => void;
};

const empty = () => Array<string>(OTP_LENGTH).fill("");

export function CodeStep({ auth, email, onVerified, onBack }: Props) {
  const [digits, setDigitsState] = useState(empty);
  // Keystrokes can arrive faster than React re-renders, so edits read from this ref.
  const latest = useRef(digits);
  const setDigits = (next: string[]) => {
    latest.current = next;
    setDigitsState(next);
  };
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [locked, setLocked] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [cooldownEnd, setCooldownEnd] = useState(0);
  const [now, setNow] = useState(Date.now);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const backButton = useRef<HTMLButtonElement>(null);

  const secondsLeft = Math.max(0, Math.ceil((cooldownEnd - now) / 1000));

  useEffect(() => {
    if (secondsLeft === 0) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [secondsLeft === 0]);

  function sendCode() {
    void auth.sendEmailCode(email);
    setDigits(empty());
    setError("");
    setInvalid(false);
    setLocked(false);
    setCooldownEnd(Date.now() + RESEND_COOLDOWN_S * 1000);
    setNow(Date.now());
    inputs.current[0]?.focus();
  }

  useEffect(sendCode, []);

  async function verify(code: string[]) {
    const joined = code.join("");
    if (joined.length < OTP_LENGTH) {
      setError(`Enter all ${OTP_LENGTH} digits from the email.`);
      inputs.current[code.findIndex((d) => !d)]?.focus();
      return;
    }
    const result = await auth.verifyEmailCode(email, joined);
    if (result.ok) {
      onVerified();
      return;
    }
    setInvalid(true);
    setShaking(true);
    if (result.attemptsLeft > 0) {
      const n = result.attemptsLeft;
      setError(`That code is incorrect. ${n} ${n === 1 ? "attempt" : "attempts"} left.`);
      setDigits(empty());
      inputs.current[0]?.focus();
    } else {
      setLocked(true);
      setError("Too many incorrect attempts. Go back and enter your email again to get a new code.");
      backButton.current?.focus();
    }
  }

  function clearError() {
    if (error && !locked) {
      setError("");
      setInvalid(false);
    }
  }

  function onDigit(i: number, value: string) {
    const d = value.replace(/\D/g, "").slice(-1);
    const next = latest.current.map((x, j) => (j === i ? d : x));
    setDigits(next);
    clearError();
    if (d && i < OTP_LENGTH - 1) inputs.current[i + 1]?.focus();
    if (next.every(Boolean)) void verify(next);
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!text) return;
    e.preventDefault();
    const next = latest.current.map((x, j) => text[j] ?? x);
    setDigits(next);
    clearError();
    inputs.current[Math.min(text.length, OTP_LENGTH - 1)]?.focus();
    if (text.length === OTP_LENGTH) void verify(next);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void verify(latest.current);
  }

  return (
    <section className="card">
      <h1>Check your email</h1>
      <p className="lede">
        We sent a {OTP_LENGTH}-digit code to <span className="sent">{email}</span>. It expires in{" "}
        {CODE_TTL_MIN} minutes.
      </p>

      <form onSubmit={submit} noValidate>
        <div
          className={shaking ? "code shake" : "code"}
          role="group"
          aria-label="One-time code"
          onAnimationEnd={() => setShaking(false)}
        >
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              inputMode="numeric"
              maxLength={1}
              aria-label={`Digit ${i + 1}`}
              autoComplete={i === 0 ? "one-time-code" : undefined}
              value={d}
              disabled={locked}
              aria-invalid={invalid ? true : undefined}
              onChange={(e) => onDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !d && i > 0) inputs.current[i - 1]?.focus();
              }}
              onPaste={onPaste}
            />
          ))}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary" type="submit" disabled={locked}>
          Continue
        </button>
      </form>

      <div className="links">
        <button
          className="link"
          type="button"
          disabled={locked || secondsLeft > 0}
          onClick={sendCode}
        >
          {!locked && secondsLeft > 0 ? (
            <>
              Resend code in <span className="timer">0:{String(secondsLeft).padStart(2, "0")}</span>
            </>
          ) : (
            "Resend code"
          )}
        </button>
        <button ref={backButton} className="link" type="button" onClick={onBack}>
          Use a different email
        </button>
      </div>
    </section>
  );
}
