import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/utils'
import { useUILabels } from '../lib/hooks'

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

/** 空状态占位 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  size = 'md',
  className,
  ...props
}: EmptyStateProps) {
  const L = useUILabels()
  const pad = size === 'sm' ? 'py-8' : size === 'lg' ? 'py-20' : 'py-14'
  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 text-center', pad, className)}
      {...props}
    >
      <div
        className={cn(
          'mb-3 grid place-items-center rounded-full border border-line bg-surface-2 text-fg-4',
          size === 'sm' ? 'size-9' : 'size-12',
        )}
      >
        {icon ?? (
          <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
            <path
              d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M4 13h4l1.5 2h5L16 13h4" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        )}
      </div>
      <p className="text-[0.8125rem] font-medium text-fg-2">{title ?? L.empty}</p>
      {description && <p className="mt-1 max-w-sm text-xs leading-5 text-fg-3">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
