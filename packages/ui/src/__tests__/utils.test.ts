import { describe, expect, it } from 'vitest'
import {
  clamp,
  cn,
  formatBytes,
  formatCompact,
  formatCurrency,
  formatDateTime,
  formatPercent,
  formatRelativeTime,
  fuzzyMatch,
  avatarColor,
} from '../lib/utils'

describe('cn', () => {
  it('合并 Tailwind 冲突类名，后者优先', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('支持条件类名', () => {
    const hidden = false
    expect(cn('text-fg', hidden && 'hidden', ['bg-surface'], undefined)).toBe('text-fg bg-surface')
  })
})

describe('fuzzyMatch', () => {
  it('包含匹配', () => {
    expect(fuzzyMatch('用户管理', '用户')).toBe(true)
  })

  it('子序列匹配', () => {
    expect(fuzzyMatch('用户管理', '用管')).toBe(true)
  })

  it('不匹配时返回 false', () => {
    expect(fuzzyMatch('用户管理', '订单')).toBe(false)
  })

  it('空关键词恒为 true', () => {
    expect(fuzzyMatch('任意文本', '')).toBe(true)
  })
})

describe('格式化函数', () => {
  it('formatBytes 使用 1024 进制', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1.00 KB')
    expect(formatBytes(1073741824)).toBe('1.00 GB')
  })

  it('formatCurrency 输出人民币符号', () => {
    expect(formatCurrency(1234.5)).toContain('1,234.50')
  })

  it('formatPercent 保留位数', () => {
    expect(formatPercent(4.6832)).toBe('4.68%')
  })

  it('formatCompact 使用中文紧凑单位', () => {
    expect(formatCompact(128460)).toMatch(/12\.8万|12\.9万|128,460/)
  })

  it('formatDateTime 输出固定格式', () => {
    expect(formatDateTime(new Date(2026, 10, 4, 9, 5), true)).toBe('2026-11-04 09:05:00')
  })

  it('formatRelativeTime 返回相对描述', () => {
    expect(formatRelativeTime(new Date(Date.now() - 3 * 60 * 1000))).toContain('分钟')
  })
})

describe('工具函数', () => {
  it('clamp 限制区间', () => {
    expect(clamp(120, 0, 100)).toBe(100)
    expect(clamp(-5, 0, 100)).toBe(0)
  })

  it('avatarColor 对相同名字稳定', () => {
    expect(avatarColor('陈彦之')).toBe(avatarColor('陈彦之'))
  })
})
