import { useEffect, useMemo, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { cn, sxSize } from '@nexus/ui'
import { useI18n } from '@/i18n'
import type { ECharts } from './echart-core'

/**
 * EChart · ECharts 6 轻封装
 *
 * 关键设计（踩过的坑）：
 * 1. **不要把 `var(--x)` 传进 ECharts**：Canvas 渲染器无法解析 CSS 变量，
 *    非法颜色会被静默忽略并回退到默认深色 —— 深色模式下坐标轴文字就会"消失"。
 *    因此统一用 `useChartTokens()` 把令牌解析成具体色值。
 * 2. **主题切换不重建实例**：早期版本在主题变化时 dispose + init，
 *    一旦异步初始化与清理交错就会留下空容器。现在实例只在挂载时创建一次，
 *    主题变化仅触发 `setOption`（ECharts 会自行重绘），既稳定又快。
 * 3. 首帧容器可能尺寸为 0（懒加载/路由过渡），用 ResizeObserver 兜底做一次 `resize()`。
 */

export type ChartOption = Record<string, unknown>

function importECharts() {
  return import('./echart-core')
}

type CoreModule = Awaited<ReturnType<typeof importECharts>>

let echartsModulePromise: Promise<CoreModule> | null = null

function loadECharts(): Promise<CoreModule> {
  echartsModulePromise ??= importECharts()
  return echartsModulePromise
}

/**
 * 等首屏空闲后再拉图表库
 *
 * ECharts + zrender 压缩后 657 kB，是整包里最大的单文件。
 * 之前进概览页即开拉，和 react/router 这些关键路径抢带宽 ——
 * 首屏 FCP 被它拖慢，而图表本身并不是「打开就能看」的内容。
 * 这里改成空闲时再取：首屏拿到的是外壳 + 骨架，图表随后补齐。
 */
function scheduleIdle(task: () => void): () => void {
  if (typeof window === 'undefined') {
    task()
    return () => {}
  }
  type IdleWindow = Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
    cancelIdleCallback?: (handle: number) => void
  }
  const w = window as IdleWindow
  if (w.requestIdleCallback) {
    const handle = w.requestIdleCallback(task, { timeout: 1200 })
    return () => w.cancelIdleCallback?.(handle)
  }
  const timer = setTimeout(task, 200)
  return () => clearTimeout(timer)
}

export interface ChartTokens {
  /** 文字（主） */
  fg: string
  fg2: string
  fg3: string
  fg4: string
  /** 分割线 / 网格 */
  grid: string
  gridSubtle: string
  /** 图表背景 */
  surface: string
  /** 色板 */
  chart: [string, string, string, string, string, string]
  /** 主题版本号，用于触发重绘 */
  version: number
}

const FALLBACK: Omit<ChartTokens, 'version'> = {
  fg: '#1d2129',
  fg2: '#4e5969',
  fg3: '#86909c',
  fg4: '#b4bac4',
  grid: '#e4e6eb',
  gridSubtle: '#eef0f3',
  surface: '#ffffff',
  chart: ['#0d6efd', '#12a150', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'],
}

/** 从 CSS 变量解析出当前主题的具体色值 */
export function readThemeTokens(): Omit<ChartTokens, 'version'> {
  if (typeof window === 'undefined') return FALLBACK
  const styles = getComputedStyle(document.documentElement)
  const read = (name: string, value: string) => styles.getPropertyValue(name).trim() || value
  return {
    fg: read('--n-fg', FALLBACK.fg),
    fg2: read('--n-fg-2', FALLBACK.fg2),
    fg3: read('--n-fg-3', FALLBACK.fg3),
    fg4: read('--n-fg-4', FALLBACK.fg4),
    grid: read('--n-border', FALLBACK.grid),
    gridSubtle: read('--n-border-subtle', FALLBACK.gridSubtle),
    surface: read('--n-surface', FALLBACK.surface),
    chart: [
      read('--n-chart-1', FALLBACK.chart[0]),
      read('--n-chart-2', FALLBACK.chart[1]),
      read('--n-chart-3', FALLBACK.chart[2]),
      read('--n-chart-4', FALLBACK.chart[3]),
      read('--n-chart-5', FALLBACK.chart[4]),
      read('--n-chart-6', FALLBACK.chart[5]),
    ] as ChartTokens['chart'],
  }
}

/**
 * 图表主题令牌 Hook
 *
 * 监听 `<html>` 的 class / data-accent / data-theme / data-skin 变化，以及 style 属性变化 ——
 * 最后一条是为自定义调色盘准备的：调色盘的变量写在行内 style 上，
 * 不监听 style 的话「改图表色板」不会触发 canvas 重绘，用户会以为没生效。
 */
export function useChartTokens(): ChartTokens {
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.attributeName === 'class' ||
          mutation.attributeName === 'style' ||
          mutation.attributeName === 'data-accent' ||
          mutation.attributeName === 'data-theme' ||
          mutation.attributeName === 'data-skin'
        ) {
          setVersion((value) => value + 1)
          break
        }
      }
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-accent', 'data-theme', 'data-skin'],
    })
    return () => observer.disconnect()
  }, [])

  // 依赖 version，主题变化后重新读取令牌
  return useMemo(() => ({ ...readThemeTokens(), version }), [version])
}

export interface EChartProps {
  option: ChartOption
  height?: number | string
  className?: string
  loading?: boolean
  onClick?: (params: unknown) => void
  /** 多图联动分组 */
  group?: string
  /** 外部传入令牌（避免每个图表各自订阅） */
  tokens?: ChartTokens
}

export function EChart({
  option,
  height = 280,
  className,
  loading,
  onClick,
  group,
  tokens: tokensProp,
}: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ECharts | null>(null)
  const { t } = useI18n()
  const fallbackTokens = useChartTokens()
  const tokens = tokensProp ?? fallbackTokens
  const [ready, setReady] = useState(false)

  // 实例只在挂载时创建；主题变化不再重建
  useEffect(() => {
    let disposed = false
    let instance: ECharts | null = null
    let resizeObserver: ResizeObserver | null = null

    // 首屏空闲后再加载图表库：不与 react/router 等关键路径抢带宽
    const cancelIdle = scheduleIdle(() => {
      void (async () => {
        const { echarts } = await loadECharts()
        const el = containerRef.current
        if (disposed || !el) return

        instance = echarts.init(el, undefined, { renderer: 'canvas' })
        chartRef.current = instance
        if (group) {
          instance.group = group
          echarts.connect(group)
        }
        // 首帧容器可能尚未布局完成，再补一次尺寸校正
        requestAnimationFrame(() => instance?.resize())
        setReady(true)

        resizeObserver = new ResizeObserver(() => instance?.resize())
        resizeObserver.observe(el)
      })()
    })

    return () => {
      disposed = true
      cancelIdle()
      resizeObserver?.disconnect()
      instance?.dispose()
      chartRef.current = null
      setReady(false)
    }
  }, [group])

  // option 或主题令牌变化时重绘（不重建实例）
  useEffect(() => {
    const chart = chartRef.current
    if (!ready || !chart) return
    chart.setOption(buildOption(option, tokens), { notMerge: true })
  }, [option, tokens, ready])

  useEffect(() => {
    const chart = chartRef.current
    if (!ready || !chart) return
    if (loading) {
      chart.showLoading('default', {
        text: '',
        color: tokens.chart[0],
        maskColor: 'transparent',
      })
    } else {
      chart.hideLoading()
    }
  }, [loading, ready, tokens])

  useEffect(() => {
    const chart = chartRef.current
    if (!ready || !chart || !onClick) return
    const handler = (params: unknown) => onClick(params)
    chart.on('click', handler)
    return () => {
      chart.off('click', handler)
    }
  }, [onClick, ready])

  return (
    <div className={cn('relative w-full', className)} style={{ height: sxSize(height) }}>
      <div ref={containerRef} className="size-full" role="img" aria-label={t('chart.ariaLabel')} />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center">
          <LoaderCircle className="size-5 animate-spin text-fg-4" />
        </div>
      )}
    </div>
  )
}

/**
 * 把设计令牌合并进 option（颜色 / 字体 / tooltip 样式）
 *
 * ECharts 的 `fontSize` 只能是数字（px），没法写 rem，所以在令牌层统一给定字号，
 * 页面里的 option 若没显式写 fontSize 就用这里的默认值。
 */
function buildOption(option: ChartOption, tokens: ChartTokens) {
  const base: ChartOption = {
    backgroundColor: 'transparent',
    color: tokens.chart,
    textStyle: { fontFamily: 'inherit', color: tokens.fg2, fontSize: 11 },
    tooltip: {
      backgroundColor: tokens.surface,
      borderColor: tokens.grid,
      borderWidth: 1,
      padding: [8, 10],
      textStyle: { color: tokens.fg, fontSize: 12 },
      extraCssText:
        'box-shadow: 0 6px 28px rgba(16,24,40,.18); border-radius: 10px;',
    },
  }
  return deepMerge(base, option)
}

/** 图表 option 的浅层深合并（数组整体替换） */
function deepMerge(base: ChartOption, override: ChartOption): ChartOption {
  const result: ChartOption = { ...base }
  for (const [key, value] of Object.entries(override)) {
    const current = result[key]
    const mergeable =
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current &&
      typeof current === 'object' &&
      !Array.isArray(current)
    result[key] = mergeable ? deepMerge(current as ChartOption, value as ChartOption) : value
  }
  return result
}
