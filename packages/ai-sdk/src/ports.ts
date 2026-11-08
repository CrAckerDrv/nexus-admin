import type { PageSpec } from './page-spec'
import type { AssistantApiResult } from './types'

/**
 * 宿主应用端口
 *
 * SDK 不直接触碰路由 / localStorage / 侧边栏 —— 这些都是「应用的事」。
 * 应用实现这几个回调，助手就能把生成的页面真正落到项目里。
 */
export interface PagePort {
  /** 保存或更新页面（持久化由应用负责） */
  save: (page: PageSpec) => void
  /** 应用到项目：写入侧边栏 + 生成路由 */
  apply: (page: PageSpec) => void
  /** 应用内跳转（不传则退化为 window.location） */
  open?: (path: string) => void
  /** 当前页面是否已应用（用于按钮文案） */
  isApplied?: (id: string) => boolean
}

/** 默认接口执行器：应用注入（通常是 core/http 的 api 客户端） */
export type ApiExecutor = (
  operation: { method: string; path: string; body?: unknown; params?: Record<string, unknown> },
  input: Record<string, unknown>,
) => Promise<AssistantApiResult>

export interface AssistantRuntimeOptions {
  /** 页面落地端口 */
  pages?: PagePort
  /** 默认接口执行器（未在 operation.run 里自定义时使用） */
  executeApi?: ApiExecutor
  /** 当前语言 */
  locale?: () => string
  /** 需要跳转时由应用注入 */
  navigate?: (path: string) => void
}
