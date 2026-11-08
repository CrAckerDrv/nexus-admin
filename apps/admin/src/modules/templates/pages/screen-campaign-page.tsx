import { useEffect, useMemo, useState } from 'react'
import { Flame, Gauge, Radio, Sparkles, Target, Timer, TrendingUp, Zap } from 'lucide-react'
import { EChart, type ChartOption } from '@/components/charts/echart'
import {
  Bar,
  Dot,
  FullscreenAction,
  Label,
  Panel,
  ScreenHeader,
  ScreenNumber,
  ScreenShell,
  useClock,
  type ScreenTokens,
} from './screen-primitives'

/**
 * 大促战报大屏
 *
 * 适用：电商大促 / 直播间 / 品牌战役的现场投屏。
 *
 * 与前几块屏的差异：
 * - 主角是「一个一直在涨的数字」：GMV 用等宽体 + 描边发光做大，
 *   每 2.4s 跳动一次 —— 战报屏的价值就是「现场的情绪」
 * - 红金配色：这是唯一一块允许高饱和的屏，因为它本来就是庆典场景
 * - 波次倒计时 + 品类 PK + 售罄进度：把「还有多久 / 谁在领跑 / 什么快没了」一次讲完
 * - 动效克制：只有数字与售罄条在动，其余保持绝对静止，避免满屏闪烁
 */

const T: ScreenTokens = {
  bg: '#150608',
  bgSoft: '#210a0f',
  line: 'rgba(251,113,133,0.16)',
  lineSoft: 'rgba(251,113,133,0.07)',
  fg: '#fff5f5',
  fg2: '#e3aab2',
  fg3: '#b07984',
  fg4: '#7d525b',
  accent: '#f43f5e',
  accent2: '#fbbf24',
  up: '#34d399',
  down: '#fb7185',
  warn: '#fbbf24',
}

/* ------------------------------ 数据 ------------------------------ */

/** GMV 起点：开抢 4 小时后累计 */
const GMV_START = 128_462_900

const WAVES = [
  { name: '第一波 · 开门红', time: '00:00', status: 'done' as const, gmv: 68_240_000 },
  { name: '第二波 · 早高峰', time: '08:00', status: 'done' as const, gmv: 42_180_000 },
  { name: '第三波 · 午间场', time: '12:00', status: 'live' as const, gmv: 18_042_900 },
  { name: '第四波 · 晚高峰', time: '20:00', status: 'next' as const, gmv: 0 },
]

const CHANNELS = [
  { name: '直播带货', value: 46.2, color: T.accent },
  { name: '私域社群', value: 21.4, color: T.accent2 },
  { name: '平台推荐', value: 16.8, color: '#f472b6' },
  { name: '搜索广告', value: 9.6, color: '#fb923c' },
  { name: '站外投放', value: 6.0, color: '#a78bfa' },
]

const MINUTES = Array.from({ length: 40 }, (_, index) => ({
  label: `${String(9 + Math.floor(index / 6)).padStart(2, '0')}:${String((index % 6) * 10).padStart(2, '0')}`,
  gmv: Math.round(1800 + index * 96 + Math.sin(index / 2.4) * 420 + (index % 7 === 0 ? 640 : 0)),
  orders: Math.round(96 + index * 3.4 + Math.cos(index / 3.1) * 26),
}))

const CATEGORIES = [
  { name: '数码 3C', gmv: 42.8, orders: 186_400, growth: 32.4 },
  { name: '美妆个护', gmv: 36.2, orders: 268_900, growth: 41.8 },
  { name: '服饰鞋包', gmv: 28.6, orders: 312_600, growth: 18.2 },
  { name: '家居家电', gmv: 14.4, orders: 96_200, growth: 26.7 },
  { name: '食品生鲜', gmv: 6.4, orders: 148_300, growth: 12.1 },
]

const HOT_ITEMS = [
  { name: '智能手环 Pro', price: 299, sold: 98_420, stock: 120_000, tag: '爆款' },
  { name: '无线耳机 X5', price: 499, sold: 76_280, stock: 100_000, tag: '爆款' },
  { name: '高端保温杯', price: 189, sold: 64_120, stock: 80_000, tag: '热销' },
  { name: '运动跑鞋 Air', price: 469, sold: 42_860, stock: 70_000, tag: '热销' },
  { name: '便携充电宝 2W', price: 129, sold: 38_940, stock: 40_000, tag: '将售罄' },
]

const COUNTDOWN = { hours: 3, minutes: 42, seconds: 18 }

/* ------------------------------ 页面 ------------------------------ */

export default function ScreenCampaignPage() {
  const clock = useClock()
  const [gmv, setGmv] = useState(GMV_START)
  const [tick, setTick] = useState(
    COUNTDOWN.hours * 3600 + COUNTDOWN.minutes * 60 + COUNTDOWN.seconds,
  )

  /** GMV 跳动：战报屏的核心观感，间隔比图表刷新更密（2.4s） */
  useEffect(() => {
    const timer = setInterval(() => {
      setGmv((prev) => prev + Math.round(28000 + Math.random() * 46000))
    }, 2400)
    return () => clearInterval(timer)
  }, [])

  /** 波次倒计时 */
  useEffect(() => {
    const timer = setInterval(() => setTick((prev) => (prev > 0 ? prev - 1 : 0)), 1000)
    return () => clearInterval(timer)
  }, [])

  const tokens = useMemo(
    () => ({
      fg: T.fg,
      fg2: T.fg2,
      fg3: T.fg3,
      fg4: T.fg4,
      grid: T.lineSoft,
      gridSubtle: 'rgba(251,113,133,0.03)',
      surface: T.bgSoft,
      chart: [T.accent, T.accent2, '#f472b6', '#fb923c', '#a78bfa', T.up] as [
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

  const trendOption = useMemo<ChartOption>(
    () => ({
      grid: { left: 2, right: 2, top: 20, bottom: 2, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: MINUTES.map((item) => item.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: T.fg4, fontSize: 9, interval: 5 },
      },
      yAxis: [
        {
          type: 'value',
          splitLine: { lineStyle: { color: T.lineSoft } },
          axisLabel: { color: T.fg4, fontSize: 9, formatter: '{value}w' },
        },
        { type: 'value', splitLine: { show: false }, axisLabel: { show: false } },
      ],
      series: [
        {
          name: '分时 GMV',
          type: 'line',
          smooth: 0.35,
          symbol: 'none',
          data: MINUTES.map((item) => item.gmv),
          lineStyle: { width: 1.8, color: T.accent2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(251,191,36,0.26)' },
                { offset: 1, color: 'rgba(251,191,36,0)' },
              ],
            },
          },
        },
        {
          name: '订单量',
          type: 'line',
          yAxisIndex: 1,
          smooth: 0.35,
          symbol: 'none',
          data: MINUTES.map((item) => item.orders),
          lineStyle: { width: 1.2, color: T.accent, type: 'dashed' },
        },
      ],
    }),
    [],
  )

  const radarOption = useMemo<ChartOption>(
    () => ({
      radar: {
        center: ['50%', '52%'],
        radius: '66%',
        indicator: [
          { name: '流量', max: 100 },
          { name: '转化', max: 100 },
          { name: '客单', max: 100 },
          { name: '复购', max: 100 },
          { name: '口碑', max: 100 },
        ],
        axisName: { color: T.fg3, fontSize: 9 },
        splitLine: { lineStyle: { color: T.line } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: T.line } },
      },
      series: [
        {
          type: 'radar',
          symbol: 'none',
          data: [
            {
              name: '本次大促',
              value: [92, 86, 78, 64, 88],
              lineStyle: { color: T.accent2, width: 1.6 },
              areaStyle: { color: 'rgba(251,191,36,0.18)' },
              itemStyle: { color: T.accent2 },
            },
            {
              name: '去年同期',
              value: [74, 68, 71, 58, 76],
              lineStyle: { color: T.accent, width: 1.2, type: 'dashed' },
              areaStyle: { color: 'rgba(244,63,94,0.10)' },
              itemStyle: { color: T.accent },
            },
          ],
        },
      ],
    }),
    [],
  )

  const channelOption = useMemo<ChartOption>(
    () => ({
      tooltip: { trigger: 'item', formatter: '{b}<br/>{c}%' },
      series: [
        {
          type: 'pie',
          radius: ['64%', '86%'],
          center: ['50%', '50%'],
          itemStyle: { borderColor: T.bg, borderWidth: 2 },
          label: { show: false },
          labelLine: { show: false },
          data: CHANNELS.map((item) => ({
            name: item.name,
            value: item.value,
            itemStyle: { color: item.color },
          })),
        },
      ],
    }),
    [],
  )

  const countdown = {
    h: String(Math.floor(tick / 3600)).padStart(2, '0'),
    m: String(Math.floor((tick % 3600) / 60)).padStart(2, '0'),
    s: String(tick % 60).padStart(2, '0'),
  }

  /** 第三波 12:00–20:00 共 8 小时：进度 = 已过去的部分，比「倒计时进度」更直观 */
  const waveProgress = Math.min(1, Math.max(0, (8 * 3600 - tick) / (8 * 3600)))
  const maxCategory = Math.max(...CATEGORIES.map((item) => item.gmv))

  return (
    <ScreenShell tokens={T} glow="rgba(244,63,94,0.16)">
      <ScreenHeader
        tokens={T}
        title="大促战报 · 双十一"
        meta={
          <span className="hidden text-[0.6875rem] tabular-nums sm:inline" style={{ color: T.fg3 }}>
            {clock}
          </span>
        }
        actions={
          <>
            <span className="hidden lg:inline" style={{ color: T.fg3 }}>
              2026-11-11 · 全天候
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-md px-2 py-1"
              style={{ backgroundColor: 'rgba(52,211,153,0.12)', color: T.up }}
            >
              <Radio className="size-3" />
              数据秒级同步
            </span>
            <FullscreenAction tokens={T} />
          </>
        }
      />

      {/* Hero：GMV */}
      <div
        className="grid grid-cols-1 gap-x-8 gap-y-5 border-b py-5 lg:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)]"
        style={{ borderColor: T.line }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Flame className="size-3.5" style={{ color: T.accent2 }} />
            <span className="text-[0.6875rem] tracking-[0.16em]" style={{ color: T.fg2 }}>
              今日累计 GMV
            </span>
          </div>
          <p
            className="mt-2 font-mono text-[2rem] leading-none font-bold tracking-tight tabular-nums sm:text-[2.75rem]"
            style={{ color: T.fg, textShadow: '0 0 36px rgba(251,191,36,0.35)' }}
          >
            ¥
            <ScreenNumber value={Math.round((gmv / 10000) * 10) / 10} duration={900} />
            <span className="ml-1.5 text-[1rem] font-medium" style={{ color: T.accent2 }}>
              万
            </span>
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.6875rem]">
            <span className="inline-flex items-center gap-1" style={{ color: T.up }}>
              <TrendingUp className="size-3" />
              同比 +41.2%
            </span>
            <span style={{ color: T.fg3 }}>达成率 82.4%</span>
            <span style={{ color: T.fg3 }}>目标 ¥1.56 亿</span>
          </div>

          {/* 波次倒计时 */}
          <div
            className="mt-4 rounded-lg px-3 py-2.5"
            style={{ backgroundColor: 'rgba(251,191,36,0.07)', border: `1px solid ${T.line}` }}
          >
            <div className="flex items-center gap-2">
              <Timer className="size-3.5" style={{ color: T.accent2 }} />
              <span className="text-[0.6875rem]" style={{ color: T.fg2 }}>
                距第四波「晚高峰」开抢
              </span>
              <span
                className="ml-auto flex items-baseline gap-1 font-mono text-[1rem] font-semibold tabular-nums"
                style={{ color: T.fg }}
              >
                {countdown.h}
                <span className="text-[0.5625rem] font-normal" style={{ color: T.fg4 }}>
                  时
                </span>
                {countdown.m}
                <span className="text-[0.5625rem] font-normal" style={{ color: T.fg4 }}>
                  分
                </span>
                {countdown.s}
                <span className="text-[0.5625rem] font-normal" style={{ color: T.fg4 }}>
                  秒
                </span>
              </span>
            </div>
            <div className="mt-2">
              <Bar tokens={T} ratio={waveProgress} tone={T.accent2} height={4} />
            </div>
            <div
              className="mt-1.5 flex items-center justify-between text-[0.5625rem]"
              style={{ color: T.fg4 }}
            >
              <span>第三波进行中 · 12:00–20:00</span>
              <span>
                已完成 {WAVES.filter((wave) => wave.status === 'done').length} / {WAVES.length} 波
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {[
            { label: '支付订单', value: '1,284,600', unit: '单', delta: '+38.6%' },
            { label: '支付买家', value: '986,420', unit: '人', delta: '+32.1%' },
            { label: '客单价', value: '692.40', unit: '元', delta: '+6.8%' },
            { label: '退款率', value: '1.82', unit: '%', delta: '-0.34pt' },
            { label: '直播间场观', value: '4,286', unit: '万', delta: '+52.4%' },
            { label: '爆款售罄', value: '18', unit: '款', delta: '+5 款' },
            { label: '会员贡献', value: '64.2', unit: '%', delta: '+3.4pt' },
            { label: '履约时效', value: '18.4', unit: 'h', delta: '-2.1h' },
          ].map((item, index) => (
            <div
              key={item.label}
              className="rounded-lg px-2.5 py-2"
              style={{
                backgroundColor: 'rgba(255,255,255,0.025)',
                border: `1px solid ${T.lineSoft}`,
              }}
            >
              <p className="truncate text-[0.5625rem]" style={{ color: T.fg4 }}>
                {item.label}
              </p>
              <p
                className="mt-1 truncate font-mono text-[0.9375rem] leading-none font-medium tabular-nums"
                style={{ color: T.fg }}
              >
                <ScreenNumber value={item.value} duration={1200 + index * 80} />
                <span className="ml-0.5 text-[0.5625rem] font-normal" style={{ color: T.fg4 }}>
                  {item.unit}
                </span>
              </p>
              <p className="mt-1 truncate text-[0.5625rem]" style={{ color: T.fg3 }}>
                {item.delta}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 第一行：分时 GMV + 渠道 + 雷达 */}
      <div
        className="grid grid-cols-1 gap-x-6 gap-y-5 border-b py-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,0.8fr)_minmax(0,0.9fr)]"
        style={{ borderColor: T.line }}
      >
        <Panel tokens={T} title="分时 GMV 与订单" extra={<Label tokens={T}>每 10 分钟</Label>}>
          <EChart option={trendOption} height={208} tokens={tokens} />
        </Panel>

        <Panel tokens={T} title="渠道结构" extra={<Label tokens={T}>占 GMV</Label>}>
          <div className="flex items-center gap-3">
            <div className="relative size-[7rem] shrink-0">
              <EChart option={channelOption} height={112} tokens={tokens} />
              <span className="pointer-events-none absolute inset-0 grid place-items-center">
                <span className="text-center">
                  <span className="block text-[0.5625rem]" style={{ color: T.fg4 }}>
                    直播占比
                  </span>
                  <span
                    className="block font-mono text-[0.8125rem] font-semibold tabular-nums"
                    style={{ color: T.accent2 }}
                  >
                    <ScreenNumber value="46.2%" duration={1100} />
                  </span>
                </span>
              </span>
            </div>
            <ul className="min-w-0 flex-1 space-y-1">
              {CHANNELS.map((item) => (
                <li key={item.name} className="flex items-center gap-1.5 text-[0.625rem]">
                  <Dot color={item.color} size={5} />
                  <span className="min-w-0 flex-1 truncate" style={{ color: T.fg2 }}>
                    {item.name}
                  </span>
                  <span className="shrink-0 tabular-nums" style={{ color: T.fg3 }}>
                    <ScreenNumber value={`${item.value}%`} duration={1000} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel tokens={T} title="关键指标对比" extra={<Label tokens={T}>对比去年</Label>}>
          <EChart option={radarOption} height={176} tokens={tokens} />
          <div
            className="mt-1 flex items-center justify-center gap-3 text-[0.5625rem]"
            style={{ color: T.fg4 }}
          >
            <span className="inline-flex items-center gap-1">
              <Dot color={T.accent2} size={5} />
              本次
            </span>
            <span className="inline-flex items-center gap-1">
              <Dot color={T.accent} size={5} />
              去年
            </span>
          </div>
        </Panel>
      </div>

      {/* 第二行：品类 PK + 爆款售罄 + 波次 */}
      <div
        className="grid grid-cols-1 gap-x-6 gap-y-5 border-b py-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.25fr)_minmax(0,0.85fr)]"
        style={{ borderColor: T.line }}
      >
        <Panel tokens={T} title="品类 PK" extra={<Label tokens={T}>GMV / 亿元</Label>}>
          <ul className="space-y-2.5">
            {CATEGORIES.map((item, index) => (
              <li key={item.name}>
                <div className="flex items-baseline gap-2">
                  <span
                    className="w-3 shrink-0 font-mono text-[0.625rem] tabular-nums"
                    style={{ color: index === 0 ? T.accent2 : T.fg4 }}
                  >
                    {index + 1}
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate text-[0.6875rem]"
                    style={{ color: T.fg2 }}
                  >
                    {item.name}
                  </span>
                  <span
                    className="shrink-0 font-mono text-[0.6875rem] tabular-nums"
                    style={{ color: T.fg }}
                  >
                    {item.gmv}
                  </span>
                  <span
                    className="w-11 shrink-0 text-right text-[0.5625rem] tabular-nums"
                    style={{ color: T.up }}
                  >
                    +{item.growth}%
                  </span>
                </div>
                <div className="mt-1 pl-5">
                  <Bar
                    tokens={T}
                    ratio={item.gmv / maxCategory}
                    tone={index === 0 ? T.accent2 : T.accent}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel tokens={T} title="爆款售罄进度" extra={<Label tokens={T}>实时库存</Label>}>
          <ul className="space-y-2.5">
            {HOT_ITEMS.map((item) => {
              const ratio = item.sold / item.stock
              const almost = ratio > 0.9
              return (
                <li key={item.name}>
                  <div className="flex items-baseline gap-2">
                    <span
                      className="min-w-0 flex-1 truncate text-[0.6875rem]"
                      style={{ color: T.fg2 }}
                    >
                      {item.name}
                    </span>
                    <span
                      className="shrink-0 rounded-sm px-1 py-px text-[0.5rem]"
                      style={{
                        color: almost ? T.down : T.accent2,
                        backgroundColor: almost
                          ? 'rgba(251,113,133,0.16)'
                          : 'rgba(251,191,36,0.14)',
                      }}
                    >
                      {item.tag}
                    </span>
                    <span
                      className="w-16 shrink-0 text-right font-mono text-[0.625rem] tabular-nums"
                      style={{ color: T.fg3 }}
                    >
                      {item.sold.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <Bar tokens={T} ratio={ratio} tone={almost ? T.down : T.accent2} height={4} />
                    </div>
                    <span
                      className="w-9 shrink-0 text-right font-mono text-[0.5625rem] tabular-nums"
                      style={{ color: almost ? T.down : T.fg4 }}
                    >
                      {(ratio * 100).toFixed(0)}%
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel tokens={T} title="波次战报" extra={<Label tokens={T}>全天 4 波</Label>}>
          <ol className="relative space-y-2.5 pl-4">
            <span
              className="absolute top-1 bottom-1 left-[0.3125rem] w-px"
              style={{ backgroundColor: T.line }}
              aria-hidden="true"
            />
            {WAVES.map((wave) => {
              const color =
                wave.status === 'done' ? T.up : wave.status === 'live' ? T.accent2 : T.fg4
              return (
                <li key={wave.name} className="relative">
                  <span
                    className="absolute top-1 -left-4 size-2 rounded-full"
                    style={{
                      backgroundColor: wave.status === 'next' ? T.bg : color,
                      border: `1.5px solid ${color}`,
                    }}
                    aria-hidden="true"
                  />
                  <div className="flex items-baseline gap-2">
                    <span
                      className="min-w-0 flex-1 truncate text-[0.6875rem]"
                      style={{ color: T.fg2 }}
                    >
                      {wave.name}
                    </span>
                    <span
                      className="shrink-0 font-mono text-[0.5625rem] tabular-nums"
                      style={{ color: T.fg4 }}
                    >
                      {wave.time}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[0.5625rem]" style={{ color: color }}>
                    {wave.status === 'done'
                      ? `已完成 · ¥${(wave.gmv / 10000).toLocaleString()} 万`
                      : wave.status === 'live'
                        ? `进行中 · ¥${(wave.gmv / 10000).toLocaleString()} 万`
                        : '待开抢'}
                  </p>
                </li>
              )
            })}
          </ol>
        </Panel>
      </div>

      {/* 底部：目标达成 */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 py-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'GMV 达成率',
            value: '82.4%',
            hint: '目标 1.56 亿',
            icon: Target,
            tone: T.accent2,
          },
          {
            label: '订单达成率',
            value: '86.1%',
            hint: '目标 149 万单',
            icon: Sparkles,
            tone: T.accent,
          },
          { label: '峰值 QPS', value: '42,860', hint: '发生在 00:01:12', icon: Zap, tone: T.up },
          { label: '系统可用性', value: '99.99%', hint: '大促期间零故障', icon: Gauge, tone: T.up },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 border-t pt-2.5"
            style={{ borderColor: T.lineSoft }}
          >
            <span
              className="grid size-7 shrink-0 place-items-center rounded-md"
              style={{ backgroundColor: `${item.tone}1f`, color: item.tone }}
            >
              <item.icon className="size-3.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[0.625rem]" style={{ color: T.fg4 }}>
                {item.label}
              </p>
              <p className="flex items-baseline gap-1.5">
                <span
                  className="font-mono text-[0.9375rem] font-medium tabular-nums"
                  style={{ color: T.fg }}
                >
                  <ScreenNumber value={item.value} duration={1200} />
                </span>
                <span className="truncate text-[0.5625rem]" style={{ color: T.fg4 }}>
                  {item.hint}
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>

      <footer
        className="flex flex-wrap items-center gap-3 pt-1 pb-2 text-[0.625rem]"
        style={{ color: T.fg4 }}
      >
        <span className="inline-flex items-center gap-1">
          <Flame className="size-3" />
          双十一全天战报
        </span>
        <span className="inline-flex items-center gap-1">
          <Timer className="size-3" />
          GMV 每 3 秒刷新 / 图表每 10 分钟聚合
        </span>
        <span className="ml-auto">演示数据 · 已脱敏</span>
      </footer>
    </ScreenShell>
  )
}
