import { clampZoom, screenToWorld, zoomAt } from './math'
import type { CanvasCamera, CanvasPoint } from './types'

/**
 * 手势：滚轮 / 触控板 / 触屏双指
 *
 * 为什么用原生监听而不是 React 的 onWheel：
 * React 在根容器上以 `passive: true` 注册 wheel，`preventDefault()` 无效，
 * 页面会跟着一起滚。这里必须 `{ passive: false }` 才能把滚动交给画布。
 *
 * 三种输入的约定对齐主流工具（Figma / tldraw / Excalidraw）：
 * - 普通滚轮：平移（触控板双指滑动即「平移」）
 * - Ctrl / ⌘ + 滚轮：以光标为中心缩放（Chrome 下触控板捏合就是带 ctrlKey 的 wheel）
 * - Shift + 滚轮：横向平移
 */

export interface WheelBindingOptions {
  element: HTMLElement
  /** 读取当前相机（每次都取最新，避免闭包拿到旧值） */
  getCamera: () => CanvasCamera
  /** 应用新相机（命令式，不触发 React 渲染） */
  applyCamera: (camera: CanvasCamera) => void
  /** 是否已经需要在这次事件后落定（滚轮是离散事件，每次都可以落定） */
  settle: () => void
  /** 非 ctrl 滚轮的行为 */
  wheelBehavior?: 'pan' | 'zoom'
  /** 缩放灵敏度 */
  zoomSpeed?: number
  /** 平移灵敏度 */
  panSpeed?: number
  /** 触控板（有横向 delta 或 deltaMode 为像素级小步长）下的平移倍率 */
  onUserIntent?: () => void
}

/** 把屏幕坐标换算成相对元素的坐标 */
export function localPoint(event: { clientX: number; clientY: number }, element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

/**
 * 绑定滚轮手势，返回解绑函数
 *
 * 注意：`deltaY` 在不同设备上量级差异很大（滚轮 100 / 触控板 3），
 * 这里用「指数缩放」把量级归一：zoom * exp(-delta * k)，
 * 大 delta 时不会一下跳到 4x，小 delta 时也足够灵敏。
 */
export function bindWheelZoom(options: WheelBindingOptions): () => void {
  const {
    element,
    getCamera,
    applyCamera,
    settle,
    wheelBehavior = 'pan',
    zoomSpeed = 0.0015,
    panSpeed = 1,
    onUserIntent,
  } = options

  let frame = 0
  let pending: CanvasCamera | null = null

  const flush = () => {
    frame = 0
    if (!pending) return
    applyCamera(pending)
    pending = null
    settle()
  }

  const queue = (camera: CanvasCamera) => {
    pending = camera
    if (frame) return
    frame = requestAnimationFrame(flush)
  }

  const onWheel = (event: WheelEvent) => {
    const camera = getCamera()
    const point = localPoint(event, element)
    onUserIntent?.()

    // 触控板：ctrlKey 由浏览器合成（捏合），必须拦住，否则浏览器会整体缩放页面
    const zoomIntent = event.ctrlKey || event.metaKey || wheelBehavior === 'zoom'

    if (zoomIntent) {
      event.preventDefault()
      // 归一化：行模式（deltaMode=1）按 16px 折算
      const unit = event.deltaMode === 1 ? 16 : 1
      const factor = Math.exp(-event.deltaY * unit * zoomSpeed)
      queue(zoomAt(camera, point, clampZoom(camera.zoom * factor)))
      return
    }

    // 平移：触控板会同时给 deltaX / deltaY
    event.preventDefault()
    const unit = event.deltaMode === 1 ? 16 : 1
    const dx = -event.deltaX * unit * panSpeed
    const dy = -event.deltaY * unit * panSpeed
    queue({ ...camera, x: camera.x + dx, y: camera.y + dy })
  }

  element.addEventListener('wheel', onWheel, { passive: false })
  return () => {
    element.removeEventListener('wheel', onWheel)
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    pending = null
  }
}

/**
 * 双指捏合（触屏 / 触控板指针事件）
 *
 * 用两次 pointermove 的距离比计算缩放，锚点取两指中点：
 * 这样捏合时「手指下的内容」不会跑掉，符合直觉。
 */
export class PinchTracker {
  private pointers = new Map<number, CanvasPoint>()
  private initialDistance = 0
  private initialZoom = 1
  private initialCenter: CanvasPoint = { x: 0, y: 0 }

  get active(): boolean {
    return this.pointers.size >= 2
  }

  start(pointerId: number, point: CanvasPoint, camera: CanvasCamera) {
    this.pointers.set(pointerId, point)
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()] as [CanvasPoint, CanvasPoint]
      this.initialDistance = Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1)
      this.initialZoom = camera.zoom
      this.initialCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    }
  }

  move(pointerId: number, point: CanvasPoint, camera: CanvasCamera): CanvasCamera | null {
    if (!this.pointers.has(pointerId)) return null
    this.pointers.set(pointerId, point)
    if (this.pointers.size < 2) return null
    const [a, b] = [...this.pointers.values()] as [CanvasPoint, CanvasPoint]
    const distance = Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1)
    const ratio = distance / this.initialDistance
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    // 以两指中点为锚缩放，再叠加中点自身的平移（捏合同时拖动）
    const zoomed = zoomAt(
      { ...camera, zoom: this.initialZoom },
      this.initialCenter,
      clampZoom(this.initialZoom * ratio),
    )
    return { ...zoomed, x: zoomed.x + (center.x - this.initialCenter.x), y: zoomed.y + (center.y - this.initialCenter.y) }
  }

  end(pointerId: number) {
    this.pointers.delete(pointerId)
    if (this.pointers.size < 2) {
      this.initialDistance = 0
      this.initialCenter = { x: 0, y: 0 }
    }
  }

  reset() {
    this.pointers.clear()
    this.initialDistance = 0
  }

  get center() {
    return this.initialCenter
  }

  get zoomBase() {
    return this.initialZoom
  }
}

/** 屏幕点 → 世界点（供手势回调复用，避免每次都传相机） */
export function toWorld(point: CanvasPoint, camera: CanvasCamera): CanvasPoint {
  return screenToWorld(point, camera)
}
