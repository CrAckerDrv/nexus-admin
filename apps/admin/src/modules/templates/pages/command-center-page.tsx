import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Maximize2, RefreshCw } from 'lucide-react'
import { EChart, type ChartOption } from '@/components/charts/echart'
import { cn } from '@nexus/ui'
import { ScreenNumber } from './screen-primitives'

/**
 * 运营数据大屏（极简版）
 *
 * 独立页面（`standalone: true`）：不套侧栏 / 顶栏 / 页签，从侧栏以新标签页打开。
 *
 * 设计取向 —— 不做「科技感边框」，走极简高端：
 * 1. 近黑底 + 极淡白噪边框，靠**留白与层级**而不是描边划分区块
 * 2. 数字用白色等宽体做主角，强调色只出现在折线与极少数数值上
 * 3. 分隔用 1px 发丝线（rgba(255,255,255,.06)），不用卡片盒子堆叠
 * 4. 地图去掉 visualMap 图例框与高亮描边，只保留色阶本身
 * 5. 全部图表共享一套「无轴线、极淡网格」的令牌，避免 ECharts 默认样式打断调性
 */

/* ------------------------------ 令牌 ------------------------------ */

const T = {
  bg: '#07080b',
  bgSoft: '#0b0d12',
  line: 'rgba(255,255,255,0.07)',
  lineSoft: 'rgba(255,255,255,0.04)',
  fg: '#f3f5f9',
  fg2: '#9aa2b1',
  fg3: '#666e7d',
  fg4: '#454c59',
  accent: '#5b8cff',
  accentSoft: 'rgba(91,140,255,0.16)',
  mint: '#3ddc97',
  rose: '#ff7a6b',
  gold: '#e3b341',
  violet: '#a78bfa',
} as const

const SERIES_COLORS = [T.accent, T.accent, T.violet, T.gold, T.mint, T.rose]

/* ------------------------------ 数据 ------------------------------ */

const HERO = { label: '今日交易总额', value: 8527638, unit: '元', delta: 23.45 }

const KPIS = [
  { label: '订单总数', value: '125,680', unit: '单', delta: 18.23 },
  { label: '新增用户', value: '33,219', unit: '人', delta: 15.62 },
  { label: '活跃用户', value: '83,666', unit: '人', delta: 12.45 },
  { label: '客单价', value: '173.07', unit: '元', delta: 5.23 },
  { label: '毛利总额', value: '12,695', unit: '元', delta: 19.21 },
  { label: '毛利率', value: '29.20', unit: '%', delta: 2.35 },
  { label: '退款率', value: '1.24', unit: '%', delta: -0.86 },
]

type TabKey = 'overview' | 'users' | 'products' | 'orders' | 'marketing' | 'channels'

const TABS: Array<{ key: TabKey; label: string; unit: string; series: [number[], number[]] }> = [
  {
    key: 'overview',
    label: '运营总览',
    unit: '交易额（万元）',
    series: [
      [42, 58, 51, 67, 62, 78, 71, 86, 79, 94, 88, 103, 96, 112, 108, 121],
      [28, 34, 31, 41, 38, 46, 44, 52, 49, 58, 55, 64, 61, 70, 68, 76],
    ],
  },
  {
    key: 'users',
    label: '用户分析',
    unit: '用户（千人）',
    series: [
      [18, 22, 26, 25, 31, 34, 33, 39, 42, 41, 47, 51, 50, 56, 59, 63],
      [10, 12, 15, 14, 18, 21, 20, 25, 27, 26, 31, 34, 33, 38, 40, 44],
    ],
  },
  {
    key: 'products',
    label: '商品分析',
    unit: '销量（千件）',
    series: [
      [64, 61, 68, 72, 70, 76, 81, 78, 85, 83, 88, 92, 90, 95, 99, 104],
      [40, 38, 43, 46, 45, 49, 52, 50, 55, 53, 57, 60, 58, 62, 65, 68],
    ],
  },
  {
    key: 'orders',
    label: '交易分析',
    unit: '订单（千单）',
    series: [
      [52, 55, 51, 60, 57, 66, 62, 71, 68, 77, 73, 82, 79, 88, 85, 94],
      [33, 35, 32, 39, 37, 44, 41, 48, 46, 53, 50, 57, 55, 62, 60, 67],
    ],
  },
  {
    key: 'marketing',
    label: '营销分析',
    unit: '参与人数（千人）',
    series: [
      [22, 29, 26, 35, 32, 41, 38, 47, 44, 53, 50, 59, 56, 65, 62, 71],
      [12, 16, 14, 20, 18, 24, 22, 28, 26, 32, 30, 36, 34, 40, 38, 44],
    ],
  },
  {
    key: 'channels',
    label: '渠道分析',
    unit: '访客（千人）',
    series: [
      [80, 76, 84, 88, 85, 92, 96, 93, 100, 104, 101, 108, 112, 109, 116, 120],
      [45, 43, 48, 51, 49, 54, 57, 55, 60, 63, 61, 66, 69, 67, 72, 75],
    ],
  },
]

const CHANNELS = [
  { name: '自然搜索', value: 38.26 },
  { name: '直接访问', value: 24.38 },
  { name: '社交媒体', value: 15.22 },
  { name: '广告投放', value: 12.45 },
  { name: '活动推广', value: 6.32 },
  { name: '其他渠道', value: 3.37 },
]

const REGIONS = [
  { name: '华东', value: 2856369, delta: 23.45 },
  { name: '华南', value: 2154789, delta: 18.32 },
  { name: '华北', value: 1256389, delta: 15.23 },
  { name: '华中', value: 1025680, delta: 12.56 },
  { name: '西南', value: 856214, delta: 9.34 },
  { name: '西北', value: 378197, delta: 8.21 },
]

const PROVINCES: Array<[string, number]> = [
  ['广东', 1280], ['江苏', 1020], ['浙江', 960], ['山东', 720], ['河南', 480],
  ['四川', 520], ['湖北', 460], ['湖南', 420], ['河北', 380], ['福建', 440],
  ['安徽', 340], ['上海', 860], ['北京', 820], ['辽宁', 280], ['陕西', 260],
  ['江西', 240], ['重庆', 320], ['云南', 210], ['广西', 200], ['山西', 180],
  ['内蒙古', 120], ['贵州', 140], ['黑龙江', 160], ['吉林', 130], ['新疆', 110],
  ['甘肃', 90], ['海南', 80], ['宁夏', 45], ['青海', 40], ['西藏', 25],
  ['天津', 300], ['香港', 180], ['澳门', 60], ['台湾', 260],
]

const FUNNEL = [
  { name: '访客', value: 256780 },
  { name: '浏览商品', value: 98654 },
  { name: '加入购物车', value: 32568 },
  { name: '提交订单', value: 18756 },
  { name: '支付完成', value: 12568 },
]

const ACTIVITIES = [
  { name: '春季促销', joined: 152689, orders: 18256, roi: 4.32 },
  { name: '会员日', joined: 98654, orders: 12563, roi: 3.85 },
  { name: '新品发布', joined: 86254, orders: 9856, roi: 3.21 },
  { name: '限时秒杀', joined: 65328, orders: 8745, roi: 2.98 },
]

const PRODUCTS = [
  { name: '智能手环 Pro', amount: 256369, delta: 18.23 },
  { name: '无线耳机 X5', amount: 198745, delta: 12.45 },
  { name: '高端保温杯', amount: 156320, delta: 23.45 },
  { name: '运动跑鞋', amount: 125698, delta: -3.12 },
  { name: '便携充电宝', amount: 98654, delta: 15.23 },
]

const AGES = [
  { name: '18-24', value: 24.56 },
  { name: '25-34', value: 41.23 },
  { name: '35-44', value: 21.45 },
  { name: '45+', value: 12.76 },
]

const DEVICES = [
  { name: 'iOS', value: 42.8 },
  { name: 'Android', value: 38.4 },
  { name: 'Web', value: 14.6 },
  { name: '小程序', value: 4.2 },
]

/**
 * 确定性序列：避免每次渲染漂移
 *
 * 用「中等趋势 + 双频波动 + 阶梯噪声」叠加，而不是单纯 index * k 线性递增 ——
 * 后者画出来是一条笔直的斜线，没有真实经营数据该有的呼吸感。
 */
const WAVE = (index: number) =>
  Math.sin(index / 1.5) * 0.5 + Math.sin(index / 3.7 + 0.9) * 0.32 + ((index * 37) % 13) / 26 - 0.25

const GROWTH_DAYS = Array.from({ length: 16 }, (_, index) => ({
  label: `${String(15 + index).padStart(2, '0')}日`,
  newUsers: Math.round(56000 + index * 700 + WAVE(index) * 26000),
  activeUsers: Math.round(96000 + index * 1500 + WAVE(index + 4) * 30000),
}))

const ORDER_DAYS = Array.from({ length: 16 }, (_, index) => ({
  label: `${String(15 + index).padStart(2, '0')}日`,
  orders: Math.round(10800 + index * 160 + WAVE(index + 2) * 5200),
  amount: Math.round(8200 + index * 120 + WAVE(index + 6) * 3800),
}))

const HOURS = Array.from({ length: 24 }, (_, hour) => ({
  label: `${String(hour).padStart(2, '0')}:00`,
  value: Math.round(
    600 + Math.sin((hour - 4) / 3.4) * 520 + (hour >= 9 && hour <= 22 ? 780 : 0) + ((hour * 37) % 90),
  ),
}))

/* ------------------------------ 基础块 ------------------------------ */

/** 区块：只靠发丝线分隔，不做卡片盒子 */
function Section({
  title,
  extra,
  children,
  className,
  dense,
}: {
  title: ReactNode
  extra?: ReactNode
  children: ReactNode
  className?: string
  dense?: boolean
}) {
  return (
    <section className={cn('flex min-w-0 flex-col', className)}>
      <header className={cn('flex items-center gap-2', dense ? 'pb-1.5' : 'pb-2.5')}>
        <h2 className="text-[0.6875rem] font-medium tracking-[0.14em] text-[#9aa2b1] uppercase">
          {title}
        </h2>
        {extra && <div className="ml-auto flex shrink-0 items-center gap-2">{extra}</div>}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}

function Delta({ value, className }: { value: number; className?: string }) {
  const up = value >= 0
  return (
    <span
      className={cn('inline-flex items-center gap-0.5 text-[0.6875rem] tabular-nums', className)}
      style={{ color: up ? T.mint : T.rose }}
    >
      {up ? <ArrowUpRight className="size-3" strokeWidth={2} /> : <ArrowDownRight className="size-3" strokeWidth={2} />}
      {Math.abs(value).toFixed(2)}%
    </span>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <span className="text-[0.6875rem] tracking-wide text-[#666e7d]">{children}</span>
}

/** 迷你横向条：用于区域与商品排行，纯 CSS */
function Bar({ ratio, tone = T.accent }: { ratio: number; tone?: string }) {
  return (
    <span className="block h-[0.1875rem] w-full overflow-hidden rounded-full" style={{ backgroundColor: T.lineSoft }}>
      <span
        className="block h-full rounded-full"
        style={{
          width: `${Math.max(2, Math.min(100, ratio * 100))}%`,
          backgroundColor: tone,
          opacity: 0.85,
        }}
      />
    </span>
  )
}

/* ------------------------------ 页面 ------------------------------ */

export default function CommandCenterPage() {
  const [clock, setClock] = useState('')
  const [tab, setTab] = useState<TabKey>('overview')
  const [trend, setTrend] = useState<'day' | 'hour'>('day')
  const [mapReady, setMapReady] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  /** 地图按需注册：59KB geojson 只有这个页面加载 */
  useEffect(() => {
    let alive = true
    void import('@/components/charts/echart-map').then(({ ensureChinaMap }) => {
      ensureChinaMap()
      if (alive) setMapReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

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

  /* --------------------------- 图表 --------------------------- */

  /** 图表统一令牌：无轴线、极淡网格、留白优先 */
  const tokens = useMemo(
    () => ({
      fg: T.fg,
      fg2: T.fg2,
      fg3: T.fg3,
      fg4: T.fg4,
      grid: T.lineSoft,
      gridSubtle: 'rgba(255,255,255,0.025)',
      surface: '#0d1016',
      chart: [T.accent, T.violet, T.gold, T.mint, T.rose, '#22d3ee'] as [
        string,
        string,
        string,
        string,
        string,
        string,
      ],
      version: 0,
    }),
    [],
  )

  const activeTab = TABS.find((item) => item.key === tab) ?? TABS[0]!

  const heroOption = useMemo<ChartOption>(() => {
    const [primary, secondary] = activeTab.series
    return {
      grid: { left: 0, right: 0, top: 8, bottom: 0, containLabel: false },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        show: false,
        data: primary!.map((_, index) => String(index)),
      },
      yAxis: { type: 'value', show: false, min: 'dataMin', max: 'dataMax' },
      series: [
        {
          type: 'line',
          smooth: 0.4,
          symbol: 'none',
          data: primary,
          lineStyle: { width: 1.6, color: T.accent },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(91,140,255,0.26)' },
                { offset: 1, color: 'rgba(91,140,255,0)' },
              ],
            },
          },
        },
        {
          type: 'line',
          smooth: 0.4,
          symbol: 'none',
          data: secondary,
          lineStyle: { width: 1.2, color: 'rgba(167,139,250,0.55)', type: 'dashed' },
        },
      ],
    }
  }, [activeTab])

  const channelOption = useMemo<ChartOption>(
    () => ({
      tooltip: { trigger: 'item', formatter: '{b}<br/>{c}%' },
      series: [
        {
          type: 'pie',
          radius: ['68%', '88%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: T.bg, borderWidth: 3 },
          label: { show: false },
          labelLine: { show: false },
          data: CHANNELS.map((item, index) => ({
            name: item.name,
            value: item.value,
            itemStyle: { color: SERIES_COLORS[index] ?? T.accent },
          })),
        },
      ],
    }),
    [],
  )

  const growthOption = useMemo<ChartOption>(
    () => ({
      grid: { left: 2, right: 4, top: 18, bottom: 2, containLabel: true },
      legend: {
        right: 0,
        top: 0,
        itemWidth: 6,
        itemHeight: 6,
        itemGap: 12,
        textStyle: { color: T.fg3, fontSize: 10 },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: GROWTH_DAYS.map((item) => item.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: T.fg4, fontSize: 10, interval: 3 },
      },
      yAxis: {
        type: 'value',
        // 上下留 8% 余量：折线贴边会显得「被裁掉」，留白后曲线才有呼吸感
        scale: true,
        splitLine: { lineStyle: { color: T.lineSoft } },
        axisLabel: { color: T.fg4, fontSize: 10, formatter: '{value}k' },
      },
      series: [
        {
          name: '新增用户',
          type: 'line',
          smooth: 0.35,
          symbol: 'none',
          data: GROWTH_DAYS.map((item) => item.newUsers),
          lineStyle: { width: 1.6, color: T.accent },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(91,140,255,0.18)' },
                { offset: 1, color: 'rgba(91,140,255,0)' },
              ],
            },
          },
        },
        {
          name: '活跃用户',
          type: 'line',
          smooth: 0.35,
          symbol: 'none',
          data: GROWTH_DAYS.map((item) => item.activeUsers),
          lineStyle: { width: 1.4, color: T.violet },
        },
      ],
    }),
    [],
  )

  const orderOption = useMemo<ChartOption>(() => {
    if (trend === 'hour') {
      return {
        grid: { left: 2, right: 4, top: 12, bottom: 2, containLabel: true },
        xAxis: {
          type: 'category',
          data: HOURS.map((item) => item.label),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: T.fg4, fontSize: 9, interval: 3 },
        },
        yAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: T.lineSoft } },
          axisLabel: { color: T.fg4, fontSize: 10 },
        },
        series: [
          {
            type: 'bar',
            barWidth: '52%',
            data: HOURS.map((item) => item.value),
            itemStyle: { borderRadius: [2, 2, 0, 0], color: 'rgba(91,140,255,0.62)' },
          },
        ],
      }
    }
    return {
      grid: { left: 2, right: 2, top: 18, bottom: 2, containLabel: true },
      xAxis: {
        type: 'category',
        data: ORDER_DAYS.map((item) => item.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: T.fg4, fontSize: 10, interval: 3 },
      },
      yAxis: [
        {
          type: 'value',
          splitLine: { lineStyle: { color: T.lineSoft } },
          axisLabel: { color: T.fg4, fontSize: 10, formatter: '{value}k' },
        },
        { type: 'value', splitLine: { show: false }, axisLabel: { show: false } },
      ],
      series: [
        {
          name: '订单',
          type: 'bar',
          barWidth: '46%',
          data: ORDER_DAYS.map((item) => item.orders),
          itemStyle: { borderRadius: [2, 2, 0, 0], color: 'rgba(91,140,255,0.5)' },
        },
        {
          name: '交易额',
          type: 'line',
          yAxisIndex: 1,
          smooth: 0.35,
          symbol: 'none',
          data: ORDER_DAYS.map((item) => item.amount),
          lineStyle: { width: 1.4, color: T.mint },
        },
      ],
    }
  }, [trend])

  const mapOption = useMemo<ChartOption>(
    () => ({
      tooltip: {
        trigger: 'item',
        formatter: (params: unknown) => {
          const p = params as { name?: string; value?: number }
          const value = Number(p.value ?? 0)
          return `${p.name ?? ''} · ${Number.isFinite(value) ? value.toLocaleString() : '—'} 万元`
        },
      },
      series: [
        {
          type: 'map',
          map: 'china',
          roam: false,
          zoom: 1.16,
          top: 2,
          bottom: 2,
          itemStyle: {
            areaColor: '#12161e',
            borderColor: 'rgba(120,150,200,0.16)',
            borderWidth: 0.5,
          },
          emphasis: {
            itemStyle: { areaColor: 'rgba(91,140,255,0.55)', borderColor: 'transparent' },
            label: { show: false },
          },
          select: { disabled: true },
          label: { show: false },
          data: PROVINCES.map(([name, value]) => ({ name, value })),
          /** 用视觉映射代替图例框：低=深灰，高=强调蓝 */
          visualMap: undefined,
        },
      ],
      visualMap: {
        show: false,
        min: 0,
        max: 1300,
        inRange: {
          color: ['#141922', '#1c2740', '#26395f', '#34538c', '#4a76c8', '#5b8cff'],
        },
      },
    }),
    [],
  )

  const funnelOption = useMemo<ChartOption>(
    () => ({
      series: [
        {
          type: 'funnel',
          top: 0,
          bottom: 0,
          left: '2%',
          right: '2%',
          minSize: '22%',
          sort: 'descending',
          gap: 2,
          label: { show: false },
          labelLine: { show: false },
          itemStyle: { borderWidth: 0 },
          emphasis: { label: { show: false } },
          data: FUNNEL.map((item, index) => ({
            name: item.name,
            value: item.value,
            itemStyle: { color: `rgba(91,140,255,${0.62 - index * 0.09})` },
          })),
        },
      ],
    }),
    [],
  )

  const donut = (data: Array<{ name: string; value: number }>, colors: string[]): ChartOption => ({
    series: [
      {
        type: 'pie',
        radius: ['62%', '86%'],
        center: ['50%', '50%'],
        itemStyle: { borderColor: T.bg, borderWidth: 2 },
        label: { show: false },
        labelLine: { show: false },
        data: data.map((item, index) => ({
          name: item.name,
          value: item.value,
          itemStyle: { color: colors[index] ?? T.accent },
        })),
      },
    ],
  })

  const ageOption = useMemo(() => donut(AGES, [T.accent, T.violet, T.gold, T.mint]), [])
  const deviceOption = useMemo(() => donut(DEVICES, [T.accent, T.violet, T.mint, T.gold]), [])

  const maxRegion = Math.max(...REGIONS.map((item) => item.value))
  const maxProduct = Math.max(...PRODUCTS.map((item) => item.amount))

  /* --------------------------- 渲染 --------------------------- */

  return (
    <div
      className="relative min-h-dvh w-full"
      style={{
        backgroundColor: T.bg,
        color: T.fg,
        // 顶部一层极淡的冷色光晕，制造「屏幕在发光」的高端感，但不抢内容
        backgroundImage:
          'radial-gradient(ellipse 60% 42% at 50% -14%, rgba(91,140,255,0.10), transparent 70%)',
      }}
    >
      <div className="mx-auto w-full max-w-[105rem] px-5 pt-4 pb-3 xl:px-8">
        {/* ---------------- 顶栏 ---------------- */}
        <header className="flex items-center gap-4 border-b pb-3" style={{ borderColor: T.line }}>
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="relative flex size-1.5">
              <span
                className="absolute inline-flex size-full animate-ping rounded-full opacity-60"
                style={{ backgroundColor: T.mint }}
              />
              <span
                className="relative inline-flex size-1.5 rounded-full"
                style={{ backgroundColor: T.mint }}
              />
            </span>
            <h1 className="truncate text-[0.8125rem] font-medium tracking-[0.18em] text-[#f3f5f9]">
              运营数据大屏
            </h1>
            <span className="hidden text-[0.6875rem] tabular-nums sm:inline" style={{ color: T.fg3 }}>
              {clock}
            </span>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-3 text-[0.6875rem]">
            <span className="hidden tabular-nums lg:inline" style={{ color: T.fg3 }}>
              数据更新于 15:48:42
            </span>
            <button
              type="button"
              onClick={() => {
                setRefreshing(true)
                setTimeout(() => setRefreshing(false), 700)
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-white/5"
              style={{ color: T.fg2 }}
            >
              <RefreshCw className={cn('size-3', refreshing && 'animate-spin')} />
              <span className="hidden sm:inline">刷新</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen()
                else void document.documentElement.requestFullscreen()
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-white/5"
              style={{ color: T.fg2 }}
            >
              <Maximize2 className="size-3" />
              <span className="hidden sm:inline">全屏</span>
            </button>
          </div>
        </header>

        {/* ---------------- Hero：一个数字撑起整屏 ---------------- */}
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 border-b py-5 lg:grid-cols-[minmax(17.5rem,21.25rem)_minmax(0,1fr)] pb-6" style={{ borderColor: T.line }}>
          <div className="min-w-0">
            <Label>{HERO.label}</Label>
            <div className="mt-1.5 flex items-end gap-2">
              <span
                className="font-mono text-[2.125rem] leading-none font-light tracking-tight tabular-nums sm:text-[2.625rem]"
                style={{ color: T.fg, textShadow: '0 0 32px rgba(91,140,255,0.30)' }}
              >
                <ScreenNumber value={HERO.value} duration={1600} />
              </span>
              <span className="pb-1 text-[0.75rem]" style={{ color: T.fg3 }}>
                {HERO.unit}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Delta value={HERO.delta} />
              <span className="text-[0.6875rem]" style={{ color: T.fg4 }}>
                较昨日
              </span>
            </div>
            <div className="mt-3 h-[2.875rem] w-full">
              <EChart option={heroOption} height={46} tokens={tokens} />
            </div>
          </div>

          {/* 7 项 KPI：用发丝竖线分隔，不用卡片 */}
          <div className="grid grid-cols-2 gap-y-3 sm:grid-cols-4 xl:grid-cols-7">
            {KPIS.map((item, index) => (
              <div
                key={item.label}
                className={cn('min-w-0 px-3', index !== 0 && 'sm:border-l')}
                style={{ borderColor: T.line }}
              >
                <p className="truncate text-[0.625rem] tracking-wide" style={{ color: T.fg4 }}>
                  {item.label}
                </p>
                <p className="mt-1.5 truncate font-mono text-[1.0625rem] leading-none font-medium tabular-nums" style={{ color: T.fg }}>
                  <ScreenNumber value={item.value} duration={1200 + index * 90} />
                  <span className="ml-0.5 text-[0.625rem] font-normal" style={{ color: T.fg4 }}>
                    {item.unit}
                  </span>
                </p>
                <div className="mt-1.5">
                  <Delta value={item.delta} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ---------------- 第一行：趋势 + 渠道 ---------------- */}
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 border-b py-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]" style={{ borderColor: T.line }}>
          <Section
            title="经营趋势"
            extra={
              <span className="flex items-center gap-3 text-[0.625rem]" style={{ color: T.fg4 }}>
                <span className="inline-flex items-center gap-1">
                  <span className="h-px w-3" style={{ backgroundColor: T.accent }} />
                  本期
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-px w-3 border-t border-dashed" style={{ borderColor: T.violet }} />
                  上期
                </span>
                <span>{activeTab.unit}</span>
              </span>
            }
          >
            <EChart option={growthOption} height={168} tokens={tokens} />
          </Section>

          <Section
            title="流量结构"
            extra={<span className="text-[0.625rem]" style={{ color: T.fg4 }}>总访客 256,780</span>}
          >
            <div className="flex items-center gap-4">
              <div className="relative size-[7.75rem] shrink-0">
                <EChart option={channelOption} height={124} tokens={tokens} />
                <span className="pointer-events-none absolute inset-0 grid place-items-center">
                  <span className="text-center">
                    <span className="block text-[0.5625rem]" style={{ color: T.fg4 }}>
                      自然搜索占比
                    </span>
                    <span className="block font-mono text-[0.8125rem] font-medium tabular-nums" style={{ color: T.fg }}>
                      38.3%
                    </span>
                  </span>
                </span>
              </div>
              <ul className="min-w-0 flex-1 space-y-[0.4375rem]">
                {CHANNELS.map((item, index) => (
                  <li key={item.name} className="flex items-center gap-1.5 text-[0.6875rem]">
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: SERIES_COLORS[index] ?? T.accent }}
                    />
                    <span className="min-w-0 flex-1 truncate" style={{ color: T.fg2 }}>
                      {item.name}
                    </span>
                    <span className="shrink-0 tabular-nums" style={{ color: T.fg3 }}>
                      {item.value.toFixed(2)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Section>
        </div>

        {/* ---------------- 第二行：地图 / 漏斗 / 商品 ---------------- */}
        <div
          className="grid grid-cols-1 gap-x-6 gap-y-5 border-b py-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)_minmax(0,1fr)]"
          style={{ borderColor: T.line }}
        >
          <Section title="区域分布" extra={<Label>单位：万元</Label>}>
            {mapReady ? (
              <EChart option={mapOption} height={230} tokens={tokens} />
            ) : (
              <div className="grid h-[14.375rem] place-items-center text-[0.6875rem]" style={{ color: T.fg4 }}>
                地图加载中…
              </div>
            )}
            <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2">
              {REGIONS.map((region) => (
                <div key={region.name} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="truncate text-[0.625rem]" style={{ color: T.fg4 }}>
                      {region.name}
                    </span>
                    <span className="shrink-0 font-mono text-[0.6875rem] tabular-nums" style={{ color: T.fg2 }}>
                      {(region.value / 10000).toFixed(1)}w
                    </span>
                  </div>
                  <div className="mt-1">
                    <Bar ratio={region.value / maxRegion} />
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="转化漏斗" extra={<Label>整体 4.9%</Label>}>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <EChart option={funnelOption} height={150} tokens={tokens} />
              </div>
              <ul className="w-[7.25rem] shrink-0 space-y-[0.4375rem]">
                {FUNNEL.map((item) => (
                  <li key={item.name}>
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="truncate text-[0.625rem]" style={{ color: T.fg4 }}>
                        {item.name}
                      </span>
                      <span
                        className="shrink-0 font-mono text-[0.625rem] tabular-nums"
                        style={{ color: T.fg2 }}
                      >
                        {((item.value / 256780) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-2 border-t pt-2" style={{ borderColor: T.lineSoft }}>
              <div className="flex items-baseline justify-between">
                <span className="text-[0.625rem]" style={{ color: T.fg4 }}>
                  支付转化率
                </span>
                <span className="font-mono text-[0.9375rem] font-medium tabular-nums" style={{ color: T.mint }}>
                  4.90%
                </span>
              </div>
            </div>
          </Section>

          <Section title="商品排行" extra={<Label>按销售额</Label>}>
            <ul className="space-y-2.5">
              {PRODUCTS.map((item, index) => (
                <li key={item.name}>
                  <div className="flex items-baseline gap-2">
                    <span
                      className="w-3 shrink-0 font-mono text-[0.625rem] tabular-nums"
                      style={{ color: index === 0 ? T.gold : T.fg4 }}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[0.6875rem]" style={{ color: T.fg2 }}>
                      {item.name}
                    </span>
                    <span className="shrink-0 font-mono text-[0.6875rem] tabular-nums" style={{ color: T.fg }}>
                      {(item.amount / 10000).toFixed(1)}w
                    </span>
                    <Delta value={item.delta} className="shrink-0" />
                  </div>
                  <div className="mt-1 pl-5">
                    <Bar ratio={item.amount / maxProduct} tone={index === 0 ? T.gold : T.accent} />
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        {/* ---------------- 第三行：订单趋势 / 画像 / 活动 ---------------- */}
        <div
          className="grid grid-cols-1 gap-x-6 gap-y-5 border-b py-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1.1fr)]"
          style={{ borderColor: T.line }}
        >
          <Section
            title="订单趋势"
            extra={
              <span className="flex items-center gap-1">
                {(['day', 'hour'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTrend(mode)}
                    className="rounded px-1.5 py-0.5 text-[0.625rem] transition-colors"
                    style={{
                      color: trend === mode ? T.fg : T.fg4,
                      backgroundColor: trend === mode ? 'rgba(255,255,255,0.06)' : 'transparent',
                    }}
                  >
                    {mode === 'day' ? '按日' : '按小时'}
                  </button>
                ))}
              </span>
            }
          >
            <EChart option={orderOption} height={158} tokens={tokens} />
          </Section>

          <Section title="用户画像">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <p className="text-[0.625rem]" style={{ color: T.fg4 }}>
                  年龄
                </p>
                <EChart option={ageOption} height={76} tokens={tokens} />
                <ul className="mt-1 space-y-[0.125rem]">
                  {AGES.map((item, index) => (
                    <li key={item.name} className="flex items-center gap-1 text-[0.5625rem]">
                      <span
                        className="size-1 shrink-0 rounded-full"
                        style={{ backgroundColor: [T.accent, T.violet, T.gold, T.mint][index] }}
                      />
                      <span className="min-w-0 flex-1 truncate text-left" style={{ color: T.fg4 }}>
                        {item.name}
                      </span>
                      <span className="tabular-nums" style={{ color: T.fg3 }}>
                        <ScreenNumber value={`${item.value}%`} duration={1000} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="text-center">
                <p className="text-[0.625rem]" style={{ color: T.fg4 }}>
                  设备
                </p>
                <EChart option={deviceOption} height={76} tokens={tokens} />
                <ul className="mt-1 space-y-[0.125rem]">
                  {DEVICES.map((item, index) => (
                    <li key={item.name} className="flex items-center gap-1 text-[0.5625rem]">
                      <span
                        className="size-1 shrink-0 rounded-full"
                        style={{ backgroundColor: [T.accent, T.violet, T.mint, T.gold][index] }}
                      />
                      <span className="min-w-0 flex-1 truncate text-left" style={{ color: T.fg4 }}>
                        {item.name}
                      </span>
                      <span className="tabular-nums" style={{ color: T.fg3 }}>
                        <ScreenNumber value={`${item.value}%`} duration={1000} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Section>

          <Section title="营销活动" extra={<Label>ROI</Label>}>
            <table className="w-full text-[0.6875rem]">
              <thead>
                <tr style={{ color: T.fg4 }}>
                  <th className="pb-1.5 text-left font-normal">活动</th>
                  <th className="pb-1.5 text-right font-normal">参与</th>
                  <th className="pb-1.5 text-right font-normal">订单</th>
                  <th className="pb-1.5 text-right font-normal">ROI</th>
                </tr>
              </thead>
              <tbody>
                {ACTIVITIES.map((item) => (
                  <tr key={item.name} className="border-t" style={{ borderColor: T.lineSoft }}>
                    <td className="py-2 text-left" style={{ color: T.fg2 }}>
                      {item.name}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums" style={{ color: T.fg3 }}>
                      {(item.joined / 1000).toFixed(0)}k
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums" style={{ color: T.fg3 }}>
                      {(item.orders / 1000).toFixed(1)}k
                    </td>
                    <td
                      className="py-2 text-right font-mono tabular-nums"
                      style={{ color: item.roi >= 3.5 ? T.mint : T.gold }}
                    >
                      {item.roi.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </div>

        {/* ---------------- 底部 tab ---------------- */}
        <nav className="flex items-center gap-1 pt-3" aria-label="大屏分组">
          {TABS.map((item) => {
            const active = item.key === tab
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                aria-current={active ? 'page' : undefined}
                className="relative px-3 py-1.5 text-[0.6875rem] tracking-wide transition-colors"
                style={{ color: active ? T.fg : T.fg3 }}
              >
                {item.label}
                <span
                  className="absolute inset-x-3 -bottom-px h-px transition-opacity"
                  style={{ backgroundColor: T.accent, opacity: active ? 1 : 0 }}
                />
              </button>
            )
          })}
          <span className="ml-auto text-[0.625rem]" style={{ color: T.fg4 }}>
            数据每 30 秒自动刷新 · 演示数据
          </span>
        </nav>
      </div>
    </div>
  )
}
