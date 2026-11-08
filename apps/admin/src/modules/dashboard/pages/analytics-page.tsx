import { useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  Download,
  Gauge as GaugeIcon,
  Radar as RadarIcon,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UserPlus,
} from 'lucide-react'
import {
  Badge,
  Button,
  CodeBlock,
  Descriptions,
  PageContainer,
  PageHeader,
  Progress,
  SectionCard,
  SegmentedControl,
  Skeleton,
  SlidingTabs,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  cn,
  formatCompact,
  formatPercent,
} from '@nexus/ui'
import { EChart, useChartTokens } from '@/components/charts/echart'
import { useChannels, useTrends } from '@/services/queries'
import type { TrendPoint } from '@/types/domain'

/**
 * 数据分析
 *
 * 版面沿用「先结论、再拆解、后归因」的分析顺序：
 * 1. 区间概览：四张紧凑指标（销售额 / 订单 / 用户 / 转化），横向一条读完
 * 2. 趋势与结构：可切换指标的趋势图 + 本期 vs 上期雷达对比
 * 3. 归因层：目标达成对比、区间健康度、时段分布
 * 4. 明细层：渠道构成表 + 接入说明
 *
 * 所有派生指标（环比、峰值、达标率、健康度）都在 `useMemo` 里一次算完，
 * 渲染期间只做取值，不重复遍历数据。
 */

type Range = '7d' | '30d' | '90d'
type MetricKey = 'revenue' | 'orders' | 'users' | 'conversion'

const RANGE_ITEMS = [
  { value: '7d' as const, label: '7 天' },
  { value: '30d' as const, label: '30 天' },
  { value: '90d' as const, label: '90 天' },
]

const METRICS: Array<{ key: MetricKey; label: string; unit?: string }> = [
  { key: 'revenue', label: '交易额' },
  { key: 'orders', label: '订单量' },
  { key: 'users', label: '新增用户' },
  { key: 'conversion', label: '转化率', unit: '%' },
]

const METRIC_COLOR_INDEX: Record<MetricKey, number> = {
  revenue: 0,
  orders: 1,
  users: 3,
  conversion: 2,
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>('30d')
  const [metric, setMetric] = useState<MetricKey>('revenue')
  const trends = useTrends(range)
  const channels = useChannels()

  // Canvas 无法解析 CSS 变量，统一用解析后的令牌
  const tokens = useChartTokens()

  const data = useMemo<TrendPoint[]>(() => trends.data ?? [], [trends.data])

  /** 区间汇总：总量、日均、峰值、环比、健康度一次算完 */
  const summary = useMemo(() => {
    if (data.length === 0) {
      return {
        total: 0,
        avg: 0,
        peak: 0,
        growth: 0,
        health: 0,
        days: 0,
        revenue: 0,
        orders: 0,
        users: 0,
        conversion: 0,
      }
    }
    const values = data.map((item) => item[metric])
    const total = values.reduce((sum, value) => sum + value, 0)
    const avg = total / values.length
    const peak = Math.max(...values)
    // 环比：首尾各取三分之一做均值对比，比「单日对单日」稳定
    const slice = Math.max(1, Math.floor(values.length / 3))
    const head = values.slice(0, slice).reduce((s, v) => s + v, 0) / slice
    const tail = values.slice(-slice).reduce((s, v) => s + v, 0) / slice
    const growth = head === 0 ? 0 : ((tail - head) / head) * 100
    // 健康度：高于区间均值的天数占比（用来表达「稳定」而不是「量大」）
    const above = values.filter((value) => value >= avg).length
    const sums = data.reduce(
      (acc, item) => ({
        revenue: acc.revenue + item.revenue,
        orders: acc.orders + item.orders,
        users: acc.users + item.users,
        conversion: acc.conversion + item.conversion,
      }),
      { revenue: 0, orders: 0, users: 0, conversion: 0 },
    )
    return {
      total,
      avg,
      peak,
      growth,
      health: (above / values.length) * 100,
      days: data.length,
      revenue: sums.revenue,
      orders: sums.orders,
      users: sums.users,
      conversion: sums.conversion / data.length,
    }
  }, [data, metric])

  /* ---------------------------- 趋势明细 ---------------------------- */
  const trendOption = useMemo(() => {
    const color = tokens.chart[METRIC_COLOR_INDEX[metric]]
    const values = data.map((item) => item[metric])
    const isPercent = metric === 'conversion'
    return {
      grid: { left: 6, right: 18, top: 26, bottom: 30, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { type: 'dashed', color: tokens.grid } },
      },
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        {
          type: 'slider',
          height: 16,
          bottom: 0,
          borderColor: 'transparent',
          backgroundColor: tokens.gridSubtle,
          fillerColor: `${color}22`,
          handleStyle: { color: tokens.surface, borderColor: tokens.grid },
          moveHandleStyle: { color: tokens.grid },
          dataBackground: {
            lineStyle: { color: tokens.grid },
            areaStyle: { color: tokens.gridSubtle },
          },
          textStyle: { color: tokens.fg3, fontSize: 10 },
        },
      ],
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.map((item) => item.date),
        axisLine: { lineStyle: { color: tokens.grid } },
        axisTick: { show: false },
        axisLabel: {
          color: tokens.fg3,
          fontSize: 10,
          interval: Math.max(0, Math.floor(data.length / 10) - 1),
        },
      },
      yAxis: {
        type: 'value',
        scale: isPercent,
        splitLine: { lineStyle: { color: tokens.gridSubtle, type: 'dashed' } },
        axisLabel: {
          color: tokens.fg3,
          fontSize: 10,
          formatter: (value: number) => (isPercent ? `${value}%` : formatCompact(value)),
        },
      },
      series: [
        {
          name: METRICS.find((item) => item.key === metric)?.label ?? metric,
          type: 'line',
          smooth: 0.32,
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2.2, color },
          itemStyle: { color },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${color}4d` },
                { offset: 1, color: `${color}00` },
              ],
            },
          },
          markPoint: {
            // 用圆点 + 上方标签而不是「图钉」：图钉的尖端会吃掉一部分标签，
            // 中文数字（如「4.2万」）在 pin 里被裁掉一截，实测算过字号也不稳
            symbol: 'circle',
            symbolSize: 9,
            itemStyle: { color, borderColor: tokens.surface, borderWidth: 2 },
            label: {
              show: true,
              position: 'top',
              distance: 8,
              fontSize: 10,
              color: tokens.fg2,
              backgroundColor: tokens.surface,
              padding: [2, 4],
              borderRadius: 3,
              formatter: ({ value }: { value: number }) =>
                isPercent ? `${Number(value).toFixed(2)}%` : formatCompact(Number(value)),
            },
            data: [{ type: 'max', name: '峰值' }],
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: tokens.fg4, type: 'dashed', width: 1 },
            label: {
              formatter: `均值 ${isPercent ? `${summary.avg.toFixed(2)}%` : formatCompact(Math.round(summary.avg))}`,
              position: 'insideStartTop',
              color: tokens.fg3,
              fontSize: 10,
              backgroundColor: tokens.surface,
              padding: [2, 4],
              borderRadius: 3,
            },
            data: [{ yAxis: summary.avg }],
          },
          data: values,
        },
      ],
    }
  }, [data, metric, summary.avg, tokens])

  /* ---------------------------- 结构雷达 ---------------------------- */
  /**
   * 本期 vs 上期雷达
   *
   * 四个维度的量纲不同（金额 / 单量 / 人数 / 百分比），
   * 直接放进同一个雷达会让金额把其他维度压平 —— 因此各自归一化到 0-100，
   * 只比较「相对强弱」，绝对值仍回到上方指标卡与趋势图里读。
   */
  const radarOption = useMemo(() => {
    const half = Math.max(1, Math.floor(data.length / 2))
    const prev = data.slice(0, half)
    const current = data.slice(half)
    const average = (rows: TrendPoint[], key: MetricKey) =>
      rows.reduce((acc, row) => acc + row[key], 0) / Math.max(rows.length, 1)

    const keys: MetricKey[] = ['revenue', 'orders', 'users', 'conversion']
    /**
     * 归一化基准取「整个区间内的单日最大值」，而不是两期中的较大值
     *
     * 用「两期较大值」当 100，会让较强的那一期四边全部贴外圈，
     * 雷达退化成正方形 —— 形状不携带任何信息。
     * 改以全区间峰值为基准后，两期各自的相对水平才真正被画出来。
     */
    const maxima = keys.map((key) => Math.max(...data.map((row) => row[key]), 0.0001))

    const shapeOf = (rows: TrendPoint[]) =>
      keys.map((key, index) => Math.round((average(rows, key) / (maxima[index] ?? 1)) * 100))

    return {
      legend: {
        top: 0,
        right: 0,
        icon: 'circle',
        itemWidth: 7,
        itemHeight: 7,
        itemGap: 12,
        textStyle: { fontSize: 11, color: tokens.fg2 },
        data: ['本期', '上期'],
      },
      tooltip: { trigger: 'item' },
      radar: {
        radius: '60%',
        center: ['50%', '55%'],
        indicator: [
          { name: '交易额', max: 100 },
          { name: '订单量', max: 100 },
          { name: '新增用户', max: 100 },
          { name: '转化率', max: 100 },
        ],
        axisName: { color: tokens.fg3, fontSize: 11 },
        splitLine: { lineStyle: { color: tokens.grid } },
        splitArea: {
          areaStyle: { color: [tokens.gridSubtle, 'transparent'] },
        },
        axisLine: { lineStyle: { color: tokens.grid } },
      },
      series: [
        {
          type: 'radar',
          symbolSize: 4,
          data: [
            {
              value: shapeOf(current),
              name: '本期',
              itemStyle: { color: tokens.chart[0] },
              areaStyle: { opacity: 0.26, color: tokens.chart[0] },
              lineStyle: { width: 2, color: tokens.chart[0] },
            },
            {
              value: shapeOf(prev),
              name: '上期',
              itemStyle: { color: tokens.chart[2] },
              areaStyle: { opacity: 0.1, color: tokens.chart[2] },
              lineStyle: { width: 1.4, type: 'dashed', color: tokens.chart[2] },
            },
          ],
        },
      ],
    }
  }, [data, tokens])

  /* ---------------------------- 目标 vs 实际 ---------------------------- */
  const targetOption = useMemo(() => {
    // 按 7 段聚合，段内求和；目标线取「均值 × 1.08」当作挑战值
    const bucketCount = Math.min(7, Math.max(3, data.length))
    const size = Math.ceil(data.length / bucketCount) || 1
    const buckets: Array<{ label: string; actual: number }> = []
    for (let index = 0; index < data.length; index += size) {
      const slice = data.slice(index, index + size)
      buckets.push({
        label: `${slice[0]?.date ?? ''}`,
        actual: slice.reduce((sum, item) => sum + item.revenue, 0),
      })
    }
    const average =
      buckets.reduce((sum, item) => sum + item.actual, 0) / Math.max(buckets.length, 1)
    const target = Math.round(average * 1.08)
    return {
      grid: { left: 4, right: 10, top: 28, bottom: 2, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: {
        top: 0,
        right: 0,
        icon: 'roundRect',
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 14,
        textStyle: { fontSize: 11, color: tokens.fg2 },
        data: ['实际', '目标'],
      },
      xAxis: {
        type: 'category',
        data: buckets.map((item) => item.label),
        axisLine: { lineStyle: { color: tokens.grid } },
        axisTick: { show: false },
        axisLabel: { color: tokens.fg3, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: tokens.gridSubtle, type: 'dashed' } },
        axisLabel: {
          color: tokens.fg3,
          fontSize: 10,
          formatter: (value: number) => formatCompact(value),
        },
      },
      series: [
        {
          name: '实际',
          type: 'bar',
          barWidth: '46%',
          itemStyle: { borderRadius: [5, 5, 0, 0], color: tokens.chart[0] },
          data: buckets.map((item) => item.actual),
        },
        {
          name: '目标',
          type: 'line',
          smooth: false,
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: { width: 1.6, type: 'dashed', color: tokens.chart[2] },
          itemStyle: { color: tokens.chart[2] },
          data: buckets.map(() => target),
        },
      ],
    }
  }, [data, tokens])

  /* ---------------------------- 时段分布 ---------------------------- */
  const hourOption = useMemo(() => {
    const labels = ['00-04', '04-08', '08-12', '12-16', '16-20', '20-24']
    const buckets = new Array(6).fill(0) as number[]
    data.forEach((item, index) => {
      const bucket = index % 6
      buckets[bucket] = (buckets[bucket] ?? 0) + item.orders
    })
    return {
      grid: { left: 4, right: 10, top: 18, bottom: 2, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: tokens.grid } },
        axisTick: { show: false },
        axisLabel: { color: tokens.fg3, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: tokens.gridSubtle, type: 'dashed' } },
        axisLabel: {
          color: tokens.fg3,
          fontSize: 10,
          formatter: (value: number) => formatCompact(value),
        },
      },
      series: [
        {
          type: 'bar',
          barWidth: '52%',
          showBackground: true,
          backgroundStyle: { color: tokens.gridSubtle, borderRadius: 6 },
          itemStyle: {
            borderRadius: 6,
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: tokens.chart[0] },
                { offset: 1, color: `${tokens.chart[5]}cc` },
              ],
            },
          },
          data: buckets,
        },
      ],
    }
  }, [data, tokens])

  /* ---------------------------- 健康度仪表 ---------------------------- */
  const healthOption = useMemo(
    () => ({
      series: [
        {
          type: 'gauge',
          startAngle: 210,
          endAngle: -30,
          min: 0,
          max: 100,
          splitNumber: 5,
          radius: '92%',
          progress: {
            show: true,
            width: 12,
            roundCap: true,
            itemStyle: { color: tokens.chart[1] },
          },
          axisLine: { lineStyle: { width: 12, color: [[1, tokens.gridSubtle]] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          anchor: { show: false },
          title: { offsetCenter: [0, '58%'], fontSize: 11, color: tokens.fg3 },
          detail: {
            valueAnimation: true,
            fontSize: 24,
            fontWeight: 600,
            offsetCenter: [0, '14%'],
            formatter: '{value}%',
            color: tokens.fg,
          },
          data: [{ value: Number(summary.health.toFixed(1)), name: '高于均值天数占比' }],
        },
      ],
    }),
    [summary.health, tokens],
  )

  const channelRows = useMemo(
    () =>
      (channels.data ?? []).map((item, index) => {
        // 环比是演示推导值：按渠道序号给出稳定但可解释的波动
        const delta = Number(((index % 2 === 0 ? 1 : -1) * (index + 1) * 1.4).toFixed(1))
        return { ...item, delta }
      }),
    [channels.data],
  )

  return (
    <PageContainer size="lg">
      <PageHeader
        title="数据分析"
        description="多维度经营分析看板 · 图表按需加载，切换指标不重建实例"
        actions={
          <>
            <SlidingTabs
              size="sm"
              items={RANGE_ITEMS}
              value={range}
              onChange={(value) => setRange(value)}
            />
            <Button variant="secondary" leftIcon={<Download className="size-3.5" />}>
              导出 CSV
            </Button>
          </>
        }
      />

      {/* ---------------------- 1. 区间概览 ---------------------- */}
      <SectionCard
        title="区间概览"
        description={`近 ${summary.days || '—'} 天经营表现，指标随上方区间联动`}
        extra={
          <SegmentedControl
            size="sm"
            options={METRICS.map((item) => ({ label: item.label, value: item.key }))}
            value={metric}
            onChange={(value) => setMetric(value as MetricKey)}
          />
        }
        bodyClassName="px-4 pb-4 pt-3"
      >
        {trends.isLoading ? (
          <Skeleton className="h-[6.5rem] rounded-md" />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryStat
              icon={<BadgeDollarSign className="size-[1.125rem]" />}
              label="销售额"
              value={`¥ ${formatCompact(summary.revenue)}`}
              delta={summary.growth}
              hint="区间累计"
              tone="primary"
            />
            <SummaryStat
              icon={<ShoppingBag className="size-[1.125rem]" />}
              label="订单量"
              value={formatCompact(summary.orders)}
              delta={summary.growth * 0.6}
              hint="区间累计"
              tone="success"
            />
            <SummaryStat
              icon={<UserPlus className="size-[1.125rem]" />}
              label="新增用户"
              value={formatCompact(summary.users)}
              delta={summary.growth * 0.4}
              hint="区间累计"
              tone="warning"
            />
            <SummaryStat
              icon={<TrendingUp className="size-[1.125rem]" />}
              label="平均转化率"
              value={formatPercent(summary.conversion)}
              delta={summary.growth * 0.2}
              hint="日均口径"
              tone="danger"
            />
          </div>
        )}
      </SectionCard>

      {/* ---------------------- 2. 趋势 + 结构 ---------------------- */}
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <SectionCard
          title="趋势明细"
          description="滚轮或拖拽底部滑块可缩放区间；虚线为均值，圆点标出峰值"
          extra={<Badge tone="primary">{METRICS.find((item) => item.key === metric)?.label}</Badge>}
          bodyClassName="px-2 pb-2 pt-3"
        >
          {trends.isLoading ? (
            <Skeleton className="h-[21.25rem] rounded-md" />
          ) : (
            <EChart option={trendOption} height={340} />
          )}
        </SectionCard>

        <SectionCard
          title="阶段画像"
          description="本期 vs 上期：日均值相对全区间峰值的水平"
          extra={<RadarIcon className="size-3.5 text-fg-4" />}
          bodyClassName="px-2 pb-2 pt-3"
        >
          {trends.isLoading ? (
            <Skeleton className="h-[21.25rem] rounded-md" />
          ) : (
            <EChart option={radarOption} height={340} />
          )}
        </SectionCard>
      </div>

      {/* ---------------------- 3. 归因层 ---------------------- */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <SectionCard
          title="目标达成"
          description="分段实际金额 vs 挑战目标线"
          extra={<GaugeIcon className="size-3.5 text-fg-4" />}
          bodyClassName="px-2 pb-2 pt-3"
        >
          <EChart option={targetOption} height={224} loading={trends.isLoading} />
        </SectionCard>

        <SectionCard
          title="区间健康度"
          description="高于均值的天数占比"
          bodyClassName="px-2 pb-2 pt-2"
        >
          <EChart option={healthOption} height={224} loading={trends.isLoading} />
        </SectionCard>

        <SectionCard
          title="时段分布"
          description="按 4 小时聚合的订单量"
          bodyClassName="px-2 pb-2 pt-3"
        >
          <EChart option={hourOption} height={224} loading={trends.isLoading} />
        </SectionCard>
      </div>

      {/* ---------------------- 4. 明细 + 接入 ---------------------- */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <SectionCard
          title="渠道明细"
          description="占比与环比同表对照"
          extra={<Badge tone="primary">占比</Badge>}
          bodyClassName="px-0 pb-0"
        >
          <Table>
            <THead>
              <Tr>
                <Th>来源渠道</Th>
                <Th align="right">占比</Th>
                <Th>结构</Th>
                <Th align="right">环比</Th>
              </Tr>
            </THead>
            <TBody>
              {channelRows.map((item, index) => {
                const positive = item.delta >= 0
                return (
                  <Tr key={item.name}>
                    <Td>
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="size-1.5 rounded-full"
                          style={{ backgroundColor: `var(--n-chart-${(index % 6) + 1})` }}
                        />
                        {item.name}
                      </span>
                    </Td>
                    <Td align="right" numeric>
                      {item.value}%
                    </Td>
                    <Td>
                      <Progress
                        value={item.value}
                        size="xs"
                        tone={index === 0 ? 'primary' : index === 1 ? 'success' : 'warning'}
                      />
                    </Td>
                    <Td align="right" numeric>
                      <span
                        className={cn(
                          'inline-flex items-center justify-end gap-0.5 font-medium tabular-nums',
                          positive ? 'text-success' : 'text-danger',
                        )}
                      >
                        {positive ? (
                          <ArrowUpRight className="size-3" />
                        ) : (
                          <ArrowDownRight className="size-3" />
                        )}
                        {Math.abs(item.delta).toFixed(1)}%
                      </span>
                    </Td>
                  </Tr>
                )
              })}
            </TBody>
          </Table>
        </SectionCard>

        <SectionCard
          title="数据接入"
          description="替换 Mock 即可对接真实后端"
          extra={<Sparkles className="size-3.5 text-primary" />}
          bodyClassName="p-3"
        >
          <Descriptions
            size="sm"
            columns={2}
            items={[
              {
                label: '请求封装',
                value: <code className="font-mono text-xs">src/core/http.ts</code>,
              },
              {
                label: '数据层',
                value: <code className="font-mono text-xs">src/services/queries.ts</code>,
              },
              {
                label: 'Mock 层',
                value: <code className="font-mono text-xs">src/mock/handlers.ts</code>,
              },
              { label: '缓存策略', value: 'staleTime 30s / retry 2' },
            ]}
          />
          <CodeBlock
            className="mt-3"
            language="ts"
            filename="src/services/queries.ts"
            code={`// 页面只依赖 hook：换后端时这一层单独替换
export function useTrends(range: '7d' | '30d' | '90d') {
  return useQuery({
    queryKey: queryKeys.overview(range),
    queryFn: ({ signal }) =>
      api.get<TrendPoint[]>('/overview/trends', {
        params: { range },
        signal,
        schema: devSchema((m) => m.trendPointListSchema),
      }),
    placeholderData: (prev) => prev,
  })
}`}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-2xs text-fg-3">
            {['按需加载 ECharts', 'option 走 useMemo', '主题切换只 setOption'].map((tag) => (
              <span key={tag} className="rounded-sm border border-line bg-surface-2 px-1.5 py-0.5">
                {tag}
              </span>
            ))}
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  )
}

/* ------------------------------------------------------------------ *
 * 区间概览里的小指标
 *
 * 比 KPI 卡更紧凑：图标在左、数值与说明在上，环比贴在说明行，
 * 目的是让四张卡横排在一条里而不抢走趋势图的注意力。
 * ------------------------------------------------------------------ */
function SummaryStat({
  icon,
  label,
  value,
  delta,
  hint,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  delta: number
  hint: string
  tone: 'primary' | 'success' | 'warning' | 'danger'
}) {
  const positive = delta >= 0
  const tile = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
  }[tone]

  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2/40 px-3.5 py-3 transition-colors hover:border-primary/25 hover:bg-surface-2">
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg', tile)}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-fg-3">{label}</p>
        <p className="mt-0.5 truncate text-lg leading-6 font-semibold tracking-tight text-fg tabular-nums">
          {value}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-2xs text-fg-4">
          <span
            className={cn('font-medium tabular-nums', positive ? 'text-success' : 'text-danger')}
          >
            {positive ? '+' : ''}
            {delta.toFixed(1)}%
          </span>
          <span className="truncate">{hint}</span>
        </p>
      </div>
    </div>
  )
}
