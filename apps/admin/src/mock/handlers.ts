import type { Article, AuditLog, Order, User } from '@/types/domain'
import {
  ACTIVITIES,
  ARTICLES,
  AUDIT_LOGS,
  CHANNELS,
  FUNNEL,
  ORDERS,
  ORG_TREE,
  OVERVIEW_METRICS,
  ROLES,
  TODOS,
  TRENDS,
  USERS,
} from './data'
import {
  PERF_ALERTS,
  PERF_HEATMAP,
  PERF_HOSTS,
  PERF_LOGS,
  PERF_PROCESSES,
  PERF_SERIES,
  PERF_SERVICES,
  PERF_SLOS,
  PERF_VOLUMES,
  buildPerfSummary,
} from './performance'

type SearchParams = URLSearchParams

function filterUsers(params: SearchParams): User[] {
  const keyword = (params.get('keyword') ?? '').trim().toLowerCase()
  const status = params.get('status')
  const role = params.get('role')
  const department = params.get('department')
  return USERS.filter((user) => {
    if (keyword) {
      const haystack = `${user.name}${user.email}${user.phone}${user.department}`.toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    if (status && status !== 'all' && user.status !== status) return false
    if (role && role !== 'all' && user.role !== role) return false
    if (department && department !== 'all' && user.department !== department) return false
    return true
  })
}

function filterOrders(params: SearchParams): Order[] {
  const keyword = (params.get('keyword') ?? '').trim().toLowerCase()
  const status = params.get('status')
  const channel = params.get('channel')
  const risk = params.get('risk')
  return ORDERS.filter((order) => {
    if (
      keyword &&
      !`${order.id}${order.customer}${order.customerEmail}`.toLowerCase().includes(keyword)
    ) {
      return false
    }
    if (status && status !== 'all' && order.status !== status) return false
    if (channel && channel !== 'all' && order.channel !== channel) return false
    if (risk === 'high' && order.riskScore < 70) return false
    if (risk === 'low' && order.riskScore >= 70) return false
    return true
  })
}

function filterArticles(params: SearchParams): Article[] {
  const keyword = (params.get('keyword') ?? '').trim().toLowerCase()
  const status = params.get('status')
  const category = params.get('category')
  return ARTICLES.filter((article) => {
    if (keyword && !`${article.title}${article.author}`.toLowerCase().includes(keyword))
      return false
    if (status && status !== 'all' && article.status !== status) return false
    if (category && category !== 'all' && article.category !== category) return false
    return true
  })
}

function filterLogs(params: SearchParams): AuditLog[] {
  const keyword = (params.get('keyword') ?? '').trim().toLowerCase()
  const action = params.get('action')
  const result = params.get('result')
  return AUDIT_LOGS.filter((log) => {
    if (keyword && !`${log.actor}${log.target}${log.detail}`.toLowerCase().includes(keyword))
      return false
    if (action && action !== 'all' && log.action !== action) return false
    if (result && result !== 'all' && log.result !== result) return false
    return true
  })
}

function sortBy<T>(items: T[], key: string | null, order: string | null): T[] {
  if (!key) return items
  const copy = [...items]
  copy.sort((a, b) => {
    const av = (a as Record<string, unknown>)[key]
    const bv = (b as Record<string, unknown>)[key]
    if (typeof av === 'number' && typeof bv === 'number')
      return order === 'desc' ? bv - av : av - bv
    return order === 'desc'
      ? String(bv).localeCompare(String(av), 'zh-CN')
      : String(av).localeCompare(String(bv), 'zh-CN')
  })
  return copy
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ code: 0, message: 'ok', data }), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const bad = (message: string, code = 400) =>
  new Response(
    JSON.stringify({ code, message, traceId: `trace_${Math.random().toString(16).slice(2, 10)}` }),
    {
      status: code,
      headers: { 'content-type': 'application/json' },
    },
  )

const page = <T>(items: T[], params: SearchParams) => {
  const pageNo = Number(params.get('page') ?? 1)
  const pageSize = Number(params.get('pageSize') ?? 10)
  const start = (pageNo - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page: pageNo,
    pageSize,
  }
}

/** 路由表：路径 + 方法 => handler */
export async function handleMockRequest(url: URL, init?: RequestInit): Promise<Response> {
  const path = url.pathname.replace(/^\/api/, '')
  const method = (init?.method ?? 'GET').toUpperCase()
  const params = url.searchParams

  // ---------- 工作台 / 报表 ----------
  if (path === '/overview/metrics') return json(OVERVIEW_METRICS)
  if (path === '/overview/trends') {
    const range = (params.get('range') ?? '30d') as keyof typeof TRENDS
    return json(TRENDS[range] ?? TRENDS['30d'])
  }
  if (path === '/overview/channels') return json(CHANNELS)
  if (path === '/overview/funnel') return json(FUNNEL)
  if (path === '/overview/todos') return json(TODOS)
  if (path === '/overview/activities') return json(ACTIVITIES)

  // ---------- 性能监控 ----------
  if (path === '/performance/summary') return json(buildPerfSummary())
  if (path === '/performance/series') {
    const range = (params.get('range') ?? '24h') as keyof typeof PERF_SERIES
    return json(PERF_SERIES[range] ?? PERF_SERIES['24h'])
  }
  if (path === '/performance/hosts') {
    const keyword = (params.get('keyword') ?? '').trim().toLowerCase()
    const status = params.get('status')
    const role = params.get('role')
    const zone = params.get('zone')
    const filtered = PERF_HOSTS.filter((host) => {
      if (keyword && !`${host.name}${host.ip}${host.role}`.toLowerCase().includes(keyword)) {
        return false
      }
      if (status && status !== 'all' && host.status !== status) return false
      if (role && role !== 'all' && host.role !== role) return false
      if (zone && zone !== 'all' && host.zone !== zone) return false
      return true
    })
    const sorted = sortBy(
      filtered,
      params.get('sortBy') ?? 'cpu',
      params.get('sortOrder') ?? 'desc',
    )
    return json(page(sorted, params))
  }
  if (path === '/performance/services') return json(PERF_SERVICES)
  if (path === '/performance/alerts') {
    const level = params.get('level')
    const state = params.get('state')
    const filtered = PERF_ALERTS.filter((alert) => {
      if (level && level !== 'all' && alert.level !== level) return false
      if (state && state !== 'all' && alert.state !== state) return false
      return true
    })
    return json(filtered)
  }
  if (path === '/performance/heatmap') return json(PERF_HEATMAP)
  if (path === '/performance/volumes') return json(PERF_VOLUMES)
  if (path === '/performance/processes') return json(PERF_PROCESSES)
  if (path === '/performance/logs') return json(PERF_LOGS)
  if (path === '/performance/slo') return json(PERF_SLOS)
  if (path === '/performance/alerts/ack' && method === 'POST') {
    const body = JSON.parse(String(init?.body ?? '{}')) as { id?: string; actor?: string }
    const alert = PERF_ALERTS.find((item) => item.id === body.id)
    if (!alert) return bad('告警不存在', 404)
    alert.state = 'acknowledged'
    alert.ackBy = body.actor ?? '当前用户'
    return json(alert)
  }
  if (path === '/performance/silence' && method === 'POST') {
    const body = JSON.parse(String(init?.body ?? '{}')) as { minutes?: number }
    const minutes = Number(body.minutes ?? 30)
    const until = new Date(Date.now() + minutes * 60_000).toISOString()
    return json({ success: true, until, minutes })
  }

  // ---------- 用户 ----------
  if (path === '/users' && method === 'GET') {
    const filtered = sortBy(filterUsers(params), params.get('sortBy'), params.get('sortOrder'))
    return json(page(filtered, params))
  }
  if (path === '/users/stats') {
    return json({
      total: USERS.length,
      active: USERS.filter((u) => u.status === 'active').length,
      invited: USERS.filter((u) => u.status === 'invited').length,
      disabled: USERS.filter((u) => u.status === 'disabled' || u.status === 'locked').length,
      mfa: USERS.filter((u) => u.mfa).length,
    })
  }
  if (path.startsWith('/users/') && method === 'GET') {
    const id = path.split('/')[2]
    const user = USERS.find((item) => item.id === id)
    return user ? json(user) : bad('用户不存在', 404)
  }
  if (path === '/users' && method === 'POST') {
    const body = JSON.parse(String(init?.body ?? '{}')) as Partial<User>
    const created: User = {
      id: `u_${Date.now()}`,
      name: body.name ?? '新用户',
      email: body.email ?? 'new@nexus.dev',
      phone: body.phone ?? '',
      department: body.department ?? '平台技术部',
      title: body.title ?? '成员',
      city: body.city ?? '杭州',
      role: body.role ?? 'viewer',
      roleName: '只读访客',
      status: 'invited',
      mfa: false,
      tags: [],
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    }
    USERS.unshift(created)
    return json(created, 201)
  }
  if (path.startsWith('/users/') && method === 'PATCH') {
    const id = path.split('/')[2]
    const body = JSON.parse(String(init?.body ?? '{}')) as Partial<User>
    const index = USERS.findIndex((item) => item.id === id)
    if (index === -1) return bad('用户不存在', 404)
    const merged = { ...USERS[index]!, ...body } as User
    USERS[index] = merged
    return json(merged)
  }
  if (path.startsWith('/users/') && method === 'DELETE') {
    const id = path.split('/')[2]
    const index = USERS.findIndex((item) => item.id === id)
    if (index === -1) return bad('用户不存在', 404)
    USERS.splice(index, 1)
    return json({ success: true })
  }
  if (path === '/users/batch' && method === 'POST') {
    const body = JSON.parse(String(init?.body ?? '{}')) as { ids: string[]; patch: Partial<User> }
    body.ids.forEach((id) => {
      const index = USERS.findIndex((item) => item.id === id)
      if (index !== -1) USERS[index] = { ...USERS[index]!, ...body.patch }
    })
    return json({ affected: body.ids.length })
  }

  // ---------- 订单 ----------
  if (path === '/orders' && method === 'GET') {
    const filtered = sortBy(filterOrders(params), params.get('sortBy'), params.get('sortOrder'))
    return json(page(filtered, params))
  }
  if (path === '/orders/stats') {
    return json({
      pending: ORDERS.filter((o) => o.status === 'pending').length,
      paid: ORDERS.filter((o) => o.status === 'paid').length,
      refunding: ORDERS.filter((o) => o.status === 'refunding').length,
      amount: ORDERS.reduce((sum, order) => sum + order.amount, 0),
      risky: ORDERS.filter((o) => o.riskScore >= 70).length,
    })
  }
  if (path.startsWith('/orders/') && method === 'GET') {
    const id = path.split('/')[2]
    const order = ORDERS.find((item) => item.id === id)
    return order ? json(order) : bad('订单不存在', 404)
  }

  // ---------- 内容 ----------
  if (path === '/articles' && method === 'GET') {
    const filtered = filterArticles(params)
    return json(page(filtered, params))
  }
  if (path === '/articles/stats') {
    return json({
      published: ARTICLES.filter((a) => a.status === 'published').length,
      reviewing: ARTICLES.filter((a) => a.status === 'reviewing').length,
      draft: ARTICLES.filter((a) => a.status === 'draft').length,
      views: ARTICLES.reduce((sum, article) => sum + article.views, 0),
    })
  }

  // ---------- 组织 / 角色 ----------
  if (path === '/org/tree') return json(ORG_TREE)
  if (path === '/roles') return json(ROLES)

  // ---------- 审计日志 ----------
  if (path === '/audit-logs') {
    const filtered = filterLogs(params)
    return json(page(filtered, params))
  }
  if (path === '/audit-logs/stats') {
    return json({
      total: AUDIT_LOGS.length,
      failure: AUDIT_LOGS.filter((log) => log.result === 'failure').length,
      actors: new Set(AUDIT_LOGS.map((log) => log.actor)).size,
      today: AUDIT_LOGS.filter(
        (log) => new Date(log.time).toDateString() === new Date().toDateString(),
      ).length,
    })
  }

  // ---------- 通用演示接口 ----------
  if (path === '/demo/notify') {
    return json({ success: true, message: '演示接口已触发' })
  }
  if (path === '/demo/slow') {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    return json({ success: true, elapsed: 1500 })
  }
  if (path === '/demo/error') {
    return bad('这是一个用于演示错误处理的接口', 500)
  }

  return bad(`未匹配的 Mock 接口：${method} ${path}`, 404)
}
