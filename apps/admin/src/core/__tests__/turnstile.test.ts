import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  ALWAYS_PASS_TEST_SITE_KEY,
  DEFAULT_SITE_KEY,
  getTurnstileSiteKey,
  renderTurnstile,
  resetTurnstile,
} from '@/core/turnstile'

/**
 * Turnstile 前端内核的单测
 *
 * 只测**我们能控制的那部分**：site key 选择与「不重复初始化脚本」这两条约定。
 * 真正的挑战由 Cloudflare 完成，不在单测范围（也没法在 jsdom 里模拟）。
 */

describe('getTurnstileSiteKey', () => {
  it('演示态回退到官方测试 key', () => {
    expect(getTurnstileSiteKey({ mock: true })).toBe(ALWAYS_PASS_TEST_SITE_KEY)
  })

  it('生产态使用正式 key', () => {
    expect(getTurnstileSiteKey({ mock: false })).toBe(DEFAULT_SITE_KEY)
  })
})

describe('脚本加载', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    delete (window as { turnstile?: unknown }).turnstile
    vi.resetModules()
  })

  afterEach(() => {
    document.head.innerHTML = ''
  })

  it('已有 window.turnstile 时不再插入 script 标签', async () => {
    const render = vi.fn(() => 'widget-1')
    ;(window as unknown as { turnstile: unknown }).turnstile = {
      render,
      reset: vi.fn(),
      remove: vi.fn(),
      execute: vi.fn(),
      getResponse: vi.fn(),
    }
    const widgetId = await renderTurnstile(document.createElement('div'), {
      sitekey: DEFAULT_SITE_KEY,
    })
    expect(widgetId).toBe('widget-1')
    expect(document.querySelectorAll('script')).toHaveLength(0)
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('并发调用只插入一个 script 标签', async () => {
    const first = renderTurnstile(document.createElement('div'), { sitekey: DEFAULT_SITE_KEY })
    const second = renderTurnstile(document.createElement('div'), { sitekey: DEFAULT_SITE_KEY })
    // 两个 Promise 都挂起在「等脚本 onload」，此刻只应存在一个标签
    expect(document.querySelectorAll('script[data-nexus-turnstile]')).toHaveLength(1)
    void first.catch(() => {})
    void second.catch(() => {})
  })

  it('widgetId 为空时 reset 是安全空操作', async () => {
    const reset = vi.fn()
    ;(window as unknown as { turnstile: unknown }).turnstile = {
      render: vi.fn(),
      reset,
      remove: vi.fn(),
      execute: vi.fn(),
      getResponse: vi.fn(),
    }
    await resetTurnstile('')
    expect(reset).not.toHaveBeenCalled()
  })
})

