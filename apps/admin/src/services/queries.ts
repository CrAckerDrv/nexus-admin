import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type PageResult } from '@/core/http'
import { queryKeys } from '@/core/query-client'
import type { Article, AuditLog, Order, OverviewMetric, TrendPoint, User } from '@/types/domain'
import type {
  ChannelSlice,
  FunnelStage,
  TodoItem,
  ActivityItem,
  OrgNode,
  Role,
  PerfAlert,
  PerfHeatCell,
  PerfHost,
  PerfLog,
  PerfProcess,
  PerfRange,
  PerfSeries,
  PerfService,
  PerfSloItem,
  PerfSummary,
  PerfVolume,
} from '@/types/domain'

/* ------------------------------------------------------------------ *
 * 数据访问层（Service）
 * 页面只调用这些 hooks，不直接写 fetch —— 便于将来替换后端
 *
 * 三个约定：
 * 1. `queryFn` 的参数里带 `signal`，透传给 http 层 → 组件卸载/参数变化时
 *    真正中断在途请求，而不是让旧响应回来覆盖新状态。
 * 2. 开发环境带 `schema` 校验响应结构；schema 用动态 import 取，
 *    生产构建里 `import.meta.env.DEV` 为 false，zod 整块不会进包。
 * 3. 请求的取消不会触发全局错误 toast（见 core/http.ts）。
 * ------------------------------------------------------------------ */

import type * as Schemas from './schemas'

/** 只在开发环境加载响应契约模块，生产构建裁剪掉 */
function devSchema<T>(pick: (schemas: typeof Schemas) => T): Promise<T | undefined> {
  if (!import.meta.env.DEV) return Promise.resolve(undefined)
  return import('./schemas').then(pick)
}

export interface UserListParams {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
  role?: string
  department?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export function useUsers(params: UserListParams = {}) {
  return useQuery({
    queryKey: queryKeys.users(params),
    queryFn: ({ signal }) =>
      api.get<PageResult<User>>('/users', {
        params: params as Record<string, string | number>,
        signal,
        schema: devSchema((m) => m.userPageSchema),
      }),
    placeholderData: (prev) => prev,
  })
}

export function useUserStats() {
  return useQuery({
    queryKey: ['users', 'stats'] as const,
    queryFn: ({ signal }) =>
      api.get<{ total: number; active: number; invited: number; disabled: number; mfa: number }>(
        '/users/stats',
        { signal, schema: devSchema((m) => m.userStatsSchema) },
      ),
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<User>) => api.post<User>('/users', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<User> }) =>
      api.patch<User>(`/users/${id}`, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/users/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export interface OrderListParams {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
  channel?: string
  risk?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export function useOrders(params: OrderListParams = {}) {
  return useQuery({
    queryKey: queryKeys.orders(params),
    queryFn: ({ signal }) =>
      api.get<PageResult<Order>>('/orders', {
        params: params as Record<string, string | number>,
        signal,
        schema: devSchema((m) => m.orderPageSchema),
      }),
    placeholderData: (prev) => prev,
  })
}

export function useOrderStats() {
  return useQuery({
    queryKey: ['orders', 'stats'] as const,
    queryFn: ({ signal }) =>
      api.get<{ pending: number; paid: number; refunding: number; amount: number; risky: number }>(
        '/orders/stats',
        { signal, schema: devSchema((m) => m.orderStatsSchema) },
      ),
  })
}

export interface ArticleListParams {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
  category?: string
}

export function useArticles(params: ArticleListParams = {}) {
  return useQuery({
    queryKey: queryKeys.articles(params),
    queryFn: ({ signal }) =>
      api.get<PageResult<Article>>('/articles', {
        params: params as Record<string, string | number>,
        signal,
        schema: devSchema((m) => m.articlePageSchema),
      }),
    placeholderData: (prev) => prev,
  })
}

export function useArticleStats() {
  return useQuery({
    queryKey: ['articles', 'stats'] as const,
    queryFn: ({ signal }) =>
      api.get<{ published: number; reviewing: number; draft: number; views: number }>(
        '/articles/stats',
        { signal, schema: devSchema((m) => m.articleStatsSchema) },
      ),
  })
}

export interface AuditParams {
  page?: number
  pageSize?: number
  keyword?: string
  action?: string
  result?: string
}

export function useAuditLogs(params: AuditParams = {}) {
  return useQuery({
    queryKey: queryKeys.auditLogs(params),
    queryFn: ({ signal }) =>
      api.get<PageResult<AuditLog>>('/audit-logs', {
        params: params as Record<string, string | number>,
        signal,
        schema: devSchema((m) => m.auditLogPageSchema),
      }),
    placeholderData: (prev) => prev,
  })
}

export function useAuditStats() {
  return useQuery({
    queryKey: ['audit-logs', 'stats'] as const,
    queryFn: ({ signal }) =>
      api.get<{ total: number; failure: number; actors: number; today: number }>(
        '/audit-logs/stats',
        { signal, schema: devSchema((m) => m.auditStatsSchema) },
      ),
  })
}

export function useRoles() {
  return useQuery({
    queryKey: queryKeys.roles(),
    queryFn: ({ signal }) => api.get<Role[]>('/roles', { signal }),
  })
}

export function useOrgTree() {
  return useQuery({
    queryKey: queryKeys.orgTree(),
    queryFn: ({ signal }) => api.get<OrgNode>('/org/tree', { signal }),
  })
}

/* ---------------- 工作台 ---------------- */

export function useOverviewMetrics() {
  return useQuery({
    queryKey: ['overview', 'metrics'],
    queryFn: ({ signal }) =>
      api.get<OverviewMetric[]>('/overview/metrics', {
        signal,
        schema: devSchema((m) => m.overviewMetricListSchema),
      }),
  })
}

export function useTrends(range: '7d' | '30d' | '90d') {
  return useQuery({
    queryKey: queryKeys.overview(range),
    queryFn: ({ signal }) =>
      api.get<TrendPoint[]>('/overview/trends', {
        params: { range },
        signal,
        schema: devSchema((m) => m.trendPointListSchema),
      }),
    placeholderData: (prev) => prev,
  })
}

export function useChannels() {
  return useQuery({
    queryKey: ['overview', 'channels'],
    queryFn: ({ signal }) =>
      api.get<ChannelSlice[]>('/overview/channels', {
        signal,
        schema: devSchema((m) => m.channelSliceListSchema),
      }),
  })
}

export function useFunnel() {
  return useQuery({
    queryKey: ['overview', 'funnel'],
    queryFn: ({ signal }) =>
      api.get<FunnelStage[]>('/overview/funnel', {
        signal,
        schema: devSchema((m) => m.funnelStageListSchema),
      }),
  })
}

export function useTodos() {
  return useQuery({
    queryKey: ['overview', 'todos'],
    queryFn: ({ signal }) => api.get<TodoItem[]>('/overview/todos', { signal }),
  })
}

export function useActivities() {
  return useQuery({
    queryKey: ['overview', 'activities'],
    queryFn: ({ signal }) => api.get<ActivityItem[]>('/overview/activities', { signal }),
  })
}

/* ------------------------------------------------------------------ *
 * 性能监控
 *
 * 与业务页的差异：这些接口天生是「高频刷新 + 短缓存」，
 * 因此单独收口一处，统一 `staleTime` 与轮询节奏，避免每个卡片各写一份。
 * 页面上的「暂停实时」开关通过 `enabled` 控制，不会在后台偷偷发请求。
 * ------------------------------------------------------------------ */

export interface PerfHostParams {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
  role?: string
  zone?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

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
}

export function usePerfSeries(range: PerfRange) {
  return useQuery({
    queryKey: ['performance', 'series', range],
    queryFn: ({ signal }) =>
      api.get<PerfSeries>('/performance/series', {
        params: { range },
        signal,
        schema: devSchema((m) => m.perfSeriesSchema),
      }),
    placeholderData: (prev) => prev,
  })
}

export function usePerfHosts(params: PerfHostParams = {}) {
  return useQuery({
    queryKey: ['performance', 'hosts', params],
    queryFn: ({ signal }) =>
      api.get<PageResult<PerfHost>>('/performance/hosts', {
        params: params as Record<string, string | number>,
        signal,
        schema: devSchema((m) => m.perfHostPageSchema),
      }),
    placeholderData: (prev) => prev,
  })
}

export function usePerfServices() {
  return useQuery({
    queryKey: ['performance', 'services'],
    queryFn: ({ signal }) =>
      api.get<PerfService[]>('/performance/services', {
        signal,
        schema: devSchema((m) => m.perfServiceListSchema),
      }),
  })
}

export function usePerfAlerts(params: { level?: string; state?: string } = {}) {
  return useQuery({
    queryKey: ['performance', 'alerts', params],
    queryFn: ({ signal }) =>
      api.get<PerfAlert[]>('/performance/alerts', {
        params: params as Record<string, string>,
        signal,
        schema: devSchema((m) => m.perfAlertListSchema),
      }),
    placeholderData: (prev) => prev,
  })
}

export function useAckPerfAlert() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { id: string; actor: string }) =>
      api.post<PerfAlert>('/performance/alerts/ack', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['performance'] })
    },
  })
}

export function useSilenceAlerts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (minutes: number) =>
      api.post<{ success: boolean; until: string }>('/performance/silence', { minutes }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['performance', 'summary'] })
    },
  })
}

export function usePerfHeatmap() {
  return useQuery({
    queryKey: ['performance', 'heatmap'],
    queryFn: ({ signal }) =>
      api.get<PerfHeatCell[]>('/performance/heatmap', {
        signal,
        schema: devSchema((m) => m.perfHeatmapSchema),
      }),
  })
}

export function usePerfVolumes() {
  return useQuery({
    queryKey: ['performance', 'volumes'],
    queryFn: ({ signal }) =>
      api.get<PerfVolume[]>('/performance/volumes', {
        signal,
        schema: devSchema((m) => m.perfVolumeListSchema),
      }),
  })
}

export function usePerfProcesses() {
  return useQuery({
    queryKey: ['performance', 'processes'],
    queryFn: ({ signal }) =>
      api.get<PerfProcess[]>('/performance/processes', {
        signal,
        schema: devSchema((m) => m.perfProcessListSchema),
      }),
  })
}

export function usePerfLogs() {
  return useQuery({
    queryKey: ['performance', 'logs'],
    queryFn: ({ signal }) =>
      api.get<PerfLog[]>('/performance/logs', {
        signal,
        schema: devSchema((m) => m.perfLogListSchema),
      }),
  })
}

export function usePerfSlos() {
  return useQuery({
    queryKey: ['performance', 'slo'],
    queryFn: ({ signal }) =>
      api.get<PerfSloItem[]>('/performance/slo', {
        signal,
        schema: devSchema((m) => m.perfSloListSchema),
      }),
  })
}
