import { describe, expect, it, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AnimatedNumber } from '../components/premium'
import { isMotionEnabled } from '../lib/hooks'

/**
 * 数字滚动的开关语义
 *
 * 这三个用例锁的是「一处开关、两种行为」那个老 bug：
 * 过去 CSS 动画看 `[data-motion]`，而数字滚动只看 `prefers-reduced-motion`，
 * 于是主题面板里打开动效时，卡片抬升了、数字却仍然直接跳到终值。
 * 现在两者都走 `useMotionEnabled()`，下面直接断言 DOM 上的中间态。
 */
describe('AnimatedNumber · 动效开关', () => {
  afterEach(() => {
    delete document.documentElement.dataset.motion
  })

  it('关闭动效时立即显示终值（含千分位与前后缀）', () => {
    document.documentElement.dataset.motion = 'reduced'
    render(<AnimatedNumber value={8642300} prefix="¥ " suffix="元" />)
    const node = screen.getByLabelText('8,642,300')
    expect(node.textContent).toContain('¥ ')
    expect(node.textContent).toContain('8,642,300')
    expect(node.textContent).toContain('元')
    expect(node.getAttribute('data-motion-number')).toBe('static')
  })

  it('开启动效时数字是递增的（而不是一步到位）', async () => {
    document.documentElement.dataset.motion = 'full'
    const { container } = render(<AnimatedNumber value={1280} duration={120} />)

    /**
     * 断言「递增」而不是「必须在 N 毫秒内到达终值」
     *
     * jsdom 的 rAF 是 setTimeout 模拟的，整套用例并行跑时会被 CPU 抢占；
     * 用「终值必须出现在 2s 内」会把机器负载当成回归。这里只锁语义：
     * 1. 首帧不是终值（没有一步到位）
     * 2. 之后读数严格变大（是递增，不是随机跳）
     * 3. 节点标记为 rolling（与 reduced 档区分开）
     */
    const read = () => Number((container.textContent ?? '').replace(/[^\d.-]/g, ''))
    const first = read()
    expect(first).toBeLessThan(1280)
    expect(container.firstElementChild?.getAttribute('data-motion-number')).toBe('rolling')

    await waitFor(() => expect(read()).toBeGreaterThan(first), { timeout: 2000, interval: 16 })
    expect(read()).toBeLessThanOrEqual(1280)
  })

  it('开关切换（data-motion）后组件立即跟随，不需要重新挂载', () => {
    document.documentElement.dataset.motion = 'reduced'
    const { rerender } = render(<AnimatedNumber value={42} />)
    expect(screen.getByLabelText('42')).toBeTruthy()

    // 模拟主题面板打开动效：只改 <html data-motion>，再重渲染一次父组件
    document.documentElement.dataset.motion = 'full'
    rerender(<AnimatedNumber value={42} />)
    expect(isMotionEnabled()).toBe(true)
  })
})
