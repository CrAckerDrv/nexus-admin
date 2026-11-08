/**
 * 内置 Mock 服务 · 基于原生 fetch 打补丁（零依赖，无需 MSW / Service Worker）
 *
 * 为什么这样做：
 * 1. Service Worker 在 file:// 与部分内网环境不可用
 * 2. 直接拦截全局 fetch 可以做到「零配置、零注册」，克隆即跑
 * 3. 本模块只被 `main.tsx` 的演示分支动态 import：生产环境不下载、不执行，
 *    演示账号（含明文口令）也不会出现在产物里
 */

import { handleMockRequest } from './handlers'
import { authenticateDemo } from './accounts'
import { configureAuthAdapter } from '@/core/auth-store'
import { tStatic } from '@/i18n'

type FetchArgs = Parameters<typeof fetch>

let installed = false

export async function startMockServer(): Promise<void> {
  if (installed || typeof window === 'undefined') return
  installed = true

  // 演示鉴权：账号密码校验留在 mock 目录，auth-store 只认 adapter
  configureAuthAdapter({
    login: async (email, password, options) => {
      // 模拟网络延迟，便于观察加载态
      await new Promise((resolve) => setTimeout(resolve, 520))
      /**
       * 人机验证票据
       *
       * 演示态没有后端可调 siteverify，这里只断言「调用方确实带来了票据」，
       * 用来证明前端接线是通的；**真实判定必须放在你的后端**，
       * 参考 docs/guide/backend.md 的「人机验证（Turnstile）」。
       * 演示态用的是 Cloudflare「永远通过」测试 key，票据恒为
       * XXXX.DUMMY.TOKEN.XXXX，所以这条断言不会卡住演示。
       */
      if (!options?.captchaToken) throw new Error(tStatic('captcha.required'))
      const user = authenticateDemo(email, password)
      if (!user) throw new Error('账号或密码不正确')
      return { token: `demo_token_${user.id}_${Date.now()}`, user }
    },
  })

  const originalFetch = window.fetch.bind(window)

  window.fetch = async (...args: FetchArgs) => {
    const [input, init] = args
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const url = new URL(rawUrl, window.location.origin)
    if (!url.pathname.startsWith('/api/')) {
      return originalFetch(...args)
    }
    // 模拟网络抖动：50~180ms，让加载态真实可见
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 130))
    const response = await handleMockRequest(url, init)
    return response
  }

  console.info(
    '%c[Mock] 演示数据已启用 %c关闭方式：不设置 VITE_ENABLE_MOCK（生产环境默认关闭）',
    'background:#0d6efd;color:#fff;padding:2px 6px;border-radius:4px',
    'color:#86909c',
  )
}

/* ---------------- 响应辅助 ---------------- */

export function ok<T>(data: T, init?: ResponseInit): Response {
  return new Response(JSON.stringify({ code: 0, message: 'ok', data }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

export function fail(code: number, message: string, detail?: unknown): Response {
  return new Response(
    JSON.stringify({
      code,
      message,
      detail,
      traceId: `trace_${Math.random().toString(16).slice(2, 10)}`,
    }),
    {
      status: code >= 400 && code < 600 ? code : 200,
      headers: { 'content-type': 'application/json' },
    },
  )
}

export function paginate<T>(items: T[], page = 1, pageSize = 10) {
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
  }
}
