import { describe, expect, it } from 'vitest'
import { decideRouteAccess } from '@/core/route-guard'

/**
 * 路由权限守卫
 *
 * 这些用例守的是一个曾经真实存在的漏洞：
 * 模块清单里的 `permission` 只用于过滤菜单，直接敲 URL 仍能进入页面。
 * 现在守卫接进了 `beforeLoad`，判定逻辑抽成纯函数以便在这里断言。
 */

const base = {
  pathname: '/organization/roles',
  href: 'http://localhost/organization/roles',
}

describe('decideRouteAccess', () => {
  it('未登录访问任何页面都跳登录，并带回跳地址', () => {
    const decision = decideRouteAccess({
      ...base,
      permission: 'role:read',
      authenticated: false,
      hasPermission: () => false,
    })
    expect(decision).toEqual({ action: 'login', redirectTo: base.href })
  })

  it('未声明权限的页面：登录后直接放行', () => {
    const decision = decideRouteAccess({
      ...base,
      permission: undefined,
      authenticated: true,
      hasPermission: () => false,
    })
    expect(decision.action).toBe('allow')
  })

  it('已登录但缺少权限码：跳 403，并带上来源与所需权限', () => {
    const decision = decideRouteAccess({
      ...base,
      permission: 'role:read',
      authenticated: true,
      hasPermission: (permission) => permission === 'user:read',
    })
    expect(decision).toEqual({
      action: 'forbidden',
      from: '/organization/roles',
      need: 'role:read',
    })
  })

  it('持有权限码时放行', () => {
    const decision = decideRouteAccess({
      ...base,
      permission: 'role:read',
      authenticated: true,
      hasPermission: (permission) => permission === 'role:read',
    })
    expect(decision.action).toBe('allow')
  })

  it('超级管理员（通配权限）放行所有受保护页面', () => {
    const decision = decideRouteAccess({
      ...base,
      permission: 'audit:read',
      authenticated: true,
      // 与 auth-store 的语义一致：`*` 代表全部权限
      hasPermission: (permission) => permission === '*' || permission === 'audit:read',
    })
    expect(decision.action).toBe('allow')
  })
})
