import type { SVGProps } from 'react'

/**
 * 画布内置图标
 *
 * 为什么不用 lucide-react：`@nexus/ui` 保持零第三方依赖（只有 peer react），
 * 图标是组件库的「外观资产」而非业务资产，放在包内才不至于让使用者被迫装图标库。
 * 路径统一 24×24、1.8 线宽、round 端点，与项目其它图标观感一致。
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base(size = 16): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
  }
}

export function ZoomInIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6M11 8v6M8 11h6" />
    </svg>
  )
}

export function ZoomOutIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6M8 11h6" />
    </svg>
  )
}

export function FitIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
    </svg>
  )
}

export function MapIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 7 9 4Z" />
      <path d="M9 4v13M15 7v12.5" />
    </svg>
  )
}

export function GridIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    </svg>
  )
}

export function SparkIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M12 3.5l1.9 4.9 4.9 1.9-4.9 1.9L12 17.1l-1.9-4.9L5.2 10.3l4.9-1.9L12 3.5Z" />
      <path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" />
    </svg>
  )
}

export function PlusIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function MinusIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M5 12h14" />
    </svg>
  )
}

export function CloseIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function CheckIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  )
}

export function StopIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function CopyIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 5.5A1.5 1.5 0 0 0 13.5 4H5.5A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15" />
    </svg>
  )
}

export function TrashIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M4 7h16M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7M6.5 7l.8 12.1A1.4 1.4 0 0 0 8.7 20.5h6.6a1.4 1.4 0 0 0 1.4-1.4L17.5 7" />
    </svg>
  )
}

export function LockIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </svg>
  )
}

export function UnlockIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.6-1.6" />
    </svg>
  )
}

export function TextIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M5 6.5V5h14v1.5M12 5v14M9 19h6" />
    </svg>
  )
}

export function ImageIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2.2" />
      <circle cx="8.8" cy="10" r="1.5" />
      <path d="M20 15.5l-4.2-4.2a1.5 1.5 0 0 0-2.1 0L5 20" />
    </svg>
  )
}

export function VideoIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <rect x="3" y="6" width="13" height="12" rx="2.2" />
      <path d="M16 10.5l4.3-2.4a.8.8 0 0 1 1.2.7v6.4a.8.8 0 0 1-1.2.7L16 13.5" />
    </svg>
  )
}

export function NoteIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M5 5.5A1.5 1.5 0 0 1 6.5 4h11A1.5 1.5 0 0 1 19 5.5v8L14.5 20h-8A1.5 1.5 0 0 1 5 18.5v-13Z" />
      <path d="M19 13.5h-3.5a1.5 1.5 0 0 0-1.5 1.5V20" />
    </svg>
  )
}

export function GroupIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
    </svg>
  )
}

export function MoreIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="5.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function SendIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M4.5 12.2l14.8-6.5a.6.6 0 0 1 .8.8l-6.5 14.8a.6.6 0 0 1-1.1-.05l-1.9-5.6-5.6-1.9a.6.6 0 0 1-.05-1.1Z" />
    </svg>
  )
}

export function RefreshIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M20 12a8 8 0 1 1-2.6-5.9M20 4.5V10h-5.5" />
    </svg>
  )
}

export function UndoIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M8.5 7.5L4 12l4.5 4.5" />
      <path d="M4 12h9.5a5 5 0 0 1 0 10H9" />
    </svg>
  )
}

export function RedoIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M15.5 7.5L20 12l-4.5 4.5" />
      <path d="M20 12H10.5a5 5 0 0 0 0 10H15" />
    </svg>
  )
}

export function DownloadIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M12 4v10.5M7.5 11L12 15.5 16.5 11M5 19.5h14" />
    </svg>
  )
}

export function HelpIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.8v.3M12 17.2h.01" />
    </svg>
  )
}

export function PlayIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function PauseIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <rect x="7" y="5.5" width="3.6" height="13" rx="1" fill="currentColor" stroke="none" />
      <rect x="13.4" y="5.5" width="3.6" height="13" rx="1" fill="currentColor" stroke="none" />
    </svg>
  )
}
