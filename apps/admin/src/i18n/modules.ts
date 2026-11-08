import { useCallback, useMemo } from 'react'
import type { ModuleDefinition, NavNode } from '@/core/module'
import { flattenNav, flattenRoutes } from '@/core/module'
import { modules as registryModules } from '@/modules/registry'
import { useUiStore } from '@/core/ui-store'
import type { DictKey } from './index'
import { getDict } from './index'
import { zh } from './locales/zh'
import { GROUP_KEY_BY_KEY, MODULE_KEY_BY_ID, NAV_KEY_BY_PATH } from './locales/keys'

/** 按当前语言取词条，缺失时回退到模块里写的中文源文案 */
function makeTranslator(locale: 'zh-CN' | 'en-US') {
  if (locale === 'zh-CN') return (_key: string | undefined, fallback: string) => fallback
  const dict = getDict(locale)
  return (key: string | undefined, fallback: string) => {
    if (!key) return fallback
    const value = dict[key as DictKey]
    return (value ?? zh[key as DictKey] ?? fallback) as string
  }
}

/**
 * 模块清单的多语言投影
 *
 * 三级解析顺序（越靠前优先级越高）：
 * 1. 模块/导航节点自己声明的 `titleKey`（新模块推荐写法）
 * 2. 全局索引 `NAV_KEY_BY_PATH` / `MODULE_KEY_BY_ID` / `GROUP_KEY_BY_KEY`
 * 3. 模块里写的中文 `title`
 *
 * 这样既有「就地可读」的中文清单，又不必为了 i18n 去改 8 个 module.ts；
 * 新增模块时用 `titleKey` 覆盖索引即可（例如 account 模块）。
 */
export function useLocalizedModules(source: ModuleDefinition[] = registryModules) {
  const locale = useUiStore((state) => state.locale)

  return useMemo(() => {
    if (locale === 'zh-CN') return source
    const tr = makeTranslator(locale)

    const mapNav = (nodes: NavNode[]): NavNode[] =>
      nodes.map((node) => {
        const key =
          node.titleKey ?? (node.path ? NAV_KEY_BY_PATH[node.path] : GROUP_KEY_BY_KEY[node.key])
        return {
          ...node,
          title: tr(key, node.title),
          children: node.children ? mapNav(node.children) : undefined,
        }
      })

    return source.map((mod) => ({
      ...mod,
      title: tr(mod.titleKey ?? MODULE_KEY_BY_ID[mod.id], mod.title),
      nav: mapNav(mod.nav),
      routes: mod.routes.map((route) => ({
        ...route,
        title: tr(route.titleKey ?? NAV_KEY_BY_PATH[route.path], route.title ?? ''),
      })),
    }))
  }, [source, locale])
}

/** 当前语言的导航叶子节点（用于页签、命令面板、面包屑） */
export function useLocalizedNav(source: ModuleDefinition[] = registryModules) {
  const localized = useLocalizedModules(source)
  return useMemo(() => flattenNav(localized), [localized])
}

/** 当前语言的路由表（用于 document.title 等） */
export function useLocalizedRoutes(source: ModuleDefinition[] = registryModules) {
  const localized = useLocalizedModules(source)
  return useMemo(() => flattenRoutes(localized), [localized])
}

/** 路径 → 当前语言的导航项（详情页按最长前缀匹配） */
export function useNavResolver(source: ModuleDefinition[] = registryModules) {
  const nav = useLocalizedNav(source)
  return useCallback(
    (path: string) => {
      const exact = nav.find((item) => item.path === path)
      if (exact) return exact
      return nav
        .filter((item) => path.startsWith(`${item.path}/`))
        .sort((a, b) => b.path.length - a.path.length)[0]
    },
    [nav],
  )
}

/** 仅取「路径 → 所属模块标题」映射（页签悬浮提示用） */
export function useModuleTitleMap(source: ModuleDefinition[] = registryModules) {
  const nav = useLocalizedNav(source)
  return useMemo(
    () =>
      Object.fromEntries(nav.map((item) => [item.path, item.moduleTitle])) as Record<
        string,
        string
      >,
    [nav],
  )
}
