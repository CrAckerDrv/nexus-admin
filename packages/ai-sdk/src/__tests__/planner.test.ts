import { describe, expect, it } from 'vitest'
import {
  detectAccent,
  detectIntent,
  detectShape,
  detectTitle,
  detectTopic,
  planLocally,
} from '../planner'
import { createUserStatsPage } from '../page-spec'

describe('意图识别', () => {
  it('识别「帮我实现一个用户数据统计页面」', () => {
    expect(detectIntent('帮我实现一个用户数据统计页面', false)).toBe('create-page')
    expect(detectIntent('做一份订单分析报表', false)).toBe('create-page')
    expect(detectIntent('生成个运营大屏', false)).toBe('create-page')
  })

  it('没有页面时不把「改成紫色」当成改配色', () => {
    expect(detectIntent('把主色改成紫色', false)).toBe('chat')
    expect(detectIntent('把主色改成紫色', true)).toBe('update-visual')
  })

  it('识别应用、接口与后端说明', () => {
    const page = createUserStatsPage('用户', 1)
    const hasPage = Boolean(page)
    expect(detectIntent('应用到侧边栏', hasPage)).toBe('apply-page')
    expect(detectIntent('助手能调哪些接口', hasPage)).toBe('list-apis')
    expect(detectIntent('怎么把后端接口交给助手', hasPage)).toBe('backend-guide')
    expect(detectIntent('查一下用户列表接口', hasPage)).toBe('call-api')
  })

  it('识别配色 / 圆角 / 密度', () => {
    expect(detectAccent('把主色改成紫色')).toBe('violet')
    expect(detectAccent('用海风那种青蓝色')).toBe('ocean')
    expect(detectShape('圆角再大一点')).toEqual({ radius: 'large' })
    expect(detectShape('用紧凑密度')).toEqual({ density: 'compact' })
    expect(detectShape('直角一些')).toEqual({ radius: 'none' })
  })

  it('从中文句子中抠出标题', () => {
    expect(detectTitle('标题改成经营周报')).toBe('经营周报')
    expect(detectTitle('标题换成「用户增长分析」')).toBe('用户增长分析')
    expect(detectTitle('随便说点什么')).toBeUndefined()
  })

  it('主题词去掉动词与虚词', () => {
    expect(detectTopic('帮我实现一个用户数据统计页面')).toContain('用户数据')
    expect(detectTopic('做一份订单分析报表')).toContain('订单')
  })
})

describe('planLocally', () => {
  it('生成用户统计页并给出下一步建议', () => {
    const outcome = planLocally('帮我实现一个用户数据统计页面')
    expect(outcome.kind).toBe('page')
    expect(outcome.page?.title).toContain('统计')
    expect(outcome.suggestions?.length).toBeGreaterThan(0)
    expect(outcome.summary).toContain('应用到侧边栏')
  })

  it('修改配色时只改 theme，不改区块', () => {
    const base = createUserStatsPage('用户数据', 1000)
    const outcome = planLocally('把主色改成紫色', { lastPage: base })
    expect(outcome.page?.theme.accent).toBe('violet')
    expect(outcome.page?.blocks).toEqual(base.blocks)
    expect(outcome.page?.version).toBe(base.version + 1)
  })

  it('要求加图表时追加一个区块', () => {
    const base = createUserStatsPage('用户数据', 1000)
    const outcome = planLocally('再加一个趋势图', { lastPage: base })
    expect(outcome.page!.blocks.length).toBe(base.blocks.length + 1)
  })

  it('没有登记接口时给出登记指引', () => {
    const outcome = planLocally('助手能调哪些接口', { apiOperations: [] })
    expect(outcome.kind).toBe('guide')
    expect(outcome.summary).toContain('registerAssistantApi')
  })

  it('已登记接口时逐条列出', () => {
    const outcome = planLocally('助手能调哪些接口', {
      apiOperations: [
        { id: 'user_list', title: '用户列表', description: '', method: 'GET', path: '/users' },
      ],
    })
    expect(outcome.summary).toContain('GET /users')
  })

  it('英文环境返回英文摘要', () => {
    const outcome = planLocally('build a user statistics page', { locale: 'en-US' })
    expect(outcome.kind).toBe('page')
    expect(outcome.summary).toMatch(/Generated/)
  })

  it('无法理解的输入给出能力说明而不是报错', () => {
    const outcome = planLocally('今天天气怎么样')
    expect(outcome.kind).toBe('text')
    expect(outcome.suggestions?.length).toBeGreaterThan(0)
  })
})
