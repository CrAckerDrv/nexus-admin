import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowRight,
  CircleQuestionMark,
  Command as CommandIcon,
  CornerDownLeft,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  Search,
} from 'lucide-react'
import { Kbd, cn, fuzzyMatch } from '@nexus/ui'
import { modules } from '@/modules/registry'
import { flattenNav } from '@/core/module'
import { useAuthStore } from '@/core/auth-store'
import { useAssistantPanelStore } from '@/ai/panel-store'
import { useAppNavigate, useCurrentPath } from '@/components/app-link'
import { useI18n } from '@/i18n'
import { useLocalizedModules } from '@/i18n/modules'

interface CommandEntry {
  key: string
  title: string
  subtitle: string
  group: string
  path?: string
  icon: ReactNode
  /** 就地执行的动作（与 path 二选一）：用于「打开助手」这类不换页的命令 */
  action?: () => void
}

/**
 * 命令面板（⌘K / Ctrl+K）
 *
 * 高性能要点：
 * - 关闭时不挂载 DOM，也不注册全局 keydown 处理器
 * - 输入变化只重算结果列表，导航数据用 useMemo 缓存
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return open ? <PaletteDialog onClose={() => setOpen(false)} /> : null
}

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const navigate = useAppNavigate()
  const hasPermission = useAuthStore((state) => state.hasPermission)
  const currentPath = useCurrentPath()
  const { t } = useI18n()
  const localizedModules = useLocalizedModules(modules)

  const entries = useMemo<CommandEntry[]>(() => {
    const navs = flattenNav(localizedModules)
      .filter((item) => !item.permission || hasPermission(item.permission))
      .map((item) => ({
        key: item.key,
        title: item.title,
        subtitle: item.trail.slice(0, -1).join(' / ') || t('command.navFallback'),
        group: item.moduleTitle,
        path: item.path,
        icon: <ArrowRight className="size-3.5" />,
      }))

    const quick: CommandEntry[] = [
      {
        key: 'q-assistant',
        // 「打开助手」是面板动作而不是路由：用户想边看当前页边问，
        // 跳去工作台反而把上下文丢了
        title: t('assistant.launcherTip'),
        subtitle: t('assistant.panelSubtitle'),
        group: t('command.quickGroup'),
        icon: <MessageSquareText className="size-3.5" />,
        action: () => useAssistantPanelStore.getState().setOpen(true),
      },
      {
        key: 'q-overview',
        title: t('command.quickBack'),
        subtitle: t('nav.dashboard'),
        group: t('command.quickGroup'),
        path: '/dashboard/overview',
        icon: <LayoutDashboard className="size-3.5" />,
      },
      {
        key: 'q-components',
        title: t('command.quickComponents'),
        subtitle: t('nav.components'),
        group: t('command.quickGroup'),
        path: '/components/overview',
        icon: <FileText className="size-3.5" />,
      },
      {
        key: 'q-help',
        // 帮助中心原来是一个弹窗（没有 path，选中后什么都不发生）；
        // 现在指向真正能读的「接入后端」教程，⌘K 搜「帮助 / 后端」都能命中
        title: t('command.quickHelp'),
        subtitle: t('nav.guideTip'),
        group: t('command.quickGroup'),
        path: '/guide/backend',
        icon: <CircleQuestionMark className="size-3.5" />,
      },
    ]
    return [...quick, ...navs]
  }, [hasPermission, localizedModules, t])

  const results = useMemo(() => {
    if (!query.trim()) {
      const recent = entries.filter((item) => item.path === currentPath)
      const rest = entries.filter((item) => item.path !== currentPath)
      return [...recent, ...rest].slice(0, 9)
    }
    return entries
      .filter((item) => fuzzyMatch(`${item.title}${item.subtitle}${item.group}`, query))
      .slice(0, 10)
  }, [entries, query, currentPath])

  const go = useCallback(
    (entry: CommandEntry | undefined) => {
      if (!entry) return
      if (entry.action) entry.action()
      else if (entry.path) navigate(entry.path)
      onClose()
    },
    [navigate, onClose],
  )

  return (
    <div className="fixed inset-0 z-[1500] flex items-start justify-center px-4 pt-[12vh]">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[0.125rem] dark:bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('command.title')}
        className="n-enter relative w-full max-w-[35rem] overflow-hidden rounded-xl border border-line bg-surface shadow-xl"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActiveIndex((prev) => Math.min(prev + 1, results.length - 1))
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex((prev) => Math.max(prev - 1, 0))
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            go(results[activeIndex])
          }
        }}
      >
        <div className="flex items-center gap-2 border-b border-line px-3.5">
          <Search className="size-4 shrink-0 text-fg-3" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              // 输入变化时把高亮重置到第一项（在事件里做，避免额外的 effect）
              setActiveIndex(0)
            }}
            placeholder={t('command.placeholder')}
            className="h-11 w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-4"
          />
          <Kbd>ESC</Kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-1.5">
          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-xs text-fg-3">{t('common.noResult')}</p>
          )}
          {results.map((item, index) => (
            <button
              key={item.key}
              type="button"
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => go(item)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors',
                index === activeIndex
                  ? 'bg-primary-weak text-primary'
                  : 'text-fg-2 hover:bg-surface-2',
              )}
            >
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-md border',
                  index === activeIndex
                    ? 'border-primary/25 bg-surface text-primary'
                    : 'border-line bg-surface-2 text-fg-3',
                )}
              >
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem] font-medium">{item.title}</span>
                <span className="block truncate text-2xs text-fg-3">{item.subtitle}</span>
              </span>
              {index === activeIndex && (
                <CornerDownLeft className="size-3.5 shrink-0 text-primary" />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 border-t border-line bg-surface-2 px-3 py-1.5 text-2xs text-fg-3">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> {t('command.select')}
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> {t('command.open')}
          </span>
          <span className="ml-auto flex items-center gap-1">
            <CommandIcon className="size-3" /> K {t('command.trigger')}
          </span>
        </div>
      </div>
    </div>
  )
}
