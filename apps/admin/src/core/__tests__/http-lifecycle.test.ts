import { describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  addErrorHandler,
  addRequestInterceptor,
  api,
  resetHttpInterceptors,
} from '@/core/http'

/**
 * 拦截器生命周期
 *
 * 之前 `addRequestInterceptor` / `addErrorHandler` 只 push 不返回注销函数，
 * 而 `useHttpBootstrap` 在 effect 里注册 —— `<StrictMode>` 下 effect 跑两次、
 * HMR 每次热更再叠一层，结果是错误提示成倍弹出。
 * 现在注册函数返回注销函数，这里验证它真的生效。
 */

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify({ code: 0, data: body }), {
    status,
    headers: { 'content-type': 'application/json' },
  })

describe('注册与注销', () => {
  it('注销后请求拦截器不再生效', async () => {
    const originalFetch = globalThis.fetch
    let seenAuth: string | null = 'unset'

    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      seenAuth = new Headers(init?.headers).get('Authorization')
      return jsonResponse({ ok: true })
    }) as typeof fetch

    const remove = addRequestInterceptor((config) => ({
      ...config,
      headers: { ...config.headers, Authorization: 'Bearer demo' },
    }))

    await api.get('/x', { anonymous: true })
    expect(seenAuth).toBe('Bearer demo')

    remove()
    await api.get('/x', { anonymous: true })
    expect(seenAuth).toBeNull()

    globalThis.fetch = originalFetch
    resetHttpInterceptors()
  })

  it('重复注册再全部注销后，错误处理器不再被调用', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response('boom', { status: 500 })) as typeof fetch

    const first = vi.fn()
    const second = vi.fn()
    const removeFirst = addErrorHandler(first)
    // 模拟 StrictMode：同一份逻辑注册两次
    const removeSecond = addErrorHandler(second)

    await expect(api.get('/boom', { silent: false })).rejects.toBeInstanceOf(ApiError)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)

    removeFirst()
    removeSecond()
    await expect(api.get('/boom', { silent: false })).rejects.toBeInstanceOf(ApiError)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)

    globalThis.fetch = originalFetch
    resetHttpInterceptors()
  })
})

describe('调用方主动取消', () => {
  it('外部 signal 已中止时不触发全局错误提示', async () => {
    const originalFetch = globalThis.fetch
    const handler = vi.fn()
    const remove = addErrorHandler(handler)

    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      // 模拟浏览器在 signal 中止后抛 AbortError
      if (init?.signal?.aborted) {
        throw Object.assign(new Error('aborted'), { name: 'AbortError' })
      }
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        })
      })
    }) as typeof fetch

    const controller = new AbortController()
    const pending = api.get('/slow', { signal: controller.signal })
    controller.abort()

    await expect(pending).rejects.toBeInstanceOf(ApiError)
    // 用户主动取消（组件卸载、搜索防抖、路由切换）不该弹 toast
    expect(handler).not.toHaveBeenCalled()

    remove()
    globalThis.fetch = originalFetch
    resetHttpInterceptors()
  })
})

describe('响应结构校验', () => {
  it('开发环境下结构不符会抛出 ApiError', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => jsonResponse({ wrong: 'shape' })) as typeof fetch

    const schema = {
      safeParse: (input: unknown) => {
        if (typeof input === 'object' && input !== null && 'ok' in input) {
          return { success: true as const, data: input }
        }
        return { success: false as const, error: { issues: [], message: '缺少 ok 字段' } }
      },
    }

    await expect(api.get('/checked', { schema, silent: true })).rejects.toThrow('接口响应结构不符')

    globalThis.fetch = originalFetch
    resetHttpInterceptors()
  })
})
