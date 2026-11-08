import type { PointerEvent as ReactPointerEvent } from 'react'
import { memo, useCallback, useEffect, useRef } from 'react'
import { cn } from '../lib/utils'
import type { CanvasCamera, CanvasNodeBase, CanvasRect, CanvasSize } from './types'

/**
 * 小地图
 *
 * 三条设计约束，缺一条就会「拖不动 / 拖了卡」：
 *
 * 1. **事件不外溢**：小地图在画布根节点内部，指针事件会冒泡到画布 ——
 *    不拦截的话，在缩略图上按下会被画布当成「框选/平移」，于是「拖小地图 = 同时拖画布」。
 *    这里对 pointerdown/move/up/click/dblclick 全部 stopPropagation。
 * 2. **拖拽跟手**：命中判断用 `ref` 而不是 `event.buttons`（指针捕获后 buttons 在
 *    部分浏览器为 0）；每次 move 只发一个「世界坐标」，由画布侧**直接写相机**，
 *    不起动画（动画会被下一次 move 打断，表现为卡顿）。
 * 3. **不必逐像素重绘**：视口矩形是 SVG 属性，相机变化只改 attribute，不触发 React。
 */
export interface CanvasMinimapProps {
  camera: CanvasCamera
  subscribe: (listener: (camera: CanvasCamera, settled: boolean) => void) => () => void
  size: CanvasSize
  bounds: CanvasRect | null
  /**
   * 跳转到某个世界点
   *
   * `meta.dragging`：true = 还在拖（宿主应立即生效、别做动画）；
   * false = 松手（宿主可做一次平滑收尾）。
   */
  onJump: (point: { x: number; y: number }, meta?: { dragging: boolean }) => void
  nodes?: Array<Pick<CanvasNodeBase, 'id' | 'x' | 'y' | 'width' | 'height' | 'hidden'> & { tone?: string }>
  width?: number
  height?: number
  className?: string
}

export const CanvasMinimap = memo(function CanvasMinimap({
  camera,
  subscribe,
  size,
  bounds,
  onJump,
  nodes = [],
  width = 184,
  height = 124,
  className,
}: CanvasMinimapProps) {
  const viewportRef = useRef<SVGGElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const draggingRef = useRef(false)
  /** 最近一次发出的跳转，松手时兜底补发 */
  const pendingRef = useRef<{ x: number; y: number } | null>(null)

  /** 绘制比例与偏移：把内容包围盒塞进缩略图并居中 */
  const scale = bounds
    ? Math.min(width / Math.max(bounds.width, 1), height / Math.max(bounds.height, 1))
    : 1
  const offsetX = bounds ? (width - bounds.width * scale) / 2 - bounds.x * scale : 0
  const offsetY = bounds ? (height - bounds.height * scale) / 2 - bounds.y * scale : 0

  // 视口矩形：相机变化时直接写 SVG transform / 尺寸（不触发 React）
  useEffect(() => {
    if (!bounds) return
    const apply = (cam: CanvasCamera) => {
      const group = viewportRef.current
      if (!group) return
      const view = {
        x: -cam.x / cam.zoom,
        y: -cam.y / cam.zoom,
        width: size.width / cam.zoom,
        height: size.height / cam.zoom,
      }
      group.setAttribute(
        'transform',
        `translate(${offsetX + view.x * scale} ${offsetY + view.y * scale}) scale(${scale})`,
      )
      const rect = group.querySelector('rect')
      if (rect) {
        rect.setAttribute('width', String(view.width))
        rect.setAttribute('height', String(view.height))
      }
    }
    apply(camera)
    return subscribe(apply)
    // camera 只做首帧种子；后续完全由 subscribe 驱动
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, bounds, size.width, size.height, width, height, scale, offsetX, offsetY])

  /** 屏幕坐标 → 世界坐标（按渲染尺寸与逻辑尺寸的比例换算，兼容面板缩放） */
  const toWorld = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current
      if (!svg) return null
      const rect = svg.getBoundingClientRect()
      const ratioX = rect.width > 0 ? width / rect.width : 1
      const ratioY = rect.height > 0 ? height / rect.height : 1
      const localX = (clientX - rect.left) * ratioX
      const localY = (clientY - rect.top) * ratioY
      return { x: (localX - offsetX) / scale, y: (localY - offsetY) / scale }
    },
    [width, height, offsetX, offsetY, scale],
  )

  /**
   * 直接转发，不再自己再加一层 rAF
   *
   * 早期实现是「minimap rAF 合帧 → onJump → 画布再 schedule 合帧」，
   * 等于两次缓冲，指针到画面最多差两帧（~33ms），拖起来发黏。
   * 画布侧的 `store.schedule` 本身就是逐帧合并，这里再缓冲一次纯属多余。
   */
  const queueJump = useCallback(
    (clientX: number, clientY: number) => {
      const world = toWorld(clientX, clientY)
      if (!world) return
      pendingRef.current = world
      onJump(world, { dragging: true })
    },
    [toWorld, onJump],
  )

  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation()

  const beginDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    // 按下立即跳一次（单击定位），同时进入拖动态
    queueJump(event.clientX, event.clientY)
  }

  const moveDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return
    event.stopPropagation()
    queueJump(event.clientX, event.clientY)
  }

  const endDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return
    event.stopPropagation()
    draggingRef.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    // 松手：补发最后一次位置，并通知宿主「已结束」
    const pending = pendingRef.current
    pendingRef.current = null
    onJump(pending ?? toWorld(event.clientX, event.clientY) ?? { x: 0, y: 0 }, { dragging: false })
  }

  if (!bounds) return null

  return (
    <div
      data-canvas-minimap=""
      className={cn(
        'absolute right-3 bottom-14 z-20 overflow-hidden rounded-lg border border-line bg-surface/92 p-1 shadow-sm backdrop-blur-sm',
        className,
      )}
      // 兜底：容器上的任何指针事件都不许冒泡到画布
      onPointerDown={stop}
      onPointerMove={stop}
      onPointerUp={stop}
      onClick={stop}
      onDoubleClick={stop}
      onContextMenu={stop}
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="img"
        aria-label="画布缩略图，拖动可移动视口"
        className="cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {nodes
          .filter((node) => !node.hidden)
          .map((node) => (
            <rect
              key={node.id}
              x={offsetX + node.x * scale}
              y={offsetY + node.y * scale}
              width={Math.max(2, node.width * scale)}
              height={Math.max(2, node.height * scale)}
              rx={1}
              className="pointer-events-none fill-fg-4/35"
            />
          ))}
        <g ref={viewportRef} className="pointer-events-none">
          <rect
            x={0}
            y={0}
            width={0}
            height={0}
            rx={1}
            className="fill-primary/10 stroke-primary/70"
            strokeWidth={Math.max(1 / scale, 1)}
          />
        </g>
      </svg>
    </div>
  )
})
