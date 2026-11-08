import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

export type AlertTone = 'info' | 'success' | 'warning' | 'danger'

const ALERT_STYLE: Record<AlertTone, { box: string; icon: ReactNode }> = {
  info: {
    box: 'border-info/25 bg-info-weak text-info',
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 11v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="8" r="1.1" fill="currentColor" />
      </svg>
    ),
  },
  success: {
    box: 'border-success/25 bg-success-weak text-success',
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="m8 12.5 2.6 2.6L16.5 9"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  warning: {
    box: 'border-warning/25 bg-warning-weak text-warning',
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
        <path
          d="M12 4.5 21 19.5H3L12 4.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M12 10v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="16.6" r="1" fill="currentColor" />
      </svg>
    ),
  },
  danger: {
    box: 'border-danger/25 bg-danger-weak text-danger',
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="m9 9 6 6M15 9l-6 6"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
}

export interface AlertProps {
  tone?: AlertTone
  title?: ReactNode
  children?: ReactNode
  /** 右侧操作 */
  action?: ReactNode
  /** 可关闭 */
  closable?: boolean
  onClose?: () => void
  icon?: ReactNode
  className?: string
  /** 紧凑模式（单行） */
  compact?: boolean
}

/** 提示条 */
export function Alert({
  tone = 'info',
  title,
  children,
  action,
  closable,
  onClose,
  icon,
  className,
  compact,
}: AlertProps) {
  const style = ALERT_STYLE[tone]
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-md border px-3',
        compact ? 'py-2' : 'py-2.5',
        style.box,
        className,
      )}
    >
      <span className="mt-px shrink-0">{icon ?? style.icon}</span>
      <div className="min-w-0 flex-1 text-[0.8125rem] leading-5">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn('text-fg-2', title && 'mt-0.5')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {closable && (
        <button
          type="button"
          aria-label="关闭提示"
          onClick={onClose}
          className="shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
        >
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" aria-hidden="true">
            <path
              d="m6 6 12 12M18 6 6 18"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  )
}

export interface BannerProps {
  tone?: AlertTone
  icon?: ReactNode
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

/** 页面级横幅（比 Alert 更醒目） */
export function Banner({
  tone = 'info',
  icon,
  title,
  description,
  action,
  className,
}: BannerProps) {
  const style = ALERT_STYLE[tone]
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border px-4 py-3', style.box, className)}>
      <span className="mt-0.5 shrink-0">{icon ?? style.icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="text-[0.8125rem] font-semibold">{title}</p>}
        {description && <p className="mt-0.5 text-xs leading-5 text-fg-2">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
