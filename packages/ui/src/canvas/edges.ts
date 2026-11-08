import { portPoint, sideVector } from './math'
import type { CanvasEdgeBase, CanvasEdgeShape, CanvasPoint, CanvasPortSide } from './types'

/**
 * 连线几何
 *
 * 三种形态，各自解决一类问题：
 * - `bezier`     水平出/水平入的三次贝塞尔，最像「流程图」，也是默认；
 * - `orthogonal` 正交折线 + 圆角拐弯，适合严格对齐的工程图；
 * - `straight`   直线 + 箭头，适合「输入 → 输出」的强指向关系。
 *
 * 所有路径都基于**世界坐标**生成，渲染时由外层 `<g transform>` 统一缩放：
 * 好处是缩放时不必重新计算任何路径字符串。
 */

export interface EdgeGeometryInput {
  source: { x: number; y: number; width: number; height: number }
  target?: { x: number; y: number; width: number; height: number }
  /** 无 target 时使用（挂起边的落点） */
  targetPoint?: CanvasPoint
  sourceSide: CanvasPortSide
  targetSide: CanvasPortSide
  shape?: CanvasEdgeShape
}

export interface EdgeGeometry {
  /** SVG path 的 d 属性 */
  path: string
  /** 起点（世界坐标） */
  start: CanvasPoint
  /** 终点（世界坐标） */
  end: CanvasPoint
  /** 中点，用于挂标签 */
  mid: CanvasPoint
  /** 终点切线角度（度），用于箭头自动转向 */
  endAngle: number
  /** 起止方位，方便渲染层做端口高亮 */
  sourceSide: CanvasPortSide
  targetSide: CanvasPortSide
}

/** 圆角折线：先算拐点，再把每个拐角替换成一段圆弧（radius 世界坐标） */
function orthogonalPath(points: CanvasPoint[], radius: number): string {
  if (points.length < 2) return ''
  let path = `M ${round(points[0]!.x)} ${round(points[0]!.y)}`
  for (let index = 1; index < points.length - 1; index += 1) {
    const prev = points[index - 1]!
    const current = points[index]!
    const next = points[index + 1]!
    const inLength = Math.hypot(current.x - prev.x, current.y - prev.y)
    const outLength = Math.hypot(next.x - current.x, next.y - current.y)
    const r = Math.min(radius, inLength / 2, outLength / 2)
    if (r < 0.5) {
      path += ` L ${round(current.x)} ${round(current.y)}`
      continue
    }
    const inPoint = {
      x: current.x + ((prev.x - current.x) / inLength) * r,
      y: current.y + ((prev.y - current.y) / inLength) * r,
    }
    const outPoint = {
      x: current.x + ((next.x - current.x) / outLength) * r,
      y: current.y + ((next.y - current.y) / outLength) * r,
    }
    path += ` L ${round(inPoint.x)} ${round(inPoint.y)}`
    path += ` Q ${round(current.x)} ${round(current.y)} ${round(outPoint.x)} ${round(outPoint.y)}`
  }
  const last = points[points.length - 1]!
  path += ` L ${round(last.x)} ${round(last.y)}`
  return path
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * 计算一条边的完整几何
 *
 * 贝塞尔控制点的取法与 React Flow / Excalidraw 的手感一致：
 * 沿端口法向量伸出，长度取两点间「主轴距离」的一半，并夹在 [40, 220]，
 * 这样近处的小弯不会塌、远处的长线不会甩得太夸张。
 */
export function edgeGeometry(input: EdgeGeometryInput): EdgeGeometry {
  const { source, target, targetPoint, sourceSide, targetSide, shape = 'bezier' } = input
  const start = portPoint(source, sourceSide)
  const end = target ? portPoint(target, targetSide) : (targetPoint ?? start)
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }

  const startVec = sideVector(sourceSide)
  const endVec = sideVector(targetSide)

  if (shape === 'straight') {
    const angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI
    return {
      path: `M ${round(start.x)} ${round(start.y)} L ${round(end.x)} ${round(end.y)}`,
      start,
      end,
      mid,
      endAngle: angle,
      sourceSide,
      targetSide,
    }
  }

  if (shape === 'orthogonal') {
    const stub = 24
    const a = { x: start.x + startVec.x * stub, y: start.y + startVec.y * stub }
    const b = { x: end.x + endVec.x * stub, y: end.y + endVec.y * stub }
    const points: CanvasPoint[] = [start, a]
    const horizontalExit = sourceSide === 'left' || sourceSide === 'right'
    if (horizontalExit) {
      const midX = (a.x + b.x) / 2
      points.push({ x: midX, y: a.y }, { x: midX, y: b.y })
    } else {
      const midY = (a.y + b.y) / 2
      points.push({ x: a.x, y: midY }, { x: b.x, y: midY })
    }
    points.push(b, end)
    // 去掉重复点，避免长度为 0 的线段让圆角计算出 NaN
    const cleaned = points.filter(
      (point, index) =>
        index === 0 ||
        Math.abs(point.x - points[index - 1]!.x) > 0.01 ||
        Math.abs(point.y - points[index - 1]!.y) > 0.01,
    )
    return {
      path: orthogonalPath(cleaned, 12),
      start,
      end,
      mid,
      endAngle: angleOf(endVec),
      sourceSide,
      targetSide,
    }
  }

  // bezier
  const dx = Math.abs(end.x - start.x)
  const dy = Math.abs(end.y - start.y)
  const along = sourceSide === 'left' || sourceSide === 'right' ? dx : dy
  const curve = Math.min(220, Math.max(40, along * 0.5))
  const c1 = { x: start.x + startVec.x * curve, y: start.y + startVec.y * curve }
  const c2 = { x: end.x + endVec.x * curve, y: end.y + endVec.y * curve }

  return {
    path: `M ${round(start.x)} ${round(start.y)} C ${round(c1.x)} ${round(c1.y)}, ${round(c2.x)} ${round(c2.y)}, ${round(end.x)} ${round(end.y)}`,
    start,
    end,
    mid: bezierMid(start, c1, c2, end),
    endAngle: angleOf(endVec),
    sourceSide,
    targetSide,
  }
}

/** 三次贝塞尔上 t=0.5 的点（比弦中点更贴合视觉中心，标签不会偏到线下） */
function bezierMid(start: CanvasPoint, c1: CanvasPoint, c2: CanvasPoint, end: CanvasPoint) {
  const t = 0.5
  const mt = 1 - t
  const a = mt * mt * mt
  const b = 3 * mt * mt * t
  const c = 3 * mt * t * t
  const d = t * t * t
  return {
    x: a * start.x + b * c1.x + c * c2.x + d * end.x,
    y: a * start.y + b * c1.y + c * c2.y + d * end.y,
  }
}

function angleOf(vector: CanvasPoint): number {
  return (Math.atan2(vector.y, vector.x) * 180) / Math.PI
}

/**
 * 同一节点同一侧的多条边错位
 *
 * 不做错位时，一个节点连出 3 条线会叠在同一个点上，看起来像一条粗线。
 * 这里按索引把端口沿边的方向平移，最多偏移 ±(count-1)/2 * gap。
 */
export function offsetPort(
  point: CanvasPoint,
  side: CanvasPortSide,
  index: number,
  count: number,
  gap = 10,
): CanvasPoint {
  if (count <= 1) return point
  const offset = (index - (count - 1) / 2) * gap
  if (side === 'left' || side === 'right') return { x: point.x, y: point.y + offset }
  return { x: point.x + offset, y: point.y }
}

/** 一组边的渲染键（保证 hover/选中态稳定） */
export function edgeKey(edge: CanvasEdgeBase): string {
  return edge.id
}
