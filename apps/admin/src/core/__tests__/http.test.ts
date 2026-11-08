import { describe, expect, it } from 'vitest'
import { ApiError, addErrorHandler, addRequestInterceptor, api } from '@/core/http'

describe('http 拦截器', () => {
  it('请求拦截器可以改写 headers', async () => {
    const originalFetch = globalThis.fetch
    let capturedAuth: string | null = null

    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      capturedAuth = headers.get('Authorization')
      return new Response(JSON.stringify({ code: 0, data: { ok: true } }), {
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    addRequestInterceptor((config) => ({
      ...config,
      headers: { ...config.headers, Authorization: 'Bearer test-token' },
    }))

    const result = await api.get<{ ok: boolean }>('/demo')
    expect(result.ok).toBe(true)
    expect(capturedAuth).toBe('Bearer test-token')

    globalThis.fetch = originalFetch
  })

  it('非 2xx 响应抛出 ApiError 并触发错误处理器', async () => {
    const originalFetch = globalThis.fetch
    const captured: ApiError[] = []

    addErrorHandler((error) => {
      captured.push(error)
    })
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ code: 500, message: '服务异常' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch

    await expect(api.get('/boom')).rejects.toBeInstanceOf(ApiError)
    expect(captured[0]?.code).toBe(500)
    expect(captured[0]?.message).toBe('服务异常')

    globalThis.fetch = originalFetch
  })
})
