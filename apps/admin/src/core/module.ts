import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * 模块协议（Module Contract）
 *
 * 一个业务模块 = 一份声明式清单：
 * - 侧边栏导航（支持二级、徽标、权限）
 * - 路由表（懒加载组件，自动代码分割）
 * - 权限码（路由级/导航级/按钮级）
 *
 * 新增模块只需：
 * 1. 在 `src/modules/<name>/module.ts` 里 `defineModule({...})`
 * 2. 在 `src/modules/registry.ts` 数组里加一行
 * 3. 无需改动路由与侧边栏
 */

export interface ModuleRoute {
  /** 绝对路径，如 /business/users */
  path: string
  /** 懒加载组件：() => import('./pages/users') */
  component: () => Promise<{ default: ComponentType }>
  /** 访问所需权限码，缺省继承模块权限 */
  permission?: string
  /** 页面标题（用于标签页与文档标题） */
  title?: string
  /** 标题的 i18n key（可选，优先于 title） */
  titleKey?: string
  /**
   * 独立页面：不套应用外壳（侧栏 / 顶栏 / 页签）
   *
   * 用于投屏大屏这类「只要内容、不要导航」的场景。
   * 单独打开时占满整个视口，权限守卫照常生效。
   */
  standalone?: boolean
}

export interface NavNode {
  key: string
  title: string
  /** 跳转路径；有 children 时可省略 */
  path?: string
  icon?: LucideIcon
  /** 徽标：数字或文案 */
  badge?: number | string
  /** 访问所需权限码 */
  permission?: string
  children?: NavNode[]
  /** 仅精确匹配高亮 */
  exact?: boolean
  /** 新窗口打开（外链） */
  external?: string
  /**
   * 用新标签页打开 `path`
   *
   * 大屏这类「沉浸式页面」不应该替换掉当前工作页签，
   * 点击后新开一页，原页面（含页签、表单状态）原样保留。
   */
  openInNewTab?: boolean
  /**
   * i18n 词条 key（可选）
   *
   * 声明 `titleKey` 后，导航文案会优先取词典值，`title` 作为缺省/回退文案。
   * 这样模块清单既能保持可读（中文 title 直接就地可见），又支持多语言。
   */
  titleKey?: string
}

/**
 * 侧边栏分区
 *
 * - `main`：业务区（工作台 / 业务 / 组织 / 系统）——日常真正要用的入口
 * - `demo`：演示区（模板中心 / 组件示例 / 异常页）——可复制、可抄的样板
 *
 * 分区让「能用的业务」与「可抄的示例」在视觉上分层：
 * 演示页不再混在业务入口之间，新人找页面也不会被示例淹没。
 */
export type ModuleSection = 'main' | 'demo'

export interface ModuleDefinition {
  /** 唯一标识 */
  id: string
  /** 侧边栏分组标题 */
  title: string
  /** 分组标题的 i18n key（可选，优先于 title） */
  titleKey?: string
  /** 分组说明（用于搜索与文档） */
  description?: string
  icon?: LucideIcon
  /** 排序，越小越靠上 */
  order: number
  /** 模块级权限，缺省表示所有登录用户可见 */
  permission?: string
  /** 侧边栏分区（缺省 main） */
  section?: ModuleSection
  /**
   * 是否渲染成可折叠分组（缺省 true）
   *
   * 置为 false 时，模块的导航项直接平铺在侧边栏顶层。
   * 适合「工作台」：只有两三个一级入口，且是默认落地页，
   * 多一层折叠既没有信息量，又让首屏多一次点击。
   */
  grouped?: boolean
  /** 侧边栏导航 */
  nav: NavNode[]
  /** 路由 */
  routes: ModuleRoute[]
  /** 默认启用（可用于功能开关灰度） */
  enabled?: boolean
}

/** 类型辅助：获得完整类型推导 */
export function defineModule(definition: ModuleDefinition): ModuleDefinition {
  return definition
}

/**
 * 按分区切分模块清单（保持各自原有的 order 顺序）
 *
 * 返回的 section 顺序固定为 main → demo：分区是「业务优先」的结构性约定，
 * 不该被某个模块的 order 数值意外调换。空分区会被裁掉，避免侧栏出现孤立标题。
 */
export function partitionBySection<T extends { section?: ModuleSection }>(
  items: T[],
): Array<{ section: ModuleSection; items: T[] }> {
  const order: ModuleSection[] = ['main', 'demo']
  return order
    .map((section) => ({
      section,
      items: items.filter((item) => (item.section ?? 'main') === section),
    }))
    .filter((group) => group.items.length > 0)
}

export interface FlatRoute {
  path: string
  component: ModuleRoute['component']
  permission?: string
  title?: string
  titleKey?: string
  /** 独立页面：不套应用外壳 */
  standalone?: boolean
  moduleId: string
}

/** 展平模块路由，供路由器消费 */
export function flattenRoutes(modules: ModuleDefinition[]): FlatRoute[] {
  return modules
    .filter((mod) => mod.enabled !== false)
    .flatMap((mod) =>
      mod.routes.map((route) => ({
        path: route.path,
        component: route.component,
        permission: route.permission ?? mod.permission,
        title: route.title,
        titleKey: route.titleKey,
        standalone: route.standalone,
        moduleId: mod.id,
      })),
    )
}

export interface FlatNav {
  key: string
  title: string
  /** i18n key（存在时优先取词典值） */
  titleKey?: string
  path: string
  icon?: LucideIcon
  badge?: number | string
  permission?: string
  /** 新标签页打开 */
  openInNewTab?: boolean
  /** 所属分组 */
  moduleId: string
  moduleTitle: string
  moduleTitleKey?: string
  /** 层级路径，用于面包屑：["业务管理", "用户管理", "详情"] */
  trail: string[]
  /** 层级路径对应的 i18n keys */
  trailKeys: Array<string | undefined>
}

/** 展平导航（仅叶子节点），用于命令面板、面包屑、权限过滤 */
export function flattenNav(modules: ModuleDefinition[]): FlatNav[] {
  const result: FlatNav[] = []
  const walk = (
    nodes: NavNode[],
    trail: string[],
    trailKeys: Array<string | undefined>,
    moduleId: string,
    moduleTitle: string,
    moduleTitleKey?: string,
  ) => {
    for (const node of nodes) {
      const nextTrail = [...trail, node.title]
      const nextTrailKeys = [...trailKeys, node.titleKey]
      if (node.children?.length) {
        walk(node.children, nextTrail, nextTrailKeys, moduleId, moduleTitle, moduleTitleKey)
      } else if (node.path) {
        result.push({
          key: node.key,
          title: node.title,
          titleKey: node.titleKey,
          path: node.path,
          icon: node.icon,
          badge: node.badge,
          permission: node.permission,
          openInNewTab: node.openInNewTab,
          moduleId,
          moduleTitle,
          moduleTitleKey,
          trail: nextTrail,
          trailKeys: nextTrailKeys,
        })
      }
    }
  }
  for (const mod of modules) {
    if (mod.enabled === false) continue
    walk(mod.nav, [], [], mod.id, mod.title, mod.titleKey)
  }
  return result
}

/** 按权限过滤导航树 */
export function filterNav(nodes: NavNode[], can: (permission?: string) => boolean): NavNode[] {
  return nodes
    .filter((node) => can(node.permission))
    .map((node) => ({
      ...node,
      children: node.children ? filterNav(node.children, can) : undefined,
    }))
    .filter((node) => !node.children || node.children.length > 0)
}

/** 根据当前路径找到导航链路（面包屑） */
export function findNavTrail(nodes: NavNode[], pathname: string): NavNode[] {
  for (const node of nodes) {
    if (node.children?.length) {
      const child = findNavTrail(node.children, pathname)
      if (child.length) return [node, ...child]
    } else if (node.path && (pathname === node.path || pathname.startsWith(`${node.path}/`))) {
      return [node]
    }
  }
  return []
}

/* ------------------------------------------------------------------ *
 * 菜单布局支撑
 *
 * 六种菜单布局（垂直 / 双列 / 水平 / 混合 / 悬浮 / 侧边栏）都需要回答
 * 同样三个问题，答案必须**逐字一致**，否则「顶部菜单高亮的模块」与
 * 「侧栏里展开的分组」会各算各的，出现两处同时高亮。
 * 因此把判断收敛到这里，布局组件只消费结果。
 * ------------------------------------------------------------------ */

/** 路径是否命中某个导航项（含子路径，如 /business/users/u_1 命中 /business/users） */
export function isPathWithin(pathname: string, path?: string): boolean {
  if (!path) return false
  return pathname === path || pathname.startsWith(`${path}/`)
}

/** 节点自身或任一子节点命中当前路径（分组标题、父级菜单高亮用） */
export function isNodeActive(node: NavNode, pathname: string): boolean {
  if (node.children?.length) {
    return (
      node.children.some((child) => isNodeActive(child, pathname)) ||
      isPathWithin(pathname, node.path)
    )
  }
  return isPathWithin(pathname, node.path)
}

/** 一组节点中是否有命中当前路径的 */
export function isNavActive(nodes: NavNode[], pathname: string): boolean {
  return nodes.some((node) => isNodeActive(node, pathname))
}

/**
 * 展平出所有叶子节点
 *
 * 图标态侧栏、顶部菜单下拉、双列导轨都只关心「可跳转的终点」；
 * 中间层分组只承担归类，不产生额外的点击层级。
 */
export function flattenLeaves(nodes: NavNode[]): NavNode[] {
  return nodes.flatMap((node) =>
    node.children?.length ? flattenLeaves(node.children) : node.path ? [node] : [],
  )
}

/** 模块的落点：第一个可跳转路径（顶部菜单 / 导轨点击时用它） */
export function firstLeafPath(nav: NavNode[]): string | undefined {
  return flattenLeaves(nav)[0]?.path
}

/**
 * 当前路径所属的模块
 *
 * 双列布局据此决定第二列展示哪个模块的子菜单，混合布局据此决定侧栏内容。
 * 用「最长前缀命中」而不是先命中先返回：`/business` 与 `/business/users`
 * 同时能匹配时，必须选更精确的那个模块。
 */
export function findActiveModule<T extends { nav: NavNode[] }>(
  modules: T[],
  pathname: string,
): T | undefined {
  let winner: T | undefined
  let winnerLength = -1
  for (const module of modules) {
    for (const leaf of flattenLeaves(module.nav)) {
      const path = leaf.path
      if (!isPathWithin(pathname, path)) continue
      if (path && path.length > winnerLength) {
        winner = module
        winnerLength = path.length
      }
    }
  }
  return winner
}
