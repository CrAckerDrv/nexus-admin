import { z } from 'zod'
import type { PageResult } from '@/core/http'

/* ------------------------------------------------------------------ *
 * 接口响应契约（仅开发环境加载）
 *
 * `api.get<T>()` 的 `<T>` 只是编译期断言 —— 后端字段改名时前端不会报错，
 * 只会在渲染层悄悄出现 undefined。这里用 zod 把契约写成运行时校验。
 *
 * 注意：这个模块**只能**通过动态 import 被引用（见 services/queries.ts）：
 *   schema: () => import('@/services/schemas').then((m) => m.userPageSchema)
 * 这样 zod（约 84 KB）不会进入生产包。
 * ------------------------------------------------------------------ */

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  department: z.string(),
  title: z.string(),
  city: z.string(),
  role: z.enum(['super_admin', 'admin', 'operator', 'auditor', 'viewer']),
  roleName: z.string(),
  status: z.enum(['active', 'invited', 'disabled', 'locked']),
  mfa: z.boolean(),
  createdAt: z.string(),
  lastActiveAt: z.string(),
  tags: z.array(z.string()),
  avatar: z.string().optional(),
})

export const orderSchema = z.object({
  id: z.string(),
  customer: z.string(),
  customerEmail: z.string(),
  amount: z.number(),
  status: z.enum(['pending', 'paid', 'shipped', 'completed', 'refunding', 'closed']),
  items: z.array(
    z.object({
      sku: z.string(),
      name: z.string(),
      quantity: z.number(),
      price: z.number(),
    }),
  ),
  payment: z.enum(['wechat', 'alipay', 'bank', 'balance']),
  channel: z.enum(['web', 'app', 'api', 'offline']),
  riskScore: z.number(),
  createdAt: z.string(),
  remark: z.string().optional(),
})

export const articleSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string(),
  category: z.string(),
  status: z.enum(['draft', 'reviewing', 'published', 'archived']),
  views: z.number(),
  comments: z.number(),
  words: z.number(),
  updatedAt: z.string(),
  createdAt: z.string(),
  cover: z.string().optional(),
  excerpt: z.string(),
})

export const auditLogSchema = z.object({
  id: z.string(),
  actor: z.string(),
  actorRole: z.string(),
  action: z.enum(['create', 'update', 'delete', 'login', 'export', 'approve']),
  target: z.string(),
  targetType: z.string(),
  result: z.enum(['success', 'failure']),
  ip: z.string(),
  ua: z.string(),
  time: z.string(),
  detail: z.string(),
})

/** 分页信封：所有列表接口共用 */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  })
}

export const userPageSchema = pageSchema(userSchema)
export const orderPageSchema = pageSchema(orderSchema)
export const articlePageSchema = pageSchema(articleSchema)
export const auditLogPageSchema = pageSchema(auditLogSchema)

/** 统计类接口 */
export const userStatsSchema = z.object({
  total: z.number(),
  active: z.number(),
  invited: z.number(),
  disabled: z.number(),
  mfa: z.number(),
})

export const orderStatsSchema = z.object({
  pending: z.number(),
  paid: z.number(),
  refunding: z.number(),
  amount: z.number(),
  risky: z.number(),
})

export const articleStatsSchema = z.object({
  published: z.number(),
  reviewing: z.number(),
  draft: z.number(),
  views: z.number(),
})

export const auditStatsSchema = z.object({
  total: z.number(),
  failure: z.number(),
  actors: z.number(),
  today: z.number(),
})

/* ---------------- 工作台 ---------------- */

export const overviewMetricSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number(),
  unit: z.string().optional(),
  delta: z.number(),
  trend: z.array(z.number()),
  tone: z.enum(['primary', 'success', 'warning', 'danger']),
})

export const trendPointSchema = z.object({
  date: z.string(),
  revenue: z.number(),
  orders: z.number(),
  users: z.number(),
  conversion: z.number(),
})

export const channelSliceSchema = z.object({
  name: z.string(),
  value: z.number(),
})

export const funnelStageSchema = z.object({
  stage: z.string(),
  value: z.number(),
})

export const trendPointListSchema = trendPointSchema.array()
export const overviewMetricListSchema = overviewMetricSchema.array()
export const channelSliceListSchema = channelSliceSchema.array()
export const funnelStageListSchema = funnelStageSchema.array()

/* ---------------- 性能监控 ---------------- */

export const perfStatusSchema = z.enum(['healthy', 'warning', 'critical', 'offline'])

export const perfKpiSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number(),
  decimals: z.number(),
  unit: z.string().optional(),
  prefix: z.string().optional(),
  delta: z.number(),
  deltaLabel: z.string(),
  trend: z.array(z.number()),
  tone: z.enum(['primary', 'success', 'warning', 'danger']),
})

export const perfSummarySchema = z.object({
  cluster: z.object({
    id: z.string(),
    region: z.string(),
    onCall: z.string(),
    backup: z.string(),
    channels: z.array(z.string()),
    collectInterval: z.string(),
    retention: z.string(),
    prometheus: z.string(),
    loki: z.string(),
    alertmanager: z.string(),
    updatedAt: z.string(),
    silenceUntil: z.string().nullable(),
  }),
  kpis: z.array(perfKpiSchema),
  nodes: z.object({
    total: z.number(),
    healthy: z.number(),
    warning: z.number(),
    critical: z.number(),
    offline: z.number(),
  }),
  services: z.object({
    total: z.number(),
    healthy: z.number(),
    degraded: z.number(),
    down: z.number(),
  }),
  alerts: z.object({
    critical: z.number(),
    warning: z.number(),
    info: z.number(),
    unacked: z.number(),
  }),
  slo: z.number(),
  errorBudget: z.number(),
  burnRate: z.number(),
})

export const perfHostSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['gateway', 'app', 'api', 'database', 'cache', 'mq', 'worker', 'storage']),
  zone: z.enum(['az-a', 'az-b', 'az-c']),
  ip: z.string(),
  status: perfStatusSchema,
  cpu: z.number(),
  memory: z.number(),
  disk: z.number(),
  networkIn: z.number(),
  networkOut: z.number(),
  load1: z.number(),
  load5: z.number(),
  uptimeDays: z.number(),
  kernel: z.string(),
  os: z.string(),
  cores: z.number(),
  memoryTotal: z.number(),
  diskTotal: z.number(),
  temperature: z.number(),
  iops: z.number(),
  latencyP95: z.number(),
  containers: z.number(),
  lastHeartbeat: z.string(),
  cpuTrend: z.array(z.number()),
  memoryTrend: z.array(z.number()),
})

export const perfSeriesPointSchema = z.object({
  time: z.string(),
  cpu: z.number(),
  memory: z.number(),
  disk: z.number(),
  load: z.number(),
  networkIn: z.number(),
  networkOut: z.number(),
  latency: z.number(),
  qps: z.number(),
  errorRate: z.number(),
})

export const perfSeriesSchema = z.object({
  range: z.enum(['1h', '6h', '24h', '7d']),
  points: z.array(perfSeriesPointSchema),
})

export const perfServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  tier: z.enum(['edge', 'core', 'support']),
  replicas: z.number(),
  ready: z.number(),
  qps: z.number(),
  p95: z.number(),
  errorRate: z.number(),
  cpu: z.number(),
  memory: z.number(),
  status: perfStatusSchema,
  version: z.string(),
  lastDeploy: z.string(),
  owner: z.string(),
  slo: z.number(),
  latencyTrend: z.array(z.number()),
})

export const perfAlertSchema = z.object({
  id: z.string(),
  level: z.enum(['critical', 'warning', 'info']),
  title: z.string(),
  target: z.string(),
  rule: z.string(),
  value: z.string(),
  startedAt: z.string(),
  duration: z.string(),
  state: z.enum(['firing', 'acknowledged', 'resolved']),
  source: z.string(),
  channels: z.array(z.string()),
  runbook: z.string(),
  ackBy: z.string().optional(),
})

export const perfHeatmapCellSchema = z.object({
  day: z.number(),
  hour: z.number(),
  value: z.number(),
})

export const perfVolumeSchema = z.object({
  id: z.string(),
  host: z.string(),
  mount: z.string(),
  fs: z.string(),
  total: z.number(),
  used: z.number(),
  inode: z.number(),
  readIops: z.number(),
  writeIops: z.number(),
  latency: z.number(),
  status: perfStatusSchema,
})

export const perfProcessSchema = z.object({
  pid: z.number(),
  name: z.string(),
  host: z.string(),
  user: z.string(),
  cpu: z.number(),
  memory: z.number(),
  threads: z.number(),
  state: z.enum(['running', 'sleeping', 'zombie']),
  uptime: z.string(),
})

export const perfLogSchema = z.object({
  id: z.string(),
  level: z.enum(['info', 'warn', 'error']),
  service: z.string(),
  message: z.string(),
  time: z.string(),
})

export const perfSloSchema = z.object({
  id: z.string(),
  name: z.string(),
  target: z.number(),
  actual: z.number(),
  budgetLeft: z.number(),
  window: z.string(),
  burnRate: z.number(),
})

export const perfHostPageSchema = pageSchema(perfHostSchema)
export const perfServiceListSchema = perfServiceSchema.array()
export const perfAlertListSchema = perfAlertSchema.array()
export const perfHeatmapSchema = perfHeatmapCellSchema.array()
export const perfVolumeListSchema = perfVolumeSchema.array()
export const perfProcessListSchema = perfProcessSchema.array()
export const perfLogListSchema = perfLogSchema.array()
export const perfSloListSchema = perfSloSchema.array()

/* ---------------- 登录表单 ---------------- */

export const loginFormSchema = z.object({
  email: z.string().min(1, '请输入邮箱').email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少 6 位'),
})

export type LoginFormValues = z.infer<typeof loginFormSchema>

/** 把 zod 的 issues 摊平成「字段 → 第一条错误」 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    result[key] ??= issue.message
  }
  return result
}

/** 便捷类型：列表接口的返回值 */
export type UserPage = PageResult<z.infer<typeof userSchema>>
