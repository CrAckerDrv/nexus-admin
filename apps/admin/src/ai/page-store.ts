import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { IconId, PageSpec } from '@nexus/ai-sdk'
import {
  Activity,
  AppWindow,
  ChartLine,
  FileChartColumn,
  Layers,
  Sparkles,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { ModuleDefinition, NavNode } from '@/core/module'

/**
 * AI 生成页面库
 *
 * 助手产出的页面**不落磁盘**：它们是一份可序列化的 PageSpec，
 * 存在 localStorage 里，渲染时由 `ai/components/page-renderer` 统一解释。
 * 这样「改一行配置就上线」变成「说一句话就上线」，同时不引入任何运行时编译风险。
 *
 * 两段式落地：
 * - `pages`：生成即入库（预览可用、刷新不丢），但**不进侧边栏**
 * - `appliedIds`：显式「应用到侧边栏」后才成为正式入口
 */

export interface GeneratedPageState {
  pages: PageSpec[]
  /** 已应用到侧边栏的页面 id */
  appliedIds: string[]
  save: (page: PageSpec) => void
  remove: (id: string) => void
  apply: (page: PageSpec) => void
  unapply: (id: string) => void
  clearAll: () => void
  isApplied: (id: string) => boolean
}

/** 页面库上限：避免长期使用后 localStorage 无限膨胀 */
const MAX_PAGES = 20

/**
 * 路径去重
 *
 * 内置模板有稳定的默认路径（`/generated/user-stats`），
 * 但用户可能生成第二份同类页面 —— 两份同路径会让侧边栏出现两个一样地址的入口，
 * 也会让「打开页面」永远打开第一份。这里给后来的同名路径补序号。
 */
function uniquePath(pages: PageSpec[], page: PageSpec): PageSpec {
  const clash = (candidate: string) =>
    pages.some((item) => item.id !== page.id && item.path === candidate)
  if (!clash(page.path)) return page
  let index = 2
  while (clash(`${page.path}-${index}`)) index += 1
  return { ...page, path: `${page.path}-${index}` }
}

export const useGeneratedPages = create<GeneratedPageState>()(
  persist(
    (set, get) => ({
      pages: [],
      appliedIds: [],
      save: (incoming) =>
        set((state) => {
          const page = uniquePath(state.pages, incoming)
          return {
            pages: state.pages.some((item) => item.id === page.id)
              ? state.pages.map((item) => (item.id === page.id ? page : item))
              : [page, ...state.pages].slice(0, MAX_PAGES),
          }
        }),
      remove: (id) =>
        set((state) => ({
          pages: state.pages.filter((item) => item.id !== id),
          appliedIds: state.appliedIds.filter((item) => item !== id),
        })),
      apply: (incoming) =>
        set((state) => {
          const page = uniquePath(state.pages, incoming)
          return {
            pages: state.pages.some((item) => item.id === page.id)
              ? state.pages.map((item) => (item.id === page.id ? page : item))
              : [page, ...state.pages].slice(0, MAX_PAGES),
            appliedIds: state.appliedIds.includes(page.id)
              ? state.appliedIds
              : [...state.appliedIds, page.id],
          }
        }),
      unapply: (id) =>
        set((state) => ({ appliedIds: state.appliedIds.filter((item) => item !== id) })),
      clearAll: () => set({ pages: [], appliedIds: [] }),
      isApplied: (id) => get().appliedIds.includes(id),
    }),
    {
      name: 'nexus-ai-pages',
      version: 1,
      partialize: (state) => ({ pages: state.pages, appliedIds: state.appliedIds }),
    },
  ),
)

/* ------------------------------------------------------------------ *
 * 图标映射
 * ------------------------------------------------------------------ */

const ICONS: Record<IconId, LucideIcon> = {
  sparkles: Sparkles,
  users: AppWindow,
  chart: ChartLine,
  table: FileChartColumn,
  layers: Layers,
  activity: Activity,
  file: FileChartColumn,
  settings: AppWindow,
  wallet: Wallet,
  shield: Layers,
}

export function iconForPage(page: PageSpec): LucideIcon {
  return ICONS[page.icon as IconId] ?? Sparkles
}

/* ------------------------------------------------------------------ *
 * 生成「AI 生成」模块
 * ------------------------------------------------------------------ */

/**
 * 把已应用的页面投影成一个模块声明
 *
 * 复用现有模块协议意味着：侧边栏分组、路由、页签、命令面板、面包屑、
 * 权限校验全部免费获得，不需要为 AI 页面单开一套渲染分支。
 *
 * `routes` 刻意留空：所有生成页共用一个渲染器（`GeneratedPageRoute`），
 * 按 path 查规格。若走模块懒加载，就要为每个页面生成一个 chunk，没有意义。
 */
export function buildGeneratedModule(
  pages: PageSpec[],
  appliedIds: string[],
): ModuleDefinition | null {
  const applied = pages
    .filter((page) => appliedIds.includes(page.id) && page.path.startsWith('/generated/'))
    .sort((a, b) => a.createdAt - b.createdAt)

  if (!applied.length) return null

  const nav: NavNode[] = applied.map((page) => ({
    key: page.id,
    title: page.title,
    path: page.path,
    icon: iconForPage(page),
    badge: page.nav.badge,
  }))

  return {
    id: 'ai-generated',
    title: 'AI 生成',
    description: '由 AI 运营助手生成并应用的页面',
    icon: Sparkles,
    // 紧跟在「AI 助手」之后：用户刚应用完就能在侧栏看到，
    // 不必滚到最底部去找自己刚生成的东西
    order: 26,
    section: 'main',
    nav,
    routes: [],
  }
}

/** 最近更新的页面（刷新后用来还原「当前页面」上下文） */
export function latestPage(pages: PageSpec[]): PageSpec | undefined {
  return [...pages].sort((a, b) => b.updatedAt - a.updatedAt)[0]
}

/* ------------------------------------------------------------------ *
 * Hook：外壳 / 顶栏 / 助手面板共用的只读视图
 * ------------------------------------------------------------------ */

/**
 * 侧边栏模块投影
 *
 * 用 `useMemo` 而不是模块级缓存：模块级变量在渲染期写入属于副作用，
 * React Compiler 会直接报错；而 `pages` / `appliedIds` 本身就是
 * zustand 的稳定引用（只有内容变了才换新数组），依赖它们已经足够精确。
 */
export function useGeneratedModule(): ModuleDefinition | null {
  const pages = useGeneratedPages((state) => state.pages)
  const appliedIds = useGeneratedPages((state) => state.appliedIds)
  return useMemo(() => buildGeneratedModule(pages, appliedIds), [pages, appliedIds])
}

const EMPTY_NAV: NavNode[] = []

export function useGeneratedNav(): NavNode[] {
  const module = useGeneratedModule()
  return module?.nav ?? EMPTY_NAV
}

/** 当前路径对应的页面规格（路由渲染用） */
export function usePageByPath(path: string): PageSpec | undefined {
  const pages = useGeneratedPages((state) => state.pages)
  return pages.find((page) => page.path === path)
}

/** 供非组件环境（助手工具回调）读取 */
export function applyPageToSidebar(page: PageSpec) {
  useGeneratedPages.getState().apply(page)
}

/** 用于侧边栏角标：已应用页面数 */
export function useAppliedCount(): number {
  return useGeneratedPages((state) => state.appliedIds.length)
}
