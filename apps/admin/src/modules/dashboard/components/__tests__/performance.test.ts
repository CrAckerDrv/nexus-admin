import { describe, expect, it } from 'vitest'
import {
  PERF_SERIES,
  PERF_HOSTS,
  PERF_ALERTS,
  PERF_KPIS,
  PERF_VOLUMES,
  PERF_SERVICES,
  buildPerfSummary,
} from '@/mock/performance'
import { PERF_ALERT_LEVEL_META, PERF_STATUS_META, usageOf, volumeStatus } from '../performance-meta'

/**
 * 性能监控 · 数据与语义映射
 *
 * 这些用例锁的是「演示数据自洽性」——面板里最容易翻车的不是样式，
 * 而是「上面写 6 台异常、下面矩阵只有 2 个红格」这种一眼假的数字对不上。
 */

describe('性能监控演示数据', () => {
  it('汇总口径与主机清单一致', () => {
    const summary = buildPerfSummary()
    const expected = {
      total: PERF_HOSTS.length,
      warning: PERF_HOSTS.filter((host) => host.status === 'warning').length,
      critical: PERF_HOSTS.filter((host) => host.status === 'critical').length,
      offline: PERF_HOSTS.filter((host) => host.status === 'offline').length,
    }
    expect(summary.nodes.total).toBe(expected.total)
    expect(summary.nodes.warning).toBe(expected.warning)
    expect(summary.nodes.critical).toBe(expected.critical)
    expect(summary.nodes.offline).toBe(expected.offline)
    expect(summary.nodes.healthy).toBe(
      expected.total - expected.warning - expected.critical - expected.offline,
    )
    expect(
      summary.nodes.healthy +
        summary.nodes.warning +
        summary.nodes.critical +
        summary.nodes.offline,
    ).toBe(summary.nodes.total)
  })

  it('未处理告警数 = 处于 firing 的告警条数', () => {
    const summary = buildPerfSummary()
    expect(summary.alerts.unacked).toBe(
      PERF_ALERTS.filter((alert) => alert.state === 'firing').length,
    )
    const unackedKpi = PERF_KPIS.find((kpi) => kpi.key === 'alerts')
    expect(unackedKpi?.value).toBe(summary.alerts.unacked)
  })

  it('每台主机的 usage 都在 0-100 区间，离线节点资源为 0', () => {
    for (const host of PERF_HOSTS) {
      for (const value of [host.cpu, host.memory, host.disk]) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(100)
      }
      if (host.status === 'offline') {
        expect(host.cpu).toBe(0)
        expect(host.networkIn).toBe(0)
      }
    }
  })

  it('每台主机都有与长度一致的迷你趋势', () => {
    for (const host of PERF_HOSTS) {
      expect(host.cpuTrend).toHaveLength(12)
      expect(host.memoryTrend).toHaveLength(12)
    }
    for (const svc of PERF_SERVICES) {
      expect(svc.latencyTrend.length).toBeGreaterThan(1)
    }
  })

  it('四个时间区间的点数单调，且时间序列不变长过区间步长', () => {
    expect(PERF_SERIES['1h'].points.length).toBe(60)
    expect(PERF_SERIES['6h'].points.length).toBe(72)
    expect(PERF_SERIES['24h'].points.length).toBe(96)
    expect(PERF_SERIES['7d'].points.length).toBe(84)
    for (const key of ['1h', '6h', '24h', '7d'] as const) {
      const points = PERF_SERIES[key].points
      expect(points.every((point) => point.cpu >= 0 && point.cpu <= 100)).toBe(true)
      expect(points.every((point) => point.errorRate >= 0)).toBe(true)
    }
  })
})

describe('performance-meta 映射', () => {
  it('usageOf 处理除零与四舍五入', () => {
    expect(usageOf(50, 100)).toBe(50)
    expect(usageOf(0, 0)).toBe(0)
    expect(usageOf(1892, 2000)).toBe(94.6)
  })

  it('存储卷状态按容量与延迟判定', () => {
    const base = {
      id: 'v',
      host: 'h',
      mount: '/',
      fs: 'xfs',
      inode: 10,
      readIops: 1,
      writeIops: 1,
      status: 'healthy' as const,
    }
    expect(volumeStatus({ ...base, total: 100, used: 20, latency: 1 })).toBe('healthy')
    expect(volumeStatus({ ...base, total: 100, used: 85, latency: 1 })).toBe('warning')
    expect(volumeStatus({ ...base, total: 100, used: 95, latency: 1 })).toBe('critical')
    expect(volumeStatus({ ...base, total: 100, used: 20, latency: 6.4 })).toBe('warning')
  })

  it('状态与告警级别都有完整的中文标签', () => {
    expect(Object.keys(PERF_STATUS_META)).toEqual(['healthy', 'warning', 'critical', 'offline'])
    expect(PERF_ALERT_LEVEL_META.critical.short).toBe('P0')
    expect(PERF_STATUS_META.offline.label).toBe('离线')
  })

  it('存储卷清单里的用量不会超过容量', () => {
    for (const volume of PERF_VOLUMES) {
      expect(volume.used).toBeLessThanOrEqual(volume.total)
      expect(volume.inode).toBeGreaterThanOrEqual(0)
      expect(volume.inode).toBeLessThanOrEqual(100)
    }
  })
})
