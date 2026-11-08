import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useRouterState } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { useMediaQuery, cn, ChromeScope } from '@nexus/ui'
import { modules } from '@/modules/registry'
import { filterNav, findActiveModule, findNavTrail, partitionBySection } from '@/core/module'
import { useAuthStore } from '@/core/auth-store'
import { useUiStore } from '@/core/ui-store'
import { useLocalizedModules } from '@/i18n/modules'
import { useI18n } from '@/i18n'
import { useGeneratedModule } from '@/ai/page-store'
import { useAssistantPanelStore } from '@/ai/panel-store'
import { Topbar } from './topbar'
import { TabBar } from './tab-bar'
import { ThemePanel } from './theme-panel'
import { SidebarFooter, SidebarHeader } from './sidebar-parts'
import { ModuleRail, SidebarNav, SingleModuleNav } from './sidebar-nav'
import type { NavModuleEntry, NavSectionEntry } from './sidebar-nav'
import { TopNav } from './top-nav'

/**
 * AI 助手抽屉 · 懒加载
 *
 * 它是外壳里最贵的一块（面板 + 消息渲染 + 会话列 + SDK 桥接，实测 11 kB gzip / 2 个请求），
 * 而绝大多数页面根本不会用到它。改成懒加载后，只有「点过入口」或「打开过工作台」才会下载。
 *
 * `panel-store.open` 在模块级订阅：懒组件挂载时如果是「已打开」状态，
 * 会直接从滑入位置开始，不会先闪一个关闭态的抽屉。
 */
const AssistantPanel = lazy(() =>
  import('@/ai/components/assistant-panel').then((mod) => ({ default: mod.AssistantPanel })),
)

/**
 * 应用外壳
 *
 * 布局 = **菜单布局 × 整体布局**，两者正交：
 * - 菜单布局（`menuLayout`）决定导航摆在哪：垂直 / 双列 / 水平 / 混合 / 悬浮 / 侧边栏
 * - 整体布局（`layout`）决定留白与是否全屏：默认 / 紧凑 / 全屏
 *
 * 为什么六种菜单布局共用同一个外壳，而不是六份复制：
 * 它们共享 90% 的结构（顶栏、页签、内容区、AI 浮层、主题面板），
 * 真正的差异只有「导航有几列、顶栏是否承担导航」这两件事。因此这里只按
 * `menuLayout` 算几个派生量，其余 JSX 复用一套 —— 避免「改一次页签要改六遍」。
 *
 * | 布局       | 顶栏        | 侧栏                        | 顶栏内容            |
 * | ---------- | ----------- | --------------------------- | ------------------- |
 * | vertical   | 在内容列内  | 整树导航（可折叠成图标）    | 开关 + 搜索         |
 * | dual       | 在内容列内  | 模块导轨 + 当前模块子菜单   | 开关 + 搜索         |
 * | horizontal | 通栏        | 无                          | 品牌 + 全量横向菜单 |
 * | mixed      | 通栏        | 当前模块的子菜单（可收起）  | 品牌 + 模块切换     |
 * | floating   | 在内容列内  | 整树导航（与内容都是卡片）  | 开关 + 搜索         |
 * | sidebar    | 通栏        | 整树导航，从顶栏下沿开始    | 品牌 + 搜索         |
 *
 * 移动端（<768px）一律回退成「抽屉 + 垂直菜单」：
 * 双列 / 水平 / 混合在手机上没有第二列和悬停展开可言，保留只会得到一条挤成一团的导航。
 */
export function AppShell() {
  const sidebarCollapsedPref = useUiStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)
  const tabBar = useUiStore((state) => state.tabBar)
  const openTab = useUiStore((state) => state.openTab)
  const collapsedGroups = useUiStore((state) => state.collapsedGroups)
  const menuLayout = useUiStore((state) => state.menuLayout)
  const contentWidth = useUiStore((state) => state.contentWidth)
  const layout = useUiStore((state) => state.layout)
  const [mobileOpen, setMobileOpen] = useState(false)
  /** 全屏布局下侧栏默认收起成浮层，点开关才展开 —— 否则「全屏」只是把留白改小，名不副实 */
  const [overlayOpen, setOverlayOpen] = useState(false)
  /**
   * 助手抽屉「用过一次就一直挂着」
   *
   * 懒组件一旦挂载再卸载，会把草稿、滚动位置、会话列表展开态一起丢掉；
   * 而面板内部本来就用 `mounted` 做了关灯延迟卸载，所以这里不需要跟着 open 反复开关。
   * `everOpened` 由 panel-store 维护（不在外壳里写 effect），刷新后仍是「没打开过」。
   */
  const assistantUsed = useAssistantPanelStore((state) => state.everOpened)
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const hasPermission = useAuthStore((state) => state.hasPermission)
  const { t } = useI18n()

  const isMobile = useMediaQuery('(max-width: 767px)')
  const sidebarCollapsed = isMobile ? false : sidebarCollapsedPref

  const isDual = menuLayout === 'dual'
  const isHorizontal = menuLayout === 'horizontal'
  const isMixed = menuLayout === 'mixed'
  const isFloating = menuLayout === 'floating'
  /** 顶栏通栏：导航搬进顶栏（水平 / 混合），或侧栏要沉到顶栏下沿（侧边栏） */
  const topbarFullWidth = !isMobile && (isHorizontal || isMixed || menuLayout === 'sidebar')
  /** 顶栏承载菜单 */
  const topNavVariant = isMobile ? null : isHorizontal ? 'horizontal' : isMixed ? 'mixed' : null

  /**
   * 「全屏布局」
   *
   * 侧栏不再是常驻轨道，而是从左侧滑出的浮层（同时屏蔽折叠开关 —— 浮层只有「开/关」两态）。
   * 水平布局没有侧栏，天然全屏；混合与侧边栏布局的导航横竖都有，隐藏侧栏会丢掉大半入口，
   * 因此这两者只在「折叠」这一层做收敛，不引入浮层。
   */
  const railOverlay = layout === 'fullscreen' && (menuLayout === 'vertical' || isDual || isFloating)

  // 按当前语言投影模块清单（中文直接返回原引用，零开销）
  // AI 生成页作为一个动态模块并入清单：侧栏分组、页签、命令面板、面包屑全部自动跟上
  const generatedModule = useGeneratedModule()
  const allModules = useMemo(
    () => (generatedModule ? [...modules, generatedModule] : modules),
    [generatedModule],
  )
  const rootModules = useLocalizedModules(allModules)

  useEffect(() => {
    setMobileOpen(false)
    // 跳页后浮层自动收起：否则「全屏」下每换一页都要手动关一次侧栏
    setOverlayOpen(false)
  }, [pathname])

  // 路由变化写入页签；切换语言时同一 effect 会刷新页签标题
  useEffect(() => {
    const allNav = rootModules.flatMap((mod) => mod.nav)
    const trail = findNavTrail(allNav, pathname)
    const leaf = trail[trail.length - 1]
    if (leaf?.path) {
      openTab({ key: leaf.path, title: leaf.title, path: leaf.path, closable: true })
    }
  }, [pathname, openTab, rootModules])

  const can = useCallback(
    (permission?: string) => !permission || hasPermission(permission),
    [hasPermission],
  )

  const navModules = useMemo(
    () =>
      rootModules
        .filter((mod) => mod.enabled !== false && can(mod.permission))
        .sort((a, b) => a.order - b.order)
        .map((mod) => ({
          ...mod,
          nav: filterNav(mod.nav, can),
          collapsed: collapsedGroups.includes(mod.id),
        }))
        .filter((mod) => mod.nav.length > 0) as NavModuleEntry[],
    [rootModules, can, collapsedGroups],
  )

  /**
   * 分区后的导航
   *
   * `main`（业务区）在上、`demo`（演示区）在下，中间用一条细分隔线 + 小标题隔开。
   * 这样「每天都在用的入口」始终在前三屏，示例页不会把业务入口挤到下面。
   */
  const navSections = useMemo(
    () => partitionBySection(navModules) as NavSectionEntry[],
    [navModules],
  )

  /**
   * 当前模块
   *
   * 双列与混合布局需要知道「现在在哪个模块里」，才能决定第二列 / 侧栏放什么。
   * 找不到时（404、独立大屏页）回落到第一个模块，避免出现一条空侧栏。
   */
  const activeModule = useMemo(
    () => findActiveModule(navModules, pathname) ?? navModules[0],
    [navModules, pathname],
  )

  /**
   * 双列布局折叠 = 第二列收成图标条（不是消失）
   *
   * 早期实现直接把第二列 `display:none`，实测用户的反应是「点了搜索/开关，左边一块东西没了」——
   * 分不清是「收起了」还是「出错了」。现在保留 3.5rem 图标列：图标仍在、悬浮有名称，
   * 与导轨并排后整条侧栏仍是两列的节奏，只是第二列窄了。
   */
  const dualSubCollapsed = isDual && sidebarCollapsed
  /** 混合布局折叠 = 整条子菜单收起；全屏布局下同样收起，只留顶部模块切换 */
  const mixedSubHidden = isMixed && (sidebarCollapsed || layout === 'fullscreen')
  /** 折叠成图标轨道：整树导航类布局才有这个形态 */
  const iconOnly = !isMobile && sidebarCollapsed && !isDual && !isMixed && !isHorizontal

  /** 桌面端侧栏是否出现：水平布局没有；混合布局收起时没有；其余常驻 */
  const showDesktopSidebar = !isMobile && !isHorizontal && !(isMixed && mixedSubHidden)

  /** 顶栏已经承载品牌（品牌位只在通栏布局里出现）：侧栏不必再重复一次 Logo + 标语 */
  const sidebarBrandHidden = topbarFullWidth

  /** 双列收起态头部用的当前模块图标（模块无图标时回落为小圆点） */
  const ActiveModuleIcon = activeModule?.icon

  const asideWidth = isDual
    ? dualSubCollapsed
      ? 'calc(var(--n-rail-w) + var(--n-dual-icon-w))'
      : 'calc(var(--n-rail-w) + var(--n-dual-w))'
    : iconOnly
      ? 'var(--n-sidebar-w-collapsed)'
      : 'var(--n-sidebar-w)'

  const navToggle = isMobile
    ? {
        label: t('nav.expand'),
        expanded: mobileOpen,
        onClick: () => setMobileOpen(true),
      }
    : isHorizontal
      ? undefined
      : railOverlay
        ? {
            label: overlayOpen ? t('nav.collapse') : t('nav.expand'),
            expanded: overlayOpen,
            onClick: () => setOverlayOpen((prev) => !prev),
          }
        : {
            label: sidebarCollapsed ? t('nav.expand') : t('nav.collapse'),
            expanded: !sidebarCollapsed,
            onClick: toggleSidebar,
          }

  /**
   * 侧栏
   *
   * @param mode `dual` 导轨 + 子菜单；`module` 仅当前模块；`full` 整树导航
   */
  const renderSidebar = (mode: 'dual' | 'module' | 'full') => (
    <ChromeScope>
      <aside
        data-menu-layout={menuLayout}
        data-collapsed={iconOnly || dualSubCollapsed || undefined}
        style={{ width: isMobile ? 'var(--n-sidebar-w)' : asideWidth }}
        className={cn(
          // n-sidebar：侧栏自己的配色与 --n-surface / --n-fg / --n-border 重映射都在 tokens.css 里，
          // 深色导航的皮肤（graphite / pine / ocean / neon）靠它一次性生效，不用给每个组件加分支
          'n-sidebar group/aside z-50 flex',
          // n-chrome：外框语义标记（侧栏 / 顶栏 / 页签栏同尺度）。
          // 现在只用于让浮层代码知道「自己在外框里」，不再挂任何缩放
          'n-chrome',
          // 双列是「导轨 | 子菜单」两列并排；其余布局是一列到底
          mode === 'dual' ? 'flex-row' : 'flex-col',
          'transition-[width,transform] duration-[var(--n-sidebar-duration)] ease-[var(--n-sidebar-ease)]',
          // 移动端与全屏布局：侧栏是浮层，必须 fixed，否则 translate 后仍占着布局宽度
          isMobile || railOverlay ? 'fixed inset-y-0 left-0 shadow-xl' : 'relative',
          mobileOpen || (!isMobile && railOverlay && overlayOpen)
            ? 'translate-x-0'
            : isMobile || railOverlay
              ? '-translate-x-full'
              : '',
          // 浮动布局：侧栏与右侧内容各自是一张圆角卡片
          isFloating &&
            !isMobile &&
            'md:overflow-hidden md:rounded-xl md:border md:border-sidebar-line md:shadow-sm',
        )}
      >
        {mode === 'dual' ? (
          <>
            <div
              className="flex h-full shrink-0 flex-col"
              style={{
                width: 'var(--n-rail-w)',
                borderInlineEnd: '1px solid var(--n-sidebar-border)',
              }}
            >
              <SidebarHeader collapsed />
              <nav
                className="n-sidebar-nav min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-1.5 pb-2"
                aria-label={t('nav.mainNav')}
              >
                <ModuleRail sections={navSections} activeModuleId={activeModule?.id} />
              </nav>
              <SidebarFooter collapsed />
            </div>
            <div
              className="flex min-h-0 min-w-0 flex-1 flex-col"
              style={{ borderInlineStart: '1px solid var(--n-sidebar-border)' }}
            >
              {dualSubCollapsed ? (
                // 收起态：模块名放不下（会换行），只留模块图标；悬浮标签补齐文字
                <div
                  className="flex h-[var(--n-header-h)] shrink-0 items-center justify-center"
                  title={activeModule?.title}
                >
                  {ActiveModuleIcon ? (
                    <ActiveModuleIcon className="size-[1.125rem] text-fg-3" strokeWidth={1.8} />
                  ) : (
                    <span className="size-1.5 rounded-full bg-fg-4" />
                  )}
                </div>
              ) : (
                <div className="flex h-[var(--n-header-h)] shrink-0 items-center px-3">
                  <span className="truncate text-[0.8125rem] font-semibold text-fg">
                    {activeModule?.title}
                  </span>
                </div>
              )}
              <nav
                className={cn(
                  'n-sidebar-nav min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-2',
                  dualSubCollapsed ? 'px-1.5' : 'px-2',
                )}
                aria-label={activeModule?.title}
              >
                {activeModule && (
                  <SingleModuleNav
                    module={activeModule}
                    currentPath={pathname}
                    showTitle={false}
                    collapsed={dualSubCollapsed}
                  />
                )}
              </nav>
            </div>
          </>
        ) : (
          <>
            {/* 顶栏已经带品牌时（混合 / 侧边栏这类通栏布局），侧栏头部不再重复一次 Logo + 标语 */}
            {sidebarBrandHidden ? (
              <div className="h-2 shrink-0" aria-hidden="true" />
            ) : (
              <SidebarHeader collapsed={iconOnly} />
            )}
            <nav
              className="n-sidebar-nav min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 pb-2"
              style={{ scrollbarGutter: 'stable both-edges' }}
              aria-label={t('nav.dashboard')}
            >
              {mode === 'module' ? (
                activeModule && <SingleModuleNav module={activeModule} currentPath={pathname} />
              ) : (
                <SidebarNav
                  sections={navSections}
                  currentPath={pathname}
                  collapsed={iconOnly}
                  showSectionLabel
                />
              )}
            </nav>
            <SidebarFooter collapsed={iconOnly} />
          </>
        )}
      </aside>
    </ChromeScope>
  )

  const contentColumn = (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col',
        // 侧栏与内容区的分界线由 `.n-sidebar` 自己的 border-inline-end 提供：
        // 深色导航的皮肤需要「侧栏色」而不是「内容区色」的描边，写在这里会变成两层线
        // 浮动布局：右栏（顶栏 + 页签 + 内容）整体是一张卡片
        isFloating &&
          !isMobile &&
          'md:overflow-hidden md:rounded-xl md:border md:border-line md:bg-surface md:shadow-sm',
      )}
    >
      {!topbarFullWidth && (
        <Topbar
          navToggle={navToggle}
          search="full"
          onOpenCommand={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
          }}
        />
      )}

      {tabBar && <TabBar floating={isFloating} />}

      <main
        id="nexus-main"
        tabIndex={-1}
        className={cn(
          'min-h-0 flex-1 overflow-y-auto scroll-smooth outline-none',
          isFloating && 'bg-bg',
        )}
      >
        <div className="n-page-shell" data-content-width={contentWidth}>
          {/* key=pathname 触发重挂载，配合 n-page-enter 做页面级入场动画 */}
          <div className="n-page-enter" key={pathname}>
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )

  return (
    <div
      className={cn(
        'flex h-dvh overflow-hidden bg-bg',
        // 浮动布局：整屏留出等距外边距，侧栏与右侧内容各自成为悬浮卡片
        isFloating && !isMobile && 'md:gap-2.5 md:p-2.5',
        // 通栏顶栏的布局是「上下两段」：顶栏在上，侧栏 + 内容在下
        topbarFullWidth && 'flex-col',
      )}
    >
      <a href="#nexus-main" className="n-skip-link">
        {t('nav.skipToContent')}
      </a>

      {(mobileOpen || (!isMobile && railOverlay && overlayOpen)) && (
        <div
          className="fixed inset-0 z-[45] bg-black/35 backdrop-blur-[2px]"
          onClick={() => {
            setMobileOpen(false)
            setOverlayOpen(false)
          }}
          aria-hidden="true"
        />
      )}

      {topbarFullWidth && (
        <Topbar
          brand
          navToggle={navToggle}
          // 顶栏同时放菜单与搜索框会挤（1280px 下右侧按钮被推出屏幕），有菜单时搜索收成图标
          search={topNavVariant ? 'icon' : 'full'}
          topNav={
            topNavVariant ? (
              <TopNav sections={navSections} currentPath={pathname} variant={topNavVariant} />
            ) : undefined
          }
          onOpenCommand={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
          }}
        />
      )}

      <div className={cn('flex min-h-0 min-w-0 flex-1', isFloating && !isMobile && 'md:gap-2.5')}>
        {showDesktopSidebar && renderSidebar(isDual ? 'dual' : isMixed ? 'module' : 'full')}
        {contentColumn}
      </div>

      {/* 移动端：所有布局统一成抽屉里的完整侧栏 */}
      {isMobile && renderSidebar('full')}

      <ThemePanel />

      {/*
        AI 运营助手浮层
        - 懒加载：只有打开过入口（或开着状态刷新）才下载面板 chunk
        -「打开过就不再卸载」：关掉抽屉后仍保持挂载（内部 mounted 已处理离场动画），
          避免反复开关时重复创建会话列表与滚动位置
      */}
      {assistantUsed && (
        <Suspense fallback={null}>
          <AssistantPanel />
        </Suspense>
      )}

      {mobileOpen && (
        <button
          type="button"
          aria-label={t('common.close')}
          onClick={() => setMobileOpen(false)}
          className="fixed top-3 right-3 z-[60] grid size-8 place-items-center rounded-md bg-surface shadow-md md:hidden"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}
