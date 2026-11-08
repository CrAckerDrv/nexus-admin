import { useMemo, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Check,
  CircleCheck,
  CircleDashed,
  Cpu,
  Gauge,
  HardDrive,
  MemoryStick,
  Network,
  Server,
  ShieldCheck,
  Thermometer,
  Timer,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import {
  Badge,
  Button,
  Descriptions,
  Drawer,
  EmptyState,
  Meter,
  Progress,
  Skeleton,
  cn,
  formatRelativeTime,
} from '@nexus/ui'
import { EChart, useChartTokens } from '@/components/charts/echart'
import type { PerfAlert, PerfHost, PerfLog, PerfProcess } from '@/types/domain'
import {
  PERF_ALERT_LEVEL_META,
  PERF_ALERT_STATE_META,
  PERF_ROLE_META,
  PERF_STATUS_META,
  PERF_ZONE_META,
  usageOf,
} from './performance-meta'

/**
 * 性能监控 · 复合小组件
 *
 * 页面主文件负责「数据编排与版面」，这里只放三块需要独立状态的交互件：
 * 节点详情抽屉、告警处置流、实时日志流。
 * 这样主页面不会因为一个抽屉的动画/图表逻辑膨胀到 900 行。
 */

/* ------------------------------------------------------------------ *
 * 节点详情抽屉
 * ------------------------------------------------------------------ */

export function HostDetailDrawer({
  host,
  processes,
  onClose,
}: {
  host: PerfHost | null
  processes: PerfProcess[]
  onClose: () => void
}) {
  const tokens = useChartTokens()
  const [shown, setShown] = useState<PerfHost | null>(host)

  /**
   * 关闭时保留最后一份快照
   *
   * Drawer 有 220ms 退场动画，若直接把 `host` 置空，抽屉会在滑出过程中突然变空。
   * 所以「最新非空值」留在本地：props 一变就同步调整，用 React 官方的
   * 「渲染期修正派生状态」写法（带上一个值做判据），比 useEffect + setState 少一帧空白。
   */
  const [sourceHost, setSourceHost] = useState<PerfHost | null>(host)
  if (host !== sourceHost) {
    setSourceHost(host)
    if (host) setShown(host)
  }

  const trendOption = useMemo(() => {
    if (!shown) return {}
    const labels = shown.cpuTrend.map((_, index) => `-${(shown.cpuTrend.length - 1 - index) * 5}m`)
    return {
      grid: { left: 2, right: 6, top: 22, bottom: 2, containLabel: true },
      legend: {
        right: 0,
        top: 0,
        itemWidth: 7,
        itemHeight: 7,
        itemGap: 12,
        textStyle: { fontSize: 10, color: tokens.fg3 },
      },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: labels,
        axisLine: { lineStyle: { color: tokens.grid } },
        axisTick: { show: false },
        axisLabel: { color: tokens.fg3, fontSize: 9, interval: 2 },
      },
      yAxis: {
        type: 'value',
        max: 100,
        splitLine: { lineStyle: { color: tokens.gridSubtle, type: 'dashed' } },
        axisLabel: { color: tokens.fg3, fontSize: 9, formatter: '{value}%' },
      },
      series: [
        {
          name: 'CPU',
          type: 'line',
          smooth: 0.3,
          showSymbol: false,
          data: shown.cpuTrend,
          lineStyle: { width: 1.8, color: tokens.chart[0] },
          itemStyle: { color: tokens.chart[0] },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${tokens.chart[0]}3d` },
                { offset: 1, color: `${tokens.chart[0]}00` },
              ],
            },
          },
        },
        {
          name: '内存',
          type: 'line',
          smooth: 0.3,
          showSymbol: false,
          data: shown.memoryTrend,
          lineStyle: { width: 1.5, color: tokens.chart[3] },
          itemStyle: { color: tokens.chart[3] },
        },
      ],
    }
  }, [shown, tokens])

  const status = shown ? PERF_STATUS_META[shown.status] : PERF_STATUS_META.healthy
  const topProcesses = useMemo(
    () =>
      processes
        .filter((item) => item.host === shown?.id)
        .sort((a, b) => b.cpu - a.cpu)
        .slice(0, 5),
    [processes, shown?.id],
  )

  return (
    <Drawer
      open={Boolean(host)}
      onOpenChange={(open) => !open && onClose()}
      width={520}
      title={
        shown ? (
          <span className="flex items-center gap-2">
            <Server className="size-4 text-fg-3" />
            {shown.name}
            <Badge tone={status.tone} size="sm" dot>
              {status.label}
            </Badge>
          </span>
        ) : (
          '节点详情'
        )
      }
      description={
        shown ? `${PERF_ROLE_META[shown.role].label} · ${PERF_ZONE_META[shown.zone]}` : undefined
      }
    >
      {shown ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <UsageTile
              icon={<Cpu className="size-3.5" />}
              label="CPU"
              value={shown.cpu}
              hint={`${shown.cores} 核 · load ${shown.load1}`}
            />
            <UsageTile
              icon={<MemoryStick className="size-3.5" />}
              label="内存"
              value={shown.memory}
              hint={`${shown.memoryTotal} GB`}
            />
            <UsageTile
              icon={<HardDrive className="size-3.5" />}
              label="磁盘"
              value={shown.disk}
              hint={`${shown.diskTotal} GB`}
            />
          </div>

          <div className="rounded-md border border-line p-2">
            <p className="mb-1 px-1 text-2xs text-fg-3">近 1 小时 CPU / 内存</p>
            <EChart option={trendOption} height={168} tokens={tokens} />
          </div>

          <Descriptions
            size="sm"
            columns={2}
            items={[
              {
                label: '内网地址',
                value: <span className="font-mono text-xs">{shown.ip}</span>,
                copyable: true,
              },
              { label: '操作系统', value: `${shown.os}` },
              {
                label: '内核版本',
                value: <span className="font-mono text-2xs">{shown.kernel}</span>,
              },
              { label: '运行时长', value: `${shown.uptimeDays} 天` },
              { label: '容器数', value: `${shown.containers}` },
              { label: '温度', value: `${shown.temperature} ℃` },
              { label: 'IOPS', value: shown.iops.toLocaleString() },
              { label: 'P95 延迟', value: `${shown.latencyP95} ms` },
              { label: '网络入', value: `${shown.networkIn} MB/s` },
              { label: '网络出', value: `${shown.networkOut} MB/s` },
              { label: '最后心跳', value: formatRelativeTime(shown.lastHeartbeat) },
              { label: '负载 5 分钟', value: `${shown.load5}` },
            ]}
          />

          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <Activity className="size-3.5 text-fg-3" />
              <h3 className="text-xs font-semibold text-fg">进程占用 TOP</h3>
              <span className="ml-auto text-2xs text-fg-4">按 CPU 排序</span>
            </div>
            {topProcesses.length === 0 ? (
              <EmptyState size="sm" title="该节点暂无进程采集数据" />
            ) : (
              <ul className="divide-y divide-line-subtle rounded-md border border-line">
                {topProcesses.map((item) => (
                  <li
                    key={`${item.host}-${item.pid}`}
                    className="flex items-center gap-2 px-2.5 py-2"
                  >
                    <span
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        item.state === 'zombie'
                          ? 'bg-danger'
                          : item.state === 'running'
                            ? 'bg-success'
                            : 'bg-fg-4',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-2xs text-fg-2">{item.name}</p>
                      <p className="text-2xs text-fg-4">
                        PID {item.pid} · {item.user} · {item.threads} 线程
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-2xs text-fg tabular-nums">
                      {item.cpu.toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Gauge className="size-3.5" />}
              disabled
            >
              查看监控大盘
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ShieldCheck className="size-3.5" />}
              disabled
            >
              执行巡检
            </Button>
            <span className="ml-auto self-center text-2xs text-fg-4">演示环境：跳转已禁用</span>
          </div>
        </div>
      ) : (
        <Skeleton className="h-40 rounded-md" />
      )}
    </Drawer>
  )
}

function UsageTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: number
  hint: string
}) {
  const tone = value >= 90 ? 'danger' : value >= 78 ? 'warning' : 'success'
  return (
    <div className="rounded-md border border-line bg-surface-2/50 p-2.5">
      <p className="flex items-center gap-1 text-2xs text-fg-3">
        {icon}
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-lg leading-6 font-semibold tabular-nums',
          tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-fg',
        )}
      >
        {value.toFixed(1)}
        <span className="ml-0.5 text-2xs font-normal text-fg-4">%</span>
      </p>
      <p className="mt-0.5 truncate text-2xs text-fg-4">{hint}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 告警处置流
 * ------------------------------------------------------------------ */

export function AlertFeed({
  alerts,
  loading,
  canWrite,
  onAck,
  ackingId,
}: {
  alerts: PerfAlert[]
  loading?: boolean
  canWrite: boolean
  onAck: (alert: PerfAlert) => void
  ackingId?: string
}) {
  if (loading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-14 rounded-md" />
        ))}
      </div>
    )
  }

  if (alerts.length === 0) {
    return (
      <EmptyState
        size="sm"
        title="当前没有未处理告警"
        description="所有规则均处于阈值内，保持关注即可。"
      />
    )
  }

  return (
    <ul className="divide-y divide-line-subtle">
      {alerts.map((alert) => {
        const level = PERF_ALERT_LEVEL_META[alert.level]
        const state = PERF_ALERT_STATE_META[alert.state]
        const handled = alert.state !== 'firing'
        return (
          <li key={alert.id} className="px-3.5 py-2.5 transition-colors hover:bg-surface-2/60">
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  'mt-0.5 grid size-5 shrink-0 place-items-center rounded-[4px]',
                  alert.level === 'critical'
                    ? 'bg-danger-weak text-danger'
                    : alert.level === 'warning'
                      ? 'bg-warning-weak text-warning'
                      : 'bg-info-weak text-info',
                )}
              >
                {alert.level === 'info' ? (
                  <Zap className="size-3" />
                ) : (
                  <TriangleAlert className="size-3" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-fg">
                  {alert.title}
                  <span className="shrink-0 rounded-sm bg-surface-3 px-1 py-px text-[10px] font-normal text-fg-3">
                    {level.short}
                  </span>
                </p>
                <p className="mt-0.5 truncate text-2xs text-fg-3">
                  {alert.target} · {alert.value}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-fg-4">
                  <span className="inline-flex items-center gap-0.5">
                    <Timer className="size-2.5" />
                    {alert.duration}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <Network className="size-2.5" />
                    {alert.channels.join(' / ')}
                  </span>
                  <span className="truncate">{alert.runbook}</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge tone={state.tone} size="sm">
                  {state.label}
                </Badge>
                {handled ? (
                  <span className="inline-flex items-center gap-0.5 text-2xs text-fg-4">
                    <Check className="size-3" />
                    {alert.ackBy ?? '已处理'}
                  </span>
                ) : (
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={!canWrite || ackingId === alert.id}
                    onClick={() => onAck(alert)}
                    leftIcon={<CircleCheck className="size-3" />}
                  >
                    确认
                  </Button>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* ------------------------------------------------------------------ *
 * 实时日志
 * ------------------------------------------------------------------ */

const LOG_LEVEL_META = {
  info: { label: 'INFO', className: 'text-info', dot: 'bg-info' },
  warn: { label: 'WARN', className: 'text-warning', dot: 'bg-warning' },
  error: { label: 'ERROR', className: 'text-danger', dot: 'bg-danger' },
} as const

export function LogFeed({
  logs,
  loading,
  level,
  onLevelChange,
}: {
  logs: PerfLog[]
  loading?: boolean
  level: 'all' | PerfLog['level']
  onLevelChange: (level: 'all' | PerfLog['level']) => void
}) {
  const visible = useMemo(
    () => (level === 'all' ? logs : logs.filter((item) => item.level === level)),
    [logs, level],
  )
  const counts = useMemo(
    () => ({
      all: logs.length,
      error: logs.filter((item) => item.level === 'error').length,
      warn: logs.filter((item) => item.level === 'warn').length,
      info: logs.filter((item) => item.level === 'info').length,
    }),
    [logs],
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 py-2">
        {(['all', 'error', 'warn', 'info'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onLevelChange(key)}
            className={cn(
              'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-2xs font-medium transition-colors',
              level === key
                ? 'bg-primary-weak text-primary'
                : 'text-fg-3 hover:bg-surface-2 hover:text-fg-2',
            )}
          >
            {key === 'all' ? '全部' : LOG_LEVEL_META[key].label}
            <span className="tabular-nums opacity-70">{counts[key]}</span>
          </button>
        ))}
        <span className="ml-auto inline-flex items-center gap-1 text-2xs text-success">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-success" />
          </span>
          tail -f
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-4 rounded-sm" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState size="sm" title="该级别暂无日志" />
        ) : (
          <ul className="space-y-1 font-mono text-[11px] leading-4">
            {visible.map((log) => {
              const meta = LOG_LEVEL_META[log.level]
              return (
                <li
                  key={log.id}
                  className="flex items-start gap-1.5 rounded-sm px-1 py-0.5 hover:bg-surface-2"
                >
                  <span className="shrink-0 text-fg-4 tabular-nums">{log.time}</span>
                  <span className={cn('w-[3.25rem] shrink-0 font-semibold', meta.className)}>
                    {meta.label}
                  </span>
                  <span className="w-[6.5rem] shrink-0 truncate text-fg-3">[{log.service}]</span>
                  <span className="min-w-0 flex-1 text-fg-2">{log.message}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 小用量条：表格里高频出现，抽出来保证节奏一致
 * ------------------------------------------------------------------ */

export function UsageBar({ value, hint }: { value: number; hint?: string }) {
  const tone = value >= 90 ? 'danger' : value >= 78 ? 'warning' : 'primary'
  return (
    <div className="flex min-w-[88px] items-center gap-1.5">
      <Progress value={value} size="xs" tone={tone} className="min-w-12 flex-1" />
      <span
        className={cn(
          'w-10 shrink-0 text-right text-2xs tabular-nums',
          value >= 90 ? 'text-danger' : value >= 78 ? 'text-warning' : 'text-fg-2',
        )}
      >
        {value.toFixed(1)}%
      </span>
      {hint && <span className="sr-only">{hint}</span>}
    </div>
  )
}

/** 顶端那条「集群 / 值班 / 采集链路」信息条 */
export function ClusterStrip({
  clusterId,
  region,
  onCall,
  collectInterval,
  prometheus,
  updatedAt,
  critical,
}: {
  clusterId: string
  region: string
  onCall: string
  collectInterval: string
  prometheus: string
  updatedAt: string
  critical: number
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-line bg-surface px-3 py-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg">
        <Server className="size-3.5 text-primary" />
        {clusterId}
      </span>
      <span className="text-2xs text-fg-3">{region}</span>
      <span className="inline-flex items-center gap-1 text-2xs text-fg-3">
        <CircleDashed className={`size-3 ${critical > 0 ? 'text-danger' : 'text-success'}`} />
        {critical > 0 ? `${critical} 个节点异常` : '全部节点健康'}
      </span>
      <span className="inline-flex items-center gap-1 text-2xs text-fg-3">
        <Activity className="size-3" />
        采集 {collectInterval}
      </span>
      <span className="inline-flex items-center gap-1 text-2xs text-fg-3">
        <Thermometer className="size-3" />
        {prometheus}
      </span>
      <span className="ml-auto inline-flex items-center gap-1 text-2xs text-fg-4">
        <ArrowUpRight className="size-3 rotate-90" />
        值班 {onCall} · 更新于 {formatRelativeTime(updatedAt)}
      </span>
    </div>
  )
}

/** 表内「副本」单元格：ready/total + 不足时标红 */
export function ReplicaCell({ ready, total }: { ready: number; total: number }) {
  const short = ready < total
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono text-xs tabular-nums',
        short ? 'text-warning' : 'text-fg-2',
      )}
    >
      <span className={cn('size-1.5 rounded-full', short ? 'bg-warning' : 'bg-success')} />
      {ready}/{total}
    </span>
  )
}

/** 存储卷容量条（含用量与 IOPS 两个维度） */
export function VolumeCell({ used, total, io }: { used: number; total: number; io: number }) {
  const percent = usageOf(used, total)
  return (
    <div className="min-w-[128px]">
      <div className="flex items-baseline justify-between gap-2 text-2xs">
        <span className="text-fg-2 tabular-nums">
          {used} / {total} GB
        </span>
        <span className={cn('tabular-nums', percent >= 90 ? 'text-danger' : 'text-fg-4')}>
          {percent}%
        </span>
      </div>
      <Meter value={percent} showValue={false} className="mt-1" />
      <p className="mt-0.5 text-2xs text-fg-4 tabular-nums">{io.toLocaleString()} IOPS</p>
    </div>
  )
}
