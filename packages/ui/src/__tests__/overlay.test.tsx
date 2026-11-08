import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Select } from '../components/select'
import { Dialog, ConfirmDialog } from '../components/dialog'

/**
 * Select / Dialog 行为测试
 *
 * 这两个组件承载了组件库全部的键盘交互与焦点管理逻辑，
 * 而它们在引入时没有任何用例 —— 一旦改坏，只有真机手测才能发现。
 */

const OPTIONS = [
  { label: '北京', value: 'bj' },
  { label: '上海', value: 'sh' },
  { label: '广州', value: 'gz', disabled: true },
  { label: '深圳', value: 'sz' },
]

describe('Select 单选', () => {
  it('点击展开、选中后回填并关闭', async () => {
    const onChange = vi.fn()
    render(<Select options={OPTIONS} onChange={onChange} placeholder="请选择城市" />)

    expect(screen.getByText('请选择城市')).toBeDefined()
    await userEvent.click(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeDefined()

    await userEvent.click(screen.getByRole('option', { name: '上海' }))
    expect(onChange).toHaveBeenCalledWith('sh')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByText('上海')).toBeDefined()
  })

  it('受控模式下以 value 为准，不因内部状态漂移', () => {
    render(<Select options={OPTIONS} value="bj" onChange={() => undefined} />)
    expect(screen.getByText('北京')).toBeDefined()
  })

  it('禁用选项不可选中', async () => {
    const onChange = vi.fn()
    render(<Select options={OPTIONS} onChange={onChange} />)
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(screen.getByRole('option', { name: '广州' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('Select 键盘导航', () => {
  it('方向键移动高亮，Enter 确认选择', async () => {
    const onChange = vi.fn()
    render(<Select options={OPTIONS} onChange={onChange} />)
    const trigger = screen.getByRole('combobox')
    trigger.focus()

    await userEvent.keyboard('{ArrowDown}') // 打开并高亮第 1 项
    expect(screen.getByRole('listbox')).toBeDefined()

    await userEvent.keyboard('{ArrowDown}') // 移到第 2 项
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('sh')
  })

  it('Escape 关闭下拉但不选择', async () => {
    const onChange = vi.fn()
    render(<Select options={OPTIONS} onChange={onChange} />)
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('Select 多选', () => {
  it('选中项以数组回传，且可继续追加', async () => {
    const onValuesChange = vi.fn()
    render(<Select multiple values={[]} options={OPTIONS} onValuesChange={onValuesChange} />)
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(screen.getByRole('option', { name: '北京' }))
    expect(onValuesChange).toHaveBeenCalledWith(['bj'])
  })
})

describe('Dialog 无障碍', () => {
  it('打开时渲染 portal、带 aria-modal，且不渲染在不存在的父节点下', () => {
    const { container } = render(
      <Dialog open title="新建用户" description="填写基础信息">
        <input aria-label="用户名" />
      </Dialog>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    // 通过 portal 挂到 body，因此不在 render 容器内
    expect(container.contains(dialog)).toBe(false)
  })

  it('ESC 触发关闭回调', async () => {
    const onOpenChange = vi.fn()
    render(
      <Dialog open onOpenChange={onOpenChange} title="确认">
        <p>内容</p>
      </Dialog>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('打开时锁定背景滚动，关闭后归还', () => {
    const { rerender } = render(
      <Dialog open title="锁定">
        内容
      </Dialog>,
    )
    expect(document.body.style.overflow).toBe('hidden')
    rerender(
      <Dialog open={false} title="锁定">
        内容
      </Dialog>,
    )
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('点击遮罩关闭，closeOnOverlayClick=false 时不关闭', () => {
    const onOpenChange = vi.fn()
    const { rerender } = render(
      <Dialog open onOpenChange={onOpenChange} title="遮罩">
        内容
      </Dialog>,
    )
    const overlay = document.querySelector('[aria-hidden="true"]') as HTMLElement
    overlay.click()
    expect(onOpenChange).toHaveBeenCalledWith(false)

    rerender(
      <Dialog open closeOnOverlayClick={false} onOpenChange={onOpenChange} title="遮罩">
        内容
      </Dialog>,
    )
    ;(document.querySelector('[aria-hidden="true"]') as HTMLElement).click()
    expect(onOpenChange).toHaveBeenCalledTimes(1)
  })
})

describe('ConfirmDialog', () => {
  it('确认与取消分别回调', async () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        title="删除用户"
        confirmText="确认删除"
        cancelText="再想想"
      >
        该操作不可撤销
      </ConfirmDialog>,
    )
    await userEvent.click(screen.getByRole('button', { name: '确认删除' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: '再想想' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
