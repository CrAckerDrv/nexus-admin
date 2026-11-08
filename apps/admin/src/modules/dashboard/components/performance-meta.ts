import type { Tone } from '@nexus/ui'
import type {
  PerfAlertLevel,
  PerfAlertState,
  PerfHost,
  PerfRange,
  PerfSloItem,
  PerfStatus,
  PerfVolume,
} from '@/types/domain'

/**
 * 性能监控 · 语义映射表
 *
 * 为什么单独抽一个文件：
 * 面板里「状态 → 颜色 / 文案 / 进度条色调」的映射出现频率极高（矩阵、表格、抽屉、告警列表），
 * 分散在各处写三份 switch，迟早会出现「矩阵里是绿的、表格里是黄的」这种自相矛盾。
 */

export const PERF_STATUS_META: Record<PerfStatus, { label: string; tone: Tone; cssVar: string }> = {
  healthy: { label: '健康', tone: 'success', cssVar: '--n-success' },
  warning: { label: '降级', tone: 'warning', cssVar: '--n-warning' },
  critical: { label: '异常', tone: 'danger', cssVar: '--n-danger' },
  offline: { label: '离线', tone: 'neutral', cssVar: '--n-fg-4' },
}

export const PERF_ROLE_META: Record<PerfHost['role'], { label: string; short: string }> = {
  gateway: { label: '接入网关', short: 'GW' },
  app: { label: '应用服务', short: 'APP' },
  api: { label: '接口服务', short: 'API' },
  database: { label: '关系数据库', short: 'DB' },
  cache: { label: '缓存集群', short: 'CACHE' },
  mq: { label: '消息队列', short: 'MQ' },
  worker: { label: '任务节点', short: 'JOB' },
  storage: { label: '对象存储', short: 'OSS' },
}

export const PERF_ZONE_META: Record<PerfHost['zone'], string> = {
  'az-a': '可用区 A',
  'az-b': '可用区 B',
  'az-c': '可用区 C',
}

export const PERF_ALERT_LEVEL_META: Record<
  PerfAlertLevel,
  { label: string; tone: Tone; short: string }
> = {
  critical: { label: 'P0 紧急', tone: 'danger', short: 'P0' },
  warning: { label: 'P1 警告', tone: 'warning', short: 'P1' },
  info: { label: 'P2 提示', tone: 'info', short: 'P2' },
}

export const PERF_ALERT_STATE_META: Record<PerfAlertState, { label: string; tone: Tone }> = {
  firing: { label: '未处理', tone: 'danger' },
  acknowledged: { label: '已确认', tone: 'warning' },
  resolved: { label: '已恢复', tone: 'success' },
}

export const PERF_RANGE_ITEMS: Array<{ value: PerfRange; label: string }> = [
  { value: '1h', label: '1 小时' },
  { value: '6h', label: '6 小时' },
  { value: '24h', label: '24 小时' },
  { value: '7d', label: '7 天' },
]

/** 用量百分比（0-100，保留 1 位） */
export function usageOf(used: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((used / total) * 1000) / 10
}

/**
 * 主机单元格底色
 *
 * 用 `color-mix` 把透明度编码进颜色而不是改 `opacity`：
 * 后者会让格子之间的描边、悬浮阴影一起变淡，矩阵看起来像「脏」了。
 * 离线节点单独给低饱和灰，避免和「深绿=低负载」混淆。
 */
export function hostCellColor(host: PerfHost): string {
  if (host.status === 'offline') {
    return 'color-mix(in oklab, var(--n-fg-4) 26%, transparent)'
  }
  const base = PERF_STATUS_META[host.status].cssVar
  const strength = host.status === 'critical' ? 92 : houseClamp(34 + (host.cpu / 100) * 54, 34, 92)
  return `color-mix(in oklab, var(${base}) ${strength}%, transparent)`
}

function houseClamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** SLO 达标情况 → 色调 */
export function sloTone(item: PerfSloItem): 'success' | 'warning' | 'danger' {
  if (item.actual >= item.target) return 'success'
  if (item.budgetLeft >= 40) return 'warning'
  return 'danger'
}

/** 存储卷状态：优先看容量，其次看延迟 */
export function volumeStatus(volume: PerfVolume): PerfStatus {
  const percent = usageOf(volume.used, volume.total)
  if (percent >= 92) return 'critical'
  if (percent >= 82 || volume.latency >= 6) return 'warning'
  return 'healthy'
}
