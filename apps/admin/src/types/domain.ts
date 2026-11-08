/** 业务领域模型：与后端接口契约保持一致 */

export type UserStatus = 'active' | 'invited' | 'disabled' | 'locked'
export type UserRole = 'super_admin' | 'admin' | 'operator' | 'auditor' | 'viewer'

export interface User {
  id: string
  name: string
  email: string
  phone: string
  department: string
  title: string
  city: string
  role: UserRole
  roleName: string
  status: UserStatus
  /** 两步验证 */
  mfa: boolean
  createdAt: string
  lastActiveAt: string
  /** 标签 */
  tags: string[]
  avatar?: string
}

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed' | 'refunding' | 'closed'
export type PaymentMethod = 'wechat' | 'alipay' | 'bank' | 'balance'

export interface OrderItem {
  sku: string
  name: string
  quantity: number
  price: number
}

export interface Order {
  id: string
  customer: string
  customerEmail: string
  amount: number
  status: OrderStatus
  items: OrderItem[]
  payment: PaymentMethod
  channel: 'web' | 'app' | 'api' | 'offline'
  riskScore: number
  createdAt: string
  remark?: string
}

export type ArticleStatus = 'draft' | 'reviewing' | 'published' | 'archived'

export interface Article {
  id: string
  title: string
  author: string
  category: string
  status: ArticleStatus
  views: number
  comments: number
  words: number
  updatedAt: string
  createdAt: string
  cover?: string
  excerpt: string
}

export interface Role {
  id: string
  name: string
  key: UserRole
  description: string
  memberCount: number
  permissions: string[]
  builtin: boolean
}

export interface OrgNode {
  id: string
  name: string
  type: 'company' | 'department' | 'team'
  leader?: string
  memberCount: number
  children?: OrgNode[]
}

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'export' | 'approve'
export type AuditResult = 'success' | 'failure'

export interface AuditLog {
  id: string
  actor: string
  actorRole: string
  action: AuditAction
  target: string
  targetType: string
  result: AuditResult
  ip: string
  ua: string
  time: string
  detail: string
}

export interface OverviewMetric {
  key: string
  label: string
  value: number
  unit?: string
  delta: number
  trend: number[]
  tone: 'primary' | 'success' | 'warning' | 'danger'
}

export interface TrendPoint {
  date: string
  revenue: number
  orders: number
  users: number
  conversion: number
}

export interface ChannelSlice {
  name: string
  value: number
}

export interface FunnelStage {
  stage: string
  value: number
}

export interface TodoItem {
  id: string
  title: string
  type: 'approval' | 'ticket' | 'risk' | 'report'
  priority: 'high' | 'medium' | 'low'
  dueAt: string
  owner: string
  done: boolean
}

export interface ActivityItem {
  id: string
  actor: string
  action: string
  target: string
  time: string
  tone: 'default' | 'success' | 'warning' | 'danger' | 'primary'
}

/* ------------------------------------------------------------------ *
 * 性能监控（服务器 / 服务 / 告警）
 *
 * 与业务模型的区别：这里的数值都是「当下状态 + 短周期趋势」，
 * 字段刻意保持扁平，便于直接喂给图表与表格，不在渲染期做二次推导。
 * ------------------------------------------------------------------ */

/** 通用健康状态：绿 / 黄 / 红 / 灰（离线） */
export type PerfStatus = 'healthy' | 'warning' | 'critical' | 'offline'
export type PerfRange = '1h' | '6h' | '24h' | '7d'
export type PerfZone = 'az-a' | 'az-b' | 'az-c'
export type PerfAlertLevel = 'critical' | 'warning' | 'info'
export type PerfAlertState = 'firing' | 'acknowledged' | 'resolved'

/** 顶部指标卡（与 OverviewMetric 同构，便于复用 KpiTile） */
export interface PerfKpi {
  key: string
  label: string
  value: number
  /** 小数位 */
  decimals: number
  unit?: string
  prefix?: string
  delta: number
  deltaLabel: string
  trend: number[]
  tone: 'primary' | 'success' | 'warning' | 'danger'
}

/** 采集链路与值班信息 */
export interface PerfClusterInfo {
  id: string
  region: string
  onCall: string
  backup: string
  channels: string[]
  collectInterval: string
  retention: string
  prometheus: string
  loki: string
  alertmanager: string
  updatedAt: string
  /** 告警静默截止时间；null 表示未静默 */
  silenceUntil: string | null
}

export interface PerfSummary {
  cluster: PerfClusterInfo
  kpis: PerfKpi[]
  nodes: { total: number; healthy: number; warning: number; critical: number; offline: number }
  services: { total: number; healthy: number; degraded: number; down: number }
  alerts: { critical: number; warning: number; info: number; unacked: number }
  slo: number
  errorBudget: number
  burnRate: number
}

export interface PerfHost {
  id: string
  name: string
  role: 'gateway' | 'app' | 'api' | 'database' | 'cache' | 'mq' | 'worker' | 'storage'
  zone: PerfZone
  ip: string
  status: PerfStatus
  cpu: number
  memory: number
  disk: number
  networkIn: number
  networkOut: number
  load1: number
  load5: number
  uptimeDays: number
  kernel: string
  os: string
  cores: number
  memoryTotal: number
  diskTotal: number
  temperature: number
  iops: number
  latencyP95: number
  containers: number
  lastHeartbeat: string
  cpuTrend: number[]
  memoryTrend: number[]
}

export interface PerfSeriesPoint {
  time: string
  cpu: number
  memory: number
  disk: number
  load: number
  networkIn: number
  networkOut: number
  latency: number
  qps: number
  errorRate: number
}

export interface PerfSeries {
  range: PerfRange
  points: PerfSeriesPoint[]
}

export interface PerfHeatCell {
  /** 0 = 周一 … 6 = 周日 */
  day: number
  hour: number
  /** 负载百分比 */
  value: number
}

export interface PerfService {
  id: string
  name: string
  tier: 'edge' | 'core' | 'support'
  replicas: number
  ready: number
  qps: number
  p95: number
  errorRate: number
  cpu: number
  memory: number
  status: PerfStatus
  version: string
  lastDeploy: string
  owner: string
  slo: number
  latencyTrend: number[]
}

export interface PerfAlert {
  id: string
  level: PerfAlertLevel
  title: string
  target: string
  rule: string
  value: string
  startedAt: string
  duration: string
  state: PerfAlertState
  source: string
  channels: string[]
  runbook: string
  ackBy?: string
}

export interface PerfVolume {
  id: string
  host: string
  mount: string
  fs: string
  total: number
  used: number
  inode: number
  readIops: number
  writeIops: number
  latency: number
  status: PerfStatus
}

export interface PerfProcess {
  pid: number
  name: string
  host: string
  user: string
  cpu: number
  memory: number
  threads: number
  state: 'running' | 'sleeping' | 'zombie'
  uptime: string
}

export interface PerfLog {
  id: string
  level: 'info' | 'warn' | 'error'
  service: string
  message: string
  time: string
}

export interface PerfSloItem {
  id: string
  name: string
  target: number
  actual: number
  budgetLeft: number
  window: string
  burnRate: number
}
