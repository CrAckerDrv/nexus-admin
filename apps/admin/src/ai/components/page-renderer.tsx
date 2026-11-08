import { useMemo } from 'react'
import type { PageBlock, PageSpec, ToneName } from '@nexus/ai-sdk'
import { cn, formatCompact, sx } from '@nexus/ui'
import { EChart, useChartTokens, type ChartOption } from '@/components/charts/echart'
import { ACCENT_PRESETS, useUiStore, type Accent } from '@/core/ui-store'

/**
 * 页面规格渲染器
 *
 * 唯一的「解释器」：PageSpec → DOM。对话框预览与正式路由页共用同一份实现，
 * 因此「预览看到的」和「上线后看到的」不存在第二套渲染路径。
 *
 * 安全与可控：
 * - 只认白名单区块类型，未知类型被静默跳过
 * - 样式来自设计令牌，不接受模型直接给颜色值
 * - 配色覆盖通过局部 CSS 变量实现，不影响外壳
 */

const TONE_TEXT: Record<ToneName, string> = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-fg-3',
}

const TONE_BG: Record<ToneName, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-fg-4',
}

const TONE_WEAK: Record<ToneName, string> = {
  primary: 'bg-primary-weak text-primary',
  success: 'bg-success-weak text-success',
  warning: 'bg-warning-weak text-warning',
  danger: 'bg-danger-weak text-danger',
  neutral: 'bg-surface-3 text-fg-3',
}

/** 副标题/说明文字在紧凑模式下统一压一行 */
const clamp = (compact: boolean, lines = 2) =>
  compact ? 'line-clamp-2' : lines === 1 ? 'truncate' : 'line-clamp-3'

export interface PageRendererProps {
  page: PageSpec
  /** 紧凑：用于对话气泡里的预览，压缩留白与图表高度 */
  compact?: boolean
  className?: string
  /** 只渲染前 N 个区块（面板预览用） */
  limit?: number
}

export function PageRenderer({ page, compact = false, className, limit }: PageRendererProps) {
  const blocks = limit ? page.blocks.slice(0, limit) : page.blocks
  const style = usePageThemeStyle(page)
  const tokens = useChartTokens()

  return (
    <div
      className={cn('space-y-3', compact && 'space-y-2.5', className)}
      style={style}
      data-density={page.theme.density}
      data-radius={page.theme.radius}
      data-page-surface={page.theme.surface ?? 'plain'}
    >
      {blocks.map((block, index) => (
        <BlockView key={`${page.id}-${index}`} block={block} compact={compact} tokens={tokens} />
      ))}
    </div>
  )
}

/** 页面级主题覆盖：配色 / 圆角 / 密度全部走局部变量 */
function usePageThemeStyle(page: PageSpec) {
  const resolvedTheme = useUiStore((state) => state.resolvedTheme)
  const accent = page.theme.accent as Accent | undefined

  return useMemo(() => {
    if (!accent || !ACCENT_PRESETS[accent]) return undefined
    const preset = ACCENT_PRESETS[accent]
    const primary = resolvedTheme === 'dark' ? preset.dark : preset.light
    const light = resolvedTheme === 'dark' ? preset.swatch[1] : preset.swatch[0]
    return {
      '--n-primary': primary,
      '--n-primary-hover': light,
      '--n-primary-weak':
        resolvedTheme === 'dark'
          ? `color-mix(in oklab, ${primary} 18%, transparent)`
          : `color-mix(in oklab, ${primary} 10%, transparent)`,
      '--n-primary-ring': `color-mix(in oklab, ${primary} 30%, transparent)`,
      '--n-chart-1': primary,
      '--n-info': primary,
    } as React.CSSProperties
  }, [accent, resolvedTheme])
}

function Section({
  title,
  description,
  extra,
  children,
  compact,
}: {
  title: string
  description?: string
  extra?: React.ReactNode
  children: React.ReactNode
  compact: boolean
}) {
  return (
    <section className="rounded-lg border border-line bg-surface">
      <header
        className={cn(
          'flex items-start justify-between gap-2 border-b border-line-subtle',
          compact ? 'px-3 py-2' : 'px-4 py-2.5',
        )}
      >
        <div className="min-w-0">
          <h3 className={cn('font-semibold text-fg', compact ? 'text-xs' : 'text-[0.8125rem]')}>
            {title}
          </h3>
          {description && (
            <p className={cn('mt-0.5 text-2xs text-fg-3', clamp(compact, 1))}>{description}</p>
          )}
        </div>
        {extra}
      </header>
      <div className={compact ? 'p-3' : 'p-4'}>{children}</div>
    </section>
  )
}

function BlockView({
  block,
  compact,
  tokens,
}: {
  block: PageBlock
  compact: boolean
  tokens: ReturnType<typeof useChartTokens>
}) {
  if (block.kind === 'kpi') {
    return (
      <div
        className={cn(
          'grid gap-2',
          block.items.length >= 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3',
        )}
      >
        {block.items.map((item, itemIndex) => (
          <div
            key={`${item.label}-${itemIndex}`}
            className="n-stagger rounded-lg border border-line bg-surface p-3"
            style={{ '--i': itemIndex } as React.CSSProperties}
          >
            <p className="truncate text-2xs text-fg-3">{item.label}</p>
            <p className="mt-1 flex items-baseline gap-1">
              <span
                className={cn(
                  'font-semibold tracking-tight text-fg tabular-nums',
                  compact ? 'text-lg' : 'text-[1.375rem] leading-7',
                )}
              >
                {item.value}
              </span>
              {item.suffix && <span className="text-2xs text-fg-3">{item.suffix}</span>}
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              {item.delta !== undefined && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 text-2xs font-medium tabular-nums',
                    item.delta >= 0 ? 'text-success' : 'text-danger',
                  )}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={cn('size-2.5', item.delta < 0 && 'rotate-180')}
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 4l7 11H5L12 4z" />
                  </svg>
                  {Math.abs(item.delta).toFixed(1)}%
                </span>
              )}
              {item.trend && <Sparkline data={item.trend} tone={item.tone ?? 'primary'} />}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (block.kind === 'chart') {
    const option = buildChartOption(block, tokens, compact)
    return (
      <Section title={block.title} description={block.description} compact={compact}>
        <EChart
          option={option}
          height={compact ? Math.min(block.height ?? 260, 200) : (block.height ?? 260)}
        />
      </Section>
    )
  }

  if (block.kind === 'table') {
    return (
      <Section
        title={block.title}
        description={block.description}
        compact={compact}
        extra={
          <span className="shrink-0 text-2xs text-fg-4 tabular-nums">{block.rows.length} 行</span>
        }
      >
        <div className="-mx-px overflow-x-auto">
          <table className="n-table min-w-full" data-hover="true">
            <thead>
              <tr>
                {block.columns.map((column) => (
                  <th
                    key={column.key}
                    className={cn(
                      'px-2.5 py-1.5 text-left font-semibold',
                      column.align === 'right' && 'text-right',
                    )}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.slice(0, compact ? 5 : block.rows.length).map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {block.columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-2.5 py-2 text-[0.8125rem] text-fg-2',
                        column.align === 'right' && 'n-num text-right tabular-nums',
                      )}
                    >
                      {formatCell(row[column.key], column.format)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {block.footer && <p className="mt-2 text-2xs text-fg-4">{block.footer}</p>}
        {compact && block.rows.length > 5 && (
          <p className="mt-1 text-2xs text-fg-4">还有 {block.rows.length - 5} 行…</p>
        )}
      </Section>
    )
  }

  if (block.kind === 'list') {
    return (
      <Section title={block.title} description={block.description} compact={compact}>
        <ul className="space-y-2">
          {block.items.slice(0, compact ? 4 : block.items.length).map((item, itemIndex) => (
            <li key={`${item.title}-${itemIndex}`} className="flex items-start gap-2">
              <span
                className={cn(
                  'mt-1 grid size-5 shrink-0 place-items-center rounded-md text-[0.625rem] font-semibold',
                  TONE_WEAK[item.tone ?? 'primary'],
                )}
              >
                {itemIndex + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[0.8125rem] text-fg">{item.title}</span>
                  {item.meta && (
                    <span className={cn('shrink-0 text-2xs', TONE_TEXT[item.tone ?? 'neutral'])}>
                      {item.meta}
                    </span>
                  )}
                </span>
                {item.description && (
                  <span className={cn('mt-0.5 block text-2xs leading-5 text-fg-3', clamp(compact))}>
                    {item.description}
                  </span>
                )}
                {item.progress !== undefined && (
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface-3">
                    <span
                      className={cn('block h-full rounded-full', TONE_BG[item.tone ?? 'primary'])}
                      style={{ width: `${Math.min(Math.max(item.progress, 0), 100)}%` }}
                    />
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Section>
    )
  }

  if (block.kind === 'progress') {
    return (
      <Section title={block.title} description={block.description} compact={compact}>
        <div className="space-y-2.5">
          {block.items.map((item) => {
            const percent = Math.min(
              Math.max((item.value / Math.max(item.max ?? 100, 1)) * 100, 0),
              100,
            )
            return (
              <div key={item.label}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs text-fg-2">{item.label}</span>
                  <span className="shrink-0 text-2xs text-fg-4 tabular-nums">
                    {item.hint ?? `${Math.round(percent)}%`}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width]',
                      TONE_BG[item.tone ?? 'primary'],
                    )}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </Section>
    )
  }

  if (block.kind === 'steps') {
    return (
      <Section title={block.title} description={block.description} compact={compact}>
        <ol className="space-y-2">
          {block.items.map((item, itemIndex) => {
            const status = item.status ?? (itemIndex === 0 ? 'done' : 'pending')
            return (
              <li key={`${item.title}-${itemIndex}`} className="flex items-start gap-2">
                <span
                  className={cn(
                    'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[0.625rem] font-semibold',
                    status === 'done' && 'bg-success-weak text-success',
                    status === 'current' && 'bg-primary-weak text-primary',
                    status === 'pending' && 'bg-surface-3 text-fg-4',
                  )}
                >
                  {status === 'done' ? '✓' : itemIndex + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.8125rem] text-fg">{item.title}</span>
                  {item.description && (
                    <span className="mt-0.5 block text-2xs leading-5 text-fg-3">
                      {item.description}
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ol>
      </Section>
    )
  }

  // text
  return (
    <section
      className={cn(
        'rounded-lg border border-line bg-surface',
        compact ? 'px-3 py-2.5' : 'px-4 py-3.5',
      )}
    >
      {block.title && (
        <h3 className={cn('mb-1 font-semibold text-fg', compact ? 'text-xs' : 'text-[0.8125rem]')}>
          {block.title}
        </h3>
      )}
      <p className="text-xs leading-6 whitespace-pre-line text-fg-2">{block.body}</p>
    </section>
  )
}

function Sparkline({ data, tone }: { data: number[]; tone: ToneName }) {
  if (data.length < 2) return null
  const width = 56
  const height = 18
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const step = width / (data.length - 1)
  const points = data
    .map(
      (value, index) =>
        `${(index * step).toFixed(1)},${(height - ((value - min) / span) * (height - 3) - 1.5).toFixed(1)}`,
    )
    .join(' ')
  const stroke = {
    primary: 'var(--n-primary)',
    success: 'var(--n-success)',
    warning: 'var(--n-warning)',
    danger: 'var(--n-danger)',
    neutral: 'var(--n-fg-3)',
  }[tone]
  return (
    <svg
      width={sx(width)}
      height={sx(height)}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function formatCell(value: string | number | undefined, format?: string) {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'number') {
    if (format === 'currency') return `¥${value.toLocaleString('zh-CN')}`
    if (format === 'percent') return `${value}%`
    if (format === 'number') return value.toLocaleString('zh-CN')
    return formatCompact(value)
  }
  return value
}

/** 图表区块 → ECharts option（颜色全部取自已解析的主题令牌） */
function buildChartOption(
  block: Extract<PageBlock, { kind: 'chart' }>,
  tokens: ReturnType<typeof useChartTokens>,
  compact: boolean,
): ChartOption {
  const isPie = block.variant === 'pie' || block.variant === 'donut'
  const palette = tokens.chart
  const unit = block.unit ?? ''

  if (isPie) {
    const values = block.series[0]?.data ?? []
    return {
      grid: { containLabel: compact },
      tooltip: {
        trigger: 'item',
        valueFormatter: (value: number) => `${value}${unit}`,
      },
      legend: {
        bottom: 0,
        icon: 'roundRect',
        itemWidth: 8,
        itemHeight: 8,
        itemGap: compact ? 10 : 16,
        textStyle: { fontSize: 11, color: tokens.fg3 },
      },
      series: [
        {
          type: 'pie',
          radius: block.variant === 'donut' ? ['46%', '68%'] : '62%',
          center: ['50%', compact ? '44%' : '46%'],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: tokens.surface, borderWidth: 2 },
          label: { show: false },
          data: block.categories.map((name, index) => ({
            name,
            value: values[index] ?? 0,
            itemStyle: { color: palette[index % palette.length] },
          })),
        },
      ],
    }
  }

  const isBar = block.variant === 'bar'
  return {
    grid: {
      left: 4,
      right: 8,
      top: block.series.length > 1 ? 30 : 12,
      bottom: 2,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number) => `${formatCompact(Number(value))}${unit}`,
    },
    legend:
      block.series.length > 1
        ? {
            top: 0,
            right: 4,
            icon: 'roundRect',
            itemWidth: 8,
            itemHeight: 8,
            itemGap: 12,
            textStyle: { fontSize: 11, color: tokens.fg2 },
          }
        : undefined,
    xAxis: {
      type: 'category',
      boundaryGap: isBar,
      data: block.categories,
      axisLine: { lineStyle: { color: tokens.grid } },
      axisTick: { show: false },
      axisLabel: { color: tokens.fg3, fontSize: 10, hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: tokens.fg4,
        fontSize: 10,
        formatter: (value: number) => formatCompact(value),
      },
      splitLine: { lineStyle: { color: tokens.gridSubtle, type: 'dashed' } },
    },
    series: block.series.map((item, index) => ({
      name: item.name,
      type: isBar ? 'bar' : 'line',
      smooth: !isBar,
      symbol: 'circle',
      symbolSize: compact ? 4 : 5,
      showSymbol: false,
      barMaxWidth: 26,
      itemStyle: {
        color: palette[index % palette.length],
        borderRadius: isBar ? [4, 4, 0, 0] : 0,
      },
      lineStyle: isBar ? undefined : { width: 2 },
      areaStyle:
        block.variant === 'area'
          ? {
              opacity: 0.16,
              color: palette[index % palette.length],
            }
          : undefined,
      data: item.data,
    })),
  }
}
