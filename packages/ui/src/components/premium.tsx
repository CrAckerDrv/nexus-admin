import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { cn } from '../lib/utils'
import { sx } from '../lib/scale'
import { isMotionEnabled, useMotionEnabled } from '../lib/hooks'

/* ------------------------------------------------------------------ *
 * 高级感组件集合
 * 这些组件偏「视觉表现」，用于首屏、看板、营销区块。
 * 全部基于 CSS + rAF 实现，不引入动画库。
 *
 * 动效开关：统一读 `useMotionEnabled()`（组件体）或 `isMotionEnabled()`（初始化器），
 * 两者的判定与 tokens.css 的 `[data-motion]` 完全同源 ——
 * 应用内「始终开启 / 减少」与系统 `prefers-reduced-motion` 不会再出现两套行为。
 * ------------------------------------------------------------------ */

/* ------------------------------ 数字滚动 ------------------------------ */

export interface AnimatedNumberProps {
  value: number
  /** 小数位 */
  decimals?: number
  /** 动画时长（ms）；上次值 → 新值的递增滚动会自动按比例缩短 */
  duration?: number
  /** 前缀 / 后缀 */
  prefix?: string
  suffix?: string
  /** 千分位 */
  separator?: boolean
  className?: string
  /** 用于格式化最终展示（优先级最高） */
  format?: (value: number) => ReactNode
  /** 数值变化时，从「上一次的显示值」继续滚（默认 true）；false 则每次都从 0 爬起 */
  rollFromPrevious?: boolean
}

/**
 * 数字滚动 · 首屏看板的关键指标增长动画
 *
 * 用 rAF + easeOutExpo 插值；**开关由 `useMotionEnabled()` 决定**，
 * 而它读的是 `<html data-motion>` 与 `prefers-reduced-motion` 的合成结果 ——
 * 于是应用内「动效：始终开启 / 减少」与系统偏好不会出现两套行为：
 * 关掉动效时数字直接显示终值，开启时才从 0 递增到目标。
 *
 * 两个细节决定了「滚动」看起来是否自然：
 * 1. **从当前值继续滚**：实时指标（GMV、QPS）每几秒刷一次，
 *    如果每次刷新都归零重爬，画面会像心跳停止又重启。默认从 `display` 的当前值滚到新值。
 * 2. **滚动距离越短越快**：按「变化幅度 / 起点量级」压缩时长（下限 380ms），
 *    十万级的指标小幅跳动不该占用完整的 1.2s。
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  duration = 1200,
  prefix,
  suffix,
  separator = true,
  className,
  format,
  rollFromPrevious = true,
}: AnimatedNumberProps) {
  const motion = useMotionEnabled()
  const [display, setDisplay] = useState(() => (motion ? 0 : value))
  /** 上一次动画的终值：决定这次的起点与时长 */
  const lastValueRef = useRef(value)
  const displayRef = useRef(display)
  displayRef.current = display

  useEffect(() => {
    if (!motion) {
      // 减少动效：直接落在终值，并把起点对齐，避免下次开启时从旧值跳一下
      lastValueRef.current = value
      setDisplay(value)
      return
    }

    const from = rollFromPrevious ? displayRef.current : 0
    const delta = Math.abs(value - from)
    if (delta < 10 ** -decimals / 2) {
      lastValueRef.current = value
      setDisplay(value)
      return
    }

    /**
     * 时长自适应：变化幅度相对起点越大 → 越接近完整时长；
     * 小幅跳动压到 380ms，读数不会为了"有动效"而长期处于追赶状态。
     */
    const scale = from === 0 ? 1 : Math.min(1, delta / Math.max(Math.abs(from), delta))
    const span = Math.max(380, Math.round(duration * Math.max(scale, 0.35)))

    const startedAt = performance.now()
    let frame = 0
    const tick = (now: number) => {
      /**
       * `progress` 必须夹到 [0,1]
       *
       * rAF 回调收到的时间戳是**该帧的开始时刻**，可能早于 effect 里刚取的
       * `performance.now()`（effect 跑在这一帧开始之后）。不夹的话首帧
       * `progress < 0`，easeOutExpo 会算出负数，读数先跌到 -11% 再往回爬 ——
       * 肉眼看到的是「数字先变成负的再涨」，是最容易被当成数据错的一帧。
       */
      const progress = Math.min(Math.max((now - startedAt) / span, 0), 1)
      // easeOutExpo：前段快、后段收尾缓，数字感更"高级"
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setDisplay(from + (value - from) * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
      else lastValueRef.current = value
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration, decimals, motion, rollFromPrevious])

  const text = useMemo(() => {
    const rounded = display.toFixed(decimals)
    if (!separator) return rounded
    const [intPart, decPart] = rounded.split('.')
    const withComma = (intPart ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return decPart ? `${withComma}.${decPart}` : withComma
  }, [display, decimals, separator])

  if (format) return <span className={className}>{format(value)}</span>

  return (
    <span
      className={cn('tabular-nums', className)}
      data-motion-number={motion ? 'rolling' : 'static'}
      aria-label={text}
    >
      {prefix}
      {text}
      {suffix && <span className="ml-0.5 text-[0.7em] font-normal text-fg-3">{suffix}</span>}
    </span>
  )
}

/* ------------------------------ 光斑卡片 ------------------------------ */

export interface SpotlightCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** 光斑颜色（默认跟随强调色） */
  color?: string
  /** 光斑半径（px） */
  radius?: number
  /** 边框是否发光 */
  glow?: boolean
}

/**
 * 光斑卡片 · 鼠标跟随的径向高光
 *
 * 通过 CSS 变量传递坐标，避免每帧 setState 造成重渲染。
 */
export function SpotlightCard({
  children,
  color = 'var(--n-primary)',
  radius = 220,
  glow = true,
  className,
  ...props
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--spot-x', `${event.clientX - rect.left}px`)
    el.style.setProperty('--spot-y', `${event.clientY - rect.top}px`)
    el.style.setProperty('--spot-on', '1')
  }, [])

  const onPointerLeave = useCallback(() => {
    ref.current?.style.setProperty('--spot-on', '0')
  }, [])

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={
        {
          '--spot-radius': `${radius}px`,
          '--spot-color': color,
        } as CSSProperties
      }
      className={cn(
        'group relative isolate overflow-hidden rounded-lg border border-line bg-surface',
        glow &&
          'transition-[border-color,box-shadow] duration-300 hover:border-primary/30 hover:shadow-md',
        className,
      )}
      {...props}
    >
      {/* 光斑层 */}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -inset-px -z-10 opacity-[var(--spot-on,0)]',
          'transition-opacity duration-300',
          'bg-[radial-gradient(var(--spot-radius)_circle_at_var(--spot-x,50%)_var(--spot-y,50%),color-mix(in_oklab,var(--spot-color)_14%,transparent),transparent_75%)]',
        )}
      />
      {children}
    </div>
  )
}

/* ------------------------------ 流光边框 ------------------------------ */

export interface BorderBeamProps {
  children: ReactNode
  className?: string
  /** 旋转周期（秒） */
  duration?: number
  /** 边框粗细 */
  width?: number
  /** 颜色（默认品牌色） */
  color?: string
  radius?: string
}

/** 流光边框 · 一圈绕行的渐变光束（看板卡片的高级做法） */
export function BorderBeam({
  children,
  className,
  duration = 6,
  width = 1.5,
  color = 'var(--n-primary)',
  radius = 'var(--n-radius-lg)',
}: BorderBeamProps) {
  return (
    <div
      className={cn('relative isolate overflow-hidden', className)}
      style={{ borderRadius: radius }}
    >
      <span
        aria-hidden="true"
        className="n-beam pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          borderRadius: radius,
          padding: `${width}px`,
          background: `conic-gradient(from var(--beam-angle,0deg), transparent 0 30%, ${color} 45%, color-mix(in oklab, ${color} 60%, transparent) 55%, transparent 70% 100%)`,
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          animation: `n-beam-rotate ${duration}s linear infinite`,
        }}
      />
      <div className="rounded-[inherit] bg-surface">{children}</div>
    </div>
  )
}

/* ------------------------------ 渐变文字 ------------------------------ */

export interface GradientTextProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
  /** 渐变方向 */
  direction?: 'to-r' | 'to-br' | 'to-b'
}

/** 渐变文字 · 标题的视觉焦点 */
export function GradientText({
  children,
  direction = 'to-r',
  className,
  ...props
}: GradientTextProps) {
  return (
    <span
      className={cn(
        'bg-clip-text text-transparent',
        direction === 'to-r' && 'bg-gradient-to-r from-primary via-[#7c3aed] to-[#06b6d4]',
        direction === 'to-br' && 'bg-gradient-to-br from-primary via-[#7c3aed] to-[#ec4899]',
        direction === 'to-b' && 'bg-gradient-to-b from-fg to-fg-3',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

/* ------------------------------ 滚动跑马灯 ------------------------------ */

export interface MarqueeProps {
  children: ReactNode
  /** 速度（秒/圈） */
  speed?: number
  /** 方向 */
  reverse?: boolean
  /** 暂停于 hover */
  pauseOnHover?: boolean
  className?: string
  gap?: number
}

/** 跑马灯 · 用于公告条、客户 logo 墙 */
export function Marquee({
  children,
  speed = 24,
  reverse,
  pauseOnHover = true,
  gap = 32,
  className,
}: MarqueeProps) {
  return (
    <div
      className={cn('group relative flex overflow-hidden', className)}
      style={{ maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}
    >
      {[0, 1].map((index) => (
        <div
          key={index}
          aria-hidden={index === 1}
          className={cn(
            'n-marquee__track flex shrink-0 items-center',
            pauseOnHover && 'group-hover:[animation-play-state:paused]',
          )}
          style={{
            gap,
            paddingRight: gap,
            animation: `n-marquee ${speed}s linear infinite`,
            animationDirection: reverse ? 'reverse' : 'normal',
          }}
        >
          {children}
        </div>
      ))}
    </div>
  )
}

/* ------------------------------ 滑动指示器标签 ------------------------------ */

export interface SlidingTabsProps<T extends string> {
  items: Array<{ value: T; label: ReactNode; icon?: ReactNode }>
  value: T
  onChange: (value: T) => void
  className?: string
  size?: 'sm' | 'md'
}

/**
 * 滑动指示器标签
 *
 * 比 SegmentedControl 更有"高级感"：白色胶囊会跟随选中项平滑滑动。
 * 用 CSS 变量记录索引，无需测量 DOM。
 */
export function SlidingTabs<T extends string>({
  items,
  value,
  onChange,
  className,
  size = 'md',
}: SlidingTabsProps<T>) {
  const index = Math.max(
    0,
    items.findIndex((item) => item.value === value),
  )
  const count = items.length || 1

  return (
    <div
      role="tablist"
      className={cn(
        'relative inline-flex items-center rounded-lg bg-surface-3 p-1',
        size === 'sm' ? 'h-8' : 'h-9',
        className,
      )}
      style={{ '--tab-index': index, '--tab-count': count } as CSSProperties}
    >
      {/* 滑动胶囊 */}
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-1 rounded-md bg-surface shadow-sm transition-[transform] duration-300 ease-[var(--ease-out-expo)]"
        style={{
          width: `calc((100% - 0.5rem) / var(--tab-count))`,
          transform: `translateX(calc(var(--tab-index) * 100%))`,
        }}
      />
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative z-10 inline-flex h-full flex-1 items-center justify-center gap-1.5 rounded-md px-3 font-medium whitespace-nowrap transition-colors duration-200',
              size === 'sm' ? 'text-xs' : 'text-[0.8125rem]',
              active ? 'text-fg' : 'text-fg-3 hover:text-fg-2',
            )}
          >
            {item.icon}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------ 环形指标 ------------------------------ */

export interface RingMetricProps {
  value: number
  max?: number
  label?: ReactNode
  sublabel?: ReactNode
  size?: number
  stroke?: number
  tone?: 'primary' | 'success' | 'warning' | 'danger'
  className?: string
}

/** 环形指标 · 带渐变描边与刻度弧 */
export function RingMetric({
  value,
  max = 100,
  label,
  sublabel,
  size = 132,
  stroke = 10,
  tone = 'primary',
  className,
}: RingMetricProps) {
  const motion = useMotionEnabled()
  const [progress, setProgress] = useState(() => (isMotionEnabled() ? 0 : value))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const percent = Math.min(Math.max(value / max, 0), 1)

  useEffect(() => {
    if (!motion) {
      setProgress(value)
      return
    }
    const frame = requestAnimationFrame(() => setProgress(value))
    return () => cancelAnimationFrame(frame)
  }, [value, motion])

  const gradientId = `ring-${tone}-${size}`
  const strokeColor = {
    primary: 'var(--n-primary)',
    success: 'var(--n-success)',
    warning: 'var(--n-warning)',
    danger: 'var(--n-danger)',
  }[tone]

  return (
    <div
      className={cn('relative inline-grid place-items-center', className)}
      style={{ width: sx(size), height: sx(size) }}
    >
      {/* viewBox 用设计像素、宽高用 rem：描边随尺寸保持比例 */}
      <svg
        width={sx(size)}
        height={sx(size)}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.45" />
            <stop offset="100%" stopColor={strokeColor} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--n-surface-3)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (progress / max) * circumference}
          style={{ transition: 'stroke-dashoffset 900ms var(--ease-out-expo)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-fg tabular-nums">
            {label ?? `${Math.round(percent * 100)}%`}
          </div>
          {sublabel && <div className="mt-0.5 text-2xs text-fg-3">{sublabel}</div>}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------ 迷你趋势图 ------------------------------ */

export interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  tone?: 'primary' | 'success' | 'warning' | 'danger'
  /** 面积渐变 */
  area?: boolean
  /** 末端脉冲点 */
  pulse?: boolean
  className?: string
}

/** 迷你趋势线 · 比 StatCard 内嵌版本更完整（带面积与端点） */
export function Sparkline({
  data,
  width = 120,
  height = 36,
  tone = 'primary',
  area = true,
  pulse = true,
  className,
}: SparklineProps) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const step = width / (data.length - 1)
  const points = data.map((value, index) => {
    const x = index * step
    const y = height - ((value - min) / span) * (height - 6) - 3
    return [x, y] as const
  })
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaPath = `M0,${height} L${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')} L${width},${height} Z`

  const color = {
    primary: 'var(--n-chart-1)',
    success: 'var(--n-chart-2)',
    warning: 'var(--n-chart-3)',
    danger: 'var(--n-danger)',
  }[tone]
  const gradientId = `spark-${tone}-${width}-${data.length}`

  return (
    <svg
      width={sx(width)}
      height={sx(height)}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={areaPath} fill={`url(#${gradientId})`} />}
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pulse && (
        <>
          <circle cx={width} cy={points[points.length - 1]![1]} r="4" fill={color} opacity="0.25" />
          <circle cx={width} cy={points[points.length - 1]![1]} r="2" fill={color} />
        </>
      )}
    </svg>
  )
}

/* ------------------------------ 键位提示组 ------------------------------ */

export interface ShortcutHintProps {
  keys: string[]
  action?: ReactNode
  className?: string
}

/** 键位提示 · 帮助页与空态里的"怎么用"提示 */
export function ShortcutHint({ keys, action, className }: ShortcutHintProps) {
  return (
    <div className={cn('inline-flex items-center gap-2 text-2xs text-fg-3', className)}>
      <span className="inline-flex items-center gap-0.5">
        {keys.map((key) => (
          <kbd
            key={key}
            className="inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-[0.25rem] border border-line bg-surface-2 px-1 font-sans text-2xs font-medium text-fg-2"
          >
            {key}
          </kbd>
        ))}
      </span>
      {action && <span>{action}</span>}
    </div>
  )
}
