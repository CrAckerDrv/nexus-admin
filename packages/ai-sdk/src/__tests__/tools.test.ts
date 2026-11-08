import { describe, expect, it } from 'vitest'
import { apiOperationTools, BUILTIN_TOOLS, createPageTool, updatePageTool } from '../tools'
import { createUserStatsPage } from '../page-spec'
import type { AssistantApiOperation, ToolContext } from '../types'

function context(operations: AssistantApiOperation[] = []): ToolContext {
  const calls: Array<{ id: string; input?: Record<string, unknown> }> = []
  return {
    session: { messages: [], locale: 'zh-CN' },
    api: {
      list: () => operations,
      call: async (id, input) => {
        calls.push({ id, input })
        return { ok: true, data: { items: [1, 2, 3], total: 3 } }
      },
    },
    emit: () => undefined,
    // @ts-expect-error 仅测试内挂载调用记录
    calls,
  }
}

describe('内置工具', () => {
  it('工具名唯一且都带 JSON Schema', () => {
    const names = BUILTIN_TOOLS.map((tool) => tool.name)
    expect(new Set(names).size).toBe(names.length)
    for (const tool of BUILTIN_TOOLS) {
      expect(tool.descriptor.parameters.type).toBe('object')
      expect(tool.description.length).toBeGreaterThan(10)
    }
  })

  it('create_page 在模型给区块时走自定义规格', async () => {
    const outcome = await createPageTool.run(
      {
        requirement: '做一个订单看板',
        title: '订单看板',
        blocks: [
          {
            kind: 'kpi',
            items: [{ label: '订单数', value: '1,284', delta: 4.2 }],
          },
        ],
      },
      context(),
    )
    expect(outcome.kind).toBe('page')
    expect(outcome.page?.blocks).toHaveLength(1)
    expect(outcome.summary).toContain('订单看板')
  })

  it('create_page 在模型没给区块时用内置模板', async () => {
    const outcome = await createPageTool.run(
      { requirement: '帮我实现一个用户数据统计页面' },
      context(),
    )
    expect(outcome.page?.blocks.length).toBeGreaterThan(3)
    expect(outcome.page?.source).toBe('template')
  })

  it('update_page 没有基准页面时给出引导而不是报错', async () => {
    const outcome = await updatePageTool.run({ accent: 'violet' }, context())
    expect(outcome.kind).toBe('guide')
    expect(outcome.summary).toContain('用户数据统计')
  })

  it('update_page 只改传入字段', async () => {
    const base = createUserStatsPage('用户', 1000)
    const outcome = await updatePageTool.run(
      { accent: 'emerald' },
      { ...context(), session: { messages: [], lastPage: base, locale: 'zh-CN' } },
    )
    expect(outcome.page?.theme.accent).toBe('emerald')
    expect(outcome.page?.blocks).toEqual(base.blocks)
    expect(outcome.summary).toContain('emerald')
  })

  it('注册的接口操作会投影成 api_* 工具并可执行', async () => {
    const operations: AssistantApiOperation[] = [
      {
        id: 'user_list',
        title: '用户列表',
        description: '分页查询',
        method: 'GET',
        path: '/users',
        params: { keyword: '关键字' },
      },
    ]
    const tools = apiOperationTools(operations)
    expect(tools[0]?.name).toBe('api_user_list')
    expect(tools[0]?.descriptor.parameters.properties.keyword).toBeDefined()

    const ctx = context(operations)
    const outcome = await tools[0]!.run({ keyword: '陈' }, ctx)
    expect(outcome.kind).toBe('data')
    expect(outcome.summary).toContain('返回 3 条')
  })
})
