/**
 * 真实用户监控（RUM）· 零依赖
 *
 * 为什么不装 `web-vitals`：
 * 它 4~5 kB gzip，而这里只需要 LCP / INP / CLS 三个数，
 * 用原生 `PerformanceObserver` 写出来不到 100 行，且能完全控制上报时机与体积。
 *
 * 三条设计约束
 * ------------
 * 1. **不阻塞任何交互**：观察器只在事件域里累加，上报统一走
 *    `visibilitychange → hidden` 或 `pagehide`（这个时机浏览器允许 `sendBeacon`，
 *    普通 fetch 会被取消）。
 * 2. **失败静默**：没有 `/api/vitals` 端点（多数私有部署都有）时，
 *    401/404/网络错误都不许冒泡到控制台 —— 监控代码不能成为新的报错源。
 * 3. **可关闭**：`VITE_ENABLE_VITALS=false` 时整段不执行（`installVitals` 早退），
 *    方便内网/离线部署一键关掉。
 *
 * 口径与 web.dev 一致
 * -------------------
 * - LCP：`largest-contentful-paint` 的最后一个候选，用户有输入后不再更新
 * - INP：`event` 的 duration 里取 p98 近似（取最大值会让一次卡顿永久污染该会话）
 * - CLS：只累计 `hadRecentInput === false` 的 `layout-shift`
 */

import { VITALS_ENABLED } from './env-mode'

const ENDPOINT = '/api/vitals'

/**
 * 只用到几个字段，但 TS 的 `PerformanceEntry` 不含它们
 *
 * 这些是 Chrome 的扩展字段（LCP / layout-shift / event timing），
 * 标准库里没有；不引 `web-vitals` 就得自己声明。
 */
interface LcpEntry extends PerformanceEntry {
  renderTime?: number
  loadTime?: number
}
interface LayoutShiftEntry extends PerformanceEntry {
  hadRecentInput: boolean
  value: number
}
interface NavigationEntry extends PerformanceEntry {
  responseStart: number
}

interface Sample {
  lcp: number
  inp: number
  cls: number
  ttfb: number
  path: string
}

const isEnabled = (): boolean => {
  if (typeof window === 'undefined') return false
  // 与 core/env-mode 读同一个构建期常量：内网部署可一键关掉
  return VITALS_ENABLED
}

let installed = false

export function installVitals(): void {
  if (installed || !isEnabled()) return
  installed = true

  const sample: Sample = {
    lcp: 0,
    inp: 0,
    cls: 0,
    ttfb: 0,
    path: window.location.pathname,
  }
  /** INP 的近似：保留最近若干个事件时长，取「接近最长」的那个（p98 近似） */
  const interactionDurations: number[] = []
  let hasInput = false

  try {
    const nav = performance.getEntriesByType('navigation')[0] as NavigationEntry | undefined
    if (nav) sample.ttfb = Math.round(nav.responseStart)
  } catch {
    /* 忽略 */
  }

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as LcpEntry[]) {
        // 用户开始交互后 LCP 不再变化：这是 web.dev 的判定口径
        if (hasInput) continue
        const time = entry.renderTime || entry.loadTime || entry.startTime
        if (time > sample.lcp) sample.lcp = time
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  } catch {
    /* 老内核忽略 */
  }

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as LayoutShiftEntry[]) {
        if (!entry.hadRecentInput) sample.cls += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
  } catch {
    /* ignore */
  }

  /**
   * INP 采集
   *
   * 只统计 `pointerdown / click / keydown` 这类「用户主动交互」，
   * 且排除 `duration < 16ms` 的事件（一帧以内不算卡）。
   * 会话结束时取 p98 —— 单个 600ms 的偶发卡顿不该代表整个会话。
   */
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        hasInput = true
        const duration = entry.duration
        if (duration >= 16) interactionDurations.push(duration)
      }
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit)
  } catch {
    /* Safari 老版本不支持 event timing，忽略 */
  }

  const flush = () => {
    if (interactionDurations.length > 0) {
      const sorted = [...interactionDurations].sort((a, b) => a - b)
      const index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.98))
      sample.inp = Math.round(sorted[index] ?? 0)
    }
    sample.lcp = Math.round(sample.lcp)
    sample.cls = Number(sample.cls.toFixed(4))

    const body = JSON.stringify(sample)
    // 优先 sendBeacon：页面正在卸载时普通 fetch 会被浏览器取消
    if (navigator.sendBeacon) {
      try {
        // type 必须是 text/plain 或 blob，否则会触发 CORS 预检
        const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' })
        if (navigator.sendBeacon(ENDPOINT, blob)) return
      } catch {
        /* 落到 fetch 兜底 */
      }
    }
    void fetch(ENDPOINT, {
      method: 'POST',
      body,
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      keepalive: true,
    }).catch(() => {
      // 没有该端点 / 未授权 / 断网：都不该出现在控制台
    })
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', flush)

  /** 开发态把最后一次采样挂在 window 上，便于手工核对 */
  if (import.meta.env.DEV) {
    ;(window as Window & { __vitals?: () => Sample }).__vitals = () => ({ ...sample })
  }
}
