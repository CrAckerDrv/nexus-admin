import { useMemo, useState } from 'react'
import {
  Activity,
  Boxes,
  CircleAlert,
  Cpu,
  HardDrive,
  MemoryStick,
  Server,
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
  RefreshAction,
  ScreenHeader,
  ScreenNumber,
  ScreenShell,
  Segmented,
  useClock,
  useLiveSeries,
  type ScreenTokens,
} from './screen-primitives'

/**
 * 智算中心大屏
 *
 * 适用：AI 平台 / 算力运营 / 模型服务平台。
 *
 * 与运维监控墙（同为深色高密度）的区别：
 * - 监控对象是「卡」而不是「服务」：GPU 显存、SM 利用率、温度、功耗
 *   同一张卡上的六个维度要能在一格里读完，所以用卡阵热力而不是表格
 * - 业务视角在上半屏：Token 吞吐、队列深度、模型调用分布 ——
 *   算力运营关心的是「算得出多少业务」，不只是「机器有没有挂」
 * - 深空紫而不是终端青：这是一块「平台能力」的屏，不是「值班排障」的屏
 */

const T: ScreenTokens = {
  bg: '#07070f',
  bgSoft: '#0d0d1a',
  line: 'rgba(168,85,247,0.14)',
  lineSoft: 'rgba(168,85,247,0.06)',
  fg: '#f1ecff',
  fg2: '#a79ac4',
  fg3: '#7b6f99',
  fg4: '#544a70',
  accent: '#a855f7',
  accent2: '#22d3ee',
  up: '#34d399',
  down: '#fb7185',
  warn: '#fbbf24',
}

/* ------------------------------ 数据 ------------------------------ */

type GpuState = 'busy' | 'idle' | 'warn' | 'error'

interface GpuCard {
  id: string
  node: string
  index: number
  util: number
  mem: number
  temp: number
  power: number
  state: GpuState
}

const NODES = ['gpu-a01', 'gpu-a02', 'gpu-a03', 'gpu-b01', 'gpu-b02', 'gpu-b03']

/** 6 节点 × 8 卡 = 48 卡，一个 8 列矩阵，正好对应机箱物理布局 */
const CARDS: GpuCard[] = NODES.flatMap((node, nodeIndex) =>
  Array.from({ length: 8 }, (_, index) => {
    const seed = nodeIndex * 8 + index
    const util = Math.round(42 + Math.sin(seed / 2.7) * 34 + ((seed * 23) % 21))
    const state: GpuState = seed === 19 ? 'error' : util > 88 ? 'warn' : util < 30 ? 'idle' : 'busy'
    return {
      id: `${node}#${index}`,
      node,
      index,
      util: Math.min(100, Math.max(6, util)),
      mem: Math.min(100, Math.max(12, Math.round(util * 0.86 + (seed % 13)))),
      temp: Math.round(52 + (util / 100) * 32),
      power: Math.round(180 + (util / 100) * 420),
      state,
    }
  }),
)

const KPIS = [
  { label: 'GPU 在线', value: '48', unit: '卡', delta: 0 },
  { label: '卡均利用率', value: '76.4', unit: '%', delta: 4.2 },
  { label: 'Token 吞吐', value: '1.28', unit: 'M/s', delta: 12.6 },
  { label: '推理队列', value: '342', unit: '条', delta: -18.4, invert: true },
  { label: 'P99 首字延迟', value: '286', unit: 'ms', delta: -6.8, invert: true },
  { label: '显存占用', value: '84.2', unit: '%', delta: 3.1, invert: true },
]

const WINDOWS = Array.from({ length: 30 }, (_, index) => ({
  label: `${String(9 + Math.floor(index / 6)).padStart(2, '0')}:${String((index % 6) * 10).padStart(2, '0')}`,
  tokens: Math.round(760 + Math.sin(index / 2.6) * 220 + index * 12 + (index % 5 === 0 ? 180 : 0)),
  queue: Math.round(280 + Math.cos(index / 3.1) * 120 + (index > 18 ? 90 : 0)),
}))

const MODELS = [
  { name: 'chat-32b', calls: 18_640, tokens: 42.8, p99: 248, color: T.accent },
  { name: 'chat-7b', calls: 26_420, tokens: 31.2, p99: 86, color: T.accent2 },
  { name: 'embedding-v2', calls: 42_860, tokens: 14.6, p99: 42, color: '#60a5fa' },
  { name: 'reasoning-236b', calls: 1_284, tokens: 8.4, p99: 1640, color: T.warn },
  { name: 'vision-8b', calls: 3_680, tokens: 3.0, p99: 412, color: '#f472b6' },
]

const TENANTS = [
  { name: '智能客服', share: 34.2, tokens: '438K/s', quota: 0.68 },
  { name: '内容生成', share: 26.4, tokens: '338K/s', quota: 0.82 },
  { name: '代码助手', share: 18.6, tokens: '238K/s', quota: 0.54 },
  { name: '搜索摘要', share: 12.8, tokens: '164K/s', quota: 0.91 },
  { name: '内部工具', share: 8.0, tokens: '102K/s', quota: 0.31 },
]

const INCIDENTS = [
  {
    level: 'crit' as const,
    title: 'gpu-a03#3 显存 OOM',
    detail: '已自动隔离，重调度中',
    time: '15:46:12',
  },
  {
    level: 'warn' as const,
    title: '推理队列深度超阈值',
    detail: '342 > 300，已扩容 2 节点',
    time: '15:41:08',
  },
  {
    level: 'warn' as const,
    title: 'gpu-a03#6 温度 89°C',
    detail: '风扇转速拉满',
    time: '15:38:44',
  },
  {
    level: 'ok' as const,
    title: 'gpu-a01#2 恢复服务',
    detail: '自愈完成 · 耗时 42s',
    time: '15:34:20',
  },
]

const STATE_META: Record<GpuState, { color: string; label: string }> = {
  busy: { color: T.up, label: '满载' },
  idle: { color: 'rgba(168,85,247,0.28)', label: '空闲' },
  warn: { color: T.warn, label: '高负载' },
  error: { color: T.down, label: '故障' },
}

/* ------------------------------ 页面 ------------------------------ */

export default function ScreenComputePage() {
  const clock = useClock()
  const [range, setRange] = useState<'1h' | '6h' | '24h'>('6h')
  const [selected, setSelected] = useState('gpu-b02#3')

  /** 实时吞吐：每 2s 推进一个采样点 */
  const live = useLiveSeries([1_140, 1_180, 1_160, 1_220, 1_205, 1_260, 1_240, 1_286], {
    interval: 2000,
    drift: 0.02,
    floor: 900,
  })

  const tokens = useMemo(
    () => ({
      fg: T.fg,
      fg2: T.fg2,
      fg3: T.fg3,
      fg4: T.fg4,
      grid: T.lineSoft,
      gridSubtle: 'rgba(168,85,247,0.03)',
      surface: T.bgSoft,
      chart: [T.accent, T.accent2, '#60a5fa', T.warn, '#f472b6', T.up] as [
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

  const throughputOption = useMemo<ChartOption>(() => {
    const data = range === '1h' ? WINDOWS.slice(-8) : range === '6h' ? WINDOWS.slice(-18) : WINDOWS
    const base = data.map((item) => item.tokens)
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
        boundaryGap: false,
        data: data.map((item) => item.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: T.fg4, fontSize: 9, interval: Math.ceil(data.length / 7) },
      },
      yAxis: [
        {
          type: 'value',
          splitLine: { lineStyle: { color: T.lineSoft } },
          axisLabel: { color: T.fg4, fontSize: 9, formatter: '{value}K' },
        },
        {
          type: 'value',
          splitLine: { show: false },
          axisLabel: { color: T.fg4, fontSize: 9 },
        },
      ],
      series: [
        {
          name: 'Token/s',
          type: 'line',
          smooth: 0.35,
          symbol: 'none',
          data: [...base.slice(0, -2), base[base.length - 2] ?? 0, live[live.length - 1] ?? 0],
          lineStyle: { width: 1.7, color: T.accent },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(168,85,247,0.26)' },
                { offset: 1, color: 'rgba(168,85,247,0)' },
              ],
            },
          },
        },
        {
          name: '队列深度',
          type: 'line',
          yAxisIndex: 1,
          smooth: 0.3,
          symbol: 'none',
          data: data.map((item) => item.queue),
          lineStyle: { width: 1.2, color: T.accent2, type: 'dashed' },
        },
      ],
    }
  }, [range, live])

  const modelOption = useMemo<ChartOption>(
    () => ({
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: ['56%', '80%'],
          center: ['50%', '50%'],
          itemStyle: { borderColor: T.bg, borderWidth: 2 },
          label: { show: false },
          labelLine: { show: false },
          data: MODELS.map((item) => ({
            name: item.name,
            value: item.tokens,
            itemStyle: { color: item.color },
          })),
        },
      ],
    }),
    [],
  )

  const selectedCard = CARDS.find((card) => card.id === selected) ?? CARDS[0]!
  const activeCount = CARDS.filter((card) => card.state !== 'idle').length
  const maxQuota = Math.max(...TENANTS.map((tenant) => tenant.quota))

  return (
    <ScreenShell tokens={T}>
      <ScreenHeader
        tokens={T}
        title="智算中心大屏"
        meta={
          <span className="hidden text-[0.6875rem] tabular-nums sm:inline" style={{ color: T.fg3 }}>
            {clock}
          </span>
        }
        actions={
          <>
            <span className="hidden lg:inline" style={{ color: T.fg3 }}>
              6 节点 · 48 卡 H100 · 1 集群
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-md px-2 py-1"
              style={{ backgroundColor: 'rgba(52,211,153,0.10)', color: T.up }}
            >
              <Activity className="size-3" />
              调度正常
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
              style={{ color: item.label.includes('延迟') ? T.accent2 : T.fg }}
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

      {/* 第一行：卡阵 + 单卡详情 */}
      <div
        className="grid grid-cols-1 gap-x-6 gap-y-5 border-b py-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
        style={{ borderColor: T.line }}
      >
        <Panel
          tokens={T}
          title="GPU 卡阵"
          extra={
            <span className="flex items-center gap-2 text-[0.625rem]" style={{ color: T.fg4 }}>
              {(['busy', 'warn', 'idle', 'error'] as const).map((state) => (
                <span key={state} className="inline-flex items-center gap-1">
                  <Dot color={STATE_META[state].color} size={5} />
                  {STATE_META[state].label}
                </span>
              ))}
            </span>
          }
        >
          <div className="space-y-1.5">
            {NODES.map((node) => (
              <div key={node} className="flex items-center gap-2">
                <span
                  className="w-[3.25rem] shrink-0 font-mono text-[0.5625rem]"
                  style={{ color: T.fg4 }}
                >
                  {node}
                </span>
                <div className="grid min-w-0 flex-1 grid-cols-8 gap-1">
                  {CARDS.filter((card) => card.node === node).map((card) => {
                    const isActive = card.id === selected
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => setSelected(card.id)}
                        title={`${card.id} · 利用率 ${card.util}% · 显存 ${card.mem}%`}
                        aria-label={`${card.id} 利用率 ${card.util}%`}
                        className="relative aspect-[2/1] overflow-hidden rounded-[0.125rem] transition-transform hover:scale-105"
                        style={{
                          backgroundColor: 'rgba(168,85,247,0.08)',
                          outline: isActive ? `1px solid ${T.fg}` : 'none',
                          outlineOffset: 1,
                        }}
                      >
                        <span
                          className="absolute inset-x-0 bottom-0"
                          style={{
                            height: `${card.util}%`,
                            backgroundColor:
                              card.state === 'error'
                                ? T.down
                                : card.state === 'warn'
                                  ? T.warn
                                  : card.state === 'idle'
                                    ? 'rgba(168,85,247,0.30)'
                                    : 'rgba(52,211,153,0.55)',
                          }}
                        />
                        <span
                          className="absolute inset-0 grid place-items-center font-mono text-[0.5rem] tabular-nums"
                          style={{ color: T.fg, textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}
                        >
                          {card.util}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div
            className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-2.5 text-[0.625rem]"
            style={{ borderColor: T.lineSoft }}
          >
            <span style={{ color: T.fg4 }}>
              活跃卡{' '}
              <span className="font-mono tabular-nums" style={{ color: T.fg2 }}>
                {activeCount}/48
              </span>
            </span>
            <span style={{ color: T.fg4 }}>
              卡均功率{' '}
              <span className="font-mono tabular-nums" style={{ color: T.fg2 }}>
                412W
              </span>
            </span>
            <span style={{ color: T.fg4 }}>
              总功耗{' '}
              <span className="font-mono tabular-nums" style={{ color: T.fg2 }}>
                19.8kW
              </span>
            </span>
            <span className="ml-auto" style={{ color: T.fg4 }}>
              点击卡片查看单卡详情
            </span>
          </div>
        </Panel>

        <Panel tokens={T} title="单卡详情" extra={<Label tokens={T}>{selectedCard.node}</Label>}>
          <div className="flex items-center gap-2.5">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-md"
              style={{ backgroundColor: 'rgba(168,85,247,0.12)', color: T.accent }}
            >
              <Cpu className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-mono text-[0.875rem]" style={{ color: T.fg }}>
                {selectedCard.id}
              </p>
              <p className="truncate text-[0.625rem]" style={{ color: T.fg4 }}>
                H100 80GB · {STATE_META[selectedCard.state].label}
              </p>
            </div>
            <span
              className="ml-auto shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-[0.625rem] tabular-nums"
              style={{
                color: STATE_META[selectedCard.state].color,
                backgroundColor: `${STATE_META[selectedCard.state].color}1f`,
              }}
            >
              {selectedCard.util}%
            </span>
          </div>

          <div className="mt-3 space-y-2.5">
            {[
              { label: 'SM 利用率', value: selectedCard.util, unit: '%', tone: T.up, icon: Cpu },
              {
                label: '显存占用',
                value: selectedCard.mem,
                unit: '%',
                tone: T.accent,
                icon: MemoryStick,
              },
              {
                label: '温度',
                value: selectedCard.temp,
                unit: '°C',
                tone: selectedCard.temp > 85 ? T.warn : T.accent2,
                icon: AlertIcon,
              },
              { label: '功耗', value: selectedCard.power, unit: 'W', tone: T.warn, icon: Zap },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className="inline-flex items-center gap-1 text-[0.625rem]"
                    style={{ color: T.fg4 }}
                  >
                    <item.icon className="size-2.5" />
                    {item.label}
                  </span>
                  <span
                    className="shrink-0 font-mono text-[0.6875rem] tabular-nums"
                    style={{ color: T.fg2 }}
                  >
                    <ScreenNumber value={item.value} duration={900} />
                    <span className="ml-0.5 text-[0.5625rem]" style={{ color: T.fg4 }}>
                      {item.unit}
                    </span>
                  </span>
                </div>
                <div className="mt-1">
                  <Bar
                    tokens={T}
                    ratio={
                      item.unit === 'W'
                        ? item.value / 700
                        : item.unit === '°C'
                          ? item.value / 100
                          : item.value / 100
                    }
                    tone={item.tone}
                    height={4}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 border-t pt-2" style={{ borderColor: T.lineSoft }}>
            <p className="text-[0.625rem]" style={{ color: T.fg4 }}>
              当前任务
            </p>
            <p className="mt-1 text-[0.6875rem] leading-5" style={{ color: T.fg2 }}>
              {selectedCard.state === 'error'
                ? '推理实例已触发显存 OOM，调度器已隔离该卡并把请求迁移到同节点其余卡位。'
                : selectedCard.state === 'idle'
                  ? '当前空闲，可被调度器分配新的推理或微调任务。'
                  : `承载 ${selectedCard.id.includes('b02') ? 'reasoning-236b 推理' : 'chat-32b 推理'}，已稳定运行 6 小时 12 分。`}
            </p>
          </div>
        </Panel>
      </div>

      {/* 第二行：吞吐 + 模型分布 + 租户 */}
      <div
        className="grid grid-cols-1 gap-x-6 gap-y-5 border-b py-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.85fr)_minmax(0,1fr)]"
        style={{ borderColor: T.line }}
      >
        <Panel
          tokens={T}
          title="Token 吞吐与队列"
          extra={
            <Segmented
              tokens={T}
              value={range}
              onChange={setRange}
              label="时间范围"
              options={[
                { value: '1h', label: '1h' },
                { value: '6h', label: '6h' },
                { value: '24h', label: '24h' },
              ]}
            />
          }
        >
          <EChart option={throughputOption} height={208} tokens={tokens} />
        </Panel>

        <Panel tokens={T} title="模型调用分布" extra={<Label tokens={T}>按 Token</Label>}>
          <div className="flex items-center gap-3">
            <div className="size-[7rem] shrink-0">
              <EChart option={modelOption} height={112} tokens={tokens} />
            </div>
            <ul className="min-w-0 flex-1 space-y-1">
              {MODELS.map((item) => (
                <li key={item.name} className="flex items-center gap-1.5 text-[0.625rem]">
                  <Dot color={item.color} size={5} />
                  <span className="min-w-0 flex-1 truncate font-mono" style={{ color: T.fg2 }}>
                    {item.name}
                  </span>
                  <span className="shrink-0 tabular-nums" style={{ color: T.fg3 }}>
                    {item.tokens}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel tokens={T} title="租户配额" extra={<Label tokens={T}>峰值占用</Label>}>
          <ul className="space-y-2">
            {TENANTS.map((tenant) => (
              <li key={tenant.name}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[0.625rem]" style={{ color: T.fg2 }}>
                    {tenant.name}
                  </span>
                  <span
                    className="shrink-0 font-mono text-[0.5625rem] tabular-nums"
                    style={{ color: T.fg3 }}
                  >
                    {tenant.tokens}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <Bar
                      tokens={T}
                      ratio={tenant.quota / maxQuota}
                      tone={tenant.quota > 0.85 ? T.warn : T.accent}
                      height={3}
                    />
                  </div>
                  <span
                    className="w-8 shrink-0 text-right font-mono text-[0.5625rem] tabular-nums"
                    style={{ color: tenant.quota > 0.85 ? T.warn : T.fg4 }}
                  >
                    {(tenant.quota * 100).toFixed(0)}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* 第三行：模型明细 + 事件 */}
      <div
        className="grid grid-cols-1 gap-x-6 gap-y-5 border-b py-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"
        style={{ borderColor: T.line }}
      >
        <Panel tokens={T} title="模型服务明细" extra={<Label tokens={T}>按 P99 排序</Label>}>
          <table className="w-full text-[0.6875rem]">
            <thead>
              <tr style={{ color: T.fg4 }}>
                <th className="pb-1.5 text-left font-normal">模型</th>
                <th className="pb-1.5 text-right font-normal">调用量</th>
                <th className="pb-1.5 text-right font-normal">Token 占比</th>
                <th className="pb-1.5 text-right font-normal">P99</th>
              </tr>
            </thead>
            <tbody>
              {[...MODELS]
                .sort((a, b) => b.p99 - a.p99)
                .map((item) => (
                  <tr key={item.name} className="border-t" style={{ borderColor: T.lineSoft }}>
                    <td className="py-1.5">
                      <span className="flex items-center gap-1.5">
                        <Dot color={item.color} size={5} />
                        <span className="truncate font-mono" style={{ color: T.fg2 }}>
                          {item.name}
                        </span>
                      </span>
                    </td>
                    <td
                      className="py-1.5 text-right font-mono tabular-nums"
                      style={{ color: T.fg3 }}
                    >
                      {item.calls.toLocaleString()}
                    </td>
                    <td
                      className="py-1.5 text-right font-mono tabular-nums"
                      style={{ color: T.fg3 }}
                    >
                      {item.tokens}%
                    </td>
                    <td
                      className="py-1.5 text-right font-mono tabular-nums"
                      style={{ color: item.p99 > 500 ? T.warn : T.fg2 }}
                    >
                      {item.p99}ms
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Panel>

        <Panel tokens={T} title="平台事件" extra={<Label tokens={T}>近 1 小时</Label>}>
          <ul className="space-y-2">
            {INCIDENTS.map((item) => {
              const color = item.level === 'crit' ? T.down : item.level === 'warn' ? T.warn : T.up
              return (
                <li key={item.title} className="flex items-start gap-2">
                  <span
                    className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-[0.125rem]"
                    style={{ backgroundColor: `${color}22`, color }}
                  >
                    <CircleAlert className="size-2.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.6875rem]" style={{ color: T.fg2 }}>
                      {item.title}
                    </p>
                    <p className="truncate text-[0.5625rem]" style={{ color: T.fg4 }}>
                      {item.detail}
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
      </div>

      {/* 底部：资源水位 */}
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 py-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'GPU 集群水位', value: 76, tone: T.accent, icon: Cpu },
          { label: '显存平均占用', value: 84, tone: T.warn, icon: MemoryStick },
          { label: '存储 I/O', value: 42, tone: T.accent2, icon: HardDrive },
          { label: '网络带宽', value: 68, tone: T.up, icon: Server },
        ].map((item) => (
          <div key={item.label}>
            <div className="flex items-baseline justify-between gap-2">
              <span
                className="inline-flex items-center gap-1 text-[0.625rem]"
                style={{ color: T.fg4 }}
              >
                <item.icon className="size-2.5" />
                {item.label}
              </span>
              <span className="font-mono text-[0.75rem] tabular-nums" style={{ color: T.fg2 }}>
                <ScreenNumber value={`${item.value}%`} duration={1100} />
              </span>
            </div>
            <div className="mt-1.5">
              <Bar tokens={T} ratio={item.value / 100} tone={item.tone} height={4} />
            </div>
          </div>
        ))}
      </div>

      <footer
        className="flex flex-wrap items-center gap-3 pt-1 pb-2 text-[0.625rem]"
        style={{ color: T.fg4 }}
      >
        <span className="inline-flex items-center gap-1">
          <Boxes className="size-3" />6 节点 / 48 卡
        </span>
        <span className="inline-flex items-center gap-1">
          <Zap className="size-3" />
          总功耗 19.8 kW
        </span>
        <span className="inline-flex items-center gap-1">
          <Activity className="size-3" />
          采集间隔 10s
        </span>
        <span className="ml-auto">演示数据 · 已脱敏</span>
      </footer>
    </ScreenShell>
  )
}

/** 温度图标：用现成的 CircleAlert 代替（lucide 里没有专门温度图标时更稳） */
function AlertIcon(props: { className?: string }) {
  return <CircleAlert {...props} />
}
