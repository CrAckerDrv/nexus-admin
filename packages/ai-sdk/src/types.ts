/**
 * Nexus AI SDK · 核心契约
 *
 * 这个包是「助手能力的边界」，刻意不依赖 React / UI 组件库 / 具体后端：
 * 业务项目只要实现或传入选定的 transport 与工具，就能复用同一套对话协议。
 */

import type { PageSpec } from './page-spec'

/* ------------------------------------------------------------------ *
 * 消息与会话
 * ------------------------------------------------------------------ */

export type AssistantEngine = 'llm' | 'local'
export type MessageStatus = 'streaming' | 'done' | 'error' | 'aborted'

/** 工具调用记录（一次请求里可能有多条） */
export interface ToolCallRecord {
  id: string
  name: string
  /** 模型给出的原始参数（JSON 字符串，保留以便排查） */
  rawArguments: string
  /** 解析后的参数；解析失败时为 undefined */
  input?: Record<string, unknown>
  outcome?: ToolOutcome
  error?: string
  startedAt: number
  finishedAt?: number
}

export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  status: MessageStatus
  engine?: AssistantEngine
  model?: string
  /** 本轮触发的工具 */
  toolCalls?: ToolCallRecord[]
  /**
   * 思考链
   *
   * 模型侧来自网关的 `reasoning_content`；本地引擎则写入规划器识别到的意图与选型。
   * 界面默认折叠，展开后可看到「模型在动手之前想了什么」。
   */
  reasoning?: string
  /** 首个可见输出之前的等待时长（ms）：思考链的价值感主要由它撑起来 */
  thinkingMs?: number
  /** 本轮生成/修改的页面规格 */
  page?: PageSpec
  /** 建议的下一句（渲染成快捷胶囊） */
  suggestions?: string[]
  /** 失败原因（同时作为降级说明） */
  error?: string
  /** 端到端耗时 */
  latencyMs?: number
}

/* ------------------------------------------------------------------ *
 * 多会话
 * ------------------------------------------------------------------ */

/**
 * 会话摘要
 *
 * 只带「列表要显示什么」，不带消息体：
 * 侧栏/抽屉每次渲染都会读它，带上几百条消息会让每次增量更新都变重。
 */
export interface AssistantSessionSummary {
  id: string
  /** 首条用户输入自动命名，也可手动重命名 */
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
  /** 重命名后保持置顶 */
  pinned: boolean
  /** 最近一条消息的单行摘要 */
  preview: string
}

/** 一条完整会话（含消息体，仅用于持久化与内核内部） */
export interface AssistantStoredSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  pinned?: boolean
  messages: AssistantMessage[]
  lastPage?: PageSpec
}

/**
 * 会话持久化端口
 *
 * SDK 不认识 localStorage：由应用注入读写实现（本项目用 zustand persist）。
 * 保存时机是「消息边界」而非每个流式分片 —— 否则每帧都会写一次存储。
 */
export interface AssistantHistorySnapshot {
  activeId: string
  sessions: AssistantStoredSession[]
}

export interface AssistantHistoryPort {
  load: () => AssistantHistorySnapshot | undefined
  save: (state: AssistantHistorySnapshot) => void
}

/* ------------------------------------------------------------------ *
 * 传输层（把任意 LLM 网关翻译成 SDK 需要的形状）
 * ------------------------------------------------------------------ */

/** 发给模型的对话消息（OpenAI Chat Completions 形状，足以覆盖大多数网关） */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  /** assistant 回合里带出的工具调用 */
  toolCalls?: Array<{ id: string; name: string; arguments: string }>
  /** role === 'tool' 时对应的调用 id */
  toolCallId?: string
}

/** 告诉模型「有哪些工具可调」的精简描述 */
export interface ToolDescriptor {
  name: string
  description: string
  parameters: ToolParameterSchema
}

export interface ToolParameterSchema {
  type: 'object'
  properties: Record<string, JsonSchemaProperty>
  required?: string[]
}

export type JsonSchemaProperty = {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description?: string
  enum?: string[]
  items?: JsonSchemaProperty
  /** 对象类型的字段声明 */
  properties?: Record<string, JsonSchemaProperty>
  required?: string[]
  default?: unknown
}

export interface TransportRequest {
  messages: ChatMessage[]
  tools: ToolDescriptor[]
  /** 关闭流式时网关仍需返回完整结果 */
  signal?: AbortSignal
  temperature?: number
}

export interface TransportDeltaHandlers {
  onDelta?: (text: string, fullText: string) => void
  onReasoning?: (text: string) => void
}

export interface TransportResult {
  content: string
  toolCalls: Array<{ id: string; name: string; arguments: string }>
  /** 网关返回的模型名（可用于界面展示） */
  model?: string
}

/**
 * 传输实现
 *
 * `stream()` 必须：边收边通过 `onDelta` 回调，最终 resolve 出完整文本与工具调用。
 * 抛错即视为「本轮不可用」，助手会走本地降级引擎，而不是把会话卡死。
 */
export interface AssistantTransport {
  readonly id: string
  readonly label: string
  readonly model: string
  /** 当前是否具备调用条件（缺 key、缺代理时为 false） */
  isConfigured: () => boolean
  stream: (request: TransportRequest, handlers: TransportDeltaHandlers) => Promise<TransportResult>
}

/* ------------------------------------------------------------------ *
 * 工具
 * ------------------------------------------------------------------ */

/**
 * 工具结果
 *
 * `summary` 会回灌给模型（自然语言），`page` 会被界面直接渲染成预览卡。
 * 因此工具既能服务于「模型」，也能服务于「人」。
 */
export interface ToolOutcome {
  summary: string
  /** 界面卡片形态 */
  kind?: 'text' | 'data' | 'page' | 'guide' | 'api'
  /** 结构化数据（可选项，界面可按 kind 渲染） */
  data?: unknown
  /** 生成或修改后的页面 */
  page?: PageSpec
  /** 后续建议 */
  suggestions?: string[]
}

export interface ToolContext {
  /** SDK 会话（可读取历史、当前页面） */
  session: AssistantSessionView
  /** 应用注入的后端调用入口（见 AssistantApiOperation） */
  api: AssistantApiBridge
  /** 事件通道（工具内部也可上报进度） */
  emit: (event: AssistantEvent) => void
}

export interface AssistantSessionView {
  messages: AssistantMessage[]
  /** 最近一次生成/修改的页面 */
  lastPage?: PageSpec
  /** 当前语言，便于工具产出贴近用户语言的摘要 */
  locale: string
}

export interface AssistantApiBridge {
  /** 已注册的后端操作清单 */
  list: () => AssistantApiOperation[]
  /** 按 id 调用；未注册时抛错 */
  call: (id: string, input?: Record<string, unknown>) => Promise<AssistantApiResult>
}

export interface AssistantApiResult {
  ok: boolean
  status?: number
  data?: unknown
  error?: string
  /** 耗时（ms） */
  elapsedMs?: number
}

/**
 * 交给助手的后端操作
 *
 * 这是「客户如何把后端接口交给助手」的答案：声明一条操作，助手即可读取/调用它。
 * `run` 可省略 —— 省略时走应用注入的 `execute` 函数（默认是 `core/http` 的 api 客户端）。
 */
export interface AssistantApiOperation {
  /** 工具名后缀：`api_<id>`，仅允许字母数字与下划线 */
  id: string
  title: string
  description: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  /** 参数说明：{ keyword: '按姓名/邮箱搜索' } */
  params?: Record<string, string>
  /** 请求体示例（POST/PUT/PATCH），同时作为模型可参照的字段说明 */
  body?: Record<string, unknown>
  /** 是否写操作（界面会加二次确认标记） */
  mutating?: boolean
  /** 自定义执行器；不提供则使用应用注入的默认执行器 */
  run?: (input: Record<string, unknown>) => Promise<unknown>
}

/* ------------------------------------------------------------------ *
 * 事件
 * ------------------------------------------------------------------ */

export type AssistantEvent =
  | { type: 'session-reset' }
  /** 切换到另一条会话（多会话） */
  | { type: 'session-switch'; id: string }
  | { type: 'assistant-start'; id: string; engine: AssistantEngine; model?: string }
  | { type: 'assistant-delta'; id: string; text: string }
  /** 思考链增量（模型推理流） */
  | { type: 'assistant-reasoning'; id: string; text: string }
  | { type: 'tool-start'; id: string; call: ToolCallRecord }
  | { type: 'tool-end'; id: string; call: ToolCallRecord }
  | { type: 'page'; id: string; page: PageSpec }
  | { type: 'assistant-end'; id: string; message: AssistantMessage }
  | { type: 'engine-fallback'; reason: string }
  | { type: 'error'; id: string; message: string }
