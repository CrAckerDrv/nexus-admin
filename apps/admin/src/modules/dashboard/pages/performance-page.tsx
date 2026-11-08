import { useCallback, useMemo, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  BellOff,
  Cpu,
  Download,
  Gauge,
  HardDrive,
  MemoryStick,
  Pause,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  Siren,
  Terminal,
  Timer,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  CodeBlock,
  DataTable,
  Descriptions,
  Drawer,
  EmptyState,
  PageContainer,
  PageHeader,
  Progress,
  RingMetric,
  SearchInput,
  SectionCard,
  SegmentedControl,
  Select,
  Skeleton,
  SlidingTabs,
  Sparkline,
  cn,
  formatRelativeTime,
  toast,
} from '@nexus/ui'
import type { Column } from '@nexus/ui'
import { EChart, useChartTokens } from '@/components/charts/echart'
import { useAuthStore } from '@/core/auth-store'
import {
  useAckPerfAlert,
  usePerfAlerts,
  usePerfHeatmap,
  usePerfHosts,
  usePerfLogs,
  usePerfProcesses,
  usePerfSeries,
  usePerfServices,
  usePerfSlos,
  usePerfSummary,
  usePerfVolumes,
  useSilenceAlerts,
} from '@/services/queries'
import type {
  PerfAlert,
  PerfAlertLevel,
  PerfHost,
  PerfRange,
  PerfService,
  PerfStatus,
  PerfVolume,
} from '@/types/domain'
import { KpiTile } from '../components/kpi-tile'
import {
  PERF_RANGE_ITEMS,
  PERF_ROLE_META,
  PERF_STATUS_META,
  hostCellColor,
  usageOf,
  volumeStatus,
} from '../components/performance-meta'
import {
  AlertFeed,
  ClusterStrip,
  HostDetailDrawer,
  LogFeed,
  ReplicaCell,
  UsageBar,
  VolumeCell,
} from '../components/performance-widgets'

/**
 * 性能监控
 *
 * 定位：给 SRE / 值班同学用的「不需要跳 Grafana 也能定位问题」的运维面板。
 * 与模板中心的「运维监控墙」大屏刻意区分：
 * - 大屏是投屏资产（只看不点），这里是工作台页面（可筛选、可下钻、可处置）
 * - 全部用 @nexus/ui 既有组件拼装，不引入新依赖，深浅色与密度开关自动适配
 *
 * 版面按值班时的真实视线顺序铺开：
 * ① 集群概况与值班信息 → ② 八个核心指标 → ③ 资源与吞吐趋势 + SLO/告警分布
 * → ④ 节点矩阵与 TOP 明细 → ⑤ 服务健康 → ⑥ 告警中心与实时日志
 * → ⑦ 存储 / 热力图 → ⑧ 进程与采集链
 *
 * 性能约定（与项目既有架构一致）：
 * - 所有 ECharts option 走 useMemo，主题令牌变化才重算
 * - 派生态（合计 / 分组 / 排名）全部 useMemo，渲染期不做遍历
 * - 实时刷新走 React Query 的 `refetchInterval`，「暂停实时」时真正停发请求
 */

type TrendView = 'resource' | 'traffic' | 'network' | 'errors'

const TREND_VIEWS: Array<{ value: TrendView; label: string }> = [
  { value: 'resource', label: '资源水位' },
  { value: 'traffic', label: '吞吐与延迟' },
  { value: 'network', label: '网络吞吐' },
  { value: 'errors', label: '错误率' },
]

const STATUS_OPTIONS = [
  { label: '全部状态', value: 'all' },
  { label: '健康', value: 'healthy' },
  { label: '降级', value: 'warning' },
  { label: '异常', value: 'critical' },
  { label: '离线', value: 'offline' },
]

const ROLE_OPTIONS = [
  { label: '全部角色', value: 'all' },
  { label: '接入网关', value: 'gateway' },
  { label: '应用服务', value: 'app' },
  { label: '接口服务', value: 'api' },
  { label: '关系数据库', value: 'database' },
  { label: '缓存集群', value: 'cache' },
  { label: '消息队列', value: 'mq' },
  { label: '任务节点', value: 'worker' },
  { label: '对象存储', value: 'storage' },
]

const ALERT_LEVEL_OPTIONS = [
  { label: '全部级别', value: 'all' },
  { label: 'P0 紧急', value: 'critical' },
  { label: 'P1 警告', value: 'warning' },
  { label: 'P2 提示', value: 'info' },
]

const ROLE_ORDER: Array<PerfHost['role']> = [
  'gateway',
  'app',
  'api',
  'database',
  'cache',
  'mq',
  'worker',
  'storage',
]

const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

/** 指标卡的语义图标（纯装饰，不参与排序） */
const KPI_ICON: Record<string, React.ReactNode> = {
  nodes: <Server className="size-[18px]" strokeWidth={1.9} />,
  cpu: <Cpu className="size-[18px]" strokeWidth={1.9} />,
  memory: <MemoryStick className="size-[18px]" strokeWidth={1.9} />,
  disk: <HardDrive className="size-[18px]" strokeWidth={1.9} />,
  qps: <Zap className="size-[18px]" strokeWidth={1.9} />,
  latency: <Timer className="size-[18px]" strokeWidth={1.9} />,
  errors: <TriangleAlert className="size-[18px]" strokeWidth={1.9} />,
  alerts: <Siren className="size-[18px]" strokeWidth={1.9} />,
}

export default function PerformancePage() {
  const [range, setRange] = useState<PerfRange>('24h')
  const [live, setLive] = useState(true)
  const [trendView, setTrendView] = useState<TrendView>('resource')
  const [hostStatus, setHostStatus] = useState<string>('all')
  const [hostRole, setHostRole] = useState<string>('all')
  const [keyword, setKeyword] = useState('')
  const [selectedHost, setSelectedHost] = useState<PerfHost | null>(null)
  const [selectedService, setSelectedService] = useState<PerfService | null>(null)
  const [alertLevel, setAlertLevel] = useState<string>('all')
  const [logLevel, setLogLevel] = useState<'all' | 'info' | 'warn' | 'error'>('all')
  const [ackingId, setAckingId] = useState<string | undefined>(undefined)

  const hasPermission = useAuthStore((state) => state.hasPermission)
  const currentUser = useAuthStore((state) => state.user)
  /**
   * 值班人姓名单独取出
   *
   * 直接依赖 `currentUser?.name` 会让 React Compiler 认为「手写依赖与推断依赖不一致」
   * （它推断出的是整个 currentUser），从而跳过整页的自动记忆化。
   */
  const operatorName = currentUser?.name ?? '值班同学'
  /** 处置类操作（确认告警 / 静默）需要运维写权限；只读账号看得到、点不动 */
  const canOperate = hasPermission('ops:write')

  const summary = usePerfSummary({ refetchInterval: live ? 30_000 : false })
  const series = usePerfSeries(range)
  // pageSize 取全部：矩阵与 TOP 榜都要用全量节点，分页在客户端做（演示集群 54 台）
  const hosts = usePerfHosts({ pageSize: 200 })
  const services = usePerfServices()
  const alerts = usePerfAlerts({ level: alertLevel })
  const heatmap = usePerfHeatmap()
  const volumes = usePerfVolumes()
  const processes = usePerfProcesses()
  const logs = usePerfLogs()
  const slos = usePerfSlos()
  const ackAlert = useAckPerfAlert()
  const silenceAlerts = useSilenceAlerts()

  const tokens = useChartTokens()

  /**
   * 语义色
   *
   * Canvas 与部分内联样式无法解析 CSS 变量，这里把 --n-danger / --n-warning
   * 解析成具体色值；`version` 参与依赖，切换皮肤或深浅色后重新解析。
   */
  const palette = useMemo(() => {
    const styles = typeof window === 'undefined' ? null : getComputedStyle(document.documentElement)
    const read = (name: string, fallback: string) =>
      styles?.getPropertyValue(name).trim() || fallback
    return {
      version: tokens.version,
      danger: read('--n-danger', '#dc2626'),
      warning: read('--n-warning', '#d97706'),
      success: read('--n-success', '#12a150'),
    }
  }, [tokens.version])

  const trendPoints = useMemo(() => series.data?.points ?? [], [series.data])

  /* ---------------------- 节点：筛选 / 分组 / 排名 ---------------------- */

  const filteredHosts = useMemo(() => {
    const needle = keyword.trim().toLowerCase()
    return (hosts.data?.items ?? []).filter((host) => {
      if (hostStatus !== 'all' && host.status !== hostStatus) return false
      if (hostRole !== 'all' && host.role !== hostRole) return false
      if (needle && !`${host.name}${host.ip}`.toLowerCase().includes(needle)) return false
      return true
    })
  }, [hosts.data, hostStatus, hostRole, keyword])

  const hostCounts = useMemo(() => {
    const all = hosts.data?.items ?? []
    return {
      healthy: all.filter((host) => host.status === 'healthy').length,
      warning: all.filter((host) => host.status === 'warning').length,
      critical: all.filter((host) => host.status === 'critical').length,
      offline: all.filter((host) => host.status === 'offline').length,
    }
  }, [hosts.data])

  const roleGroups = useMemo(
    () =>
      ROLE_ORDER.map((role) => {
        const list = filteredHosts.filter((host) => host.role === role)
        const avgCpu = list.length ? list.reduce((sum, host) => sum + host.cpu, 0) / list.length : 0
        return { role, hosts: list, avgCpu }
      }).filter((group) => group.hosts.length > 0),
    [filteredHosts],
  )

  const topHosts = useMemo(
    () => [...filteredHosts].sort((a, b) => b.cpu - a.cpu).slice(0, 8),
    [filteredHosts],
  )

  /* ---------------------- 服务 ---------------------- */

  const serviceRows = useMemo(
    () => [...(services.data ?? [])].sort((a, b) => b.p95 - a.p95),
    [services.data],
  )

  /* ---------------------- 告警 ---------------------- */

  const alertCounts = useMemo(() => {
    const list = alerts.data ?? []
    return {
      critical: list.filter((item) => item.level === 'critical').length,
      warning: list.filter((item) => item.level === 'warning').length,
      info: list.filter((item) => item.level === 'info').length,
      total: list.length,
    }
  }, [alerts.data])

  const firingAlerts = useMemo(
    () => (alerts.data ?? []).filter((item) => item.state !== 'resolved'),
    [alerts.data],
  )

  const criticalAlerts = useMemo(
    () => firingAlerts.filter((item) => item.level === 'critical'),
    [firingAlerts],
  )

  /* ---------------------- 热力图 ---------------------- */

  const heatCells = useMemo(() => heatmap.data ?? [], [heatmap.data])
  const heatMax = useMemo(() => Math.max(1, ...heatCells.map((cell) => cell.value)), [heatCells])
  /**
   * 热力图色阶用「最小-最大」归一化
   *
   * 集群负载的绝对值落在 8%–99%，但真正有信息量的是「相对高低」。
   * 若按 0–100 上色，一整周会糊成一片同色蓝；拉伸到实测区间后，
   * 工作日白天与凌晨的差别才看得见。
   */
  const heatScale = useMemo(() => {
    if (heatCells.length === 0) return { min: 0, span: 1 }
    let min = Infinity
    let max = -Infinity
    for (const cell of heatCells) {
      if (cell.value < min) min = cell.value
      if (cell.value > max) max = cell.value
    }
    return { min, span: Math.max(1, max - min) }
  }, [heatCells])

  /**
   * 热力图统计
   *
   * 只有一张格子图时，卡片右侧会留出一大片空白（左边存储表更高）。
   * 与其把格子拉成竖条，不如补三个真正有人看的数：峰值 / 均值 / 工作日与周末对比。
   */
  const heatStats = useMemo(() => {
    if (heatCells.length === 0) return null
    let peak = 0
    let sum = 0
    let weekdaySum = 0
    let weekdayCount = 0
    let weekendSum = 0
    let weekendCount = 0
    for (const cell of heatCells) {
      if (cell.value > peak) peak = cell.value
      sum += cell.value
      if (cell.day >= 5) {
        weekendSum += cell.value
        weekendCount += 1
      } else {
        weekdaySum += cell.value
        weekdayCount += 1
      }
    }
    const weekday = weekdayCount ? weekdaySum / weekdayCount : 0
    const weekend = weekendCount ? weekendSum / weekendCount : 0
    return {
      peak,
      average: sum / heatCells.length,
      weekday,
      weekend,
      gap: weekday > 0 ? ((weekday - weekend) / weekday) * 100 : 0,
    }
  }, [heatCells])
  /** 按「星期 → 小时」建索引，避免 168 次线性查找 */
  const heatIndex = useMemo(() => {
    const map = new Map<string, number>()
    for (const cell of heatCells) map.set(`${cell.day}-${cell.hour}`, cell.value)
    return map
  }, [heatCells])

  /* ---------------------- 存储 ---------------------- */

  const volumeRows = useMemo(
    () =>
      [...(volumes.data ?? [])]
        .map((volume) => ({ ...volume, status: volumeStatus(volume) }))
        .sort((a, b) => usageOf(b.used, b.total) - usageOf(a.used, a.total)),
    [volumes.data],
  )

  const volumeRisk = useMemo(
    () => volumeRows.filter((volume) => volume.status !== 'healthy').length,
    [volumeRows],
  )

  /* ---------------------- 趋势图 ---------------------- */

  const trendOption = useMemo(() => {
    const labels = trendPoints.map((point) => point.time)
    const axisLabel = {
      color: tokens.fg3,
      fontSize: 10,
      interval: Math.max(0, Math.floor(labels.length / 10) - 1),
    }
    const xAxis = {
      type: 'category',
      boundaryGap: false,
      data: labels,
      axisLine: { lineStyle: { color: tokens.grid } },
      axisTick: { show: false },
      axisLabel,
    }
    const baseGrid = { left: 6, right: 16, top: 30, bottom: 26, containLabel: true }
    const legend = (data: string[]) => ({
      top: 0,
      right: 0,
      icon: 'roundRect',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 14,
      textStyle: { fontSize: 11, color: tokens.fg2 },
      data,
    })
    const percentAxis = {
      type: 'value',
      max: 100,
      splitLine: { lineStyle: { color: tokens.gridSubtle, type: 'dashed' } },
      axisLabel: { color: tokens.fg3, fontSize: 10, formatter: '{value}%' },
    }

    if (trendView === 'resource') {
      return {
        grid: baseGrid,
        tooltip: { trigger: 'axis' },
        legend: legend(['CPU', '内存', '磁盘', '负载']),
        xAxis,
        yAxis: [
          percentAxis,
          {
            type: 'value',
            splitLine: { show: false },
            axisLabel: { color: tokens.fg3, fontSize: 10 },
          },
        ],
        series: [
          {
            name: 'CPU',
            type: 'line',
            smooth: 0.3,
            showSymbol: false,
            data: trendPoints.map((point) => point.cpu),
            lineStyle: { width: 2.2, color: tokens.chart[0] },
            itemStyle: { color: tokens.chart[0] },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: `${tokens.chart[0]}4d` },
                  { offset: 1, color: `${tokens.chart[0]}00` },
                ],
              },
            },
            markLine: {
              silent: true,
              symbol: 'none',
              lineStyle: { color: palette.danger, type: 'dashed', width: 1, opacity: 0.75 },
              label: {
                formatter: '告警阈值 85%',
                position: 'insideStartTop',
                color: palette.danger,
                fontSize: 10,
                backgroundColor: tokens.surface,
                padding: [2, 4],
                borderRadius: 3,
              },
              data: [{ yAxis: 85 }],
            },
          },
          {
            name: '内存',
            type: 'line',
            smooth: 0.3,
            showSymbol: false,
            data: trendPoints.map((point) => point.memory),
            lineStyle: { width: 1.7, color: tokens.chart[3] },
            itemStyle: { color: tokens.chart[3] },
          },
          {
            name: '磁盘',
            type: 'line',
            smooth: 0.3,
            showSymbol: false,
            data: trendPoints.map((point) => point.disk),
            lineStyle: { width: 1.4, type: 'dotted', color: tokens.chart[2] },
            itemStyle: { color: tokens.chart[2] },
          },
          {
            name: '负载',
            type: 'line',
            yAxisIndex: 1,
            smooth: 0.3,
            showSymbol: false,
            data: trendPoints.map((point) => point.load),
            lineStyle: { width: 1.2, type: 'dashed', color: tokens.chart[5] },
            itemStyle: { color: tokens.chart[5] },
          },
        ],
      }
    }

    if (trendView === 'traffic') {
      return {
        grid: baseGrid,
        tooltip: { trigger: 'axis' },
        legend: legend(['QPS', 'P95 (ms)']),
        xAxis,
        yAxis: [
          {
            type: 'value',
            splitLine: { lineStyle: { color: tokens.gridSubtle, type: 'dashed' } },
            axisLabel: {
              color: tokens.fg3,
              fontSize: 10,
              formatter: (value: number) => `${Math.round(value / 1000)}k`,
            },
          },
          {
            type: 'value',
            splitLine: { show: false },
            axisLabel: { color: tokens.fg3, fontSize: 10 },
          },
        ],
        series: [
          {
            name: 'QPS',
            type: 'line',
            smooth: 0.3,
            showSymbol: false,
            data: trendPoints.map((point) => point.qps),
            lineStyle: { width: 2.2, color: tokens.chart[0] },
            itemStyle: { color: tokens.chart[0] },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: `${tokens.chart[0]}40` },
                  { offset: 1, color: `${tokens.chart[0]}00` },
                ],
              },
            },
          },
          {
            name: 'P95 (ms)',
            type: 'line',
            yAxisIndex: 1,
            smooth: 0.3,
            showSymbol: false,
            data: trendPoints.map((point) => point.latency),
            lineStyle: { width: 1.6, color: palette.warning },
            itemStyle: { color: palette.warning },
            markLine: {
              silent: true,
              symbol: 'none',
              lineStyle: { color: palette.danger, type: 'dashed', width: 1, opacity: 0.7 },
              label: { color: palette.danger, fontSize: 10, formatter: 'P95 预算 500ms' },
              data: [{ yAxis: 500 }],
            },
          },
        ],
      }
    }

    if (trendView === 'network') {
      return {
        grid: baseGrid,
        tooltip: { trigger: 'axis' },
        legend: legend(['入站', '出站']),
        xAxis,
        yAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: tokens.gridSubtle, type: 'dashed' } },
          axisLabel: { color: tokens.fg3, fontSize: 10, formatter: '{value} MB/s' },
        },
        series: [
          {
            name: '入站',
            type: 'line',
            smooth: 0.3,
            showSymbol: false,
            data: trendPoints.map((point) => point.networkIn),
            lineStyle: { width: 2, color: tokens.chart[5] },
            itemStyle: { color: tokens.chart[5] },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: `${tokens.chart[5]}42` },
                  { offset: 1, color: `${tokens.chart[5]}00` },
                ],
              },
            },
          },
          {
            name: '出站',
            type: 'line',
            smooth: 0.3,
            showSymbol: false,
            data: trendPoints.map((point) => point.networkOut),
            lineStyle: { width: 1.6, color: tokens.chart[1] },
            itemStyle: { color: tokens.chart[1] },
          },
        ],
      }
    }

    return {
      grid: baseGrid,
      tooltip: { trigger: 'axis' },
      legend: legend(['错误率']),
      xAxis,
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: tokens.gridSubtle, type: 'dashed' } },
        axisLabel: { color: tokens.fg3, fontSize: 10, formatter: '{value}%' },
      },
      series: [
        {
          name: '错误率',
          type: 'line',
          smooth: 0.3,
          showSymbol: false,
          data: trendPoints.map((point) => point.errorRate),
          lineStyle: { width: 2.2, color: palette.danger },
          itemStyle: { color: palette.danger },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${palette.danger}3d` },
                { offset: 1, color: `${palette.danger}00` },
              ],
            },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: palette.warning, type: 'dashed', width: 1 },
            label: { color: palette.warning, fontSize: 10, formatter: 'SLO 上限 1%' },
            data: [{ yAxis: 1 }],
          },
        },
      ],
    }
  }, [trendPoints, trendView, tokens, palette])

  /* ---------------------- 服务 P95 横向条形 ---------------------- */

  const serviceLatencyOption = useMemo(() => {
    // ECharts 类目轴从下往上排：先降序再反转，最慢的服务才会出现在顶部
    const rows = serviceRows.slice(0, 9).reverse()
    return {
      grid: { left: 4, right: 46, top: 6, bottom: 4, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: tokens.gridSubtle, type: 'dashed' } },
        axisLabel: { color: tokens.fg3, fontSize: 9, formatter: '{value}ms' },
      },
      yAxis: {
        type: 'category',
        data: rows.map((row) => row.name),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: tokens.fg3, fontSize: 10 },
      },
      series: [
        {
          type: 'bar',
          barWidth: 10,
          data: rows.map((row) => ({
            value: row.p95,
            itemStyle: {
              borderRadius: [0, 4, 4, 0],
              color:
                row.status === 'critical'
                  ? palette.danger
                  : row.status === 'warning'
                    ? palette.warning
                    : `${tokens.chart[0]}cc`,
            },
          })),
          label: {
            show: true,
            position: 'right',
            fontSize: 10,
            color: tokens.fg3,
            formatter: '{c}ms',
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: palette.danger, type: 'dashed', width: 1, opacity: 0.7 },
            label: { color: palette.danger, fontSize: 9, formatter: '500ms' },
            data: [{ xAxis: 500 }],
          },
        },
      ],
    }
  }, [serviceRows, tokens, palette])

  /* ---------------------- 交互 ---------------------- */

  const refreshAll = useCallback(() => {
    void summary.refetch()
    void series.refetch()
    void hosts.refetch()
    void services.refetch()
    void alerts.refetch()
    toast.success('监控数据已刷新')
  }, [summary, series, hosts, services, alerts])

  const handleAck = useCallback(
    async (alert: PerfAlert) => {
      setAckingId(alert.id)
      try {
        await ackAlert.mutateAsync({ id: alert.id, actor: operatorName })
        toast.success(`已确认：${alert.title}`)
      } catch {
        toast.error('确认失败，请稍后重试')
      } finally {
        setAckingId(undefined)
      }
    },
    [ackAlert, operatorName],
  )

  const handleSilence = useCallback(async () => {
    try {
      const result = await silenceAlerts.mutateAsync(60)
      toast.success(`已静默 60 分钟，至 ${new Date(result.until).toLocaleTimeString('zh-CN')}`)
    } catch {
      toast.error('静默失败，请稍后重试')
    }
  }, [silenceAlerts])

  const jumpToAlerts = useCallback(() => {
    document.getElementById('perf-alerts')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  /* ---------------------- 表格列 ---------------------- */

  const hostColumns = useMemo<Column<PerfHost>[]>(
    () => [
      {
        key: 'name',
        header: '节点',
        width: 148,
        sortValue: (row) => row.name,
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-mono text-[13px] text-fg">{row.name}</p>
            <p className="truncate text-2xs text-fg-4">
              {row.ip} · {row.zone}
            </p>
          </div>
        ),
      },
      {
        key: 'cpu',
        header: 'CPU',
        width: 74,
        align: 'right',
        sortValue: (row) => row.cpu,
        cell: (row) => <MetricText value={row.cpu} unit="%" />,
      },
      {
        key: 'memory',
        header: '内存',
        width: 74,
        align: 'right',
        sortValue: (row) => row.memory,
        cell: (row) => <MetricText value={row.memory} unit="%" />,
      },
      {
        key: 'disk',
        header: '磁盘',
        width: 74,
        align: 'right',
        sortValue: (row) => row.disk,
        cell: (row) => <MetricText value={row.disk} unit="%" />,
      },
      {
        key: 'latencyP95',
        header: 'P95',
        width: 68,
        align: 'right',
        sortValue: (row) => row.latencyP95,
        cell: (row) => (
          <span className="font-mono text-xs text-fg-2 tabular-nums">{row.latencyP95}ms</span>
        ),
      },
      {
        key: 'status',
        header: '状态',
        width: 76,
        cell: (row) => (
          <Badge tone={PERF_STATUS_META[row.status].tone} size="sm" dot>
            {PERF_STATUS_META[row.status].label}
          </Badge>
        ),
      },
    ],
    [],
  )

  const serviceColumns = useMemo<Column<PerfService>[]>(
    () => [
      {
        key: 'name',
        header: '服务',
        width: 166,
        sortValue: (row) => row.name,
        cell: (row) => (
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className={cn(
                'size-1.5 shrink-0 rounded-full',
                row.status === 'critical'
                  ? 'bg-danger'
                  : row.status === 'warning'
                    ? 'bg-warning'
                    : 'bg-success',
              )}
            />
            <div className="min-w-0">
              <p className="truncate font-mono text-[13px] text-fg">{row.name}</p>
              <p className="truncate text-2xs text-fg-4">{row.owner}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'replicas',
        header: '副本',
        width: 58,
        sortValue: (row) => row.ready,
        cell: (row) => <ReplicaCell ready={row.ready} total={row.replicas} />,
      },
      {
        key: 'qps',
        header: 'QPS',
        width: 72,
        align: 'right',
        sortValue: (row) => row.qps,
        cell: (row) => (
          <span className="font-mono text-xs text-fg-2 tabular-nums">
            {row.qps.toLocaleString()}
          </span>
        ),
      },
      {
        key: 'p95',
        header: 'P95',
        width: 64,
        align: 'right',
        sortValue: (row) => row.p95,
        cell: (row) => (
          <span
            className={cn(
              'font-mono text-xs tabular-nums',
              row.p95 >= 500 ? 'text-danger' : row.p95 >= 200 ? 'text-warning' : 'text-fg-2',
            )}
          >
            {row.p95}ms
          </span>
        ),
      },
      {
        key: 'errorRate',
        header: '错误率',
        width: 70,
        align: 'right',
        sortValue: (row) => row.errorRate,
        cell: (row) => (
          <span
            className={cn(
              'font-mono text-xs tabular-nums',
              row.errorRate >= 1
                ? 'text-danger'
                : row.errorRate >= 0.4
                  ? 'text-warning'
                  : 'text-fg-3',
            )}
          >
            {row.errorRate.toFixed(2)}%
          </span>
        ),
      },
      {
        key: 'cpu',
        header: 'CPU / 内存',
        width: 116,
        cell: (row) => (
          <div className="min-w-[96px] space-y-1">
            <UsageBar value={row.cpu} />
            <UsageBar value={row.memory} />
          </div>
        ),
      },
      {
        key: 'slo',
        header: 'SLO',
        width: 68,
        align: 'right',
        sortValue: (row) => row.slo,
        cell: (row) => (
          <span className="font-mono text-2xs text-fg-2 tabular-nums">{row.slo.toFixed(2)}%</span>
        ),
      },
      {
        key: 'status',
        header: '状态',
        width: 70,
        cell: (row) => (
          <Badge tone={PERF_STATUS_META[row.status].tone} size="sm" dot>
            {PERF_STATUS_META[row.status].label}
          </Badge>
        ),
      },
    ],
    [],
  )

  const volumeColumns = useMemo<Column<PerfVolume>[]>(
    () => [
      {
        key: 'host',
        header: '节点 / 挂载点',
        width: 168,
        sortValue: (row) => row.host,
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-mono text-[13px] text-fg">{row.host}</p>
            <p className="truncate text-2xs text-fg-4">
              {row.mount} · {row.fs}
            </p>
          </div>
        ),
      },
      {
        key: 'usage',
        header: '容量',
        width: 150,
        cell: (row) => (
          <VolumeCell used={row.used} total={row.total} io={row.readIops + row.writeIops} />
        ),
      },
      {
        key: 'latency',
        header: 'IO 延迟',
        width: 82,
        align: 'right',
        sortValue: (row) => row.latency,
        cell: (row) => (
          <span
            className={cn(
              'font-mono text-xs tabular-nums',
              row.latency >= 6 ? 'text-danger' : row.latency >= 4 ? 'text-warning' : 'text-fg-2',
            )}
          >
            {row.latency.toFixed(1)}ms
          </span>
        ),
      },
      {
        key: 'inode',
        header: 'inode',
        width: 70,
        align: 'right',
        sortValue: (row) => row.inode,
        cell: (row) => (
          <span className="font-mono text-2xs text-fg-3 tabular-nums">{row.inode}%</span>
        ),
      },
      {
        key: 'status',
        header: '状态',
        width: 76,
        cell: (row) => (
          <Badge tone={PERF_STATUS_META[row.status].tone} size="sm" dot>
            {PERF_STATUS_META[row.status].label}
          </Badge>
        ),
      },
    ],
    [],
  )

  const processRows = processes.data ?? []
  const summaryData = summary.data

  return (
    <PageContainer size="lg">
      <PageHeader
        title="性能监控"
        description="服务器、服务与告警的实时运维面板 · 支持按时间段回看、节点下钻与告警处置"
        badge={
          live ? (
            <Badge tone="success" variant="soft" dot>
              实时采集中
            </Badge>
          ) : (
            <Badge tone="warning" variant="soft" dot>
              已暂停刷新
            </Badge>
          )
        }
        // 操作区有 4 个时间区间 + 3 个按钮：窄屏必须允许收缩换行，否则整体顶出容器
        actionsClassName="min-w-0 shrink"
        actions={
          <>
            <SlidingTabs
              size="sm"
              items={PERF_RANGE_ITEMS}
              value={range}
              onChange={(value) => setRange(value)}
            />
            <Button
              variant="secondary"
              leftIcon={live ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              onClick={() => {
                setLive((prev) => !prev)
                toast.info(live ? '已暂停自动刷新' : '已恢复实时刷新（30 秒）')
              }}
            >
              {live ? '暂停实时' : '恢复实时'}
            </Button>
            <Button
              variant="secondary"
              leftIcon={
                <RefreshCw className={cn('size-3.5', summary.isFetching && 'animate-spin')} />
              }
              onClick={refreshAll}
            >
              刷新
            </Button>
            <Button
              variant="primary"
              leftIcon={<BellOff className="size-3.5" />}
              disabled={!canOperate || silenceAlerts.isPending}
              onClick={() => void handleSilence()}
            >
              静默 60 分钟
            </Button>
          </>
        }
      />

      {/* ---------------------- ① 集群概况 ---------------------- */}
      {summaryData && (
        <ClusterStrip
          clusterId={summaryData.cluster.id}
          region={summaryData.cluster.region}
          onCall={summaryData.cluster.onCall}
          collectInterval={summaryData.cluster.collectInterval}
          prometheus={summaryData.cluster.prometheus}
          updatedAt={summaryData.cluster.updatedAt}
          critical={summaryData.nodes.critical + summaryData.nodes.offline}
        />
      )}

      {criticalAlerts.length > 0 && (
        <Alert
          className="mt-3"
          tone="danger"
          title={`${criticalAlerts.length} 条 P0 告警未处理，建议立即介入`}
          action={
            <Button size="xs" variant="danger" onClick={jumpToAlerts}>
              去处置
            </Button>
          }
        >
          {criticalAlerts
            .slice(0, 2)
            .map((alert) => alert.title)
            .join('；')}
          {criticalAlerts.length > 2 ? ` 等 ${criticalAlerts.length} 条` : ''}
        </Alert>
      )}

      {/* ---------------------- ② 核心指标 ---------------------- */}
      {/*
        指标卡固定 4 列
        KpiTile 在右侧预留了 56px 给图标、标签又是单行 truncate，
        卡片再窄就会出现「集群平…」这类截断（实测 8 列时每张约 200px，必断）。
        8 个指标排成两行反而是更好的读法：上行看「资源水位」，下行看「请求与告警」。
      */}
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {summary.isLoading
          ? Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-[136px] rounded-lg" />
            ))
          : (summaryData?.kpis ?? []).map((kpi, index) => (
              <KpiTile
                key={kpi.key}
                index={index}
                label={kpi.label}
                value={kpi.value}
                decimals={kpi.decimals}
                prefix={kpi.prefix}
                suffix={kpi.unit}
                delta={kpi.delta}
                deltaLabel={kpi.deltaLabel}
                trend={kpi.trend}
                tone={kpi.tone}
                icon={KPI_ICON[kpi.key]}
                live={live && kpi.key === 'qps'}
              />
            ))}
      </div>

      {/* ---------------------- ③ 趋势 + SLO / 告警分布 ---------------------- */}
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <SectionCard
          title="资源与吞吐趋势"
          description={`${PERF_RANGE_ITEMS.find((item) => item.value === range)?.label ?? ''}聚合，虚线为告警阈值`}
          extra={
            <SegmentedControl
              size="sm"
              options={TREND_VIEWS}
              value={trendView}
              onChange={(value) => setTrendView(value as TrendView)}
            />
          }
          bodyClassName="flex flex-col px-2 pb-2 pt-3"
        >
          {/*
            图表高度交给 flex 而不是写死 320
            右栏（SLO + 告警分布）比单张趋势图高，网格会把左卡片拉伸到同一行高；
            固定高度会在卡片底部留出一块空白，而 100% 会让画布自己长高。
          */}
          <div className="min-h-[320px] flex-1">
            {series.isLoading ? (
              <Skeleton className="size-full rounded-md" />
            ) : (
              <EChart option={trendOption} height="100%" tokens={tokens} />
            )}
          </div>
        </SectionCard>

        <div className="grid grid-rows-2 gap-3">
          <SectionCard
            title="SLO 与错误预算"
            description="按月滚动窗口计算，燃烧率越高剩余预算消耗越快"
            extra={
              <Badge
                tone={summaryData && summaryData.burnRate > 5 ? 'danger' : 'success'}
                size="sm"
              >
                燃烧率 {summaryData?.burnRate.toFixed(1) ?? '—'}x
              </Badge>
            }
            bodyClassName="px-4 pb-3 pt-2"
          >
            <div className="flex items-center gap-4">
              <RingMetric
                value={summaryData?.errorBudget ?? 0}
                size={104}
                stroke={9}
                tone={
                  (summaryData?.errorBudget ?? 0) >= 60
                    ? 'success'
                    : (summaryData?.errorBudget ?? 0) >= 30
                      ? 'warning'
                      : 'danger'
                }
                label={`${(summaryData?.errorBudget ?? 0).toFixed(1)}%`}
                sublabel="剩余预算"
              />
              <div className="min-w-0 flex-1 space-y-2">
                {slos.isLoading ? (
                  <Skeleton className="h-16 rounded-md" />
                ) : (
                  (slos.data ?? []).slice(0, 3).map((item) => {
                    const met = item.actual >= item.target
                    return (
                      <div key={item.id}>
                        <div className="flex items-baseline justify-between gap-2 text-2xs">
                          <span className="truncate text-fg-2">{item.name}</span>
                          <span
                            className={cn(
                              'shrink-0 font-medium tabular-nums',
                              met ? 'text-success' : 'text-danger',
                            )}
                          >
                            {item.actual.toFixed(2)}%
                          </span>
                        </div>
                        {/*
                          条形画「剩余错误预算」而不是「实际可用性」：
                          可用性永远在 99% 以上，画出来三根条都贴满，看不出差别；
                          剩余预算才是真正会耗尽、需要决策的那个数。
                        */}
                        <Progress
                          className="mt-1"
                          value={item.budgetLeft}
                          size="xs"
                          tone={
                            item.budgetLeft >= 60
                              ? 'success'
                              : item.budgetLeft >= 30
                                ? 'warning'
                                : 'danger'
                          }
                        />
                        <p className="mt-0.5 flex items-center justify-between text-[10px] text-fg-4 tabular-nums">
                          <span>目标 {item.target.toFixed(2)}%</span>
                          <span>预算剩 {item.budgetLeft.toFixed(1)}%</span>
                        </p>
                      </div>
                    )
                  })
                )}
                <p className="flex items-center gap-1 rounded-sm border border-dashed border-line px-1.5 py-1 text-2xs text-fg-3">
                  <ShieldCheck className="size-3 shrink-0 text-primary" />
                  目标 {(slos.data?.[0]?.target ?? 99.95).toFixed(2)}% · 窗口{' '}
                  {slos.data?.[0]?.window ?? '30 天滚动'}
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="告警分布"
            description="按级别统计，点击级别可直接筛选下方告警中心"
            extra={
              <Button size="xs" variant="text" onClick={jumpToAlerts}>
                查看全部
              </Button>
            }
            bodyClassName="px-4 pb-4 pt-2"
          >
            <div className="space-y-2.5">
              {(
                [
                  {
                    level: 'critical' as PerfAlertLevel,
                    value: alertCounts.critical,
                    tone: 'danger',
                  },
                  {
                    level: 'warning' as PerfAlertLevel,
                    value: alertCounts.warning,
                    tone: 'warning',
                  },
                  { level: 'info' as PerfAlertLevel, value: alertCounts.info, tone: 'primary' },
                ] satisfies Array<{
                  level: PerfAlertLevel
                  value: number
                  tone: 'danger' | 'warning' | 'primary'
                }>
              ).map((item) => {
                const total = Math.max(1, alertCounts.total)
                return (
                  <button
                    key={item.level}
                    type="button"
                    onClick={() => {
                      setAlertLevel(item.level)
                      jumpToAlerts()
                    }}
                    className="block w-full text-left"
                  >
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-fg-2">
                        {item.level === 'critical'
                          ? 'P0 紧急'
                          : item.level === 'warning'
                            ? 'P1 警告'
                            : 'P2 提示'}
                      </span>
                      <span className="font-medium text-fg tabular-nums">
                        {item.value}
                        <span className="ml-0.5 text-2xs font-normal text-fg-4">条</span>
                      </span>
                    </div>
                    <Progress
                      className="mt-1"
                      value={(item.value / total) * 100}
                      size="sm"
                      tone={item.tone}
                    />
                  </button>
                )
              })}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-md border border-line bg-surface-2/50 px-2 py-1.5 text-2xs text-fg-3">
              <Activity className="size-3 shrink-0 text-fg-4" />
              未处理 {summaryData?.alerts.unacked ?? 0} 条 · 已确认{' '}
              {Math.max(0, alertCounts.total - (summaryData?.alerts.unacked ?? 0))} 条
              {!canOperate && <span className="ml-auto text-warning">只读权限</span>}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* ---------------------- ④ 节点矩阵 + TOP 明细 ---------------------- */}
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <SectionCard
          title="节点健康矩阵"
          description="每格一台节点，颜色越深负载越高；点击查看详情"
          extra={
            <Badge tone="primary" size="sm">
              实时
            </Badge>
          }
          bodyClassName="px-4 pb-4 pt-2"
        >
          {/* 图例单独一行：和筛选控件挤在同一行时，窄屏会先挤掉图例文字 */}
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-fg-4">
            {(
              [
                { status: 'healthy' as PerfStatus, count: hostCounts.healthy },
                { status: 'warning' as PerfStatus, count: hostCounts.warning },
                { status: 'critical' as PerfStatus, count: hostCounts.critical },
                { status: 'offline' as PerfStatus, count: hostCounts.offline },
              ] satisfies Array<{ status: PerfStatus; count: number }>
            ).map((item) => (
              <span key={item.status} className="inline-flex items-center gap-1">
                <span
                  className="size-2 rounded-[2px]"
                  style={{ backgroundColor: `var(${PERF_STATUS_META[item.status].cssVar})` }}
                />
                {PERF_STATUS_META[item.status].label}
                <span className="text-fg-3 tabular-nums">{item.count}</span>
              </span>
            ))}
            <span className="ml-auto">颜色深浅 = CPU 占用</span>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Select
              size="sm"
              className="w-[7.5rem]"
              options={STATUS_OPTIONS}
              value={hostStatus}
              onChange={(value) => setHostStatus(value)}
            />
            <Select
              size="sm"
              className="w-[8.5rem]"
              options={ROLE_OPTIONS}
              value={hostRole}
              onChange={(value) => setHostRole(value)}
            />
            <SearchInput
              size="sm"
              className="ml-auto w-[10.5rem]"
              value={keyword}
              onChange={setKeyword}
              placeholder="节点名 / IP"
            />
          </div>

          {hosts.isLoading ? (
            <Skeleton className="h-[210px] rounded-md" />
          ) : roleGroups.length === 0 ? (
            <EmptyState size="sm" title="没有匹配的节点" description="调整状态或角色筛选后再试。" />
          ) : (
            <div className="space-y-2">
              {roleGroups.map((group) => (
                <div key={group.role} className="flex items-center gap-2.5">
                  <span className="w-[3.75rem] shrink-0 truncate text-2xs text-fg-3">
                    {PERF_ROLE_META[group.role].short}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                    {group.hosts.map((host) => (
                      <button
                        key={host.id}
                        type="button"
                        onClick={() => setSelectedHost(host)}
                        title={`${host.name} · CPU ${host.cpu}% / 内存 ${host.memory}% / 磁盘 ${host.disk}%`}
                        className={cn(
                          'size-[18px] shrink-0 rounded-[3px] transition-transform',
                          'hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
                        )}
                        style={{ backgroundColor: hostCellColor(host) }}
                        aria-label={`${host.name} ${PERF_STATUS_META[host.status].label}`}
                      />
                    ))}
                  </span>
                  <span className="w-[2.75rem] shrink-0 text-right font-mono text-2xs text-fg-4 tabular-nums">
                    {group.avgCpu.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-subtle pt-2.5 text-2xs text-fg-4">
            <span>共 {hosts.data?.total ?? 0} 台</span>
            <span>·</span>
            <span>筛选后 {filteredHosts.length} 台</span>
            <span className="ml-auto inline-flex items-center gap-1">
              <Gauge className="size-3" />
              右侧为该角色平均 CPU
            </span>
          </div>
        </SectionCard>

        <SectionCard
          title="节点资源 TOP"
          description="按 CPU 占用排序，点击行可下钻到节点详情"
          extra={
            <Badge tone="warning" size="sm">
              {topHosts.length} 台
            </Badge>
          }
          bodyClassName="px-0 pb-0"
        >
          <DataTable
            columns={hostColumns}
            rows={topHosts}
            getRowId={(row) => row.id}
            loading={hosts.isLoading}
            density="compact"
            onRowClick={(row) => setSelectedHost(row)}
            defaultSort={{ key: 'cpu', dir: 'desc' }}
            minRows={6}
            empty={<EmptyState size="sm" title="没有匹配的节点" />}
          />
        </SectionCard>
      </div>

      {/* ---------------------- ⑤ 服务健康 ---------------------- */}
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <SectionCard
          title="服务健康"
          description="副本、吞吐、延迟与错误率同表对照；点击行查看服务详情"
          extra={
            <div className="flex items-center gap-1.5">
              <Badge tone="success" size="sm">
                健康 {summaryData?.services.healthy ?? 0}
              </Badge>
              <Badge tone="warning" size="sm">
                降级 {summaryData?.services.degraded ?? 0}
              </Badge>
              <Badge tone="danger" size="sm">
                异常 {summaryData?.services.down ?? 0}
              </Badge>
            </div>
          }
          bodyClassName="px-0 pb-0"
        >
          <DataTable
            columns={serviceColumns}
            rows={serviceRows}
            getRowId={(row) => row.id}
            loading={services.isLoading}
            density="compact"
            defaultSort={{ key: 'p95', dir: 'desc' }}
            onRowClick={(row) => setSelectedService(row)}
            minRows={8}
            empty={<EmptyState size="sm" title="暂无服务采集数据" />}
          />
        </SectionCard>

        <SectionCard
          title="服务 P95 延迟"
          description="超过 500ms 预算的服务会被标红"
          extra={
            <Badge tone="primary" size="sm">
              TOP 9
            </Badge>
          }
          bodyClassName="flex flex-col px-2 pb-2 pt-2"
        >
          {/* 与左表同高：固定高度会在卡片底部留白 */}
          <div className="min-h-[318px] flex-1">
            <EChart
              option={serviceLatencyOption}
              height="100%"
              loading={services.isLoading}
              tokens={tokens}
            />
          </div>
        </SectionCard>
      </div>

      {/* ---------------------- ⑥ 告警中心 + 实时日志 ---------------------- */}
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div id="perf-alerts" className="min-w-0">
          <SectionCard
            title="告警中心"
            description="支持按级别筛选；确认后进入「已确认」，不影响规则继续评估"
            extra={
              <div className="flex items-center gap-1.5">
                <Select
                  size="sm"
                  className="w-[6.75rem]"
                  options={ALERT_LEVEL_OPTIONS}
                  value={alertLevel}
                  onChange={(value) => setAlertLevel(value)}
                />
                <Button
                  size="xs"
                  variant="ghost"
                  leftIcon={<BellOff className="size-3" />}
                  disabled={!canOperate || silenceAlerts.isPending}
                  onClick={() => void handleSilence()}
                >
                  静默
                </Button>
              </div>
            }
            bodyClassName="px-0 pb-0"
          >
            <div className="max-h-[360px] min-h-[360px] overflow-y-auto">
              <AlertFeed
                alerts={alerts.data ?? []}
                loading={alerts.isLoading}
                canWrite={canOperate}
                onAck={(alert) => void handleAck(alert)}
                ackingId={ackingId}
              />
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="实时日志"
          description="Loki 汇聚 · 支持按级别过滤"
          extra={
            <span className="inline-flex items-center gap-1 text-2xs text-fg-4">
              <Terminal className="size-3" />
              {logs.data?.length ?? 0} 条
            </span>
          }
          bodyClassName="px-0 pb-0"
        >
          <div className="flex h-[360px] flex-col">
            <LogFeed
              logs={logs.data ?? []}
              loading={logs.isLoading}
              level={logLevel}
              onLevelChange={setLogLevel}
            />
          </div>
        </SectionCard>
      </div>

      {/* ---------------------- ⑦ 存储 / 热力图 ---------------------- */}
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <SectionCard
          title="存储卷水位"
          description="容量、inode 与 IO 延迟三线并看"
          extra={
            <Badge tone={volumeRisk > 0 ? 'warning' : 'success'} size="sm">
              {volumeRisk} 个卷需关注
            </Badge>
          }
          bodyClassName="px-0 pb-0"
        >
          <DataTable
            columns={volumeColumns}
            rows={volumeRows}
            getRowId={(row) => row.id}
            loading={volumes.isLoading}
            density="compact"
            defaultSort={{ key: 'usage', dir: 'desc' }}
            minRows={6}
            empty={<EmptyState size="sm" title="暂无存储采集数据" />}
          />
        </SectionCard>

        <SectionCard
          title="负载热力图"
          description="最近一周 × 24 小时的集群负载分布"
          extra={
            <span className="flex items-center gap-1 text-2xs text-fg-4">
              低
              {[18, 38, 58, 78, 96].map((strength) => (
                <span
                  key={strength}
                  className="size-2.5 rounded-[2px]"
                  style={{
                    backgroundColor: `color-mix(in oklab, var(--n-primary) ${strength}%, transparent)`,
                  }}
                />
              ))}
              高
            </span>
          }
          bodyClassName="flex flex-col px-3 pb-3 pt-2"
        >
          {heatmap.isLoading ? (
            <Skeleton className="h-[232px] rounded-md" />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-1 pl-[2.1rem] text-[10px] text-fg-4">
                {[0, 4, 8, 12, 16, 20].map((hour) => (
                  <span key={hour} className="flex-1 text-left">
                    {String(hour).padStart(2, '0')}
                  </span>
                ))}
                <span className="w-[1.6rem] shrink-0 text-right">24</span>
              </div>
              {/*
                行高交给 flex 而不是 aspect-square
                左栏存储表有 12 行、比这张图高，卡片会被拉到同一行高；
                格子若按宽度定高，底部就会空出一大块。让行自己长高后，
                整张热力图会把卡片填满，密度也随可用空间变化。
              */}
              <div className="mt-1 flex min-h-0 flex-1 flex-col gap-[3px]">
                {WEEK_LABELS.map((label, day) => (
                  <div key={label} className="flex min-h-[16px] flex-1 items-stretch gap-1">
                    <span className="w-7 shrink-0 self-center text-[10px] text-fg-4">{label}</span>
                    <div className="grid min-w-0 flex-1 grid-cols-24 gap-[2px]">
                      {Array.from({ length: 24 }).map((_, hour) => {
                        const value = heatIndex.get(`${day}-${hour}`) ?? 0
                        const ratio = (value - heatScale.min) / heatScale.span
                        return (
                          <span
                            key={hour}
                            title={`${label} ${String(hour).padStart(2, '0')}:00 · 负载 ${(value / 100).toFixed(2)}`}
                            className="h-full w-full rounded-[2px] transition-transform hover:scale-110"
                            style={{
                              backgroundColor: `color-mix(in oklab, var(--n-primary) ${Math.round(
                                8 + ratio * 88,
                              )}%, transparent)`,
                            }}
                          />
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="pt-2 text-right text-2xs text-fg-4">
                峰值 {(heatStats?.peak ?? heatMax).toFixed(0)}%（工作日 16:00 前后）
              </p>

              {/*
                汇总块贴底
                左边存储表比这张图高，网格把卡片拉伸后底部会留白；
                把这组「峰值 / 日均 / 工作日落差」推到卡片底部，
                空白就不再是空白，而是「什么时候该扩容」的答案。
              */}
              <div className="mt-auto pt-3">
                <div className="grid grid-cols-3 gap-2 border-t border-line-subtle pt-2.5">
                  {[
                    {
                      label: '峰值负载',
                      value: `${(heatStats?.peak ?? 0).toFixed(0)}%`,
                      tone: 'text-warning',
                    },
                    {
                      label: '日均负载',
                      value: `${(heatStats?.average ?? 0).toFixed(0)}%`,
                      tone: 'text-fg',
                    },
                    {
                      label: '工作日 / 周末',
                      value: `+${(heatStats?.gap ?? 0).toFixed(0)}%`,
                      tone: 'text-primary',
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="truncate text-2xs text-fg-4">{item.label}</p>
                      <p className={cn('mt-0.5 font-mono text-sm tabular-nums', item.tone)}>
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 flex items-start gap-1 text-2xs leading-4 text-fg-4">
                  <Activity className="mt-0.5 size-3 shrink-0" />
                  <span>
                    工作日均值 {(heatStats?.weekday ?? 0).toFixed(0)}% · 周末均值{' '}
                    {(heatStats?.weekend ?? 0).toFixed(0)}
                    %，扩容窗口建议排在 09:00 之前
                  </span>
                </p>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ---------------------- ⑧ 进程 / 采集链 ---------------------- */}
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <SectionCard
          title="进程占用 TOP"
          description="横向对比多台节点的高消耗进程，僵尸进程会被标红"
          extra={
            <Badge tone="neutral" size="sm">
              按 CPU 排序
            </Badge>
          }
          bodyClassName="px-0 pb-0"
        >
          {processes.isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-8 rounded-md" />
              ))}
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto">
              <table className="n-table w-full" data-density="compact">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="h-9 px-3 text-left font-medium">进程</th>
                    <th className="h-9 px-3 text-left font-medium">节点</th>
                    <th className="h-9 px-3 text-right font-medium">CPU</th>
                    <th className="h-9 px-3 text-right font-medium">内存</th>
                    <th className="h-9 px-3 text-right font-medium">线程</th>
                    <th className="h-9 px-3 text-right font-medium">运行时长</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {[...processRows]
                    .sort((a, b) => b.cpu - a.cpu)
                    .slice(0, 12)
                    .map((item) => (
                      <tr key={`${item.host}-${item.pid}`} className="hover:bg-surface-2">
                        <td className="px-3">
                          <div className="min-w-0">
                            <p
                              className={cn(
                                'truncate font-mono text-2xs',
                                item.state === 'zombie' ? 'text-danger' : 'text-fg-2',
                              )}
                              title={item.name}
                            >
                              {item.name}
                            </p>
                            <p className="text-[10px] text-fg-4">
                              PID {item.pid} · {item.user}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 font-mono text-2xs text-fg-3">{item.host}</td>
                        <td
                          className={cn(
                            'px-3 text-right font-mono text-2xs tabular-nums',
                            item.cpu >= 200 ? 'text-danger' : 'text-fg-2',
                          )}
                        >
                          {item.cpu.toFixed(1)}%
                        </td>
                        <td className="px-3 text-right font-mono text-2xs text-fg-3 tabular-nums">
                          {item.memory.toFixed(1)}%
                        </td>
                        <td className="px-3 text-right font-mono text-2xs text-fg-3 tabular-nums">
                          {item.threads}
                        </td>
                        <td className="px-3 text-right text-2xs text-fg-4">{item.uptime}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="采集链与值班"
          description="指标、日志与告警的落点，以及当前 on-call"
          extra={<ShieldCheck className="size-3.5 text-primary" />}
          bodyClassName="px-4 pb-3 pt-2"
        >
          <Descriptions
            size="sm"
            columns={2}
            items={[
              { label: '集群', value: summaryData?.cluster.id ?? '—' },
              { label: '区域', value: summaryData?.cluster.region ?? '—' },
              { label: '值班', value: summaryData?.cluster.onCall ?? '—' },
              { label: '备份', value: summaryData?.cluster.backup ?? '—' },
              {
                label: '指标',
                value: (
                  <span className="font-mono text-2xs">
                    {summaryData?.cluster.prometheus ?? '—'}
                  </span>
                ),
              },
              {
                label: '日志',
                value: (
                  <span className="font-mono text-2xs">{summaryData?.cluster.loki ?? '—'}</span>
                ),
              },
              {
                label: '告警',
                value: (
                  <span className="font-mono text-2xs">
                    {summaryData?.cluster.alertmanager ?? '—'}
                  </span>
                ),
              },
              { label: '保留', value: summaryData?.cluster.retention ?? '—' },
              { label: '采集间隔', value: summaryData?.cluster.collectInterval ?? '—' },
              {
                label: '通知渠道',
                value: (summaryData?.cluster.channels ?? []).join(' / ') || '—',
              },
            ]}
          />
          <CodeBlock
            className="mt-3"
            language="ts"
            filename="src/services/queries.ts"
            maxHeight={168}
            code={`// 页面只依赖 hook；实时与否由 refetchInterval 决定
export function usePerfSummary(options: { refetchInterval?: number | false } = {}) {
  return useQuery({
    queryKey: ['performance', 'summary'],
    queryFn: ({ signal }) =>
      api.get<PerfSummary>('/performance/summary', {
        signal,
        schema: devSchema((m) => m.perfSummarySchema),
      }),
    staleTime: 15_000,
    refetchInterval: options.refetchInterval ?? false,
  })
}`}
          />
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-2xs text-fg-4">
            {['Prometheus /metrics', 'Loki 日志', 'Alertmanager 路由', '15s 采集'].map((tag) => (
              <span key={tag} className="rounded-sm border border-line bg-surface-2 px-1.5 py-0.5">
                {tag}
              </span>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* ---------------------- 页脚 ---------------------- */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 pb-1 text-2xs text-fg-4">
        <span className="inline-flex items-center gap-1">
          <Server className="size-3" />
          {summaryData?.nodes.total ?? 0} 节点 / {summaryData?.services.total ?? 0} 服务
        </span>
        <span className="inline-flex items-center gap-1">
          <ArrowUpRight className="size-3" />
          点节点矩阵或表格行可下钻
        </span>
        <span className="inline-flex items-center gap-1">
          <Download className="size-3" />
          <button
            type="button"
            className="underline-offset-2 hover:text-fg-2 hover:underline"
            onClick={() => toast.success('监控报表导出任务已创建（演示）')}
          >
            导出性能周报
          </button>
        </span>
        <span className="ml-auto">{live ? '每 30 秒自动刷新' : '已暂停自动刷新'} · 演示数据</span>
      </div>

      {/* ---------------------- 下钻层 ---------------------- */}
      <HostDetailDrawer
        host={selectedHost}
        processes={processRows}
        onClose={() => setSelectedHost(null)}
      />

      <Drawer
        open={Boolean(selectedService)}
        onOpenChange={(open) => !open && setSelectedService(null)}
        width={480}
        title={
          selectedService ? (
            <span className="flex items-center gap-2">
              <Server className="size-4 text-fg-3" />
              {selectedService.name}
              <Badge tone={PERF_STATUS_META[selectedService.status].tone} size="sm" dot>
                {PERF_STATUS_META[selectedService.status].label}
              </Badge>
            </span>
          ) : (
            '服务详情'
          )
        }
        description={
          selectedService ? `${selectedService.owner} · ${selectedService.version}` : undefined
        }
      >
        {selectedService && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'QPS', value: selectedService.qps.toLocaleString(), unit: '' },
                { label: 'P95', value: `${selectedService.p95}`, unit: 'ms' },
                { label: '错误率', value: selectedService.errorRate.toFixed(2), unit: '%' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-md border border-line bg-surface-2/50 p-2.5"
                >
                  <p className="text-2xs text-fg-3">{item.label}</p>
                  <p className="mt-1 text-lg leading-6 font-semibold text-fg tabular-nums">
                    {item.value}
                    <span className="ml-0.5 text-2xs font-normal text-fg-4">{item.unit}</span>
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-md border border-line p-2">
              <div className="mb-1 flex items-center justify-between px-1">
                <span className="text-2xs text-fg-3">延迟趋势（近 12 个采样点）</span>
                <span className="font-mono text-2xs text-fg-4">SLO {selectedService.slo}%</span>
              </div>
              <Sparkline
                data={selectedService.latencyTrend}
                width={420}
                height={56}
                tone={
                  selectedService.status === 'critical'
                    ? 'danger'
                    : selectedService.status === 'warning'
                      ? 'warning'
                      : 'primary'
                }
                className="w-full"
              />
            </div>

            <Descriptions
              size="sm"
              columns={2}
              items={[
                {
                  label: '层级',
                  value:
                    selectedService.tier === 'edge'
                      ? '接入层'
                      : selectedService.tier === 'core'
                        ? '核心层'
                        : '支撑层',
                },
                {
                  label: '副本',
                  value: `${selectedService.ready} / ${selectedService.replicas} 就绪`,
                },
                { label: 'CPU', value: `${selectedService.cpu.toFixed(1)}%` },
                { label: '内存', value: `${selectedService.memory.toFixed(1)}%` },
                { label: '最近发布', value: formatRelativeTime(selectedService.lastDeploy) },
                { label: '负责人', value: selectedService.owner },
              ]}
            />

            <div className="space-y-2">
              <p className="text-2xs text-fg-3">资源占用</p>
              <UsageBar value={selectedService.cpu} hint="CPU" />
              <UsageBar value={selectedService.memory} hint="内存" />
            </div>

            <div className="flex items-center gap-2 rounded-md border border-dashed border-line px-2.5 py-2 text-2xs text-fg-3">
              <TriangleAlert className="size-3.5 shrink-0 text-warning" />
              诊断建议：先看该服务所在节点的 CPU 与 GC 指标，再确认依赖（数据库 / 缓存）的 P95。
            </div>
          </div>
        )}
      </Drawer>
    </PageContainer>
  )
}

/* ------------------------------------------------------------------ *
 * 表格内的小指标文字
 *
 * 只做「阈值着色 + 等宽数字」，比进度条更省横向空间，
 * 让节点表能在一屏里同时放下 CPU / 内存 / 磁盘三列。
 * ------------------------------------------------------------------ */
function MetricText({ value, unit }: { value: number; unit?: string }) {
  return (
    <span
      className={cn(
        'font-mono text-xs tabular-nums',
        value >= 90 ? 'text-danger' : value >= 78 ? 'text-warning' : 'text-fg-2',
      )}
    >
      {value.toFixed(1)}
      {unit}
    </span>
  )
}
