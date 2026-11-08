import type {
  CanvasCamera,
  CanvasPoint,
  CanvasRect,
  CanvasSize,
  CanvasPortSide,
} from './types'

/**
 * 无限画布 · 几何内核（纯函数，无 DOM 依赖）
 *
 * 这一层是整个画布的正确性来源：相机换算、缩放锚点、视口夹取、矩形运算、fitView。
 * 全部写成纯函数，既方便单测，也方便在 rAF 里高频调用而不产生垃圾。
 *
 * 坐标约定：
 * - 世界坐标（world）：节点数据里保存的坐标，原点任意，无边界
 * - 屏幕坐标（screen）：相对画布容器的 CSS 像素，原点在左上角
 * - 换算：screen = world * zoom + camera.{x,y}
 */

export const MIN_ZOOM = 0.05
export const MAX_ZOOM = 4

/** 缩放档位：按钮加减与键盘 +/− 走这些档，手感比线性步进更稳 */
export const ZOOM_STEPS = [0.05, 0.1, 0.16, 0.25, 0.33, 0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 3, 4]

/** 世界软边界：只在「适配全部」「惯性滑动」时用于兜底，正常拖拽不受限 */
export const WORLD_SOFT_LIMIT = 200_000

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

export function clampZoom(zoom: number): number {
  return clamp(Number.isFinite(zoom) ? zoom : 1, MIN_ZOOM, MAX_ZOOM)
}

/** 世界 → 屏幕 */
export function worldToScreen(point: CanvasPoint, camera: CanvasCamera): CanvasPoint {
  return {
    x: point.x * camera.zoom + camera.x,
    y: point.y * camera.zoom + camera.y,
  }
}

/** 屏幕 → 世界 */
export function screenToWorld(point: CanvasPoint, camera: CanvasCamera): CanvasPoint {
  return {
    x: (point.x - camera.x) / camera.zoom,
    y: (point.y - camera.y) / camera.zoom,
  }
}

/** 屏幕长度 → 世界长度 */
export function screenToWorldSize(size: number, camera: CanvasCamera): number {
  return size / camera.zoom
}

/**
 * 以某个屏幕点为中心缩放（锚点保持不动）
 *
 * 这是「滚轮缩放不漂移」的唯一正确写法：
 * 先取锚点的世界坐标，缩放后再反解出新的平移量，使同一个世界点仍落在同一屏幕点。
 */
export function zoomAt(
  camera: CanvasCamera,
  anchorScreen: CanvasPoint,
  nextZoom: number,
): CanvasCamera {
  const zoom = clampZoom(nextZoom)
  if (zoom === camera.zoom) return camera
  const world = screenToWorld(anchorScreen, camera)
  return {
    zoom,
    x: anchorScreen.x - world.x * zoom,
    y: anchorScreen.y - world.y * zoom,
  }
}

/** 按档位取「下一个」缩放值（放大） */
export function nextZoomStep(zoom: number): number {
  const found = ZOOM_STEPS.find((step) => step > zoom + 1e-4)
  return clampZoom(found ?? MAX_ZOOM)
}

/** 按档位取「上一个」缩放值（缩小） */
export function prevZoomStep(zoom: number): number {
  const reversed = [...ZOOM_STEPS].reverse()
  const found = reversed.find((step) => step < zoom - 1e-4)
  return clampZoom(found ?? MIN_ZOOM)
}

/** 两个相机是否等价（用于避免无意义的重渲染） */
export function cameraEquals(a: CanvasCamera, b: CanvasCamera, epsilon = 0.001): boolean {
  return (
    Math.abs(a.x - b.x) < epsilon &&
    Math.abs(a.y - b.y) < epsilon &&
    Math.abs(a.zoom - b.zoom) < epsilon / 100
  )
}

/* ------------------------------------------------------------------ *
 * 矩形运算
 * ------------------------------------------------------------------ */

export function rectFromPoints(a: CanvasPoint, b: CanvasPoint): CanvasRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  }
}

export function rectFromNode(node: { x: number; y: number; width: number; height: number }): CanvasRect {
  return { x: node.x, y: node.y, width: node.width, height: node.height }
}

export function rectIntersects(a: CanvasRect, b: CanvasRect): boolean {
  return (
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
  )
}

export function rectContains(outer: CanvasRect, inner: CanvasRect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  )
}

export function rectUnion(a: CanvasRect, b: CanvasRect): CanvasRect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const right = Math.max(a.x + a.width, b.x + b.width)
  const bottom = Math.max(a.y + a.height, b.y + b.height)
  return { x, y, width: right - x, height: bottom - y }
}

export function rectFromRects(rects: CanvasRect[]): CanvasRect | null {
  if (rects.length === 0) return null
  return rects.slice(1).reduce((acc, rect) => rectUnion(acc, rect), rects[0]!)
}

/** 矩形外扩（padding 为世界坐标下的值） */
export function rectInflate(rect: CanvasRect, padding: number): CanvasRect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  }
}

/** 可见区域（世界坐标）：由容器尺寸与相机反推 */
export function viewportRect(size: CanvasSize, camera: CanvasCamera): CanvasRect {
  return {
    x: -camera.x / camera.zoom,
    y: -camera.y / camera.zoom,
    width: size.width / camera.zoom,
    height: size.height / camera.zoom,
  }
}

/**
 * 把世界矩形完整放进视口
 *
 * @param padding 屏幕像素内边距（不随 zoom 缩放），适配时留白更好看
 * @param maxZoom 适配后的最大缩放，避免「单个小节点被放大到 400%」
 * @param size    容器尺寸；宽高为 0（尚未测量）时返回原相机，避免 NaN
 */
export function fitView(
  rect: CanvasRect,
  size: CanvasSize,
  options: { padding?: number; maxZoom?: number; minZoom?: number } = {},
): CanvasCamera {
  const { padding = 96, maxZoom = 1, minZoom = MIN_ZOOM } = options
  if (size.width <= 0 || size.height <= 0) return { x: 0, y: 0, zoom: 1 }
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0, zoom: 1 }

  const availableW = Math.max(size.width - padding * 2, 40)
  const availableH = Math.max(size.height - padding * 2, 40)
  const zoom = clamp(Math.min(availableW / rect.width, availableH / rect.height), minZoom, maxZoom)

  return {
    zoom,
    x: size.width / 2 - (rect.x + rect.width / 2) * zoom,
    y: size.height / 2 - (rect.y + rect.height / 2) * zoom,
  }
}

/** 把某个世界点放到视口中心（保持当前缩放） */
export function centerOn(
  point: CanvasPoint,
  size: CanvasSize,
  zoom: number,
): CanvasCamera {
  const z = clampZoom(zoom)
  return {
    zoom: z,
    x: size.width / 2 - point.x * z,
    y: size.height / 2 - point.y * z,
  }
}

/** 相机平移量夹取：保证世界原点附近始终可达 */
export function clampCamera(camera: CanvasCamera, size: CanvasSize): CanvasCamera {
  const limit = WORLD_SOFT_LIMIT * camera.zoom
  return {
    zoom: camera.zoom,
    x: clamp(camera.x, -limit + size.width, limit),
    y: clamp(camera.y, -limit + size.height, limit),
  }
}

/* ------------------------------------------------------------------ *
 * 端口与锚点
 * ------------------------------------------------------------------ */

/** 节点各边中点（世界坐标） */
export function portPoint(
  node: { x: number; y: number; width: number; height: number },
  side: CanvasPortSide,
): CanvasPoint {
  switch (side) {
    case 'left':
      return { x: node.x, y: node.y + node.height / 2 }
    case 'right':
      return { x: node.x + node.width, y: node.y + node.height / 2 }
    case 'top':
      return { x: node.x + node.width / 2, y: node.y }
    default:
      return { x: node.x + node.width / 2, y: node.y + node.height }
  }
}

/**
 * 自动锚点：按两节点的相对位置挑一对最合理的边
 *
 * 规则（与专业流程图工具一致）：先比水平/垂直的重叠程度，
 * 有明显水平错位就左右连（阅读方向），否则上下连。
 * 返回的 `[sourceSide, targetSide]` 永远成对出现，不需要调用方再判断。
 */
export function autoPortSides(
  source: { x: number; y: number; width: number; height: number },
  target: { x: number; y: number; width: number; height: number },
): [CanvasPortSide, CanvasPortSide] {
  const sourceCx = source.x + source.width / 2
  const targetCx = target.x + target.width / 2
  const sourceCy = source.y + source.height / 2
  const targetCy = target.y + target.height / 2

  // 中心距
  const dx = targetCx - sourceCx
  const dy = targetCy - sourceCy

  // 重叠量：>0 表示在该轴上有重叠
  const overlapX =
    Math.min(source.x + source.width, target.x + target.width) - Math.max(source.x, target.x)
  const overlapY =
    Math.min(source.y + source.height, target.y + target.height) - Math.max(source.y, target.y)

  // 先判水平关系：左右分开且没有明显垂直重叠时，左右连
  const clearlyHorizontal = Math.abs(dx) >= Math.abs(dy)
  if (clearlyHorizontal && overlapY <= Math.min(source.height, target.height) * 0.6) {
    return dx >= 0 ? ['right', 'left'] : ['left', 'right']
  }
  // 水平有重叠或垂直分离更明显：上下连
  if (overlapX > 0 || Math.abs(dy) > Math.abs(dx)) {
    return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom']
  }
  return dx >= 0 ? ['right', 'left'] : ['left', 'right']
}

/** 方位对应的法向量，用于贝塞尔控制点方向 */
export function sideVector(side: CanvasPortSide): CanvasPoint {
  switch (side) {
    case 'left':
      return { x: -1, y: 0 }
    case 'right':
      return { x: 1, y: 0 }
    case 'top':
      return { x: 0, y: -1 }
    default:
      return { x: 0, y: 1 }
  }
}

/* ------------------------------------------------------------------ *
 * 命中测试与吸附
 * ------------------------------------------------------------------ */

export function pointInRect(point: CanvasPoint, rect: CanvasRect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

/**
 * 吸附：把「拖拽中节点的矩形」对齐到其它节点的边缘/中心，以及网格
 *
 * 返回值中的 `guides` 是参考线的世界坐标（x 或 y 各一条），渲染层直接拿来画线。
 * 阈值按 zoom 折算：屏幕上 6px 的吸附感，在任何缩放下都一致。
 */
export interface SnapResult {
  dx: number
  dy: number
  guides: Array<{ axis: 'x' | 'y'; value: number; from: number; to: number }>
}

export function snapRect(
  moving: CanvasRect,
  others: CanvasRect[],
  options: { grid?: number; threshold: number } = { threshold: 6 },
): SnapResult {
  const { grid = 0, threshold } = options
  const movingCx = moving.x + moving.width / 2
  const movingCy = moving.y + moving.height / 2
  const movingRight = moving.x + moving.width
  const movingBottom = moving.y + moving.height

  // 用可写对象持有候选，而不是在闭包里改两个 let：
  // TS 的控制流分析看不到闭包内的赋值，会把 let 收窄成 never。
  const best = {
    x: null as { delta: number; guide: SnapResult['guides'][number] } | null,
    y: null as { delta: number; guide: SnapResult['guides'][number] } | null,
  }

  const consider = (
    axis: 'x' | 'y',
    delta: number,
    value: number,
    from: number,
    to: number,
  ) => {
    if (Math.abs(delta) > threshold) return
    const current = axis === 'x' ? best.x : best.y
    if (current && Math.abs(delta) >= Math.abs(current.delta)) return
    const next = { delta, guide: { axis, value, from, to } }
    if (axis === 'x') best.x = next
    else best.y = next
  }

  for (const other of others) {
    // 垂直参考线：左、中、右三条与其它节点的三条比较
    const otherCx = other.x + other.width / 2
    const otherRight = other.x + other.width
    const xPairs: Array<[number, number]> = [
      [other.x, moving.x],
      [otherCx, movingCx],
      [otherRight, movingRight],
      [other.x, movingRight],
      [otherRight, moving.x],
    ]
    for (const [target, current] of xPairs) {
      const spanFrom = Math.min(moving.y, other.y)
      const spanTo = Math.max(movingBottom, other.y + other.height)
      consider('x', target - current, target, spanFrom, spanTo)
    }

    const otherCy = other.y + other.height / 2
    const otherBottom = other.y + other.height
    const yPairs: Array<[number, number]> = [
      [other.y, moving.y],
      [otherCy, movingCy],
      [otherBottom, movingBottom],
      [other.y, movingBottom],
      [otherBottom, moving.y],
    ]
    for (const [target, current] of yPairs) {
      const spanFrom = Math.min(moving.x, other.x)
      const spanTo = Math.max(movingRight, other.x + other.width)
      consider('y', target - current, target, spanFrom, spanTo)
    }
  }

  // 网格吸附：某条轴上没有对齐参考线时才生效，避免两套吸附互相打架。
  // 网格吸附只改位移、不画参考线（否则每次移动都满屏横竖线，反而晃眼）。
  const gridDeltaX = best.x || grid <= 0 ? undefined : snapToGrid(moving.x, grid) - moving.x
  const gridDeltaY = best.y || grid <= 0 ? undefined : snapToGrid(moving.y, grid) - moving.y

  const guides: SnapResult['guides'] = []
  if (best.x) guides.push(best.x.guide)
  if (best.y) guides.push(best.y.guide)
  return {
    dx: best.x?.delta ?? gridDeltaX ?? 0,
    dy: best.y?.delta ?? gridDeltaY ?? 0,
    guides,
  }
}

/** 网格吸附（无参考线模式）：批量拖拽时使用 */
export function snapToGrid(value: number, grid: number): number {
  if (grid <= 0) return value
  return Math.round(value / grid) * grid
}
