import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../components/button'
import { Badge } from '../components/badge'
import { BannerCard, HeroBanner } from '../components/banner'
import { Switch } from '../components/toggle'
import { Progress } from '../components/progress'
import { DataTable, Pagination, pinnedSide } from '../components/table'
import { FormField, Input } from '../components/input'
import { Tree } from '../components/tree'
import type { Column } from '../components/table'

describe('Button', () => {
  it('渲染文本并响应点击', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>保存</Button>)
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('loading 时禁用且带 aria-busy', () => {
    render(<Button loading>提交</Button>)
    const button = screen.getByRole('button') as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
  })

  it('disabled 时不触发点击', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        禁用
      </Button>,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('Badge', () => {
  it('支持 tone 变体', () => {
    render(<Badge tone="success">运行中</Badge>)
    expect(screen.getByText('运行中').className).toContain('text-success')
  })
})

describe('Switch', () => {
  it('切换 aria-checked 状态', async () => {
    render(<Switch defaultChecked label="通知" />)
    const control = screen.getByRole('switch')
    expect(control.getAttribute('aria-checked')).toBe('true')
    await userEvent.click(control)
    expect(control.getAttribute('aria-checked')).toBe('false')
  })
})

describe('Progress', () => {
  it('向外暴露进度语义', () => {
    render(<Progress value={40} max={80} />)
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('40')
    expect(bar.getAttribute('aria-valuemax')).toBe('80')
  })
})

describe('Pagination', () => {
  it('计算总页数并翻页', async () => {
    const onChange = vi.fn()
    render(<Pagination page={1} pageSize={10} total={45} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: '下一页' }))
    expect(onChange).toHaveBeenCalledWith(2, 10)
  })

  it('首页时上一页禁用', () => {
    render(<Pagination page={1} pageSize={10} total={45} onChange={() => undefined} />)
    const prev = screen.getByRole('button', { name: '上一页' }) as HTMLButtonElement
    expect(prev.disabled).toBe(true)
  })
})

describe('FormField / Input 无障碍关联', () => {
  it('label 与控件通过 id 关联，错误通过 aria-describedby 下发', () => {
    render(
      <FormField label="用户名" htmlFor="username" error="用户名不能为空">
        <Input id="username" value="" onChange={() => undefined} />
      </FormField>,
    )
    const input = screen.getByLabelText('用户名')
    expect(input.id).toBe('username')
    // FormField 自动把错误节点 id 关联给控件
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).toBe('username-error')
    expect(document.getElementById(describedBy!)?.textContent).toContain('用户名不能为空')
  })

  it('无错误时把 hint 关联为描述', () => {
    render(
      <FormField label="邮箱" htmlFor="email" hint="用于接收通知">
        <Input id="email" value="" onChange={() => undefined} />
      </FormField>,
    )
    const input = screen.getByLabelText('邮箱')
    expect(input.getAttribute('aria-invalid')).toBeNull()
    expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toBe(
      '用于接收通知',
    )
  })

  it('required 同时作用于 label 星号与 aria-required', () => {
    render(
      <FormField label="必填项" htmlFor="req" required>
        <Input id="req" value="" onChange={() => undefined} />
      </FormField>,
    )
    // label 文本里含必填星号，用正则匹配
    expect(screen.getByLabelText(/必填项/).getAttribute('aria-required')).toBe('true')
  })
})

describe('Tree 键盘导航', () => {
  const items = [
    {
      key: 'a',
      title: '节点 A',
      children: [{ key: 'a1', title: '节点 A-1' }],
    },
    { key: 'b', title: '节点 B' },
  ]

  it('向下方向键在可见节点间移动焦点', async () => {
    render(<Tree items={items} defaultExpandAll />)
    const first = document.querySelector('[data-tree-key="a"]') as HTMLElement
    first.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect((document.activeElement as HTMLElement).dataset.treeKey).toBe('a1')
  })

  it('左方向键在已展开节点上执行收起', async () => {
    const onExpandedChange = vi.fn()
    render(<Tree items={items} expandedKeys={['a']} onExpandedChange={onExpandedChange} />)
    const node = document.querySelector('[data-tree-key="a"]') as HTMLElement
    node.focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(onExpandedChange).toHaveBeenCalledWith([])
  })

  it('Enter 选中当前节点', async () => {
    const onSelect = vi.fn()
    render(<Tree items={items} onSelect={onSelect} />)
    const node = document.querySelector('[data-tree-key="a"]') as HTMLElement
    node.focus()
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('a', expect.objectContaining({ key: 'a' }))
  })
})

describe('HeroBanner / BannerCard', () => {
  it('渲染标题、说明与操作区，并暴露标题层级', () => {
    render(
      <HeroBanner
        tone="success"
        title="数据同步已完成"
        description="12 张报表全部更新"
        actions={<Button>查看明细</Button>}
      />,
    )
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('数据同步已完成')
    expect(screen.getByText('12 张报表全部更新')).toBeTruthy()
    expect(screen.getByRole('button', { name: '查看明细' })).toBeTruthy()
  })

  it('children 渲染在描述与按钮之间（slot）', () => {
    const { container } = render(
      <HeroBanner title="标题" description="描述">
        <span data-slot="custom">自定义内容</span>
      </HeroBanner>,
    )
    const slot = container.querySelector('[data-slot="custom"]')
    const description = screen.getByText('描述')
    expect(slot).toBeTruthy()
    // 正文在插槽之前：DOM 顺序即是阅读顺序
    expect(
      description.compareDocumentPosition(slot as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('色调写进 CSS 变量，而不是硬编码颜色', () => {
    const { container } = render(<HeroBanner tone="rose" title="活动" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.style.getPropertyValue('--nb-accent')).toBe('var(--n-chart-5)')
    expect(root.style.getPropertyValue('--nb-bg')).toContain('color-mix')
  })

  it('插画有 alt 时以图片语义暴露，无 alt 时视为装饰', () => {
    const { rerender } = render(<HeroBanner title="插画" image="/a.webp" imageAlt="甜甜圈插画" />)
    expect(screen.getByAltText('甜甜圈插画')).toBeTruthy()

    rerender(<HeroBanner title="插画" image="/a.webp" />)
    expect(screen.queryByAltText('甜甜圈插画')).toBeNull()
    // 装饰图层对读屏隐藏
    expect(document.querySelector('[aria-hidden="true"] img')?.getAttribute('alt')).toBe('')
  })

  it('BannerCard 给了 onClick 才可点击，并支持键盘', async () => {
    const onClick = vi.fn()
    const { rerender } = render(
      <BannerCard title="入口" description="说明" icon={<span>i</span>} onClick={onClick} />,
    )
    const card = screen.getByRole('button', { name: /入口/ })
    await userEvent.click(card)
    expect(onClick).toHaveBeenCalledTimes(1)

    card.focus()
    await userEvent.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(2)

    rerender(<BannerCard title="入口" description="说明" icon={<span>i</span>} />)
    expect(screen.queryByRole('button', { name: /入口/ })).toBeNull()
  })
})

describe('DataTable 固定列', () => {
  const columns: Column<{ id: string; name: string }>[] = [
    { key: 'name', header: '名称', width: 200, cell: (row) => row.name },
    {
      key: 'actions',
      header: '操作',
      width: 100,
      pinned: 'right',
      cell: () => <button type="button">编辑</button>,
    },
  ]

  it('渲染 sticky 定位与固定列类名', () => {
    render(
      <DataTable rows={[{ id: '1', name: '甲' }]} getRowId={(row) => row.id} columns={columns} />,
    )
    const headers = screen.getAllByRole('columnheader')
    const actionHeader = headers[headers.length - 1] as HTMLElement
    expect(actionHeader.style.position).toBe('sticky')
    expect(actionHeader.style.right).toBe('0px')
    expect(actionHeader.className).toContain('n-sticky-head')
    // 未固定列不应产生 sticky
    expect((headers[0] as HTMLElement).style.position).toBe('')
  })

  it('pinned 为 true 时等价于右侧固定', () => {
    expect(pinnedSide({ key: 'x', header: 'X', cell: () => null, pinned: true })).toBe('right')
    expect(pinnedSide({ key: 'x', header: 'X', cell: () => null, pinned: 'left' })).toBe('left')
    expect(pinnedSide({ key: 'x', header: 'X', cell: () => null })).toBeUndefined()
  })
})
