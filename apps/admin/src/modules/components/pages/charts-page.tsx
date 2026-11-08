import { useMemo, useState } from 'react'
import { ChartBar, ChartLine, ChartPie, Gauge, Radar, Zap } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  CodeBlock,
  Grid,
  Meter,
  PageContainer,
  PageHeader,
  Progress,
  SectionCard,
  SegmentedControl,
  StatCard,
  formatCompact,
  formatCurrency,
} from '@nexus/ui'
import { EChart, readThemeTokens } from '@/components/charts/echart'
import { useChannels, useFunnel, useTrends } from '@/services/queries'

type ChartKind = 'line' | 'area' | 'bar' | 'pie' | 'radar' | 'gauge'

export default function ChartsPage() {
  const [kind, setKind] = useState<ChartKind>('line')
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d')
  const trends = useTrends(range)
  const channels = useChannels()
  const funnel = useFunnel()

  const tokens = readThemeTokens()
  // 稳定引用，避免 useMemo 依赖每次渲染都变化
  const data = useMemo(() => trends.data ?? [], [trends.data])

  const option = useMemo(() => {
    const xAxis = {
      type: 'category',
      boundaryGap: kind === 'bar' ? true : false,
      data: data.map((item) => item.date),
      axisLine: { lineStyle: { color: tokens.grid } },
      axisTick: { show: false },
      axisLabel: { color: tokens.fg3, fontSize: 10 },
    }
    const yAxis = {
      type: 'value',
      splitLine: { lineStyle: { color: tokens.grid, type: 'dashed', opacity: 0.6 } },
      axisLabel: { color: tokens.fg3, fontSize: 10, formatter: (v: number) => formatCompact(v) },
    }

    switch (kind) {
      case 'bar':
        return {
          grid: { left: 8, right: 12, top: 24, bottom: 4, containLabel: true },
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
          xAxis,
          yAxis,
          series: [
            {
              name: '订单量',
              type: 'bar',
              barWidth: '48%',
              itemStyle: { borderRadius: [4, 4, 0, 0] },
              data: data.map((item) => item.orders),
            },
            {
              name: '新增用户',
              type: 'bar',
              barWidth: '48%',
              itemStyle: { borderRadius: [4, 4, 0, 0] },
              data: data.map((item) => item.users),
            },
          ],
        }
      case 'area':
        return {
          grid: { left: 8, right: 12, top: 24, bottom: 4, containLabel: true },
          tooltip: { trigger: 'axis' },
          xAxis,
          yAxis,
          series: [
            {
              name: '交易额',
              type: 'line',
              smooth: 0.4,
              showSymbol: false,
              stack: 'total',
              areaStyle: { opacity: 0.35 },
              lineStyle: { width: 1.5 },
              data: data.map((item) => item.revenue),
            },
          ],
        }
      case 'pie':
        return {
          tooltip: { trigger: 'item' },
          legend: {
            bottom: 0,
            icon: 'circle',
            itemWidth: 7,
            itemHeight: 7,
            textStyle: { fontSize: 11 },
          },
          series: [
            {
              type: 'pie',
              radius: ['42%', '68%'],
              center: ['50%', '45%'],
              itemStyle: { borderRadius: 4, borderColor: tokens.surface, borderWidth: 2 },
              label: { fontSize: 10, color: tokens.fg2 },
              data: channels.data?.map((item) => ({ name: item.name, value: item.value })) ?? [],
            },
          ],
        }
      case 'radar':
        return {
          tooltip: {},
          radar: {
            radius: '66%',
            indicator: [
              { name: '可用性', max: 100 },
              { name: '性能', max: 100 },
              { name: '安全', max: 100 },
              { name: '成本', max: 100 },
              { name: '体验', max: 100 },
              { name: '可维护', max: 100 },
            ],
            axisName: { color: tokens.fg3, fontSize: 10 },
            splitLine: { lineStyle: { color: tokens.grid } },
            splitArea: { areaStyle: { color: ['transparent'] } },
            axisLine: { lineStyle: { color: tokens.grid } },
          },
          series: [
            {
              type: 'radar',
              symbolSize: 4,
              areaStyle: { opacity: 0.2 },
              data: [
                { value: [95, 88, 92, 74, 90, 85], name: '当前版本' },
                { value: [82, 76, 80, 88, 72, 70], name: '上一版本' },
              ],
            },
          ],
        }
      case 'gauge':
        return {
          series: [
            {
              type: 'gauge',
              startAngle: 210,
              endAngle: -30,
              min: 0,
              max: 100,
              splitNumber: 5,
              progress: { show: true, width: 12, roundCap: true },
              axisLine: { lineStyle: { width: 12, color: [[1, tokens.grid]] } },
              axisTick: { show: false },
              splitLine: { show: false },
              axisLabel: { distance: 18, fontSize: 10, color: tokens.fg3 },
              pointer: { width: 4, itemStyle: { color: 'auto' } },
              detail: {
                valueAnimation: true,
                fontSize: 26,
                offsetCenter: [0, '32%'],
                formatter: '{value}%',
                color: tokens.fg,
              },
              title: { offsetCenter: [0, '62%'], fontSize: 11, color: tokens.fg3 },
              data: [{ value: 92.4, name: '本月 SLA' }],
            },
          ],
        }
      default:
        return {
          grid: { left: 8, right: 12, top: 24, bottom: 4, containLabel: true },
          tooltip: { trigger: 'axis' },
          xAxis,
          yAxis,
          series: [
            {
              name: '交易额',
              type: 'line',
              smooth: 0.35,
              showSymbol: false,
              lineStyle: { width: 2 },
              areaStyle: { opacity: 0.1 },
              data: data.map((item) => item.revenue),
            },
            {
              name: '订单量',
              type: 'line',
              smooth: 0.35,
              showSymbol: false,
              lineStyle: { width: 1.5, type: 'dashed' },
              data: data.map((item) => item.orders),
            },
          ],
        }
    }
  }, [kind, data, tokens.grid, tokens.fg3, tokens.surface, tokens.fg2, tokens.fg, channels.data])

  const funnelOption = useMemo(
    () => ({
      grid: { left: 8, right: 44, top: 6, bottom: 6, containLabel: true },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'value', show: false, max: 100 },
      yAxis: {
        type: 'category',
        data: (funnel.data ?? []).map((item) => item.stage).reverse(),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: tokens.fg2, fontSize: 11 },
      },
      series: [
        {
          type: 'bar',
          barWidth: 16,
          showBackground: true,
          backgroundStyle: { color: tokens.grid, opacity: 0.5, borderRadius: 8 },
          itemStyle: { borderRadius: 8 },
          label: {
            show: true,
            position: 'right',
            fontSize: 10,
            color: tokens.fg3,
            formatter: '{c}%',
          },
          data: (funnel.data ?? []).map((item) => item.value).reverse(),
        },
      ],
    }),
    [funnel.data, tokens.fg2, tokens.grid, tokens.fg3],
  )

  return (
    <PageContainer size="lg">
      <PageHeader
        title="图表可视化"
        description="ECharts 6 按需注册 + 动态加载 + 主题联动，首屏不含图表代码"
        badge={<Badge tone="success">260KB gzip 拆分</Badge>}
        actions={
          <SegmentedControl
            options={[
              { label: '7 天', value: '7d' },
              { label: '30 天', value: '30d' },
              { label: '90 天', value: '90d' },
            ]}
            value={range}
            onChange={(value) => setRange(value as typeof range)}
          />
        }
      />

      <Alert tone="info" className="mb-3" compact title="性能设计">
        <code className="rounded bg-surface-2 px-1 font-mono text-2xs">echarts/core</code>{' '}
        仅在图表模块被动态 import， 并按需注册 7 种图表 + 9
        个组件；切换深浅色时自动重建实例以刷新色板。
      </Alert>

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          label="渲染图表"
          value="6"
          suffix="种"
          icon={<ChartLine className="size-4" />}
          tone="primary"
        />
        <StatCard
          label="数据点"
          value={formatCompact(data.length * 4)}
          icon={<Zap className="size-4" />}
          tone="success"
        />
        <StatCard
          label="区间交易额"
          value={formatCurrency(data.reduce((sum, item) => sum + item.revenue, 0)).replace(
            '¥',
            '¥ ',
          )}
          tone="warning"
        />
        <StatCard
          label="平均转化率"
          value={`${(data.reduce((s, i) => s + i.conversion, 0) / (data.length || 1)).toFixed(2)}%`}
          tone="danger"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(
          [
            { key: 'line', label: '折线图', icon: <ChartLine className="size-3.5" /> },
            { key: 'area', label: '面积图', icon: <ChartLine className="size-3.5" /> },
            { key: 'bar', label: '柱状图', icon: <ChartBar className="size-3.5" /> },
            { key: 'pie', label: '饼图', icon: <ChartPie className="size-3.5" /> },
            { key: 'radar', label: '雷达图', icon: <Radar className="size-3.5" /> },
            { key: 'gauge', label: '仪表盘', icon: <Gauge className="size-3.5" /> },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setKind(item.key)}
            className={
              kind === item.key
                ? 'inline-flex h-7 items-center gap-1.5 rounded-md border border-primary/40 bg-primary-weak px-2.5 text-xs font-medium text-primary'
                : 'inline-flex h-7 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs text-fg-3 transition-colors hover:border-line-strong hover:text-fg-2'
            }
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      <SectionCard
        title="主图示例"
        description="所有图表共用统一的主题色板与 tooltip 样式"
        bodyClassName="px-2 pb-3 pt-2"
      >
        <EChart option={option} height={340} loading={trends.isLoading || channels.isLoading} />
      </SectionCard>

      <Grid cols={3} gap="md" className="mt-3">
        <SectionCard title="漏斗图" description="横向条形模拟" bodyClassName="px-2 py-3">
          <EChart option={funnelOption} height={220} loading={funnel.isLoading} />
        </SectionCard>
        <SectionCard title="环形进度" description="适合 KPI 类指标" bodyClassName="p-3">
          <div className="flex flex-wrap items-center justify-around gap-3">
            <Progress value={92} variant="ring" ringSize={92} tone="success" label="92%" />
            <Progress value={64} variant="ring" ringSize={92} tone="primary" label="64%" />
            <Progress value={38} variant="ring" ringSize={92} tone="danger" label="38%" />
          </div>
          <div className="mt-3 space-y-2">
            <Meter value={78} showValue />
            <Meter value={46} showValue />
          </div>
        </SectionCard>
        <SectionCard title="使用方式" description="只需传入 option" bodyClassName="p-3">
          <CodeBlock
            language="tsx"
            filename="任意页面"
            maxHeight={260}
            code={`import { EChart } from '@/components/charts/echart'

<EChart
  height={320}
  loading={isLoading}
  option={{
    xAxis: { type: 'category', data: dates },
    yAxis: { type: 'value' },
    series: [{ type: 'line', data: values }],
  }}
/>`}
          />
        </SectionCard>
      </Grid>

      <SectionCard
        className="mt-3"
        title="主题联动"
        description="切换深色模式与强调色时，图表自动换色"
        bodyClassName="p-3"
      >
        <div className="flex flex-wrap gap-2">
          {[
            '--n-chart-1',
            '--n-chart-2',
            '--n-chart-3',
            '--n-chart-4',
            '--n-chart-5',
            '--n-chart-6',
          ].map((token) => (
            <div
              key={token}
              className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1"
            >
              <span className="size-3 rounded-full" style={{ backgroundColor: `var(${token})` }} />
              <span className="font-mono text-2xs text-fg-3">{token}</span>
            </div>
          ))}
        </div>
        <Button
          className="mt-3"
          size="sm"
          variant="secondary"
          onClick={() => document.documentElement.classList.toggle('dark')}
        >
          切换深浅色验证
        </Button>
      </SectionCard>
    </PageContainer>
  )
}
