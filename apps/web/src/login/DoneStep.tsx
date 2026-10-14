type Props = { name: string; signedInAs: string; onRestart: () => void };

export function DoneStep({ name, signedInAs, onRestart }: Props) {
  return (
    <section className="card done">
      <div className="check">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </div>
      <h1>Welcome, {name}</h1>
      <p className="lede">Signed in {signedInAs}.</p>
      <div className="links">
        <button className="link" type="button" onClick={onRestart}>
          Start over
        </button>
      </div>
    </section>
  );
}
