import { memo, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { cn } from '../lib/utils'
import { CheckIcon, CloseIcon, LockIcon, MoreIcon, SparkIcon } from './icons'

/**
 * 节点外壳
 *
 * 画布只提供「位置 + 尺寸 + 选中/拖动状态」，节点长什么样由宿主决定；
 * 但几乎所有节点都需要同一套外框（标题栏、AI 入口、状态徽标、脚注），
 * 于是抽成这个组件 —— 它是画布与业务内容之间的「视觉契约」。
 *
 * 设计要点：
 * - 选中态用 ring + 外发光，不用改变盒子尺寸（避免 layout 抖动）；
 * - 标题栏高度固定 34px，多类节点并排时标题基线一致；
 * - 「AI」按钮是渐变药丸，悬停才完全显形，避免安静状态下过度抢眼；
 * - 内容区 `contain: layout paint`，节点越多越稳定（不互相触发重排）。
 */

export type CanvasNodeTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info'

export interface CanvasNodeFrameProps {
  title: ReactNode
  /** 类型徽标（如 IMAGE / VIDEO） */
  badge?: ReactNode
  /** 左上角图标 */
  icon?: ReactNode
  tone?: CanvasNodeTone
  /** 选中态 */
  selected?: boolean
  /** 拖动中：关掉过渡与阴影扩散，减少合成开销 */
  dragging?: boolean
  /** 锁定态：显示锁徽标 */
  locked?: boolean
  /** 节点尺寸（用于 LOD 判断：极小尺寸只画色块） */
  size?: { width: number; height: number }
  zoom?: number
  /** 内容 */
  children: ReactNode
  /** 底部状态条 */
  footer?: ReactNode
  /** 右上角操作（默认有 AI + 更多） */
  actions?: ReactNode
  /** 点 AI 按钮 */
  onAI?: () => void
  /** 点更多按钮 */
  onMenu?: () => void
  /** 是否正在被 AI 处理（显示流光边框） */
  busy?: boolean
  /**
   * 顶部菜单（覆盖在标题栏上的一条工具栏）
   *
   * 放在卡片内部顶端：画布节点是 `overflow: hidden + contain: paint`，
   * 浮在卡片外面的菜单会被裁掉。hover / 选中时它盖住标题栏，
   * 比外部浮层更稳，也不会随相机缩放跑位。
   */
  topMenu?: ReactNode
  /**
   * 底部吸附区（AI 输入区等）
   *
   * 必须渲染在 **frame 层级**，而不是塞进 children：
   * children 落在 `.n-canvas-content` 里，那个容器带 `contain: layout`，
   * 会成为绝对定位后代的包含块 —— 于是 `bottom: 0` 对齐的是内容区底部
   * （内容区又被 footer 顶上去 24px），输入区看起来就悬空了一截。
   */
  dock?: ReactNode
  /**
   * 节点类型标识（透出为 `data-canvas-kind`）
   *
   * 画布内核不认识业务类型，但「分组框」这类特殊节点在样式与自动化测试上
   * 都需要一个稳定的钩子 —— 由宿主传进来，组件只负责写到 DOM 上。
   */
  kind?: string
  className?: string
  /** 标题栏是否可双击重命名（由宿主控制弹层） */
  contentClassName?: string
}

const TONE_ICON: Record<CanvasNodeTone, string> = {
  primary: 'bg-primary-weak text-primary',
  success: 'bg-success-weak text-success',
  warning: 'bg-warning-weak text-warning',
  danger: 'bg-danger-weak text-danger',
  info: 'bg-info-weak text-info',
  neutral: 'bg-surface-3 text-fg-2',
}

const TONE_RING: Record<CanvasNodeTone, string> = {
  primary: 'ring-primary/35',
  success: 'ring-success/35',
  warning: 'ring-warning/35',
  danger: 'ring-danger/35',
  info: 'ring-info/35',
  neutral: 'ring-fg-4/30',
}

export const CanvasNodeFrame = memo(function CanvasNodeFrame({
  title,
  badge,
  icon,
  tone = 'neutral',
  selected,
  dragging,
  locked,
  size,
  zoom = 1,
  children,
  footer,
  actions,
  onAI,
  onMenu,
  busy,
  topMenu,
  kind,
  dock,
  className,
  contentClassName,
}: CanvasNodeFrameProps) {
  // LOD：极小尺寸（屏幕上 < 56px 宽）只保留标题栏与色块，省掉内容渲染
  const tiny = size ? size.width * zoom < 56 : false

  return (
    <div
      data-canvas-frame=""
      data-tone={tone}
      data-canvas-kind={kind}
      data-canvas-group={kind === 'group' || undefined}
      className={cn(
        // relative 是关键：底部 AI 输入区、选中徽标点都靠它定位到「整张卡」，
        // 否则会以 .n-canvas-content（contain: layout）为包含块，被 footer 顶上去
        'n-canvas-frame group/frame relative flex size-full flex-col overflow-hidden rounded-[var(--n-radius-lg)] border border-line bg-surface',
        'shadow-[var(--n-shadow-xs)] transition-[box-shadow,border-color] duration-200',
        'hover:border-line-strong hover:shadow-[var(--n-shadow-md)]',
        selected && cn('n-canvas-frame--selected ring-2', TONE_RING[tone]),
        dragging && 'shadow-[var(--n-shadow-lg)] will-change-transform',
        busy && 'n-canvas-frame--busy',
        locked && 'n-canvas-frame--locked',
        className,
      )}
    >
      {/* 标题栏：36px，高度固定是「多类型节点并排仍整齐」的关键 */}
      <header className="n-canvas-frame__head relative flex h-9 shrink-0 items-center gap-1.5 border-b border-line-subtle px-2">
        {icon && (
          <span className={cn('grid size-5 shrink-0 place-items-center rounded-[5px]', TONE_ICON[tone])}>
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-[0.75rem] font-medium text-fg">{title}</span>
        {locked && <LockIcon size={11} className="shrink-0 text-fg-4" />}
        {badge && <span className="n-canvas-frame__badge shrink-0">{badge}</span>}
        {actions ?? (
          <span className="flex shrink-0 items-center gap-0.5">
            {onAI && (
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  onAI()
                }}
                aria-label="AI 编辑此节点"
                title="AI 编辑（点击节点也可唤起）"
                className="n-canvas-ai-pill"
              >
                <SparkIcon size={11} />
                <span className="n-canvas-ai-pill__text">AI</span>
              </button>
            )}
            {onMenu && (
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  onMenu()
                }}
                aria-label="节点菜单"
                className="grid size-5 place-items-center rounded-[5px] text-fg-4 opacity-0 transition-[opacity,background-color,color] group-hover/frame:opacity-100 hover:bg-surface-2 hover:text-fg focus-visible:opacity-100"
              >
                <MoreIcon size={12} />
              </button>
            )}
          </span>
        )}

        {/* 顶部菜单：盖住标题栏，hover / 选中时出现（见 tokens.css 的 .n-canvas-topmenu） */}
        {topMenu}
      </header>

      {/* 内容区 */}
      <div className={cn('n-canvas-content min-h-0 flex-1 overflow-hidden', contentClassName)}>
        {tiny ? <div className="size-full bg-surface-2" aria-hidden="true" /> : children}
      </div>

      {footer && (
        <footer className="flex h-6 shrink-0 items-center gap-1.5 border-t border-line-subtle px-2 text-[0.625rem] text-fg-4">
          {footer}
        </footer>
      )}

      {dock}

      <span className="n-canvas-frame__badge-dot" aria-hidden="true" />
    </div>
  )
})

/* ------------------------------------------------------------------ *
 * 内联重命名：双击文本节点/标题时使用
 * ------------------------------------------------------------------ */

export interface CanvasInlineEditProps {
  value: string
  placeholder?: string
  /** 提交（回车或失焦） */
  onSubmit: (value: string) => void
  /** 取消（Esc） */
  onCancel: () => void
  multiline?: boolean
  className?: string
  autoFocus?: boolean
}

/**
 * 就地编辑
 *
 * 用受控 textarea 而不是 contentEditable：
 * contentEditable 会把换行、粘贴富文本、撤销栈全部变成不可控因素，
 * 而这里只想要「纯文本 + 回车提交」。
 */
export function CanvasInlineEdit({
  value,
  placeholder,
  onSubmit,
  onCancel,
  multiline,
  className,
  autoFocus = true,
}: CanvasInlineEditProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const startValue = useRef(value)

  useEffect(() => {
    const el = ref.current
    if (!el || !autoFocus) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [autoFocus])

  const commit = useCallback(() => {
    onSubmit(ref.current?.value ?? startValue.current)
  }, [onSubmit])

  return (
    <textarea
      ref={ref}
      defaultValue={startValue.current}
      placeholder={placeholder}
      className={cn(
        'n-canvas-inline-edit size-full resize-none bg-transparent px-3 py-2 text-[0.8125rem] leading-5 text-fg outline-none',
        className,
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Escape') {
          event.preventDefault()
          onCancel()
          return
        }
        if (event.key === 'Enter' && (!multiline || (event.metaKey || event.ctrlKey))) {
          event.preventDefault()
          commit()
        }
      }}
      onBlur={commit}
    />
  )
}

/* ------------------------------------------------------------------ *
 * 节点菜单（轻量 popover，不走全局 Portal）
 * ------------------------------------------------------------------ */

export interface CanvasNodeMenuItem {
  key: string
  label: string
  icon?: ReactNode
  danger?: boolean
  onSelect: () => void
}

export function CanvasNodeMenu({
  open,
  items,
  onClose,
  className,
}: {
  open: boolean
  items: CanvasNodeMenuItem[]
  onClose: () => void
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div ref={ref} role="menu" className={cn('n-canvas-menu absolute right-1.5 z-40 mt-0.5', className)}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          onClick={(event) => {
            event.stopPropagation()
            onClose()
            item.onSelect()
          }}
          className={cn(
            'flex w-full items-center gap-2 rounded-[5px] px-2 py-1.5 text-left text-[0.75rem] transition-colors',
            item.danger
              ? 'text-danger hover:bg-danger-weak'
              : 'text-fg-2 hover:bg-surface-2 hover:text-fg',
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 状态徽标：被 AI 处理中的小指示（也供节点内容复用）
 * ------------------------------------------------------------------ */

export function CanvasNodeStatus({ tone = 'primary', children }: { tone?: CanvasNodeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.625rem] font-medium',
        TONE_ICON[tone],
      )}
    >
      <span className={cn('size-1.5 rounded-full', tone === 'neutral' ? 'bg-fg-4' : 'bg-current n-canvas-pulse')} />
      {children}
    </span>
  )
}

export function CanvasNodeCheck({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-success">
      <CheckIcon size={11} />
      {children}
    </span>
  )
}

export function CanvasNodeClose({ onClose, label = '移除' }: { onClose: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClose()
      }}
      aria-label={label}
      className="grid size-5 place-items-center rounded-[5px] text-fg-4 transition-colors hover:bg-danger-weak hover:text-danger"
    >
      <CloseIcon size={11} />
    </button>
  )
}
