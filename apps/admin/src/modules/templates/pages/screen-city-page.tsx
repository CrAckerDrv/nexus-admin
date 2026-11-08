import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Building2,
  CircleAlert,
  MapPin,
  Radio,
  Route,
  Siren,
  Users,
  Zap,
} from 'lucide-react'
import { EChart, type ChartOption } from '@/components/charts/echart'
import {
  Bar,
  Delta,
  Dot,
  FullscreenAction,
  Label,
  Panel,
  ScreenHeader,
  ScreenNumber,
  ScreenShell,
  Segmented,
  useClock,
  useRefresh,
  type ScreenTokens,
} from './screen-primitives'

/**
 * 城市运行大屏
 *
 * 适用：政务 / 城市治理 / 应急联动指挥中心。
 *
 * 与前四块屏的差异：
 * - 主对象是「网格」而不是「商品 / 主机 / 部门」：一格一格的城市切片，
 *   颜色代表事件密度，点开才看到这一格的人员、工单与处置时效
 * - 事件流是**活的**：每 2.6s 推一条新工单，鼠标悬停自动暂停，
 *   符合指挥中心「盯屏 + 逐条读」的工作方式
 * - 每个面板都带「范围」：读屏的人先知道「哪里」，再看「多少」
 */

const T: ScreenTokens = {
  bg: '#08060f',
  bgSoft: '#0e0b1a',
  line: 'rgba(167,139,250,0.13)',
  lineSoft: 'rgba(167,139,250,0.06)',
  fg: '#f2edff',
  fg2: '#a99ccb',
  fg3: '#7d71a3',
  fg4: '#544b70',
  accent: '#a78bfa',
  accent2: '#fbbf24',
  up: '#34d399',
  down: '#fb7185',
  warn: '#fbbf24',
}

/* ------------------------------ 数据 ------------------------------ */

type GridStatus = 'ok' | 'warn' | 'crit'

interface GridCell {
  id: string
  zone: string
  /** 事件密度 0-100 */
  density: number
  status: GridStatus
  incidents: number
  /** 平均处置时长（分钟） */
  handling: number
  staff: number
}

const ZONES = ['中心城区', '高新区', '经开区', '老城区', '滨江新区', '城东片区']

/** 8×12 网格矩阵：颜色越亮事件越密，红格是当前需要人盯的 */
const GRID: GridCell[] = Array.from({ length: 96 }, (_, index) => {
  const zone = ZONES[index % ZONES.length] ?? '中心城区'
  const density = Math.round(
    32 + Math.sin(index / 3.1) * 22 + Math.cos(index / 7.3) * 14 + ((index * 17) % 26),
  )
  const clamped = Math.min(100, Math.max(8, density))
  const status: GridStatus = index === 26 || index === 61 ? 'crit' : clamped > 74 ? 'warn' : 'ok'
  return {
    id: `G-${String(index + 1).padStart(3, '0')}`,
    zone,
    density: clamped,
    status,
    incidents: Math.round(clamped / 3.2),
    handling: Math.round(9 + (100 - clamped) / 6 + (index % 7)),
    staff: Math.round(6 + (index % 9)),
  }
})

interface Kpi {
  label: string
  value: string
  unit: string
  delta: number
  /** 反指标：下降是好事（事件量 / 时长 / 在办工单） */
  invert?: boolean
}

const KPIS: Kpi[] = [
  { label: '运行网格', value: '96', unit: '个', delta: 0 },
  { label: '网格在线率', value: '99.2', unit: '%', delta: 0.4 },
  { label: '今日事件', value: '1,286', unit: '件', delta: -8.6, invert: true },
  { label: '按时处置率', value: '94.7', unit: '%', delta: 2.3 },
  { label: '平均处置时长', value: '18.4', unit: '分', delta: -6.2, invert: true },
  { label: '在办工单', value: '87', unit: '单', delta: 12.5, invert: true },
]

const HOURS = Array.from({ length: 24 }, (_, hour) => ({
  label: `${String(hour).padStart(2, '0')}:00`,
  incidents: Math.round(
    18 +
      Math.sin((hour - 6) / 3.2) * 14 +
      (hour >= 7 && hour <= 9 ? 26 : 0) +
      (hour >= 17 && hour <= 19 ? 32 : 0) +
      ((hour * 13) % 11),
  ),
  minutes: Math.round(
    11 + Math.cos(hour / 2.6) * 5 + (hour >= 8 && hour <= 10 ? 9 : 0) + ((hour * 7) % 5),
  ),
}))

const DEPARTMENTS = [
  { name: '城管执法', total: 386, done: 371, ontime: 96.2 },
  { name: '市政公用', total: 264, done: 248, ontime: 93.9 },
  { name: '交通管理', total: 218, done: 205, ontime: 94.0 },
  { name: '生态环境', total: 176, done: 168, ontime: 95.5 },
  { name: '卫生健康', total: 142, done: 131, ontime: 92.4 },
  { name: '应急管理', total: 100, done: 97, ontime: 97.0 },
]

const INCIDENT_POOL = [
  { type: '占道经营', zone: '中心城区 3 号网格', level: '一般', dept: '城管执法' },
  { type: '窨井盖缺失', zone: '老城区 2 号网格', level: '紧急', dept: '市政公用' },
  { type: '交通信号故障', zone: '经开区 7 号网格', level: '紧急', dept: '交通管理' },
  { type: '垃圾分类溢出', zone: '滨江新区 1 号网格', level: '一般', dept: '生态环境' },
  { type: '路灯不亮', zone: '城东片区 4 号网格', level: '一般', dept: '市政公用' },
  { type: '噪音扰民', zone: '高新区 5 号网格', level: '一般', dept: '城管执法' },
  { type: '积水点监测告警', zone: '中心城区 8 号网格', level: '紧急', dept: '应急管理' },
  { type: '占道施工未报备', zone: '高新区 2 号网格', level: '一般', dept: '城管执法' },
  { type: '公厕设施损坏', zone: '老城区 6 号网格', level: '一般', dept: '卫生健康' },
  { type: '渣土车抛洒', zone: '经开区 3 号网格', level: '紧急', dept: '城管执法' },
]

interface FeedItem {
  id: number
  time: string
  type: string
  zone: string
  level: string
  dept: string
}

const INITIAL_FEED: FeedItem[] = [
  {
    id: 1,
    time: '15:48:26',
    type: '积水点监测告警',
    zone: '中心城区 8 号网格',
    level: '紧急',
    dept: '应急管理',
  },
  {
    id: 2,
    time: '15:47:02',
    type: '交通信号故障',
    zone: '经开区 7 号网格',
    level: '紧急',
    dept: '交通管理',
  },
  {
    id: 3,
    time: '15:45:33',
    type: '垃圾分类溢出',
    zone: '滨江新区 1 号网格',
    level: '一般',
    dept: '生态环境',
  },
  {
    id: 4,
    time: '15:44:18',
    type: '窨井盖缺失',
    zone: '老城区 2 号网格',
    level: '紧急',
    dept: '市政公用',
  },
  {
    id: 5,
    time: '15:42:51',
    type: '占道经营',
    zone: '中心城区 3 号网格',
    level: '一般',
    dept: '城管执法',
  },
]

const RESOURCES = [
  { label: '网格员在岗', ratio: 0.92, value: '412 / 448', tone: T.up },
  { label: '执法车辆', ratio: 0.78, value: '86 / 110', tone: T.accent },
  { label: '应急物资', ratio: 0.64, value: '64%', tone: T.warn },
  { label: '视频点位在线', ratio: 0.97, value: '1,284 / 1,324', tone: T.up },
]

const SATISFACTION = [
  { name: '非常满意', value: 68, color: T.accent },
  { name: '满意', value: 24, color: '#22d3ee' },
  { name: '一般', value: 6, color: T.warn },
  { name: '不满意', value: 2, color: T.down },
]

const STATUS_META: Record<GridStatus, { color: string; label: string }> = {
  ok: { color: T.up, label: '正常' },
  warn: { color: T.warn, label: '关注' },
  crit: { color: T.down, label: '告警' },
}

/* ------------------------------ 页面 ------------------------------ */

export default function ScreenCityPage() {
  const clock = useClock()
  const [refreshing, refresh] = useRefresh()
  const [range, setRange] = useState<'24h' | '12h' | '6h'>('24h')
  /**
   * 默认选中「告警」格而不是第一个格子
   *
   * 详情面板的价值在于「告诉你该处理什么」，默认给一个红色网格比给一个正常网格
   * 更能说明这块屏怎么用。G-027 正好是 GridCell 里 index 26 的 crit 格。
   */
  const [selected, setSelected] = useState('G-027')
  const [paused, setPaused] = useState(false)
  const [feed, setFeed] = useState<FeedItem[]>(INITIAL_FEED)

  /** 事件流：每 2.6s 推进一条；悬停暂停（指挥中心习惯逐条读） */
  useEffect(() => {
    if (paused) return
    let cursor = 0
    const timer = setInterval(() => {
      const template = INCIDENT_POOL[cursor % INCIDENT_POOL.length]
      cursor += 1
      if (!template) return
      const now = new Date()
      const pad = (value: number) => String(value).padStart(2, '0')
      setFeed((prev) => {
        /**
         * id 取「当前最大值 + 1」
         *
         * 不能用 `prev[0].id + 1`：初始列表是 1→5（新的在最前），
         * 第一条新条目会拿到 2，与初始的第 2 条撞 key，React 直接报重复 key。
         */
        const item: FeedItem = {
          id: Math.max(...prev.map((entry) => entry.id)) + 1,
          time: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
          type: template.type,
          zone: template.zone,
          level: template.level,
          dept: template.dept,
        }
        return [item, ...prev.slice(0, 4)]
      })
    }, 2600)
    return () => clearInterval(timer)
  }, [paused])

  const tokens = useMemo(
    () => ({
      fg: T.fg,
      fg2: T.fg2,
      fg3: T.fg3,
      fg4: T.fg4,
      grid: T.lineSoft,
      gridSubtle: 'rgba(167,139,250,0.03)',
      surface: T.bgSoft,
      chart: [T.accent, T.accent2, T.up, T.down, '#22d3ee', '#f472b6'] as [
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

  const trendOption = useMemo<ChartOption>(() => {
    const data = range === '6h' ? HOURS.slice(-6) : range === '12h' ? HOURS.slice(-12) : HOURS
    return {
      grid: { left: 2, right: 2, top: 20, bottom: 2, containLabel: true },
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
        data: data.map((item) => item.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: T.fg4, fontSize: 9, interval: Math.ceil(data.length / 8) },
      },
      yAxis: [
        {
          type: 'value',
          splitLine: { lineStyle: { color: T.lineSoft } },
          axisLabel: { color: T.fg4, fontSize: 9 },
        },
        {
          type: 'value',
          splitLine: { show: false },
          axisLabel: { color: T.fg4, fontSize: 9, formatter: '{value}m' },
        },
      ],
      series: [
        {
          name: '事件量',
          type: 'bar',
          barWidth: '46%',
          data: data.map((item) => item.incidents),
          itemStyle: { borderRadius: [2, 2, 0, 0], color: 'rgba(167,139,250,0.5)' },
        },
        {
          name: '处置时长',
          type: 'line',
          yAxisIndex: 1,
          smooth: 0.3,
          symbol: 'none',
          data: data.map((item) => item.minutes),
          lineStyle: { width: 1.4, color: T.accent2 },
          markLine: {
            silent: true,
            symbol: 'none',
            /**
             * 时限线标签放「左端上部」而不是默认的末端：
             * 末端正好压在右轴的 20m 刻度上，两行字会叠在一起。
             */
            label: {
              color: T.down,
              fontSize: 9,
              formatter: '20m 时限',
              position: 'insideStartTop',
            },
            lineStyle: { color: T.down, type: 'dashed', width: 1, opacity: 0.6 },
            data: [{ yAxis: 20 }],
          },
        },
      ],
    }
  }, [range])

  const satisfactionOption = useMemo<ChartOption>(
    () => ({
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: ['66%', '88%'],
          center: ['50%', '50%'],
          itemStyle: { borderColor: T.bg, borderWidth: 2 },
          label: { show: false },
          labelLine: { show: false },
          data: SATISFACTION.map((item) => ({
            name: item.name,
            value: item.value,
            itemStyle: { color: item.color },
          })),
        },
      ],
    }),
    [],
  )

  const active = GRID.find((cell) => cell.id === selected) ?? GRID[0]
  const counts = {
    ok: GRID.filter((cell) => cell.status === 'ok').length,
    warn: GRID.filter((cell) => cell.status === 'warn').length,
    crit: GRID.filter((cell) => cell.status === 'crit').length,
  }
  const maxZoneTotal = Math.max(
    ...ZONES.map((zone) =>
      GRID.filter((cell) => cell.zone === zone).reduce((sum, cell) => sum + cell.incidents, 0),
    ),
  )

  return (
    <ScreenShell tokens={T}>
      <ScreenHeader
        tokens={T}
        title="城市运行大屏"
        meta={
          <span className="hidden text-[0.6875rem] tabular-nums sm:inline" style={{ color: T.fg3 }}>
            {clock}
          </span>
        }
        actions={
          <>
            <span className="hidden lg:inline" style={{ color: T.fg3 }}>
              城市治理指挥中心 · 96 网格
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-md px-2 py-1"
              style={{ backgroundColor: 'rgba(52,211,153,0.10)', color: T.up }}
            >
              <Radio className="size-3" />
              网格在线
            </span>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-white/5"
              style={{ color: T.fg2 }}
            >
              <Zap className={refreshing ? 'size-3 animate-spin' : 'size-3'} />
              <span className="hidden sm:inline">刷新</span>
            </button>
            <FullscreenAction tokens={T} />
          </>
        }
      />

      {/* KPI */}
      <div
        className="grid grid-cols-2 gap-y-3 border-b py-4 sm:grid-cols-3 lg:grid-cols-6"
        style={{ borderColor: T.line }}
      >
        {KPIS.map((item, index) => (
          <div
            key={item.label}
            className={index === 0 ? 'min-w-0 px-3' : 'min-w-0 border-l px-3'}
            style={{ borderColor: T.line }}
          >
            <p className="truncate text-[0.625rem] tracking-wide" style={{ color: T.fg4 }}>
              {item.label}
            </p>
            <p
              className="mt-1.5 truncate font-mono text-[1.0625rem] leading-none font-medium tabular-nums"
              style={{ color: item.label.includes('在办') ? T.warn : T.fg }}
            >
              <ScreenNumber value={item.value} duration={1200 + index * 90} />
              <span className="ml-0.5 text-[0.625rem] font-normal" style={{ color: T.fg4 }}>
                {item.unit}
              </span>
            </p>
            <div className="mt-1.5">
              {item.delta === 0 ? (
                <span className="text-[0.6875rem]" style={{ color: T.fg4 }}>
                  稳定
                </span>
              ) : (
                <Delta tokens={T} value={item.delta} invert={item.invert} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 第一行：网格矩阵 + 趋势 */}
      <div
        className="grid grid-cols-1 gap-x-6 gap-y-5 border-b py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"
        style={{ borderColor: T.line }}
      >
        <Panel
          tokens={T}
          title="网格运行热力"
          extra={
            <span className="flex items-center gap-2 text-[0.625rem]" style={{ color: T.fg4 }}>
              {(['ok', 'warn', 'crit'] as const).map((status) => (
                <span key={status} className="inline-flex items-center gap-1">
                  <Dot color={STATUS_META[status].color} size={5} />
                  {counts[status]}
                </span>
              ))}
            </span>
          }
        >
          <div className="grid grid-cols-12 gap-1">
            {GRID.map((cell) => {
              const isActive = cell.id === selected
              return (
                <button
                  key={cell.id}
                  type="button"
                  onClick={() => setSelected(cell.id)}
                  title={`${cell.id} · ${cell.zone} · ${cell.incidents} 件`}
                  aria-label={`${cell.id} ${cell.zone} 事件 ${cell.incidents} 件`}
                  className="aspect-square rounded-[0.125rem] transition-transform hover:scale-110"
                  style={{
                    backgroundColor:
                      cell.status === 'crit'
                        ? T.down
                        : cell.status === 'warn'
                          ? 'rgba(251,191,36,0.85)'
                          : `rgba(167,139,250,${0.18 + (cell.density / 100) * 0.72})`,
                    outline: isActive ? `1px solid ${T.fg}` : 'none',
                    outlineOffset: 1,
                  }}
                />
              )
            })}
          </div>

          <div
            className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 sm:grid-cols-4"
            style={{ borderColor: T.lineSoft }}
          >
            {ZONES.slice(0, 4).map((zone) => {
              const total = GRID.filter((cell) => cell.zone === zone).reduce(
                (sum, cell) => sum + cell.incidents,
                0,
              )
              return (
                <div key={zone}>
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="truncate text-[0.625rem]" style={{ color: T.fg4 }}>
                      {zone}
                    </span>
                    <span
                      className="shrink-0 font-mono text-[0.625rem] tabular-nums"
                      style={{ color: T.fg2 }}
                    >
                      {total}
                    </span>
                  </div>
                  <div className="mt-1">
                    <Bar tokens={T} ratio={total / maxZoneTotal} tone={T.accent} height={3} />
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel
          tokens={T}
          title="事件与处置时效"
          extra={
            <Segmented
              tokens={T}
              value={range}
              onChange={setRange}
              label="时间范围"
              options={[
                { value: '6h', label: '6h' },
                { value: '12h', label: '12h' },
                { value: '24h', label: '24h' },
              ]}
            />
          }
        >
          <EChart option={trendOption} height={214} tokens={tokens} />

          <div
            className="mt-3 grid grid-cols-3 gap-3 border-t pt-3"
            style={{ borderColor: T.lineSoft }}
          >
            {[
              { label: '峰值时段', value: '18:00', hint: '68 件 / 小时' },
              { label: '最短处置', value: '6.2', hint: '分钟 · 市政公用' },
              { label: '超时工单', value: '5', hint: '件 · 待督办' },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-[0.625rem]" style={{ color: T.fg4 }}>
                  {item.label}
                </p>
                <p
                  className="mt-0.5 font-mono text-[0.875rem] font-medium tabular-nums"
                  style={{ color: T.fg }}
                >
                  <ScreenNumber value={item.value} duration={1100} />
                </p>
                <p className="truncate text-[0.5625rem]" style={{ color: T.fg4 }}>
                  {item.hint}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* 第二行：事件流 + 部门排行 + 选中格详情 */}
      <div
        className="grid grid-cols-1 gap-x-6 gap-y-5 border-b py-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.95fr)]"
        style={{ borderColor: T.line }}
      >
        <Panel
          tokens={T}
          title="实时事件流"
          extra={
            <span className="text-[0.625rem]" style={{ color: paused ? T.warn : T.fg4 }}>
              {paused ? '已暂停 · 移开继续' : '实时推送中'}
            </span>
          }
        >
          <ul
            className="space-y-1.5"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {feed.map((item) => {
              const urgent = item.level === '紧急'
              return (
                <li
                  key={item.id}
                  className="flex items-start gap-2 rounded-sm px-1.5 py-1.5 transition-colors"
                  style={{ backgroundColor: urgent ? 'rgba(251,113,133,0.06)' : 'transparent' }}
                >
                  <span
                    className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-[0.125rem]"
                    style={{
                      backgroundColor: urgent ? 'rgba(251,113,133,0.16)' : 'rgba(167,139,250,0.14)',
                      color: urgent ? T.down : T.accent,
                    }}
                  >
                    {urgent ? <Siren className="size-2.5" /> : <CircleAlert className="size-2.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.6875rem]" style={{ color: T.fg2 }}>
                      {item.type}
                    </p>
                    <p className="truncate text-[0.5625rem]" style={{ color: T.fg4 }}>
                      {item.zone} · {item.dept}
                    </p>
                  </div>
                  <span
                    className="shrink-0 font-mono text-[0.5625rem] tabular-nums"
                    style={{ color: T.fg4 }}
                  >
                    {item.time}
                  </span>
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel tokens={T} title="处置单位排行" extra={<Label tokens={T}>按时率</Label>}>
          <table className="w-full text-[0.6875rem]">
            <thead>
              <tr style={{ color: T.fg4 }}>
                <th className="pb-1.5 text-left font-normal">单位</th>
                <th className="pb-1.5 text-right font-normal">结案</th>
                <th className="pb-1.5 text-right font-normal">按时率</th>
              </tr>
            </thead>
            <tbody>
              {DEPARTMENTS.map((item) => (
                <tr key={item.name} className="border-t" style={{ borderColor: T.lineSoft }}>
                  <td className="py-1.5" style={{ color: T.fg2 }}>
                    {item.name}
                  </td>
                  <td className="py-1.5 text-right font-mono tabular-nums" style={{ color: T.fg3 }}>
                    {item.done}/{item.total}
                  </td>
                  <td
                    className="py-1.5 text-right font-mono tabular-nums"
                    style={{
                      color: item.ontime >= 95 ? T.up : item.ontime >= 93 ? T.warn : T.down,
                    }}
                  >
                    {item.ontime.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel tokens={T} title="网格详情" extra={<Label tokens={T}>{active?.zone ?? '—'}</Label>}>
          {active ? (
            <div className="flex h-full flex-col gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-md"
                  style={{ backgroundColor: 'rgba(167,139,250,0.12)', color: T.accent }}
                >
                  <MapPin className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-mono text-[0.8125rem]" style={{ color: T.fg }}>
                    {active.id}
                  </p>
                  <p className="truncate text-[0.625rem]" style={{ color: T.fg4 }}>
                    {active.zone} · {STATUS_META[active.status].label}
                  </p>
                </div>
                <span
                  className="ml-auto shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-[0.625rem] tabular-nums"
                  style={{
                    color: STATUS_META[active.status].color,
                    backgroundColor: `${STATUS_META[active.status].color}1f`,
                  }}
                >
                  {active.density}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '今日事件', value: String(active.incidents), unit: '件' },
                  { label: '平均处置', value: String(active.handling), unit: '分' },
                  { label: '在岗网格员', value: String(active.staff), unit: '人' },
                  { label: '事件密度', value: String(active.density), unit: '' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-sm px-2 py-1.5"
                    style={{
                      backgroundColor: 'rgba(167,139,250,0.05)',
                      border: `1px solid ${T.line}`,
                    }}
                  >
                    <p className="text-[0.5625rem]" style={{ color: T.fg4 }}>
                      {item.label}
                    </p>
                    <p
                      className="mt-0.5 font-mono text-[0.8125rem] tabular-nums"
                      style={{ color: T.fg }}
                    >
                      <ScreenNumber value={item.value} duration={900} />
                      <span className="ml-0.5 text-[0.5625rem]" style={{ color: T.fg4 }}>
                        {item.unit}
                      </span>
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-auto border-t pt-2" style={{ borderColor: T.lineSoft }}>
                <p className="text-[0.625rem]" style={{ color: T.fg4 }}>
                  处置建议
                </p>
                <p className="mt-1 text-[0.6875rem] leading-5" style={{ color: T.fg2 }}>
                  {active.status === 'crit'
                    ? '事件密度已达告警阈值，建议就近调度 2 名网格员并联动执法车辆。'
                    : active.status === 'warn'
                      ? '密度偏高，保持 15 分钟巡检节奏，注意午间与晚高峰。'
                      : '运行平稳，可按常规频次巡检。'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[0.6875rem]" style={{ color: T.fg4 }}>
              点击左侧网格查看详情
            </p>
          )}
        </Panel>
      </div>

      {/* 第三行：资源 + 满意度 */}
      <div
        className="grid grid-cols-1 gap-x-6 gap-y-5 border-b py-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
        style={{ borderColor: T.line }}
      >
        <Panel tokens={T} title="资源调度水位" extra={<Label tokens={T}>实时</Label>}>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {RESOURCES.map((item) => (
              <div key={item.label}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[0.625rem]" style={{ color: T.fg4 }}>
                    {item.label}
                  </span>
                  <span
                    className="shrink-0 font-mono text-[0.6875rem] tabular-nums"
                    style={{ color: T.fg2 }}
                  >
                    {item.value}
                  </span>
                </div>
                <div className="mt-1.5">
                  <Bar tokens={T} ratio={item.ratio} tone={item.tone} height={4} />
                </div>
              </div>
            ))}
          </div>

          <div
            className="mt-4 grid grid-cols-3 gap-3 border-t pt-3"
            style={{ borderColor: T.lineSoft }}
          >
            {[
              { icon: Users, label: '联动部门', value: '12', unit: '个' },
              { icon: Route, label: '今日巡查里程', value: '1,842', unit: 'km' },
              { icon: Activity, label: '视频巡检', value: '96.4', unit: '%' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-md"
                  style={{ backgroundColor: 'rgba(167,139,250,0.10)', color: T.accent }}
                >
                  <item.icon className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[0.5625rem]" style={{ color: T.fg4 }}>
                    {item.label}
                  </p>
                  <p className="font-mono text-[0.8125rem] tabular-nums" style={{ color: T.fg }}>
                    <ScreenNumber value={item.value} duration={1100} />
                    <span className="ml-0.5 text-[0.5625rem]" style={{ color: T.fg4 }}>
                      {item.unit}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel tokens={T} title="市民满意度" extra={<Label tokens={T}>近 7 天</Label>}>
          <div className="flex items-center gap-4">
            <div className="relative size-[7.5rem] shrink-0">
              <EChart option={satisfactionOption} height={120} tokens={tokens} />
              <span className="pointer-events-none absolute inset-0 grid place-items-center">
                <span className="text-center">
                  <span className="block text-[0.5625rem]" style={{ color: T.fg4 }}>
                    满意率
                  </span>
                  <span
                    className="block font-mono text-[0.875rem] font-semibold tabular-nums"
                    style={{ color: T.fg }}
                  >
                    98.2%
                  </span>
                </span>
              </span>
            </div>
            <ul className="min-w-0 flex-1 space-y-1">
              {SATISFACTION.map((item) => (
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
      </div>

      <footer
        className="flex flex-wrap items-center gap-3 pt-1 pb-2 text-[0.625rem]"
        style={{ color: T.fg4 }}
      >
        <span className="inline-flex items-center gap-1">
          <Building2 className="size-3" />
          96 网格 / 12 联动部门
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3" />
          覆盖 1,284 个视频点位
        </span>
        <span className="inline-flex items-center gap-1">
          <Route className="size-3" />
          数据每 30 秒同步
        </span>
        <span className="ml-auto">演示数据 · 已脱敏</span>
      </footer>
    </ScreenShell>
  )
}
