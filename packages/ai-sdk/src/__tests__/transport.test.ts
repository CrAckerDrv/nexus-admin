import { describe, expect, it } from 'vitest'
import { createOpenAICompatibleTransport, toWireMessages, toWireTools } from '../transport'
import type { AssistantTransport, TransportRequest } from '../types'

/** 把一组 SSE 文本包成 fetch Response（含跨分片断行） */
function sseResponse(chunks: string[], init?: ResponseInit): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
    ...init,
  })
}

function stubFetch(response: Response | (() => Response)) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    return typeof response === 'function' ? response() : response
  }) as typeof fetch
  return {
    calls,
    restore: () => {
      globalThis.fetch = original
    },
  }
}

const request: TransportRequest = {
  messages: [{ role: 'user', content: '你好' }],
  tools: [],
}

describe('toWireMessages / toWireTools', () => {
  it('把工具调用与工具结果翻译成 OpenAI 报文', () => {
    const messages = toWireMessages([
      { role: 'system', content: 'sys' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'call_1', name: 'create_page', arguments: '{"a":1}' }],
      },
      { role: 'tool', toolCallId: 'call_1', content: 'ok' },
    ])
    expect(messages[0]).toEqual({ role: 'system', content: 'sys' })
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'call_1', type: 'function' }],
    })
    expect(messages[2]).toEqual({ role: 'tool', tool_call_id: 'call_1', content: 'ok' })
  })

  it('没有工具时省略 tools 字段', () => {
    expect(toWireTools([])).toBeUndefined()
    expect(
      toWireTools([
        { name: 'a', description: 'd', parameters: { type: 'object', properties: {} } },
      ]),
    ).toHaveLength(1)
  })
})

describe('createOpenAICompatibleTransport', () => {
  it('拼装增量文本并按 index 累积工具调用', async () => {
    const stub = stubFetch(
      sseResponse([
        'data: {"model":"m1","choices":[{"delta":{"content":"你"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"好"}}]}\n\ndata: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_a","function":{"name":"cre',
        'ate_page","arguments":"{\\"title\\":"}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"用户\\"}"}}]}}]}\n\n',
        'data: {"choices":[{"finish_reason":"tool_calls"}]}\n\ndata: [DONE]\n\n',
      ]),
    )
    try {
      const transport = createOpenAICompatibleTransport({
        baseUrl: 'https://example.com/v1',
        model: 'm',
        apiKey: 'k',
      })
      const deltas: string[] = []
      const result = await transport.stream(request, {
        onDelta: (chunk) => deltas.push(chunk),
      })
      expect(result.content).toBe('你好')
      expect(result.model).toBe('m1')
      expect(result.toolCalls).toHaveLength(1)
      expect(result.toolCalls[0]).toMatchObject({ id: 'call_a', name: 'create_page' })
      // 关键：分片到达的参数被拼成合法 JSON
      expect(JSON.parse(result.toolCalls[0]!.arguments)).toEqual({ title: '用户' })
      expect(deltas).toEqual(['你', '好'])
    } finally {
      stub.restore()
    }
  })

  it('带 apiKey 时注入鉴权头与会话头', async () => {
    const stub = stubFetch(sseResponse(['data: {"choices":[{"delta":{"content":"ok"}}]}\n\n']))
    try {
      const transport = createOpenAICompatibleTransport({
        baseUrl: 'https://example.com/v1/',
        model: 'm',
        apiKey: 'secret',
        sessionId: 'ses_1',
      })
      await transport.stream(request, {})
      const [call] = stub.calls
      expect(call?.url).toBe('https://example.com/v1/chat/completions')
      const headers = call?.init?.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer secret')
      expect(headers['x-opencode-session']).toBe('ses_1')
    } finally {
      stub.restore()
    }
  })

  it('4xx/5xx 抛出可读错误（含网关 message）', async () => {
    const stub = stubFetch(
      new Response(JSON.stringify({ error: { message: 'Free usage limit reached' } }), {
        status: 429,
      }),
    )
    try {
      const transport = createOpenAICompatibleTransport({
        baseUrl: 'https://example.com/v1',
        model: 'm',
      })
      await expect(transport.stream(request, {})).rejects.toThrow(/Free usage limit reached/)
    } finally {
      stub.restore()
    }
  })

  it('未配置时 isConfigured 为 false', () => {
    const transport: AssistantTransport = createOpenAICompatibleTransport({
      baseUrl: '',
      model: '',
    })
    expect(transport.isConfigured()).toBe(false)
    expect(createOpenAICompatibleTransport({ baseUrl: 'x', model: 'y' }).isConfigured()).toBe(true)
  })
})
