import { useEffect, useMemo } from 'react'
import { toast } from '@nexus/ui'
import { addErrorHandler, addRequestInterceptor, type ApiError } from './http'
import { useAuthStore } from './auth-store'
import { tStatic } from '@/i18n'

/**
 * 传输层接线：把 token、401 处理、错误提示挂到统一 http 客户端
 * 在应用根组件调用一次。
 *
 * 注册函数都返回注销函数并在 cleanup 里调用：
 * - `<StrictMode>` 下 effect 会执行两次，不注销就会注册两份拦截器
 * - Vite HMR 每次热更新再叠一层，错误提示会成倍弹出
 */
export function useHttpBootstrap() {
  useEffect(() => {
    const removeRequestInterceptor = addRequestInterceptor((config) => {
      const { token } = useAuthStore.getState()
      if (token && !config.anonymous) {
        const headers = new Headers(config.headers)
        headers.set('Authorization', `Bearer ${token}`)
        headers.set('X-Trace-Id', crypto.randomUUID?.() ?? String(Date.now()))
        return { ...config, headers }
      }
      return config
    })

    let lastErrorAt = 0
    const removeErrorHandler = addErrorHandler((error: ApiError) => {
      // 401：登录失效，统一跳转
      if (error.code === 401) {
        useAuthStore.getState().logout()
        toast.warning(tStatic('http.sessionExpired'))
        return
      }
      // 简易去重，避免并发失败刷屏
      const now = Date.now()
      if (now - lastErrorAt < 1200) return
      lastErrorAt = now
      toast.error(error.message, {
        description: error.traceId ? `Trace: ${error.traceId}` : undefined,
      })
    })

    return () => {
      removeRequestInterceptor()
      removeErrorHandler()
    }
  }, [])
}

/** 登录态便捷 Hook */
export function useCurrentUser() {
  const user = useAuthStore((state) => state.user)
  const hasPermission = useAuthStore((state) => state.hasPermission)
  const hasRole = useAuthStore((state) => state.hasRole)
  return useMemo(() => ({ user, hasPermission, hasRole }), [user, hasPermission, hasRole])
}
