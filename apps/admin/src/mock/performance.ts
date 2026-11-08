import type {
  PerfAlert,
  PerfClusterInfo,
  PerfHeatCell,
  PerfHost,
  PerfKpi,
  PerfLog,
  PerfProcess,
  PerfRange,
  PerfSeries,
  PerfService,
  PerfSloItem,
  PerfStatus,
  PerfSummary,
  PerfVolume,
} from '@/types/domain'

/* ------------------------------------------------------------------ *
 * 性能监控演示数据
 *
 * 三条约定：
 * 1. 使用独立的确定性随机源，不复用 `seed.ts` 的全局 `rand`。
 *    否则「新增一个数据文件」会悄悄改变已有页面（用户/订单/趋势）的演示数值。
 * 2. 数值之间保持自洽：KPI 的均值由主机数据算出来，告警条数与 summary 对得上，
 *    避免出现「上面写 6 台异常、下面矩阵只有 2 个红格」这种一眼假的演示。
 * 3. 粒度按「运维真正会看的口径」给：
 *    CPU / 内存 / 磁盘 / IOPS / 网络 / 负载 / P95 / 容器数 / 心跳。
 * ------------------------------------------------------------------ */

/** Mulberry32：与 seed.ts 同算法，但独立种子 */
function mulberry32(seed: number) {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const perfRand = mulberry32(20261105)

const between = (min: number, max: number) => min + perfRand() * (max - min)
const intBetween = (min: number, max: number) => Math.floor(between(min, max + 1))
const round1 = (value: number) => Math.round(value * 10) / 10
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const PAD = (value: number) => String(value).padStart(2, '0')

function clockOf(date: Date): string {
  return `${PAD(date.getHours())}:${PAD(date.getMinutes())}`
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

function stampOf(minutes: number): string {
  return `${clockOf(new Date(Date.now() - minutes * 60_000))}:${PAD(Math.floor(between(0, 59)))}`
}

/* ------------------------------ 集群 ------------------------------ */

export const PERF_CLUSTER: PerfClusterInfo = {
  id: 'na-prod-01',
  region: '华东 · 杭州可用区',
  onCall: '陈彦之',
  backup: '林知夏',
  channels: ['电话', '企业微信', 'PagerDuty'],
  collectInterval: '15s',
  retention: '指标 30 天 / 日志 14 天',
  prometheus: 'prom-na-prod (v2.53)',
  loki: 'loki-shared (v3.1)',
  alertmanager: 'am-prod-01',
  updatedAt: new Date().toISOString(),
  silenceUntil: null,
}

/* ------------------------------ 主机 ------------------------------ */

interface HostGroup {
  prefix: string
  role: PerfHost['role']
  count: number
  cores: number
  memory: number
  disk: number
  cpu: [number, number]
  memoryUsed: [number, number]
  diskUsed: [number, number]
  os: string
  kernel: string
}

const HOST_GROUPS: HostGroup[] = [
  {
    prefix: 'na-edge',
    role: 'gateway',
    count: 4,
    cores: 8,
    memory: 16,
    disk: 200,
    cpu: [26, 52],
    memoryUsed: [38, 58],
    diskUsed: [32, 46],
    os: 'Ubuntu 22.04 LTS',
    kernel: '5.15.0-91',
  },
  {
    prefix: 'na-app',
    role: 'app',
    count: 14,
    cores: 16,
    memory: 32,
    disk: 400,
    cpu: [38, 74],
    memoryUsed: [52, 78],
    diskUsed: [44, 68],
    os: 'Ubuntu 22.04 LTS',
    kernel: '5.15.0-91',
  },
  {
    prefix: 'na-api',
    role: 'api',
    count: 10,
    cores: 16,
    memory: 32,
    disk: 400,
    cpu: [34, 70],
    memoryUsed: [48, 74],
    diskUsed: [40, 62],
    os: 'Rocky Linux 9.3',
    kernel: '5.14.0-362',
  },
  {
    prefix: 'na-db',
    role: 'database',
    count: 5,
    cores: 32,
    memory: 128,
    disk: 2000,
    cpu: [42, 78],
    memoryUsed: [58, 84],
    diskUsed: [62, 88],
    os: 'Rocky Linux 9.3',
    kernel: '5.14.0-362',
  },
  {
    prefix: 'na-cache',
    role: 'cache',
    count: 6,
    cores: 16,
    memory: 64,
    disk: 500,
    cpu: [18, 46],
    memoryUsed: [62, 86],
    diskUsed: [22, 40],
    os: 'Debian 12',
    kernel: '6.1.0-18',
  },
  {
    prefix: 'na-mq',
    role: 'mq',
    count: 3,
    cores: 8,
    memory: 32,
    disk: 1000,
    cpu: [30, 58],
    memoryUsed: [46, 70],
    diskUsed: [58, 80],
    os: 'Rocky Linux 9.3',
    kernel: '5.14.0-362',
  },
  {
    prefix: 'na-job',
    role: 'worker',
    count: 8,
    cores: 8,
    memory: 16,
    disk: 200,
    cpu: [22, 64],
    memoryUsed: [34, 66],
    diskUsed: [28, 52],
    os: 'Debian 12',
    kernel: '6.1.0-18',
  },
  {
    prefix: 'na-oss',
    role: 'storage',
    count: 4,
    cores: 8,
    memory: 32,
    disk: 8000,
    cpu: [20, 44],
    memoryUsed: [40, 62],
    diskUsed: [70, 86],
    os: 'Rocky Linux 9.3',
    kernel: '5.14.0-362',
  },
]

const ZONES = ['az-a', 'az-b', 'az-c'] as const

function trendAround(value: number, spread: number, length = 12): number[] {
  return Array.from({ length }, (_, index) => {
    const wave = Math.sin(index / 2.1) * spread * 0.45
    return Number(clamp(value + wave + between(-spread, spread) * 0.4, 1, 99).toFixed(1))
  })
}

function statusOf(cpu: number, memory: number, disk: number): PerfStatus {
  if (cpu >= 90 || memory >= 93 || disk >= 93) return 'critical'
  if (cpu >= 78 || memory >= 84 || disk >= 85) return 'warning'
  return 'healthy'
}

export const PERF_HOSTS: PerfHost[] = HOST_GROUPS.flatMap((group, groupIndex) =>
  Array.from({ length: group.count }, (_, index) => {
    const seq = index + 1
    const id = `${group.prefix}-${PAD(seq)}`
    const cpu = round1(between(group.cpu[0], group.cpu[1]))
    const memory = round1(between(group.memoryUsed[0], group.memoryUsed[1]))
    const disk = round1(between(group.diskUsed[0], group.diskUsed[1]))
    const zone = ZONES[(groupIndex + index) % ZONES.length] ?? 'az-a'
    const load1 = round1((cpu / 100) * group.cores * between(0.72, 1.18))
    const status = statusOf(cpu, memory, disk)
    return {
      id,
      name: id,
      role: group.role,
      zone,
      ip: `10.${20 + groupIndex}.${8 + index}.${11 + ((groupIndex * 7 + index * 3) % 180)}`,
      status,
      cpu,
      memory,
      disk,
      networkIn: round1(between(18, 420)),
      networkOut: round1(between(12, 380)),
      load1,
      load5: round1(load1 * between(0.82, 1.08)),
      uptimeDays: intBetween(6, 380),
      kernel: group.kernel,
      os: group.os,
      cores: group.cores,
      memoryTotal: group.memory,
      diskTotal: group.disk,
      temperature: Math.round(between(38, 68)),
      iops: intBetween(120, 8400),
      latencyP95: Math.round(between(18, 190)),
      containers: group.role === 'database' || group.role === 'storage' ? 0 : intBetween(6, 42),
      lastHeartbeat: minutesAgo(between(0, 3)),
      cpuTrend: trendAround(cpu, 9),
      memoryTrend: trendAround(memory, 5),
    } satisfies PerfHost
  }),
)

/**
 * 刻意制造几个「真实会发生的事故现场」
 *
 * 全绿的管理后台是最没有说服力的：值班时要能一眼看到红点、点进去有内容。
 * 这里不改生成逻辑（避免污染所有主机的分布），只在生成后定点覆盖。
 */
const HOST_OVERRIDES: Record<string, Partial<PerfHost>> = {
  'na-app-07': { cpu: 96.4, memory: 88.2, status: 'critical', latencyP95: 468, iops: 9120 },
  'na-db-02': { disk: 94.6, cpu: 81.2, status: 'critical', iops: 8640, latencyP95: 312 },
  'na-cache-03': { memory: 92.8, status: 'critical', cpu: 44.6 },
  'na-api-04': { cpu: 84.1, status: 'warning', latencyP95: 246 },
  'na-db-05': { disk: 88.4, status: 'warning', cpu: 74.8 },
  'na-edge-03': {
    status: 'offline',
    cpu: 0,
    memory: 0,
    disk: 41.2,
    networkIn: 0,
    networkOut: 0,
    load1: 0,
    load5: 0,
    containers: 0,
    lastHeartbeat: minutesAgo(26),
  },
  'na-oss-02': { disk: 89.1, status: 'warning', iops: 7240 },
}

for (const host of PERF_HOSTS) {
  const patch = HOST_OVERRIDES[host.id]
  if (!patch) continue
  Object.assign(host, patch)
  if (patch.cpu !== undefined) host.cpuTrend = trendAround(patch.cpu, 6)
  if (patch.memory !== undefined) host.memoryTrend = trendAround(patch.memory, 4)
}

/* ------------------------------ 指标卡 ------------------------------ */

const HOST_TOTAL = PERF_HOSTS.length
const HOST_ONLINE = PERF_HOSTS.filter((host) => host.status !== 'offline').length
const HOST_CRIT = PERF_HOSTS.filter((host) => host.status === 'critical').length
const HOST_WARN = PERF_HOSTS.filter((host) => host.status === 'warning').length
const AVG_CPU = round1(
  PERF_HOSTS.filter((host) => host.status !== 'offline').reduce((sum, host) => sum + host.cpu, 0) /
    Math.max(1, HOST_ONLINE),
)
const AVG_MEMORY = round1(
  PERF_HOSTS.filter((host) => host.status !== 'offline').reduce(
    (sum, host) => sum + host.memory,
    0,
  ) / Math.max(1, HOST_ONLINE),
)
const MAX_DISK = round1(Math.max(...PERF_HOSTS.map((host) => host.disk)))
const CLUSTER_QPS = 18_642
const CLUSTER_P95 = 236
const CLUSTER_ERROR_RATE = 0.74

/* ------------------------------ 服务 ------------------------------ */

export const PERF_SERVICES: PerfService[] = [
  {
    id: 'svc-edge',
    name: 'edge-gateway',
    tier: 'edge',
    replicas: 8,
    ready: 8,
    qps: 6420,
    p95: 78,
    errorRate: 0.02,
    cpu: 46.2,
    memory: 52.4,
    status: 'healthy',
    version: 'v3.14.2',
    lastDeploy: minutesAgo(1560),
    owner: '平台网关组',
    slo: 99.98,
    latencyTrend: [62, 68, 71, 74, 69, 73, 78, 76, 72, 70, 74, 78],
  },
  {
    id: 'svc-auth',
    name: 'auth-svc',
    tier: 'core',
    replicas: 6,
    ready: 6,
    qps: 2860,
    p95: 64,
    errorRate: 0.03,
    cpu: 38.4,
    memory: 44.8,
    status: 'healthy',
    version: 'v2.8.0',
    lastDeploy: minutesAgo(4300),
    owner: '账号平台组',
    slo: 99.95,
    latencyTrend: [58, 60, 62, 59, 61, 64, 63, 62, 60, 61, 63, 64],
  },
  {
    id: 'svc-user',
    name: 'user-svc',
    tier: 'core',
    replicas: 8,
    ready: 8,
    qps: 3260,
    p95: 88,
    errorRate: 0.05,
    cpu: 52.6,
    memory: 61.2,
    status: 'healthy',
    version: 'v2.11.3',
    lastDeploy: minutesAgo(2100),
    owner: '用户中台组',
    slo: 99.95,
    latencyTrend: [82, 84, 86, 85, 88, 87, 86, 88, 85, 84, 86, 88],
  },
  {
    id: 'svc-order',
    name: 'order-svc',
    tier: 'core',
    replicas: 10,
    ready: 10,
    qps: 2140,
    p95: 132,
    errorRate: 0.11,
    cpu: 64.8,
    memory: 71.6,
    status: 'healthy',
    version: 'v4.2.1',
    lastDeploy: minutesAgo(920),
    owner: '交易中台组',
    slo: 99.9,
    latencyTrend: [124, 128, 131, 126, 130, 134, 132, 129, 133, 131, 130, 132],
  },
  {
    id: 'svc-pay',
    name: 'pay-svc',
    tier: 'core',
    replicas: 6,
    ready: 5,
    qps: 860,
    p95: 648,
    errorRate: 1.24,
    cpu: 76.4,
    memory: 82.8,
    status: 'warning',
    version: 'v4.2.1',
    lastDeploy: minutesAgo(640),
    owner: '支付清结算组',
    slo: 99.9,
    latencyTrend: [402, 438, 486, 512, 548, 586, 604, 622, 638, 641, 645, 648],
  },
  {
    id: 'svc-inv',
    name: 'inventory-svc',
    tier: 'core',
    replicas: 6,
    ready: 6,
    qps: 1480,
    p95: 118,
    errorRate: 0.08,
    cpu: 58.2,
    memory: 66.4,
    status: 'healthy',
    version: 'v3.6.0',
    lastDeploy: minutesAgo(3200),
    owner: '供应链组',
    slo: 99.9,
    latencyTrend: [108, 112, 114, 111, 116, 118, 115, 113, 117, 116, 114, 118],
  },
  {
    id: 'svc-search',
    name: 'search-svc',
    tier: 'core',
    replicas: 8,
    ready: 3,
    qps: 1180,
    p95: 982,
    errorRate: 4.62,
    cpu: 91.6,
    memory: 88.4,
    status: 'critical',
    version: 'v2.4.7',
    lastDeploy: minutesAgo(58),
    owner: '搜索推荐组',
    slo: 99.5,
    latencyTrend: [604, 682, 741, 806, 848, 892, 921, 948, 962, 974, 978, 982],
  },
  {
    id: 'svc-risk',
    name: 'risk-engine',
    tier: 'support',
    replicas: 4,
    ready: 4,
    qps: 640,
    p95: 96,
    errorRate: 0.04,
    cpu: 48.6,
    memory: 58.2,
    status: 'healthy',
    version: 'v1.18.4',
    lastDeploy: minutesAgo(5400),
    owner: '风控组',
    slo: 99.9,
    latencyTrend: [88, 90, 92, 94, 91, 93, 95, 96, 94, 92, 95, 96],
  },
  {
    id: 'svc-notify',
    name: 'notify-svc',
    tier: 'support',
    replicas: 4,
    ready: 4,
    qps: 420,
    p95: 142,
    errorRate: 0.36,
    cpu: 32.4,
    memory: 48.6,
    status: 'healthy',
    version: 'v2.2.9',
    lastDeploy: minutesAgo(7800),
    owner: '消息平台组',
    slo: 99.5,
    latencyTrend: [132, 136, 138, 141, 139, 142, 140, 143, 141, 139, 142, 142],
  },
  {
    id: 'svc-scheduler',
    name: 'scheduler',
    tier: 'support',
    replicas: 3,
    ready: 3,
    qps: 42,
    p95: 214,
    errorRate: 0.42,
    cpu: 26.8,
    memory: 38.4,
    status: 'healthy',
    version: 'v1.9.2',
    lastDeploy: minutesAgo(12000),
    owner: '基础平台组',
    slo: 99.0,
    latencyTrend: [198, 204, 208, 210, 206, 212, 214, 211, 209, 213, 212, 214],
  },
  {
    id: 'svc-report',
    name: 'report-svc',
    tier: 'support',
    replicas: 4,
    ready: 4,
    qps: 186,
    p95: 386,
    errorRate: 0.18,
    cpu: 44.2,
    memory: 54.8,
    status: 'healthy',
    version: 'v3.1.5',
    lastDeploy: minutesAgo(2600),
    owner: '数据产品组',
    slo: 99.0,
    latencyTrend: [362, 370, 374, 378, 381, 384, 379, 382, 386, 383, 384, 386],
  },
  {
    id: 'svc-audit',
    name: 'audit-writer',
    tier: 'support',
    replicas: 2,
    ready: 2,
    qps: 318,
    p95: 72,
    errorRate: 0.01,
    cpu: 22.6,
    memory: 34.2,
    status: 'healthy',
    version: 'v1.4.0',
    lastDeploy: minutesAgo(9400),
    owner: '安全合规部',
    slo: 99.9,
    latencyTrend: [66, 68, 70, 69, 71, 72, 70, 71, 72, 71, 70, 72],
  },
]

/* ------------------------------ 告警 ------------------------------ */

export const PERF_ALERTS: PerfAlert[] = [
  {
    id: 'al-1042',
    level: 'critical',
    title: 'search-svc 熔断触发',
    target: 'search-svc',
    rule: 'circuit_breaker_open > 0',
    value: '连续 5 分钟打开',
    startedAt: minutesAgo(18),
    duration: '18 分钟',
    state: 'firing',
    source: 'Prometheus · svc.rules',
    channels: ['电话', '企业微信'],
    runbook: 'RB-SEARCH-01 · ES 连接池耗尽处置',
  },
  {
    id: 'al-1041',
    level: 'critical',
    title: 'node-12 CPU 持续 96%',
    target: 'na-app-07',
    rule: 'node_cpu_utilization > 90 for 5m',
    value: '96.4%',
    startedAt: minutesAgo(32),
    duration: '32 分钟',
    state: 'firing',
    source: 'Prometheus · node.rules',
    channels: ['企业微信', 'PagerDuty'],
    runbook: 'RB-NODE-03 · 单机 CPU 打满排查',
  },
  {
    id: 'al-1040',
    level: 'critical',
    title: '数据库磁盘使用率越线',
    target: 'na-db-02:/data',
    rule: 'disk_used_percent > 92',
    value: '94.6%',
    startedAt: minutesAgo(46),
    duration: '46 分钟',
    state: 'acknowledged',
    ackBy: '陈彦之',
    source: 'Prometheus · node.rules',
    channels: ['企业微信'],
    runbook: 'RB-DB-07 · 磁盘扩容与 WAL 清理',
  },
  {
    id: 'al-1039',
    level: 'critical',
    title: '节点心跳丢失',
    target: 'na-edge-03',
    rule: 'up == 0 for 2m',
    value: '已离线 26 分钟',
    startedAt: minutesAgo(26),
    duration: '26 分钟',
    state: 'firing',
    source: 'Prometheus · blackbox',
    channels: ['电话', '企业微信'],
    runbook: 'RB-NODE-01 · 节点失联与摘除',
  },
  {
    id: 'al-1038',
    level: 'warning',
    title: 'pay-svc P95 超过阈值',
    target: 'pay-svc',
    rule: 'http_p95_latency > 500ms for 10m',
    value: '648ms > 500ms',
    startedAt: minutesAgo(64),
    duration: '64 分钟',
    state: 'firing',
    source: 'Prometheus · svc.rules',
    channels: ['企业微信'],
    runbook: 'RB-PAY-02 · 支付链路延迟排查',
  },
  {
    id: 'al-1037',
    level: 'warning',
    title: 'Redis 内存使用率偏高',
    target: 'na-cache-03',
    rule: 'redis_memory_used_ratio > 0.9',
    value: '92.8%',
    startedAt: minutesAgo(88),
    duration: '88 分钟',
    state: 'acknowledged',
    ackBy: '林知夏',
    source: 'Prometheus · mid.rules',
    channels: ['企业微信'],
    runbook: 'RB-CACHE-01 · 缓存内存与淘汰策略',
  },
  {
    id: 'al-1036',
    level: 'warning',
    title: '消息队列积压 order.queue',
    target: 'na-mq-02',
    rule: 'mq_consumer_lag > 3000',
    value: '当前 4218 条',
    startedAt: minutesAgo(112),
    duration: '1 小时 52 分',
    state: 'firing',
    source: 'Prometheus · mq.rules',
    channels: ['企业微信'],
    runbook: 'RB-MQ-04 · 消费积压扩容',
  },
  {
    id: 'al-1035',
    level: 'warning',
    title: 'API 网关 5xx 比例上升',
    target: 'edge-gateway',
    rule: 'http_5xx_ratio > 0.5% for 5m',
    value: '0.82%',
    startedAt: minutesAgo(140),
    duration: '2 小时 20 分',
    state: 'resolved',
    source: 'Prometheus · svc.rules',
    channels: ['企业微信'],
    runbook: 'RB-EDGE-02 · 网关错误码归因',
  },
  {
    id: 'al-1034',
    level: 'info',
    title: 'TLS 证书将在 21 天后到期',
    target: 'api.nexus.dev',
    rule: 'cert_expire_days < 30',
    value: '剩余 21 天',
    startedAt: minutesAgo(420),
    duration: '7 小时',
    state: 'acknowledged',
    ackBy: '运维值班',
    source: 'Blackbox Exporter',
    channels: ['邮件'],
    runbook: 'RB-SEC-03 · 证书自动续期核验',
  },
  {
    id: 'al-1033',
    level: 'info',
    title: 'Kubernetes 节点镜像磁盘回收',
    target: 'na-app-12',
    rule: 'kubelet_image_gc_triggered > 0',
    value: '已回收 8.2 GB',
    startedAt: minutesAgo(560),
    duration: '9 小时',
    state: 'resolved',
    source: 'Kubelet',
    channels: ['邮件'],
    runbook: 'RB-K8S-05 · 镜像回收策略',
  },
]

/* ------------------------------ 时序 ------------------------------ */

export interface PerfSeriesMeta {
  range: PerfRange
  label: string
  step: string
}

const RANGE_SPEC: Record<
  PerfRange,
  { count: number; stepMinutes: number; label: string; step: string }
> = {
  '1h': { count: 60, stepMinutes: 1, label: '近 1 小时', step: '1 分钟' },
  '6h': { count: 72, stepMinutes: 5, label: '近 6 小时', step: '5 分钟' },
  '24h': { count: 96, stepMinutes: 15, label: '近 24 小时', step: '15 分钟' },
  '7d': { count: 84, stepMinutes: 120, label: '近 7 天', step: '2 小时' },
}

function labelFor(date: Date, range: PerfRange): string {
  if (range === '7d') return `${PAD(date.getMonth() + 1)}-${PAD(date.getDate())} ${clockOf(date)}`
  return clockOf(date)
}

/** 单条时序：日周期 + 业务峰值 + 抖动，避免「纯随机噪声」那种看不出规律的假数据 */
function buildSeries(range: PerfRange): PerfSeries {
  const spec = RANGE_SPEC[range]
  const rng = mulberry32(0x51ab + spec.count * 97)
  const now = Date.now()
  const base = {
    cpu: 46,
    memory: 58,
    disk: 63,
    load: 6.4,
    networkIn: 180,
    networkOut: 140,
    latency: 148,
    qps: 14_800,
    errorRate: 0.52,
  }
  const points = Array.from({ length: spec.count }, (_, index) => {
    const time = new Date(now - (spec.count - 1 - index) * spec.stepMinutes * 60_000)
    const hour = time.getHours() + time.getMinutes() / 60
    // 业务日曲线：9-11、14-18、20-22 三个峰
    const business =
      1 +
      0.34 * Math.exp(-((hour - 10) ** 2) / 6) +
      0.42 * Math.exp(-((hour - 16) ** 2) / 8) +
      0.22 * Math.exp(-((hour - 21) ** 2) / 5)
    const night = hour < 7 ? 0.62 : 1
    const wave = business * night
    const noise = 0.94 + rng() * 0.12
    const cpu = clamp((base.cpu + (wave - 1) * 22) * noise, 18, 97)
    const memory = clamp(base.memory + (wave - 1) * 9 + rng() * 4, 32, 96)
    const disk = clamp(base.disk + index * 0.012 + (wave - 1) * 1.4, 40, 95)
    const qps = Math.round((base.qps + (wave - 1) * 6200) * (0.95 + rng() * 0.1))
    const latency = Math.round((base.latency + (wave - 1) * 86) * (0.92 + rng() * 0.18))
    return {
      time: labelFor(time, range),
      cpu: round1(cpu),
      memory: round1(memory),
      disk: round1(disk),
      load: round1((cpu / 100) * 64 * 0.42),
      networkIn: round1((base.networkIn + (wave - 1) * 90) * (0.9 + rng() * 0.2)),
      networkOut: round1((base.networkOut + (wave - 1) * 74) * (0.9 + rng() * 0.2)),
      latency,
      qps,
      errorRate: round1(clamp(base.errorRate * wave * (0.8 + rng() * 0.7), 0.08, 3.4)),
    }
  })
  return { range, points }
}

export const PERF_SERIES: Record<PerfRange, PerfSeries> = {
  '1h': buildSeries('1h'),
  '6h': buildSeries('6h'),
  '24h': buildSeries('24h'),
  '7d': buildSeries('7d'),
}

export const PERF_RANGE_META: Record<PerfRange, PerfSeriesMeta> = {
  '1h': { range: '1h', label: RANGE_SPEC['1h'].label, step: RANGE_SPEC['1h'].step },
  '6h': { range: '6h', label: RANGE_SPEC['6h'].label, step: RANGE_SPEC['6h'].step },
  '24h': { range: '24h', label: RANGE_SPEC['24h'].label, step: RANGE_SPEC['24h'].step },
  '7d': { range: '7d', label: RANGE_SPEC['7d'].label, step: RANGE_SPEC['7d'].step },
}

/* ------------------------------ 负载热力图 ------------------------------ */

export const PERF_HEATMAP: PerfHeatCell[] = Array.from({ length: 7 * 24 }, (_, index) => {
  const day = Math.floor(index / 24)
  const hour = index % 24
  const peak =
    1 +
    0.38 * Math.exp(-((hour - 10) ** 2) / 5) +
    0.46 * Math.exp(-((hour - 16) ** 2) / 7) +
    0.24 * Math.exp(-((hour - 21) ** 2) / 4)
  const weekend = day >= 5 ? 0.66 : 1
  const night = hour < 7 ? 0.55 : 1
  const value = clamp((26 + (peak - 1) * 96) * weekend * night + between(-3.2, 3.2), 8, 99)
  return { day, hour, value: round1(value) }
})

/* ------------------------------ 存储卷 ------------------------------ */

export const PERF_VOLUMES: PerfVolume[] = [
  {
    id: 'vol-01',
    host: 'na-db-01',
    mount: '/data',
    fs: 'xfs',
    total: 2000,
    used: 1436,
    inode: 42,
    readIops: 4820,
    writeIops: 6240,
    latency: 3.2,
    status: 'warning',
  },
  {
    id: 'vol-02',
    host: 'na-db-02',
    mount: '/data',
    fs: 'xfs',
    total: 2000,
    used: 1892,
    inode: 58,
    readIops: 5120,
    writeIops: 8640,
    latency: 6.8,
    status: 'critical',
  },
  {
    id: 'vol-03',
    host: 'na-db-03',
    mount: '/data',
    fs: 'xfs',
    total: 2000,
    used: 1524,
    inode: 46,
    readIops: 3980,
    writeIops: 5420,
    latency: 2.8,
    status: 'warning',
  },
  {
    id: 'vol-04',
    host: 'na-db-04',
    mount: '/wal',
    fs: 'xfs',
    total: 500,
    used: 268,
    inode: 12,
    readIops: 1240,
    writeIops: 9860,
    latency: 1.4,
    status: 'healthy',
  },
  {
    id: 'vol-05',
    host: 'na-oss-01',
    mount: '/ossdata',
    fs: 'ext4',
    total: 8000,
    used: 5640,
    inode: 8,
    readIops: 846,
    writeIops: 1240,
    latency: 4.6,
    status: 'healthy',
  },
  {
    id: 'vol-06',
    host: 'na-oss-02',
    mount: '/ossdata',
    fs: 'ext4',
    total: 8000,
    used: 7128,
    inode: 9,
    readIops: 962,
    writeIops: 1480,
    latency: 5.2,
    status: 'warning',
  },
  {
    id: 'vol-07',
    host: 'na-oss-03',
    mount: '/ossdata',
    fs: 'ext4',
    total: 8000,
    used: 4180,
    inode: 7,
    readIops: 724,
    writeIops: 986,
    latency: 3.8,
    status: 'healthy',
  },
  {
    id: 'vol-08',
    host: 'na-mq-01',
    mount: '/kafka',
    fs: 'xfs',
    total: 1000,
    used: 786,
    inode: 34,
    readIops: 3240,
    writeIops: 6820,
    latency: 2.4,
    status: 'warning',
  },
  {
    id: 'vol-09',
    host: 'na-mq-02',
    mount: '/kafka',
    fs: 'xfs',
    total: 1000,
    used: 842,
    inode: 36,
    readIops: 2860,
    writeIops: 7240,
    latency: 2.6,
    status: 'warning',
  },
  {
    id: 'vol-10',
    host: 'na-app-01',
    mount: '/var/log',
    fs: 'xfs',
    total: 200,
    used: 84,
    inode: 22,
    readIops: 142,
    writeIops: 486,
    latency: 0.8,
    status: 'healthy',
  },
  {
    id: 'vol-11',
    host: 'na-app-07',
    mount: '/',
    fs: 'xfs',
    total: 400,
    used: 268,
    inode: 28,
    readIops: 624,
    writeIops: 1840,
    latency: 4.2,
    status: 'healthy',
  },
  {
    id: 'vol-12',
    host: 'na-api-02',
    mount: '/var/log',
    fs: 'xfs',
    total: 200,
    used: 118,
    inode: 18,
    readIops: 186,
    writeIops: 642,
    latency: 1.2,
    status: 'healthy',
  },
]

/* ------------------------------ 进程 ------------------------------ */

export const PERF_PROCESSES: PerfProcess[] = [
  {
    pid: 18422,
    name: 'java -jar search-svc.jar',
    host: 'na-app-07',
    user: 'app',
    cpu: 312.4,
    memory: 18.6,
    threads: 486,
    state: 'running',
    uptime: '3 天 4 小时',
  },
  {
    pid: 22104,
    name: 'postgres: writer process',
    host: 'na-db-02',
    user: 'postgres',
    cpu: 186.2,
    memory: 42.4,
    threads: 128,
    state: 'running',
    uptime: '26 天 11 小时',
  },
  {
    pid: 9821,
    name: 'nginx: worker process',
    host: 'na-edge-01',
    user: 'nginx',
    cpu: 142.8,
    memory: 3.2,
    threads: 64,
    state: 'running',
    uptime: '41 天 2 小时',
  },
  {
    pid: 15680,
    name: 'java -jar pay-svc.jar',
    host: 'na-app-04',
    user: 'app',
    cpu: 128.6,
    memory: 22.8,
    threads: 352,
    state: 'running',
    uptime: '6 天 18 小时',
  },
  {
    pid: 24012,
    name: 'redis-server *:6379',
    host: 'na-cache-03',
    user: 'redis',
    cpu: 96.4,
    memory: 54.2,
    threads: 8,
    state: 'running',
    uptime: '58 天 6 小时',
  },
  {
    pid: 3306,
    name: 'kafka-server-start order-topic',
    host: 'na-mq-02',
    user: 'kafka',
    cpu: 88.2,
    memory: 26.4,
    threads: 216,
    state: 'running',
    uptime: '19 天 9 小时',
  },
  {
    pid: 5120,
    name: 'node /opt/report/server.js',
    host: 'na-job-03',
    user: 'node',
    cpu: 74.6,
    memory: 12.8,
    threads: 32,
    state: 'running',
    uptime: '2 天 2 小时',
  },
  {
    pid: 7788,
    name: 'python worker.py --queue=order',
    host: 'na-job-05',
    user: 'worker',
    cpu: 62.4,
    memory: 8.6,
    threads: 16,
    state: 'running',
    uptime: '9 天 4 小时',
  },
  {
    pid: 14208,
    name: 'envoy --config-path /etc/envoy',
    host: 'na-edge-02',
    user: 'envoy',
    cpu: 48.2,
    memory: 2.4,
    threads: 24,
    state: 'sleeping',
    uptime: '31 天 12 小时',
  },
  {
    pid: 9006,
    name: 'java -jar inventory-svc.jar',
    host: 'na-app-09',
    user: 'app',
    cpu: 42.8,
    memory: 16.2,
    threads: 248,
    state: 'sleeping',
    uptime: '14 天 8 小时',
  },
  {
    pid: 26310,
    name: 'promtail --config.file',
    host: 'na-db-05',
    user: 'root',
    cpu: 12.4,
    memory: 1.8,
    threads: 6,
    state: 'sleeping',
    uptime: '22 天 3 小时',
  },
  {
    pid: 31888,
    name: 'defunct core.dump',
    host: 'na-app-07',
    user: 'app',
    cpu: 0,
    memory: 0,
    threads: 0,
    state: 'zombie',
    uptime: '4 小时 12 分',
  },
]

/* ------------------------------ 日志 ------------------------------ */

export const PERF_LOGS: PerfLog[] = [
  {
    id: 'log-01',
    level: 'error',
    service: 'search-svc',
    message: 'ES 连接池耗尽，熔断器已打开（pool_size=64, waiting=214）',
    time: stampOf(1),
  },
  {
    id: 'log-02',
    level: 'warn',
    service: 'pay-svc',
    message: '支付回调处理 648ms，超过 P95 阈值 500ms',
    time: stampOf(3),
  },
  {
    id: 'log-03',
    level: 'error',
    service: 'na-app-07',
    message: 'GC pause 1.82s（G1 Young Generation），堆使用率 88%',
    time: stampOf(5),
  },
  {
    id: 'log-04',
    level: 'info',
    service: 'gateway',
    message: '路由规则热更新完成，共 128 条路由，耗时 214ms',
    time: stampOf(7),
  },
  {
    id: 'log-05',
    level: 'warn',
    service: 'scheduler',
    message: '任务 backlog 达到 42，开始扩容 worker 副本 2 → 4',
    time: stampOf(9),
  },
  {
    id: 'log-06',
    level: 'error',
    service: 'na-db-02',
    message: 'disk io wait 68%，WAL 写入排队，建议检查 /data 剩余空间',
    time: stampOf(11),
  },
  {
    id: 'log-07',
    level: 'info',
    service: 'user-svc',
    message: '缓存命中率 96.4%，L1 命中 92.1%，L2 命中 4.3%',
    time: stampOf(13),
  },
  {
    id: 'log-08',
    level: 'info',
    service: 'audit',
    message: '批量写入 218 条审计事件，P99 12ms',
    time: stampOf(15),
  },
  {
    id: 'log-09',
    level: 'warn',
    service: 'na-cache-03',
    message: '内存使用率 92.8%，触发 allkeys-lru 淘汰，已剔除 1.8 万键',
    time: stampOf(18),
  },
  {
    id: 'log-10',
    level: 'info',
    service: 'gateway',
    message: 'TLS 证书自动续期成功，有效期至 2027-05-03',
    time: stampOf(21),
  },
  {
    id: 'log-11',
    level: 'info',
    service: 'na-edge-03',
    message: '健康检查连续失败 3 次，已从负载均衡摘除',
    time: stampOf(26),
  },
  {
    id: 'log-12',
    level: 'warn',
    service: 'mq-02',
    message: 'order.queue 消费积压 4218 条，消费者 6/8 在线',
    time: stampOf(29),
  },
  {
    id: 'log-13',
    level: 'info',
    service: 'order-svc',
    message: '灰度发布 v4.2.1 完成，观察期 30 分钟无异常',
    time: stampOf(34),
  },
  {
    id: 'log-14',
    level: 'warn',
    service: 'report-svc',
    message: '报表导出任务 CPU 抢占，已限制并发到 4',
    time: stampOf(38),
  },
  {
    id: 'log-15',
    level: 'info',
    service: 'auth-svc',
    message: '令牌签发 2,860 次/分，失败率 0.03%',
    time: stampOf(42),
  },
  {
    id: 'log-16',
    level: 'info',
    service: 'prometheus',
    message: '采集目标 148/150 在线，抓取耗时 P95 42ms',
    time: stampOf(46),
  },
  {
    id: 'log-17',
    level: 'warn',
    service: 'na-oss-02',
    message: '/ossdata 使用率 89.1%，按当前增速预计 6 天后越线',
    time: stampOf(52),
  },
  {
    id: 'log-18',
    level: 'info',
    service: 'alertmanager',
    message: '告警分组策略生效，静默规则 0 条',
    time: stampOf(57),
  },
]

/* ------------------------------ SLO ------------------------------ */

export const PERF_SLOS: PerfSloItem[] = [
  {
    id: 'slo-1',
    name: '核心交易可用性',
    target: 99.95,
    actual: 99.87,
    budgetLeft: 62.4,
    window: '30 天滚动',
    burnRate: 2.8,
  },
  {
    id: 'slo-2',
    name: '支付链路可用性',
    target: 99.9,
    actual: 99.62,
    budgetLeft: 38.2,
    window: '30 天滚动',
    burnRate: 6.4,
  },
  {
    id: 'slo-3',
    name: '读接口 P95 < 200ms',
    target: 99.0,
    actual: 98.42,
    budgetLeft: 54.6,
    window: '7 天滚动',
    burnRate: 1.9,
  },
  {
    id: 'slo-4',
    name: '搜索可用性',
    target: 99.5,
    actual: 96.18,
    budgetLeft: 8.4,
    window: '7 天滚动',
    burnRate: 12.6,
  },
  {
    id: 'slo-5',
    name: '审计写入成功率',
    target: 99.99,
    actual: 99.995,
    budgetLeft: 88.6,
    window: '30 天滚动',
    burnRate: 0.4,
  },
]

/* ------------------------------ 汇总 ------------------------------ */

export const PERF_KPIS: PerfKpi[] = [
  {
    key: 'nodes',
    label: '在线节点',
    value: HOST_ONLINE,
    decimals: 0,
    unit: `/ ${HOST_TOTAL}`,
    delta: -2.0,
    deltaLabel: '较昨日',
    trend: [54, 54, 53, 54, 54, 53, 53, 53, 53, 53, 53, 53],
    tone: HOST_CRIT > 0 ? 'warning' : 'success',
  },
  {
    key: 'cpu',
    label: '集群平均 CPU',
    value: AVG_CPU,
    decimals: 1,
    unit: '%',
    delta: 4.6,
    deltaLabel: '较 1 小时前',
    trend: [42, 45, 47, 44, 49, 52, 48, 51, 53, 55, 52, AVG_CPU],
    tone: AVG_CPU >= 75 ? 'danger' : 'primary',
  },
  {
    key: 'memory',
    label: '内存水位',
    value: AVG_MEMORY,
    decimals: 1,
    unit: '%',
    delta: 1.8,
    deltaLabel: '较 1 小时前',
    trend: [56, 57, 58, 57, 59, 61, 60, 62, 61, 63, 62, AVG_MEMORY],
    tone: AVG_MEMORY >= 80 ? 'warning' : 'primary',
  },
  {
    key: 'disk',
    label: '磁盘最高水位',
    value: MAX_DISK,
    decimals: 1,
    unit: '%',
    delta: 2.4,
    deltaLabel: '较昨日',
    trend: [86, 87, 88, 89, 90, 91, 92, 92, 93, 94, 94, MAX_DISK],
    tone: MAX_DISK >= 90 ? 'danger' : 'warning',
  },
  {
    key: 'qps',
    label: '集群 QPS',
    value: CLUSTER_QPS,
    decimals: 0,
    delta: 8.42,
    deltaLabel: '较昨日同时段',
    trend: [
      14200,
      14800,
      15300,
      15900,
      16200,
      17100,
      16800,
      17400,
      17900,
      18200,
      18100,
      CLUSTER_QPS,
    ],
    tone: 'success',
  },
  {
    key: 'latency',
    label: 'P95 延迟',
    value: CLUSTER_P95,
    decimals: 0,
    unit: 'ms',
    delta: 12.6,
    deltaLabel: '较昨日同时段',
    trend: [196, 204, 198, 212, 218, 224, 231, 228, 234, 239, 236, CLUSTER_P95],
    tone: CLUSTER_P95 >= 500 ? 'danger' : 'warning',
  },
  {
    key: 'errors',
    label: '请求错误率',
    value: CLUSTER_ERROR_RATE,
    decimals: 2,
    unit: '%',
    delta: 3.14,
    deltaLabel: '较昨日同时段',
    trend: [0.42, 0.46, 0.44, 0.51, 0.48, 0.56, 0.62, 0.58, 0.66, 0.71, 0.69, CLUSTER_ERROR_RATE],
    tone: CLUSTER_ERROR_RATE >= 1 ? 'danger' : 'warning',
  },
  {
    key: 'alerts',
    label: '未处理告警',
    value: PERF_ALERTS.filter((alert) => alert.state === 'firing').length,
    decimals: 0,
    unit: '条',
    delta: -18.4,
    deltaLabel: '较 1 小时前',
    trend: [
      9,
      8,
      8,
      7,
      7,
      6,
      6,
      5,
      5,
      4,
      4,
      PERF_ALERTS.filter((alert) => alert.state === 'firing').length,
    ],
    tone: 'danger',
  },
]

export function buildPerfSummary(): PerfSummary {
  const unacked = PERF_ALERTS.filter((alert) => alert.state === 'firing').length
  return {
    cluster: { ...PERF_CLUSTER, updatedAt: new Date().toISOString() },
    kpis: PERF_KPIS,
    nodes: {
      total: HOST_TOTAL,
      healthy: HOST_TOTAL - HOST_WARN - HOST_CRIT - (HOST_TOTAL - HOST_ONLINE),
      warning: HOST_WARN,
      critical: HOST_CRIT,
      offline: HOST_TOTAL - HOST_ONLINE,
    },
    services: {
      total: PERF_SERVICES.length,
      healthy: PERF_SERVICES.filter((svc) => svc.status === 'healthy').length,
      degraded: PERF_SERVICES.filter((svc) => svc.status === 'warning').length,
      down: PERF_SERVICES.filter((svc) => svc.status === 'critical').length,
    },
    alerts: {
      critical: PERF_ALERTS.filter((alert) => alert.level === 'critical').length,
      warning: PERF_ALERTS.filter((alert) => alert.level === 'warning').length,
      info: PERF_ALERTS.filter((alert) => alert.level === 'info').length,
      unacked,
    },
    slo: 99.94,
    errorBudget: 62.4,
    burnRate: 2.8,
  }
}
