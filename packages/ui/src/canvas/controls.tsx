import { memo, useEffect, useRef } from 'react'
import { cn } from '../lib/utils'
import { clampZoom, nextZoomStep, prevZoomStep } from './math'
import { FitIcon, MinusIcon, PlusIcon } from './icons'
import type { CanvasCamera } from './types'

/**
 * 画布控件：缩放百分比 + 加减 + 适配
 *
 * 百分比文本需要「实时」跟随，但又不能每帧重渲染整个组件树 ——
 * 这里直接用 `subscribe` 写 DOM 文本（命令式），React 只负责按钮。
 */
export interface CanvasControlsProps {
  camera: CanvasCamera
  subscribe: (listener: (camera: CanvasCamera, settled: boolean) => void) => () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onResetZoom?: () => void
  className?: string
}

export const CanvasControls = memo(function CanvasControls({
  subscribe,
  onZoomIn,
  onZoomOut,
  onFit,
  onResetZoom,
  className,
}: CanvasControlsProps) {
  const labelRef = useRef<HTMLSpanElement>(null)

  // 百分比文本用命令式更新：相机每帧变化时只改 textContent，
  // 不触发这个组件（以及整棵树）的重渲染。
  useEffect(() => {
    return subscribe((camera) => {
      const text = `${Math.round(camera.zoom * 100)}%`
      if (labelRef.current && labelRef.current.textContent !== text) {
        labelRef.current.textContent = text
      }
    })
  }, [subscribe])

  return (
    <div
      data-canvas-controls=""
      className={cn(
        'absolute right-3 bottom-3 z-30 flex items-center gap-0.5 rounded-lg border border-line bg-surface/95 p-1 shadow-sm backdrop-blur-sm',
        className,
      )}
    >
      <button
        type="button"
        onClick={onZoomOut}
        aria-label="缩小"
        title="缩小（-）"
        className="grid size-7 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <MinusIcon size={15} />
      </button>
      <button
        type="button"
        onClick={onResetZoom ?? onFit}
        aria-label="重置缩放到 100%"
        title="重置为 100%（双击画布亦可）"
        className="min-w-[3rem] rounded-md px-1 py-1 text-center text-2xs font-medium text-fg-2 tabular-nums transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <span ref={labelRef}>100%</span>
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        aria-label="放大"
        title="放大（+）"
        className="grid size-7 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <PlusIcon size={15} />
      </button>
      <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-line" />
      <button
        type="button"
        onClick={onFit}
        aria-label="适配全部内容"
        title="适配全部（Shift+1）"
        className="grid size-7 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <FitIcon size={15} />
      </button>
    </div>
  )
})

/** 供外部按档位计算的辅助（演示页的 +/− 按钮也会用到） */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  return clampZoom(direction > 0 ? nextZoomStep(zoom) : prevZoomStep(zoom))
}
