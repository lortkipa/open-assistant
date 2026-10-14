import { normalizeName } from "@open-assistant/shared";
import { type FormEvent, useRef, useState } from "react";

type Props = { onSubmit: (name: string) => void; onBack: () => void };

export function NameStep({ onSubmit, onBack }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const n = normalizeName(name);
    if (!n) {
      setError("Enter your name.");
      input.current?.focus();
      return;
    }
    onSubmit(n);
  }

  return (
    <section className="card">
      <h1>What's your name?</h1>
      <form onSubmit={submit} noValidate>
        <label className="sr" htmlFor="name">
          Your name
        </label>
        <input
          ref={input}
          className="field"
          type="text"
          id="name"
          name="name"
          placeholder="Your name"
          autoComplete="name"
          maxLength={60}
          autoFocus
          value={name}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary" type="submit" disabled={!name.trim()}>
          Continue
        </button>
      </form>

      <div className="links">
        <button className="link" type="button" onClick={onBack}>
          Use a different email
        </button>
      </div>
    </section>
  );
}
