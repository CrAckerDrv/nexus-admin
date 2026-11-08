# 无限画布

一套**完全自研**的内容画布：相机内核、视口剔除、连线几何、吸附、节点级 AI 对话框，
全部位于 `packages/ui/src/canvas/`，不依赖 React Flow / tldraw / Konva 等任何画布库。

> 定位差异：`工作流设计器` 是「流程编排」——少量节点、强语义；
> `无限画布` 是「内容创作」——大量节点、富媒体、AI 就地协作。
> 两者共用同一套 @nexus/ui 设计令牌，但画布内核更完整（剔除、LOD、惯性、缩放手柄）。

## 为什么自己写

| 方案 | 问题 |
| --- | --- |
| React Flow | 边/节点必须有 schema，富媒体节点要靠层层包装；剔除与 LOD 需自己补 |
| tldraw | 体积与授权成本高，且它是「白板」而非「可嵌组件」 |
| 直接上 canvas 2D | 富文本、视频、可聚焦节点全部要自己实现文本排版与命中测试 |

自研的真实成本集中在四件事，也正是这个子系统解决的问题：
**相机数学**、**每帧不触发 React 渲染**、**剔除与 LOD**、**连线与吸附的几何细节**。

## 架构

```
手势层（wheel / pointer / pinch / keyboard）
  ↓ 只写 store，不 setState
相机层 camera.ts       命令式 store + rAF 合帧 + 动画 + 惯性
  ↓ settled 时才同步 React
空间索引 spatial.ts     512px 均匀网格，视口查询 O(k)
  ↓
世界层（一次 translate3d + scale）
  ├─ 节点层：renderNode 由宿主决定内容
  └─ 连线层：SVG <g> 共用同一 transform
```

三条不可动摇的规则：

1. **手势期间不 setState**：相机只写 store，世界层直接改 `style.transform`；
2. **拖动节点期间不 setState**：只写节点的 `--c-dx/--c-dy`，松手才提交坐标；
3. **按视口剔除**：只挂载相交节点；缩得很小时进一步 LOD 聚合。

## 快速开始

```tsx
import { InfiniteCanvas } from '@nexus/ui'

<InfiniteCanvas
  nodes={nodes}
  edges={edges}
  camera={camera}
  onCameraChange={(next, meta) => meta.settled && setCamera(next)}
  onNodesMove={(changes) => applyMove(changes)}
  onConnect={({ source, target, targetSide }) => addEdge(source, target, targetSide)}
  snap={{ grid: 8, guides: true, threshold: 7 }}
  lod={{ zoom: 0.3, cell: 64 }}
  contextMenu={(target) => buildMenu(target)}
  renderNode={(node, ctx) => <MyNode node={node} selected={ctx.selected} />}
  ariaLabel="内容画布"
/>
```

节点数据只要满足 `CanvasNodeBase`（`id / x / y / width / height`，其余放 `data`）：

```ts
interface MyNode extends CanvasNodeBase<{ text: string }> {
  // 画布不读 data，只负责布局、命中与剔除
}
```

## API

### InfiniteCanvas

| 属性 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `nodes` / `edges` | `CanvasNodeBase[]` / `CanvasEdgeBase[]` | — | 文档数据（受控） |
| `camera` / `defaultCamera` | `{ x, y, zoom }` | `{0,0,1}` | 相机，受控或非受控 |
| `onCameraChange` | `(camera, { settled, source })` | — | `settled=false` 表示手势中，可跳过写 store |
| `selectedIds` / `onSelectionChange` | `string[]` | — | 选中集合 |
| `onNodesMove` / `onNodesResize` | `(changes) => void` | — | 拖拽/缩放**结束时**批量回调 |
| `onConnect` | `(payload) => void` | — | 端口拖拽落点，含自动推算的方位 |
| `onNodesDelete` / `onEdgesDelete` | `(ids) => void` | — | Delete 键与菜单触发 |
| `onNodeClick` | `(id, { world })` | — | 单击节点（AI 跟随点击就靠它） |
| `renderNode` | `(node, ctx) => ReactNode` | — | 节点内容；`ctx` 含 `selected / dragging / zoom` |
| `renderOverlay` | `(api) => ReactNode` | — | 覆盖层（AI 浮层等），`api.subscribeCamera` 可逐帧跟随 |
| `contextMenu` | `(target) => CanvasMenuSection[]` | — | 右键菜单内容，画布只管定位与键盘 |
| `culling` | `boolean` | `true` | 视口剔除 |
| `lod` | `{ zoom, cell } \| false` | `false` | 低倍率聚合，把挂载数与文档规模解耦 |
| `snap` | `{ grid, guides, threshold }` | — | 网格与对齐吸附，阈值按 zoom 折算 |
| `minimap` / `controls` | `boolean` | `true` | 右下角缩略图与缩放控件 |
| `editable` | `boolean` | `true` | 只读模式（只允许平移与选中） |

`ref` 上暴露 `InfiniteCanvasHandle`：`getCamera / setCamera / fitView / fitNode / zoomIn / zoomOut / resetZoom / getVisibleCount`。

### CanvasNodeFrame

节点外壳：统一标题栏高度、类型徽标、AI 药丸、锁定态、AI 处理流光、选中光环，
并在 `size.width * zoom < 56` 时自动降级为色块（LOD）。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `title` / `badge` / `icon` | `ReactNode` | 标题栏三段内容 |
| `tone` | `'primary' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'neutral'` | 语义色，联动选中环与图标底色 |
| `selected` / `dragging` / `locked` / `busy` | `boolean` | 四种状态 |
| `size` / `zoom` | `object` / `number` | 用于 LOD 降级 |
| `topMenu` | `ReactNode` | 卡片顶部菜单（`CanvasNodeToolbar`），hover / 选中时盖住标题栏 |
| `dock` | `ReactNode` | 卡片底部吸附区（`CanvasAIDock`）。**必须走这里**：塞进 children 会落进 `contain: layout` 的内容区，`bottom: 0` 会被 footer 顶偏 |
| `kind` | `string` | 节点类型，透出 `data-canvas-kind` / `data-canvas-group` |
| `footer` | `ReactNode` | 底部状态条（作者、时间、比例等） |

### CanvasAIDock

卡片底部 AI 输入区：抬头（节点类型 + 引擎）、快捷指令、流式回答、应用到节点 / 另存为子节点。
`compact` 在小卡片上只保留抬头与输入行；`autoClose` 控制应用后是否收起。

### CanvasNodeToolbar

卡片顶部菜单：图标 / 图标+文字两种按钮，支持 `active`、`danger`、`disabled`，
所有按钮 `onPointerDown` 都阻止冒泡（否则点按钮会变成拖节点）。

### CanvasAIPopover

节点级 AI 对话框：锚定节点、右→左翻转、思考步骤条、逐字流式、应用到节点 / 另存为子节点。

引擎通过 `CanvasAIEngine` 注入，**组件不绑定任何模型**：

```ts
interface CanvasAIEngine {
  id: string
  label: string
  live?: boolean
  run: (
    request: { nodeId: string; title: string; kind: string; content: string; prompt: string },
    handlers: { onStep?: (s) => void; onDelta: (d: string) => void },
    signal: AbortSignal,
  ) => Promise<void>
}
```

不传 `engine` 时用内置演示引擎（离线、可复现、逐字流式），演示页默认走它；
接真网关只需实现该接口 —— 与 `@nexus/ai-sdk` 的 `AssistantTransport` 是同一思路。

### CanvasContextMenu

右键菜单：分组、子菜单、roving tabindex 键盘导航（↑↓ / → / ← / Esc / Enter），
位置自动夹取到容器内。内容由 `contextMenu` 回调决定，画布不预置业务动作。

## 卡片级交互：顶部菜单 + 底部 AI 输入

内容画布上，用户是「先看卡片、再操作卡片」，所以操作入口做在卡片内部，而不是外层浮层。

### 顶部菜单 `CanvasNodeToolbar`

通过 `CanvasNodeFrame` 的 `topMenu` 传入，覆盖在标题栏上，hover / 选中时出现。

```tsx
<CanvasNodeFrame
  topMenu={
    <CanvasNodeToolbar
      items={[
        { key: 'ai', label: 'AI', icon: <SparkIcon size={11} />, wide: true, onClick: openAI },
        { key: 'duplicate', label: '创建副本', icon: <CopyIcon size={11} />, onClick: duplicate },
        { key: 'group', label: '编组', icon: <GroupIcon size={11} />, onClick: group },
        { key: 'delete', label: '删除节点', icon: <TrashIcon size={11} />, danger: true, onClick: remove },
      ]}
    />
  }
/>
```

为什么必须在卡片**内部**：节点带 `overflow: hidden` 与 `contain: paint`（性能关键），
浮在卡片外面的菜单会被裁掉。

### 底部 AI 输入区 `CanvasAIDock`

点节点即在**该卡片底部**展开输入框，回答也留在卡片里。与 `CanvasAIPopover` 的区别：
Popover 是浮在画布上的对话面板，Dock 属于节点本身 —— 不遮挡邻卡，也不随相机移动飘走。

```tsx
<CanvasNodeFrame
  dock={
    <CanvasAIDock
      open={openId === node.id}
      nodeTitle={node.title}
      nodeKind={node.kind}
      nodeKindLabel="TEXT"
      content={nodeContent(node)}
      compact={node.height < 200}   // 小卡片只留抬头 + 输入行
      onApply={(text) => writeBack(node.id, text)}
      onClose={() => setOpenId(null)}
    />
  }
/>
```

**必须用 `dock` 属性而不是塞进 `children`**：children 落在 `.n-canvas-content` 里，
那个容器带 `contain: layout`，会成为绝对定位后代的包含块 ——
`bottom: 0` 对齐的会是内容区底部（还被 footer 顶上去 24px），输入区看起来就悬空一截。

## 编组

编组的语义是「成员打上 `groupId` + 外面包一个分组框节点」：

- 分组框是 `locked` 且 `z` 最低的容器，不抢命中、不挡内容；
- 拖动分组框 → 成员一起移动（页面在 `onNodesMove` 里按 `groupId` 同步成员坐标）；
- 成员被删 / 新增后，分组框尺寸由 `recountGroups` 统一重算（只扩不缩，避免抖动）；
- 入口在**底部工具条**（多选后的自然位置），右键菜单与卡片顶部菜单也有同一入口。

## 小地图

`CanvasMinimap` 支持按下拖动连续跳转。三个必须守住的点（缺一个就「拖不动 / 拖了卡」）：

1. **事件不外溢**：小地图位于画布根节点内部，事件会冒泡 —— 不拦截的话，拖小地图会被画布当成框选。
   组件对 `pointerdown/move/up/click/dblclick/contextmenu` 全部 `stopPropagation`，
   并用 `setPointerCapture` 让指针移出小地图后仍能继续拖。
2. **拖拽态用 ref 判断**，不要用 `event.buttons`：指针被捕获后部分浏览器把它报成 0，会出现「拖一下就停」。
3. **拖动中不要起动画**：每次 `pointermove` 都 `animateTo` 会被下一次打断，表现为「拖了没反应」。
   `onJump(point, { dragging })` 的 `dragging` 就是给宿主区分用的 ——
   `true` 时直接写相机（由相机 store 逐帧合并），`false`（松手）时再做一次平滑收尾。

```tsx
<CanvasMinimap
  camera={camera}
  subscribe={subscribeCamera}
  size={size}
  bounds={contentBounds}
  nodes={nodes}
  onJump={(world, meta) => {
    moveTo(world, { animate: !meta?.dragging })  // 拖动中立即生效
    if (meta?.dragging === false) settle()       // 松手收尾
  }}
/>
```

## 右键菜单

`CanvasContextMenu`：分组 + 子菜单 + roving tabindex 键盘导航（↑↓ / → / ← / Esc / Enter），
位置自动夹取，子菜单在贴右边界时自动翻到左侧。
## 性能

| 手段 | 效果 |
| --- | --- |
| 手势不进 React | 拖动/缩放期间 0 次整树渲染 |
| 单层 CSS transform | 节点与连线永远对齐，GPU 合成 |
| 空间索引剔除 | 1,000 节点时只挂载几十个 DOM |
| LOD 聚合 | 缩到 30% 以下合并为色块，挂载数与文档规模无关 |
| 拖动实时改 path | 连线跟手但不重渲染 |
| 稳定 zoom | 手势期间沿用落定前的缩放，避免逐帧重算 |
| 媒体懒加载 | 图片 `decoding=async`，视频 `preload=metadata` |

验收（`node scripts/verify-canvas.mjs`）在 1440 × 900 下实测：
1,000 节点压测时挂载数 **84**、交互帧率 **60fps**、0 控制台错误。

## 无障碍

- 容器 `role="application"` + `aria-label`，可见焦点环；
- 键盘全操作：`Ctrl/⌘+A` 全选、`Delete` 删除、`Esc` 取消、`Shift+1/2` 适配、`+/-/0` 缩放；
- 右键菜单 `role="menu"` / `role="menuitem"`，`aria-disabled`、`aria-haspopup`；
- 减少动效：`[data-motion='reduced']` 与 `prefers-reduced-motion` 下停掉所有持续动画。

## 已知边界

- 未实现手绘笔迹与橡皮（白板能力）；
- 未实现多人实时协作（需要 CRDT 层，接口已预留在 `renderOverlay` + 宿主 store）；
- 导出目前是 JSON 文档（无 PNG 导出）。
