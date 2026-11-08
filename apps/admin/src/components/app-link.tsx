import type { ReactNode } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { cn } from '@nexus/ui'

/**
 * 应用内链接封装
 *
 * 说明：路由由模块清单动态生成，路径在编译期是 `string`（而非字面量联合类型）。
 * 这里统一做一次类型收敛，避免每个调用点写 `as never`。
 */
export function AppLink({
  to,
  children,
  className,
  ariaCurrent,
  onClick,
  title,
  newTab,
}: {
  to: string
  children: ReactNode
  className?: string
  ariaCurrent?: 'page' | undefined
  onClick?: () => void
  title?: string
  /** 新标签页打开（大屏等沉浸页面用） */
  newTab?: boolean
}) {
  return (
    <Link
      to={to as never}
      className={className}
      aria-current={ariaCurrent}
      onClick={onClick}
      title={title}
      // 用 target 而不是 window.open：保留原生「在新标签打开」的
      // 中键 / Ctrl+点击 / 右键菜单语义，也便于屏幕阅读器提示
      target={newTab ? '_blank' : undefined}
      rel={newTab ? 'noopener noreferrer' : undefined}
    >
      {children}
    </Link>
  )
}

/** 应用内跳转（保留 SPA 语义，带路径类型收敛） */
export function useAppNavigate() {
  const navigate = useNavigate()
  return (to: string, options?: { replace?: boolean }) =>
    void navigate({ to: to as never, replace: options?.replace })
}

/** 带当前路由高亮的导航链接 */
export function NavLinkButton({
  to,
  currentPath,
  children,
  className,
  activeClassName = 'bg-primary-weak text-primary',
}: {
  to: string
  currentPath: string
  children: ReactNode
  className?: string
  activeClassName?: string
}) {
  const active = currentPath === to || currentPath.startsWith(`${to}/`)
  return (
    <AppLink
      to={to}
      className={cn(className, active && activeClassName)}
      ariaCurrent={active ? 'page' : undefined}
    >
      {children}
    </AppLink>
  )
}

/** 读取当前路径 */
export function useCurrentPath(): string {
  return useRouterState({ select: (state) => state.location.pathname })
}
