import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

/**
 * 卡片顶部菜单
 *
 * 为什么放在卡片**内部顶端**而不是浮在卡片外面：
 * 画布节点有 `contain: layout paint`（性能关键）与 `overflow: hidden`，
 * 浮在外部会被裁掉。放在顶端做一条覆盖式工具条，既不会被裁，
 * 又能在 hover / 选中时自然地「盖住标题栏」，比外部浮层更稳。
 *
 * 交互约定：
 * - 只在 hover 或选中时出现（CSS 控制，不占额外渲染）；
 * - 所有按钮 `onPointerDown` 都 stopPropagation —— 否则点按钮会变成拖节点；
 * - 每个按钮带 `title` 与 `aria-label`，键盘可达。
 */

export interface CanvasNodeToolbarItem {
  key: string
  label: string
  icon: ReactNode
  onClick: () => void
  /** 危险操作（删除）用红色 */
  danger?: boolean
  /** 激活态（锁定、已编组等） */
  active?: boolean
  disabled?: boolean
  /** 显示为「图标 + 文字」的宽按钮（如 AI） */
  wide?: boolean
}

export interface CanvasNodeToolbarProps {
  items: CanvasNodeToolbarItem[]
  /** 覆盖在标题栏上时的背景强度 */
  className?: string
}

export function CanvasNodeToolbar({ items, className }: CanvasNodeToolbarProps) {
  if (items.length === 0) return null

  return (
    <div
      data-canvas-topmenu=""
      role="toolbar"
      aria-label="节点操作"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      className={cn('n-canvas-topmenu', className)}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          title={item.label}
          aria-label={item.label}
          aria-pressed={item.active}
          disabled={item.disabled}
          onClick={(event) => {
            event.stopPropagation()
            if (item.disabled) return
            item.onClick()
          }}
          className={cn(
            'n-canvas-topmenu__btn',
            item.danger && 'is-danger',
            item.active && 'is-active',
            item.wide && 'is-wide',
          )}
        >
          <span className="grid size-3.5 place-items-center">{item.icon}</span>
          {item.wide && <span className="truncate">{item.label}</span>}
        </button>
      ))}
    </div>
  )
}
