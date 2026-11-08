import { useMemo, useState } from 'react'
import {
  CanvasAIPopover,
  CanvasControls,
  CanvasMinimap,
  CanvasNodeFrame,
  InfiniteCanvas,
  cn,
  createDemoEngine,
  edgeGeometry,
  type CanvasCamera,
  type CanvasEdgeBase,
  type CanvasNodeBase,
} from '@nexus/ui'
import { ImageIcon, NoteIcon, TextIcon, VideoIcon } from '@nexus/ui'
import type { GalleryCategory, GalleryItem } from './types'

/* ================================================================== *
 * 无限画布：6 个条目
 *
 * 每个 demo 都是**真实可交互**的迷你画布/组件，而不是截图：
 * 这也是这个项目「组件橱窗」的一致约定 —— 截图会随主题过期，活组件不会。
 * ================================================================== */

interface MiniNode extends CanvasNodeBase {
  title: string
  kind: 'text' | 'image' | 'video' | 'note'
}

const MINI_NODES: MiniNode[] = [
  { id: 'a', x: 20, y: 40, width: 150, height: 92, title: 'Brief', kind: 'text' },
  { id: 'b', x: 230, y: 12, width: 132, height: 84, title: '参考图', kind: 'image' },
  { id: 'c', x: 230, y: 128, width: 132, height: 84, title: '镜头', kind: 'video' },
  { id: 'd', x: 420, y: 76, width: 138, height: 84, title: '便签', kind: 'note' },
]

const MINI_EDGES: CanvasEdgeBase[] = [
  { id: 'e1', source: 'a', target: 'b', tone: 'ai', label: '生成' },
  { id: 'e2', source: 'a', target: 'c', tone: 'primary' },
  { id: 'e3', source: 'c', target: 'd', tone: 'warning' },
]

const KIND_ICON = {
  text: TextIcon,
  image: ImageIcon,
  video: VideoIcon,
  note: NoteIcon,
}

function MiniNodeView({ node, selected }: { node: MiniNode; selected: boolean }) {
  const Icon = KIND_ICON[node.kind]
  return (
    <CanvasNodeFrame
      title={node.title}
      badge={node.kind.toUpperCase()}
      icon={<Icon size={11} />}
      tone={
        node.kind === 'image'
          ? 'primary'
          : node.kind === 'video'
            ? 'info'
            : node.kind === 'note'
              ? 'warning'
              : 'neutral'
      }
      selected={selected}
      size={{ width: node.width, height: node.height }}
      zoom={1}
    >
      <div className="flex size-full items-center justify-center bg-surface-2/50">
        <Icon size={20} className="text-fg-4" />
      </div>
    </CanvasNodeFrame>
  )
}

/* ------------------------------ 1. 完整画布 ------------------------------ */

function InfiniteCanvasDemo() {
  const [selection, setSelection] = useState<string[]>(['a'])
  return (
    <div className="h-[280px] w-full overflow-hidden rounded-md border border-line">
      <InfiniteCanvas
        nodes={MINI_NODES}
        edges={MINI_EDGES}
        defaultCamera={{ x: 8, y: 18, zoom: 0.86 }}
        selectedIds={selection}
        onSelectionChange={setSelection}
        keyboard={false}
        minimap={false}
        background="dots"
        snap={{ grid: 8, guides: true }}
        renderNode={(node, context) => <MiniNodeView node={node} selected={context.selected} />}
        ariaLabel="画布演示"
      />
    </div>
  )
}

/* ------------------------------ 2. 节点外壳 ------------------------------ */

function NodeFrameDemo() {
  return (
    <div className="grid w-full grid-cols-2 gap-2.5">
      {[
        {
          title: '普通状态',
          tone: 'neutral' as const,
          selected: false,
          locked: false,
          busy: false,
        },
        { title: '选中状态', tone: 'primary' as const, selected: true, locked: false, busy: false },
        { title: '锁定状态', tone: 'warning' as const, selected: false, locked: true, busy: false },
        { title: 'AI 处理中', tone: 'info' as const, selected: false, locked: false, busy: true },
      ].map((item) => (
        <div key={item.title} className="h-[104px]">
          <CanvasNodeFrame
            title={item.title}
            badge="TEXT"
            icon={<TextIcon size={11} />}
            tone={item.tone}
            selected={item.selected}
            locked={item.locked}
            busy={item.busy}
            size={{ width: 180, height: 104 }}
            zoom={1}
            onAI={() => undefined}
            onMenu={() => undefined}
            footer={<span>林一 · 10:24</span>}
          >
            <p className="px-2.5 py-2 text-[0.6875rem] leading-4 text-fg-3">
              节点内容由宿主渲染，外框负责状态。
            </p>
          </CanvasNodeFrame>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------ 3. 缩略图 ------------------------------ */

function MinimapDemo() {
  const [camera, setCamera] = useState<CanvasCamera>({ x: 0, y: 0, zoom: 1 })
  return (
    <div className="flex w-full items-center gap-4">
      <div className="relative h-[150px] w-[190px] overflow-hidden rounded-md border border-line bg-surface-2/40">
        <CanvasMinimap
          camera={camera}
          subscribe={() => () => undefined}
          size={{ width: 190, height: 150 }}
          bounds={{ x: 0, y: 0, width: 1360, height: 900 }}
          nodes={MINI_NODES}
          width={186}
          height={146}
          className="!static !border-0 !bg-transparent !shadow-none"
          onJump={(point) =>
            setCamera((current) => ({
              ...current,
              x: 95 - point.x * current.zoom,
              y: 75 - point.y * current.zoom,
            }))
          }
        />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5 text-[0.6875rem] leading-5 text-fg-3">
        <p>
          视口矩形跟随相机，点击缩略图即跳转。 相机变化时**只改 SVG 属性**，不重渲染整张缩略图。
        </p>
        <p className="font-mono text-[0.625rem] text-fg-4 tabular-nums">
          x {Math.round(camera.x)} · y {Math.round(camera.y)} · zoom {camera.zoom.toFixed(2)}
        </p>
      </div>
    </div>
  )
}

/* ------------------------------ 4. 缩放控件 ------------------------------ */

function ControlsDemo() {
  const [zoom, setZoom] = useState(1)
  const camera = useMemo<CanvasCamera>(() => ({ x: 0, y: 0, zoom }), [zoom])
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="rounded-lg bg-surface-3 px-8 py-3 text-[0.6875rem] text-fg-3">
        画布内容（缩放{' '}
        <span className="font-semibold text-fg tabular-nums">{Math.round(zoom * 100)}%</span>）
      </div>
      <div className="relative h-14 w-full rounded-md border border-line bg-bg-subtle/40">
        <CanvasControls
          camera={camera}
          subscribe={() => () => undefined}
          onZoomIn={() => setZoom((value) => Math.min(4, Number((value + 0.1).toFixed(2))))}
          onZoomOut={() => setZoom((value) => Math.max(0.1, Number((value - 0.1).toFixed(2))))}
          onFit={() => setZoom(1)}
          onResetZoom={() => setZoom(1)}
          className="!right-2 !bottom-2"
        />
      </div>
    </div>
  )
}

/* ------------------------------ 5. AI 对话框 ------------------------------ */

const AI_ANSWER_DEMO =
  '把第一句改成具体的画面细节，例如「午后三点，窗台的灰尘在光柱里浮着」——它比「很有氛围」更快让人进入场景。'

function AIPopoverDemo() {
  const [applied, setApplied] = useState<string | null>(null)
  const engine = useMemo(() => createDemoEngine(), [])

  return (
    <div className="relative h-[300px] w-full overflow-hidden rounded-md border border-line bg-bg-subtle/40">
      <div className="absolute top-4 left-4 h-[112px] w-[184px]">
        <CanvasNodeFrame
          title="片头文案"
          badge="TEXT"
          icon={<TextIcon size={11} />}
          tone="primary"
          selected
          size={{ width: 184, height: 112 }}
          zoom={1}
        >
          <p className="px-2.5 py-2 text-[0.6875rem] leading-4 text-fg-3">
            {applied ?? '很有氛围的一个清晨，光落在桌面上。'}
          </p>
        </CanvasNodeFrame>
      </div>

      <CanvasAIPopover
        open
        anchor={{ x: 200, y: 12 }}
        anchorSize={{ width: 184, height: 112 }}
        viewport={{ width: 620, height: 300 }}
        nodeTitle="片头文案"
        nodeKind="text"
        nodeKindLabel="TEXT"
        content="很有氛围的一个清晨，光落在桌面上。"
        engine={engine}
        suggestions={['改得更有画面感', '压缩到 40 字']}
        onApply={(text) => setApplied(text || AI_ANSWER_DEMO)}
        onCreateChild={() => undefined}
        onClose={() => undefined}
      />
    </div>
  )
}

/* ------------------------------ 6. 连线形态 ------------------------------ */

function EdgesDemo() {
  const source = { x: 16, y: 36, width: 92, height: 56 }
  const target = { x: 300, y: 96, width: 92, height: 56 }
  const shapes = ['bezier', 'orthogonal', 'straight'] as const
  const labels = { bezier: '贝塞尔（默认）', orthogonal: '正交圆角', straight: '直线 + 箭头' }

  return (
    <div className="w-full space-y-1.5">
      {shapes.map((shape) => {
        const geometry = edgeGeometry({
          source,
          target,
          sourceSide: 'right',
          targetSide: 'left',
          shape,
        })
        return (
          <div
            key={shape}
            className="relative h-[64px] rounded-md border border-line bg-bg-subtle/40"
          >
            <span className="absolute top-1 left-2 text-[0.625rem] text-fg-4">{labels[shape]}</span>
            <svg className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
              <path
                d={geometry.path}
                fill="none"
                className={cn('n-canvas-edge', shape === 'straight' && 'n-canvas-edge--primary')}
                strokeWidth={1.6}
                markerEnd="url(#n-canvas-arrow)"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        )
      })}
    </div>
  )
}

/* ================================================================== *
 * 分类定义
 * ================================================================== */

export const canvasCategory: GalleryCategory = {
  id: 'canvas',
  name: 'Canvas',
  title: '无限画布',
  description: '自研相机内核、视口剔除、连线几何与节点 AI 对话框：一套可直接复用的内容画布',
  items: [
    {
      key: 'infinite-canvas',
      name: 'InfiniteCanvas',
      nameZh: '无限画布',
      version: 'v0.2',
      summary: '平移缩放 + 视口剔除 + 框选 + 吸附 + 连线拖拽，节点由宿主渲染，可交互',
      demo: InfiniteCanvasDemo,
      wide: true,
      previewHeight: 300,
      keywords: ['huabu', 'canvas', 'infinite', 'pan', 'zoom', 'culling'],
      code: `import { InfiniteCanvas } from '@nexus/ui'

<InfiniteCanvas
  nodes={nodes}
  edges={edges}
  camera={camera}
  onCameraChange={(next, meta) => meta.settled && setCamera(next)}
  onNodesMove={(changes) => applyMove(changes)}
  onConnect={({ source, target }) => addEdge(source, target)}
  snap={{ grid: 8, guides: true, threshold: 7 }}
  renderNode={(node, ctx) => <MyNode node={node} selected={ctx.selected} />}
  ariaLabel="内容画布"
/>`,
      props: [
        {
          name: 'nodes / edges',
          type: 'CanvasNodeBase[] / CanvasEdgeBase[]',
          desc: '文档数据（受控，画布不持有业务状态）',
        },
        {
          name: 'camera / defaultCamera',
          type: 'CanvasCamera',
          desc: '相机：{x, y, zoom}，受控或非受控',
        },
        {
          name: 'onCameraChange',
          type: '(camera, { settled, source }) => void',
          desc: 'settled=false 时表示手势中，宿主可跳过写 store',
        },
        {
          name: 'selectedIds / onSelectionChange',
          type: 'string[]',
          desc: '选中集合，受控或非受控',
        },
        { name: 'onNodesMove', type: '(changes) => void', desc: '拖动结束一次性回调（批量坐标）' },
        { name: 'onNodesResize', type: '(changes) => void', desc: '四角缩放手柄结束后回调尺寸' },
        {
          name: 'onConnect',
          type: '(payload) => void',
          desc: '端口拖拽落点后回调，含自动推算的方位',
        },
        {
          name: 'renderNode',
          type: '(node, ctx) => ReactNode',
          desc: '节点渲染函数，ctx 提供 selected / dragging / zoom',
        },
        {
          name: 'renderOverlay',
          type: '(api) => ReactNode',
          desc: '覆盖层（如节点 AI 对话框），api 暴露相机与订阅',
        },
        {
          name: 'culling',
          type: 'boolean',
          default: 'true',
          desc: '视口剔除：只挂载相交节点，DOM 数与总数解耦',
        },
        {
          name: 'snap',
          type: 'CanvasSnapOptions',
          desc: '{ grid, guides, threshold }，阈值按 zoom 折算',
        },
        {
          name: 'minimap / controls',
          type: 'boolean',
          default: 'true',
          desc: '右下角缩略图与缩放控件',
        },
      ],
    },
    {
      key: 'canvas-node-frame',
      name: 'CanvasNodeFrame',
      nameZh: '节点外壳',
      summary: '统一的标题栏、徽标、AI 药丸、锁定/AI 处理态与选中光环',
      demo: NodeFrameDemo,
      wide: true,
      previewHeight: 250,
      keywords: ['node', 'frame', 'jiedian', 'wanke'],
      code: `<CanvasNodeFrame
  title="片头文案"
  badge="TEXT"
  tone="primary"
  icon={<TextIcon size={11} />}
  selected
  busy={generating}
  onAI={() => openAIPopover(node.id)}
  onMenu={() => setMenu(node.id)}
  footer={<span>林一 · 10:24</span>}
>
  <p>节点内容由宿主渲染，外框负责状态。</p>
</CanvasNodeFrame>`,
      props: [
        {
          name: 'title / badge / icon',
          type: 'ReactNode',
          desc: '标题栏三段内容，badge 自动大写小字',
        },
        {
          name: 'tone',
          type: "'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'",
          default: "'neutral'",
          desc: '语义色，联动选中环与图标底色',
        },
        {
          name: 'selected / dragging / locked',
          type: 'boolean',
          desc: '三种状态：光环、拖动阴影、锁标',
        },
        { name: 'busy', type: 'boolean', desc: 'AI 处理中：显示流光边框（减少动效时自动静止）' },
        { name: 'size / zoom', type: 'object / number', desc: '用于 LOD：屏幕上过小时只画色块' },
        { name: 'onAI / onMenu', type: '() => void', desc: '标题栏右侧的 AI 药丸与更多按钮' },
        { name: 'footer', type: 'ReactNode', desc: '底部状态条（作者、时间、比例等）' },
      ],
    },
    {
      key: 'canvas-ai-popover',
      name: 'CanvasAIPopover',
      nameZh: '节点 AI 对话框',
      summary: '锚定节点的就地对话：思考步骤、流式输出、应用到节点，引擎可注入',
      demo: AIPopoverDemo,
      wide: true,
      previewHeight: 320,
      keywords: ['ai', 'popover', 'duihua', 'streaming'],
      code: `<CanvasAIPopover
  open={openId === node.id}
  anchor={{ x: 200, y: 12 }}
  anchorSize={{ width: node.width, height: node.height }}
  viewport={canvasSize}
  nodeTitle={node.title}
  nodeKind="text"
  nodeKindLabel="TEXT"
  content={nodeContent(node)}
  engine={myEngine}           // 缺省用内置演示引擎
  suggestions={['改得更有画面感']}
  onApply={(text) => writeBack(node.id, text)}
  onCreateChild={(text) => createChild(node.id, text)}
  onClose={() => setOpenId(null)}
/>`,
      props: [
        {
          name: 'anchor / anchorSize',
          type: '{x, y} / {width, height}',
          desc: '节点屏幕坐标与尺寸，用于定位与翻转',
        },
        {
          name: 'inline / inlineFlip',
          type: 'boolean / "left" | "right"',
          desc: '内联模式：外层用 transform 跟随节点，避免逐帧重算',
        },
        {
          name: 'engine',
          type: 'CanvasAIEngine',
          desc: '{ id, label, live?, run(req, handlers, signal) }，缺省为演示引擎',
        },
        { name: 'suggestions', type: 'string[]', desc: '快捷指令，按节点类型给不同建议' },
        { name: 'onApply', type: '(text: string) => void', desc: '把回答写回节点' },
        { name: 'onCreateChild', type: '(text: string) => void', desc: '以回答为基础生成子节点' },
      ],
    },
    {
      key: 'canvas-minimap',
      name: 'CanvasMinimap',
      nameZh: '画布缩略图',
      summary: '节点缩略 + 视口矩形，点击/拖拽跳转；相机变化只改 SVG 属性',
      demo: MinimapDemo,
      previewHeight: 190,
      keywords: ['minimap', 'suolutu', 'overview'],
      code: `<CanvasMinimap
  camera={camera}
  subscribe={subscribeCamera}
  size={canvasSize}
  bounds={contentBounds}
  nodes={nodes}
  width={186}
  height={146}
  onJump={(world, meta) => moveTo(world, { animate: !meta?.dragging })}
/>`,
      props: [
        {
          name: 'camera / subscribe',
          type: 'CanvasCamera / (listener) => unsub',
          desc: '相机快照 + 命令式订阅',
        },
        { name: 'size / bounds', type: 'CanvasSize / CanvasRect', desc: '画布可视区与内容包围盒' },
        { name: 'nodes', type: 'Array<Pick<节点, id|x|y|w|h>>', desc: '用于绘制缩略矩形' },
        {
          name: 'onJump',
          type: '(world, { dragging }) => void',
          desc: '跳转到该世界点；dragging=true 表示还在拖，应立即生效、不要起动画',
        },
      ],
    },
    {
      key: 'canvas-controls',
      name: 'CanvasControls',
      nameZh: '缩放控件',
      summary: '缩放百分比实时跟随（写 DOM 文本），加减与适配按钮',
      demo: ControlsDemo,
      previewHeight: 170,
      keywords: ['zoom', 'controls', 'suofang'],
      code: `<CanvasControls
  camera={camera}
  subscribe={subscribeCamera}
  onZoomIn={zoomIn}
  onZoomOut={zoomOut}
  onFit={fitAll}
  onResetZoom={() => zoomTo(1)}
/>`,
      props: [
        { name: 'onZoomIn / onZoomOut', type: '() => void', desc: '按档位缩放（ZOOM_STEPS）' },
        { name: 'onFit', type: '() => void', desc: '适配全部内容' },
        { name: 'onResetZoom', type: '() => void', desc: '重置为 100%' },
        {
          name: 'subscribe',
          type: '(listener) => unsub',
          desc: '百分比文本用命令式订阅更新，不触发组件重渲染',
        },
      ],
    },
    {
      key: 'canvas-edges',
      name: 'edgeGeometry',
      nameZh: '连线几何',
      summary: '贝塞尔 / 正交圆角 / 直线三种形态，自动锚点与箭头角度',
      demo: EdgesDemo,
      wide: true,
      previewHeight: 230,
      keywords: ['edge', 'lianxian', 'bezier', 'orthogonal'],
      code: `import { edgeGeometry, autoPortSides } from '@nexus/ui'

// 自动挑选最合理的一对边（左右 or 上下）
const [sourceSide, targetSide] = autoPortSides(sourceNode, targetNode)

const { path, mid, endAngle } = edgeGeometry({
  source: sourceNode,
  target: targetNode,
  sourceSide,
  targetSide,
  shape: 'bezier', // 'orthogonal' | 'straight'
})

<path d={path} markerEnd="url(#arrow)" vectorEffect="non-scaling-stroke" />`,
      props: [
        {
          name: 'shape',
          type: "'bezier' | 'orthogonal' | 'straight'",
          default: "'bezier'",
          desc: '三种连线形态',
        },
        {
          name: 'sourceSide / targetSide',
          type: 'CanvasPortSide',
          desc: '出/入边方位；缺省由 autoPortSides 推算',
        },
        { name: '返回 path', type: 'string', desc: '世界坐标系下的 SVG path，缩放时无需重算' },
        { name: '返回 mid', type: 'CanvasPoint', desc: '贝塞尔 t=0.5 的点，用于挂标签' },
        { name: '返回 endAngle', type: 'number', desc: '终点切线角度，箭头自动转向' },
      ],
    },
  ],
}

/** 供总览页统计（避免动态 import 循环） */
export const CANVAS_ITEM_COUNT = canvasCategory.items.length

export type { GalleryItem }
