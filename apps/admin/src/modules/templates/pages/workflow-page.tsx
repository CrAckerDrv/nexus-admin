import { useCallback, useMemo, useRef, useState } from 'react'
import {
  BellRing,
  CircleCheck,
  Clock,
  GitBranch,
  Globe,
  Mail,
  Plus,
  Redo2,
  Save,
  Trash,
  Undo2,
  Webhook,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  Descriptions,
  Drawer,
  FormField,
  Input,
  PageContainer,
  PageHeader,
  Select,
  Switch,
  cn,
  toast,
} from '@nexus/ui'

/**
 * 工作流设计器
 *
 * 实现要点：
 * 1. **不用 canvas**：节点是绝对定位的 DOM，连线是 SVG 覆盖层 —— 好处是节点可以用
 *    普通 React 组件渲染、可以聚焦、可以被屏幕阅读器读到。
 * 2. 连线用三次贝塞尔（水平出、水平入），看起来比直线更像专业工具。
 * 3. 拖拽只写 CSS 变量 `translate`，不触发 React 重渲染；松开时才提交坐标。
 * 4. 右侧属性面板与选中节点双向联动。
 */

type NodeKind = 'trigger' | 'condition' | 'action' | 'notify' | 'end'

interface FlowNode {
  id: string
  kind: NodeKind
  title: string
  description: string
  x: number
  y: number
  config: Record<string, string | boolean>
}

interface FlowEdge {
  from: string
  to: string
  label?: string
}

const NODE_META: Record<
  NodeKind,
  {
    label: string
    icon: typeof Mail
    tone: 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
  }
> = {
  trigger: { label: '触发器', icon: GitBranch, tone: 'primary' },
  condition: { label: '条件分支', icon: Clock, tone: 'warning' },
  action: { label: '执行动作', icon: Globe, tone: 'success' },
  notify: { label: '发送通知', icon: BellRing, tone: 'danger' },
  end: { label: '结束', icon: CircleCheck, tone: 'neutral' },
}

const TONE_BORDER = {
  primary: 'border-primary/45 bg-primary-weak',
  success: 'border-success/45 bg-success-weak',
  warning: 'border-warning/45 bg-warning-weak',
  danger: 'border-danger/45 bg-danger-weak',
  neutral: 'border-line-strong bg-surface-2',
}

const TONE_ICON = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-fg-3',
}

const INITIAL_NODES: FlowNode[] = [
  {
    id: 'n1',
    kind: 'trigger',
    title: '新订单创建',
    description: '监听 order.created 事件',
    x: 40,
    y: 150,
    config: { event: 'order.created', throttle: true },
  },
  {
    id: 'n2',
    kind: 'condition',
    title: '金额 > 5000',
    description: '判断订单金额',
    x: 260,
    y: 60,
    config: { field: 'amount', operator: 'greater_than', value: '5000' },
  },
  {
    id: 'n3',
    kind: 'condition',
    title: '风险分 > 70',
    description: '判断风控评分',
    x: 260,
    y: 250,
    config: { field: 'riskScore', operator: 'greater_than', value: '70' },
  },
  {
    id: 'n4',
    kind: 'action',
    title: '人工审核',
    description: '进入待审核队列',
    x: 500,
    y: 60,
    config: { queue: 'risk-review', priority: 'high' },
  },
  {
    id: 'n5',
    kind: 'notify',
    title: '通知风控值班',
    description: '通过企业微信发送',
    x: 500,
    y: 250,
    config: { channel: 'wecom', template: 'risk_alert' },
  },
  {
    id: 'n6',
    kind: 'end',
    title: '自动通过',
    description: '标记为已审核',
    x: 740,
    y: 155,
    config: {},
  },
]

const INITIAL_EDGES: FlowEdge[] = [
  { from: 'n1', to: 'n2' },
  { from: 'n1', to: 'n3' },
  { from: 'n2', to: 'n4', label: '是' },
  { from: 'n3', to: 'n5', label: '是' },
  { from: 'n4', to: 'n6' },
  { from: 'n5', to: 'n6' },
]

const NODE_WIDTH = 176
const NODE_HEIGHT = 64

export default function WorkflowPage() {
  const [nodes, setNodes] = useState<FlowNode[]>(INITIAL_NODES)
  const [edges] = useState<FlowEdge[]>(INITIAL_EDGES)
  // 默认不选中任何节点：抽屉是「点开才有」的编辑器，不应在进页时就盖住画布
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const canvasRef = useRef<HTMLDivElement>(null)
  /** 节点自增序号：用于生成稳定 id 与落点，避免渲染期调用 Date.now/random */
  const seqRef = useRef(100)
  /** 拖拽中的临时位移，用 ref 避免每帧 setState */
  const dragRef = useRef<{
    id: string
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

  const selected = nodes.find((node) => node.id === selectedId) ?? null

  const toCenter = useCallback((node: FlowNode) => {
    return {
      x: node.x + NODE_WIDTH / 2,
      y: node.y + NODE_HEIGHT / 2,
    }
  }, [])

  /** 贝塞尔连线路径：水平出发、水平进入，符合流程图惯例 */
  const edgePath = useCallback(
    (from: FlowNode, to: FlowNode) => {
      const a = toCenter(from)
      const b = toCenter(to)
      const fromRight = b.x > a.x
      const startX = a.x + (fromRight ? NODE_WIDTH / 2 : -NODE_WIDTH / 2)
      const endX = b.x + (fromRight ? -NODE_WIDTH / 2 : NODE_WIDTH / 2)
      const dx = Math.abs(endX - startX)
      const curve = Math.max(36, dx * 0.5)
      return `M ${startX} ${a.y} C ${startX + (fromRight ? curve : -curve)} ${a.y}, ${endX - (fromRight ? curve : -curve)} ${b.y}, ${endX} ${b.y}`
    },
    [toCenter],
  )

  const edges_ = useMemo(
    () =>
      edges
        .map((edge) => {
          const from = nodes.find((node) => node.id === edge.from)
          const to = nodes.find((node) => node.id === edge.to)
          if (!from || !to) return null
          return { ...edge, path: edgePath(from, to) }
        })
        .filter((edge): edge is FlowEdge & { path: string } => edge !== null),
    [edges, nodes, edgePath],
  )

  const onPointerDown = (event: React.PointerEvent, node: FlowNode) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      id: node.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: node.x,
      originY: node.y,
    }
    setSelectedId(node.id)
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = (event.clientX - drag.startX) / zoom
    const dy = (event.clientY - drag.startY) / zoom
    // 直接写 DOM 变量，不触发 React 渲染（松手时才落库）
    const el = canvasRef.current?.querySelector<HTMLElement>(`[data-node="${drag.id}"]`)
    if (el) el.style.translate = `${dx}px ${dy}px`
  }

  const onPointerUp = () => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    const el = canvasRef.current?.querySelector<HTMLElement>(`[data-node="${drag.id}"]`)
    if (!el) return
    const matrix = new DOMMatrixReadOnly(getComputedStyle(el).translate)
    el.style.translate = ''
    setNodes((prev) =>
      prev.map((node) =>
        node.id === drag.id
          ? {
              ...node,
              x: Math.max(0, Math.round(drag.originX + matrix.m41)),
              y: Math.max(0, Math.round(drag.originY + matrix.m42)),
            }
          : node,
      ),
    )
  }

  const updateNode = (patch: Partial<FlowNode>) => {
    if (!selectedId) return
    setNodes((prev) => prev.map((node) => (node.id === selectedId ? { ...node, ...patch } : node)))
  }

  const updateConfig = (key: string, value: string | boolean) => {
    if (!selected) return
    updateNode({ config: { ...selected.config, [key]: value } })
  }

  const addNode = (kind: NodeKind) => {
    // 用递增计数器生成 id 与落点，而不是 Date.now()/Math.random()：
    // 一来避免同帧多次添加撞 id，二来保持渲染纯净（react-hooks/purity）
    seqRef.current += 1
    const seq = seqRef.current
    const id = `n-${seq}`
    const node: FlowNode = {
      id,
      kind,
      title: NODE_META[kind].label,
      description: '点击右侧编辑属性',
      x: 120 + ((seq * 61) % 240),
      y: 80 + ((seq * 97) % 260),
      config: {},
    }
    setNodes((prev) => [...prev, node])
    setSelectedId(id)
    toast.success(`已添加「${NODE_META[kind].label}」节点`)
  }

  const removeSelected = () => {
    if (!selectedId) return
    setNodes((prev) => prev.filter((node) => node.id !== selectedId))
    setSelectedId(null)
    toast.success('节点已删除')
  }

  const canvasHeight = Math.max(420, ...nodes.map((node) => node.y + NODE_HEIGHT + 80))

  return (
    <PageContainer size="full">
      <PageHeader
        title="工作流设计器"
        description="节点拖拽 + SVG 贝塞尔连线 + 属性联动；节点是真实 DOM，可聚焦、可被读屏识别"
        badge={<Badge tone="warning">Workflow</Badge>}
        actions={
          <>
            <Button size="sm" variant="ghost" leftIcon={<Undo2 className="size-3.5" />} disabled>
              撤销
            </Button>
            <Button size="sm" variant="ghost" leftIcon={<Redo2 className="size-3.5" />} disabled>
              重做
            </Button>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Save className="size-3.5" />}
              onClick={() => toast.success('工作流已保存（演示）')}
            >
              保存
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[184px_minmax(0,1fr)]">
        {/* 左侧节点库 */}
        <Card className="h-fit p-2">
          <p className="mb-1.5 px-1 text-2xs font-semibold tracking-wide text-fg-3 uppercase">
            节点库
          </p>
          <div className="space-y-1">
            {(Object.keys(NODE_META) as NodeKind[]).map((kind) => {
              const meta = NODE_META[kind]
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => addNode(kind)}
                  className="group flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left transition-colors hover:border-primary/40 hover:bg-surface-2"
                >
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-sm border',
                      TONE_BORDER[meta.tone],
                    )}
                  >
                    <meta.icon className={cn('size-3.5', TONE_ICON[meta.tone])} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-fg-2 group-hover:text-fg">
                    {meta.label}
                  </span>
                  <Plus className="size-3 shrink-0 text-fg-4 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              )
            })}
          </div>
        </Card>

        {/* 画布 */}
        <Card bare className="relative overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-3 py-1.5">
            <span className="text-xs font-semibold text-fg">风控审核流程</span>
            <Badge size="sm">v3</Badge>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                aria-label="缩小"
                onClick={() => setZoom((value) => Math.max(0.6, Number((value - 0.1).toFixed(2))))}
                className="grid size-6 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg"
              >
                <ZoomOut className="size-3.5" />
              </button>
              <span className="w-10 text-center text-2xs text-fg-3 tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                aria-label="放大"
                onClick={() => setZoom((value) => Math.min(1.4, Number((value + 0.1).toFixed(2))))}
                className="grid size-6 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg"
              >
                <ZoomIn className="size-3.5" />
              </button>
              <Button size="xs" variant="ghost" onClick={() => setZoom(1)}>
                重置
              </Button>
            </div>
          </div>

          <div
            ref={canvasRef}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="relative overflow-auto"
            style={{ height: canvasHeight }}
            role="application"
            aria-label="工作流画布"
          >
            {/* 网格背景独立一层：.n-grid-bg 带 mask-image，直接挂容器会把子节点一起渐隐 */}
            <div aria-hidden="true" className="n-grid-bg pointer-events-none absolute inset-0" />
            <div
              className="relative origin-top-left"
              style={{ transform: `scale(${zoom})`, width: 980, height: canvasHeight }}
            >
              {/* 连线层 */}
              <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
                <defs>
                  <marker
                    id="flow-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto"
                  >
                    <path d="M0 1 L9 5 L0 9 z" fill="var(--n-border-strong)" />
                  </marker>
                </defs>
                {edges_.map((edge) => (
                  <g key={`${edge.from}-${edge.to}`}>
                    <path
                      d={edge.path}
                      fill="none"
                      stroke="var(--n-border-strong)"
                      strokeWidth={1.5}
                      markerEnd="url(#flow-arrow)"
                    />
                  </g>
                ))}
              </svg>

              {/* 节点层 */}
              {nodes.map((node) => {
                const meta = NODE_META[node.kind]
                const isSelected = node.id === selectedId
                return (
                  <div
                    key={node.id}
                    data-node={node.id}
                    onPointerDown={(event) => onPointerDown(event, node)}
                    onClick={() => setSelectedId(node.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${meta.label}：${node.title}`}
                    aria-pressed={isSelected}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedId(node.id)
                      }
                    }}
                    style={{
                      left: node.x,
                      top: node.y,
                      width: NODE_WIDTH,
                      height: NODE_HEIGHT,
                      touchAction: 'none',
                    }}
                    className={cn(
                      'absolute flex cursor-grab items-center gap-2 rounded-lg border bg-surface px-2.5 shadow-sm transition-shadow active:cursor-grabbing',
                      isSelected
                        ? 'ring-primary-ring border-primary shadow-md ring-2'
                        : 'border-line hover:border-line-strong',
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-7 shrink-0 place-items-center rounded-md border',
                        TONE_BORDER[meta.tone],
                      )}
                    >
                      <meta.icon className={cn('size-3.5', TONE_ICON[meta.tone])} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-fg">{node.title}</p>
                      <p className="truncate text-[0.625rem] text-fg-3">{node.description}</p>
                    </div>
                    {/* 端口装饰 */}
                    <span className="absolute top-1/2 -left-[0.1875rem] size-1.5 -translate-y-1/2 rounded-full bg-line-strong" />
                    <span className="absolute top-1/2 -right-[0.1875rem] size-1.5 -translate-y-1/2 rounded-full bg-line-strong" />
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* 属性面板 */}
      <Drawer
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelectedId(null)}
        title={`节点属性 · ${selected ? NODE_META[selected.kind].label : ''}`}
        description={selected ? selected.id : undefined}
        width={380}
        footer={
          selected && (
            <>
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash className="size-3.5" />}
                onClick={removeSelected}
              >
                删除节点
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Save className="size-3.5" />}
                onClick={() => {
                  toast.success('节点已保存')
                  setSelectedId(null)
                }}
              >
                保存
              </Button>
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-3">
            <FormField label="节点名称">
              <Input
                value={selected.title}
                onChange={(event) => updateNode({ title: event.target.value })}
              />
            </FormField>
            <FormField label="说明">
              <Input
                value={selected.description}
                onChange={(event) => updateNode({ description: event.target.value })}
              />
            </FormField>

            {selected.kind === 'condition' && (
              <>
                <FormField label="判断字段">
                  <Input
                    value={String(selected.config.field ?? '')}
                    onChange={(event) => updateConfig('field', event.target.value)}
                  />
                </FormField>
                <FormField label="比较方式">
                  <Select
                    options={[
                      { label: '大于', value: 'greater_than' },
                      { label: '小于', value: 'less_than' },
                      { label: '等于', value: 'equals' },
                      { label: '包含', value: 'contains' },
                    ]}
                    value={String(selected.config.operator ?? 'greater_than')}
                    onChange={(value) => updateConfig('operator', value)}
                  />
                </FormField>
                <FormField label="阈值">
                  <Input
                    value={String(selected.config.value ?? '')}
                    onChange={(event) => updateConfig('value', event.target.value)}
                  />
                </FormField>
              </>
            )}

            {selected.kind === 'trigger' && (
              <>
                <FormField label="监听事件">
                  <Input
                    value={String(selected.config.event ?? '')}
                    onChange={(event) => updateConfig('event', event.target.value)}
                  />
                </FormField>
                <Switch
                  checked={Boolean(selected.config.throttle)}
                  onChange={(checked) => updateConfig('throttle', checked)}
                  label="开启节流"
                  description="同一订单 5 分钟内只触发一次"
                />
              </>
            )}

            {selected.kind === 'notify' && (
              <FormField label="通知渠道">
                <Select
                  options={[
                    { label: '企业微信', value: 'wecom' },
                    { label: '邮件', value: 'email' },
                    { label: 'Webhook', value: 'webhook' },
                  ]}
                  value={String(selected.config.channel ?? 'wecom')}
                  onChange={(value) => updateConfig('channel', value)}
                />
              </FormField>
            )}

            <Descriptions
              size="sm"
              columns={1}
              items={[
                { label: '节点 ID', value: selected.id, copyable: true },
                { label: '坐标', value: `x ${selected.x} · y ${selected.y}` },
                {
                  label: '出边',
                  value: String(edges.filter((edge) => edge.from === selected.id).length),
                },
              ]}
            />

            <div className="flex gap-2">
              {selected.kind === 'notify' && <Mail className="size-4 text-fg-4" />}
              {selected.kind === 'notify' && <Webhook className="size-4 text-fg-4" />}
            </div>
          </div>
        )}
      </Drawer>
    </PageContainer>
  )
}
