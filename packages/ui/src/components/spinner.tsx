import type { SVGProps } from 'react'
import { cn } from '../lib/utils'
import { useUILabels } from '../lib/hooks'
import { sx } from '../lib/scale'

export interface SpinnerProps extends SVGProps<SVGSVGElement> {
  /** 尺寸，默认 16px */
  size?: number
  /** 视觉强度 */
  tone?: 'current' | 'primary' | 'muted'
}

const TONE: Record<NonNullable<SpinnerProps['tone']>, string> = {
  current: 'text-current',
  primary: 'text-primary',
  muted: 'text-fg-3',
}

/** 加载指示器 · 纯 SVG 无依赖 */
export function Spinner({ size = 16, tone = 'current', className, ...props }: SpinnerProps) {
  const L = useUILabels()
  return (
    <svg
      width={sx(size)}
      height={sx(size)}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label={L.loading}
      className={cn('shrink-0', TONE[tone], className)}
      {...props}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.22" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        style={{ animation: 'n-spin 0.75s linear infinite', transformOrigin: '12px 12px' }}
      />
    </svg>
  )
}

export interface LoadingOverlayProps {
  visible?: boolean
  label?: string
  className?: string
}

/** 局部加载遮罩 */
export function LoadingOverlay({ visible = true, label, className }: LoadingOverlayProps) {
  const L = useUILabels()
  if (!visible) return null
  return (
    <div
      className={cn(
        'absolute inset-0 z-10 grid place-items-center rounded-[inherit] bg-surface/70 backdrop-blur-[1px]',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-xs text-fg-3">
        <Spinner tone="primary" />
        <span>{label ?? L.loading}</span>
      </div>
    </div>
  )
}
