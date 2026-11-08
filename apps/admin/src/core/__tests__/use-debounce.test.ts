import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDebouncedValue } from '@/core/use-debounce'

/**
 * 搜索防抖
 *
 * 这层保护曾经缺失：每次按键都改 queryKey，React Query 立刻发一次请求。
 * 演示环境的 50~180ms 假延迟掩盖了它，接真实后端就是 QPS 放大。
 */
describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('输入后不立刻提交，静止到阈值才更新', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: '张' },
    })
    expect(result.current).toBe('张')

    rerender({ value: '张三' })
    expect(result.current).toBe('张') // 还在防抖窗口内

    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(result.current).toBe('张')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe('张三')
  })

  it('连续输入只提交最后一次', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: '' },
    })
    for (const value of ['张', '张三', '张三丰']) {
      rerender({ value })
      act(() => {
        vi.advanceTimersByTime(100)
      })
    }
    expect(result.current).toBe('')

    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current).toBe('张三丰')
  })
})
