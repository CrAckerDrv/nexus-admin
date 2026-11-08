import { memo, useCallback, useEffect, useRef } from 'react'
import { cn } from '../lib/utils'
import { cameraEquals } from './math'
import type { CanvasCamera, CanvasRect, CanvasSize } from './types'

/**
 * 画布背景：双层点阵 / 网格
 *
 * 实现要点（性能关键）：
 * - 用**一个** CSS background-image（两层 repeating gradient）画两种粗细，
 *   而不是渲染上千个 DOM 点；
 * - 背景随相机移动：只改 CSS 变量 `--c-bg-x / --c-bg-y / --c-bg-size`，
 *   没有 React 重渲染；
 * - 缩放时按 log2 分档切换格子尺寸，避免缩到 5% 时密到全糊。
 */

export type CanvasBackgroundVariant = 'dots' | 'grid' | 'none'

export interface CanvasBackgroundProps {
  variant?: CanvasBackgroundVariant
  camera: CanvasCamera
  /** 订阅命令式相机更新，直接改 CSS 变量 */
  subscribe: (listener: (camera: CanvasCamera, settled: boolean) => void) => () => void
  className?: string
}

/** 基准格 24px，随缩放取 24 * 2^n，保证屏幕上的格子始终在 16~48px 之间 */
function gridStep(zoom: number): number {
  const base = 24
  const scaled = base * zoom
  if (scaled <= 0) return base
  const factor = Math.pow(2, Math.round(Math.log2(28 / scaled)))
  return base * factor
}

export const CanvasBackground = memo(function CanvasBackground({
  variant = 'dots',
  camera,
  subscribe,
  className,
}: CanvasBackgroundProps) {
  const ref = useRef<HTMLDivElement>(null)

  const paint = useCallback(
    (next: CanvasCamera) => {
      const el = ref.current
      if (!el) return
      const step = gridStep(next.zoom)
      const screenStep = step * next.zoom
      el.style.setProperty('--c-bg-size', `${screenStep}px`)
      el.style.setProperty('--c-bg-major', `${screenStep * 5}px`)
      const offsetX = ((next.x % screenStep) + screenStep) % screenStep
      const offsetY = ((next.y % screenStep) + screenStep) % screenStep
      el.style.setProperty('--c-bg-x', `${offsetX}px`)
      el.style.setProperty('--c-bg-y', `${offsetY}px`)
      el.style.setProperty('--c-bg-major-x', `${((next.x % (screenStep * 5)) + screenStep * 5) % (screenStep * 5)}px`)
      el.style.setProperty('--c-bg-major-y', `${((next.y % (screenStep * 5)) + screenStep * 5) % (screenStep * 5)}px`)
      el.dataset.zoomBand = next.zoom < 0.25 ? 'far' : next.zoom > 1.6 ? 'near' : 'mid'
    },
    [],
  )

  // 首次渲染 + 命令式跟随
  useEffect(() => {
    paint(camera)
    return subscribe((next, settled) => {
      // 手势中不节流：背景只是写 CSS 变量，比留下空白更自然
      if (settled || !cameraEquals(next, camera)) paint(next)
    })
    // camera 只做首帧种子，后续完全由订阅驱动
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paint, subscribe])

  if (variant === 'none') return null

  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-variant={variant}
      className={cn(
        'n-canvas-bg pointer-events-none absolute inset-0',
        variant === 'dots' ? 'n-canvas-bg--dots' : 'n-canvas-bg--grid',
        className,
      )}
    />
  )
})

/* ------------------------------------------------------------------ *
 * 选择框 / 吸附参考线 / 连线预览：都是「只有一两个元素」的覆盖层，
 * 直接受控于 React 状态即可，读屏与命中测试都不需要它们。
 * ------------------------------------------------------------------ */

export function CanvasMarquee({
  rect,
  className,
}: {
  rect: CanvasRect | null
  className?: string
}) {
  if (!rect) return null
  return (
    <div
      aria-hidden="true"
      data-canvas-marquee=""
      className={cn('n-canvas-marquee', className)}
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
    />
  )
}

export function CanvasGuides({
  guides,
  camera,
  size,
}: {
  guides: Array<{ axis: 'x' | 'y'; value: number; from: number; to: number }>
  camera: CanvasCamera
  size: CanvasSize
}) {
  if (guides.length === 0) return null
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {guides.map((guide, index) => {
        const isX = guide.axis === 'x'
        const position = isX ? guide.value * camera.zoom + camera.x : guide.value * camera.zoom + camera.y
        const from = isX ? guide.from * camera.zoom + camera.y : guide.from * camera.zoom + camera.x
        const to = isX ? guide.to * camera.zoom + camera.y : guide.to * camera.zoom + camera.x
        return (
          <span
            key={`${guide.axis}-${guide.value}-${index}`}
            className="n-canvas-guide"
            style={
              isX
                ? {
                    left: position,
                    top: Math.max(0, from),
                    height: Math.max(0, Math.min(size.height, to) - Math.max(0, from)),
                    width: 1,
                  }
                : {
                    top: position,
                    left: Math.max(0, from),
                    width: Math.max(0, Math.min(size.width, to) - Math.max(0, from)),
                    height: 1,
                  }
            }
          />
        )
      })}
    </div>
  )
}
