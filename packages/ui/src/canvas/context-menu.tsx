import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../lib/utils'

/**
 * 画布右键菜单
 *
 * 为什么不复用 <Dropdown>：画布菜单需要三件 Dropdown 没有的能力——
 * 1. **分组 + 子菜单**（对齐/添加节点是多级）；
 * 2. **键盘导航**（↑↓ 移动、→ 进子菜单、← 返回、Esc 关闭、Enter 执行）；
 * 3. **按指针位置定位并夹取到容器内**（右侧/底部空间不足时自动回弹）。
 *
 * 无障碍：容器 role="menu"，条目 role="menuitem"，焦点用 roving tabindex 管理，
 * 打开时聚焦第一项，关闭时把焦点还给触发元素（由调用方负责，见 InfiniteCanvas）。
 */

export interface CanvasMenuItem {
  key: string
  label: string
  icon?: ReactNode
  /** 快捷键提示，仅展示 */
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  /** 子菜单 */
  children?: CanvasMenuItem[]
  onSelect?: () => void
}

export interface CanvasMenuSection {
  key: string
  /** 可选的小标题（如「对齐」） */
  title?: string
  items: CanvasMenuItem[]
}

export interface CanvasContextMenuProps {
  open: boolean
  /** 屏幕坐标（相对画布容器） */
  x: number
  y: number
  sections: CanvasMenuSection[]
  /** 容器尺寸，用于夹取 */
  containerSize: { width: number; height: number }
  onClose: () => void
  /** 抬头信息，如「节点 · 片头文案」 */
  title?: string
}

const MENU_WIDTH = 216
const SUBMENU_WIDTH = 176
const ITEM_HEIGHT = 28
const PAD = 6

export function CanvasContextMenu({
  open,
  x,
  y,
  sections,
  containerSize,
  onClose,
  title,
}: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [openSubKey, setOpenSubKey] = useState<string | null>(null)
  const [pos, setPos] = useState({ left: x, top: y })
  /**
   * 子菜单往哪边展开
   *
   * 主菜单贴着右边界时，子菜单必须翻到左侧，否则会被画布的 overflow 裁掉。
   * 判定用「主菜单左边缘 + 主菜单宽 + 子菜单宽」是否超出容器 —— 一次性算好，
   * 不在每次悬停时再测 DOM。
   */
  const [submenuSide, setSubmenuSide] = useState<'right' | 'left'>('right')

  const flat = useRef<CanvasMenuItem[]>([])

  // 每次打开：重置状态并把位置夹到容器内
  useLayoutEffect(() => {
    if (!open) return
    setActiveKey(null)
    setOpenSubKey(null)
    const el = menuRef.current
    const width = el?.offsetWidth ?? MENU_WIDTH
    const height = el?.offsetHeight ?? sections.length * ITEM_HEIGHT * 2
    const left = Math.max(PAD, Math.min(x, containerSize.width - width - PAD))
    const top = Math.max(PAD, Math.min(y, containerSize.height - height - PAD))
    setPos({ left, top })
    setSubmenuSide(left + width + SUBMENU_WIDTH + PAD > containerSize.width ? 'left' : 'right')
    // 依赖里只放 open 与坐标：尺寸测量在首帧完成，容器尺寸变化时重算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, x, y, containerSize.width, containerSize.height])

  // 打开时聚焦第一项
  useEffect(() => {
    if (!open) return
    const timer = requestAnimationFrame(() => {
      const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')
      first?.focus()
    })
    return () => cancelAnimationFrame(timer)
  }, [open])

  // 点击外部 / 窗口失焦 / 滚动时关闭
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('blur', onClose)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('blur', onClose)
    }
  }, [open, onClose])

  flat.current = sections.flatMap((section) => section.items)

  const focusSibling = useCallback((direction: 1 | -1) => {
    const nodes = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    ).filter((node) => node.getAttribute('aria-disabled') !== 'true')
    if (nodes.length === 0) return
    const index = nodes.indexOf(document.activeElement as HTMLElement)
    const next = index === -1 ? 0 : (index + direction + nodes.length) % nodes.length
    nodes[next]?.focus()
    setActiveKey(nodes[next]?.dataset.menuKey ?? null)
  }, [])

  if (!open) return null

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={title ?? '画布菜单'}
      data-canvas-context-menu=""
      className="n-canvas-menu absolute z-[70]"
      style={{ left: pos.left, top: pos.top, minWidth: MENU_WIDTH }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          focusSibling(1)
        } else if (event.key === 'ArrowUp') {
          event.preventDefault()
          focusSibling(-1)
        } else if (event.key === 'ArrowRight') {
          const key = (document.activeElement as HTMLElement | null)?.dataset.menuKey
          const item = flat.current.find((entry) => entry.key === key)
          if (item?.children?.length) {
            event.preventDefault()
            setOpenSubKey(item.key)
          }
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault()
          setOpenSubKey(null)
        }
      }}
    >
      {title && (
        <p className="truncate border-b border-line-subtle px-2.5 py-1.5 text-[0.625rem] font-medium text-fg-4">
          {title}
        </p>
      )}

      {sections.map((section, sectionIndex) => (
        <div
          key={section.key}
          role="group"
          aria-label={section.title}
          className={sectionIndex > 0 ? 'border-t border-line-subtle pt-1 mt-1' : ''}
        >
          {section.title && (
            <p className="px-2.5 py-1 text-[0.5625rem] font-semibold tracking-[0.08em] text-fg-4 uppercase">
              {section.title}
            </p>
          )}
          {section.items.map((item) => {
            const hasChildren = Boolean(item.children?.length)
            return (
              <div key={item.key} className="relative">
                <button
                  type="button"
                  role="menuitem"
                  data-menu-key={item.key}
                  aria-disabled={item.disabled ? 'true' : undefined}
                  aria-haspopup={hasChildren ? 'menu' : undefined}
                  aria-expanded={hasChildren ? openSubKey === item.key : undefined}
                  tabIndex={item.key === activeKey ? 0 : -1}
                  onPointerEnter={() => {
                    setActiveKey(item.key)
                    setOpenSubKey(hasChildren ? item.key : null)
                  }}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (item.disabled) return
                    if (hasChildren) {
                      setOpenSubKey((current) => (current === item.key ? null : item.key))
                      return
                    }
                    item.onSelect?.()
                    onClose()
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[0.75rem] transition-colors',
                    item.danger ? 'text-danger hover:bg-danger-weak' : 'text-fg-2 hover:bg-surface-2 hover:text-fg',
                    item.disabled && 'cursor-default opacity-40 hover:bg-transparent',
                    item.key === activeKey && !item.disabled && (item.danger ? 'bg-danger-weak' : 'bg-surface-2'),
                  )}
                >
                  <span className="grid size-3.5 shrink-0 place-items-center text-current opacity-70">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.shortcut && (
                    <span className="shrink-0 text-[0.5625rem] text-fg-4 tabular-nums">{item.shortcut}</span>
                  )}
                  {hasChildren && <span className="shrink-0 text-[0.625rem] text-fg-4">›</span>}
                </button>

                {hasChildren && openSubKey === item.key && (
                  <div
                    role="menu"
                    aria-label={item.label}
                    className={cn(
                      'n-canvas-menu absolute top-0 z-[71]',
                      submenuSide === 'right' ? 'left-full ml-1' : 'right-full mr-1',
                    )}
                    style={{ minWidth: SUBMENU_WIDTH }}
                  >
                    {item.children?.map((child) => (
                      <button
                        key={child.key}
                        type="button"
                        role="menuitem"
                        aria-disabled={child.disabled ? 'true' : undefined}
                        onClick={(event) => {
                          event.stopPropagation()
                          if (child.disabled) return
                          child.onSelect?.()
                          onClose()
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[0.75rem] transition-colors',
                          child.danger
                            ? 'text-danger hover:bg-danger-weak'
                            : 'text-fg-2 hover:bg-surface-2 hover:text-fg',
                          child.disabled && 'cursor-default opacity-40 hover:bg-transparent',
                        )}
                      >
                        <span className="grid size-3.5 shrink-0 place-items-center opacity-70">
                          {child.icon}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{child.label}</span>
                        {child.shortcut && (
                          <span className="shrink-0 text-[0.5625rem] text-fg-4 tabular-nums">
                            {child.shortcut}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
