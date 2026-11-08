import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from 'react'
import { cn } from '../lib/utils'
import { CanvasBackground, CanvasGuides, CanvasMarquee } from './background'
import { useCanvasCamera, type CameraStore } from './camera'
import { CanvasContextMenu, type CanvasMenuSection } from './context-menu'
import { CanvasControls, stepZoom } from './controls'
import { edgeGeometry } from './edges'
import { bindWheelZoom, localPoint, PinchTracker } from './gestures'
import {
  autoPortSides,
  clampZoom,
  fitView,
  portPoint,
  rectFromPoints,
  screenToWorld,
  snapRect,
  viewportRect,
} from './math'
import { CanvasMinimap } from './minimap'
import { SpatialIndex } from './spatial'
import type {
  CanvasCamera,
  CanvasCameraMeta,
  CanvasEdgeBase,
  CanvasNodeBase,
  CanvasNodeRenderContext,
  CanvasPoint,
  CanvasPortSide,
  CanvasRect,
  CanvasSize,
  CanvasSnapOptions,
  CanvasViewport,
} from './types'

/**
 * InfiniteCanvas · 无限画布根组件
 *
 * 架构（自下而上）：
 *   手势层 → 相机层（命令式 store + rAF 合帧）→ 空间索引（视口剔除）→ 世界层（CSS transform）
 *                                                                  ↘ SVG 连线层（同一 transform）
 *
 * 三条不可动摇的规则 —— 它们直接决定 1000 个节点能不能跑满帧：
 * 1. 手势期间**不 setState**：相机只写 store，世界层与背景直接改 style；
 * 2. 拖动节点期间**不 setState**：只写节点的 `--c-dx/--c-dy`，松手才提交坐标；
 * 3. 渲染按视口剔除：只挂载相交节点，DOM 数量与「总节点数」解耦。
 *
 * 与 React Flow / tldraw 的差异：这里没有编辑器单例、没有 schema 运行时，
 * 节点内容完全由宿主 `renderNode` 决定 —— 这样它既能当流程图画布，也能当
 * 内容创作画布（文本 / 图片 / 视频节点）用，且不会把业务模型绑进组件库。
 */

/* ------------------------------------------------------------------ *
 * 对外类型
 * ------------------------------------------------------------------ */

export interface CanvasNodeMove {
  id: string
  x: number
  y: number
}

export interface CanvasNodeResize {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface CanvasConnectPayload {
  source: string
  sourceSide: CanvasPortSide
  target: string
  targetSide: CanvasPortSide
}

/** 右键命中的目标（节点部分按需强转成宿主的节点类型） */
export interface CanvasContextTarget<TNode extends CanvasNodeBase = CanvasNodeBase> {
  /** 命中的节点（点在节点上时） */
  node: TNode | null
  /** 命中的连线 id（点在连线上时） */
  edgeId: string | null
  /** 右键位置（屏幕坐标，相对画布容器）与对应世界坐标 */
  screen: CanvasPoint
  world: CanvasPoint
  /** 当前选中的 id 集合（右键空白处时为已有选中，方便「全选/取消」判断） */
  selectedIds: string[]
}

export interface CanvasOverlayApi<TNode extends CanvasNodeBase = CanvasNodeBase> {
  camera: CanvasCamera
  size: CanvasSize
  nodes: TNode[]
  toScreen: (point: CanvasPoint) => CanvasPoint
  getNode: (id: string) => TNode | undefined
  /** 把某个节点居中显示（可指定目标缩放） */
  focusNode: (id: string, zoom?: number) => void
  /**
   * 命令式订阅相机
   *
   * 悬浮层（如节点 AI 对话框）需要在平移缩放时**逐帧**跟随节点，
   * 但它又不能在每帧触发 React 渲染 —— 于是给它一个订阅入口，
   * 由悬浮层自己写 `transform`。
   */
  subscribeCamera: (listener: (camera: CanvasCamera) => void) => () => void
}

export interface InfiniteCanvasHandle {
  getCamera: () => CanvasCamera
  setCamera: (camera: CanvasCamera, animate?: boolean) => void
  fitView: () => void
  fitNode: (id: string, zoom?: number) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  /** 当前挂载的节点数（性能观测用） */
  getVisibleCount: () => number
}

export interface InfiniteCanvasProps<TNode extends CanvasNodeBase = CanvasNodeBase> {
  nodes: TNode[]
  edges: CanvasEdgeBase[]

  camera?: CanvasCamera
  defaultCamera?: CanvasCamera
  onCameraChange?: (camera: CanvasCamera, meta: CanvasCameraMeta) => void

  selectedIds?: string[]
  defaultSelectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void

  onNodesMove?: (changes: CanvasNodeMove[]) => void
  onNodesResize?: (changes: CanvasNodeResize[]) => void
  onConnect?: (payload: CanvasConnectPayload) => void
  onNodesDelete?: (ids: string[]) => void
  onEdgesDelete?: (ids: string[]) => void
  onNodeClick?: (id: string, payload: { world: CanvasPoint }) => void
  onNodeDoubleClick?: (id: string) => void
  onBackgroundClick?: (world: CanvasPoint) => void
  onBackgroundDoubleClick?: (world: CanvasPoint) => void
  /** 每次渲染后回调挂载的节点数（观察剔除效果） */
  onViewportChange?: (viewport: CanvasViewport) => void

  renderNode: (node: TNode, context: CanvasNodeRenderContext) => ReactNode
  renderOverlay?: (api: CanvasOverlayApi<TNode>) => ReactNode
  /**
   * 右键菜单内容
   *
   * 画布只负责「命中谁 + 在哪里弹 + 键盘可操作」，菜单里放什么由宿主决定：
   * 这样组件不必预置业务动作（对齐/复制/删除是宿主的能力），
   * 但又能保证右键在节点、连线、空白三处的行为一致且专业。
   */
  contextMenu?: (target: CanvasContextTarget<TNode>) => CanvasMenuSection[] | null
  /**
   * 低细节聚合（LOD）
   *
   * 缩到很小时，几百上千个节点都在视口内，逐个挂载 DOM 毫无意义：
   * 每个节点在屏幕上只有十几像素，内容根本看不见。
   * 开启后，低于 `zoom` 阈值时把节点按屏幕网格聚合成色块 + 数量，
   * 挂载数与「内容有多复杂」彻底解耦 —— 这是地图引擎与 tldraw 的常见做法。
   */
  lod?: { zoom?: number; /** 聚合格（屏幕像素） */ cell?: number } | false

  background?: 'dots' | 'grid' | 'none'
  controls?: boolean
  minimap?: boolean
  editable?: boolean
  culling?: boolean
  snap?: CanvasSnapOptions
  showGuides?: boolean
  keyboard?: boolean
  className?: string
  ariaLabel?: string
  ref?: Ref<InfiniteCanvasHandle>
}

/* ------------------------------------------------------------------ *
 * 常量
 * ------------------------------------------------------------------ */

const MIN_SIZE = 80
const DRAG_THRESHOLD = 3
const HANDLE_SIZE = 10
const PORT_HIT = 14

type Corner = 'nw' | 'ne' | 'sw' | 'se'

type Interaction =
  | { kind: 'idle' }
  | { kind: 'pinch' }
  | { kind: 'pan'; pointerId: number; startScreen: CanvasPoint; startCamera: CanvasCamera }
  | {
      kind: 'drag'
      pointerId: number
      startScreen: CanvasPoint
      startWorld: CanvasPoint
      ids: string[]
      origin: Map<string, CanvasPoint>
      moved: boolean
    }
  | {
      kind: 'resize'
      pointerId: number
      id: string
      corner: Corner
      startWorld: CanvasPoint
      origin: CanvasRect
      moved: boolean
    }
  | {
      kind: 'marquee'
      pointerId: number
      startWorld: CanvasPoint
      startScreen: CanvasPoint
      additive: boolean
      moved: boolean
    }
  /** 锁定/只读节点上的一次点击：只等 pointerup 派发 nodeClick */
  | { kind: 'tap'; pointerId: number; startScreen: CanvasPoint }
  | { kind: 'connect'; pointerId: number; source: string; sourceSide: CanvasPortSide; point: CanvasPoint }

/* ------------------------------------------------------------------ *
 * 根组件
 * ------------------------------------------------------------------ */

function InfiniteCanvasImpl<TNode extends CanvasNodeBase>(props: InfiniteCanvasProps<TNode>) {
  const {
    nodes,
    edges,
    camera: controlledCamera,
    defaultCamera = { x: 0, y: 0, zoom: 1 },
    onCameraChange,
    selectedIds,
    defaultSelectedIds,
    onSelectionChange,
    onNodesMove,
    onNodesResize,
    onConnect,
    onNodesDelete,
    onEdgesDelete,
    onNodeClick,
    onNodeDoubleClick,
    onBackgroundClick,
    onBackgroundDoubleClick,
    onViewportChange,
    renderNode,
    renderOverlay,
    contextMenu,
    lod,
    background = 'dots',
    controls = true,
    minimap = true,
    editable = true,
    culling = true,
    snap,
    showGuides = true,
    keyboard = true,
    className,
    ariaLabel = '无限画布',
    ref,
  } = props

  const rootRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const edgeLayerRef = useRef<SVGGElement>(null)
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 })
  const sizeRef = useRef(size)
  sizeRef.current = size

  const [spaceDown, setSpaceDown] = useState(false)
  const [marquee, setMarquee] = useState<CanvasRect | null>(null)
  const [guides, setGuides] = useState<Array<{ axis: 'x' | 'y'; value: number; from: number; to: number }>>([])
  const [connectPreview, setConnectPreview] = useState<{ start: CanvasPoint; end: CanvasPoint } | null>(null)
  const [draggingIds, setDraggingIds] = useState<string[]>([])
  const [hoverEdgeId, setHoverEdgeId] = useState<string | null>(null)
  const [resizingId, setResizingId] = useState<string | null>(null)
  /** 右键菜单：位置、内容与抬头 */
  const [menu, setMenu] = useState<{
    x: number
    y: number
    title?: string
    sections: CanvasMenuSection[]
  } | null>(null)

  /* ------------------------------ 数据索引 ------------------------------ */

  /** 按 z 排序后的节点：z 大的在上，命中测试与渲染共用同一顺序 */
  const orderedNodes = useMemo(() => {
    const list = nodes.filter((node) => !node.hidden)
    return [...list].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
  }, [nodes])

  const nodeMap = useMemo(() => {
    const map = new Map<string, TNode>()
    for (const node of nodes) map.set(node.id, node)
    return map
  }, [nodes])

  const nodeMapRef = useRef(nodeMap)
  nodeMapRef.current = nodeMap
  const orderedRef = useRef(orderedNodes)
  orderedRef.current = orderedNodes
  const edgesRef = useRef(edges)
  edgesRef.current = edges

  const spatialRef = useRef<SpatialIndex | null>(null)
  if (!spatialRef.current) spatialRef.current = new SpatialIndex(512)

  /** 几何指纹：只有坐标/尺寸变化时才重建索引，避免每次渲染都 O(n) 同步 */
  const geometryKey = useMemo(
    () =>
      nodes
        .map((node) => `${node.id}:${node.x},${node.y},${node.width},${node.height},${node.hidden ? 1 : 0}`)
        .join('|'),
    [nodes],
  )

  useEffect(() => {
    spatialRef.current?.sync(orderedNodes)
    // orderedNodes 由 nodes 派生，geometryKey 已覆盖几何变化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometryKey])

  /* ------------------------------ 相机 ------------------------------ */

  const { store, camera, zoomAtPoint, center } = useCanvasCamera({
    value: controlledCamera,
    defaultValue: defaultCamera,
    size,
    onChange: (next, settled) =>
      onCameraChange?.(next, { settled, source: settled ? 'program' : 'gesture' }),
  })

  /* ------------------------------ 选中 ------------------------------ */

  const controlledSelection = selectedIds !== undefined
  const [innerSelection, setInnerSelection] = useState<string[]>(defaultSelectedIds ?? [])
  const selection = controlledSelection ? (selectedIds ?? []) : innerSelection
  const selectionSet = useMemo(() => new Set(selection), [selection])
  const selectionRef = useRef(selection)
  selectionRef.current = selection

  const setSelection = useCallback(
    (ids: string[]) => {
      if (!controlledSelection) setInnerSelection(ids)
      onSelectionChange?.(ids)
    },
    [controlledSelection, onSelectionChange],
  )

  /* ------------------------------ 视口剔除 ------------------------------ */

  const [viewport, setViewport] = useState<CanvasViewport>(() => ({
    rect: { x: 0, y: 0, width: 0, height: 0 },
    zoom: 1,
    visibleIds: new Set<string>(),
    renderedCount: 0,
    lod: false,
    clusterCount: 0,
  }))

  const computeVisible = useCallback(
    (nextCamera: CanvasCamera, nextSize: CanvasSize): CanvasViewport => {
      const rect = viewportRect(nextSize, nextCamera)
      if (!culling || nextSize.width === 0 || nextSize.height === 0) {
        const all = new Set(nodeMapRef.current.keys())
        return {
          rect,
          zoom: nextCamera.zoom,
          visibleIds: all,
          renderedCount: all.size,
          lod: false,
          clusterCount: 0,
        }
      }
      // 外扩半屏：滑动时边缘节点不会「刚出现就跳出来」
      const padded: CanvasRect = {
        x: rect.x - rect.width * 0.5,
        y: rect.y - rect.height * 0.5,
        width: rect.width * 2,
        height: rect.height * 2,
      }
      const visible = spatialRef.current?.query(padded) ?? []
      return {
        rect,
        zoom: nextCamera.zoom,
        visibleIds: new Set(visible),
        renderedCount: visible.length,
        lod: false,
        clusterCount: 0,
      }
    },
    [culling],
  )

  useEffect(() => {
    setViewport(computeVisible(camera, size))
  }, [camera, size, computeVisible])

  // 手势结束时再算一次：手势中沿用上一批，避免逐帧挂载卸载
  useEffect(
    () => store.subscribe((next, settled) => settled && setViewport(computeVisible(next, sizeRef.current))),
    [store, computeVisible],
  )

  /**
   * 视口指标回调（具体触发点见文件末尾的渲染段）
   *
   * 「已挂载数」必须等于真正写进 DOM 的数量（剔除 + LOD 之后），
   * 所以它只能放在 visibleNodes / lodClusters 计算完成之后触发 ——
   * 这也正是它被移到渲染段末尾的原因。
   */

  /* ------------------------------ 世界层 transform ------------------------------ */

  const paintWorld = useCallback((next: CanvasCamera) => {
    const world = worldRef.current
    if (world) world.style.transform = `translate3d(${next.x}px, ${next.y}px, 0) scale(${next.zoom})`
  }, [])

  useLayoutEffect(() => {
    paintWorld(store.get())
    return store.subscribe((next) => paintWorld(next))
  }, [store, paintWorld])

  /* ------------------------------ 容器尺寸 ------------------------------ */

  useEffect(() => {
    const element = rootRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      setSize((prev) =>
        Math.abs(prev.width - rect.width) < 0.5 && Math.abs(prev.height - rect.height) < 0.5
          ? prev
          : { width: rect.width, height: rect.height },
      )
    })
    observer.observe(element)
    const rect = element.getBoundingClientRect()
    if (rect.width > 0) setSize({ width: rect.width, height: rect.height })
    return () => observer.disconnect()
  }, [])

  /* ------------------------------ 滚轮 ------------------------------ */

  useEffect(() => {
    const element = rootRef.current
    if (!element) return
    return bindWheelZoom({
      element,
      getCamera: () => store.get(),
      applyCamera: (next) => store.set(next, true),
      settle: () => store.settle(),
    })
  }, [store])

  /* ------------------------------ 指针工具 ------------------------------ */

  const interactionRef = useRef<Interaction>({ kind: 'idle' })
  const pinchRef = useRef(new PinchTracker())
  const resizePreviewRef = useRef<CanvasRect | null>(null)
  const pointersRef = useRef(new Set<number>())
  /**
   * 按下时命中的节点
   *
   * 为什么不在 `onClick` 里用 event.target 找节点：
   * 画布在 pointerdown 时会对根容器 `setPointerCapture`，
   * 之后的 click 事件会被派发到捕获元素（根容器）上，
   * `event.target` 不再是节点本身 —— 于是「点节点打开 AI」会失效。
   * 所以在按下瞬间记录命中，抬起时（未拖动）再据此派发点击。
   */
  const downNodeRef = useRef<string | null>(null)
  const downScreenRef = useRef<CanvasPoint | null>(null)
  const [, forceTick] = useState(0)

  const localPointOf = (event: { clientX: number; clientY: number }): CanvasPoint => {
    const element = rootRef.current
    return element ? localPoint(event, element) : { x: 0, y: 0 }
  }

  const toWorldPoint = useCallback(
    (event: { clientX: number; clientY: number }): CanvasPoint => screenToWorld(localPointOf(event), store.get()),
    [store],
  )

  const hitNode = useCallback((world: CanvasPoint): TNode | null => {
    const list = orderedRef.current
    for (let index = list.length - 1; index >= 0; index -= 1) {
      const node = list[index]!
      if (
        world.x >= node.x &&
        world.x <= node.x + node.width &&
        world.y >= node.y &&
        world.y <= node.y + node.height
      ) {
        return node
      }
    }
    return null
  }, [])

  /** 拖动：只写 CSS 变量，不触发 React 渲染 */
  const paintDrag = useCallback((ids: string[], dx: number, dy: number) => {
    const world = worldRef.current
    if (!world) return
    for (const id of ids) {
      const el = world.querySelector<HTMLElement>(`[data-canvas-node="${CSS.escape(id)}"]`)
      if (!el) continue
      el.style.setProperty('--c-dx', `${dx}px`)
      el.style.setProperty('--c-dy', `${dy}px`)
    }
  }, [])

  const clearPaint = useCallback((ids: string[]) => {
    const world = worldRef.current
    if (!world) return
    for (const id of ids) {
      const el = world.querySelector<HTMLElement>(`[data-canvas-node="${CSS.escape(id)}"]`)
      if (!el) continue
      el.style.removeProperty('--c-dx')
      el.style.removeProperty('--c-dy')
    }
  }, [])

  /** 拖动中：受影响的边实时改 path（同样不走 React） */
  const paintEdges = useCallback((ids: string[], dx: number, dy: number) => {
    const layer = edgeLayerRef.current
    if (!layer) return
    const moved = new Set(ids)
    const list = nodeMapRef.current
    for (const edge of edgesRef.current) {
      if (!moved.has(edge.source) && !(edge.target && moved.has(edge.target))) continue
      const path = layer.querySelector<SVGPathElement>(`[data-edge-path="${CSS.escape(edge.id)}"]`)
      if (!path) continue
      const source = list.get(edge.source)
      if (!source) continue
      const target = edge.target ? list.get(edge.target) : undefined
      const [autoSource, autoTarget] = target ? autoPortSides(source, target) : (['right', 'left'] as const)
      const geometry = edgeGeometry({
        source: {
          x: source.x + (moved.has(source.id) ? dx : 0),
          y: source.y + (moved.has(source.id) ? dy : 0),
          width: source.width,
          height: source.height,
        },
        target: target
          ? {
              x: target.x + (moved.has(target.id) ? dx : 0),
              y: target.y + (moved.has(target.id) ? dy : 0),
              width: target.width,
              height: target.height,
            }
          : undefined,
        targetPoint: edge.targetPoint,
        sourceSide: edge.sourceSide ?? autoSource,
        targetSide: edge.targetSide ?? autoTarget,
        shape: edge.shape,
      })
      path.setAttribute('d', geometry.path)
    }
  }, [])

  /* ------------------------------ 事件 ------------------------------ */

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button === 2) return
    pointersRef.current.add(event.pointerId)

    // 双指：切到捏合
    if (pointersRef.current.size === 2) {
      pinchRef.current.reset()
      pinchRef.current.start(event.pointerId, localPointOf(event), store.get())
      interactionRef.current = { kind: 'pinch' }
      rootRef.current?.setPointerCapture(event.pointerId)
      return
    }

    const target = event.target as HTMLElement
    const handle = target.closest<HTMLElement>('[data-canvas-resize]')
    const port = target.closest<HTMLElement>('[data-canvas-port]')
    const nodeEl = target.closest<HTMLElement>('[data-canvas-node]')
    const world = toWorldPoint(event)
    downNodeRef.current = nodeEl?.dataset.canvasNode ?? null
    downScreenRef.current = localPointOf(event)

    // 1) 空白处：空格/中键=平移，否则=框选
    if (!nodeEl && !handle && !port) {
      rootRef.current?.setPointerCapture(event.pointerId)
      const wantsPan = spaceDown || event.button === 1 || !editable
      interactionRef.current = wantsPan
        ? { kind: 'pan', pointerId: event.pointerId, startScreen: localPointOf(event), startCamera: store.get() }
        : {
            kind: 'marquee',
            pointerId: event.pointerId,
            startWorld: world,
            startScreen: localPointOf(event),
            additive: event.shiftKey || event.metaKey || event.ctrlKey,
            moved: false,
          }
      return
    }

    // 2) 端口：拉连线
    if (port) {
      const nodeId = port.dataset.canvasPort ?? ''
      const side = (port.dataset.side as CanvasPortSide | undefined) ?? 'right'
      const source = nodeMapRef.current.get(nodeId)
      if (!source || !editable) return
      rootRef.current?.setPointerCapture(event.pointerId)
      interactionRef.current = { kind: 'connect', pointerId: event.pointerId, source: nodeId, sourceSide: side, point: world }
      setConnectPreview({ start: portPoint(source, side), end: world })
      return
    }

    // 3) 缩放手柄
    if (handle && nodeEl) {
      const node = nodeMapRef.current.get(nodeEl.dataset.canvasNode ?? '')
      if (!node || node.locked || !editable) return
      rootRef.current?.setPointerCapture(event.pointerId)
      interactionRef.current = {
        kind: 'resize',
        pointerId: event.pointerId,
        id: node.id,
        corner: (handle.dataset.canvasResize as Corner | undefined) ?? 'se',
        startWorld: world,
        origin: { x: node.x, y: node.y, width: node.width, height: node.height },
        moved: false,
      }
      setSelection([node.id])
      return
    }

    // 4) 节点：选中 + 准备拖动
    if (nodeEl) {
      const node = nodeMapRef.current.get(nodeEl.dataset.canvasNode ?? '')
      if (!node) return
      const additive = event.shiftKey || event.metaKey || event.ctrlKey
      const already = selectionRef.current.includes(node.id)
      const next = additive
        ? already
          ? selectionRef.current.filter((id) => id !== node.id)
          : [...selectionRef.current, node.id]
        : already
          ? selectionRef.current
          : [node.id]
      // 同一引用说明选中没变，跳过 setState（避免点一下节点就重渲染整棵树）
      if (next !== selectionRef.current) setSelection(next)

      // 锁定 / 只读：不进入拖拽，但保留「单击」语义（在 pointerup 里派发 nodeClick）
      if (node.locked || !editable) {
        rootRef.current?.setPointerCapture(event.pointerId)
        interactionRef.current = {
          kind: 'tap',
          pointerId: event.pointerId,
          startScreen: localPointOf(event),
        }
        return
      }
      const ids = next.filter((id) => {
        const candidate = nodeMapRef.current.get(id)
        return Boolean(candidate && !candidate.locked && !candidate.hidden)
      })
      const origin = new Map<string, CanvasPoint>()
      for (const id of ids) {
        const candidate = nodeMapRef.current.get(id)
        if (candidate) origin.set(id, { x: candidate.x, y: candidate.y })
      }
      rootRef.current?.setPointerCapture(event.pointerId)
      interactionRef.current = {
        kind: 'drag',
        pointerId: event.pointerId,
        startScreen: localPointOf(event),
        startWorld: world,
        ids,
        origin,
        moved: false,
      }
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current

    // 捏合：两个指针同时移动时只处理相机
    if (interaction.kind === 'pinch') {
      const next = pinchRef.current.move(event.pointerId, localPointOf(event), store.get())
      if (next) store.schedule(() => next)
      return
    }

    switch (interaction.kind) {
      case 'pan': {
        const screen = localPointOf(event)
        const dx = screen.x - interaction.startScreen.x
        const dy = screen.y - interaction.startScreen.y
        store.schedule(() => ({
          zoom: interaction.startCamera.zoom,
          x: interaction.startCamera.x + dx,
          y: interaction.startCamera.y + dy,
        }))
        break
      }

      case 'drag': {
        if (!interaction.moved) {
          const screen = localPointOf(event)
          if (Math.hypot(screen.x - interaction.startScreen.x, screen.y - interaction.startScreen.y) < DRAG_THRESHOLD) break
          interaction.moved = true
          setDraggingIds(interaction.ids)
        }
        const world = toWorldPoint(event)
        let dx = world.x - interaction.startWorld.x
        let dy = world.y - interaction.startWorld.y

        // 吸附只在单选拖动时生效：多选一起拖时参考线会互相打架
        if (snap && interaction.ids.length === 1) {
          const id = interaction.ids[0]!
          const origin = interaction.origin.get(id)
          const node = nodeMapRef.current.get(id)
          if (origin && node) {
            const moving: CanvasRect = {
              x: origin.x + dx,
              y: origin.y + dy,
              width: node.width,
              height: node.height,
            }
            const others: CanvasRect[] = []
            for (const other of orderedRef.current) {
              if (other.id === id) continue
              others.push({ x: other.x, y: other.y, width: other.width, height: other.height })
            }
            const result = snapRect(moving, others, {
              grid: snap.grid,
              threshold: (snap.threshold ?? 6) / store.get().zoom,
            })
            dx += result.dx
            dy += result.dy
            if (showGuides && snap.guides !== false) setGuides(result.guides)
          }
        }

        paintDrag(interaction.ids, dx, dy)
        paintEdges(interaction.ids, dx, dy)
        break
      }

      case 'resize': {
        const world = toWorldPoint(event)
        const { origin, corner } = interaction
        const dx = world.x - interaction.startWorld.x
        const dy = world.y - interaction.startWorld.y
        const next: CanvasRect = { ...origin }
        if (corner === 'se') {
          next.width = Math.max(MIN_SIZE, origin.width + dx)
          next.height = Math.max(MIN_SIZE, origin.height + dy)
        } else if (corner === 'sw') {
          next.width = Math.max(MIN_SIZE, origin.width - dx)
          next.height = Math.max(MIN_SIZE, origin.height + dy)
          next.x = origin.x + origin.width - next.width
        } else if (corner === 'ne') {
          next.width = Math.max(MIN_SIZE, origin.width + dx)
          next.height = Math.max(MIN_SIZE, origin.height - dy)
          next.y = origin.y + origin.height - next.height
        } else {
          next.width = Math.max(MIN_SIZE, origin.width - dx)
          next.height = Math.max(MIN_SIZE, origin.height - dy)
          next.x = origin.x + origin.width - next.width
          next.y = origin.y + origin.height - next.height
        }
        resizePreviewRef.current = next
        interaction.moved = true
        setResizingId(interaction.id)

        const el = worldRef.current?.querySelector<HTMLElement>(`[data-canvas-node="${CSS.escape(interaction.id)}"]`)
        if (el) {
          el.style.width = `${next.width}px`
          el.style.height = `${next.height}px`
          el.style.setProperty('--c-dx', `${next.x - origin.x}px`)
          el.style.setProperty('--c-dy', `${next.y - origin.y}px`)
        }
        paintEdges([interaction.id], next.x - origin.x, next.y - origin.y)
        break
      }

      case 'marquee': {
        const world = toWorldPoint(event)
        if (!interaction.moved) {
          const distance = Math.hypot(world.x - interaction.startWorld.x, world.y - interaction.startWorld.y)
          if (distance * store.get().zoom < DRAG_THRESHOLD) break
          interaction.moved = true
        }
        const rect = rectFromPoints(interaction.startWorld, world)
        setMarquee(rect)
        const hits = spatialRef.current?.query(rect) ?? []
        const base = interaction.additive ? selectionRef.current : []
        const merged = [...new Set([...base, ...hits])]
        const changed =
          merged.length !== selectionRef.current.length ||
          merged.some((id) => !selectionRef.current.includes(id))
        if (changed) setSelection(merged)
        break
      }

      case 'connect': {
        const world = toWorldPoint(event)
        interaction.point = world
        setConnectPreview((prev) => (prev ? { ...prev, end: world } : prev))
        break
      }

      default:
        break
    }
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId)
    pinchRef.current.end(event.pointerId)
    const interaction = interactionRef.current
    interactionRef.current = { kind: 'idle' }
    if (rootRef.current?.hasPointerCapture(event.pointerId)) rootRef.current.releasePointerCapture(event.pointerId)

    switch (interaction.kind) {
      case 'pinch': {
        store.settle()
        break
      }

      case 'pan': {
        store.settle()
        break
      }

      case 'drag': {
        setDraggingIds([])
        setGuides([])
        if (interaction.moved) {
          const world = toWorldPoint(event)
          const dx = world.x - interaction.startWorld.x
          const dy = world.y - interaction.startWorld.y
          const changes: CanvasNodeMove[] = interaction.ids.map((id) => {
            const origin = interaction.origin.get(id) ?? { x: 0, y: 0 }
            return { id, x: Math.round(origin.x + dx), y: Math.round(origin.y + dy) }
          })
          onNodesMove?.(changes)
        } else {
          // 未拖动 = 单击：这里派发 nodeClick，而不是等 onClick ——
          // 指针捕获后 click 的 target 会变成根容器（见 downNodeRef 注释）
          const id = downNodeRef.current
          const start = downScreenRef.current
          const end = localPointOf(event)
          const isTap = start ? Math.hypot(end.x - start.x, end.y - start.y) < DRAG_THRESHOLD : true
          if (id && isTap) onNodeClick?.(id, { world: toWorldPoint(event) })
        }
        // 提交后由新数据接管位置：延迟一帧清掉偏移，避免闪回
        requestAnimationFrame(() => clearPaint(interaction.ids))
        break
      }

      case 'resize': {
        const preview = resizePreviewRef.current
        resizePreviewRef.current = null
        setResizingId(null)
        const el = worldRef.current?.querySelector<HTMLElement>(`[data-canvas-node="${CSS.escape(interaction.id)}"]`)
        if (el) {
          el.style.removeProperty('--c-dx')
          el.style.removeProperty('--c-dy')
          const node = nodeMapRef.current.get(interaction.id)
          if (node) {
            el.style.width = `${node.width}px`
            el.style.height = `${node.height}px`
          }
        }
        if (interaction.moved && preview) {
          onNodesResize?.([
            {
              id: interaction.id,
              x: Math.round(preview.x),
              y: Math.round(preview.y),
              width: Math.round(preview.width),
              height: Math.round(preview.height),
            },
          ])
        }
        break
      }

      case 'marquee': {
        setMarquee(null)
        if (!interaction.moved) {
          setSelection([])
          onBackgroundClick?.(toWorldPoint(event))
        }
        break
      }

      case 'tap': {
        const start = interaction.startScreen
        const end = localPointOf(event)
        if (Math.hypot(end.x - start.x, end.y - start.y) < DRAG_THRESHOLD) {
          const id = downNodeRef.current
          if (id) onNodeClick?.(id, { world: toWorldPoint(event) })
        }
        break
      }

      case 'connect': {
        setConnectPreview(null)
        const world = toWorldPoint(event)
        const target = hitNode(world)
        const source = nodeMapRef.current.get(interaction.source)
        if (target && source && target.id !== source.id) {
          const [, targetSide] = autoPortSides(source, target)
          onConnect?.({
            source: source.id,
            sourceSide: interaction.sourceSide,
            target: target.id,
            targetSide,
          })
        }
        break
      }

      default:
        break
    }
    forceTick((tick) => tick + 1)
  }

  /* ------------------------------ 相机工具 ------------------------------ */

  const contentBounds = useMemo<CanvasRect | null>(() => {
    if (orderedNodes.length === 0) return null
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const node of orderedNodes) {
      minX = Math.min(minX, node.x)
      minY = Math.min(minY, node.y)
      maxX = Math.max(maxX, node.x + node.width)
      maxY = Math.max(maxY, node.y + node.height)
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }, [orderedNodes])

  const fitAll = useCallback(() => {
    if (!contentBounds) return
    store.animateTo(fitView(contentBounds, sizeRef.current, { padding: 72, maxZoom: 1 }))
  }, [contentBounds, store])

  const fitSelection = useCallback(() => {
    const selected = orderedNodes.filter((node) => selectionRef.current.includes(node.id))
    if (selected.length === 0) {
      fitAll()
      return
    }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const node of selected) {
      minX = Math.min(minX, node.x)
      minY = Math.min(minY, node.y)
      maxX = Math.max(maxX, node.x + node.width)
      maxY = Math.max(maxY, node.y + node.height)
    }
    store.animateTo(
      fitView({ x: minX, y: minY, width: maxX - minX, height: maxY - minY }, sizeRef.current, {
        padding: 160,
        maxZoom: 1.4,
      }),
    )
  }, [orderedNodes, store, fitAll])

  const centerOfViewport = useCallback(
    (): CanvasPoint => ({ x: sizeRef.current.width / 2, y: sizeRef.current.height / 2 }),
    [],
  )

  /**
   * 把小地图上的世界点居中到视口
   *
   * `immediate = true` 时**不走动画**：小地图是「拖着走」的控件，
   * 每次 pointermove 都起一段 320ms 缓动，会把连续拖动变成一串互相打断的动画 ——
   * 表现出来就是「拖了但没动、动一下又卡住」。
   * 直接写 store（rAF 合帧）才是跟手的做法，松手时再 settle 一次。
   */
  const jumpToWorld = useCallback(
    (point: CanvasPoint, immediate: boolean) => {
      const zoom = store.get().zoom
      const next: CanvasCamera = {
        zoom,
        x: sizeRef.current.width / 2 - point.x * zoom,
        y: sizeRef.current.height / 2 - point.y * zoom,
      }
      if (immediate) {
        store.stop()
        store.schedule(() => next)
        return
      }
      store.animateTo(next, 260)
    },
    [store],
  )

  const zoomIn = useCallback(() => {
    zoomAtPoint(stepZoom(store.get().zoom, 1), centerOfViewport())
  }, [store, zoomAtPoint, centerOfViewport])

  const zoomOut = useCallback(() => {
    zoomAtPoint(stepZoom(store.get().zoom, -1), centerOfViewport())
  }, [store, zoomAtPoint, centerOfViewport])

  const zoomTo = useCallback(
    (zoom: number) => zoomAtPoint(clampZoom(zoom), centerOfViewport()),
    [zoomAtPoint, centerOfViewport],
  )

  const fitNode = useCallback(
    (id: string, zoom?: number) => {
      const node = nodeMapRef.current.get(id)
      if (!node) return
      const focal = { x: node.x + node.width / 2, y: node.y + node.height / 2 }
      if (zoom !== undefined) {
        center(focal, zoom)
        return
      }
      store.animateTo(
        fitView({ x: node.x, y: node.y, width: node.width, height: node.height }, sizeRef.current, {
          padding: 260,
          maxZoom: 1.6,
        }),
      )
    },
    [store, center],
  )

  useImperativeHandle(
    ref,
    () => ({
      getCamera: () => store.get(),
      setCamera: (next, animate) => (animate ? store.animateTo(next) : store.set(next, true)),
      fitView: fitAll,
      fitNode,
      zoomIn,
      zoomOut,
      resetZoom: () => zoomTo(1),
      getVisibleCount: () => viewport.visibleIds.size,
    }),
    [store, fitAll, fitNode, zoomIn, zoomOut, zoomTo, viewport],
  )

  /* ------------------------------ 键盘 ------------------------------ */

  useEffect(() => {
    if (!keyboard) return
    const element = rootRef.current
    if (!element) return

    const actionable = () => {
      const active = document.activeElement
      if (!active || active === document.body) return true
      if (!element.contains(active)) return false
      const tag = active.tagName.toLowerCase()
      return tag !== 'input' && tag !== 'textarea' && !(active as HTMLElement).isContentEditable
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ' && actionable()) {
        if (!spaceDown) setSpaceDown(true)
        event.preventDefault()
        return
      }
      if (!actionable()) return
      const isMod = event.ctrlKey || event.metaKey

      if (isMod && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        setSelection(orderedRef.current.map((node) => node.id))
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectionRef.current.length === 0) return
        event.preventDefault()
        onNodesDelete?.(selectionRef.current)
        return
      }
      if (event.key === 'Escape') {
        setSelection([])
        return
      }
      if (event.shiftKey && event.code === 'Digit1') {
        event.preventDefault()
        fitAll()
        return
      }
      if (event.shiftKey && event.code === 'Digit2') {
        event.preventDefault()
        fitSelection()
        return
      }
      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        zoomIn()
        return
      }
      if (event.key === '-') {
        event.preventDefault()
        zoomOut()
        return
      }
      if (event.key === '0') {
        event.preventDefault()
        zoomTo(1)
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === ' ') setSpaceDown(false)
    }
    const onBlur = () => setSpaceDown(false)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [keyboard, spaceDown, setSelection, onNodesDelete, fitAll, fitSelection, zoomIn, zoomOut, zoomTo])

  /* ------------------------------ 渲染 ------------------------------ */

  /**
   * LOD 聚合：缩得很小时按屏幕网格合并
   *
   * 触发条件：`lod` 开启 && 当前缩放低于阈值 && 视口内节点数超过 120。
   * 前者保证「看得见内容时不合并」，后者避免只有 20 个节点时白白牺牲精度。
   */
  const lodEnabled = Boolean(lod) && viewport.zoom < (lod ? (lod.zoom ?? 0.3) : 0)
  const lodClusters = useMemo(() => {
    if (!lodEnabled) return null
    const cell = lod && lod.cell ? lod.cell : 56
    const buckets = new Map<
      string,
      { minX: number; minY: number; maxX: number; maxY: number; count: number }
    >()
    for (const node of orderedNodes) {
      // 按「节点中心的屏幕坐标」分桶：屏幕格固定，所以缩小后同屏节点自然合并
      const screenX = (node.x + node.width / 2) * viewport.zoom + camera.x
      const screenY = (node.y + node.height / 2) * viewport.zoom + camera.y
      const key = `${Math.floor(screenX / cell)}:${Math.floor(screenY / cell)}`
      const worldX = node.x + node.width / 2
      const worldY = node.y + node.height / 2
      const bucket = buckets.get(key)
      if (bucket) {
        bucket.count += 1
        bucket.minX = Math.min(bucket.minX, worldX)
        bucket.minY = Math.min(bucket.minY, worldY)
        bucket.maxX = Math.max(bucket.maxX, worldX)
        bucket.maxY = Math.max(bucket.maxY, worldY)
      } else {
        buckets.set(key, { minX: worldX, minY: worldY, maxX: worldX, maxY: worldY, count: 1 })
      }
    }
    return [...buckets.values()]
  }, [lodEnabled, lod, orderedNodes, viewport.zoom, camera.x, camera.y])

  const visibleNodes = useMemo(() => {
    if (!culling || viewport.visibleIds.size === 0) return orderedNodes
    // 选中与拖动中的节点永远渲染：避免「拖出视口就消失」的错觉
    const keep = new Set([...selectionRef.current, ...draggingIds, ...(resizingId ? [resizingId] : [])])
    return orderedNodes.filter((node) => viewport.visibleIds.has(node.id) || keep.has(node.id))
  }, [orderedNodes, culling, viewport, draggingIds, resizingId])

  const edgeGeometryList = useMemo(() => {
    const list: Array<{
      edge: CanvasEdgeBase
      path: string
      mid: CanvasPoint
    }> = []
    for (const edge of edges) {
      const source = nodeMap.get(edge.source)
      if (!source) continue
      const target = edge.target ? nodeMap.get(edge.target) : undefined
      if (edge.target && !target) continue
      const [autoSource, autoTarget] = target ? autoPortSides(source, target) : (['right', 'left'] as const)
      const geometry = edgeGeometry({
        source,
        target,
        targetPoint: edge.targetPoint,
        sourceSide: edge.sourceSide ?? autoSource,
        targetSide: edge.targetSide ?? autoTarget,
        shape: edge.shape,
      })
      list.push({ edge, path: geometry.path, mid: geometry.mid })
    }
    return list
  }, [edges, nodeMap])

  const overlayApi = useMemo<CanvasOverlayApi<TNode>>(
    () => ({
      camera,
      size,
      nodes,
      toScreen: (point) => ({ x: point.x * camera.zoom + camera.x, y: point.y * camera.zoom + camera.y }),
      getNode: (id) => nodeMap.get(id),
      focusNode: (id, zoom) => fitNode(id, zoom),
      subscribeCamera: (listener) => store.subscribe((next) => listener(next)),
    }),
    [camera, size, nodes, nodeMap, fitNode, store],
  )

  const subscribe = useCallback(
    (listener: (next: CanvasCamera, settled: boolean) => void) => store.subscribe(listener),
    [store],
  )

  /* ------------------------------ 视口指标 ------------------------------ */

  /**
   * 向上报告「真正挂载了多少」
   *
   * 必须放在 visibleNodes / lodClusters 之后：宿主用它做性能 HUD 时，
   * 数字要等于 DOM 里真实存在的节点数，否则「剔除是否生效」就无法证明。
   */
  useEffect(() => {
    onViewportChange?.({
      ...viewport,
      renderedCount: lodClusters ? lodClusters.length : visibleNodes.length,
      lod: Boolean(lodClusters),
      clusterCount: lodClusters?.length ?? 0,
    })
  }, [viewport, visibleNodes, lodClusters, onViewportChange])

  return (
    <div
      ref={rootRef}
      data-canvas-root=""
      data-space-panning={spaceDown ? '' : undefined}
      className={cn('n-canvas relative isolate size-full overflow-hidden select-none', className)}
      role="application"
      aria-label={ariaLabel}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(event: ReactMouseEvent<HTMLDivElement>) => {
        if (!contextMenu) return
        event.preventDefault()
        const target = event.target as HTMLElement
        const nodeEl = target.closest<HTMLElement>('[data-canvas-node]')
        const edgeEl = target.closest<HTMLElement>('[data-canvas-edge]')
        const world = toWorldPoint(event)

        // 右键节点：若该节点不在选中集合里，先选中它（与桌面软件一致）
        let selected = selectionRef.current
        if (nodeEl) {
          const id = nodeEl.dataset.canvasNode ?? ''
          if (id && !selected.includes(id)) {
            selected = [id]
            setSelection(selected)
          }
        }

        const sections = contextMenu({
          node: nodeEl ? (nodeMapRef.current.get(nodeEl.dataset.canvasNode ?? '') ?? null) : null,
          edgeId: edgeEl?.dataset.canvasEdge ?? null,
          screen: localPointOf(event),
          world,
          selectedIds: selected,
        })
        if (!sections || sections.length === 0) return

        const pick = nodeEl
          ? nodeMapRef.current.get(nodeEl.dataset.canvasNode ?? '')
          : null
        const edgeId = edgeEl?.dataset.canvasEdge ?? null
        setMenu({
          ...localPointOf(event),
          title: pick ? `节点 · ${pick.id}` : edgeId ? `连线 · ${edgeId}` : `画布 · ${Math.round(world.x)}, ${Math.round(world.y)}`,
          sections,
        })
      }}
      onDoubleClick={(event: ReactMouseEvent<HTMLDivElement>) => {
        /**
         * 双击归属判定
         *
         * 不能只看 `event.target`：画布在 pointerdown 时 `setPointerCapture`，
         * 双击里的 click / dblclick 会被派发到**捕获元素（根容器）**上，
         * target 不再指向节点。早先只靠 closest 判断，导致
         * 「双击一张卡片」被误判成「双击了空白处」→ 凭空多出一个文本节点。
         * 因此优先用按下瞬间记录的命中节点（downNodeRef），target 只作兜底。
         */
        const hitId =
          downNodeRef.current ??
          (event.target as HTMLElement).closest<HTMLElement>('[data-canvas-node]')?.dataset.canvasNode ??
          null
        if (hitId) {
          onNodeDoubleClick?.(hitId)
          return
        }
        onBackgroundDoubleClick?.(toWorldPoint(event))
      }}
      onClick={(event: ReactMouseEvent<HTMLDivElement>) => {
        // 空白处点击由 marquee 分支处理；节点点击在 pointerup 里派发（指针捕获会改 target）
        void event
      }}
      style={{ touchAction: 'none' }}
    >
      <CanvasBackground variant={background} camera={camera} subscribe={subscribe} />

      {/* 世界层：唯一一次 transform，节点与连线共用，保证永远对齐 */}
      <div ref={worldRef} data-canvas-world="" className="n-canvas-world">
        <svg
          className="pointer-events-none absolute overflow-visible"
          style={{ left: 0, top: 0, width: 1, height: 1 }}
          aria-hidden="true"
        >
          <g ref={edgeLayerRef}>
            <defs>
              <marker
                id="n-canvas-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M0 1 L9 5 L0 9 z" fill="var(--n-border-strong)" />
              </marker>
              <marker
                id="n-canvas-arrow-ai"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M0 1 L9 5 L0 9 z" fill="var(--n-primary)" />
              </marker>
            </defs>

            {edgeGeometryList.map(({ edge, path, mid }) => {
              const tone = edge.tone ?? 'neutral'
              const hovered = hoverEdgeId === edge.id
              return (
                <g key={edge.id} data-canvas-edge={edge.id}>
                  <path
                    data-edge-path={edge.id}
                    d={path}
                    fill="none"
                    className={cn(
                      'n-canvas-edge',
                      `n-canvas-edge--${tone}`,
                      edge.dashed && 'n-canvas-edge--dashed',
                      hovered && 'is-hovered',
                    )}
                    strokeWidth={edge.width ?? 1.6}
                    markerEnd={tone === 'ai' ? 'url(#n-canvas-arrow-ai)' : 'url(#n-canvas-arrow)'}
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* 透明命中带：细线也能点中 */}
                  <path
                    d={path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={18}
                    className="pointer-events-auto cursor-pointer"
                    vectorEffect="non-scaling-stroke"
                    onPointerEnter={() => setHoverEdgeId(edge.id)}
                    onPointerLeave={() => setHoverEdgeId((current) => (current === edge.id ? null : current))}
                    onDoubleClick={(event) => {
                      event.stopPropagation()
                      if (edge.interactive !== false) onEdgesDelete?.([edge.id])
                    }}
                  />
                  {edge.label && (
                    <foreignObject x={mid.x - 90} y={mid.y - 13} width={180} height={26} className="overflow-visible">
                      <div className="flex justify-center">
                        <span className="n-canvas-edge-label" style={{ fontSize: 11 / Math.max(viewport.zoom, 0.4) }}>
                          {edge.label}
                        </span>
                      </div>
                    </foreignObject>
                  )}
                </g>
              )
            })}

            {connectPreview && (
              <path
                d={`M ${connectPreview.start.x} ${connectPreview.start.y} L ${connectPreview.end.x} ${connectPreview.end.y}`}
                fill="none"
                className="n-canvas-edge n-canvas-edge--preview"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </g>
        </svg>

        {/* LOD：缩得太小时按屏幕网格聚合成色块，挂载数与文档规模解耦 */}
        {lodClusters?.map((cluster) => (
          <button
            key={`lod-${cluster.minX}-${cluster.minY}`}
            type="button"
            data-canvas-lod=""
            className="n-canvas-lod"
            title={`${cluster.count} 个节点，点击放大到此区域`}
            style={{
              // 聚合块以世界坐标定位，尺寸按屏幕恒定像素 / zoom 折算
              left: cluster.minX,
              top: cluster.minY,
              width: (26 + Math.min(cluster.count, 40) * 0.6) / viewport.zoom,
              height: 18 / viewport.zoom,
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              const rect = {
                x: cluster.minX - 240,
                y: cluster.minY - 160,
                width: 480,
                height: 320,
              }
              store.animateTo(fitView(rect, sizeRef.current, { padding: 60, maxZoom: 1 }))
            }}
          >
            <span>{cluster.count}</span>
          </button>
        ))}

        {lodClusters
          ? null
          : visibleNodes.map((node) => {
              const isSelected = selectionSet.has(node.id)
              const isDragging = draggingIds.includes(node.id)
              const context: CanvasNodeRenderContext = {
                selected: isSelected,
                dragging: isDragging,
                zoom: viewport.zoom,
                settledZoom: camera.zoom,
                interactive: editable && !node.locked,
              }
              return (
                <div
                  key={node.id}
                  data-canvas-node={node.id}
                  data-selected={isSelected ? '' : undefined}
                  data-locked={node.locked ? '' : undefined}
                  className={cn('n-canvas-node', isSelected && 'is-selected', isDragging && 'is-dragging')}
                  style={{ left: node.x, top: node.y, width: node.width, height: node.height, zIndex: node.z ?? 0 }}
                >
                  {renderNode(node, context)}
                  {editable && !node.locked && (
                    <>
                      <ResizeHandles />
                      <NodePorts id={node.id} />
                    </>
                  )}
                </div>
              )
            })}
      </div>

      <CanvasMarquee rect={marquee ? toScreenRect(marquee, store.get()) : null} />
      {showGuides && <CanvasGuides guides={guides} camera={camera} size={size} />}

      {contextMenu && (
        <CanvasContextMenu
          open={menu !== null}
          x={menu?.x ?? 0}
          y={menu?.y ?? 0}
          title={menu?.title}
          sections={menu?.sections ?? []}
          containerSize={size}
          onClose={() => setMenu(null)}
        />
      )}

      {controls && (
        <CanvasControls
          camera={camera}
          subscribe={subscribe}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onFit={fitAll}
          onResetZoom={() => zoomTo(1)}
        />
      )}

      {minimap && size.width > 0 && contentBounds && (
        <CanvasMinimap
          camera={camera}
          subscribe={subscribe}
          size={size}
          bounds={contentBounds}
          nodes={orderedNodes}
          className={controls ? undefined : 'bottom-3'}
          onJump={(point, meta) => {
            // 拖动中立即生效（不起动画），松手瞬间才做一次平滑收尾
            jumpToWorld(point, meta?.dragging === true)
            if (meta?.dragging === false) store.settle()
          }}
        />
      )}

      {renderOverlay?.(overlayApi)}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 子组件：缩放手柄 / 端口
 * ------------------------------------------------------------------ */

const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se']

function ResizeHandles() {
  return (
    <>
      {CORNERS.map((corner) => (
        <span
          key={corner}
          data-canvas-resize={corner}
          aria-hidden="true"
          className={cn('n-canvas-handle', `n-canvas-handle--${corner}`)}
          style={{ width: HANDLE_SIZE, height: HANDLE_SIZE }}
        />
      ))}
    </>
  )
}

function NodePorts({ id }: { id: string }) {
  const sides: CanvasPortSide[] = ['top', 'right', 'bottom', 'left']
  return (
    <>
      {sides.map((side) => (
        <span
          key={side}
          data-canvas-port={id}
          data-side={side}
          aria-hidden="true"
          className={cn('n-canvas-port', `n-canvas-port--${side}`)}
          style={{ width: PORT_HIT, height: PORT_HIT }}
        />
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ *
 * 工具
 * ------------------------------------------------------------------ */

function toScreenRect(rect: CanvasRect, camera: CanvasCamera): CanvasRect {
  return {
    x: rect.x * camera.zoom + camera.x,
    y: rect.y * camera.zoom + camera.y,
    width: rect.width * camera.zoom,
    height: rect.height * camera.zoom,
  }
}

/* ------------------------------------------------------------------ *
 * 导出
 *
 * 泛型组件 + memo：内部实现是泛型函数，边界做一次类型断言，
 * 让调用方既能拿到泛型推导，又不会因为 memo 丢掉 ref。
 * ------------------------------------------------------------------ */

const MemoCanvas = memo(InfiniteCanvasImpl) as unknown as <TNode extends CanvasNodeBase>(
  props: InfiniteCanvasProps<TNode>,
) => ReactNode

export const InfiniteCanvas = MemoCanvas

/** 供宿主在拖拽结束后复用的相机类型别名 */
export type { CameraStore }
