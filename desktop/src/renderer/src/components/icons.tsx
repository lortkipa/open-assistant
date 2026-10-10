import type { ReactNode } from 'react'

// Stroke icons on a 24px grid; they take the surrounding text color.
function Icon({ size = 20, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

export const SearchIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Icon>
)

export const SlidersIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Icon>
)

export const PlusIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const ArrowUpIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Icon>
)

export const CloseIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)

export const FileIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Icon>
)

export const UploadIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M12 15V4M7 9l5-5 5 5" />
    <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
  </Icon>
)

export const GaugeIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
)

export const HelpIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />
  </Icon>
)

export const ChevronRightIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
)

export const MessageIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Icon>
)

export const InfoIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 16v-4M12 8h.01" />
  </Icon>
)

export const SettingsIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
)

export const UserIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Icon>
)

export const LogOutIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </Icon>
)

export const PencilIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </Icon>
)

export const PinIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
  </Icon>
)

export const UnreadIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3.5" fill="currentColor" />
  </Icon>
)

export const ReadIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5 5-5" />
  </Icon>
)

export const TrashIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
  </Icon>
)

export const CopyIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
    <path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" />
  </Icon>
)

export const CheckIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
)

export const PlayIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M7 5.5v13l11-6.5z" />
  </Icon>
)

export const PauseIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M9 5.5v13M15 5.5v13" />
  </Icon>
)

export const ResetIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
    <path d="M4.5 4.5v4h4" />
  </Icon>
)

export const TimerIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="12" cy="13.5" r="7" />
    <path d="M12 10v3.5l2 2M10 3h4" />
  </Icon>
)

// Image viewer and editor.

export const LineIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M5 19 19 5" />
  </Icon>
)

export const ArrowIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M5 19 19 5M10 5h9v9" />
  </Icon>
)

export const SquareIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <rect x="5" y="5" width="14" height="14" rx="1.5" />
  </Icon>
)

export const CircleIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="7.5" />
  </Icon>
)

export const TextIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M5 6V5h14v1M12 5v14M9 19h6" />
  </Icon>
)

export const UndoIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Icon>
)

export const RedoIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </Icon>
)

// Arrows pointing in: leave the full-size image.
export const MinimizeIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
  </Icon>
)
