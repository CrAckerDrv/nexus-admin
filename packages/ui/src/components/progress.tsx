import { cn } from '../lib/utils'
import { clamp } from '../lib/utils'
import { sx } from '../lib/scale'

export interface ProgressProps {
  value: number
  max?: number
  /** 展示形态 */
  variant?: 'bar' | 'ring' | 'steps'
  size?: 'xs' | 'sm' | 'md'
  tone?: 'primary' | 'success' | 'warning' | 'danger'
  label?: string
  showLabel?: boolean
  /** 分段进度（如 SLO 预算） */
  segments?: Array<{ value: number; tone?: ProgressProps['tone'] }>
  className?: string
  /** 环形尺寸 */
  ringSize?: number
}

const TONE_BG = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

const TONE_STROKE = {
  primary: 'var(--n-primary)',
  success: 'var(--n-success)',
  warning: 'var(--n-warning)',
  danger: 'var(--n-danger)',
}

/**
 * 进度条 / 环形进度
 *
 * @example
 * <Progress value={62} tone="success" showLabel />
 * <Progress value={78} variant="ring" ringSize={72} />
 */
export function Progress({
  value,
  max = 100,
  variant = 'bar',
  size = 'sm',
  tone = 'primary',
  label,
  showLabel,
  segments,
  className,
  ringSize = 64,
}: ProgressProps) {
  const percent = clamp((value / max) * 100, 0, 100)

  if (variant === 'ring') {
    const stroke = Math.max(4, ringSize * 0.1)
    const radius = (ringSize - stroke) / 2
    const circumference = 2 * Math.PI * radius
    return (
      <div
        className={cn('relative inline-grid place-items-center', className)}
        style={{ width: sx(ringSize), height: sx(ringSize) }}
      >
        {/* viewBox 用设计像素、宽高用 rem：线宽随尺寸保持比例 */}
        <svg
          width={sx(ringSize)}
          height={sx(ringSize)}
          viewBox={`0 0 ${ringSize} ${ringSize}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke="var(--n-surface-3)"
            strokeWidth={stroke}
          />
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke={TONE_STROKE[tone]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (percent / 100) * circumference}
            style={{ transition: 'stroke-dashoffset 480ms var(--ease-out-expo)' }}
          />
        </svg>
        <span className="absolute text-xs font-semibold text-fg tabular-nums">
          {label ?? `${Math.round(percent)}%`}
        </span>
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)}>
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? '进度'}
        className={cn(
          'flex w-full overflow-hidden rounded-full bg-surface-3',
          size === 'xs' && 'h-1',
          size === 'sm' && 'h-1.5',
          size === 'md' && 'h-2.5',
        )}
      >
        {segments ? (
          segments.map((seg, index) => (
            <div
              key={index}
              className={cn(
                'h-full first:rounded-l-full last:rounded-r-full',
                TONE_BG[seg.tone ?? tone],
              )}
              style={{ width: `${clamp((seg.value / max) * 100, 0, 100)}%` }}
            />
          ))
        ) : (
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out-expo)]',
              TONE_BG[tone],
            )}
            style={{ width: `${percent}%` }}
          />
        )}
      </div>
      {showLabel && (
        <div className="mt-1 flex items-center justify-between text-2xs text-fg-3 tabular-nums">
          <span>{label}</span>
          <span className="font-medium text-fg-2">{Math.round(percent)}%</span>
        </div>
      )}
    </div>
  )
}

export interface MeterProps {
  value: number
  max?: number
  /** 阈值：超过即变红 */
  thresholds?: { warning: number; danger: number }
  className?: string
  showValue?: boolean
  size?: ProgressProps['size']
}

/** 阈值感知的迷你进度（表格内常用） */
export function Meter({
  value,
  max = 100,
  thresholds = { warning: 75, danger: 90 },
  className,
  showValue,
  size = 'xs',
}: MeterProps) {
  const percent = (value / max) * 100
  const tone: ProgressProps['tone'] =
    percent >= thresholds.danger ? 'danger' : percent >= thresholds.warning ? 'warning' : 'primary'
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Progress value={value} max={max} size={size} tone={tone} className="min-w-16 flex-1" />
      {showValue && (
        <span className="w-10 shrink-0 text-right text-2xs text-fg-2 tabular-nums">
          {Math.round(percent)}%
        </span>
      )}
    </div>
  )
}
