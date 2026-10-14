import { emailProblem } from "@open-assistant/shared";
import { type FormEvent, useRef, useState } from "react";
import { GoogleIcon } from "./GoogleIcon";

type Props = {
  email: string;
  onEmailChange: (email: string) => void;
  onSubmit: () => void;
  onGoogle: () => void;
};

export function EmailStep({ email, onEmailChange, onSubmit, onGoogle }: Props) {
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const problem = emailProblem(email.trim());
    setError(problem);
    if (problem) {
      input.current?.focus();
      return;
    }
    onEmailChange(email.trim());
    onSubmit();
  }

  return (
    <section className="card">
      <h1>Log in to Open Assistant</h1>

      <form onSubmit={submit} noValidate>
        <label className="sr" htmlFor="email">
          Email address
        </label>
        <input
          ref={input}
          className="field"
          type="email"
          id="email"
          name="email"
          placeholder="Email address"
          autoComplete="email"
          inputMode="email"
          autoFocus
          value={email}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            onEmailChange(e.target.value);
            setError("");
          }}
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary" type="submit" disabled={!email.trim()}>
          Continue with Email
        </button>
      </form>

      <div className="divider">or</div>

      <button className="btn btn-secondary" type="button" onClick={onGoogle}>
        <GoogleIcon />
        Continue with Google
      </button>
    </section>
  );
}
