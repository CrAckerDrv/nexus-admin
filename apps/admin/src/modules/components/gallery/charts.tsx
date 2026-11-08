import { useMemo, useState } from 'react'
import { ChartBar, ChartLine, ChartPie, Table2 } from 'lucide-react'
import { Badge, Button, SegmentedControl, formatCompact } from '@nexus/ui'
import { EChart, readThemeTokens, useChartTokens } from '@/components/charts/echart'
import type { GalleryCategory } from './types'

/* ================================================================== *
 * 图表封装（ECharts 6）
 *
 * 这一组不是 @nexus/ui 的组件，而是应用层对 ECharts 的轻封装：
 * 主题令牌解析、首屏空闲加载、实例复用、字号随根字号缩放。
 * 放进橱窗的理由和画布一样——它们是「这个项目里能直接抄走的可视化件」，
 * 而且能顺带验证深浅色切换后图表没有变白。
 * ================================================================== */

const DAYS = ['11-01', '11-02', '11-03', '11-04', '11-05', '11-06', '11-07']
const REVENUE = [128400, 142600, 138200, 164800, 172400, 158600, 186200]
const ORDERS = [42, 51, 48, 63, 68, 59, 74]
const CHANNELS = [
  { name: '自然搜索', value: 4210 },
  { name: '推荐', value: 3180 },
  { name: '直连', value: 2260 },
  { name: '投放', value: 1640 },
  { name: '站外', value: 980 },
]

/* ------------------------------ 1. 折线 / 面积 ------------------------------ */

function LineDemo() {
  const [shape, setShape] = useState<'area' | 'line'>('area')
  const tokens = useChartTokens()

  const option = useMemo(
    () => ({
      grid: { left: 6, right: 10, top: 26, bottom: 2, containLabel: true },
      tooltip: { trigger: 'axis' },
      legend: {
        top: 0,
        right: 0,
        icon: 'circle',
        itemWidth: 7,
        itemHeight: 7,
        textStyle: { fontSize: 11, color: tokens.fg3 },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: DAYS,
        axisLine: { lineStyle: { color: tokens.grid } },
        axisTick: { show: false },
        axisLabel: { color: tokens.fg3, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: tokens.grid, type: 'dashed', opacity: 0.6 } },
        axisLabel: {
          color: tokens.fg3,
          fontSize: 10,
          formatter: (value: number) => formatCompact(value),
        },
      },
      series: [
        {
          name: '交易额',
          type: 'line',
          smooth: 0.35,
          showSymbol: false,
          lineStyle: { width: 2 },
          areaStyle: shape === 'area' ? { opacity: 0.18 } : undefined,
          data: REVENUE,
        },
        {
          name: '订单量（×1000）',
          type: 'line',
          smooth: 0.35,
          showSymbol: false,
          lineStyle: { width: 1.5, type: 'dashed' },
          data: ORDERS.map((value) => value * 1000),
        },
      ],
    }),
    [shape, tokens],
  )

  return (
    <div className="w-full space-y-2">
      <SegmentedControl
        size="sm"
        value={shape}
        onChange={setShape}
        options={[
          { label: '面积', value: 'area' },
          { label: '折线', value: 'line' },
        ]}
      />
      <EChart option={option} tokens={tokens} height={220} />
    </div>
  )
}

/* ------------------------------ 2. 柱状 ------------------------------ */

function BarDemo() {
  const tokens = useChartTokens()
  const option = useMemo(
    () => ({
      grid: { left: 6, right: 10, top: 24, bottom: 2, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: {
        type: 'category',
        data: DAYS,
        axisLine: { lineStyle: { color: tokens.grid } },
        axisTick: { show: false },
        axisLabel: { color: tokens.fg3, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: tokens.grid, type: 'dashed', opacity: 0.6 } },
        axisLabel: { color: tokens.fg3, fontSize: 10 },
      },
      series: [
        {
          name: '订单量',
          type: 'bar',
          barWidth: '46%',
          itemStyle: { borderRadius: [4, 4, 0, 0] },
          data: ORDERS,
        },
      ],
    }),
    [tokens],
  )
  return <EChart option={option} tokens={tokens} height={220} className="w-full" />
}

/* ------------------------------ 3. 饼 / 环 ------------------------------ */

function PieDemo() {
  const [shape, setShape] = useState<'donut' | 'pie'>('donut')
  const tokens = useChartTokens()
  const option = useMemo(
    () => ({
      tooltip: { trigger: 'item' },
      legend: {
        bottom: 0,
        icon: 'circle',
        itemWidth: 7,
        itemHeight: 7,
        textStyle: { fontSize: 11, color: tokens.fg3 },
      },
      series: [
        {
          type: 'pie',
          radius: shape === 'donut' ? ['46%', '70%'] : ['0%', '68%'],
          center: ['50%', '46%'],
          itemStyle: { borderRadius: 4, borderColor: tokens.surface, borderWidth: 2 },
          label: { fontSize: 10, color: tokens.fg2 },
          data: CHANNELS,
        },
      ],
    }),
    [shape, tokens],
  )

  return (
    <div className="w-full space-y-2">
      <SegmentedControl
        size="sm"
        value={shape}
        onChange={setShape}
        options={[
          { label: '环形', value: 'donut' },
          { label: '饼图', value: 'pie' },
        ]}
      />
      <EChart option={option} tokens={tokens} height={230} />
    </div>
  )
}

/* ------------------------------ 4. 雷达 ------------------------------ */

function RadarDemo() {
  const tokens = useChartTokens()
  const option = useMemo(
    () => ({
      tooltip: {},
      radar: {
        radius: '64%',
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
    }),
    [tokens],
  )
  return <EChart option={option} tokens={tokens} height={260} className="w-full" />
}

/* ------------------------------ 5. 仪表盘 ------------------------------ */

function GaugeDemo() {
  const [value, setValue] = useState(92.4)
  const tokens = useChartTokens()
  const option = useMemo(
    () => ({
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
          data: [{ value, name: '本月 SLA' }],
        },
      ],
    }),
    [value, tokens],
  )

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-center gap-2">
        {[92.4, 68, 100].map((preset) => (
          <Button key={preset} size="xs" variant="secondary" onClick={() => setValue(preset)}>
            {preset}%
          </Button>
        ))}
      </div>
      <EChart option={option} tokens={tokens} height={230} />
    </div>
  )
}

/* ------------------------------ 6. 横向条形（漏斗 / 排行） ------------------------------ */

function FunnelDemo() {
  const tokens = useChartTokens()
  const option = useMemo(
    () => ({
      grid: { left: 6, right: 44, top: 6, bottom: 2, containLabel: true },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'value', show: false, max: 100 },
      yAxis: {
        type: 'category',
        data: ['支付', '下单', '加购', '注册', '访问'],
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: tokens.fg2, fontSize: 11 },
      },
      series: [
        {
          type: 'bar',
          barWidth: 14,
          showBackground: true,
          backgroundStyle: { color: tokens.grid, opacity: 0.5, borderRadius: 7 },
          itemStyle: { borderRadius: 7 },
          label: {
            show: true,
            position: 'right',
            fontSize: 10,
            color: tokens.fg3,
            formatter: '{c}%',
          },
          data: [4.2, 12.6, 28.4, 46.8, 100],
        },
      ],
    }),
    [tokens],
  )
  return <EChart option={option} tokens={tokens} height={230} className="w-full" />
}

/* ------------------------------ 7. 主题令牌 ------------------------------ */

function TokensDemo() {
  const tokens = readThemeTokens()
  const rows: Array<[string, string]> = [
    ['fg / fg2 / fg3', `${tokens.fg} · ${tokens.fg2} · ${tokens.fg3}`],
    ['grid', tokens.grid],
    ['surface', tokens.surface],
    ['chart 色板', tokens.chart.join(' · ')],
  ]

  return (
    <div className="w-full space-y-2.5">
      <div className="flex items-center gap-1.5">
        {tokens.chart.map((color) => (
          <span
            key={color}
            title={color}
            className="h-8 flex-1 rounded-sm border border-line"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <div className="space-y-1 text-[0.6875rem]">
        {rows.map(([label, value]) => (
          <p key={label} className="flex gap-2">
            <span className="w-28 shrink-0 text-fg-3">{label}</span>
            <span className="min-w-0 truncate font-mono text-fg-2">{value}</span>
          </p>
        ))}
      </div>
      <p className="text-2xs leading-5 text-fg-4">
        这些值由 useChartTokens() 在主题变化时重新解析：CSS 变量不能直接交给 Canvas， 否则 ECharts
        会静默忽略并回退成默认深色。
      </p>
    </div>
  )
}

/* ------------------------------ 8. 写法约定 ------------------------------ */

function UsageDemo() {
  const items = [
    {
      icon: <ChartLine className="size-3.5" />,
      title: '读令牌',
      desc: 'useChartTokens() 订阅主题，颜色一律取自 tokens',
    },
    {
      icon: <Table2 className="size-3.5" />,
      title: 'useMemo',
      desc: 'option 依赖 tokens 与数据，避免每次渲染重建',
    },
    {
      icon: <ChartBar className="size-3.5" />,
      title: '传 height',
      desc: '数字按设计像素转 rem，单位与其它尺寸一致',
    },
    {
      icon: <ChartPie className="size-3.5" />,
      title: '按需加载',
      desc: 'EChart 在首屏空闲时才拉 echarts，不抢关键带宽',
    },
  ]
  return (
    <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.title}
          className="flex items-start gap-2 rounded-md border border-line p-2.5"
        >
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-sm bg-primary-weak text-primary">
            {item.icon}
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-medium text-fg">{item.title}</span>
            <span className="block text-2xs leading-5 text-fg-3">{item.desc}</span>
          </span>
        </div>
      ))}
      <div className="sm:col-span-2">
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface-2/40 px-2.5 py-2">
          <Badge tone="warning" variant="outline" size="sm">
            常见坑
          </Badge>
          <span className="text-2xs leading-5 text-fg-3">
            不要写 <code className="font-mono">color: &quot;var(--n-chart-1)&quot;</code>
            ；也不要同一张图既传 tokens 又让图表自己订阅主题（会双重重绘）。
          </span>
        </div>
      </div>
    </div>
  )
}

/* ================================================================== *
 * 分类定义
 * ================================================================== */

export const chartsCategory: GalleryCategory = {
  id: 'charts',
  name: 'Charts',
  title: '图表封装',
  description: '基于 ECharts 6 的轻封装：主题令牌联动、首屏空闲加载、字号随根字号缩放',
  items: [
    {
      key: 'chart-line',
      name: 'EChart · 折线',
      nameZh: '折线 / 面积图',
      summary: '双轴趋势的标准写法：面积可切换、tooltip 跟随、颜色取自设计令牌',
      demo: LineDemo,
      wide: true,
      previewHeight: 300,
      keywords: ['zhexiantu', 'line', 'area', 'qushi', 'chart', 'tubiao'],
      code: `import { EChart, useChartTokens } from '@/components/charts/echart'

const tokens = useChartTokens()

<EChart
  tokens={tokens}
  height={220}
  option={{
    grid: { left: 6, right: 10, top: 26, bottom: 2, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', boundaryGap: false, data: days, axisLabel: { color: tokens.fg3 } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: tokens.grid, type: 'dashed' } } },
    series: [{ name: '交易额', type: 'line', smooth: 0.35, areaStyle: { opacity: 0.18 }, data }],
  }}
/>`,
      props: [
        {
          name: 'option',
          type: 'ChartOption',
          desc: '原生 ECharts option（必填）；颜色请用 tokens，别写 var(--x)',
        },
        {
          name: 'height',
          type: 'number | string',
          default: '280',
          desc: '数字按设计像素换算成 rem，随根字号缩放',
        },
        { name: 'tokens', type: 'ChartTokens', desc: '外部传入令牌，避免每张图各自订阅主题' },
        { name: 'loading', type: 'boolean', desc: '显示 ECharts 内置 loading' },
        { name: 'group', type: 'string', desc: '多图联动分组（echarts.connect）' },
        { name: 'onClick', type: '(params: unknown) => void', desc: '点击事件回调' },
      ],
    },
    {
      key: 'chart-bar',
      name: 'EChart · 柱状',
      nameZh: '柱状图',
      summary: '分类对比的首选；圆角柱体在深浅色下都不会糊在一起',
      demo: BarDemo,
      wide: true,
      previewHeight: 280,
      keywords: ['zhuzhuangtu', 'bar', 'column'],
      code: `<EChart
  tokens={tokens}
  height={220}
  option={{
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'category', data: days },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', barWidth: '46%', itemStyle: { borderRadius: [4, 4, 0, 0] }, data }],
  }}
/>`,
    },
    {
      key: 'chart-pie',
      name: 'EChart · 饼 / 环',
      nameZh: '饼图 / 环形图',
      summary: '占比表达；环形更省视觉重量，中心可放总计',
      demo: PieDemo,
      wide: true,
      previewHeight: 300,
      keywords: ['bingtu', 'huanxingtu', 'pie', 'donut'],
      code: `<EChart
  tokens={tokens}
  height={230}
  option={{
    series: [{
      type: 'pie',
      radius: ['46%', '70%'],
      itemStyle: { borderRadius: 4, borderColor: tokens.surface, borderWidth: 2 },
      data: channels,
    }],
  }}
/>`,
    },
    {
      key: 'chart-radar',
      name: 'EChart · 雷达',
      nameZh: '雷达图',
      summary: '多维评分对比；以全区间峰值为基准，避免退化成方形',
      demo: RadarDemo,
      wide: true,
      previewHeight: 300,
      keywords: ['leidatu', 'radar'],
      code: `<EChart
  tokens={tokens}
  height={260}
  option={{
    radar: { indicator: [{ name: '可用性', max: 100 }, { name: '性能', max: 100 }] },
    series: [{ type: 'radar', areaStyle: { opacity: 0.2 }, data: [{ value: [95, 88] }] }],
  }}
/>`,
    },
    {
      key: 'chart-gauge',
      name: 'EChart · 仪表盘',
      nameZh: '仪表盘',
      summary: '单指标达成率；指针 + 进度弧，阈值语义由颜色承担',
      demo: GaugeDemo,
      wide: true,
      previewHeight: 300,
      keywords: ['yibiaopan', 'gauge', 'sla'],
      code: `<EChart
  tokens={tokens}
  height={230}
  option={{
    series: [{
      type: 'gauge',
      startAngle: 210,
      endAngle: -30,
      progress: { show: true, width: 12, roundCap: true },
      axisLine: { lineStyle: { width: 12, color: [[1, tokens.grid]] } },
      data: [{ value: 92.4, name: '本月 SLA' }],
    }],
  }}
/>`,
    },
    {
      key: 'chart-funnel',
      name: 'EChart · 横向条形',
      nameZh: '漏斗 / 排行',
      summary: '用横向条形模拟漏斗：背景条给出「还有多少空间」',
      demo: FunnelDemo,
      wide: true,
      previewHeight: 280,
      keywords: ['loudou', 'funnel', 'paihang', 'rank'],
      code: `<EChart
  tokens={tokens}
  height={230}
  option={{
    grid: { right: 44, containLabel: true },
    xAxis: { type: 'value', show: false, max: 100 },
    yAxis: { type: 'category', data: stages },
    series: [{
      type: 'bar',
      barWidth: 14,
      showBackground: true,
      backgroundStyle: { color: tokens.grid, opacity: 0.5, borderRadius: 7 },
      label: { show: true, position: 'right', formatter: '{c}%' },
      data,
    }],
  }}
/>`,
    },
    {
      key: 'chart-tokens',
      name: 'ChartTokens',
      nameZh: '图表主题令牌',
      summary: '把 CSS 变量解析成具体色值，并在主题切换时驱动图表重绘',
      demo: TokensDemo,
      wide: true,
      previewHeight: 210,
      keywords: ['zhuti', 'tokens', 'theme', 'yanse'],
      code: `import { useChartTokens, readThemeTokens } from '@/components/charts/echart'

// 组件内订阅（主题变化自动重绘）
const tokens = useChartTokens()

// 命令式读取（option 在事件回调里生成时）
const snapshot = readThemeTokens()

// 为什么不能写 var(--n-chart-1)：
// Canvas 渲染器解析不了 CSS 变量，非法颜色被静默忽略 → 深色下坐标轴文字"消失"`,
      props: [
        { name: 'fg / fg2 / fg3 / fg4', type: 'string', desc: '四级文字色' },
        { name: 'grid / gridSubtle', type: 'string', desc: '分割线与网格' },
        { name: 'surface', type: 'string', desc: '图表背景 / tooltip 底色' },
        { name: 'chart', type: '[string × 6]', desc: '图表色板，随强调色切换' },
        { name: 'version', type: 'number', desc: '内部计数，用于触发 setOption' },
      ],
    },
    {
      key: 'chart-usage',
      name: '创建图表',
      nameZh: '写法约定',
      summary: '四步：读令牌 → useMemo 生成 option → 传 height → 交给 EChart',
      demo: UsageDemo,
      wide: true,
      previewHeight: 200,
      keywords: ['yongfa', 'usage', 'howto'],
      code: `function RevenueChart() {
  const tokens = useChartTokens()
  const option = useMemo(() => ({
    grid: { left: 6, right: 10, top: 26, bottom: 2, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: days },
    yAxis: { type: 'value' },
    series: [{ type: 'line', smooth: 0.35, data: revenue }],
  }), [tokens, days, revenue])

  return <EChart option={option} tokens={tokens} height={280} />
}`,
    },
  ],
}
