import { Badge, cn } from '@nexus/ui'
import {
  FitIcon,
  GridIcon,
  HelpIcon,
  MapIcon,
  RedoIcon,
  SparkIcon,
  UndoIcon,
} from '@nexus/ui'
import type { DemoScene } from '../../canvas-demo/scene-data'

/**
 * 画布工具条
 *
 * 信息层级：左边是「我在看哪份文档」，中间是「文档级操作」，右边是「视图与视图辅助」。
 * 所有按钮都带 title（鼠标可读）与 aria-label（键盘/读屏可读），
 * 快捷键在 help-dialog 里统一列出，避免在按钮上堆提示。
 */

export interface CanvasToolbarProps {
  sceneId: string
  scenes: DemoScene[]
  onSceneChange: (id: string) => void
  onReset: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  aiFollow: boolean
  onToggleAiFollow: () => void
  minimap: boolean
  onToggleMinimap: () => void
  grid: boolean
  onToggleGrid: () => void
  onStressTest: () => void
  onHelp: () => void
  onFit: () => void
}

export function CanvasToolbar({
  sceneId,
  scenes,
  onSceneChange,
  onReset,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  aiFollow,
  onToggleAiFollow,
  minimap,
  onToggleMinimap,
  grid,
  onToggleGrid,
  onStressTest,
  onHelp,
  onFit,
}: CanvasToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5">
      <span className="flex items-center gap-1.5 pl-1">
        <span className="grid size-6 place-items-center rounded-md bg-primary-weak text-primary">
          <SparkIcon size={13} />
        </span>
        <span className="text-[0.8125rem] font-semibold text-fg">无限画布</span>
        <Badge tone="primary" size="sm">
          Canvas
        </Badge>
      </span>

      <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />

      {/* 场景切换 */}
      <div className="flex items-center gap-1" role="group" aria-label="示例场景">
        {scenes.map((scene) => (
          <button
            key={scene.id}
            type="button"
            onClick={() => onSceneChange(scene.id)}
            aria-pressed={sceneId === scene.id}
            title={scene.description}
            className={cn(
              'h-6 rounded-md px-2 text-[0.6875rem] transition-colors',
              sceneId === scene.id
                ? 'bg-primary-weak font-medium text-primary'
                : 'text-fg-3 hover:bg-surface-2 hover:text-fg',
            )}
          >
            {scene.name}
          </button>
        ))}
      </div>

      <button type="button" onClick={onReset} className="n-tool-btn" title="恢复当前场景的初始状态">
        重置场景
      </button>

      <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />

      <ToolButton label="撤销" hint="Ctrl / ⌘ + Z" onClick={onUndo} disabled={!canUndo}>
        <UndoIcon size={14} />
      </ToolButton>
      <ToolButton label="重做" hint="Ctrl / ⌘ + Shift + Z" onClick={onRedo} disabled={!canRedo}>
        <RedoIcon size={14} />
      </ToolButton>

      <span className="ml-auto" />

      <ToolButton
        label={aiFollow ? 'AI 跟随点击：开' : 'AI 跟随点击：关'}
        hint="开启后单击任意节点即打开该节点的 AI 对话框"
        onClick={onToggleAiFollow}
        active={aiFollow}
      >
        <SparkIcon size={14} />
        <span className="ml-1 text-[0.6875rem]">AI 跟随</span>
      </ToolButton>

      <ToolButton label="网格吸附" hint="关闭后拖动不再吸附到 8px 网格" onClick={onToggleGrid} active={grid}>
        <GridIcon size={14} />
      </ToolButton>
      <ToolButton label="小地图" hint="显示右下角缩略图，点击可跳转" onClick={onToggleMinimap} active={minimap}>
        <MapIcon size={14} />
      </ToolButton>
      <ToolButton label="适配全部" hint="Shift + 1" onClick={onFit}>
        <FitIcon size={14} />
      </ToolButton>

      <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />

      <button
        type="button"
        onClick={onStressTest}
        title="生成 1000 个节点，验证视口剔除与帧率"
        className="h-6 rounded-md border border-line px-2 text-[0.6875rem] text-fg-2 transition-colors hover:border-primary/40 hover:bg-surface-2 hover:text-fg"
      >
        压力测试 1,000
      </button>
      <ToolButton label="快捷键帮助" hint="?" onClick={onHelp}>
        <HelpIcon size={14} />
      </ToolButton>
    </div>
  )
}

function ToolButton({
  label,
  hint,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string
  hint?: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={hint ? `${label}（${hint}）` : label}
      className={cn(
        'inline-flex h-6 items-center rounded-md px-1.5 text-fg-3 transition-colors',
        'hover:bg-surface-2 hover:text-fg',
        active && 'bg-primary-weak text-primary',
        disabled && 'pointer-events-none opacity-40',
      )}
    >
      {children}
    </button>
  )
}
