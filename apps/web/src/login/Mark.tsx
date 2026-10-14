const POINTER = "M0 0L0 22L5.9 16.6L9.9 25.5L13.5 23.9L9.6 15.1L17.2 15.1Z";

// Two pointers, user's and agent's, meeting in the middle.
export function Mark() {
  return (
    <svg className="mark" viewBox="0 0 64 64" role="img" aria-label="Open Assistant">
      <path
        className="u"
        d={POINTER}
        transform="translate(30.5 30.5) rotate(180) scale(1.12)"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path
        className="a"
        d={POINTER}
        transform="translate(33.5 33.5) scale(1.12)"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
