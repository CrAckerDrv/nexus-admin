import { cn } from '@nexus/ui'
import { CopyIcon, GroupIcon, LockIcon, TrashIcon, UndoIcon } from '@nexus/ui'

/**
 * 底部选中工具条（画布级）
 *
 * 这里承载「选中之后要做什么」——包括**编组**。
 * 为什么编组放在这里而不是卡片顶部：
 * 编组天然是「多选之后」的动作，而卡片顶部菜单一次只作用于一张卡；
 * 放在底部工具条上，语义与操作半径都更顺，也和 Figma / Sketch 的习惯一致。
 */

export interface CanvasSelectionBarProps {
  selection: string[]
  onDelete: () => void
  onDuplicate: () => void
  onAlign: (mode: 'left' | 'top' | 'hcenter' | 'vcenter' | 'distribute-x') => void
  onToggleLock: () => void
  /** 编组（选中 ≥ 2 时可用） */
  onGroup: () => void
  /** 解组（选中里含分组或组成员时可用） */
  onUngroup: () => void
  /** 当前选中里是否已经存在分组关系 */
  grouped: boolean
}

const ALIGN_ACTIONS: Array<{ mode: Parameters<CanvasSelectionBarProps['onAlign']>[0]; label: string }> = [
  { mode: 'left', label: '左对齐' },
  { mode: 'hcenter', label: '水平居中' },
  { mode: 'top', label: '顶对齐' },
  { mode: 'vcenter', label: '垂直居中' },
  { mode: 'distribute-x', label: '水平分布' },
]

export function CanvasSelectionBar({
  selection,
  onDelete,
  onDuplicate,
  onAlign,
  onToggleLock,
  onGroup,
  onUngroup,
  grouped,
}: CanvasSelectionBarProps) {
  if (selection.length === 0) return null

  const canGroup = selection.length >= 2

  return (
    <div
      role="toolbar"
      aria-label="选中节点操作"
      className="pointer-events-auto absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-line bg-surface/95 px-1.5 py-1 whitespace-nowrap shadow-md backdrop-blur-sm"
    >
      <span className="shrink-0 px-1.5 text-[0.6875rem] font-medium whitespace-nowrap text-fg-2 tabular-nums">
        已选 {selection.length}
      </span>
      <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-line" />

      {/* 编组：底部工具条上的第一组动作 —— 多选之后最常做的事 */}
      <button
        type="button"
        onClick={onGroup}
        disabled={!canGroup}
        title={canGroup ? '把选中节点编为一组（⌘G）' : '至少选中两个节点才能编组'}
        className={cn(
          'inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-[0.6875rem] whitespace-nowrap transition-colors',
          canGroup
            ? 'text-fg-2 hover:bg-primary-weak hover:text-primary'
            : 'pointer-events-none opacity-40',
        )}
      >
        <GroupIcon size={12} />
        编组
      </button>
      <button
        type="button"
        onClick={onUngroup}
        disabled={!grouped}
        title={grouped ? '解散选中的分组' : '选中的节点不在任何分组里'}
        className={cn(
          'inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-[0.6875rem] whitespace-nowrap transition-colors',
          grouped
            ? 'text-fg-2 hover:bg-warning-weak hover:text-warning'
            : 'pointer-events-none opacity-40',
        )}
      >
        <UndoIcon size={12} />
        解组
      </button>

      <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-line" />

      {ALIGN_ACTIONS.map((action) => (
        <button
          key={action.mode}
          type="button"
          onClick={() => onAlign(action.mode)}
          disabled={selection.length < 2}
          className={cn(
            'h-6 shrink-0 rounded-md px-1.5 text-[0.6875rem] whitespace-nowrap text-fg-3 transition-colors',
            'hover:bg-surface-2 hover:text-fg',
            selection.length < 2 && 'pointer-events-none opacity-40',
          )}
        >
          {action.label}
        </button>
      ))}

      <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-line" />

      <IconAction label="创建副本" hint="Ctrl / ⌘ + D" onClick={onDuplicate}>
        <CopyIcon size={13} />
      </IconAction>
      <IconAction label="锁定 / 解锁" onClick={onToggleLock}>
        <LockIcon size={13} />
      </IconAction>
      <IconAction label="删除" hint="Delete" onClick={onDelete} danger>
        <TrashIcon size={13} />
      </IconAction>
    </div>
  )
}

function IconAction({
  label,
  hint,
  onClick,
  danger,
  children,
}: {
  label: string
  hint?: string
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={hint ? `${label}（${hint}）` : label}
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded-md text-fg-3 transition-colors',
        danger ? 'hover:bg-danger-weak hover:text-danger' : 'hover:bg-surface-2 hover:text-fg',
      )}
    >
      {children}
    </button>
  )
}
