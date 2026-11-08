import { describe, expect, it } from 'vitest'
import { callApiTool, listApisTool } from '../tools'
import type { AssistantApiOperation, ToolContext } from '../types'

/**
 * call_api 的 id 归一化
 *
 * 真实模型经常把工具名 `api_user_list` 或中文标题当成 id 传回来 ——
 * 这里把三类同义输入都钉住，避免以后「换个模型就失效」。
 */

const OPERATIONS: AssistantApiOperation[] = [
  {
    id: 'user_list',
    title: '用户列表',
    description: '分页查询用户',
    method: 'GET',
    path: '/users',
    params: { keyword: '关键字' },
  },
  {
    id: 'user_stats',
    title: '用户统计',
    description: '用户统计',
    method: 'GET',
    path: '/users/stats',
  },
]

function context(): ToolContext & {
  calls: Array<{ id: string; input?: Record<string, unknown> }>
} {
  const calls: Array<{ id: string; input?: Record<string, unknown> }> = []
  return {
    session: { messages: [], locale: 'zh-CN' },
    api: {
      list: () => OPERATIONS,
      call: async (id, input) => {
        calls.push({ id, input })
        return { ok: true, data: { items: [1, 2], total: 2 } }
      },
    },
    emit: () => undefined,
    calls,
  }
}

describe('call_api 的 id 容错', () => {
  it('接受原始 id', async () => {
    const ctx = context()
    const outcome = await callApiTool.run({ id: 'user_list' }, ctx)
    expect(outcome.kind).toBe('data')
    expect(ctx.calls[0]?.id).toBe('user_list')
  })

  it('接受工具名 api_ 前缀', async () => {
    const ctx = context()
    const outcome = await callApiTool.run({ id: 'api_user_list' }, ctx)
    expect(outcome.kind).toBe('data')
    expect(ctx.calls[0]?.id).toBe('user_list')
  })

  it('接受中文标题', async () => {
    const ctx = context()
    const outcome = await callApiTool.run({ id: '用户统计' }, ctx)
    expect(outcome.kind).toBe('data')
    expect(ctx.calls[0]?.id).toBe('user_stats')
  })

  it('未知 id 时列出可用项并给出重试建议', async () => {
    const ctx = context()
    const outcome = await callApiTool.run({ id: 'api_unknown' }, ctx)
    expect(outcome.kind).toBe('api')
    expect(outcome.summary).toContain('user_list')
    expect(outcome.suggestions?.length).toBeGreaterThan(0)
    expect(ctx.calls).toHaveLength(0)
  })
})

describe('list_api_operations', () => {
  it('空清单给出登记指引', async () => {
    const outcome = await listApisTool.run(
      {},
      {
        session: { messages: [], locale: 'zh-CN' },
        api: { list: () => [], call: async () => ({ ok: true }) },
        emit: () => undefined,
      },
    )
    expect(outcome.summary).toContain('registerAssistantApi')
  })
})
