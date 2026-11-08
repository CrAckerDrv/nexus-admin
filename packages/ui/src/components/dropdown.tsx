import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/utils'
import { sx, useChromePortal } from '../lib/scale'

export interface DropdownItem {
  key: string
  label: ReactNode
  icon?: ReactNode
  /** 右侧快捷键/说明 */
  hint?: ReactNode
  danger?: boolean
  disabled?: boolean
  /** 分隔线（该条之前插入） */
  divider?: boolean
  onSelect?: () => void
}

export interface DropdownProps {
  trigger: ReactNode
  items: Array<DropdownItem | 'divider'>
  align?: 'start' | 'end'
  side?: 'bottom' | 'top' | 'right'
  width?: number
  className?: string
  menuClassName?: string
  /** 受控展开（可选） */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * 下拉菜单 · 键盘可达、自动翻转定位
 *
 * @example
 * <Dropdown trigger={<Button size="icon-sm"><MoreHorizontal /></Button>} items={[{key:'edit',label:'编辑',onSelect}]} align="end" />
 */
export function Dropdown({
  trigger,
  items,
  align = 'start',
  side = 'bottom',
  width,
  className,
  menuClassName,
  open: openProp,
  onOpenChange,
}: DropdownProps) {
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenState(next)
    onOpenChange?.(next)
  }
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  // 菜单是 fixed 定位 + 数字坐标；根字号恒 16px，设计像素即真实像素
  const chrome = useChromePortal()

  const actionable = items.filter(
    (item): item is DropdownItem => item !== 'divider' && !item.disabled,
  )

  const position = useCallback(() => {
    const anchor = rootRef.current
    const menu = menuRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const menuRect = menu?.getBoundingClientRect()
    // 菜单宽度以实测为准；首帧还没渲染出来时按设计像素估算
    const menuWidth = menuRect?.width ?? width ?? 180
    const menuHeight = menuRect?.height ?? 0
    const gap = 6
    const safe = 8
    let top = rect.bottom + gap
    if (side === 'top' || top + menuHeight > window.innerHeight - safe) {
      top = Math.max(safe, rect.top - menuHeight - gap)
    }
    let left = align === 'end' ? rect.right - menuWidth : rect.left
    left = Math.min(Math.max(safe, left), window.innerWidth - menuWidth - safe)
    setCoords({ top: chrome.offset(top), left: chrome.offset(left) })
  }, [align, side, width, chrome])

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null)
      return
    }
    position()
    const raf = requestAnimationFrame(position)
    return () => cancelAnimationFrame(raf)
  }, [open, position])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((prev) => (prev + 1) % Math.max(actionable.length, 1))
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((prev) => (prev - 1 + actionable.length) % Math.max(actionable.length, 1))
      }
      if (event.key === 'Enter') {
        const item = actionable[activeIndex]
        if (item) {
          item.onSelect?.()
          setOpen(false)
        }
      }
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, position, activeIndex, items])

  return (
    <div ref={rootRef} className={cn('inline-flex', className)}>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation()
          setOpen(!open)
          setActiveIndex(-1)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
          }
        }}
        className="inline-flex outline-none"
      >
        {trigger}
      </div>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              top: coords?.top ?? -9999,
              left: coords?.left ?? -9999,
              // width 是设计像素；交给 rem 描述，与内容同单位
              width: width ? sx(width) : undefined,
              visibility: coords ? 'visible' : 'hidden',
            }}
            className={cn(
              'n-enter fixed z-[1100] overflow-hidden rounded-md border border-line bg-surface p-1 shadow-lg',
              !width && 'min-w-[10.5rem]',
              menuClassName,
            )}
          >
            {items.map((item, index) => {
              if (item === 'divider') {
                return (
                  <div key={`divider-${index}`} className="my-1 h-px bg-line" role="separator" />
                )
              }
              const ai = actionable.indexOf(item)
              return (
                <button
                  key={item.key}
                  role="menuitem"
                  type="button"
                  disabled={item.disabled}
                  onMouseEnter={() => setActiveIndex(ai)}
                  onClick={() => {
                    item.onSelect?.()
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[0.8125rem] transition-colors',
                    item.danger
                      ? 'text-danger hover:bg-danger-weak'
                      : 'text-fg-2 hover:bg-surface-2 hover:text-fg',
                    activeIndex === ai && (item.danger ? 'bg-danger-weak' : 'bg-surface-2'),
                    item.disabled && 'cursor-not-allowed opacity-40',
                  )}
                >
                  {item.icon && <span className="shrink-0">{item.icon}</span>}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="shrink-0 text-2xs text-fg-4">{item.hint}</span>}
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}
