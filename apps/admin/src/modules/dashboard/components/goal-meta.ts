/**
 * 经营目标口径（单一事实来源）
 *
 * 「经营概览」的本月目标环、欢迎横幅里的目标进度条都读这一份。
 * 以前目标值写在页面里的 useMemo 中，一旦欢迎横幅也要用同一个达成率，
 * 就只能复制一遍 10_000_000 —— 两个数字迟早会走岔。
 *
 * 接真实后端时，把这里换成 `services/queries.ts` 里的目标接口即可，
 * 消费方不需要改动。
 */

export interface GoalTarget {
  /** 与 KPI 的 key 对齐：revenue / orders / users */
  key: 'revenue' | 'orders' | 'users'
  label: string
  target: number
}

export const MONTHLY_GOALS: GoalTarget[] = [
  { key: 'revenue', label: '交易额', target: 10_000_000 },
  { key: 'orders', label: '订单量', target: 16_000 },
  { key: 'users', label: '活跃用户', target: 160_000 },
]

/** 目标达成率：0–100，超额也封顶 100（环与进度条都不该越界） */
export function goalPercent(current: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, (current / target) * 100)
}

/** 按达成率取色调：80 以上算达成、60 以上正常、其余提醒 */
export function goalTone(percent: number): 'success' | 'primary' | 'warning' {
  if (percent >= 80) return 'success'
  if (percent >= 60) return 'primary'
  return 'warning'
}
