import type { ReactNode } from 'react'
import { cn } from '../lib/utils'
import { useUILabels } from '../lib/hooks'
import { sx } from '../lib/scale'

/* ------------------------------------------------------------------ *
 * 页面骨架：PageHeader / PageContainer / Section / Toolbar
 * 保证后台页面留白、标题层级、操作区位置一致
 * ------------------------------------------------------------------ */

export interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** 面包屑等导航区域 */
  breadcrumb?: ReactNode
  /** 右侧操作 */
  actions?: ReactNode
  /**
   * 操作区容器的附加类名
   *
   * 默认操作区是 `shrink-0`（保证按钮不被压扁）。当操作区里有 SlidingTabs 这类
   * 「自身不可压缩」的控件、且项数较多时（例如性能监控页的四个时间区间 + 三个按钮），
   * 窄屏下会整体顶出容器。这类页面可以传 `min-w-0 shrink` 让外层可收缩，交由内部换行。
   */
  actionsClassName?: string
  /** 标签页/筛选等附属区域 */
  footer?: ReactNode
  /** 返回按钮 */
  onBack?: () => void
  /** 标题补充信息（徽标） */
  badge?: ReactNode
  className?: string
  /** 小尺寸（用于弹窗或二级页面） */
  compact?: boolean
}

/** 页面头部 */
export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  actionsClassName,
  footer,
  onBack,
  badge,
  className,
  compact,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-4', className)}>
      {breadcrumb && <div className="mb-2">{breadcrumb}</div>}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="返回"
              className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
                <path
                  d="M15 6l-6 6 6 6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1
                className={cn(
                  'truncate font-semibold text-fg',
                  compact ? 'text-base' : 'text-lg leading-7',
                )}
              >
                {title}
              </h1>
              {badge}
            </div>
            {description && (
              <p className={cn('mt-0.5 text-xs leading-5 text-fg-3', compact && 'text-2xs')}>
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className={cn('flex shrink-0 flex-wrap items-center gap-2', actionsClassName)}>
            {actions}
          </div>
        )}
      </div>
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  )
}

export interface PageContainerProps {
  children: ReactNode
  /** 最大宽度 */
  size?: 'sm' | 'md' | 'lg' | 'full'
  className?: string
}

/**
 * 页面内容容器
 *
 * 宽度与左右留白交给 `tokens.css` 里的 `.n-page-container`：
 * 只有那里能同时被 `data-content`（全宽/居中）与 `--n-page-pad-x`（密度/布局）影响，
 * 写死在这儿的 `px-4` 会让「内容宽度」开关只能改最大宽度、改不了留白。
 * `data-size` 只声明「本页希望多宽」，最终取值由令牌层决定。
 */
export function PageContainer({ children, size = 'lg', className }: PageContainerProps) {
  return (
    <div data-size={size} className={cn('n-page-container mx-auto w-full py-4 sm:py-5', className)}>
      {children}
    </div>
  )
}

/** 栅格布局辅助 */
export function Grid({
  children,
  cols = 2,
  gap = 'md',
  className,
}: {
  children: ReactNode
  cols?: 1 | 2 | 3 | 4 | 5 | 6
  gap?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const colClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  }[cols]
  const gapClass = { sm: 'gap-2', md: 'gap-3', lg: 'gap-4' }[gap]
  return <div className={cn('grid', colClass, gapClass, className)}>{children}</div>
}

/** 纵向堆叠容器 */
export function Stack({
  children,
  gap = 'md',
  className,
}: {
  children: ReactNode
  gap?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}) {
  const gapClass = { xs: 'space-y-1', sm: 'space-y-2', md: 'space-y-3', lg: 'space-y-4' }[gap]
  return <div className={cn(gapClass, className)}>{children}</div>
}

/** 水平排列容器 */
export function Inline({
  children,
  gap = 'sm',
  wrap = true,
  className,
}: {
  children: ReactNode
  gap?: 'xs' | 'sm' | 'md'
  wrap?: boolean
  className?: string
}) {
  const gapClass = { xs: 'gap-1', sm: 'gap-2', md: 'gap-3' }[gap]
  return (
    <div className={cn('flex items-center', wrap && 'flex-wrap', gapClass, className)}>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 统计卡片
 * ------------------------------------------------------------------ */

export interface StatCardProps {
  label: string
  value: ReactNode
  /** 单位/后缀 */
  suffix?: string
  /** 环比变化，正数显示上升箭头 */
  delta?: number
  /** 变化的方向语义（有些指标下降是好事） */
  deltaTone?: 'up-good' | 'down-good' | 'neutral'
  deltaLabel?: string
  icon?: ReactNode
  /** 迷你趋势数据（自动绘制 sparkline） */
  trend?: number[]
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
  onLive?: boolean
  className?: string
  footer?: ReactNode
}

const STAT_TONE = {
  primary: 'text-primary bg-primary-weak',
  success: 'text-success bg-success-weak',
  warning: 'text-warning bg-warning-weak',
  danger: 'text-danger bg-danger-weak',
  neutral: 'text-fg-2 bg-surface-3',
}

function Sparkline({ data, tone = 'primary' }: { data: number[]; tone?: StatCardProps['tone'] }) {
  if (data.length < 2) return null
  const width = 88
  const height = 26
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const step = width / (data.length - 1)
  const points = data
    .map(
      (value, index) =>
        `${(index * step).toFixed(1)},${(height - ((value - min) / span) * (height - 4) - 2).toFixed(1)}`,
    )
    .join(' ')
  const stroke = {
    primary: 'var(--n-primary)',
    success: 'var(--n-success)',
    warning: 'var(--n-warning)',
    danger: 'var(--n-danger)',
    neutral: 'var(--n-fg-3)',
  }[tone ?? 'primary']

  return (
    <svg
      width={sx(width)}
      height={sx(height)}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0 overflow-visible"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={width}
        cy={height - ((data[data.length - 1]! - min) / span) * (height - 4) - 2}
        r="2"
        fill={stroke}
      />
    </svg>
  )
}

/**
 * 指标卡片
 *
 * @example
 * <StatCard label="今日订单" value="12,846" delta={8.2} trend={[3,5,4,7,6,9]} />
 */
export function StatCard({
  label,
  value,
  suffix,
  delta,
  deltaTone = 'up-good',
  deltaLabel,
  icon,
  trend,
  tone = 'primary',
  onLive,
  className,
  footer,
}: StatCardProps) {
  const L = useUILabels()
  const positive =
    deltaTone === 'neutral' ? null : deltaTone === 'up-good' ? (delta ?? 0) >= 0 : (delta ?? 0) <= 0
  const deltaClass = positive === null ? 'text-fg-3' : positive ? 'text-success' : 'text-danger'

  return (
    <div
      className={cn(
        'relative flex flex-col gap-2 rounded-lg border border-line bg-surface p-3.5 transition-shadow hover:shadow-sm',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {icon && (
          <span
            className={cn('grid size-7 shrink-0 place-items-center rounded-md', STAT_TONE[tone])}
          >
            {icon}
          </span>
        )}
        <span className="min-w-0 truncate text-xs text-fg-3">{label}</span>
        {onLive && (
          <span className="ml-auto inline-flex items-center gap-1 text-2xs text-success">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-success" />
            </span>
            实时
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-1">
          <span className="text-[1.375rem] leading-none font-semibold tracking-tight text-fg tabular-nums">
            {value}
          </span>
          {suffix && <span className="text-xs text-fg-3">{suffix}</span>}
        </div>
        {trend && <Sparkline data={trend} tone={tone} />}
      </div>
      {(delta !== undefined || footer) && (
        <div className="flex items-center gap-1.5 text-2xs">
          {delta !== undefined && (
            <>
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 font-medium tabular-nums',
                  deltaClass,
                )}
              >
                <svg
                  viewBox="0 0 24 24"
                  className={cn('size-2.5', delta < 0 && 'rotate-180')}
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 4l7 11H5L12 4z" />
                </svg>
                {Math.abs(delta).toFixed(1)}%
              </span>
              <span className="text-fg-4">{deltaLabel ?? L.deltaLabel}</span>
            </>
          )}
          {footer}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 时间线（操作记录/审计）
 * ------------------------------------------------------------------ */

export interface TimelineItem {
  key: string
  title: ReactNode
  description?: ReactNode
  time?: ReactNode
  icon?: ReactNode
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'primary'
  meta?: ReactNode
}

const DOT_TONE = {
  default: 'bg-surface-3 text-fg-3 border-line',
  primary: 'bg-primary-weak text-primary border-primary/25',
  success: 'bg-success-weak text-success border-success/25',
  warning: 'bg-warning-weak text-warning border-warning/25',
  danger: 'bg-danger-weak text-danger border-danger/25',
}

export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn('relative space-y-0', className)}>
      {items.map((item, index) => (
        <li key={item.key} className="relative flex gap-3 pb-4 last:pb-0">
          {index < items.length - 1 && (
            <span
              className="absolute top-6 left-[0.6875rem] h-[calc(100%-1rem)] w-px bg-line"
              aria-hidden="true"
            />
          )}
          <span
            className={cn(
              'relative z-10 grid size-[1.4375rem] shrink-0 place-items-center rounded-full border text-2xs',
              DOT_TONE[item.tone ?? 'default'],
            )}
          >
            {item.icon ?? (
              <svg viewBox="0 0 24 24" className="size-3" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <p className="text-[0.8125rem] text-fg">{item.title}</p>
              {item.time && (
                <span className="shrink-0 text-2xs text-fg-4 tabular-nums">{item.time}</span>
              )}
            </div>
            {item.description && (
              <p className="mt-0.5 text-xs leading-5 text-fg-3">{item.description}</p>
            )}
            {item.meta && <div className="mt-1.5">{item.meta}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}
