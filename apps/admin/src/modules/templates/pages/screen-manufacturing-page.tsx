import { useMemo, useState } from 'react'
import { Activity, CircleAlert, Cog, Factory, Gauge, Timer, Wrench } from 'lucide-react'
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
  RefreshAction,
  Segmented,
  useClock,
  type ScreenTokens,
} from './screen-primitives'

/**
 * 生产制造大屏（浅色）
 *
 * 适用：制造业 / MES / 车间大屏。
 *
 * 为什么这块屏用浅色：
 * 车间里的大屏常年挂在采光很强的厂房，深色屏反光后对比度掉得厉害；
 * 浅灰底 + 深墨绿主色在强光下反而更清晰，也与工装、看板的实体质感接近。
 *
 * 与财务驾驶舱（同为浅色）的区别：
 * - 财务是「报表」：表格、金额、右对齐；这里是「仪表」：环形、进度、状态灯
 * - 状态色在这里是硬语义（绿=运行 / 黄=待料 / 红=故障），不做装饰
 * - 数字更大更粗：车间里是几米外读屏，不是办公桌前看
 */

const T: ScreenTokens = {
  bg: '#f4f6f8',
  bgSoft: '#ffffff',
  line: 'rgba(15,23,42,0.10)',
  lineSoft: 'rgba(15,23,42,0.055)',
  fg: '#0b1220',
  fg2: '#3f4a5a',
  fg3: '#64748b',
  fg4: '#94a3b8',
  accent: '#0f766e',
  accent2: '#d97706',
  up: '#0f9f6e',
  down: '#dc2626',
  warn: '#d97706',
}

/* ------------------------------ 数据 ------------------------------ */

type LineStatus = 'running' | 'idle' | 'down'

interface Line {
  id: string
  name: string
  /** 目标产量（件 / 班） */
  target: number
  /** 实际产量 */
  actual: number
  oee: number
  /** 一次合格率 */
  yieldRate: number
  /** 可用率（OEE 三因之一） */
  availability: number
  /** 性能率（OEE 三因之一） */
  performance: number
  takt: number
  status: LineStatus
  /** 工位状态：0 空闲 / 1 运行 / 2 待料 / 3 故障 */
  stations: number[]
}

const LINES: Line[] = [
  {
    id: 'L1',
    name: 'A 线 · 装配',
    target: 1200,
    actual: 1064,
    oee: 82.4,
    yieldRate: 98.6,
    availability: 88.6,
    performance: 94.3,
    takt: 42,
    status: 'running',
    stations: [1, 1, 1, 2, 1, 1, 1, 1, 0, 1, 1, 1],
  },
  {
    id: 'L2',
    name: 'B 线 · 焊接',
    target: 960,
    actual: 742,
    oee: 71.8,
    yieldRate: 97.2,
    availability: 81.2,
    performance: 90.9,
    takt: 58,
    status: 'running',
    stations: [1, 1, 2, 1, 1, 3, 1, 1, 1, 2, 1, 1],
  },
  {
    id: 'L3',
    name: 'C 线 · 检测',
    target: 1500,
    actual: 1468,
    oee: 88.9,
    yieldRate: 99.4,
    availability: 94.1,
    performance: 94.9,
    takt: 32,
    status: 'running',
    stations: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  {
    id: 'L4',
    name: 'D 线 · 包装',
    target: 1800,
    actual: 1186,
    oee: 58.2,
    yieldRate: 96.1,
    availability: 74.6,
    performance: 81.1,
    takt: 76,
    status: 'down',
    stations: [1, 1, 2, 3, 3, 0, 0, 1, 1, 2, 0, 0],
  },
]

const KPIS = [
  { label: '综合 OEE', value: '75.3', unit: '%', delta: 3.8, target: '目标 78%' },
  { label: '当班产量', value: '4,460', unit: '件', delta: 6.2, target: '计划 5,460' },
  { label: '一次合格率', value: '97.8', unit: '%', delta: 0.9, target: '目标 98%' },
  { label: '设备稼动率', value: '86.4', unit: '%', delta: -2.1, target: '目标 88%', invert: true },
  { label: '平均节拍', value: '52', unit: 's', delta: -4.6, target: '标准 50s', invert: true },
  { label: '安灯呼叫', value: '7', unit: '次', delta: 16.7, target: '待响应 2', invert: true },
]

/** 24 小时产量：换班时段有凹口，这是真实的车间节奏 */
const HOURLY = Array.from({ length: 24 }, (_, hour) => ({
  label: `${String(hour).padStart(2, '0')}`,
  output: Math.round(
    240 +
      Math.sin((hour - 2) / 3.1) * 90 +
      (hour % 8 === 7 ? -150 : 0) +
      (hour >= 8 && hour <= 20 ? 80 : -40),
  ),
  target: 260,
}))

const DOWNTIME = [
  { name: '换型调机', minutes: 186, color: T.accent },
  { name: '待料停机', minutes: 142, color: T.warn },
  { name: '设备故障', minutes: 96, color: T.down },
  { name: '质量停机', minutes: 64, color: '#7c3aed' },
  { name: '计划保养', minutes: 48, color: T.fg4 },
]

const DEFECTS = [
  { name: '外观划伤', value: 42.6 },
  { name: '尺寸超差', value: 24.1 },
  { name: '装配错位', value: 15.8 },
  { name: '焊接气孔', value: 11.3 },
  { name: '其他', value: 6.2 },
]

const ANDON = [
  {
    line: 'D 线',
    station: 'ST-04',
    reason: '气缸压力低',
    level: 'call' as const,
    elapsed: '03:42',
  },
  {
    line: 'B 线',
    station: 'ST-06',
    reason: '焊枪温度异常',
    level: 'call' as const,
    elapsed: '01:18',
  },
  { line: 'A 线', station: 'ST-04', reason: '物料待补', level: 'wait' as const, elapsed: '08:05' },
  {
    line: 'C 线',
    station: 'ST-09',
    reason: '视觉标定漂移',
    level: 'warn' as const,
    elapsed: '12:30',
  },
]

const STATION_META: Record<number, { color: string; label: string }> = {
  0: { color: 'rgba(15,23,42,0.12)', label: '空闲' },
  1: { color: T.up, label: '运行' },
  2: { color: T.warn, label: '待料' },
  3: { color: T.down, label: '故障' },
}

const LINE_STATUS: Record<LineStatus, { color: string; label: string }> = {
  running: { color: T.up, label: '运行' },
  idle: { color: T.accent2, label: '暂停' },
  down: { color: T.down, label: '停机' },
}

/* ------------------------------ 页面 ------------------------------ */

export default function ScreenManufacturingPage() {
  const clock = useClock()
  const [range, setRange] = useState<'shift' | 'day'>('shift')
  const [selected, setSelected] = useState('L2')

  const tokens = useMemo(
    () => ({
      fg: T.fg,
      fg2: T.fg2,
      fg3: T.fg3,
      fg4: T.fg4,
      grid: T.lineSoft,
      gridSubtle: 'rgba(15,23,42,0.03)',
      surface: T.bgSoft,
      chart: [T.accent, T.accent2, '#7c3aed', '#0ea5e9', T.down, '#64748b'] as [
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

  const active = LINES.find((line) => line.id === selected) ?? LINES[0]!

  const oeeOption = useMemo<ChartOption>(
    () => ({
      series: [
        {
          type: 'gauge',
          startAngle: 210,
          endAngle: -30,
          min: 0,
          max: 100,
          radius: '96%',
          center: ['50%', '62%'],
          progress: {
            show: true,
            width: 12,
            roundCap: true,
            itemStyle: { color: T.accent },
          },
          axisLine: { lineStyle: { width: 12, color: [[1, 'rgba(15,23,42,0.07)']] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          anchor: { show: false },
          title: { show: false },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, '2%'],
            fontSize: 26,
            fontWeight: 600,
            color: T.fg,
            formatter: '{value}%',
          },
          data: [{ value: active.oee }],
        },
      ],
    }),
    [active],
  )

  const outputOption = useMemo<ChartOption>(() => {
    const data = range === 'shift' ? HOURLY.slice(8, 20) : HOURLY
    return {
      grid: { left: 2, right: 4, top: 20, bottom: 2, containLabel: true },
      legend: {
        right: 0,
        top: 0,
        itemWidth: 7,
        itemHeight: 7,
        itemGap: 14,
        textStyle: { color: T.fg3, fontSize: 10 },
      },
      xAxis: {
        type: 'category',
        data: data.map((item) => item.label),
        axisLine: { lineStyle: { color: T.line } },
        axisTick: { show: false },
        axisLabel: { color: T.fg4, fontSize: 10, formatter: '{value}时' },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: T.lineSoft } },
        axisLabel: { color: T.fg4, fontSize: 10 },
      },
      series: [
        {
          name: '实际产量',
          type: 'bar',
          barWidth: '52%',
          data: data.map((item) => item.output),
          itemStyle: {
            borderRadius: [2, 2, 0, 0],
            color: (params: { dataIndex: number }) => {
              const row = data[params.dataIndex]
              return row && row.output >= row.target ? T.accent : 'rgba(15,118,110,0.34)'
            },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: T.accent2, type: 'dashed', width: 1, opacity: 0.8 },
            label: { color: T.accent2, fontSize: 9, formatter: '目标 260' },
            data: [{ yAxis: 260 }],
          },
        },
      ],
    }
  }, [range])

  const downtimeOption = useMemo<ChartOption>(
    () => ({
      tooltip: { trigger: 'item', formatter: '{b}<br/>{c} 分钟' },
      series: [
        {
          type: 'pie',
          radius: ['58%', '82%'],
          center: ['50%', '50%'],
          itemStyle: { borderColor: T.bgSoft, borderWidth: 2 },
          label: { show: false },
          labelLine: { show: false },
          data: DOWNTIME.map((item) => ({
            name: item.name,
            value: item.minutes,
            itemStyle: { color: item.color },
          })),
        },
      ],
    }),
    [],
  )

  const totalDowntime = DOWNTIME.reduce((sum, item) => sum + item.minutes, 0)
  const totalActual = LINES.reduce((sum, line) => sum + line.actual, 0)
  const totalTarget = LINES.reduce((sum, line) => sum + line.target, 0)

  return (
    <ScreenShell tokens={T} glow="rgba(15,118,110,0.07)">
      <ScreenHeader
        tokens={T}
        title="生产制造大屏"
        meta={
          <span className="hidden text-[0.6875rem] tabular-nums sm:inline" style={{ color: T.fg3 }}>
            {clock}
          </span>
        }
        actions={
          <>
            <span className="hidden lg:inline" style={{ color: T.fg3 }}>
              一号工厂 · 4 条产线 · 48 工位
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-md px-2 py-1"
              style={{ backgroundColor: 'rgba(15,159,110,0.10)', color: T.up }}
            >
              <Activity className="size-3" />
              班次生产中
            </span>
            <RefreshAction tokens={T} />
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
              style={{ color: item.label === '安灯呼叫' ? T.warn : T.fg }}
            >
              <ScreenNumber value={item.value} duration={1200 + index * 90} />
              <span className="ml-0.5 text-[0.625rem] font-normal" style={{ color: T.fg4 }}>
                {item.unit}
              </span>
            </p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <Delta tokens={T} value={item.delta} invert={item.invert} />
              <span className="truncate text-[0.5625rem]" style={{ color: T.fg4 }}>
                {item.target}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 第一行：产线总览 + 产量趋势 */}
      <div
        className="grid grid-cols-1 gap-x-6 gap-y-5 border-b py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]"
        style={{ borderColor: T.line }}
      >
        <Panel
          tokens={T}
          title="产线总览"
          extra={
            <span className="text-[0.625rem]" style={{ color: T.fg4 }}>
              当班 {totalActual.toLocaleString()} / {totalTarget.toLocaleString()} 件
            </span>
          }
        >
          <ul className="space-y-2.5">
            {LINES.map((line) => {
              const isActive = line.id === selected
              const rate = line.actual / line.target
              return (
                <li key={line.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(line.id)}
                    aria-pressed={isActive}
                    className="w-full rounded-md px-2 py-1.5 text-left transition-colors"
                    style={{
                      backgroundColor: isActive ? 'rgba(15,118,110,0.06)' : 'transparent',
                      border: `1px solid ${isActive ? 'rgba(15,118,110,0.22)' : 'transparent'}`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Dot color={LINE_STATUS[line.status].color} />
                      <span
                        className="min-w-0 flex-1 truncate text-[0.75rem] font-medium"
                        style={{ color: T.fg }}
                      >
                        {line.name}
                      </span>
                      <span
                        className="shrink-0 font-mono text-[0.625rem] tabular-nums"
                        style={{ color: T.fg3 }}
                      >
                        {line.actual.toLocaleString()} / {line.target.toLocaleString()}
                      </span>
                      <span
                        className="w-9 shrink-0 text-right font-mono text-[0.625rem] tabular-nums"
                        style={{ color: LINE_STATUS[line.status].color }}
                      >
                        {LINE_STATUS[line.status].label}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <Bar
                          tokens={T}
                          ratio={rate}
                          tone={rate >= 1 ? T.up : rate >= 0.8 ? T.accent : T.warn}
                          height={4}
                        />
                      </div>
                      <span
                        className="w-[2.75rem] shrink-0 text-right font-mono text-[0.625rem] tabular-nums"
                        style={{ color: T.fg3 }}
                      >
                        {(rate * 100).toFixed(0)}%
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel
          tokens={T}
          title="产量与目标"
          extra={
            <Segmented
              tokens={T}
              value={range}
              onChange={setRange}
              label="统计口径"
              options={[
                { value: 'shift', label: '当班' },
                { value: 'day', label: '全天' },
              ]}
            />
          }
        >
          <EChart option={outputOption} height={206} tokens={tokens} />
        </Panel>
      </div>

      {/* 第二行：OEE 仪表 + 损失 + 缺陷 + 安灯 */}
      <div
        className="grid grid-cols-1 gap-x-6 gap-y-5 border-b py-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.05fr)]"
        style={{ borderColor: T.line }}
      >
        <Panel tokens={T} title="产线 OEE" extra={<Label tokens={T}>{active.id}</Label>}>
          <EChart option={oeeOption} height={152} tokens={tokens} />
          <div
            className="mt-1 grid grid-cols-3 gap-2 border-t pt-2.5"
            style={{ borderColor: T.lineSoft }}
          >
            {/* OEE = 可用率 × 性能率 × 合格率：达标率恒为数据里的实际值，另两项按比例拆出，
                这样切换产线时三个数会一起变，不会出现「仪表变了、明细没变」 */}
            {[
              { label: '可用率', value: active.availability },
              { label: '性能率', value: active.performance },
              { label: '合格率', value: active.yieldRate },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-[0.5625rem]" style={{ color: T.fg4 }}>
                  {item.label}
                </p>
                <p
                  className="font-mono text-[0.75rem] font-medium tabular-nums"
                  style={{ color: T.fg2 }}
                >
                  {item.value.toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel tokens={T} title="停机损失" extra={<Label tokens={T}>{totalDowntime} 分钟</Label>}>
          <div className="flex items-center gap-3">
            <div className="size-[6.5rem] shrink-0">
              <EChart option={downtimeOption} height={104} tokens={tokens} />
            </div>
            <ul className="min-w-0 flex-1 space-y-1">
              {DOWNTIME.map((item) => (
                <li key={item.name} className="flex items-center gap-1.5 text-[0.625rem]">
                  <Dot color={item.color} size={5} />
                  <span className="min-w-0 flex-1 truncate" style={{ color: T.fg2 }}>
                    {item.name}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums" style={{ color: T.fg3 }}>
                    {item.minutes}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel tokens={T} title="不良类型" extra={<Label tokens={T}>占不良总数</Label>}>
          <ul className="space-y-2">
            {DEFECTS.map((item, index) => (
              <li key={item.name}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[0.625rem]" style={{ color: T.fg2 }}>
                    {item.name}
                  </span>
                  <span
                    className="shrink-0 font-mono text-[0.625rem] tabular-nums"
                    style={{ color: T.fg3 }}
                  >
                    {item.value.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-1">
                  <Bar
                    tokens={T}
                    ratio={item.value / 50}
                    tone={index === 0 ? T.down : index === 1 ? T.warn : T.accent}
                    height={3}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel tokens={T} title="安灯呼叫" extra={<Label tokens={T}>待响应 2</Label>}>
          <ul className="space-y-2">
            {ANDON.map((item) => {
              const color =
                item.level === 'call' ? T.down : item.level === 'wait' ? T.warn : T.accent2
              return (
                <li key={`${item.line}-${item.station}`} className="flex items-start gap-2">
                  <span
                    className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-[0.125rem]"
                    style={{ backgroundColor: `${color}22`, color }}
                  >
                    <CircleAlert className="size-2.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.6875rem]" style={{ color: T.fg2 }}>
                      {item.line} {item.station} · {item.reason}
                    </p>
                    <p className="truncate text-[0.5625rem]" style={{ color: T.fg4 }}>
                      已持续 {item.elapsed} ·{' '}
                      {item.level === 'call'
                        ? '呼叫维修'
                        : item.level === 'wait'
                          ? '等待物料'
                          : '关注'}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>

      {/* 第三行：工位矩阵 */}
      <div className="border-b py-5" style={{ borderColor: T.line }}>
        <Panel
          tokens={T}
          title="工位状态矩阵"
          extra={
            <span className="flex items-center gap-2.5 text-[0.625rem]" style={{ color: T.fg4 }}>
              {[1, 2, 3, 0].map((state) => (
                <span key={state} className="inline-flex items-center gap-1">
                  <Dot color={STATION_META[state]!.color} size={5} />
                  {STATION_META[state]!.label}
                </span>
              ))}
            </span>
          }
        >
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
            {LINES.map((line) => {
              const isActive = line.id === selected
              return (
                <div
                  key={line.id}
                  className="rounded-md px-2.5 py-2 transition-colors"
                  style={{
                    border: `1px solid ${isActive ? 'rgba(15,118,110,0.28)' : T.line}`,
                    backgroundColor: isActive ? 'rgba(15,118,110,0.04)' : T.bgSoft,
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="min-w-0 flex-1 truncate text-[0.6875rem] font-medium"
                      style={{ color: T.fg }}
                    >
                      {line.name}
                    </span>
                    <span
                      className="shrink-0 font-mono text-[0.5625rem] tabular-nums"
                      style={{ color: T.fg4 }}
                    >
                      节拍 {line.takt}s
                    </span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-12 gap-1">
                    {line.stations.map((state, index) => (
                      <span
                        key={index}
                        title={`${line.id}-ST${String(index + 1).padStart(2, '0')} · ${STATION_META[state]?.label ?? '—'}`}
                        className="aspect-square rounded-[0.0625rem]"
                        style={{ backgroundColor: STATION_META[state]?.color ?? T.fg4 }}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>

      {/* 底部：设备与节拍 */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 py-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: '设备综合效率',
            value: `${active.oee}%`,
            hint: `OEE · ${active.id}`,
            icon: Gauge,
          },
          {
            label: '一次合格率',
            value: `${active.yieldRate}%`,
            hint: 'FTQ · 当班',
            icon: Activity,
          },
          { label: '当前节拍', value: `${active.takt}s`, hint: 'CT · 单件', icon: Timer },
          { label: '设备完好率', value: '96.2%', hint: '72 台关键设备', icon: Wrench },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 border-t pt-2.5"
            style={{ borderColor: T.lineSoft }}
          >
            <span
              className="grid size-7 shrink-0 place-items-center rounded-md"
              style={{ backgroundColor: 'rgba(15,118,110,0.08)', color: T.accent }}
            >
              <item.icon className="size-3.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[0.625rem]" style={{ color: T.fg4 }}>
                {item.label}
              </p>
              <p className="flex items-baseline gap-1">
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
          <Factory className="size-3" />
          一号工厂 · 4 条产线
        </span>
        <span className="inline-flex items-center gap-1">
          <Cog className="size-3" />
          48 工位 / 72 台关键设备
        </span>
        <span className="inline-flex items-center gap-1">
          <Activity className="size-3" />
          MES 采集间隔 5s
        </span>
        <span className="ml-auto">数据来源：MES 当班快照 2026-11-05</span>
      </footer>
    </ScreenShell>
  )
}
