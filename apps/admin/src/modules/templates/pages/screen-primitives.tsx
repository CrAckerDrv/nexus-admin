import { useEffect, useState, type ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Maximize2, Minimize2, RefreshCw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AnimatedNumber, cn } from '@nexus/ui'

/**
 * 大屏共用原语
 *
 * 八块大屏（运营 / 运维 / 财务 / 仓储 / 城市 / 制造 / 大促 / 算力）共享同一组结构件，
 * 只把「配色令牌」作为参数传进来 —— 这样风格差异只体现在颜色与图表，
 * 排版节奏、字号层级、间距纪律保持一致，不会出现「八块屏八种手感」。
 */

export interface ScreenTokens {
  /** 页面底色 */
  bg: string
  /** 次级底色（卡片 / 表头） */
  bgSoft: string
  /** 发丝线 */
  line: string
  /** 更淡的分隔线 */
  lineSoft: string
  /** 主文本 */
  fg: string
  /** 次级文本 */
  fg2: string
  /** 辅助文本 */
  fg3: string
  /** 最弱文本（标签） */
  fg4: string
  /** 主强调色 */
  accent: string
  /** 辅强调色 */
  accent2: string
  /** 正向（涨 / 健康） */
  up: string
  /** 负向（跌 / 异常） */
  down: string
  /** 警示 */
  warn: string
}

/** 页面外壳：底色 + 顶部光晕 + 最大宽度约束 */
export function ScreenShell({
  tokens,
  children,
  glow,
}: {
  tokens: ScreenTokens
  children: ReactNode
  /** 顶部光晕颜色（默认取强调色） */
  glow?: string
}) {
  return (
    <div
      className="relative min-h-dvh w-full"
      style={{
        backgroundColor: tokens.bg,
        color: tokens.fg,
        backgroundImage: `radial-gradient(ellipse 58% 40% at 50% -12%, ${glow ?? `${tokens.accent}18`}, transparent 70%)`,
      }}
    >
      <div className="mx-auto w-full max-w-[105rem] px-5 pt-4 pb-3 xl:px-8">{children}</div>
    </div>
  )
}

/** 顶栏：标题 + 状态点 + 时钟 + 操作 */
export function ScreenHeader({
  tokens,
  title,
  meta,
  actions,
  pulse = true,
}: {
  tokens: ScreenTokens
  title: string
  meta?: ReactNode
  actions?: ReactNode
  pulse?: boolean
}) {
  return (
    <header
      className="flex flex-wrap items-center gap-4 border-b pb-3"
      style={{ borderColor: tokens.line }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {pulse && (
          <span className="relative flex size-1.5">
            <span
              className="absolute inline-flex size-full animate-ping rounded-full opacity-60"
              style={{ backgroundColor: tokens.up }}
            />
            <span
              className="relative inline-flex size-1.5 rounded-full"
              style={{ backgroundColor: tokens.up }}
            />
          </span>
        )}
        <h1
          className="truncate text-[0.8125rem] font-medium tracking-[0.18em]"
          style={{ color: tokens.fg }}
        >
          {title}
        </h1>
        {meta}
      </div>
      {actions && (
        <div className="ml-auto flex shrink-0 items-center gap-3 text-[0.6875rem]">{actions}</div>
      )}
    </header>
  )
}

/** 页头操作按钮 */
export function HeaderAction({
  tokens,
  icon: Icon,
  label,
  onClick,
  spinning,
}: {
  tokens: ScreenTokens
  icon: LucideIcon
  label: string
  onClick: () => void
  spinning?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-white/5"
      style={{ color: tokens.fg2 }}
    >
      <Icon className={cn('size-3', spinning && 'animate-spin')} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

/** 刷新按钮（自带转圈状态，页面不必各自维护 refreshing） */
export function RefreshAction({ tokens }: { tokens: ScreenTokens }) {
  const [refreshing, refresh] = useRefresh()
  return (
    <HeaderAction
      tokens={tokens}
      icon={RefreshCw}
      label="刷新"
      onClick={refresh}
      spinning={refreshing}
    />
  )
}

/** 全屏切换：图标与文案跟随当前状态 */
export function FullscreenAction({ tokens }: { tokens: ScreenTokens }) {
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  return (
    <HeaderAction
      tokens={tokens}
      icon={fullscreen ? Minimize2 : Maximize2}
      label={fullscreen ? '退出' : '全屏'}
      onClick={() => {
        if (document.fullscreenElement) void document.exitFullscreen()
        else void document.documentElement.requestFullscreen()
      }}
    />
  )
}

/** 区块：发丝线分隔，不做卡片盒子 */
export function Panel({
  tokens,
  title,
  extra,
  children,
  className,
  bodyClassName,
}: {
  tokens: ScreenTokens
  title: ReactNode
  extra?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn('flex min-w-0 flex-col', className)}>
      <header className="flex items-center gap-2 pb-2.5">
        <h2
          className="text-[0.6875rem] font-medium tracking-[0.14em] uppercase"
          style={{ color: tokens.fg2 }}
        >
          {title}
        </h2>
        {extra && <div className="ml-auto flex shrink-0 items-center gap-2">{extra}</div>}
      </header>
      <div className={cn('min-h-0 flex-1', bodyClassName)}>{children}</div>
    </section>
  )
}

/** 百分比变化 */
export function Delta({
  tokens,
  value,
  suffix = '%',
  invert = false,
  className,
}: {
  tokens: ScreenTokens
  value: number
  suffix?: string
  /** 反指标：下降是好事（成本 / 延迟 / 告警 / 故障） */
  invert?: boolean
  className?: string
}) {
  const up = value >= 0
  const good = invert ? !up : up
  return (
    <span
      className={cn('inline-flex items-center gap-0.5 text-[0.6875rem] tabular-nums', className)}
      style={{ color: good ? tokens.up : tokens.down }}
    >
      {up ? (
        <ArrowUpRight className="size-3" strokeWidth={2} />
      ) : (
        <ArrowDownRight className="size-3" strokeWidth={2} />
      )}
      {Math.abs(value).toFixed(2)}
      {suffix}
    </span>
  )
}

/** 弱标签 */
export function Label({ tokens, children }: { tokens: ScreenTokens; children: ReactNode }) {
  return (
    <span className="text-[0.6875rem] tracking-wide" style={{ color: tokens.fg4 }}>
      {children}
    </span>
  )
}

/**
 * 大屏数字 · 统一走 `AnimatedNumber`
 *
 * 大屏的指标全是字符串（`'1,284,600'`、`'99.99%'`、`'412 / 448'`），
 * 直接渲染等于放弃了「开启动效后数字递增滚动」这一条 —— 而大屏恰恰是最需要它的场景。
 * 这里把字符串拆成 `数值 + 前后缀`：能解析的走滚动，解析不了的原样输出，
 * 保证「加动效」不会把 `18:00`、`-0.34pt` 这类非数值文本改成 0。
 *
 * 三种写法各自说明为什么不能统一：
 * - `1,284,600`   → 纯数值，`decimals` 由调用方给（多数是 0）
 * - `99.99%`      → 数值 + 后缀百分号，单位独立成小号字
 * - `412 / 448`   → 比值，两侧都要滚（各滚各的，不强行合成一个数）
 */
export function ScreenNumber({
  value,
  duration,
  className,
  unitClassName,
  style,
}: {
  value: string | number
  duration?: number
  className?: string
  unitClassName?: string
  style?: React.CSSProperties
}) {
  const raw = typeof value === 'number' ? String(value) : value
  /**
   * 传 number 时按「人读的金额/数量」处理：默认带千分位。
   * 传字符串时保留原串里的千分位习惯 —— 大屏上的 `42`（台）不该被写成 `42`，
   * 而 `8,527,638` 也不该滚着滚着变成 `8527638`。
   */
  const parts: NumberPart[] =
    typeof value === 'number'
      ? [
          {
            text: raw,
            number: value,
            decimals: countDecimals(value),
            separator: true,
          },
        ]
      : splitNumeric(raw)
  return (
    <span className={cn('tabular-nums', className)} style={style}>
      {parts.map((part, index) =>
        part.number === null ? (
          <span key={`${part.text}-${index}`} className={unitClassName}>
            {part.text}
          </span>
        ) : (
          <AnimatedNumber
            key={`n-${index}`}
            value={part.number}
            decimals={part.decimals}
            duration={duration}
            separator={part.separator}
          />
        ),
      )}
    </span>
  )
}

interface NumberPart {
  /** 无法解析为数字的文本片段（如 ` / `、`%`、`ms`） */
  text: string
  number: number | null
  /** 小数位：由原字符串推断，保证 `99.99%` 滚动时不会先在屏幕上显示 99% 再跳成 99.99% */
  decimals: number
  /** 原串是否带千分位：不带就按原样显示，避免「42」滚成「42」却出现 `4,2` 这种中间帧 */
  separator: boolean
}

const plainText = (text: string): NumberPart => ({
  text,
  number: null,
  decimals: 0,
  separator: false,
})

/** 数字的小数位（`1284` → 0，`92.4` → 1，`1.2e-7` 这类极小值兜底 6 位） */
function countDecimals(value: number): number {
  const text = String(value)
  if (text.includes('e-')) return 6
  const [, frac] = text.split('.')
  return frac?.length ?? 0
}

/**
 * 把 `'412 / 448'`、`'99.99%'`、`'¥8,527,638'` 拆成可滚动的数值片段
 *
 * 规则很简单：整体能当作带千分位的数字就整体滚；
 * 否则按「数字串 / 非数字串」交替切开，数字串单独滚。
 */
function splitNumeric(raw: string): NumberPart[] {
  const asNumber = parseNumeric(raw)
  if (asNumber) return [{ text: raw, number: asNumber.value, ...asNumber.meta }]

  const parts: NumberPart[] = []
  const pattern = /-?\d[\d,]*(?:\.\d+)?/g
  let cursor = 0
  for (const match of raw.matchAll(pattern)) {
    const start = match.index ?? 0
    if (start > cursor) parts.push(plainText(raw.slice(cursor, start)))
    const meta = parseNumeric(match[0])
    parts.push(meta ? { text: match[0], number: meta.value, ...meta.meta } : plainText(match[0]))
    cursor = start + match[0].length
  }
  if (cursor < raw.length) parts.push(plainText(raw.slice(cursor)))
  return parts.length > 0 ? parts : [plainText(raw)]
}

/** 单个数字串 → 数值 + 展示元信息（小数位、是否千分位） */
function parseNumeric(
  text: string,
): { value: number; meta: { decimals: number; separator: boolean } } | null {
  const trimmed = text.trim()
  if (!/^-?\d[\d,]*(\.\d+)?$/.test(trimmed)) return null
  const value = Number(trimmed.replace(/,/g, ''))
  if (!Number.isFinite(value)) return null
  const decimals = trimmed.includes('.') ? (trimmed.split('.')[1]?.length ?? 0) : 0
  return { value, meta: { decimals, separator: trimmed.includes(',') } }
}

/** 迷你横向条 */
export function Bar({
  tokens,
  ratio,
  tone,
  height = 3,
}: {
  tokens: ScreenTokens
  ratio: number
  tone?: string
  height?: number
}) {
  return (
    <span
      className="block w-full overflow-hidden rounded-full"
      style={{ height, backgroundColor: tokens.lineSoft }}
    >
      <span
        className="block h-full rounded-full"
        style={{
          width: `${Math.max(2, Math.min(100, ratio * 100))}%`,
          backgroundColor: tone ?? tokens.accent,
          opacity: 0.85,
        }}
      />
    </span>
  )
}

/** 分段切换（1h / 6h / 24h 这类） */
export function Segmented<T extends string>({
  tokens,
  value,
  options,
  onChange,
  label,
}: {
  tokens: ScreenTokens
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (value: T) => void
  label?: string
}) {
  return (
    <span className="flex items-center gap-1" role="group" aria-label={label}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className="rounded px-1.5 py-0.5 text-[0.625rem] transition-colors"
            style={{
              color: active ? tokens.fg : tokens.fg4,
              backgroundColor: active ? `${tokens.accent}1f` : 'transparent',
            }}
          >
            {option.label}
          </button>
        )
      })}
    </span>
  )
}

/** 图例小圆点 */
export function Dot({ color, size = 6 }: { color: string; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, backgroundColor: color }}
      aria-hidden="true"
    />
  )
}

/**
 * 时钟 Hook
 *
 * 单独抽出来是因为所有大屏都要它，而 setInterval 的清理很容易漏。
 */
export function useClock(): string {
  const [clock, setClock] = useState('')

  useEffect(() => {
    const update = () => {
      const now = new Date()
      const pad = (value: number) => String(value).padStart(2, '0')
      const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()]
      setClock(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}  ${week}`)
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [])

  return clock
}

/** 刷新状态（按钮转圈用） */
export function useRefresh(): [boolean, () => void] {
  const [refreshing, setRefreshing] = useState(false)
  return [
    refreshing,
    () => {
      setRefreshing(true)
      setTimeout(() => setRefreshing(false), 700)
    },
  ]
}

/**
 * 「假实时」采集点
 *
 * 每隔 `interval` 毫秒往尾部推一个新样本、丢掉最早的样本，
 * 折线形状随时间缓慢变化 —— 投屏时看得出在动，但不会跳变。
 * 真实接入时把这里换成 WebSocket 订阅即可，渲染路径不用改。
 */
export function useLiveSeries(
  initial: number[],
  options: { interval?: number; drift?: number; floor?: number } = {},
): number[] {
  const { interval = 2000, drift = 0.02, floor = 0 } = options
  const [series, setSeries] = useState(initial)

  useEffect(() => {
    const timer = setInterval(() => {
      setSeries((prev) => {
        const last = prev[prev.length - 1] ?? floor
        const delta = (Math.random() - 0.45) * drift * Math.max(last, 1)
        const next = Math.max(floor, Math.round(last + delta))
        return [...prev.slice(1), next]
      })
    }, interval)
    return () => clearInterval(timer)
  }, [interval, drift, floor])

  return series
}
