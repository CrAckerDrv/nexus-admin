import { QueryClient } from '@tanstack/react-query'

/**
 * React Query 全局配置
 *
 * 高性能要点：
 * - staleTime 默认 30s，避免路由往返重复请求
 * - refetchOnWindowFocus 关闭（后台系统频繁切窗口会放大 QPS）
 * - 失败重试 2 次，指数退避
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
    },
    mutations: {
      retry: 0,
    },
  },
})

/** 常用 query key 工厂：集中管理，避免字符串散落 */
export const queryKeys = {
  users: (params?: unknown) => ['users', params ?? {}] as const,
  user: (id: string) => ['user', id] as const,
  orders: (params?: unknown) => ['orders', params ?? {}] as const,
  articles: (params?: unknown) => ['articles', params ?? {}] as const,
  roles: () => ['roles'] as const,
  orgTree: () => ['org-tree'] as const,
  auditLogs: (params?: unknown) => ['audit-logs', params ?? {}] as const,
  overview: (range: string) => ['overview', range] as const,
  analytics: (range: string) => ['analytics', range] as const,
  notifications: () => ['notifications'] as const,
}
