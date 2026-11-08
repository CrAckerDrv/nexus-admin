import { BookOpenText, PanelLeftClose, Sparkles } from 'lucide-react'
import { Tooltip, cn } from '@nexus/ui'
import { AppLink } from '@/components/app-link'
import { NexusMark } from '@/components/brand-icons'
import { useI18n } from '@/i18n'

/**
 * 侧边栏头部
 *
 * 折叠时只保留 Logo，并用「宽度过渡 + 文字淡出」保证图标始终居中：
 * 外层固定尺寸，内层文字绝对定位——避免文字消失瞬间把 Logo 顶偏。
 * Logo 为无底版的纯字形，颜色跟随 `text-fg`，深浅色主题自动适配。
 */
export function SidebarHeader({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="relative flex h-[var(--n-header-h)] shrink-0 items-center">
      <AppLink
        to="/dashboard/overview"
        className={cn(
          'flex h-full min-w-0 items-center transition-[padding] duration-[var(--n-sidebar-duration)] ease-[var(--n-sidebar-ease)]',
          collapsed ? 'w-full justify-center px-0' : 'gap-2.5 px-3',
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center text-fg">
          <NexusMark className="h-5 w-auto" />
        </span>
        <span
          className={cn(
            'min-w-0 overflow-hidden whitespace-nowrap transition-[opacity,width] duration-200',
            collapsed
              ? 'pointer-events-none w-0 -translate-x-1 opacity-0'
              : 'w-auto translate-x-0 opacity-100',
          )}
        >
          <span className="block truncate text-[0.8125rem] font-semibold tracking-tight text-fg">
            Nexus Admin
          </span>
          <span className="block truncate text-2xs text-fg-3">Modular · Fast · Open source</span>
        </span>
      </AppLink>
    </div>
  )
}

/**
 * 侧边栏底部
 *
 * 只保留「开发指南」一个入口：
 * - 原来是一个弹窗，三句话讲完模块化 / 组件库 / 接后端，信息量不足以真的把项目接起来；
 *   现在它指向 `/guide/overview`（总览 / 接入后端 / 新增模块 / 接口契约四个页面）
 * - 用户信息在顶栏头像菜单与个人资料页，底部不再重复
 * - 折叠时是居中的图标按钮，与主导航同一条中轴
 */
export function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const { t } = useI18n()

  return (
    <div
      className={cn('shrink-0 border-t border-line-subtle p-2', collapsed && 'flex justify-center')}
    >
      <Tooltip
        content={collapsed ? t('nav.developerGuide') : t('nav.guideTip')}
        side="right"
        disabled={!collapsed}
      >
        <AppLink
          to="/guide/overview"
          title={t('nav.guideTip')}
          className={cn(
            'group/guide flex items-center rounded-md text-xs text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg',
            collapsed ? 'size-9 justify-center' : 'h-9 w-full gap-2 px-2.5',
          )}
        >
          <span className="relative grid size-4 shrink-0 place-items-center">
            <BookOpenText className="size-4" />
            {/* 一个小圆点提示「这里有新内容」，避免入口被当成装饰 */}
            <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />
          </span>
          {!collapsed && (
            <>
              <span className="truncate">{t('nav.developerGuide')}</span>
              <Sparkles className="ml-auto size-3 shrink-0 text-fg-4 transition-colors group-hover/guide:text-primary" />
            </>
          )}
        </AppLink>
      </Tooltip>
      {!collapsed && (
        <p className="mt-1 hidden items-center gap-1 px-2.5 text-[0.625rem] text-fg-4 lg:flex">
          <PanelLeftClose className="size-2.5 rotate-180" />
          {t('nav.guideTip')}
        </p>
      )}
    </div>
  )
}
