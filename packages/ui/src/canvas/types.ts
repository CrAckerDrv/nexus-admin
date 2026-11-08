/**
 * 无限画布 · 协议层
 *
 * 设计原则（与 @nexus/ui 其它组件一致）：
 * 1. **数据是数据**：节点/连线的形状由宿主定义，组件只认这里的最小字段集合；
 * 2. **geometry 用世界坐标**：`x / y / width / height` 永远是画布坐标系下的 CSS 像素，
 *    相机（平移缩放）只影响渲染，不回写数据 —— 这一点决定了缩放后数据不会漂移；
 * 3. **不依赖 React**：本文件只有类型，渲染层与内核层都能引用。
 *
 * 关于「无限」：
 * 世界坐标没有边界，但为了安全仍然给一个软边界（`WORLD_SOFT_LIMIT`），
 * 只在 fitView / 惯性滑动时用于夹取，正常拖拽不受限制。
 */

/** 相机：屏幕点 = 世界点 * zoom + (x, y) */
export interface CanvasCamera {
  /** 世界坐标在屏幕上的平移量（px） */
  x: number
  /** 世界坐标在屏幕上的平移量（px） */
  y: number
  /** 缩放倍率，1 = 100% */
  zoom: number
}

export interface CanvasPoint {
  x: number
  y: number
}

export interface CanvasRect {
  x: number
  y: number
  width: number
  height: number
}

export interface CanvasSize {
  width: number
  height: number
}

/** 端口方位：决定连线从节点的哪条边出发 */
export type CanvasPortSide = 'left' | 'right' | 'top' | 'bottom'

/** 连线形态 */
export type CanvasEdgeShape = 'bezier' | 'orthogonal' | 'straight'

/** 连线的视觉语义：默认中性色，ai 用流动渐变，强调生成链路 */
export type CanvasEdgeTone = 'neutral' | 'primary' | 'ai' | 'success' | 'warning' | 'danger'

/**
 * 节点协议
 *
 * `data` 泛型留给宿主：画布本身不读它，只在渲染回调里原样透传。
 * 之所以把 `width / height` 放在顶层而不是 data 里：
 * 剔除、fitView、吸附、小地图都需要在**不渲染节点**的情况下读尺寸。
 */
export interface CanvasNodeBase<TData = unknown> {
  id: string
  /** 世界坐标（左上角） */
  x: number
  y: number
  width: number
  height: number
  /** 渲染顺序，越大越靠上（拖拽/选中时会自动提升） */
  z?: number
  /** 锁定后不可拖动、不可缩放，但可选中（用于分组框/参考图） */
  locked?: boolean
  /** 隐藏（仍参与数据，但既不渲染也不参与 fitView） */
  hidden?: boolean
  /** 分组 id：目前只用于渲染顺序与 batch 操作，不做坐标联动 */
  groupId?: string
  data?: TData
}

/**
 * 连线协议
 *
 * 端点既支持「节点 + 方位」也支持「世界坐标点」：
 * - 宿主连节点时只给 `source / target`，由画布按两节点相对方位自动挑边（自动锚点）；
 * - 需要精确控制时给 `sourceSide / targetSide` 覆盖自动选择。
 */
export interface CanvasEdgeBase<TData = unknown> {
  id: string
  /** 起点节点 id */
  source: string
  /** 终点节点 id；为空表示「挂起边」（拖拽中的预览线） */
  target?: string
  /** 显式指定出边方位；缺省自动计算 */
  sourceSide?: CanvasPortSide
  /** 显式指定入边方位；缺省自动计算 */
  targetSide?: CanvasPortSide
  /** 挂起边 / 终点自由时的世界坐标 */
  targetPoint?: CanvasPoint
  /** 形态，默认 bezier */
  shape?: CanvasEdgeShape
  /** 语义色，默认 neutral */
  tone?: CanvasEdgeTone
  /** 中点标签 */
  label?: string
  /** 虚线（草稿态） */
  dashed?: boolean
  /** 线宽（屏幕像素，不随缩放变细/变粗） */
  width?: number
  /** 是否可交互（选中、删除） */
  interactive?: boolean
  data?: TData
}

/** 节点位置变化的批量结果 */
export interface CanvasNodeMove {
  id: string
  x: number
  y: number
}

/** 节点尺寸变化的批量结果 */
export interface CanvasNodeResize {
  id: string
  x: number
  y: number
  width: number
  height: number
}

/** 吸附配置 */
export interface CanvasSnapOptions {
  /** 网格吸附尺寸，0 表示关闭 */
  grid?: number
  /** 是否显示对齐辅助线（节点边缘/中心线与其它节点对齐） */
  guides?: boolean
  /** 吸附阈值（屏幕像素），内部会按 zoom 折算到世界坐标 */
  threshold?: number
}

/** 相机变更回调的元信息 */
export interface CanvasCameraMeta {
  /**
   * 是否已经「落定」
   *
   * 手势过程中 `settled = false`，画布会用 rAF 合帧并避免触发 React 渲染；
   * 手势结束 / 程序化动画结束时为 `true`，此时宿主可以安全地写 store。
   */
  settled: boolean
  /** 变更来源，便于宿主区分「用户操作」与「程序化定位」 */
  source: 'gesture' | 'wheel' | 'pinch' | 'program' | 'resize' | 'init'
}

/** 视口信息（世界坐标下的可见矩形） */
export interface CanvasViewport {
  rect: CanvasRect
  zoom: number
  /** 落在视口内的节点 id 集合（含半屏外扩） */
  visibleIds: ReadonlySet<string>
  /** 真正挂载到 DOM 的节点数（剔除 + LOD 之后） */
  renderedCount: number
  /** 当前是否处于 LOD 聚合态 */
  lod: boolean
  /** LOD 聚合块数量（未聚合时为 0） */
  clusterCount: number
}

/**
 * AI 引擎协议
 *
 * 画布组件只依赖这个接口，不依赖任何具体模型：
 * 宿主注入「本地演示引擎」或「真网关引擎」均可，组件零改动。
 */
export interface CanvasAIRequest {
  /** 触发源节点 id */
  nodeId: string
  /** 节点标题（便于模型理解上下文） */
  title: string
  /** 节点类型标识（text / image / video ...），由宿主定义 */
  kind: string
  /** 节点当前内容的纯文本表示 */
  content: string
  /** 用户的指令或问题 */
  prompt: string
}

export interface CanvasAIHandlers {
  /** 思考链增量（可选，用于展开「模型在动手前想了什么」） */
  onThinking?: (delta: string) => void
  /** 结构化步骤（解析 → 生成 → 校验），用于步骤条 */
  onStep?: (step: { id: string; label: string; status: 'running' | 'done' }) => void
  /** 回答正文增量 */
  onDelta: (delta: string) => void
}

export interface CanvasAIEngine {
  id: string
  /** 展示用名称，如「本地演示引擎」 */
  label: string
  /** 是否已接真实模型（界面上用不同徽标区分） */
  live?: boolean
  run: (request: CanvasAIRequest, handlers: CanvasAIHandlers, signal: AbortSignal) => Promise<void>
}

/** 端口几何（世界坐标） */
export interface CanvasPortGeometry {
  x: number
  y: number
  side: CanvasPortSide
}

/** 渲染上下文：宿主在 renderNode 里拿到的就是它 */
export interface CanvasNodeRenderContext {
  selected: boolean
  dragging: boolean
  /** 当前缩放倍率（用于 LOD：低倍率时可以只画色块） */
  zoom: number
  /** 节流后的稳定缩放：手势中保持不变，用于避免逐帧重算 */
  settledZoom: number
  interactive: boolean
}
