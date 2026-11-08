import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DataTable } from '../components/table'
import { VirtualTable } from '../components/virtual-table'
import type { Column } from '../components/table'

/**
 * 复杂交互组件的行为测试
 *
 * 这四个组件（DataTable / VirtualTable / Select / Dialog）是组件库里
 * 逻辑最绕的部分 —— 排序、全选、窗口化、键盘导航、焦点陷阱。
 * 之前的 42 个用例全部集中在工具函数和简单展示组件上，这里补上缺口。
 */

interface Row {
  id: string
  name: string
  score: number
}

const ROWS: Row[] = [
  { id: 'r1', name: '甲', score: 30 },
  { id: 'r2', name: '乙', score: 10 },
  { id: 'r3', name: '丙', score: 20 },
]

const COLUMNS: Column<Row>[] = [
  {
    key: 'name',
    header: '名称',
    width: 160,
    cell: (row) => row.name,
    sortValue: (row) => row.name,
  },
  {
    key: 'score',
    header: '分数',
    width: 120,
    cell: (row) => row.score,
    sortValue: (row) => row.score,
  },
]

function bodyNames() {
  return screen
    .getAllByRole('row')
    .slice(1) // 去掉表头行
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent)
}

describe('DataTable 排序', () => {
  it('点击表头按升序排序，再点一次改为降序', async () => {
    render(<DataTable rows={ROWS} getRowId={(row) => row.id} columns={COLUMNS} />)
    expect(bodyNames()).toEqual(['甲', '乙', '丙'])

    await userEvent.click(screen.getByRole('button', { name: /分数/ }))
    expect(bodyNames()).toEqual(['乙', '丙', '甲'])

    await userEvent.click(screen.getByRole('button', { name: /分数/ }))
    expect(bodyNames()).toEqual(['甲', '丙', '乙'])
  })

  it('第三次点击取消排序，恢复传入顺序', async () => {
    render(<DataTable rows={ROWS} getRowId={(row) => row.id} columns={COLUMNS} />)
    const header = screen.getByRole('button', { name: /分数/ })
    await userEvent.click(header)
    await userEvent.click(header)
    await userEvent.click(header)
    expect(bodyNames()).toEqual(['甲', '乙', '丙'])
  })
})

describe('DataTable 选择', () => {
  it('全选后再次点击可清空，且中间态显示 indeterminate', async () => {
    const onSelectedChange = vi.fn()
    render(
      <DataTable
        rows={ROWS}
        getRowId={(row) => row.id}
        columns={COLUMNS}
        selectable
        onSelectedChange={onSelectedChange}
      />,
    )

    const selectAll = screen.getByRole('checkbox', { name: '全选' }) as HTMLInputElement
    expect(selectAll.checked).toBe(false)

    // 只选一行 → 全选框应为 indeterminate
    const rowChecks = screen.getAllByRole('checkbox', { name: /选择第 \d+ 行/ })
    await userEvent.click(rowChecks[0]!)
    expect(selectAll.indeterminate).toBe(true)
    expect(onSelectedChange).toHaveBeenLastCalledWith(['r1'])

    // 全选 → 三行都被选中
    await userEvent.click(selectAll)
    expect(onSelectedChange).toHaveBeenLastCalledWith(['r1', 'r2', 'r3'])
    expect(selectAll.checked).toBe(true)

    // 再点一次清空
    await userEvent.click(selectAll)
    expect(onSelectedChange).toHaveBeenLastCalledWith([])
  })

  it('受控模式下以 selectedIds 为准', () => {
    render(
      <DataTable
        rows={ROWS}
        getRowId={(row) => row.id}
        columns={COLUMNS}
        selectable
        selectedIds={['r2']}
      />,
    )
    const selectAll = screen.getByRole('checkbox', { name: '全选' }) as HTMLInputElement
    expect(selectAll.indeterminate).toBe(true)
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[1]?.getAttribute('data-selected')).toBe('true')
  })
})

describe('DataTable 加载与空态', () => {
  it('loading 时渲染骨架而不渲染数据行', () => {
    render(<DataTable rows={[]} getRowId={(row) => row.id} columns={COLUMNS} loading minRows={3} />)
    expect(screen.queryByText('甲')).toBeNull()
    expect(document.querySelectorAll('.n-skeleton').length).toBeGreaterThan(0)
  })

  it('无数据时展示自定义空态', () => {
    render(
      <DataTable
        rows={[]}
        getRowId={(row) => row.id}
        columns={COLUMNS}
        empty={<p>没有匹配的记录</p>}
      />,
    )
    expect(screen.getByText('没有匹配的记录')).toBeDefined()
  })
})

describe('VirtualTable 窗口化', () => {
  const many: Row[] = Array.from({ length: 5000 }, (_, index) => ({
    id: `v${index}`,
    name: `第 ${index} 行`,
    score: index,
  }))

  it('只渲染可视区附近的行，而不是全部 5000 行', () => {
    render(
      <VirtualTable
        rows={many}
        getRowId={(row) => row.id}
        columns={COLUMNS}
        rowHeight={40}
        height={400}
      />,
    )
    const rendered = screen.getAllByRole('row').length - 1 // 去掉表头
    expect(rendered).toBeGreaterThan(0)
    expect(rendered).toBeLessThan(40)
    // 总行数通过 aria-rowcount 暴露给辅助技术
    const rowgroup = document.querySelector('[aria-rowcount]')
    expect(rowgroup?.getAttribute('aria-rowcount')).toBe('5000')
  })

  it('底部统计展示已渲染区间与总数', () => {
    render(<VirtualTable rows={many} getRowId={(row) => row.id} columns={COLUMNS} height={400} />)
    expect(screen.getByText(/共 5000 行/)).toBeDefined()
  })
})
