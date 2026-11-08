import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { cn } from '../lib/utils'

export type ToastTone = 'default' | 'success' | 'error' | 'warning' | 'loading'

export interface ToastItem {
  id: string
  title: ReactNode
  description?: ReactNode
  tone?: ToastTone
  duration?: number
  action?: { label: string; onClick: () => void }
}

/* ------------------------------------------------------------------ *
 * 轻量外部存储：useSyncExternalStore 订阅
 * 不依赖任何状态库，保证 @nexus/ui 零运行时依赖
 * ------------------------------------------------------------------ */

let items: ToastItem[] = []
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return items
}

/** 读取当前 Toast 列表（可在 React 外使用） */
export function getToasts(): ToastItem[] {
  return items
}

/** 在任意位置订阅 Toast 列表 */
export function useToastItems(): ToastItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function dismissToast(id: string) {
  items = items.filter((item) => item.id !== id)
  emit()
}

export function clearToasts() {
  items = []
  emit()
}

function push(item: Omit<ToastItem, 'id'> & { id?: string }): string {
  const id = item.id ?? `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  items = [...items.filter((toast) => toast.id !== id), { ...item, id }]
  emit()
  const duration = item.duration ?? (item.tone === 'loading' ? 0 : 3200)
  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration)
  }
  return id
}

export interface ToastOptions {
  description?: ReactNode
  duration?: number
  action?: { label: string; onClick: () => void }
  id?: string
}

/** 命令式调用：toast.success('保存成功') */
export const toast = {
  show: (title: ReactNode, opts: ToastOptions & { tone?: ToastTone } = {}) =>
    push({ title, ...opts }),
  success: (title: ReactNode, opts: ToastOptions = {}) => push({ title, tone: 'success', ...opts }),
  error: (title: ReactNode, opts: ToastOptions = {}) => push({ title, tone: 'error', ...opts }),
  warning: (title: ReactNode, opts: ToastOptions = {}) => push({ title, tone: 'warning', ...opts }),
  info: (title: ReactNode, opts: ToastOptions = {}) => push({ title, tone: 'default', ...opts }),
  loading: (title: ReactNode, opts: ToastOptions = {}) => push({ title, tone: 'loading', ...opts }),
  dismiss: dismissToast,
  clear: clearToasts,
}

const TONE_ICON: Record<ToastTone, ReactNode> = {
  default: (
    <svg viewBox="0 0 24 24" className="size-4 text-primary" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 11v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="8" r="1.1" fill="currentColor" />
    </svg>
  ),
  success: (
    <svg viewBox="0 0 24 24" className="size-4 text-success" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m8 12.5 2.6 2.6L16.5 9"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" className="size-4 text-danger" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="m9 9 6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" className="size-4 text-warning" fill="none" aria-hidden="true">
      <path
        d="M12 4.5 21 19.5H3L12 4.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12 10v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.6" r="1" fill="currentColor" />
    </svg>
  ),
  loading: (
    <svg viewBox="0 0 24 24" className="size-4 text-primary" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        style={{ animation: 'n-spin 0.8s linear infinite', transformOrigin: '12px 12px' }}
      />
    </svg>
  ),
}

function ToastRow({ item }: { item: ToastItem }) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const duration = item.duration ?? (item.tone === 'loading' ? 0 : 3200)

  useEffect(() => () => void (timerRef.current && clearTimeout(timerRef.current)), [])

  return (
    <div
      role="status"
      aria-live="polite"
      className="n-enter pointer-events-auto flex w-[21.25rem] max-w-[calc(100vw-2rem)] items-start gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5 shadow-lg"
      onMouseEnter={() => timerRef.current && clearTimeout(timerRef.current)}
      onMouseLeave={() => {
        if (duration > 0) timerRef.current = setTimeout(() => dismissToast(item.id), 1200)
      }}
    >
      <span className="mt-0.5 shrink-0">{TONE_ICON[item.tone ?? 'default']}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.8125rem] leading-5 font-medium text-fg">{item.title}</p>
        {item.description && (
          <p className="mt-0.5 text-xs leading-5 text-fg-3">{item.description}</p>
        )}
        {item.action && (
          <button
            type="button"
            onClick={item.action.onClick}
            className="mt-1.5 text-xs font-medium text-primary hover:underline"
          >
            {item.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label="关闭通知"
        onClick={() => dismissToast(item.id)}
        className="-mr-1 shrink-0 rounded p-1 text-fg-4 transition-colors hover:bg-surface-2 hover:text-fg-2"
      >
        <svg viewBox="0 0 24 24" className="size-3" fill="none" aria-hidden="true">
          <path
            d="m6 6 12 12M18 6 6 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  )
}

/** Toast 容器：在应用根部挂载一次 */
export function Toaster({
  position = 'top-right',
}: {
  position?: 'top-right' | 'top-center' | 'bottom-right'
}) {
  const list = useToastItems()
  if (list.length === 0) return null
  return (
    <div
      className={cn(
        'pointer-events-none fixed z-[2000] flex flex-col gap-2',
        position === 'top-right' && 'top-4 right-4',
        position === 'top-center' && 'top-4 left-1/2 -translate-x-1/2',
        position === 'bottom-right' && 'right-4 bottom-4',
      )}
    >
      {list.map((item) => (
        <ToastRow key={item.id} item={item} />
      ))}
    </div>
  )
}

/** 兼容旧 API（store 形态），内部使用 useSyncExternalStore */
export const useToastStore = Object.assign(() => useToastItems(), {
  getState: () => ({ items: getToasts(), dismiss: dismissToast, clear: clearToasts, push }),
})
