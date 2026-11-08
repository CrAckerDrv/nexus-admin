import type { ReactNode } from 'react'
import { cn } from '../lib/utils'
import { avatarColor } from '../lib/utils'
import { sx } from '../lib/scale'

export interface AvatarProps {
  name?: string
  src?: string
  size?: number | 'xs' | 'sm' | 'md' | 'lg'
  /** 圆角 */
  shape?: 'circle' | 'square'
  status?: 'online' | 'offline' | 'busy'
  className?: string
}

const SIZE_MAP = { xs: 18, sm: 24, md: 28, lg: 36 } as const

/** 头像：无图片时用姓名首字生成 */
export function Avatar({
  name = '',
  src,
  size = 'md',
  shape = 'circle',
  status,
  className,
}: AvatarProps) {
  const design = typeof size === 'number' ? size : SIZE_MAP[size]
  // 尺寸走 rem，与 Tailwind 的间距/字号同一套单位（1rem = 16px）
  const px = sx(design)
  const initial = name.trim().slice(0, 1).toUpperCase() || '?'
  const bg = avatarColor(name || 'anonymous')

  return (
    <span className={cn('relative inline-flex shrink-0', className)} style={{ width: px, height: px }}>
      {src ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          className={cn(
            'size-full object-cover',
            shape === 'circle' ? 'rounded-full' : 'rounded-md',
          )}
        />
      ) : (
        <span
          className={cn(
            'grid size-full place-items-center font-medium text-white',
            shape === 'circle' ? 'rounded-full' : 'rounded-md',
            bg,
          )}
          style={{ fontSize: sx(Math.max(design * 0.42, 9)) }}
          aria-hidden="true"
        >
          {initial}
        </span>
      )}
      {status && (
        <span
          className={cn(
            'absolute -right-0.5 -bottom-0.5 rounded-full border-2 border-surface',
            status === 'online' && 'bg-success',
            status === 'busy' && 'bg-warning',
            status === 'offline' && 'bg-fg-4',
          )}
          style={{
            width: sx(Math.max(design * 0.32, 6)),
            height: sx(Math.max(design * 0.32, 6)),
          }}
        />
      )}
    </span>
  )
}

export interface AvatarGroupProps {
  users: Array<{ name: string; src?: string }>
  max?: number
  size?: AvatarProps['size']
  className?: string
}

/** 头像组 */
export function AvatarGroup({ users, max = 4, size = 'sm', className }: AvatarGroupProps) {
  const shown = users.slice(0, max)
  const rest = users.length - shown.length
  const design = typeof size === 'number' ? size : SIZE_MAP[size]
  return (
    <div className={cn('flex items-center -space-x-1.5', className)}>
      {shown.map((user, index) => (
        <Avatar
          key={index}
          name={user.name}
          src={user.src}
          size={size}
          className="ring-2 ring-surface"
        />
      ))}
      {rest > 0 && (
        <span
          className="grid place-items-center rounded-full bg-surface-3 text-2xs font-medium text-fg-2 ring-2 ring-surface"
          style={{ width: sx(design), height: sx(design) }}
        >
          +{rest}
        </span>
      )}
    </div>
  )
}

export interface KbdProps {
  children: ReactNode
  className?: string
}

/** 键盘按键提示 */
export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-[0.25rem] border border-line bg-surface-2 px-1 font-sans text-2xs font-medium text-fg-3',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

export interface TagProps {
  children: ReactNode
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger'
  onClose?: () => void
  className?: string
  icon?: ReactNode
}

const TAG_TONE = {
  neutral: 'bg-surface-2 text-fg-2 border-line',
  primary: 'bg-primary-weak text-primary border-primary/20',
  success: 'bg-success-weak text-success border-success/20',
  warning: 'bg-warning-weak text-warning border-warning/20',
  danger: 'bg-danger-weak text-danger border-danger/20',
}

/** 可关闭标签 */
export function Tag({ children, tone = 'neutral', onClose, className, icon }: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[1.375rem] items-center gap-1 rounded-sm border px-1.5 text-xs',
        TAG_TONE[tone],
        className,
      )}
    >
      {icon}
      {children}
      {onClose && (
        <button
          type="button"
          aria-label="移除"
          onClick={onClose}
          className="-mr-0.5 rounded-[0.125rem] p-0.5 opacity-60 transition-opacity hover:opacity-100"
        >
          <svg viewBox="0 0 24 24" className="size-2.5" fill="none" aria-hidden="true">
            <path
              d="m6 6 12 12M18 6 6 18"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </span>
  )
}
