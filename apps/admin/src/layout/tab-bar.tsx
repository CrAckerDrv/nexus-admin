import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { X, XCircle } from 'lucide-react'
import { ChromeScope, cn, Tooltip } from '@nexus/ui'
import { useUiStore } from '@/core/ui-store'
import { AppLink, useAppNavigate } from '@/components/app-link'
import { useModuleTitleMap } from '@/i18n/modules'
import { useI18n } from '@/i18n'

/**
 * 多页签导航
 *
 * 做成「编辑器式页签」但按后台场景做减法：
 * - 只保留「当前页高亮 + 可关闭 + 关闭其他」，不做拖拽排序（后台很少需要）
 * - **跟随激活项滚动**：标签一多，激活的那个一定落在可视区内
 *   （scrollIntoView + inline:'nearest'，不会每次切页都强行居中造成跳动）
 * - 关闭按钮在激活项常驻、其余项 hover 才出现，降低视觉噪音
 * - 所有页签都可关闭；关掉最后一个自动回概览
 *
 * 浮动布局下页签栏不再画下边框，而是成为内容卡片上方的一条独立条带。
 */
export function TabBar({ floating }: { floating?: boolean } = {}) {
  const tabs = useUiStore((state) => state.tabs)
  const activeTab = useUiStore((state) => state.activeTab)
  const closeTab = useUiStore((state) => state.closeTab)
  const closeOthers = useUiStore((state) => state.closeOthers)
  const navigate = useAppNavigate()
  const { t } = useI18n()
  const moduleTitleByPath = useModuleTitleMap()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)

  // 激活项变化时把它滚进可视区（最近距离滚动）
  useLayoutEffect(() => {
    const node = activeRef.current
    if (!node) return
    node.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [activeTab, tabs.length])

  // 是否出现横向滚动（出现时右侧显示渐隐遮罩，提示还有内容）
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 2)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [tabs.length])

  if (tabs.length === 0) return null

  const handleClose = (key: string, active: boolean) => {
    closeTab(key)
    if (active) {
      const remaining = tabs.filter((item) => item.key !== key)
      const fallback = remaining[remaining.length - 1]
      navigate(fallback?.path ?? '/dashboard/overview')
    }
  }

  return (
    <ChromeScope>
    <div
      className={cn(
        // n-chrome：外框语义标记（浮层据此判断与自己同尺度）
        // 底色与顶栏同一变量：调色盘把顶栏染深时，页签栏跟着深，不会出现「深顶栏 + 白页签」的断层
        'n-chrome relative flex h-9 shrink-0 items-center gap-1 border-b border-line bg-[var(--n-topbar-bg)] px-2',
        floating && 'md:border-b-0 md:bg-surface-2/50',
      )}
    >
      <div
        ref={scrollerRef}
        className="flex min-w-0 flex-1 [scrollbar-width:none] items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const active = tab.key === activeTab
          const moduleTitle = moduleTitleByPath[tab.path]
          return (
            <div
              key={tab.key}
              ref={active ? activeRef : undefined}
              className={cn(
                'group relative flex h-[1.625rem] shrink-0 items-center gap-1 rounded-md pr-1 pl-2 text-xs',
                'transition-[background-color,color,box-shadow] duration-150',
                active
                  ? 'bg-primary-weak font-medium text-primary'
                  : 'text-fg-3 hover:bg-surface-2 hover:text-fg-2',
              )}
            >
              <AppLink
                to={tab.path}
                className="flex max-w-[8.25rem] items-center gap-1.5 truncate"
                ariaCurrent={active ? 'page' : undefined}
                title={moduleTitle ? `${moduleTitle} / ${tab.title}` : tab.title}
              >
                <span className="truncate">{tab.title}</span>
              </AppLink>
              <button
                type="button"
                aria-label={`${t('nav.closeCurrent')}: ${tab.title}`}
                onClick={(event) => {
                  event.preventDefault()
                  handleClose(tab.key, active)
                }}
                className={cn(
                  'grid size-4 shrink-0 place-items-center rounded-sm transition-[opacity,background-color,color]',
                  'hover:bg-primary/15 hover:text-primary',
                  active
                    ? 'text-primary/70 opacity-100'
                    : 'text-fg-4 opacity-0 group-hover:opacity-100',
                )}
              >
                <X className="size-2.5" strokeWidth={2.4} />
              </button>
            </div>
          )
        })}
      </div>

      {/* 右侧渐隐：提示还有更多标签 */}
      {overflowing && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-[5.75rem] h-full w-8 bg-gradient-to-l from-surface to-transparent"
        />
      )}

      {tabs.length > 1 && (
        <Tooltip content={t('nav.closeOther')}>
          <button
            type="button"
            onClick={() => activeTab && closeOthers(activeTab)}
            className="grid size-6 shrink-0 place-items-center rounded-md text-fg-4 transition-colors hover:bg-surface-2 hover:text-fg-2"
            aria-label={t('nav.closeOther')}
          >
            <XCircle className="size-3.5" />
          </button>
        </Tooltip>
      )}
    </div>
    </ChromeScope>
  )
}
