/**
 * 统一 HTTP 传输层
 *
 * 设计目标：
 * 1. 业务层只依赖 `api.get/post`，不关心 fetch 细节
 * 2. 拦截器可插拔：鉴权头、Trace ID、错误上报
 * 3. 演示模式由 mock 层接管 fetch，无需改动业务代码
 */

import { tStatic } from '@/i18n'

export interface ApiErrorShape {
  code: number
  message: string
  detail?: unknown
  traceId?: string
}

export class ApiError extends Error implements ApiErrorShape {
  code: number
  detail?: unknown
  traceId?: string

  constructor(shape: ApiErrorShape) {
    super(shape.message)
    this.name = 'ApiError'
    this.code = shape.code
    this.detail = shape.detail
    this.traceId = shape.traceId
  }
}

export interface RequestConfig extends Omit<RequestInit, 'body'> {
  baseURL?: string
  params?: Record<string, string | number | boolean | undefined | null | string[]>
  body?: unknown
  timeout?: number
  /** 跳过鉴权头 */
  anonymous?: boolean
  /** 跳过全局错误提示（由调用方自行处理） */
  silent?: boolean
  /**
   * 响应结构校验器
   *
   * 允许传 Promise：业务层用 `() => import('./schemas')` 动态取，
   * 保证 zod 只在开发环境被下载（生产构建里 `import.meta.env.DEV`
   * 被静态替换成 false，整条分支连同动态 chunk 一起消失）。
   *
   * 目的：把「后端字段改名导致前端静默渲染 undefined」这类问题
   * 在开发期就变成显式报错，而不是等用户看到空白。
   */
  schema?: ResponseSchema<unknown> | Promise<ResponseSchema<unknown> | undefined | void>
}

/** 只依赖 `safeParse` 的最小结构契约，便于兼容任意 zod 版本 */
export interface ResponseSchema<T> {
  safeParse: (
    input: unknown,
  ) =>
    { success: true; data: T } | { success: false; error: { issues: unknown[]; message?: string } }
}

type Interceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>
type ResponseInterceptor = (response: Response, config: RequestConfig) => void | Promise<void>

/** 所有注册函数都返回「注销函数」——避免 StrictMode / HMR 下重复注册 */
export type Unregister = () => void

const requestInterceptors: Interceptor[] = []
const responseInterceptors: ResponseInterceptor[] = []
const errorHandlers: Array<(error: ApiError) => void> = []

function removeFrom<T>(list: T[], target: T) {
  const index = list.indexOf(target)
  if (index >= 0) list.splice(index, 1)
}

/**
 * 接口基地址
 *
 * - 配了 `VITE_API_BASE` 就用它（可写绝对地址，也可写 `/api` 这类同源前缀）
 * - 没配时回退到 `/api`：开发期由内置 Mock 接管，生产期由网关 / 反向代理转发
 *
 * 之前这里写死 `'/api'`，README 与文档站却在教用户改 `VITE_API_BASE`——
 * 两边不一致会让「照着文档接后端」的人白排查一轮，所以这里真正读环境变量。
 */
export const DEFAULT_BASE_URL: string =
  (import.meta.env.VITE_API_BASE as string | undefined)?.trim() || '/api'

/** 注册请求拦截器（如注入 token）。返回注销函数。 */
export function addRequestInterceptor(fn: Interceptor): Unregister {
  requestInterceptors.push(fn)
  return () => removeFrom(requestInterceptors, fn)
}

/** 注册响应拦截器（如统一日志）。返回注销函数。 */
export function addResponseInterceptor(fn: ResponseInterceptor): Unregister {
  responseInterceptors.push(fn)
  return () => removeFrom(responseInterceptors, fn)
}

/** 注册全局错误处理（如 toast）。返回注销函数。 */
export function addErrorHandler(fn: (error: ApiError) => void): Unregister {
  errorHandlers.push(fn)
  return () => removeFrom(errorHandlers, fn)
}

/** 仅供测试使用：清空全部注册，避免用例之间互相污染 */
export function resetHttpInterceptors() {
  requestInterceptors.length = 0
  responseInterceptors.length = 0
  errorHandlers.length = 0
}

function buildURL(path: string, config: RequestConfig): string {
  const base = (config.baseURL ?? DEFAULT_BASE_URL).replace(/\/$/, '')
  const cleanPath = path.replace(/^\//, '')
  const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
  const url = new URL(`${base}/${cleanPath}`, origin)
  if (config.params) {
    for (const [key, value] of Object.entries(config.params)) {
      if (value === undefined || value === null || value === '') continue
      if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, String(v)))
      else url.searchParams.set(key, String(value))
    }
  }
  /**
   * 绝对地址（跨域后端）必须原样返回 host
   *
   * 旧实现无条件 `pathname + search`，等于把 `VITE_API_BASE=https://api.x.com`
   * 静默降级成「请求当前站点根路径」——照着文档接后端的人会看到 404，
   * 却以为是后端没起。这里按 base 是否带协议区分：跨域走完整 URL，同源仍走相对路径
   * （相对路径不会触发预检，Mock 层也只认 `/api/` 前缀）。
   */
  return /^https?:\/\//i.test(base) ? url.toString() : url.pathname + url.search
}

async function request<T>(path: string, config: RequestConfig = {}): Promise<T> {
  let finalConfig: RequestConfig = {
    ...config,
    headers: {
      Accept: 'application/json',
      ...(config.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...config.headers,
    },
  }

  for (const interceptor of requestInterceptors) {
    finalConfig = await interceptor(finalConfig)
  }

  const controller = new AbortController()
  const timeout = finalConfig.timeout ?? 15_000
  const timer = setTimeout(() => controller.abort(), timeout)
  const externalSignal = finalConfig.signal
  externalSignal?.addEventListener('abort', () => controller.abort(), { once: true })

  try {
    const response = await fetch(buildURL(path, finalConfig), {
      ...finalConfig,
      signal: controller.signal,
      body: finalConfig.body === undefined ? undefined : JSON.stringify(finalConfig.body),
    })

    for (const interceptor of responseInterceptors) {
      await interceptor(response, finalConfig)
    }

    const contentType = response.headers.get('content-type') ?? ''
    const payload = contentType.includes('application/json')
      ? ((await response.json()) as { data?: T; code?: number; message?: string; traceId?: string })
      : ((await response.text()) as unknown as T)

    if (!response.ok) {
      const shape: ApiErrorShape = {
        code: response.status,
        message:
          (typeof payload === 'object' &&
            payload &&
            'message' in payload &&
            String(payload.message)) ||
          tStatic('http.failed', { status: response.status }),
        detail: payload,
      }
      throw new ApiError(shape)
    }

    // 兼容 { code, message, data } 与裸数据两种后端风格
    const data = (
      payload && typeof payload === 'object' && 'data' in payload
        ? (payload as { data: unknown }).data
        : payload
    ) as T

    // 开发期响应结构校验：字段缺失/改名在这里就炸，而不是到渲染层渲染 undefined
    if (import.meta.env.DEV && finalConfig.schema) {
      const schema = await finalConfig.schema
      if (schema) {
        const parsed = schema.safeParse(data)
        if (!parsed.success) {
          throw new ApiError({
            code: 0,
            message: tStatic('http.badSchema', { path }),
            detail: parsed.error,
          })
        }
        return parsed.data as T
      }
    }
    return data
  } catch (error) {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError({
            code: (error as { name?: string }).name === 'AbortError' ? 408 : 0,
            message:
              (error as { name?: string }).name === 'AbortError'
                ? finalConfig.signal?.aborted
                  ? tStatic('http.cancelled')
                  : tStatic('http.timeout')
                : (error as Error).message || tStatic('http.network'),
            detail: error,
          })
    // 调用方主动取消（组件卸载 / 搜索防抖 / 路由切换）不应弹toast
    const cancelled = finalConfig.signal?.aborted === true && apiError.code !== 401
    if (!config.silent && !cancelled) errorHandlers.forEach((handler) => handler(apiError))
    throw apiError
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  get: <T>(path: string, config?: RequestConfig) => request<T>(path, { ...config, method: 'GET' }),
  post: <T>(path: string, body?: unknown, config?: RequestConfig) =>
    request<T>(path, { ...config, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, config?: RequestConfig) =>
    request<T>(path, { ...config, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, config?: RequestConfig) =>
    request<T>(path, { ...config, method: 'PATCH', body }),
  delete: <T>(path: string, config?: RequestConfig) =>
    request<T>(path, { ...config, method: 'DELETE' }),
}

/** 分页响应结构 */
export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/** 通用列表查询参数 */
export interface ListParams {
  page?: number
  pageSize?: number
  keyword?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  [key: string]: unknown
}
