import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleDollarSign,
  Download,
  Gauge,
  Plus,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Target,
  TriangleAlert,
  UserPlus,
  Users,
} from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  PageContainer,
  PageHeader,
  Progress,
  RingMetric,
  SectionCard,
  Skeleton,
  SlidingTabs,
  Tooltip,
  cn,
  formatCompact,
  formatRelativeTime,
  toast,
} from '@nexus/ui'
import { EChart, useChartTokens } from '@/components/charts/echart'
import { AppLink, useAppNavigate } from '@/components/app-link'
import { KpiTile } from '../components/kpi-tile'
import { WelcomeBanner } from '../components/welcome-banner'
import { MONTHLY_GOALS, goalPercent, goalTone } from '../components/goal-meta'
import {
  useActivities,
  useChannels,
  useFunnel,
  useOverviewMetrics,
  useTodos,
  useTrends,
} from '@/services/queries'
import type { ActivityItem, TodoItem } from '@/types/domain'

/**
 * 经营概览
 *
 * 版面按「一眼看结论 → 再看趋势 → 最后看细节」的三段落铺开：
 * 1. KPI 行：四个核心指标（数值 + 环比 + 迷你趋势）
 * 2. 主区：交易趋势（双轴面积折线）+ 本月目标（环形达成 + 分项进度）
 * 3. 细节区：转化漏斗 / 流量来源 / 团队动态 / 待办 / 容量
 * 4. 收尾：关于项目（把「这是个模板」的信息集中到一处，不打扰主数据流）
 *
 * 性能约定（与项目既有架构一致）：
 * - 所有 ECharts option 走 useMemo，主题令牌变化才重算
 * - 图表库仍由 EChart 内部空闲时动态加载，首屏不拉 600+ kB
 * - 目标达成、漏斗百分比等派生数据全部 useMemo，渲染期不算数
 */

type Range = '7d' | '30d' | '90d'

const RANGE_ITEMS = [
  { value: '7d' as const, label: '7 天' },
  { value: '30d' as const, label: '30 天' },
  { value: '90d' as const, label: '90 天' },
]

const KPI_META: Record<
  string,
  { icon: ReactNode; decimals: number; prefix?: string; suffix?: string }
> = {
  revenue: {
    icon: <CircleDollarSign className="size-[1.125rem]" strokeWidth={1.9} />,
    decimals: 0,
    prefix: '¥ ',
  },
  users: { icon: <Users className="size-[1.125rem]" strokeWidth={1.9} />, decimals: 0 },
  orders: { icon: <ShoppingCart className="size-[1.125rem]" strokeWidth={1.9} />, decimals: 0 },
  conversion: {
    icon: <ArrowUpRight className="size-[1.125rem]" strokeWidth={2.1} />,
    decimals: 2,
    suffix: '%',
  },
}

export default function OverviewPage() {
  const [range, setRange] = useState<Range>('30d')
  const metrics = useOverviewMetrics()
  const trends = useTrends(range)
  const channels = useChannels()
  const funnel = useFunnel()
  const todos = useTodos()
  const activities = useActivities()
  const navigate = useAppNavigate()
  // Canvas 无法解析 var(--x)，必须传入解析后的具体色值
  const tokens = useChartTokens()

  /* ---------------------------- 交易趋势 ---------------------------- */
  const trendOption = useMemo(() => {
    const data = trends.data ?? []
    const revenue = data.map((item) => item.revenue)
    const average = revenue.length
      ? Math.round(revenue.reduce((sum, value) => sum + value, 0) / revenue.length)
      : 0

    return {
      grid: { left: 4, right: 8, top: 34, bottom: 2, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { type: 'dashed', color: tokens.grid } },
        valueFormatter: (value: number) => formatCompact(Number(value)),
      },
      legend: {
        top: 0,
        right: 4,
        icon: 'roundRect',
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 14,
        textStyle: { fontSize: 11, color: tokens.fg2 },
        data: ['交易额', '订单量'],
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.map((item) => item.date),
        axisLine: { lineStyle: { color: tokens.grid } },
        axisTick: { show: false },
        axisLabel: {
          color: tokens.fg3,
          fontSize: 10,
          interval: Math.max(0, Math.floor(data.length / 8) - 1),
        },
      },
      yAxis: [
        {
          type: 'value',
          splitLine: { lineStyle: { color: tokens.gridSubtle, type: 'dashed' } },
          axisLabel: {
            color: tokens.fg3,
            fontSize: 10,
            formatter: (value: number) => formatCompact(value),
          },
        },
        {
          type: 'value',
          splitLine: { show: false },
          axisLabel: {
            color: tokens.fg3,
            fontSize: 10,
            formatter: (value: number) => formatCompact(value),
          },
        },
      ],
      series: [
        {
          name: '交易额',
          type: 'line',
          smooth: 0.35,
          symbol: 'circle',
          symbolSize: 5,
          showSymbol: false,
          lineStyle: { width: 2.2, color: tokens.chart[0] },
          itemStyle: { color: tokens.chart[0] },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${tokens.chart[0]}59` },
                { offset: 1, color: `${tokens.chart[0]}00` },
              ],
            },
          },
          // 均值参考线：比「只看曲线」更容易判断这段区间是好是坏
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: tokens.fg4, type: 'dashed', width: 1 },
            label: {
              formatter: `日均 ${formatCompact(average)}`,
              position: 'insideStartTop',
              color: tokens.fg3,
              fontSize: 10,
              distance: 4,
              // 加一层同底色衬底：压在网格线上时不至于看不清
              backgroundColor: tokens.surface,
              padding: [2, 4],
              borderRadius: 3,
            },
            data: [{ yAxis: average }],
          },
          data: revenue,
        },
        {
          name: '订单量',
          type: 'line',
          yAxisIndex: 1,
          smooth: 0.35,
          symbol: 'circle',
          symbolSize: 5,
          showSymbol: false,
          lineStyle: { width: 1.6, type: 'dashed', color: tokens.chart[1] },
          itemStyle: { color: tokens.chart[1] },
          data: data.map((item) => item.orders),
        },
      ],
    }
  }, [trends.data, tokens])

  /* ---------------------------- 本月目标 ---------------------------- */
  const goals = useMemo(() => {
    const find = (key: string) => metrics.data?.find((item) => item.key === key)?.value ?? 0
    const rows = MONTHLY_GOALS.map((row) => ({
      ...row,
      current: find(row.key),
      percent: goalPercent(find(row.key), row.target),
    }))
    const head = rows[0]
    return {
      rows,
      percent: head?.percent ?? 0,
      current: head?.current ?? 0,
      target: head?.target ?? 0,
    }
  }, [metrics.data])

  /* ---------------------------- 转化漏斗 ---------------------------- */
  const funnelOption = useMemo(() => {
    const data = funnel.data ?? []
    // 漏斗图从大到小自上而下，色阶用品牌色到图表色的渐变
    const palette = [
      tokens.chart[0],
      tokens.chart[5],
      tokens.chart[3],
      tokens.chart[2],
      tokens.chart[1],
    ]
    return {
      tooltip: { trigger: 'item', formatter: '{b}<br/><b>{c}%</b> 相对首层' },
      series: [
        {
          type: 'funnel',
          left: 6,
          right: 6,
          top: 10,
          bottom: 10,
          minSize: '28%',
          maxSize: '100%',
          sort: 'descending',
          gap: 3,
          label: {
            show: true,
            position: 'inside',
            color: '#fff',
            fontSize: 11,
            fontWeight: 500,
            // 只显示阶段名会被问「占比多少」——把百分比直接印在色块里
            formatter: '{b} · {c}%',
          },
          labelLine: { show: false },
          itemStyle: { borderWidth: 0 },
          emphasis: { label: { fontSize: 12 } },
          data: data.map((item, index) => ({
            name: item.stage,
            value: item.value,
            itemStyle: { color: palette[index % palette.length] },
          })),
        },
      ],
    }
  }, [funnel.data, tokens])

  /* ---------------------------- 流量来源 ---------------------------- */
  const channelOption = useMemo(() => {
    const data = channels.data ?? []
    // 渠道数据本身就是百分比，中心位置放「第一大来源」比放 100% 更有信息量
    const top = [...data].sort((a, b) => b.value - a.value)[0]
    return {
      tooltip: { trigger: 'item', formatter: '{b}<br/><b>{c}%</b>' },
      series: [
        {
          type: 'pie',
          radius: ['62%', '86%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          padAngle: 2,
          itemStyle: {
            borderRadius: 4,
            borderColor: tokens.surface,
            borderWidth: 2,
          },
          label: {
            show: true,
            position: 'center',
            formatter: `{a|${top ? `${top.value}%` : '—'}}\n{b|${top?.name ?? '暂无'}}`,
            rich: {
              a: { fontSize: 20, fontWeight: 600, color: tokens.fg, lineHeight: 26 },
              b: { fontSize: 11, color: tokens.fg3, lineHeight: 16 },
            },
          },
          labelLine: { show: false },
          emphasis: { scaleSize: 5, label: { show: false } },
          data: data.map((item) => ({ name: item.name, value: item.value })),
        },
      ],
    }
  }, [channels.data, tokens])

  const activeTodos = todos.data?.filter((item) => !item.done).length ?? 0

  return (
    <PageContainer size="lg">
      <PageHeader
        title="经营概览"
        description="实时追踪交易、用户与转化表现，数据每 30 秒自动刷新。"
        badge={
          <Badge tone="success" variant="soft" dot>
            运行正常
          </Badge>
        }
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={
                <RefreshCw className={cn('size-3.5', metrics.isFetching && 'animate-spin')} />
              }
              onClick={() => {
                void metrics.refetch()
                void trends.refetch()
                toast.success('数据已刷新')
              }}
            >
              刷新
            </Button>
            <Button
              variant="secondary"
              leftIcon={<Download className="size-3.5" />}
              onClick={() => toast.success('导出任务已创建（演示）')}
            >
              导出报表
            </Button>
            <Button
              variant="primary"
              leftIcon={<Plus className="size-3.5" />}
              onClick={() => navigate('/business/users')}
            >
              新建用户
            </Button>
          </>
        }
      />

      {/* ------------------------- 娆㈣繋妯箙 -------------------------
          认人 + 报今天，先于人后于数的第一屏信息 */}
      <WelcomeBanner />

      {/* ---------------------------- KPI 行 ---------------------------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[8.5rem] rounded-lg" />
            ))
          : metrics.data?.map((metric, index) => (
              <KpiTile
                key={metric.key}
                index={index}
                label={metric.label}
                value={metric.value}
                decimals={KPI_META[metric.key]?.decimals ?? 0}
                prefix={KPI_META[metric.key]?.prefix}
                suffix={
                  KPI_META[metric.key]?.suffix ??
                  (metric.unit && metric.unit !== '元' ? metric.unit : undefined)
                }
                delta={metric.delta}
                deltaLabel="较上月"
                trend={metric.trend}
                tone={metric.tone}
                icon={KPI_META[metric.key]?.icon}
                live={metric.key === 'revenue'}
              />
            ))}
      </div>

      {/* ------------------------- 趋势 + 目标 ------------------------- */}
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <SectionCard
          title="交易趋势"
          description="交易额与订单量双轴对比，虚线为区间日均"
          extra={
            <div className="flex items-center gap-2">
              <SlidingTabs
                size="sm"
                items={RANGE_ITEMS}
                value={range}
                onChange={(value) => setRange(value)}
              />
              <Tooltip content="按日聚合，含退款冲抵">
                <span className="grid size-6 place-items-center rounded-sm text-fg-4 transition-colors hover:bg-surface-2 hover:text-fg-2">
                  <CalendarDays className="size-3.5" />
                </span>
              </Tooltip>
            </div>
          }
          bodyClassName="px-2 pb-2 pt-3"
        >
          <EChart option={trendOption} height={306} loading={trends.isLoading} />
        </SectionCard>

        <SectionCard
          title="本月目标"
          description="按当前节奏推算的达成情况"
          extra={
            <Tooltip content="进度 = 已完成 / 月度目标">
              <span className="grid size-6 place-items-center rounded-sm text-fg-4">
                <Target className="size-3.5" />
              </span>
            </Tooltip>
          }
          bodyClassName="px-4 pb-4 pt-1"
        >
          {metrics.isLoading ? (
            <Skeleton className="mt-3 h-[18.75rem] rounded-md" />
          ) : (
            <>
              <div className="flex justify-center pt-2">
                <RingMetric
                  value={goals.percent}
                  size={132}
                  stroke={11}
                  tone={goalTone(goals.percent)}
                  label={`${goals.percent.toFixed(1)}%`}
                  sublabel={`目标 ¥${formatCompact(goals.target)}`}
                />
              </div>
              <div className="mt-4 space-y-3">
                {goals.rows.map((row) => (
                  <div key={row.key}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                      <span className="text-fg-2">{row.label}</span>
                      <span className="text-fg-3 tabular-nums">
                        <span className="font-medium text-fg">{formatCompact(row.current)}</span>
                        <span className="mx-0.5 text-fg-4">/</span>
                        {formatCompact(row.target)}
                      </span>
                    </div>
                    <Progress value={row.percent} size="sm" tone={goalTone(row.percent)} />
                  </div>
                ))}
              </div>
              <p className="mt-3 flex items-center gap-1.5 rounded-md border border-dashed border-line px-2.5 py-1.5 text-2xs text-fg-3">
                <Gauge className="size-3.5 shrink-0 text-primary" />
                距离月末还有 9 天，按当前速率预计达成 98.6%
              </p>
            </>
          )}
        </SectionCard>
      </div>

      {/* ------------------- 漏斗 / 渠道 / 动态 ------------------- */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <SectionCard
          title="转化漏斗"
          description="从访问到付费的关键环节"
          bodyClassName="px-2 py-2"
        >
          <EChart option={funnelOption} height={238} loading={funnel.isLoading} />
        </SectionCard>

        <SectionCard title="流量来源" description="近 30 天渠道占比" bodyClassName="px-4 py-2">
          {channels.isLoading ? (
            <Skeleton className="h-[14.875rem] rounded-md" />
          ) : (
            <>
              <EChart option={channelOption} height={148} />
              <ul className="mt-1 space-y-1.5">
                {channels.data?.map((item, index) => (
                  <li key={item.name} className="flex items-center gap-2 text-xs">
                    <span
                      aria-hidden="true"
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: `var(--n-chart-${(index % 6) + 1})` }}
                    />
                    <span className="min-w-0 flex-1 truncate text-fg-2">{item.name}</span>
                    {/* 渠道 value 已是占比，直接当百分比条用 */}
                    <span className="w-14 shrink-0">
                      <Progress
                        value={item.value}
                        size="xs"
                        tone={index === 0 ? 'primary' : index === 1 ? 'success' : 'warning'}
                      />
                    </span>
                    <span className="w-9 shrink-0 text-right font-medium text-fg tabular-nums">
                      {item.value}%
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </SectionCard>

        <SectionCard
          title="团队动态"
          description="成员操作实时流"
          className="lg:col-span-2 xl:col-span-1"
          extra={
            <Button variant="text" size="xs" rightIcon={<ArrowRight className="size-3" />}>
              全部
            </Button>
          }
          bodyClassName="px-4 pb-3"
        >
          <ActivityList items={activities.data ?? []} loading={activities.isLoading} />
        </SectionCard>
      </div>

      {/* ------------------- 待办 / 容量 ------------------- */}
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <SectionCard
          title="我的待办"
          description={`${activeTodos} 项待处理`}
          extra={
            <Button
              variant="text"
              size="xs"
              rightIcon={<ArrowRight className="size-3" />}
              onClick={() => navigate('/business/orders')}
            >
              全部
            </Button>
          }
          bodyClassName="px-4 pb-3"
        >
          <TodoList items={todos.data ?? []} loading={todos.isLoading} />
        </SectionCard>

        <SectionCard
          title="容量与配额"
          description="本月资源使用情况"
          bodyClassName="px-4 pb-4 pt-2"
        >
          <div className="flex h-full flex-col">
            {/* 四档配额保持统一节奏，剩余空间留给底部的重置说明，
                而不是用 justify-between 把条目拉开（那会让每行的间距都不一致） */}
            <div className="space-y-4">
              {[
                {
                  label: 'API 调用量',
                  value: 78,
                  unit: '780 万 / 1000 万',
                  tone: 'primary' as const,
                },
                { label: '存储空间', value: 46, unit: '460 GB / 1 TB', tone: 'success' as const },
                { label: '并发连接', value: 92, unit: '1,840 / 2,000', tone: 'danger' as const },
                { label: '团队成员席位', value: 61, unit: '488 / 800', tone: 'warning' as const },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
                    <span className="text-fg-2">{item.label}</span>
                    <span className="text-fg-3 tabular-nums">{item.unit}</span>
                  </div>
                  <Progress value={item.value} tone={item.tone} size="md" />
                </div>
              ))}
            </div>

            <div className="mt-auto pt-4">
              <div className="flex items-start gap-2 rounded-md border border-dashed border-line px-2.5 py-2 text-2xs leading-4 text-fg-3">
                <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning" />
                <span>
                  并发连接已用到 <strong className="font-semibold text-fg-2">92%</strong>
                  ，建议在高峰期前扩容，配额每月 1 日重置。
                </span>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <AboutBanner onNavigate={navigate} />
    </PageContainer>
  )
}

/* ------------------------------------------------------------------ *
 * 待办
 * ------------------------------------------------------------------ */
function TodoList({ items, loading }: { items: TodoItem[]; loading?: boolean }) {
  const [done, setDone] = useState<Record<string, boolean>>({})

  if (loading) {
    return (
      <div className="space-y-2 pt-1">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-11 rounded-md" />
        ))}
      </div>
    )
  }

  if (items.length === 0) return <EmptyState size="sm" title="没有待办事项" />

  return (
    <ul className="divide-y divide-line-subtle">
      {items.slice(0, 5).map((item) => {
        const checked = done[item.id] ?? item.done
        return (
          <li key={item.id} className="flex items-start gap-2.5 py-2.5 first:pt-1 last:pb-0">
            <button
              type="button"
              aria-label={checked ? '标记为未完成' : '标记为已完成'}
              onClick={() => setDone((prev) => ({ ...prev, [item.id]: !checked }))}
              className={cn(
                'mt-0.5 grid size-4 shrink-0 place-items-center rounded-[0.25rem] border transition-colors',
                checked
                  ? 'border-primary bg-primary text-primary-fg'
                  : 'border-line-strong hover:border-primary',
              )}
            >
              {checked && <Check className="size-2.5" strokeWidth={3} />}
            </button>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'truncate text-[0.8125rem] transition-colors',
                  checked ? 'text-fg-4 line-through' : 'text-fg-2',
                )}
              >
                {item.title}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-2xs text-fg-4">
                <Badge
                  size="sm"
                  tone={
                    item.priority === 'high'
                      ? 'danger'
                      : item.priority === 'medium'
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {item.priority === 'high' ? '高' : item.priority === 'medium' ? '中' : '低'}
                </Badge>
                <span className="truncate">{item.owner}</span>
                <span aria-hidden="true">·</span>
                <span className="shrink-0">{formatRelativeTime(item.dueAt)}</span>
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* ------------------------------------------------------------------ *
 * 团队动态
 * ------------------------------------------------------------------ */
function ActivityList({ items, loading }: { items: ActivityItem[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2 pt-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-9 rounded-md" />
        ))}
      </div>
    )
  }

  const toneOf = (tone: ActivityItem['tone']) => (tone === 'default' ? 'bg-fg-4' : `bg-${tone}`)

  return (
    <ul className="space-y-3 pt-1">
      {items.slice(0, 5).map((item) => (
        <li key={item.id} className="flex items-start gap-2.5">
          <Avatar name={item.actor} size="sm" className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs leading-5 text-fg-2">
              <span className="font-medium text-fg">{item.actor}</span> {item.action}{' '}
              <span className="text-fg-2">{item.target}</span>
            </p>
            <p className="flex items-center gap-1.5 text-2xs text-fg-4">
              <span aria-hidden="true" className={cn('size-1.5 rounded-full', toneOf(item.tone))} />
              {formatRelativeTime(item.time)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ *
 * 关于项目（收尾横幅）
 *
 * 把「这是个可复用模板」的信息集中到页面最后一段：
 * 既不打断主数据流的阅读节奏，又不至于让使用者找不到文档入口。
 * ------------------------------------------------------------------ */
function AboutBanner({ onNavigate }: { onNavigate: (to: string) => void }) {
  const links = [
    {
      label: '项目文档',
      hint: '接入真实后端',
      to: '/components/overview',
      icon: <Sparkles className="size-4" />,
    },
    {
      label: '模板中心',
      hint: '6 个完整页面骨架',
      to: '/templates/overview',
      icon: <Gauge className="size-4" />,
    },
    {
      label: '组件库',
      hint: '40+ 零依赖组件',
      to: '/components/overview',
      icon: <CalendarDays className="size-4" />,
    },
    {
      label: '新建用户',
      hint: '体验写操作权限',
      to: '/business/users',
      icon: <UserPlus className="size-4" />,
    },
  ]

  return (
    <section className="relative mt-3 overflow-hidden rounded-lg border border-line bg-surface">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_140%_at_100%_0%,color-mix(in_oklab,var(--n-primary)_13%,transparent),transparent_62%)]"
      />
      <div className="relative flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-fg">
            关于 Nexus Admin
            <Badge tone="primary" variant="soft" size="sm">
              v0.1.0 · MIT
            </Badge>
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-fg-3">
            模块化内核 + 零依赖组件库 + 可插拔数据层：新增一个业务模块只需写一个 module.ts，
            路由、菜单、面包屑、命令面板与权限守卫全部自动生成。
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-2xs text-fg-3">
            {['React 19', 'Vite 8', 'TypeScript', 'Tailwind v4', 'ECharts 6'].map((tag) => (
              <span
                key={tag}
                className="rounded-sm border border-line bg-surface-2 px-1.5 py-0.5 font-mono"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="grid w-full shrink-0 grid-cols-2 gap-2 lg:w-[23.75rem]">
          {links.map((link) => (
            <AppLink
              key={link.label}
              to={link.to}
              onClick={() => onNavigate(link.to)}
              className="group flex items-center gap-2 rounded-md border border-line bg-surface-2/60 px-2.5 py-2 transition-colors hover:border-primary/35 hover:bg-primary-weak/40"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface text-fg-3 transition-colors group-hover:text-primary">
                {link.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-fg-2 group-hover:text-primary">
                  {link.label}
                </span>
                <span className="block truncate text-[0.625rem] text-fg-4">{link.hint}</span>
              </span>
            </AppLink>
          ))}
        </div>
      </div>
    </section>
  )
}
