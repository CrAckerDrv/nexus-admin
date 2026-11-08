import { cn } from '@nexus/ui'

/**
 * 底部状态条
 *
 * 把「画布到底跑得怎么样」摊开给人看：
 * 节点总数 / 已挂载（剔除后）/ 连线数 / 帧率 / 选中数。
 *
 * 已挂载 vs 总节点是验证剔除是否生效的最直接证据 ——
 * 压测 1000 节点时，这里应该显示几十，而不是 1000。
 */

export interface CanvasStatusBarProps {
  /** 内容宽度（世界坐标总宽），展示文档规模 */
  contentWidth: number
  nodes: number
  edges: number
  visible: number
  fps: number
  selection: number
  onFit: () => void
}

export function CanvasStatusBar({
  contentWidth,
  nodes,
  edges,
  visible,
  fps,
  selection,
  onFit,
}: CanvasStatusBarProps) {
  const fpsTone = fps >= 55 ? 'text-success' : fps >= 40 ? 'text-warning' : 'text-danger'

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-[0.6875rem] text-fg-3">
      <Metric label="节点" value={String(nodes)} />
      <Metric label="已挂载" value={String(visible)} hint="视口剔除后真正渲染的节点数" highlight />
      <Metric label="连线" value={String(edges)} />
      <Metric label="选中" value={String(selection)} />
      <span className="flex items-center gap-1">
        <span className="text-fg-4">帧率</span>
        <span className={cn('font-medium tabular-nums', fpsTone)}>{fps}</span>
        <span className="text-fg-4">fps</span>
      </span>

      <span className="hidden sm:inline text-fg-4">内容宽度 {contentWidth} px</span>

      <button
        type="button"
        onClick={onFit}
        className="ml-auto rounded-md px-1.5 py-0.5 text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg"
      >
        适配全部
      </button>
      <span className="text-fg-4">滚轮缩放 · 空格拖拽 · Shift+1 适配</span>
    </div>
  )
}

function Metric({
  label,
  value,
  hint,
  highlight,
}: {
  label: string
  value: string
  hint?: string
  highlight?: boolean
}) {
  return (
    <span className="flex items-center gap-1" title={hint}>
      <span className="text-fg-4">{label}</span>
      <span className={cn('font-medium tabular-nums', highlight ? 'text-primary' : 'text-fg-2')}>
        {value}
      </span>
    </span>
  )
}
