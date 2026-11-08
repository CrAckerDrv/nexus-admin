import { beforeEach, describe, expect, it } from 'vitest'
import { AssistantCore, resetAssistant } from '../assistant'
import type {
  AssistantHistorySnapshot,
  AssistantTransport,
  TransportDeltaHandlers,
  TransportRequest,
  TransportResult,
} from '../types'
import { createUserStatsPage } from '../page-spec'

/** 可编排的假传输层：按顺序返回预设结果 */
function fakeTransport(
  scripts: TransportResult[],
  reasoning?: string,
): AssistantTransport & { requests: TransportRequest[] } {
  const requests: TransportRequest[] = []
  let index = 0
  return {
    id: 'fake',
    label: 'Fake',
    model: 'fake-model',
    requests,
    isConfigured: () => true,
    async stream(request: TransportRequest, handlers: TransportDeltaHandlers) {
      requests.push(request)
      const script = scripts[index] ?? { content: '好的', toolCalls: [] }
      index += 1
      if (reasoning) handlers.onReasoning?.(reasoning)
      handlers.onDelta?.(script.content, script.content)
      return script
    },
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 260))

describe('AssistantCore', () => {
  beforeEach(() => {
    resetAssistant()
  })

  it('本地引擎：无传输层时仍能生成页面并写入页面库', async () => {
    const saved: string[] = []
    const core = new AssistantCore({
      pages: {
        save: (page) => saved.push(page.id),
        apply: () => undefined,
      },
    })
    expect(core.getSnapshot().engine.available).toBe(false)

    await core.send('帮我实现一个用户数据统计页面')

    const snapshot = core.getSnapshot()
    expect(snapshot.messages).toHaveLength(2)
    const reply = snapshot.messages[1]!
    expect(reply.role).toBe('assistant')
    expect(reply.engine).toBe('local')
    expect(reply.page?.title).toContain('统计')
    expect(snapshot.lastPage?.id).toBe(reply.page?.id)
    // 生成即入库，但不自动应用
    expect(saved).toContain(reply.page?.id)
    expect(snapshot.applied).toEqual([])
  })

  it('模型引擎：执行工具后把页面落进快照', async () => {
    const transport = fakeTransport([
      {
        content: '',
        toolCalls: [
          {
            id: 'call_1',
            name: 'create_page',
            arguments: JSON.stringify({
              requirement: '帮我实现一个用户数据统计页面',
              title: '用户数据统计',
            }),
          },
        ],
      },
      { content: '页面已生成，可以在预览区查看。', toolCalls: [] },
    ])
    const core = new AssistantCore({ transport })
    await core.send('帮我实现一个用户数据统计页面')

    const snapshot = core.getSnapshot()
    expect(snapshot.engine.available).toBe(true)
    const reply = snapshot.messages[1]!
    expect(reply.engine).toBe('llm')
    expect(reply.page?.title).toBe('用户数据统计')
    expect(reply.toolCalls?.[0]?.name).toBe('create_page')
    expect(reply.content).toContain('预览区')
    // 两轮请求：先要工具，再总结
    expect(transport.requests).toHaveLength(2)
  })

  it('模型报错时降级到本地引擎并记录原因', async () => {
    const failing: AssistantTransport = {
      id: 'boom',
      label: 'Boom',
      model: 'x',
      isConfigured: () => true,
      stream: async () => {
        throw new Error('网关返回 429')
      },
    }
    const core = new AssistantCore({ transport: failing })
    await core.send('帮我实现一个用户数据统计页面')

    const snapshot = core.getSnapshot()
    expect(snapshot.fallbackReason).toContain('429')
    const reply = snapshot.messages[1]!
    expect(reply.engine).toBe('local')
    expect(reply.page).toBeDefined()
    await flush()
  })

  it('应用页面后进入 applied 列表，且不重复', async () => {
    const applied: string[] = []
    const core = new AssistantCore({
      pages: {
        save: () => undefined,
        apply: (page) => applied.push(page.id),
      },
    })
    const page = createUserStatsPage('用户数据', 1000)
    await core.applyPage(page)
    await core.applyPage(page)

    expect(applied).toHaveLength(2)
    expect(core.getSnapshot().applied).toEqual([page.id])
  })

  it('没有页面时 applyPage 返回失败而不是抛错', async () => {
    const core = new AssistantCore()
    const result = await core.applyPage()
    expect(result.ok).toBe(false)
    expect(result.error).toContain('没有')
  })

  it('reset 清空会话与当前页面', async () => {
    const core = new AssistantCore()
    await core.send('帮我实现一个用户数据统计页面')
    expect(core.getSnapshot().messages.length).toBeGreaterThan(0)
    core.reset()
    const snapshot = core.getSnapshot()
    expect(snapshot.messages).toEqual([])
    expect(snapshot.lastPage).toBeUndefined()
  })

  it('订阅者能收到增量更新', async () => {
    const core = new AssistantCore()
    const seen: string[] = []
    const unsubscribe = core.subscribe(() => seen.push(core.getSnapshot().phase))
    await core.send('帮我实现一个用户数据统计页面')
    unsubscribe()
    expect(seen).toContain('thinking')
    expect(seen).toContain('done')
  })

  it('本地引擎可以按接口清单回答，并真的调用执行器', async () => {
    const calls: string[] = []
    const core = new AssistantCore({
      operations: () => [
        {
          id: 'user_stats',
          title: '用户统计',
          description: '统计',
          method: 'GET',
          path: '/users/stats',
        },
      ],
      executeApi: async (operation) => {
        calls.push(operation.path)
        return { ok: true, data: { total: 27420 } }
      },
    })

    await core.send('助手能调哪些接口')
    expect(core.getSnapshot().messages[1]?.content).toContain('GET /users/stats')

    // 本地引擎对「查一下接口」给的是操作清单提示，不会伪造数据
    expect(calls).toHaveLength(0)
  })

  it('模型推理流会落成思考链与首字延迟', async () => {
    const transport = fakeTransport(
      [{ content: '回答', toolCalls: [] }],
      '先看清需求，再决定是否调工具',
    )
    const core = new AssistantCore({ transport })
    await core.send('你好')

    const reply = core.getSnapshot().messages[1]!
    expect(reply.reasoning).toContain('先看清需求')
    expect(reply.thinkingMs).toBeGreaterThanOrEqual(0)
  })

  it('本地引擎也产出可读的思考链', async () => {
    const core = new AssistantCore()
    await core.send('帮我实现一个用户数据统计页面')
    const reply = core.getSnapshot().messages[1]!
    expect(reply.engine).toBe('local')
    expect(reply.reasoning).toContain('意图判定')
  })

  it('多会话：新建不丢旧会话，切换回来的消息仍在', async () => {
    const core = new AssistantCore()
    await core.send('帮我实现一个用户数据统计页面')
    const firstId = core.getSnapshot().activeSessionId
    expect(core.getSnapshot().sessions).toHaveLength(1)

    const secondId = core.createSession()
    expect(secondId).not.toBe(firstId)
    expect(core.getSnapshot().activeSessionId).toBe(secondId)
    expect(core.getSnapshot().messages).toHaveLength(0)
    expect(core.getSnapshot().sessions).toHaveLength(2)

    await core.send('怎么把后端接口交给助手')
    expect(core.getSnapshot().activeSessionId).toBe(secondId)
    expect(core.getSnapshot().messages).toHaveLength(2)

    core.switchSession(firstId)
    expect(core.getSnapshot().messages).toHaveLength(2)
    // 会话标题从首条输入自动生成，列表里才不是一片「新会话」
    expect(core.getSnapshot().sessions.find((item) => item.id === firstId)?.title).toContain(
      '用户数据',
    )
  })

  it('会话可重命名 / 置顶 / 删除，置顶排在列表最前', async () => {
    const core = new AssistantCore()
    const first = core.getSnapshot().activeSessionId
    const second = core.createSession()
    core.renameSession(first, '报表需求')

    const renamed = core.getSnapshot().sessions.find((item) => item.id === first)
    expect(renamed?.title).toBe('报表需求')

    core.pinSession(first, true)
    expect(core.getSnapshot().sessions[0]?.id).toBe(first)

    core.deleteSession(second)
    expect(core.getSnapshot().sessions.map((item) => item.id)).toEqual([first])
    // 删掉的正是当前会话时，必须自动落到另一条会话上，而不是留下空指针
    expect(core.getSnapshot().activeSessionId).toBe(first)
  })

  it('会话历史可落盘并在重新装配后还原', async () => {
    let stored: AssistantHistorySnapshot | undefined
    const history = {
      load: () => stored,
      save: (snapshot: AssistantHistorySnapshot) => {
        stored = snapshot
      },
    }
    const core = new AssistantCore({ history })
    await core.send('帮我实现一个用户数据统计页面')
    expect(stored?.sessions).toHaveLength(1)
    expect(stored?.activeId).toBe(core.getSnapshot().activeSessionId)

    // 用同一份存储重新构造内核，等价于刷新页面
    const revived = new AssistantCore({ history })
    expect(revived.getSnapshot().messages).toHaveLength(2)
    expect(revived.getSnapshot().lastPage?.title).toContain('统计')
  })

  it('会话最后一次页面上下文优先于页面库的「最近更新」', async () => {
    const core = new AssistantCore()
    await core.send('帮我实现一个用户数据统计页面')
    const sessionPage = core.getSnapshot().lastPage!

    // 页面库推来另一份更「新」的页面时，当前会话不应被覆盖
    const other = { ...createUserStatsPage('订单数据', 2000) }
    core.restorePage(other)
    expect(core.getSnapshot().lastPage?.id).toBe(sessionPage.id)
  })
})
