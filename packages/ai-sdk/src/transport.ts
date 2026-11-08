import type {
  AssistantTransport,
  ChatMessage,
  ToolDescriptor,
  TransportDeltaHandlers,
  TransportRequest,
  TransportResult,
} from './types'

/**
 * 传输层：OpenAI Chat Completions 兼容实现
 *
 * 为什么只做这一种协议：
 * - OpenCode / DeepSeek / Moonshot / Ollama / vLLM / 自建网关 几乎都兼容
 *   `POST {baseUrl}/chat/completions`，一份实现覆盖绝大多数客户
 * - 需要换协议（Anthropic Messages / Responses）时，实现 `AssistantTransport`
 *   接口即可挂进来，助手本身不需要改
 *
 * 关键点：**工具调用是流式分片返回的**。`tool_calls[].function.arguments`
 * 会按 index 分多次到达，必须按 index 累积后再解析，否则会拿到半截 JSON。
 */

export interface OpenAICompatibleConfig {
  /** 传输标识（界面上展示） */
  id?: string
  label?: string
  /** 例如 https://opencode.ai/inference/openai/v1 */
  baseUrl: string
  model: string
  apiKey?: string
  /** 额外请求头（例如代理需要的鉴权、租户号） */
  headers?: Record<string, string>
  /** 会话 id：OpenCode 用它做粘性路由与提示缓存 */
  sessionId?: string
  temperature?: number
}

interface StreamChoiceDelta {
  content?: string | null
  reasoning_content?: string | null
  reasoning?: string | null
  tool_calls?: Array<{
    index?: number
    id?: string
    type?: string
    function?: { name?: string; arguments?: string }
  }>
}

interface StreamChunk {
  model?: string
  choices?: Array<{ delta?: StreamChoiceDelta; finish_reason?: string | null }>
  error?: { message?: string; type?: string; code?: string }
}

/** 把 SDK 的对话消息翻译成 OpenAI 报文 */
export function toWireMessages(messages: ChatMessage[]): Record<string, unknown>[] {
  return messages.map((message) => {
    if (message.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: message.toolCallId,
        content: message.content,
      }
    }
    if (message.role === 'assistant' && message.toolCalls?.length) {
      return {
        role: 'assistant',
        content: message.content || null,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: call.arguments },
        })),
      }
    }
    return { role: message.role, content: message.content }
  })
}

/** 工具描述 → OpenAI function 定义 */
export function toWireTools(tools: ToolDescriptor[]): Record<string, unknown>[] | undefined {
  if (!tools.length) return undefined
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }))
}

/** 按 `data:` 行解析 SSE；兼容 `\r\n` 与跨 chunk 断行 */
function parseSSELines(buffer: string): { events: string[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, '\n')
  const parts = normalized.split('\n')
  const rest = parts.pop() ?? ''
  const events: string[] = []
  for (const line of parts) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith(':')) continue
    if (!trimmed.startsWith('data:')) continue
    const payload = trimmed.slice(5).trim()
    if (payload) events.push(payload)
  }
  return { events, rest }
}

export function createOpenAICompatibleTransport(
  config: OpenAICompatibleConfig,
): AssistantTransport {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const label = config.label ?? 'OpenAI 兼容网关'

  return {
    id: config.id ?? 'openai-compatible',
    label,
    model: config.model,
    isConfigured: () => Boolean(baseUrl && config.model),
    async stream(
      request: TransportRequest,
      handlers: TransportDeltaHandlers,
    ): Promise<TransportResult> {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...config.headers,
      }
      if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`
      if (config.sessionId) headers['x-opencode-session'] = config.sessionId

      const body: Record<string, unknown> = {
        model: config.model,
        messages: toWireMessages(request.messages),
        stream: true,
        temperature: request.temperature ?? config.temperature ?? 0.4,
      }
      const tools = toWireTools(request.tools)
      if (tools) {
        body.tools = tools
        body.tool_choice = 'auto'
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: request.signal,
      })

      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        throw new TransportError(
          `网关返回 ${response.status}：${summarizeError(detail) || response.statusText}`,
          response.status,
        )
      }
      if (!response.body) throw new TransportError('网关未返回流式响应体')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let content = ''
      let model = config.model
      const toolAccumulator = new Map<number, { id: string; name: string; arguments: string }>()

      const flushEvent = (payload: string) => {
        if (payload === '[DONE]') return
        let chunk: StreamChunk
        try {
          chunk = JSON.parse(payload) as StreamChunk
        } catch {
          return
        }
        if (chunk.error?.message) throw new TransportError(chunk.error.message)
        if (chunk.model) model = chunk.model
        const delta = chunk.choices?.[0]?.delta
        if (!delta) return

        const reasoning = delta.reasoning_content ?? delta.reasoning
        if (reasoning && handlers.onReasoning) handlers.onReasoning(reasoning)

        if (typeof delta.content === 'string' && delta.content) {
          content += delta.content
          handlers.onDelta?.(delta.content, content)
        }

        for (const call of delta.tool_calls ?? []) {
          const index = call.index ?? 0
          const current = toolAccumulator.get(index) ?? { id: '', name: '', arguments: '' }
          if (call.id) current.id = call.id
          if (call.function?.name) current.name += call.function.name
          if (call.function?.arguments) current.arguments += call.function.arguments
          toolAccumulator.set(index, current)
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const { events, rest } = parseSSELines(buffer)
        buffer = rest
        for (const event of events) flushEvent(event)
      }
      // 收尾：处理最后一段没有换行结尾的事件
      if (buffer.trim().startsWith('data:')) flushEvent(buffer.trim().slice(5).trim())

      return {
        content,
        model,
        toolCalls: [...toolAccumulator.entries()]
          .sort(([a], [b]) => a - b)
          .map(([index, call]) => ({
            id: call.id || `call_${index}`,
            name: call.name,
            arguments: call.arguments || '{}',
          }))
          .filter((call) => call.name),
      }
    },
  }
}

/** 网关错误体：尽量取出人类可读的一句 */
function summarizeError(raw: string): string {
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } | string; message?: string }
    if (typeof parsed.error === 'string') return parsed.error
    if (parsed.error?.message) return parsed.error.message
    if (parsed.message) return parsed.message
  } catch {
    /* 纯文本错误体 */
  }
  return raw.slice(0, 200)
}

export class TransportError extends Error {
  readonly status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'TransportError'
    this.status = status
  }
}
