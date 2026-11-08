import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/utils'
import { useUILabels } from '../lib/hooks'
import { sxSize } from '../lib/scale'
import { Button } from './button'

export interface DialogProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  /** 宽度：sm 380 / md 520 / lg 680 / xl 840 */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  /** 点击遮罩关闭 */
  closeOnOverlayClick?: boolean
  showClose?: boolean
  className?: string
  bodyClassName?: string
  /** 自定义头部图标 */
  icon?: ReactNode
  /** 底部区域左对齐内容 */
  footerLeft?: ReactNode
}

const SIZE: Record<NonNullable<DialogProps['size']>, string> = {
  sm: 'max-w-[23.75rem]',
  md: 'max-w-[32.5rem]',
  lg: 'max-w-[42.5rem]',
  xl: 'max-w-[52.5rem]',
  full: 'max-w-[calc(100vw-2rem)] h-[calc(100vh-4rem)]',
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * 对话框 · 无障碍（焦点陷阱 / ESC 关闭 / 滚动锁定）
 *
 * @example
 * <Dialog open={open} onOpenChange={setOpen} title="新建用户" footer={<Button variant="primary">保存</Button>}>
 *   <FormField label="用户名"><Input /></FormField>
 * </Dialog>
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  footerLeft,
  size = 'md',
  closeOnOverlayClick = true,
  showClose = true,
  className,
  bodyClassName,
  icon,
}: DialogProps) {
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(open)

  useEffect(() => {
    if (open) {
      setVisible(true)
      return
    }
    const timer = setTimeout(() => setVisible(false), 160)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const focusTimer = requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel) return
      const first = panel.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? panel).focus()
    })

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onOpenChange?.(false)
        return
      }
      if (event.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      )
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      cancelAnimationFrame(focusTimer)
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = overflow
      restoreRef.current?.focus?.()
    }
  }, [open, onOpenChange])

  if (!visible) return null

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div
        className={cn(
          'fixed inset-0 bg-black/35 backdrop-blur-[0.125rem] transition-opacity duration-150 dark:bg-black/55',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={() => closeOnOverlayClick && onOpenChange?.(false)}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-10 my-auto flex w-full flex-col rounded-xl border border-line bg-surface shadow-xl outline-none',
          'transition-[transform,opacity] duration-200',
          open ? 'scale-100 opacity-100' : 'scale-[0.97] opacity-0',
          SIZE[size],
          className,
        )}
      >
        {(title || showClose) && (
          <div className="flex items-start gap-3 border-b border-line px-5 py-3.5">
            {icon && <div className="mt-0.5 shrink-0 text-primary">{icon}</div>}
            <div className="min-w-0 flex-1">
              {title && (
                <h2 id={titleId} className="text-sm font-semibold text-fg">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="mt-1 text-xs leading-5 text-fg-3">
                  {description}
                </p>
              )}
            </div>
            {showClose && (
              <button
                type="button"
                aria-label="关闭"
                onClick={() => onOpenChange?.(false)}
                className="-mt-0.5 -mr-1 shrink-0 rounded-md p-1 text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
                  <path
                    d="m6 6 12 12M18 6 6 18"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', bodyClassName)}>
          {children}
        </div>
        {(footer || footerLeft) && (
          <div className="flex items-center gap-2 border-t border-line px-5 py-3">
            {footerLeft && <div className="mr-auto">{footerLeft}</div>}
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  /** 危险操作样式 */
  danger?: boolean
  confirmText?: string
  cancelText?: string
  loading?: boolean
  onConfirm: () => void | Promise<void>
  children?: ReactNode
}

/** 确认对话框：二次确认/危险操作 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  danger,
  confirmText,
  cancelText,
  loading,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const L = useUILabels()
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      showClose={false}
      title={title}
      description={description}
      icon={
        <span
          className={cn(
            'grid size-8 place-items-center rounded-full',
            danger ? 'bg-danger-weak text-danger' : 'bg-primary-weak text-primary',
          )}
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
            <path d="M12 8.5v4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="16" r="1.1" fill="currentColor" />
            <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {cancelText ?? L.cancel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            loading={loading}
            onClick={() => void onConfirm()}
          >
            {confirmText ?? L.confirm}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  )
}

export interface DrawerProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  /** 底部左侧内容（如「恢复默认」） */
  footerLeft?: ReactNode
  side?: 'right' | 'left'
  width?: number | string
  className?: string
  bodyClassName?: string
  /**
   * 遮罩强度
   *
   * - `dim`（默认）：深色遮罩，适合表单 / 详情
   * - `soft`：极淡遮罩，页面仍然可读 —— 适合「边调边看」的外观设置面板
   * - `none`：完全无遮罩，点击面板外区域仍然关闭
   */
  overlay?: 'dim' | 'soft' | 'none'
  /** 点击遮罩关闭（默认 true） */
  closeOnOverlayClick?: boolean
}

/**
 * 抽屉：适合表单/详情侧滑，也适合「边调边看」的外观设置面板
 *
 * 无障碍：焦点陷阱 / ESC 关闭 / 滚动锁定 / 关闭后焦点归还，
 * 与 Dialog 使用同一套约定（`overlay="none"` 时仍然拦截 Tab，避免焦点跑到背后）。
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  footerLeft,
  side = 'right',
  width = 460,
  className,
  bodyClassName,
  overlay = 'dim',
  closeOnOverlayClick = true,
}: DrawerProps) {
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const [rendered, setRendered] = useState(open)

  useEffect(() => {
    if (open) {
      setRendered(true)
      return
    }
    const timer = setTimeout(() => setRendered(false), 220)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const focusTimer = requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel) return
      const first = panel.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? panel).focus()
    })

    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onOpenChange?.(false)
        return
      }
      if (event.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      )
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => {
      cancelAnimationFrame(focusTimer)
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = overflow
      restoreRef.current?.focus?.()
    }
  }, [open, onOpenChange])

  const stop = useCallback((e: React.MouseEvent) => e.stopPropagation(), [])

  if (!rendered) return null

  return createPortal(
    <div className="fixed inset-0 z-[1000]">
      {overlay !== 'none' && (
        <div
          className={cn(
            'absolute inset-0 transition-opacity duration-200',
            overlay === 'dim'
              ? 'bg-black/30 backdrop-blur-[1px] dark:bg-black/50'
              : 'bg-black/10 dark:bg-black/25',
            open ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => closeOnOverlayClick && onOpenChange?.(false)}
          aria-hidden="true"
        />
      )}
      {/* 无遮罩时保留一层透明点击区：点面板外仍然关闭，符合面板式交互的直觉 */}
      {overlay === 'none' && closeOnOverlayClick && (
        <div
          className="absolute inset-0"
          onClick={() => onOpenChange?.(false)}
          aria-hidden="true"
        />
      )}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onClick={stop}
        style={{ width: sxSize(width) }}
        className={cn(
          'absolute top-0 flex h-full max-w-[calc(100vw-1.5rem)] flex-col border-line bg-surface shadow-xl outline-none transition-transform duration-220 ease-[var(--ease-out-expo)]',
          side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
          open ? 'translate-x-0' : side === 'right' ? 'translate-x-full' : '-translate-x-full',
          className,
        )}
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0 flex-1">
            {title && (
              <h2 id={titleId} className="text-sm font-semibold text-fg">
                {title}
              </h2>
            )}
            {description && (
              <p id={descId} className="mt-1 text-xs leading-5 text-fg-3">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="关闭"
            onClick={() => onOpenChange?.(false)}
            className="rounded-md p-1 text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', bodyClassName)}>
          {children}
        </div>
        {(footer || footerLeft) && (
          <div className="flex items-center gap-2 border-t border-line px-5 py-3">
            {footerLeft && <div className="mr-auto">{footerLeft}</div>}
            {footer}
          </div>
        )}
      </aside>
    </div>,
    document.body,
  )
}
