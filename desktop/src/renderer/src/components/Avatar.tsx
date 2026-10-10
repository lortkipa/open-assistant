import { useState } from 'react'

// A photo uploaded in Settings is stored on the server; the main process serves it with the session token.
const UPLOADED = '/me/avatar/'
const srcFor = (url: string) => (url.startsWith(UPLOADED) ? `oa-avatar://${url.slice(UPLOADED.length)}` : url)

// The user's photo (uploaded or from Google) when there is one, otherwise a neutral head-and-shoulders silhouette.
export function Avatar({ url, size = 96 }: { url: string | null; size?: number }) {
  // Remembered per photo, so a new one gets its own chance to load.
  const [failed, setFailed] = useState<string | null>(null)
  if (url && failed !== url) {
    return (
      <img
        className="avatar"
        src={srcFor(url)}
        width={size}
        height={size}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(url)}
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
