/**
 * 无限画布子系统
 *
 * 分层导出，宿主可以按需要取用：
 * - **组件**：`InfiniteCanvas`（根）、`CanvasNodeFrame`（节点外壳）、`CanvasAIPopover`（节点 AI 对话框）、
 *   `CanvasMinimap`（小地图）、`CanvasControls`（缩放控件）、`CanvasBackground`（点阵背景）
 * - **内核**：几何运算、空间索引、连线几何、撤销栈、相机 store —— 都是纯 TS，可在组件外单独使用
 * - **协议**：节点/连线/AI 引擎的类型
 *
 * 之所以把内核也导出：画布之外（如性能面板、导出器、协作层）常常需要
 * 用同一套坐标换算，重复实现必然对不齐。
 */

/* ------------------------------ 组件 ------------------------------ */
export { InfiniteCanvas } from './infinite-canvas'
export type {
  InfiniteCanvasProps,
  InfiniteCanvasHandle,
  CanvasOverlayApi,
  CanvasContextTarget,
  CanvasNodeMove,
  CanvasNodeResize,
  CanvasConnectPayload,
} from './infinite-canvas'

export {
  CanvasNodeFrame,
  CanvasInlineEdit,
  CanvasNodeMenu,
  CanvasNodeStatus,
  CanvasNodeCheck,
  CanvasNodeClose,
} from './node-frame'
export type {
  CanvasNodeFrameProps,
  CanvasNodeTone,
  CanvasInlineEditProps,
  CanvasNodeMenuItem,
} from './node-frame'

export { CanvasAIPopover, CanvasAIStatus, createDemoEngine, aiContentOf, resolveAIPopoverPosition } from './ai-popover'
export type { CanvasAIPopoverProps } from './ai-popover'

export { CanvasAIDock } from './ai-dock'
export type { CanvasAIDockProps } from './ai-dock'

export { CanvasNodeToolbar } from './node-toolbar'
export type { CanvasNodeToolbarProps, CanvasNodeToolbarItem } from './node-toolbar'

export { CanvasMinimap } from './minimap'
export type { CanvasMinimapProps } from './minimap'

export { CanvasContextMenu } from './context-menu'
export type { CanvasContextMenuProps, CanvasMenuItem, CanvasMenuSection } from './context-menu'

export { CanvasControls, stepZoom } from './controls'
export type { CanvasControlsProps } from './controls'

export { CanvasBackground, CanvasMarquee, CanvasGuides } from './background'
export type { CanvasBackgroundProps, CanvasBackgroundVariant } from './background'

/* ------------------------------ 内核 ------------------------------ */
export {
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEPS,
  clamp,
  clampZoom,
  clampCamera,
  worldToScreen,
  screenToWorld,
  screenToWorldSize,
  zoomAt,
  nextZoomStep,
  prevZoomStep,
  cameraEquals,
  rectFromPoints,
  rectFromNode,
  rectIntersects,
  rectContains,
  rectUnion,
  rectFromRects,
  rectInflate,
  viewportRect,
  fitView,
  centerOn,
  portPoint,
  autoPortSides,
  sideVector,
  pointInRect,
  snapRect,
  snapToGrid,
} from './math'

export { SpatialIndex } from './spatial'

export { edgeGeometry, offsetPort } from './edges'
export type { EdgeGeometryInput, EdgeGeometry } from './edges'

export { createHistory, useCanvasHistory } from './history'
export type { HistoryController, HistoryOptions } from './history'

export { createCameraStore, useCanvasCamera } from './camera'
export type { CameraStore } from './camera'

export { bindWheelZoom, PinchTracker, localPoint } from './gestures'
export type { WheelBindingOptions } from './gestures'

/* ------------------------------ 图标 ------------------------------
 * 画布内置的一套 24×24 线性图标：与 lucide 观感一致，但留在包内，
 * 保证 @nexus/ui 不被迫依赖图标库。
 * ------------------------------------------------------------------ */
export {
  CheckIcon,
  CloseIcon,
  CopyIcon,
  DownloadIcon,
  FitIcon,
  GridIcon,
  GroupIcon,
  HelpIcon,
  ImageIcon,
  LockIcon,
  MapIcon,
  MinusIcon,
  MoreIcon,
  NoteIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RedoIcon,
  RefreshIcon,
  SendIcon,
  SparkIcon,
  StopIcon,
  TextIcon,
  TrashIcon,
  UndoIcon,
  UnlockIcon,
  VideoIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from './icons'

/* ------------------------------ 协议 ------------------------------ */
export type {
  CanvasCamera,
  CanvasCameraMeta,
  CanvasPoint,
  CanvasRect,
  CanvasSize,
  CanvasPortSide,
  CanvasPortGeometry,
  CanvasEdgeShape,
  CanvasEdgeTone,
  CanvasEdgeBase,
  CanvasNodeBase,
  CanvasNodeRenderContext,
  CanvasSnapOptions,
  CanvasViewport,
  CanvasAIEngine,
  CanvasAIRequest,
  CanvasAIHandlers,
} from './types'

/* 连线几何的结果类型（renderOverlay 等处会用） */
export type { SnapResult } from './math'
