import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { cn } from '@nexus/ui'
import { AppLink } from '@/components/app-link'
import { useUiStore } from '@/core/ui-store'
import { flattenLeaves, isNavActive, isNodeActive } from '@/core/module'
import type { ModuleDefinition, ModuleSection, NavNode } from '@/core/module'
import { useI18n } from '@/i18n'
import { SECTION_LABEL } from './nav-labels'

/**
 * 导航渲染层
 *
 * 六种菜单布局共用同一套导航项与分组组件，差别只在**摆放方式**：
 * - `SidebarNav`：整列导航（垂直 / 悬浮 / 侧边栏三种布局用它，折叠态自动切成图标轨道）
 * - `SingleModuleNav`：只展示单个模块的子菜单（混合布局的侧栏、双列布局的第二列）
 * - `ModuleRail`：模块导轨（双列布局的第一列，图标 + 名称纵向排列）
 *
 * 为什么单独拆文件：
 * 布局外壳（app-shell）需要同时拼侧栏、顶栏与内容区，若把导航项也塞进去，
 * 会变成 800 行的「什么都干」组件，改一处布局就得读完整棵树。
 */

/** 参与渲染的模块（已按权限过滤、并带上了分组收起状态） */
export interface NavModuleEntry extends ModuleDefinition {
  nav: NavNode[]
  /** 分组是否被手动收起 */
  collapsed: boolean
}

export interface NavSectionEntry {
  section: ModuleSection
  items: NavModuleEntry[]
}

/* ------------------------------------------------------------------ *
 * 整列导航
 * ------------------------------------------------------------------ */

/**
 * 侧栏导航
 *
 * @param collapsed 图标轨道模式：不再渲染分组，而是把所有叶子项平铺，
 *                  并用悬浮标签补齐被隐藏的文字（点击面积仍是 36px 的圆角块）
 */
export function SidebarNav({
  sections,
  currentPath,
  collapsed = false,
  showSectionLabel = true,
}: {
  sections: NavSectionEntry[]
  currentPath: string
  collapsed?: boolean
  showSectionLabel?: boolean
}) {
  const { t } = useI18n()
  const toggleGroup = useUiStore((state) => state.toggleGroup)

  if (collapsed) {
    return (
      <div className="pb-2">
        {sections.map((section, sectionIndex) => (
          <div key={section.section}>
            {/* 分区之间用一条更宽的细分隔线断开：图标态没有文字，分隔线是唯一的结构提示 */}
            {sectionIndex > 0 && (
              <span aria-hidden="true" className="mx-auto my-2 block h-px w-5 bg-line-strong/60" />
            )}
            <ul className="space-y-0.5">
              {section.items.flatMap((mod) =>
                flattenLeaves(mod.nav).map((node) => (
                  // key 带上模块 id：`overview` 这类通用 key 会跨模块重名，
                  // 只用 node.key 会让 React 认为是同一节点（控制台报 duplicate key）
                  <NavItem
                    key={`${mod.id}:${node.key}`}
                    node={node}
                    collapsed
                    currentPath={currentPath}
                    depth={0}
                  />
                )),
              )}
            </ul>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      {sections.map((section, sectionIndex) => (
        <div key={section.section}>
          {/* 非首个分区前画一条分隔线 + 小标题：
              首个分区是业务主入口，不需要标题重复「这里是什么」 */}
          {showSectionLabel && sectionIndex > 0 && (
            <div className="mt-2 mb-1 flex items-center gap-2 px-2.5">
              <span className="h-px flex-1 bg-line" aria-hidden="true" />
              <span className="text-[0.625rem] font-medium tracking-[0.08em] text-fg-4 uppercase">
                {t(SECTION_LABEL[section.section])}
              </span>
              <span className="h-px w-4 bg-line" aria-hidden="true" />
            </div>
          )}
          {section.items.map((mod) =>
            mod.grouped === false ? (
              <ul key={mod.id} className="mb-1 space-y-0.5">
                {mod.nav.map((node) => (
                  <NavItem
                    key={node.key}
                    node={node}
                    collapsed={false}
                    currentPath={currentPath}
                    depth={0}
                  />
                ))}
              </ul>
            ) : (
              <NavGroup
                key={mod.id}
                module={mod}
                currentPath={currentPath}
                expanded={!mod.collapsed}
                onToggle={() => toggleGroup(mod.id)}
              />
            ),
          )}
        </div>
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ *
 * 单模块子菜单（混合 / 双列布局）
 * ------------------------------------------------------------------ */

/**
 * 单个模块的导航树
 *
 * 与 `SidebarNav` 的区别：模块标题变成**静态标题**而不是可折叠分组 ——
 * 混合与双列布局里「当前模块」是外部导航已确定的事实，再给一个折叠箭头
 * 只会让人误以为点它能切换模块。
 */
export function SingleModuleNav({
  module,
  currentPath,
  title,
  showTitle = true,
  collapsed = false,
}: {
  module: NavModuleEntry
  currentPath: string
  /** 覆盖标题（双列布局展示完整名称） */
  title?: string
  /**
   * 是否渲染模块标题
   *
   * 双列布局已经在第二列顶部单独画了一行模块名，这里再画一次就成了「工作台 / 工作台」；
   * 混合布局的侧栏没有别的标题行，这一行就是它唯一的模块标识，必须保留。
   */
  showTitle?: boolean
  /**
   * 图标态（双列折叠）
   *
   * 双列的第二列收起时**不消失**，而是收成一列图标：只要图标还在，
   * 用户就知道「这一区块只是窄了」，点一下开关还能拉回来；
   * 整块消失则更像误触，也丢掉了当前模块的入口。
   */
  collapsed?: boolean
}) {
  const Icon = module.icon

  if (collapsed) {
    return (
      <ul className="space-y-0.5">
        {flattenLeaves(module.nav).map((node) => (
          <NavItem key={node.key} node={node} collapsed currentPath={currentPath} depth={0} />
        ))}
      </ul>
    )
  }

  return (
    <div className="pb-2">
      {showTitle && (
        <div className="mb-1.5 flex items-center gap-2 px-2.5 pt-0.5">
          {Icon && <Icon className="size-[0.9375rem] shrink-0 text-fg-4" strokeWidth={1.8} />}
          <span className="min-w-0 flex-1 truncate text-[0.6875rem] font-semibold tracking-wide text-fg-3 uppercase">
            {title ?? module.title}
          </span>
        </div>
      )}
      <ul className="space-y-0.5">
        {module.nav.map((node) => (
          <NavItem
            key={node.key}
            node={node}
            collapsed={false}
            currentPath={currentPath}
            depth={0}
          />
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 模块导轨（双列布局）
 * ------------------------------------------------------------------ */

/**
 * 模块导轨
 *
 * 双列布局的第一列：每个模块一个图标 + 名称的方块，点击切到该模块的第一个页面。
 * 导轨始终显示文字（不折叠）：这一列的意义就是「一眼看全有哪些模块」，
 * 只留图标会退化成需要逐个悬停猜测的图标墙。
 */
export function ModuleRail({
  sections,
  activeModuleId,
}: {
  sections: NavSectionEntry[]
  activeModuleId?: string
}) {
  return (
    <ul className="space-y-1">
      {sections.map((section, sectionIndex) => (
        <li key={section.section}>
          {sectionIndex > 0 && (
            <div className="mb-1.5 flex justify-center pt-2">
              <span className="h-px w-6 bg-line-strong/50" aria-hidden="true" />
            </div>
          )}
          <ul className="space-y-1">
            {section.items.map((mod) => {
              const Icon = mod.icon
              const active = mod.id === activeModuleId
              const target = flattenLeaves(mod.nav)[0]?.path
              const name = mod.title
              const body = (
                <span
                  className={cn(
                    'flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2 text-center transition-colors',
                    active
                      ? 'bg-primary-weak font-medium text-primary'
                      : 'text-fg-3 hover:bg-surface-2 hover:text-fg',
                  )}
                >
                  <span className="grid size-6 place-items-center">
                    {Icon ? (
                      <Icon className="size-[1.1875rem]" strokeWidth={active ? 2.1 : 1.8} />
                    ) : (
                      <span className="size-2 rounded-full bg-current" />
                    )}
                  </span>
                  {/* 模块名可能较长：两行截断，保证导轨宽度固定 */}
                  <span className="line-clamp-2 w-full text-[0.625rem] leading-3 break-all">
                    {name}
                  </span>
                </span>
              )
              return (
                <li key={mod.id}>
                  {target ? (
                    <AppLink to={target} className="block w-full" title={name}>
                      {body}
                    </AppLink>
                  ) : (
                    <span className="block w-full">{body}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </li>
      ))}
      <li aria-hidden="true" className="mt-2 flex justify-center px-2">
        <span className="h-px w-5 bg-line-strong/50" />
      </li>
    </ul>
  )
}

/* ------------------------------------------------------------------ *
 * 分组与导航项
 * ------------------------------------------------------------------ */

/**
 * 可折叠分组（模块级）
 *
 * 与 `NavItem` 的区别：分组标题不是链接，只负责「收起 / 展开」，
 * 因此视觉比菜单项更轻（字号同级、颜色更淡、展开箭头更小）。
 */
export function NavGroup({
  module,
  currentPath,
  expanded,
  onToggle,
}: {
  module: NavModuleEntry
  currentPath: string
  expanded: boolean
  onToggle: () => void
}) {
  const hasActive = isNavActive(module.nav, currentPath)
  const GroupIcon = module.icon

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cn(
          'group/group flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left transition-colors',
          'hover:bg-surface-2',
        )}
      >
        {/* 分组图标：与菜单项同尺寸同轨道，避免缩进后视觉跳位 */}
        <span
          className={cn(
            'flex size-[1.125rem] shrink-0 items-center justify-center transition-colors',
            hasActive ? 'text-primary' : 'text-fg-4 group-hover/group:text-fg-3',
          )}
        >
          {GroupIcon ? (
            <GroupIcon className="size-[1.125rem]" strokeWidth={1.8} />
          ) : (
            <span className="size-1.5 rounded-full bg-current" />
          )}
        </span>
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-[0.8125rem] font-medium transition-colors',
            hasActive ? 'text-primary' : 'text-fg-2 group-hover/group:text-fg',
          )}
        >
          {module.title}
        </span>
        <ChevronDown
          className={cn(
            'size-3 shrink-0 text-fg-4 transition-transform duration-200',
            expanded ? 'rotate-0' : '-rotate-90',
          )}
        />
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-[var(--n-sidebar-ease)]',
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <ul className="ml-4 space-y-0.5 border-l border-line-subtle pl-2">
            {module.nav.map((node) => (
              <NavItem
                key={node.key}
                node={node}
                collapsed={false}
                currentPath={currentPath}
                depth={1}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

/**
 * 导航项
 *
 * 折叠态用「固定轨道 + 文字层绝对定位」而不是 `justify-center`：
 * 后者会因为文字仍占位把图标挤偏，实测偏移 -15px。
 */
export function NavItem({
  node,
  collapsed,
  currentPath,
  depth,
}: {
  node: NavNode
  collapsed: boolean
  currentPath: string
  depth: number
}) {
  /**
   * 子节点展开态
   *
   * 之前这里漏了状态：`hasChildren` 的按钮渲染出来却没有 onClick，
   * 于是「模板中心 → 数据可视化 / 协作与流程 / 智能与内容」这一层永远点不开。
   * 默认展开，保证一眼能看到全部内容。
   */
  const [open, setOpen] = useState(true)
  const hasChildren = Boolean(node.children?.length)
  const isActive = isNodeActive(node, currentPath)
  const Icon = node.icon
  const isChild = depth > 0

  const body = (
    <span
      className={cn(
        'relative flex h-9 w-full items-center rounded-md',
        'transition-[background-color,color,box-shadow] duration-150',
        isActive
          ? 'bg-primary-weak font-medium text-primary'
          : 'text-fg-2 hover:bg-surface-2 hover:text-fg',
        collapsed ? 'justify-center' : isChild ? 'gap-2 pr-2 pl-2' : 'gap-2.5 px-2.5',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-1/2 left-0 h-4 w-[0.1563rem] -translate-y-1/2 rounded-r-full bg-primary',
          'transition-[opacity,transform] duration-200',
          isActive ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0',
        )}
      />
      {Icon && (
        <Icon
          className={cn(
            'size-[1.125rem] shrink-0 transition-colors',
            isActive ? 'text-primary' : 'text-fg-3',
          )}
          strokeWidth={isActive ? 2.1 : 1.8}
        />
      )}
      <span
        className={cn(
          'flex items-center gap-1.5 overflow-hidden whitespace-nowrap',
          'transition-[opacity,transform] duration-200 ease-[var(--n-sidebar-ease)]',
          collapsed
            ? 'pointer-events-none absolute left-2 -translate-x-1 opacity-0'
            : 'min-w-0 flex-1 translate-x-0 opacity-100',
        )}
      >
        <span className="min-w-0 flex-1 truncate text-left">{node.title}</span>
        {node.badge !== undefined && (
          <span
            className={cn(
              'grid h-[1.125rem] min-w-[1.125rem] shrink-0 place-items-center rounded-full px-1 text-2xs font-semibold tabular-nums',
              isActive ? 'bg-primary/15 text-primary' : 'bg-danger-weak text-danger',
            )}
          >
            {node.badge}
          </span>
        )}
        {hasChildren && (
          <svg
            viewBox="0 0 24 24"
            className={cn(
              'size-3 shrink-0 text-fg-4 transition-transform duration-200',
              open && 'rotate-90',
            )}
            fill="none"
            aria-hidden="true"
          >
            <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </span>
    </span>
  )

  const wrapped = collapsed ? (
    <NavTooltipLabel title={node.title} badge={node.badge}>
      {body}
    </NavTooltipLabel>
  ) : (
    body
  )

  return (
    <li className="group/nav relative">
      {hasChildren ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-label={node.title}
            className="w-full cursor-pointer"
          >
            {wrapped}
          </button>
          {/* 子级：缩进 + 左侧引导线，形成层级错位 */}
          <div
            className={cn(
              'grid transition-[grid-template-rows,opacity] duration-200 ease-[var(--n-sidebar-ease)]',
              open && !collapsed ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
            )}
          >
            <div className="overflow-hidden">
              <ul className="mt-0.5 ml-3.5 space-y-0.5 border-l border-line pl-2">
                {node.children?.map((child) => (
                  <NavItem
                    key={child.key}
                    node={child}
                    collapsed={collapsed}
                    currentPath={currentPath}
                    depth={depth + 1}
                  />
                ))}
              </ul>
            </div>
          </div>
        </>
      ) : node.path ? (
        <AppLink
          to={node.path}
          className="block w-full"
          ariaCurrent={isActive ? 'page' : undefined}
          newTab={node.openInNewTab}
        >
          {wrapped}
        </AppLink>
      ) : (
        <div>{wrapped}</div>
      )}
    </li>
  )
}

/**
 * 折叠态悬浮标签
 *
 * 用 fixed + 实测坐标挂到 body：
 * 侧栏 `<nav>` 有 `overflow-y-auto`，绝对定位标签会被裁掉。
 */
export function NavTooltipLabel({
  title,
  badge,
  children,
}: {
  title: string
  badge?: number | string
  children: React.ReactNode
}) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)

  const show = (event: React.MouseEvent<HTMLSpanElement> | React.FocusEvent<HTMLSpanElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setCoords({ top: rect.top + rect.height / 2, left: rect.right + 10 })
  }
  const hide = () => setCoords(null)

  return (
    <span
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className="relative block w-full"
    >
      {children}
      {coords &&
        createPortal(
          <span
            role="tooltip"
            style={{ top: coords.top, left: coords.left }}
            className={cn(
              'n-fade-in pointer-events-none fixed z-[1200] -translate-y-1/2',
              'flex items-center gap-1.5 rounded-md bg-inverse px-2.5 py-1.5',
              'text-xs font-medium whitespace-nowrap text-fg-inverse shadow-lg',
            )}
          >
            <span
              aria-hidden="true"
              className="absolute top-1/2 -left-1 size-2 -translate-y-1/2 rotate-45 rounded-[0.125rem] bg-inverse"
            />
            <span className="relative">{title}</span>
            {badge !== undefined && (
              <span className="relative rounded-full bg-danger px-1.5 text-2xs font-semibold text-white tabular-nums">
                {badge}
              </span>
            )}
          </span>,
          document.body,
        )}
    </span>
  )
}
