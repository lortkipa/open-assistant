import { useState } from 'react'

// Google photo when there is one, otherwise a neutral head-and-shoulders silhouette.
export function Avatar({ url, size = 96 }: { url: string | null; size?: number }) {
  const [failed, setFailed] = useState(false)
  if (url && !failed) {
    return (
      <img
        className="avatar"
        src={url}
        width={size}
        height={size}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    )
  }
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <rect width="100" height="100" fill="#c9ccd1" />
      <circle cx="50" cy="39" r="19" fill="#f0f2f5" />
      <path d="M14 100c0-21 16-34 36-34s36 13 36 34z" fill="#f0f2f5" />
    </svg>
  )
}
