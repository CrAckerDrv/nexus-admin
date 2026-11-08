import { useCallback, useEffect, useRef, useState } from 'react'
import { cameraEquals, clampCamera, clampZoom, fitView, zoomAt } from './math'
import type { CanvasCamera, CanvasPoint, CanvasRect, CanvasSize } from './types'

/**
 * 相机 store（画布的「视图状态」）
 *
 * 三条设计原则，直接决定画布能不能跑满 60fps：
 *
 * 1. **手势期间不进 React**：`apply()` 只写内部 ref 并 rAF 合帧，
 *    通过 `subscribe` 通知「命令式订阅者」（世界层的 transform 直接改 style）；
 *    React 组件只在 `settle` 之后才拿到新值。
 * 2. **同一个世界层 transform**：平移与缩放合并成一次 `translate3d(...) scale(...)`，
 *    由 GPU 合成，不触发布局。
 * 3. **可动画**：程序化定位（fitView / 居中）用 rAF 缓动，用户一旦操作立即打断。
 */

type Listener = (camera: CanvasCamera, settled: boolean) => void

export interface CameraStore {
  get: () => CanvasCamera
  set: (next: CanvasCamera, settled?: boolean) => void
  apply: (mutate: (camera: CanvasCamera) => CanvasCamera) => void
  subscribe: (listener: Listener) => () => void
  /** 单帧内合并多次写入 */
  schedule: (mutate: (camera: CanvasCamera) => CanvasCamera) => void
  /** 缓动到目标相机；返回取消函数 */
  animateTo: (target: CanvasCamera, duration?: number) => () => void
  stop: () => void
  /** 手势结束：把最终值同步给 React，并停止惯性 */
  settle: () => void
  /** 惯性滑动 */
  slide: (velocity: CanvasPoint) => void
}

export function createCameraStore(initial: CanvasCamera): CameraStore {
  let camera = initial
  let settled = true
  let frame = 0
  let animFrame = 0
  const listeners = new Set<Listener>()
  const lastEmitted = { x: initial.x, y: initial.y, zoom: initial.zoom }

  const emit = (nextSettled: boolean) => {
    if (cameraEquals(lastEmitted, camera) && nextSettled === settled) return
    lastEmitted.x = camera.x
    lastEmitted.y = camera.y
    lastEmitted.zoom = camera.zoom
    settled = nextSettled
    for (const listener of listeners) listener(camera, nextSettled)
  }

  const store: CameraStore = {
    get: () => camera,

    set(next, nextSettled = true) {
      camera = next
      emit(nextSettled)
    },

    apply(mutate) {
      camera = mutate(camera)
      emit(false)
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    schedule(mutate) {
      camera = mutate(camera)
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        emit(false)
      })
    },

    animateTo(target, duration = 320) {
      if (animFrame) cancelAnimationFrame(animFrame)
      const from = { ...camera }
      const start =
        typeof performance !== 'undefined' ? performance.now() : Date.parse(new Date().toISOString())

      const tick = (now: number) => {
        const progress = duration <= 0 ? 1 : Math.min((now - start) / duration, 1)
        // easeOutExpo：起步快、收尾缓，符合「跳到目标」的心理预期
        const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
        camera = {
          x: from.x + (target.x - from.x) * eased,
          y: from.y + (target.y - from.y) * eased,
          zoom: from.zoom + (target.zoom - from.zoom) * eased,
        }
        emit(progress === 1)
        if (progress < 1) animFrame = requestAnimationFrame(tick)
        else animFrame = 0
      }
      animFrame = requestAnimationFrame(tick)
      return () => {
        if (animFrame) cancelAnimationFrame(animFrame)
        animFrame = 0
      }
    },

    stop() {
      if (frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
      if (animFrame) {
        cancelAnimationFrame(animFrame)
        animFrame = 0
      }
    },

    settle() {
      if (frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
      emit(true)
    },

    slide(velocity) {
      let momentum = { ...velocity }
      const friction = 0.9
      const tick = () => {
        momentum = { x: momentum.x * friction, y: momentum.y * friction }
        if (Math.abs(momentum.x) < 0.15 && Math.abs(momentum.y) < 0.15) {
          frame = 0
          store.settle()
          return
        }
        camera = { ...camera, x: camera.x + momentum.x, y: camera.y + momentum.y }
        emit(false)
        frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    },
  }

  return store
}

/* ------------------------------------------------------------------ *
 * React 绑定
 * ------------------------------------------------------------------ */

interface UseCanvasCameraOptions {
  value?: CanvasCamera
  defaultValue?: CanvasCamera
  onChange?: (camera: CanvasCamera, settled: boolean) => void
  size: CanvasSize
}

/**
 * 相机 Hook：受控 + 非受控双模式，与组件库其它组件（useControllableState）一致
 *
 * 返回的 `camera` 是「已落定」的 React 快照 —— 手势中它不会逐帧变化，
 * 因此用它做重渲染的组件（小地图、缩放百分比文本）不会被拖慢。
 */
export function useCanvasCamera(options: UseCanvasCameraOptions) {
  const { value, defaultValue, onChange, size } = options
  const controlled = value !== undefined
  const storeRef = useRef<CameraStore | null>(null)
  if (!storeRef.current) {
    storeRef.current = createCameraStore(value ?? defaultValue ?? { x: 0, y: 0, zoom: 1 })
  }
  const store = storeRef.current

  const [camera, setCameraState] = useState<CanvasCamera>(() => store.get())
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const sizeRef = useRef(size)
  sizeRef.current = size

  // 订阅命令式更新：只在落定（settled）时同步到 React
  useEffect(() => {
    return store.subscribe((next, isSettled) => {
      onChangeRef.current?.(next, isSettled)
      if (isSettled) setCameraState(next)
    })
  }, [store])

  // 受控模式：外部值变化时同步进 store（不回调 onChange，避免回环）
  useEffect(() => {
    if (!controlled || !value) return
    if (cameraEquals(store.get(), value)) return
    store.set(value, true)
  }, [controlled, value, store])

  const commit = useCallback(
    (mutate: (current: CanvasCamera) => CanvasCamera) => {
      const next = mutate(store.get())
      store.set(next, true)
    },
    [store],
  )

  const zoomAtPoint = useCallback(
    (nextZoom: number, anchor: CanvasPoint) => {
      store.apply((current) => zoomAt(current, anchor, nextZoom))
      store.settle()
    },
    [store],
  )

  const fit = useCallback(
    (rect: CanvasRect | null, options?: { padding?: number; maxZoom?: number }) => {
      if (!rect) return
      const target = fitView(rect, sizeRef.current, options)
      store.animateTo(target)
    },
    [store],
  )

  const center = useCallback(
    (point: CanvasPoint, zoom?: number) => {
      const { width, height } = sizeRef.current
      const z = clampZoom(zoom ?? store.get().zoom)
      store.animateTo({
        zoom: z,
        x: width / 2 - point.x * z,
        y: height / 2 - point.y * z,
      })
    },
    [store],
  )

  const clampToWorld = useCallback(() => {
    store.apply((current) => clampCamera(current, sizeRef.current))
  }, [store])

  return { store, camera, commit, zoomAtPoint, fit, center, clampToWorld }
}
