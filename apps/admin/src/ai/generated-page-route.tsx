import { usePageByPath } from '@/ai/page-store'
import { useCurrentPath } from '@/components/app-link'
import { GeneratedPageView } from './generated-page-view'

/**
 * 生成页路由
 *
 * 所有 AI 生成页面共用一个路由组件：
 * `router.tsx` 为每个已应用页面生成一条 `/generated/*` 路由，
 * 组件本身按当前 path 从页面库里取规格。
 *
 * 好处是不必为每个页面生成一个 chunk，也不会让 `registry.ts` 变成动态数组
 * （TanStack Router 的路由树在模块加载期就要确定）。
 */
export function GeneratedPageRoute() {
  const path = useCurrentPath()
  const page = usePageByPath(path)
  return <GeneratedPageView page={page} path={path} />
}
