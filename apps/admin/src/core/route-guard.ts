import { redirect } from '@tanstack/react-router'
import { useAuthStore } from './auth-store'

/**
 * 路由级权限守卫
 *
 * 模块清单里声明的 `permission` 如果只用来过滤菜单，直接输入 URL 仍能进入页面 ——
 * 那等于把权限模型最关键的拦截点留空（菜单只是「不给入口」，不是「不给访问」）。
 *
 * 这里把守卫做成可单测的纯逻辑：输入 = 当前登录态 + 所需权限码，
 * 输出 = 放行 / 跳登录 / 跳 403。路由层只负责把它挂到 `beforeLoad`。
 */

export type GuardDecision =
  | { action: 'allow' }
  | { action: 'login'; redirectTo: string }
  | { action: 'forbidden'; from: string; need: string }

export interface GuardContext {
  permission: string | undefined
  /** 登录态 */
  authenticated: boolean
  /** 权限判定函数 */
  hasPermission: (permission: string) => boolean
  /** 目标路径（用于回跳与提示） */
  pathname: string
  /** 完整 href（登录后回跳用） */
  href: string
}

export function decideRouteAccess({
  permission,
  authenticated,
  hasPermission,
  pathname,
  href,
}: GuardContext): GuardDecision {
  // 未声明权限 = 登录即可访问
  if (!permission) {
    return authenticated ? { action: 'allow' } : { action: 'login', redirectTo: href }
  }
  if (!authenticated) return { action: 'login', redirectTo: href }
  if (!hasPermission(permission)) return { action: 'forbidden', from: pathname, need: permission }
  return { action: 'allow' }
}

/**
 * 把决策翻译成 `beforeLoad` 的行为（跳转或放行）
 *
 * 与 `decideRouteAccess` 拆开是为了让「决策」可以不依赖路由库被测试。
 */
export function enforceRouteAccess(ctx: { location: { href: string; pathname: string } }) {
  return (permission: string | undefined) => {
    const { status, hasPermission } = useAuthStore.getState()
    const decision = decideRouteAccess({
      permission,
      authenticated: status === 'authenticated',
      hasPermission,
      pathname: ctx.location.pathname,
      href: ctx.location.href,
    })

    if (decision.action === 'login') {
      throw redirect({ to: '/login', search: { redirect: decision.redirectTo } as never })
    }
    if (decision.action === 'forbidden') {
      throw redirect({
        to: '/errors/403' as never,
        search: { from: decision.from, need: decision.need } as never,
      })
    }
  }
}
