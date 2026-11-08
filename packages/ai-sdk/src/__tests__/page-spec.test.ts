import { describe, expect, it } from 'vitest'
import {
  createGenericDashboardPage,
  createUserStatsPage,
  normalizePageSpec,
  normalizePath,
  patchPageSpec,
  MAX_BLOCKS,
  MAX_ROWS,
} from '../page-spec'

describe('normalizePageSpec', () => {
  it('拒绝没有标题或没有区块的输入', () => {
    expect(normalizePageSpec(null)).toBeNull()
    expect(normalizePageSpec({ blocks: [{ kind: 'kpi', items: [] }] })).toBeNull()
    expect(normalizePageSpec({ title: '空页面' })).toBeNull()
  })

  it('收敛非法字段而不是抛错', () => {
    const spec = normalizePageSpec({
      title: '  用户看板  ',
      path: 'javascript:alert(1)',
      icon: 'not-an-icon',
      accent: 'neon',
      blocks: [
        {
          kind: 'chart',
          title: '趋势',
          variant: 'radar',
          categories: ['一', '二'],
          series: [{ name: 'A', data: [1, 2] }],
        },
      ],
      theme: { accent: 'neon', surface: 'weird' },
    })
    expect(spec).not.toBeNull()
    expect(spec!.title).toBe('用户看板')
    expect(spec!.icon).toBe('sparkles')
    expect(spec!.theme.accent).toBeUndefined()
    expect(spec!.theme.surface).toBe('plain')
    // 未支持的图表类型回退成 bar，而不是被丢弃
    const chart = spec!.blocks[0]
    expect(chart?.kind).toBe('chart')
    if (chart?.kind === 'chart') expect(chart.variant).toBe('bar')
    // 路径永远被收敛到 /generated/ 下
    expect(spec!.path.startsWith('/generated/')).toBe(true)
    expect(spec!.path).not.toContain(':')
  })

  it('图表补齐缺失的数据点，避免渲染 undefined', () => {
    const spec = normalizePageSpec({
      title: '补齐',
      blocks: [
        {
          kind: 'chart',
          title: '对比',
          variant: 'line',
          categories: ['1', '2', '3'],
          series: [
            { name: 'A', data: [1, 2, 3] },
            { name: 'B', data: [1] },
          ],
        },
      ],
    })
    const chart = spec!.blocks[0]
    if (chart?.kind !== 'chart') throw new Error('应为图表区块')
    expect(chart.series[1]!.data).toEqual([1, 0, 0])
  })

  it('限制区块数与表格行数', () => {
    const blocks = Array.from({ length: MAX_BLOCKS + 6 }, () => ({
      kind: 'text',
      body: '内容',
    }))
    const spec = normalizePageSpec({ title: '很多区块', blocks })
    expect(spec!.blocks.length).toBe(MAX_BLOCKS)

    const rows = Array.from({ length: MAX_ROWS + 20 }, (_, index) => ({
      name: `第 ${index} 行`,
    }))
    const tableSpec = normalizePageSpec({
      title: '大表',
      blocks: [
        {
          kind: 'table',
          title: '表',
          columns: [{ key: 'name', label: '名称' }],
          rows,
        },
      ],
    })
    const table = tableSpec!.blocks[0]
    if (table?.kind !== 'table') throw new Error('应为表格区块')
    expect(table.rows.length).toBe(MAX_ROWS)
  })
})

describe('normalizePath', () => {
  it('把任意输入收敛成 /generated/<slug>', () => {
    expect(normalizePath('/users/report', 'T')).toBe('/generated/report')
    expect(normalizePath('generated/orders', 'T')).toBe('/generated/orders')
    expect(normalizePath('用户 统计', '用户统计')).toMatch(/^\/generated\//)
    expect(normalizePath('', 'User Stats 2026')).toBe('/generated/user-stats-2026')
  })
})

describe('patchPageSpec', () => {
  it('只改传入的字段，版本号自增', () => {
    const base = createUserStatsPage('用户数据', 1000)
    const next = patchPageSpec(base, { theme: { accent: 'violet' } }, 2000)
    expect(next.title).toBe(base.title)
    expect(next.theme.accent).toBe('violet')
    expect(next.theme.surface).toBe(base.theme.surface)
    expect(next.version).toBe(base.version + 1)
    expect(next.updatedAt).toBe(2000)
  })

  it('非法区块被忽略时保留原区块', () => {
    const base = createUserStatsPage('用户数据', 1000)
    const next = patchPageSpec(base, { blocks: [{ kind: 'unknown' }] }, 2000)
    expect(next.blocks).toEqual(base.blocks)
  })
})

describe('内置模板', () => {
  it('用户统计页包含 KPI / 趋势 / 渠道 / 明细 / 目标', () => {
    const page = createUserStatsPage('用户数据', 1000)
    const kinds = page.blocks.map((block) => block.kind)
    expect(kinds).toContain('kpi')
    expect(kinds.filter((kind) => kind === 'chart').length).toBe(2)
    expect(kinds).toContain('table')
    expect(kinds).toContain('progress')
    expect(page.path).toBe('/generated/user-stats')
  })

  it('通用看板与用户统计页结构不同', () => {
    const generic = createGenericDashboardPage('订单', 1000)
    expect(generic.title).toContain('订单')
    expect(generic.path).toBe('/generated/dashboard')
    expect(generic.blocks.length).toBeGreaterThan(2)
  })
})
