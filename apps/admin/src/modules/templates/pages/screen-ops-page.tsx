import { useMemo, useState } from 'react'
import { Activity, AlertTriangle, Cpu, Radio, Server, Zap } from 'lucide-react'
import { EChart, type ChartOption } from '@/components/charts/echart'
import {
  Bar,
  Delta,
  FullscreenAction,
  HeaderAction,
  Label,
  Panel,
  ScreenHeader,
  ScreenNumber,
  ScreenShell,
  useClock,
  useRefresh,
  type ScreenTokens,
} from './screen-primitives'

/**
 * 运维监控墙
 *
 * 适用：SRE / 值班室 / on-call。
 *
 * 与「运营大屏」的区别不只是配色：
 * - 密度优先：一屏塞下主机矩阵、QPS、P95、告警流、日志，值班时要能扫视
 * - 状态语义：绿 / 黄 / 红三档贯穿整屏，颜色本身就是信息
 * - 亮青 + 深蓝黑：长时间盯屏不刺眼，异常红色才跳出来
 */

const T: ScreenTokens = {
  bg: '#050a12',
  bgSoft: '#0a1220',
  line: 'rgba(120,180,255,0.10)',
  lineSoft: 'rgba(120,180,255,0.05)',
  fg: '#e8f1ff',
  fg2: '#8fa6c4',
  fg3: '#647c9c',
  fg4: '#42536d',
  accent: '#22d3ee',
  accent2: '#818cf8',
  up: '#34d399',
  down: '#f87171',
  warn: '#fbbf24',
}

/* ------------------------------ 数据 ------------------------------ */

const HOSTS = Array.from({ length: 42 }, (_, index) => {
  const cpu = Math.round(28 + Math.sin(index / 2.6) * 26 + ((index * 17) % 22))
  const status: 'ok' | 'warn' | 'crit' =
    index === 11 || index === 27 ? 'crit' : cpu > 78 ? 'warn' : 'ok'
  return { id: `node-${String(index + 1).padStart(2, '0')}`, cpu, status }
})

const SERVICES = [
  { name: 'gateway', qps: 4820, p95: 86, err: 0.02, status: 'ok' as const },
  { name: 'order-svc', qps: 2140, p95: 132, err: 0.11, status: 'ok' as const },
  { name: 'pay-svc', qps: 860, p95: 640, err: 1.24, status: 'warn' as const },
  { name: 'user-svc', qps: 3260, p95: 74, err: 0.03, status: 'ok' as const },
  { name: 'search-svc', qps: 1180, p95: 980, err: 4.6, status: 'crit' as const },
  { name: 'scheduler', qps: 42, p95: 210, err: 0.4, status: 'ok' as const },
]

const ALERTS = [
  { level: 'crit' as const, title: 'search-svc 熔断触发', detail: 'ES 连接池耗尽', time: '15:48:02' },
  { level: 'crit' as const, title: 'node-12 CPU 持续 96%', detail: '已持续 8 分钟', time: '15:45:31' },
  { level: 'warn' as const, title: 'pay-svc P95 超阈值', detail: '640ms > 500ms', time: '15:42:10' },
  { level: 'warn' as const, title: '队列积压 order.queue', detail: '当前 4218 条', time: '15:38:55' },
  { level: 'ok' as const, title: 'node-27 已自动摘除', detail: '健康检查失败 3 次', time: '15:36:20' },
]

const LOGS = [
  ['info', 'gateway', '路由规则热更新完成'],
  ['warn', 'pay-svc', '回调延迟 820ms 超 P95'],
  ['error', 'search-svc', '连接池耗尽，已熔断'],
  ['info', 'user-svc', '缓存命中率 96.4%'],
  ['warn', 'scheduler', '任务 backlog 达到 42'],
  ['info', 'audit', '写入 218 条审计事件'],
  ['error', 'node-12', 'disk io wait > 90%'],
  ['info', 'gateway', 'TLS 证书自动续期成功'],
]

const QPS_SERIES = Array.from({ length: 24 }, (_, index) => ({
  label: `${String(index).padStart(2, '0')}:00`,
  qps: Math.round(3200 + Math.sin(index / 3.2) * 1100 + (index >= 9 && index <= 21 ? 900 : 0)),
  p95: Math.round(120 + Math.cos(index / 2.4) * 60 + (index % 7 === 0 ? 260 : 0)),
}))

const STATUS_META = {
  ok: { color: T.up, label: '健康' },
  warn: { color: T.warn, label: '降级' },
  crit: { color: T.down, label: '异常' },
}

/* ------------------------------ 页面 ------------------------------ */

export default function ScreenOpsPage() {
  const clock = useClock()
  const [refreshing, refresh] = useRefresh()
  const [range, setRange] = useState<'1h' | '6h' | '24h'>('24h')

  const tokens = useMemo(
    () => ({
      fg: T.fg,
      fg2: T.fg2,
      fg3: T.fg3,
      fg4: T.fg4,
      grid: T.lineSoft,
      gridSubtle: 'rgba(120,180,255,0.03)',
      surface: T.bgSoft,
      chart: [T.accent, T.accent2, T.warn, T.down, T.up, '#60a5fa'] as [
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

  const qpsOption = useMemo<ChartOption>(() => {
    const data = range === '1h' ? QPS_SERIES.slice(-6) : range === '6h' ? QPS_SERIES.slice(-12) : QPS_SERIES
    return {
      grid: { left: 2, right: 2, top: 18, bottom: 2, containLabel: true },
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
          axisLabel: { color: T.fg4, fontSize: 9, formatter: '{value}' },
        },
        { type: 'value', splitLine: { show: false }, axisLabel: { show: false } },
      ],
      series: [
        {
          name: 'QPS',
          type: 'line',
          smooth: 0.3,
          symbol: 'none',
          data: data.map((item) => item.qps),
          lineStyle: { width: 1.5, color: T.accent },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(34,211,238,0.22)' },
                { offset: 1, color: 'rgba(34,211,238,0)' },
              ],
            },
          },
        },
        {
          name: 'P95(ms)',
          type: 'line',
          yAxisIndex: 1,
          smooth: 0.3,
          symbol: 'none',
          data: data.map((item) => item.p95),
          lineStyle: { width: 1.2, color: T.accent2, type: 'dashed' },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: T.down, type: 'dashed', width: 1, opacity: 0.7 },
            label: { color: T.down, fontSize: 9, formatter: '500ms' },
            data: [{ yAxis: 500 }],
          },
        },
      ],
    }
  }, [range])

  const statusOption = useMemo<ChartOption>(
    () => ({
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: ['62%', '86%'],
          center: ['50%', '50%'],
          itemStyle: { borderColor: T.bg, borderWidth: 2 },
          label: { show: false },
          labelLine: { show: false },
          data: [
            { name: '健康', value: HOSTS.filter((h) => h.status === 'ok').length, itemStyle: { color: T.up } },
            { name: '降级', value: HOSTS.filter((h) => h.status === 'warn').length, itemStyle: { color: T.warn } },
            { name: '异常', value: HOSTS.filter((h) => h.status === 'crit').length, itemStyle: { color: T.down } },
          ],
        },
      ],
    }),
    [],
  )

  const counts = {
    ok: HOSTS.filter((host) => host.status === 'ok').length,
    warn: HOSTS.filter((host) => host.status === 'warn').length,
    crit: HOSTS.filter((host) => host.status === 'crit').length,
  }

  return (
    <ScreenShell tokens={T}>
      <ScreenHeader
        tokens={T}
        title="运维监控墙"
        meta={
          <span className="hidden text-[0.6875rem] tabular-nums sm:inline" style={{ color: T.fg3 }}>
            {clock}
          </span>
        }
        actions={
          <>
            <span className="hidden lg:inline" style={{ color: T.fg3 }}>
              集群 na-prod-01 · 42 节点
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-md px-2 py-1"
              style={{ backgroundColor: 'rgba(52,211,153,0.10)', color: T.up }}
            >
              <Radio className="size-3" />
              采集正常
            </span>
            <HeaderAction tokens={T} icon={Zap} label="刷新" onClick={refresh} spinning={refreshing} />
            <FullscreenAction tokens={T} />
          </>
        }
      />

      {/* KPI 行 */}
      <div
        className="grid grid-cols-2 gap-y-3 border-b py-4 sm:grid-cols-3 lg:grid-cols-6"
        style={{ borderColor: T.line }}
      >
        {[
          { label: '在线节点', value: '42', unit: '台', delta: 0 },
          { label: '异常节点', value: String(counts.crit), unit: '台', delta: -12.5 },
          { label: '集群 QPS', value: '12,308', unit: '', delta: 8.42 },
          { label: 'P95 延迟', value: '248', unit: 'ms', delta: -6.21 },
          { label: '错误率', value: '0.71', unit: '%', delta: 3.14 },
          { label: '告警未处理', value: '5', unit: '条', delta: -22.4 },
        ].map((item, index) => (
          <div
            key={item.label}
            className={cn85(index)}
            style={{ borderColor: T.line }}
          >
            <p className="truncate text-[0.625rem] tracking-wide" style={{ color: T.fg4 }}>
              {item.label}
            </p>
            <p
              className="mt-1.5 truncate font-mono text-[1.0625rem] leading-none font-medium tabular-nums"
              style={{ color: T.fg }}
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
                <Delta tokens={T} value={item.delta} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 第一行：主机矩阵 + QPS */}
      <div
        className="grid grid-cols-1 gap-x-6 gap-y-5 border-b py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]"
        style={{ borderColor: T.line }}
      >
        <Panel
          tokens={T}
          title="主机健康矩阵"
          extra={
            <span className="flex items-center gap-2 text-[0.625rem]" style={{ color: T.fg4 }}>
              <span className="inline-flex items-center gap-1">
                <span className="size-1.5 rounded-[1px]" style={{ backgroundColor: T.up }} />
                {counts.ok}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-1.5 rounded-[1px]" style={{ backgroundColor: T.warn }} />
                {counts.warn}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-1.5 rounded-[1px]" style={{ backgroundColor: T.down }} />
                {counts.crit}
              </span>
            </span>
          }
        >
          <div className="grid grid-cols-[repeat(auto-fill,minmax(1.125rem,1fr))] gap-1">
            {HOSTS.map((host) => (
              <span
                key={host.id}
                title={`${host.id} · CPU ${host.cpu}%`}
                className="aspect-square rounded-[0.125rem] transition-transform hover:scale-110"
                style={{
                  backgroundColor:
                    host.status === 'crit'
                      ? T.down
                      : host.status === 'warn'
                        ? T.warn
                        : `rgba(52,211,153,${0.28 + (host.cpu / 100) * 0.62})`,
                }}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="w-[5.375rem] shrink-0">
              <EChart option={statusOption} height={64} tokens={tokens} />
            </div>
            <ul className="min-w-0 flex-1 space-y-1">
              {SERVICES.slice(0, 3).map((service) => (
                <li key={service.name} className="flex items-center gap-1.5 text-[0.625rem]">
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: STATUS_META[service.status].color }}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono" style={{ color: T.fg2 }}>
                    {service.name}
                  </span>
                  <span className="shrink-0 tabular-nums" style={{ color: T.fg3 }}>
                    {service.p95}ms
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel
          tokens={T}
          title="吞吐与延迟"
          extra={
            <span className="flex items-center gap-1">
              {(['1h', '6h', '24h'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setRange(item)}
                  className="rounded px-1.5 py-0.5 text-[0.625rem] transition-colors"
                  style={{
                    color: range === item ? T.fg : T.fg4,
                    backgroundColor: range === item ? 'rgba(255,255,255,0.06)' : 'transparent',
                  }}
                >
                  {item}
                </button>
              ))}
            </span>
          }
        >
          <EChart option={qpsOption} height={196} tokens={tokens} />
        </Panel>
      </div>

      {/* 第二行：服务表 + 告警 + 日志 */}
      <div
        className="grid grid-cols-1 gap-x-6 gap-y-5 border-b py-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]"
        style={{ borderColor: T.line }}
      >
        <Panel tokens={T} title="服务健康" extra={<Label tokens={T}>按 P95 排序</Label>}>
          <table className="w-full text-[0.6875rem]">
            <thead>
              <tr style={{ color: T.fg4 }}>
                <th className="pb-1.5 text-left font-normal">服务</th>
                <th className="pb-1.5 text-right font-normal">QPS</th>
                <th className="pb-1.5 text-right font-normal">P95</th>
                <th className="pb-1.5 text-right font-normal">错误率</th>
              </tr>
            </thead>
            <tbody>
              {[...SERVICES].sort((a, b) => b.p95 - a.p95).map((service) => (
                <tr key={service.name} className="border-t" style={{ borderColor: T.lineSoft }}>
                  <td className="py-1.5">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: STATUS_META[service.status].color }}
                      />
                      <span className="truncate font-mono" style={{ color: T.fg2 }}>
                        {service.name}
                      </span>
                    </span>
                  </td>
                  <td className="py-1.5 text-right font-mono tabular-nums" style={{ color: T.fg3 }}>
                    {service.qps.toLocaleString()}
                  </td>
                  <td
                    className="py-1.5 text-right font-mono tabular-nums"
                    style={{ color: service.p95 > 500 ? T.down : T.fg2 }}
                  >
                    {service.p95}
                  </td>
                  <td
                    className="py-1.5 text-right font-mono tabular-nums"
                    style={{ color: service.err > 1 ? T.warn : T.fg3 }}
                  >
                    {service.err.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel tokens={T} title="告警" extra={<Label tokens={T}>近 1 小时</Label>}>
          <ul className="space-y-2">
            {ALERTS.map((alert) => (
              <li key={alert.title} className="flex items-start gap-2">
                <span
                  className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-[0.125rem]"
                  style={{
                    backgroundColor: `${
                      alert.level === 'crit' ? T.down : alert.level === 'warn' ? T.warn : T.up
                    }22`,
                    color: alert.level === 'crit' ? T.down : alert.level === 'warn' ? T.warn : T.up,
                  }}
                >
                  <AlertTriangle className="size-2.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.6875rem]" style={{ color: T.fg2 }}>
                    {alert.title}
                  </p>
                  <p className="truncate text-[0.625rem]" style={{ color: T.fg4 }}>
                    {alert.detail}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[0.625rem] tabular-nums" style={{ color: T.fg4 }}>
                  {alert.time}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel tokens={T} title="实时日志" extra={<Label tokens={T}>tail -f</Label>}>
          <ul className="space-y-1 font-mono text-[0.625rem] leading-4">
            {LOGS.map(([level, service, message], index) => (
              <li key={`${service}-${index}`} className="flex gap-1.5">
                <span
                  className="shrink-0 uppercase"
                  style={{
                    color: level === 'error' ? T.down : level === 'warn' ? T.warn : T.accent,
                  }}
                >
                  {level}
                </span>
                <span className="shrink-0" style={{ color: T.fg3 }}>
                  [{service}]
                </span>
                <span className="min-w-0 flex-1 truncate" style={{ color: T.fg2 }}>
                  {message}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* 底部：资源水位 */}
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 py-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'CPU 平均', value: 58, tone: T.accent },
          { label: '内存使用', value: 72, tone: T.accent2 },
          { label: '磁盘用量', value: 84, tone: T.warn },
          { label: '带宽占比', value: 41, tone: T.up },
        ].map((item) => (
          <div key={item.label}>
            <div className="flex items-baseline justify-between">
              <span className="text-[0.625rem]" style={{ color: T.fg4 }}>
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

      <footer className="flex flex-wrap items-center gap-3 pt-1 pb-2 text-[0.625rem]" style={{ color: T.fg4 }}>
        <span className="inline-flex items-center gap-1">
          <Server className="size-3" />
          42 节点 / 6 服务
        </span>
        <span className="inline-flex items-center gap-1">
          <Cpu className="size-3" />
          采集间隔 15s
        </span>
        <span className="inline-flex items-center gap-1">
          <Activity className="size-3" />
          SLO 99.94%
        </span>
        <span className="ml-auto">演示数据 · 已脱敏</span>
      </footer>
    </ScreenShell>
  )
}

/** 分隔线工具：给 KPI 单元格加左侧发丝线（首列除外） */
function cn85(index: number): string {
  return index === 0 ? 'min-w-0 px-3' : 'min-w-0 border-l px-3'
}
