/**
 * 演示数据种子：确定性伪随机，保证每次刷新数据一致（便于截图与测试）
 */

/** Mulberry32 伪随机数生成器 */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const rand = mulberry32(20261104)

export function pick<T>(list: readonly T[]): T {
  return list[Math.floor(rand() * list.length)] as T
}

export function int(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min
}

export function chance(probability: number): boolean {
  return rand() < probability
}

export function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()
}

export function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString()
}

export const SURNAMES = [
  '陈',
  '林',
  '周',
  '吴',
  '黄',
  '赵',
  '孙',
  '李',
  '郑',
  '王',
  '冯',
  '沈',
  '韩',
  '杨',
  '徐',
  '朱',
]
export const GIVEN_NAMES = [
  '彦之',
  '知夏',
  '予安',
  '星野',
  '清越',
  '书鸣',
  '沐白',
  '若溪',
  '嘉树',
  '以宁',
  '锦程',
  '念真',
  '怀瑾',
  '斯年',
  '亦然',
  '映川',
]
export const DEPARTMENTS = [
  '平台技术部',
  '用户增长组',
  '内容运营组',
  '数据智能组',
  '客户成功部',
  '财务共享中心',
  '安全合规部',
]
export const CITIES = [
  '杭州',
  '深圳',
  '北京',
  '上海',
  '成都',
  '广州',
  '南京',
  '武汉',
  '西安',
  '苏州',
]
