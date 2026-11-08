import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { tStatic } from '@/i18n'

/* ------------------------------------------------------------------ *
 * 认证与权限
 *
 * 这里不存放任何演示账号 —— 演示身份由 `mock/accounts.ts` 提供，
 * 只在开发环境（或显式开启 Mock 的演示站）通过动态 import 注入。
 * 生产包里因此不会出现 `admin@nexus.dev / nexus123` 这类明文口令。
 * ------------------------------------------------------------------ */

export type RoleKey = 'super_admin' | 'admin' | 'operator' | 'auditor' | 'viewer'

export interface CurrentUser {
  id: string
  name: string
  email: string
  avatar?: string
  role: RoleKey
  roleName: string
  department: string
  /** 细粒度权限码，用于按钮级控制 */
  permissions: string[]
}

/**
 * 鉴权实现
 *
 * 接入真实后端时，在应用启动处调用 `configureAuthAdapter()` 换成 HTTP 实现，
 * 页面与守卫代码无需改动。
 */
export interface AuthAdapter {
  login: (
    email: string,
    password: string,
    /** 登录请求的附加凭据；人机验证 token 从这里透传给后端 */
    options?: LoginOptions,
  ) => Promise<{
    token: string
    user: CurrentUser
  }>
}

/**
 * 登录附加参数
 *
 * `captchaToken` 是 Turnstile 下发的一次性票据（`cf-turnstile-response`）。
 *
 * 它**必须随登录请求一起发给后端**，由后端调 siteverify 判定；
 * 前端只负责「没拿到票据就别发请求」，判定不在这里（也无法在这里）完成。
 * 后端要把它读出来、校验成功后再继续原有登录逻辑，参考
 * `docs/guide/backend.md` 的「人机验证（Turnstile）」一节。
 */
export interface LoginOptions {
  captchaToken?: string
}

export interface AuthState {
  token: string | null
  user: CurrentUser | null
  status: 'anonymous' | 'authenticated'
  login: (email: string, password: string, options?: LoginOptions) => Promise<void>
  logout: () => void
  hasPermission: (permission: string) => boolean
  hasRole: (roles: RoleKey | RoleKey[]) => boolean
}

/**
 * 默认鉴权实现：未接入后端时永远拒绝
 *
 * 不提供任何「本地放行」后门 —— 没配置 adapter 就登录不了，
 * 而不是悄悄用某个内置账号登进去（那等于把后门打进生产包）。
 */
let authAdapter: AuthAdapter = {
  login: async () => {
    throw new Error(tStatic('http.authNotConfigured'))
  },
}

export function configureAuthAdapter(adapter: AuthAdapter) {
  authAdapter = adapter
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      status: 'anonymous',

      login: async (email, password, options) => {
        const { token, user } = await authAdapter.login(email, password, options)
        set({ token, user, status: 'authenticated' })
      },

      logout: () => set({ token: null, user: null, status: 'anonymous' }),

      hasPermission: (permission) => {
        const { user } = get()
        if (!user) return false
        if (user.permissions.includes('*')) return true
        return user.permissions.includes(permission)
      },

      hasRole: (roles) => {
        const { user } = get()
        if (!user) return false
        return Array.isArray(roles) ? roles.includes(user.role) : user.role === roles
      },
    }),
    {
      name: 'nexus-auth',
      partialize: (state) => ({ token: state.token, user: state.user, status: state.status }),
    },
  ),
)

/** 权限守卫：无权限时返回 fallback */
export function withPermission(hasPermission: (permission: string) => boolean, permission: string) {
  return hasPermission(permission)
}
