export {
  cn,
  formatNumber,
  formatCompact,
  formatCurrency,
  formatPercent,
  formatRelativeTime,
  formatDateTime,
  formatBytes,
  copyText,
  randomId,
  debounce,
  clamp,
  fuzzyMatch,
  avatarColor,
} from './lib/utils'
export {
  sx,
  sxSize,
  ChromeScope,
  useInChrome,
  useChromePortal,
  DESIGN_ROOT_FONT,
} from './lib/scale'
export {
  useControllableState,
  useMediaQuery,
  useBreakpoint,
  useClickOutside,
  useResizeObserver,
  useElementSize,
  useLocalStorageState,
  useCountdown,
  useHotkey,
  useIsomorphicLayoutEffect,
  useMotionEnabled,
  isMotionEnabled,
  configureUILabels,
  useUILabels,
  DEFAULT_UI_LABELS,
} from './lib/hooks'
export type { UILabels } from './lib/hooks'

export { Button, ButtonGroup, buttonVariants } from './components/button'
export type { ButtonProps, ButtonVariant, ButtonSize, ButtonGroupProps } from './components/button'

export { Spinner, LoadingOverlay } from './components/spinner'
export type { SpinnerProps, LoadingOverlayProps } from './components/spinner'

export { Card, CardHeader, CardBody, CardFooter, SectionCard } from './components/card'
export type { CardProps, CardHeaderProps } from './components/card'

export { Badge, StatusDot, CountTag } from './components/badge'
export type { BadgeProps, BadgeVariant, Tone } from './components/badge'

export { EmptyState } from './components/empty-state'
export type { EmptyStateProps } from './components/empty-state'

export { Skeleton, SkeletonText, SkeletonTable } from './components/skeleton'
export type { SkeletonProps } from './components/skeleton'

export { Input, Textarea, FormField, ReadonlyValue, useFieldContext } from './components/input'
export type { InputProps, TextareaProps, FormFieldProps, FieldStatus } from './components/input'

export { Select } from './components/select'
export type { SelectProps, SelectOption } from './components/select'

export { Switch, Checkbox, RadioGroup } from './components/toggle'
export type { SwitchProps, CheckboxProps, RadioGroupProps } from './components/toggle'

export { Slider, SegmentedControl } from './components/slider'
export type { SliderProps, SegmentedControlProps } from './components/slider'

export { Dialog, ConfirmDialog, Drawer } from './components/dialog'
export type { DialogProps, ConfirmDialogProps, DrawerProps } from './components/dialog'

export { Dropdown } from './components/dropdown'
export type { DropdownProps, DropdownItem } from './components/dropdown'

export { Tooltip } from './components/tooltip'
export type { TooltipProps } from './components/tooltip'

export { Tabs, Breadcrumb, SideTabs } from './components/tabs'
export type { TabsProps, TabItem, BreadcrumbProps } from './components/tabs'

export { Avatar, AvatarGroup, Kbd, Tag } from './components/avatar'
export type { AvatarProps, AvatarGroupProps, KbdProps, TagProps } from './components/avatar'

export { toast, Toaster, useToastStore } from './components/toast'
export type { ToastItem, ToastTone, ToastOptions } from './components/toast'

export { Progress, Meter } from './components/progress'
export type { ProgressProps, MeterProps } from './components/progress'

export {
  CopyButton,
  ClipboardText,
  Descriptions,
  CodeBlock,
  HighlightText,
  SearchInput,
} from './components/misc'
export type {
  CopyButtonProps,
  ClipboardTextProps,
  DescriptionsProps,
  CodeBlockProps,
  SearchInputProps,
} from './components/misc'

export {
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  DataTable,
  TableToolbar,
  Pagination,
  pinnedSide,
  computeSticky,
} from './components/table'
export type { Column, DataTableProps, ThProps, PaginationProps } from './components/table'

export { VirtualTable, CellWithSub } from './components/virtual-table'
export type { VirtualTableProps } from './components/virtual-table'

export { Alert, Banner } from './components/alert'
export type { AlertProps, AlertTone, BannerProps } from './components/alert'

/* 横幅：主横幅（HeroBanner）与卡片横幅（BannerCard），色调取自主题图表色板 */
export { HeroBanner, BannerCard, BANNER_TONES } from './components/banner'
export type {
  HeroBannerProps,
  BannerCardProps,
  BannerTone,
  BannerVariant,
} from './components/banner'

/* 动效卡片：lift / spotlight / tilt / sweep / aurora 五种低干扰动效 */
export { MotionCard, MOTION_EFFECTS } from './components/motion'
export type { MotionCardProps, MotionEffect, MotionTone } from './components/motion'

export {
  PageHeader,
  PageContainer,
  Grid,
  Stack,
  Inline,
  StatCard,
  Timeline,
} from './components/page'
export type {
  PageHeaderProps,
  PageContainerProps,
  StatCardProps,
  TimelineItem,
} from './components/page'

export { Steps, Collapse } from './components/steps'
export type {
  StepsProps,
  StepItem,
  StepStatus,
  CollapseProps,
  CollapseItem,
} from './components/steps'

export { Tree, Transfer, UploadList, Calendar } from './components/tree'
export type {
  TreeProps,
  TreeItem,
  TransferProps,
  TransferItem,
  UploadListProps,
  UploadFileItem,
  CalendarProps,
} from './components/tree'

/* 高级视觉组件：数字滚动 / 光斑卡片 / 流光边框 / 渐变标题 / 跑马灯 / 滑动标签 / 环形指标 / 迷你趋势 / 键位提示 */
export {
  AnimatedNumber,
  SpotlightCard,
  BorderBeam,
  GradientText,
  Marquee,
  SlidingTabs,
  RingMetric,
  Sparkline,
  ShortcutHint,
} from './components/premium'
export type {
  AnimatedNumberProps,
  SpotlightCardProps,
  BorderBeamProps,
  GradientTextProps,
  MarqueeProps,
  SlidingTabsProps,
  RingMetricProps,
  SparklineProps,
  ShortcutHintProps,
} from './components/premium'

/* ================================================================== *
 * 资源与编辑器（Media）
 *
 * 资源显示类型（图片 / 视频 / 音频）+ 四种编辑器（图片 / 文本 / 代码 / 视频）。
 * 放在 `components/media/` 子目录里，统一导出 —— 它们共享 MediaKind / EditKind
 * 两套枚举与角标文案，散在 components/*.tsx 会让「视频」的角标在别处被写成另一种叫法。
 * ================================================================== */

export {
  MEDIA_KIND_META,
  EDIT_KIND_META,
  EDITOR_BY_MEDIA_KIND,
  formatDuration,
  formatPreciseDuration,
  seedWaveform,
  clampRatio,
  ImagePreview,
  VideoPreview,
  AudioPreview,
  MediaCard,
  MediaKindBadge,
  ImageEditor,
  TextEditor,
  CodeEditor,
  VideoEditor,
  EditorWorkbench,
  MarkdownPreview,
  DEFAULT_IMAGE_EDIT,
  DEFAULT_TEXT_EDIT,
} from './components/media'

export type {
  MediaKind,
  MediaTone,
  MediaKindMeta,
  EditKind,
  EditKindMeta,
  ImagePreviewProps,
  VideoPreviewProps,
  AudioPreviewProps,
  MediaCardProps,
  ImageEditValue,
  ImageEditorProps,
  TextEditorProps,
  CodeEditorProps,
  VideoClip,
  VideoEditorProps,
  EditorWorkbenchProps,
} from './components/media'

/* ================================================================== *
 * 无限画布（InfiniteCanvas）
 *
 * 一套完全自研的画布子系统：相机内核 + 视口剔除 + 连线几何 + 节点 AI 对话框。
 * 这里显式列举导出，不用 `export *`：
 * 画布内核里也有 `clamp` 这类通用名，通配导出会和工具函数撞名。
 * ================================================================== */

export {
  InfiniteCanvas,
  CanvasNodeFrame,
  CanvasInlineEdit,
  CanvasNodeMenu,
  CanvasNodeStatus,
  CanvasNodeCheck,
  CanvasNodeClose,
  CanvasAIPopover,
  CanvasAIDock,
  CanvasNodeToolbar,
  CanvasAIStatus,
  createDemoEngine,
  aiContentOf,
  CanvasMinimap,
  CanvasControls,
  CanvasContextMenu,
  CanvasBackground,
  CanvasMarquee,
  CanvasGuides,
  stepZoom,
} from './canvas'

export {
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEPS,
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
  SpatialIndex,
  edgeGeometry,
  offsetPort,
  createHistory,
  useCanvasHistory,
  createCameraStore,
  useCanvasCamera,
  bindWheelZoom,
  PinchTracker,
  localPoint,
} from './canvas'

/* 画布内置图标（24×24 线性，与 lucide 观感一致，但不引入图标库依赖） */
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
} from './canvas'

export type {
  InfiniteCanvasProps,
  InfiniteCanvasHandle,
  CanvasOverlayApi,
  CanvasNodeMove,
  CanvasNodeResize,
  CanvasConnectPayload,
  CanvasNodeFrameProps,
  CanvasNodeTone,
  CanvasInlineEditProps,
  CanvasNodeMenuItem,
  CanvasAIPopoverProps,
  CanvasAIDockProps,
  CanvasNodeToolbarProps,
  CanvasNodeToolbarItem,
  CanvasMinimapProps,
  CanvasControlsProps,
  CanvasContextMenuProps,
  CanvasMenuItem,
  CanvasMenuSection,
  CanvasContextTarget,
  CanvasBackgroundProps,
  CanvasBackgroundVariant,
  EdgeGeometryInput,
  EdgeGeometry,
  HistoryController,
  HistoryOptions,
  CameraStore,
  WheelBindingOptions,
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
} from './canvas'
