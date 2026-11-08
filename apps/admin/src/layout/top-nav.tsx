import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { cn } from '@nexus/ui'
import { AppLink } from '@/components/app-link'
import { firstLeafPath, isNavActive, isNodeActive } from '@/core/module'
import type { NavNode } from '@/core/module'
import { useI18n } from '@/i18n'
import type { NavSectionEntry } from './sidebar-nav'

/**
 * 顶部菜单
 *
 * 服务两种菜单布局：
 * - `horizontal`（水平）：模块全部横排在顶栏，悬停展开该模块的菜单，全程不出现侧栏
 * - `mixed`（混合）：顶栏只负责**切换模块**，模块内部的具体页面交给左侧子菜单
 *
 * 交互取舍：
 * - 悬停即展开（收起延迟 140ms，避免鼠标划过一排模块时闪一串面板）
 * - 点击也能展开：触摸屏与键盘用户拿不到 hover 语义
 * - 模块有落点时名字本身是可点的链接；没有落点时只是一个展开按钮
 * - 换页收起用**渲染期重置**而不是 effect：effect 里 setState 会多跑一轮渲染
 *
 * 为什么面板要 portal 到 body：
 * 顶栏为了容纳全部模块必须横向可滚动（`overflow-x-auto`），而 CSS 里只要一个轴是
 * scroll/auto，**另一个轴也会被隐式裁切**。之前面板绝对定位在触发器下面，
 * 结果高度正常、却被顶栏裁掉 —— 看起来就是「点了没反应」。
 * 因此改成 `fixed` + 实测坐标挂到 body，滚动/缩放时重新定位，超出视口则翻到上方。
 */
export function TopNav({
  sections,
  currentPath,
  variant,
}: {
  sections: NavSectionEntry[]
  currentPath: string
  variant: 'horizontal' | 'mixed'
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState<{
    id: string
    left: number
    top: number
    above: boolean
  } | null>(null)
  const [lastPath, setLastPath] = useState(currentPath)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const rootRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // 路由变化时收起：换页后面板还挂在原地会挡住新页面
  if (lastPath !== currentPath) {
    setLastPath(currentPath)
    setOpen(null)
  }

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }
  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = setTimeout(() => setOpen(null), 140)
  }

  useEffect(() => () => cancelClose(), [])

  /** 打开面板：以触发器的实测矩形为锚点 */
  const openMenu = useCallback((id: string, anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect()
    const panelHeight = Math.min(window.innerHeight * 0.7, 544)
    const above = rect.bottom + panelHeight + 12 > window.innerHeight
    setOpen({
      id,
      left: Math.min(Math.max(8, rect.left), window.innerWidth - 264 - 8),
      top: above ? Math.max(8, rect.top - 6) : rect.bottom + 6,
      above,
    })
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null)
    }
    const onReflow = () => setOpen(null)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onReflow)
    // 滚动时收起而不是跟随：面板 anchored 到按钮，滚动后两者必然错位
    window.addEventListener('scroll', onReflow, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onReflow)
      window.removeEventListener('scroll', onReflow, true)
    }
  }, [open])

  const openModule = open
    ? sections.flatMap((section) => section.items).find((m) => m.id === open.id)
    : undefined

  return (
    <>
      <nav
        ref={rootRef}
        aria-label={t(variant === 'mixed' ? 'nav.moduleSwitch' : 'nav.mainNav')}
        className="flex min-w-0 flex-1 [scrollbar-width:none] items-center gap-0.5 overflow-x-auto px-1 [&::-webkit-scrollbar]:hidden"
        onPointerLeave={scheduleClose}
      >
        {sections.flatMap((section) =>
          section.items.map((mod) => {
            const Icon = mod.icon
            const active = isNavActive(mod.nav, currentPath)
            const target = firstLeafPath(mod.nav)
            const hasMenu = mod.nav.length > 0
            const isOpen = open?.id === mod.id

            const triggerClass = cn(
              'flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium whitespace-nowrap transition-colors',
              active
                ? 'bg-primary-weak text-primary'
                : 'text-fg-2 hover:bg-surface-2 hover:text-fg',
            )

            return (
              <div
                key={mod.id}
                className="relative shrink-0"
                onPointerEnter={(event) => {
                  cancelClose()
                  if (hasMenu) openMenu(mod.id, event.currentTarget)
                }}
              >
                {target ? (
                  <AppLink
                    to={target}
                    className={triggerClass}
                    ariaCurrent={active ? 'page' : undefined}
                  >
                    {Icon && <Icon className="size-[0.9375rem] shrink-0" strokeWidth={1.9} />}
                    <span>{mod.title}</span>
                    {hasMenu && (
                      <ChevronDown
                        className={cn(
                          'size-3 shrink-0 opacity-50 transition-transform duration-200',
                          isOpen && 'rotate-180',
                        )}
                      />
                    )}
                  </AppLink>
                ) : (
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-haspopup="menu"
                    onClick={(event) => {
                      if (isOpen) setOpen(null)
                      else
                        openMenu(mod.id, event.currentTarget.parentElement ?? event.currentTarget)
                    }}
                    className={triggerClass}
                  >
                    {Icon && <Icon className="size-[0.9375rem] shrink-0" strokeWidth={1.9} />}
                    <span>{mod.title}</span>
                    {hasMenu && (
                      <ChevronDown
                        className={cn(
                          'size-3 shrink-0 opacity-50 transition-transform duration-200',
                          isOpen && 'rotate-180',
                        )}
                      />
                    )}
                  </button>
                )}
              </div>
            )
          }),
        )}
      </nav>

      {open &&
        openModule &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            onPointerEnter={cancelClose}
            onPointerLeave={scheduleClose}
            style={{
              left: open.left,
              top: open.top,
              width: 264,
              transform: open.above ? 'translateY(-100%)' : undefined,
            }}
            className={cn(
              'n-enter fixed z-[1100] rounded-lg border border-line bg-surface p-1.5 shadow-lg',
              // 模块菜单可能很长（模板中心 16 条）：限高并允许内部滚动，
              // 否则 900px 高的屏幕上最后几项会顶到视口外，永远点不到
              'max-h-[min(70vh,34rem)] overflow-y-auto overscroll-contain',
            )}
          >
            {openModule.nav.map((node) => (
              <FlyoutNode
                key={node.key}
                node={node}
                currentPath={currentPath}
                onNavigate={() => setOpen(null)}
              />
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}

/**
 * 面板内条目
 *
 * 有子级时渲染成小标题 + 缩进列表：横向菜单的下拉空间有限，
 * 二级分组保留结构，三级及其以下不再继续缩进（省宽度，也避免「梯田」）。
 */
function FlyoutNode({
  node,
  currentPath,
  onNavigate,
}: {
  node: NavNode
  currentPath: string
  onNavigate: () => void
}) {
  const Icon = node.icon

  if (node.children?.length) {
    return (
      <div>
        <div className="flex items-center gap-1.5 px-2 pt-1.5 pb-1">
          {Icon && <Icon className="size-3 shrink-0 text-fg-4" strokeWidth={1.9} />}
          <span className="text-[10px] font-semibold tracking-[0.06em] text-fg-4 uppercase">
            {node.title}
          </span>
        </div>
        {node.children.map((child) => (
          <FlyoutNode
            key={child.key}
            node={child}
            currentPath={currentPath}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    )
  }

  const active = isNodeActive(node, currentPath)
  const body = (
    <span
      className={cn(
        'flex h-8 w-full items-center gap-2 rounded-md px-2 text-[0.8125rem] transition-colors',
        active
          ? 'bg-primary-weak font-medium text-primary'
          : 'text-fg-2 hover:bg-surface-2 hover:text-fg',
      )}
    >
      {Icon && <Icon className="size-[0.9375rem] shrink-0" strokeWidth={active ? 2.1 : 1.8} />}
      <span className="min-w-0 flex-1 truncate">{node.title}</span>
      {node.badge !== undefined && (
        <span className="shrink-0 rounded-full bg-danger-weak px-1.5 text-2xs font-semibold text-danger tabular-nums">
          {node.badge}
        </span>
      )}
      {node.openInNewTab && (
        <span className="shrink-0 text-2xs text-fg-4" aria-hidden="true">
          ↗
        </span>
      )}
    </span>
  )

  return node.path ? (
    <AppLink
      to={node.path}
      className="block w-full"
      ariaCurrent={active ? 'page' : undefined}
      newTab={node.openInNewTab}
      onClick={onNavigate}
    >
      {body}
    </AppLink>
  ) : (
    <div>{body}</div>
  )
}
