import { createRoute, createRouter, lazyRouteComponent, redirect } from '@tanstack/react-router'
import { rootRoute } from './routes/root'
import { modules } from '@/modules/registry'
import { flattenRoutes } from '@/core/module'
import { useAuthStore } from '@/core/auth-store'
import { enforceRouteAccess } from '@/core/route-guard'
import { RouteError, RoutePending } from './routes/route-states'
/**
 * 路由自动生成：把模块声明式清单转成 TanStack Router 路由树
 *
 * 新增模块无需改动此文件。
 *
 * 预加载策略：
 * - `defaultPreload: 'intent'` —— 鼠标悬停/键盘聚焦链接即预取该页 chunk
 * - `defaultPreloadDelay: 40` —— 40ms 后才真正发起，避免快速划过时白下载
 * - 由于页面 chunk 已被预取，实际切页通常不再出现骨架；只在首次进入时短暂显示
 */

export const shellRoute = createRoute({
  id: 'shell',
  getParentRoute: () => rootRoute,
  component: lazyRouteComponent(() => import('./layout/app-shell'), 'AppShell'),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  beforeLoad: ({ location }) => {
    const { status } = useAuthStore.getState()
    if (status !== 'authenticated') {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
  },
})

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: lazyRouteComponent(() => import('@/pages/login-page'), 'LoginPage'),
  errorComponent: RouteError,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/dashboard/overview' as never })
  },
})

/**
 * 由模块清单生成的业务路由
 *
 * `beforeLoad` 里的权限判定见 `core/route-guard.ts`：
 * 清单上的 `permission` 同时驱动菜单过滤与路由守卫，两处读同一个权限码。
 *
 * 两类路由分开挂载：
 * - 常规页：挂在 `shellRoute` 下，带侧栏 / 顶栏 / 页签
 * - `standalone`：直接挂在 root 下，不套外壳（投屏大屏这类沉浸页面）
 */
const flatRoutes = flattenRoutes(modules)

const shellRoutes = flatRoutes
  .filter((route) => !route.standalone)
  .map((route) =>
    createRoute({
      getParentRoute: () => shellRoute,
      path: route.path,
      component: lazyRouteComponent(route.component),
      pendingComponent: RoutePending,
      errorComponent: RouteError,
      beforeLoad: (ctx) => enforceRouteAccess(ctx)(route.permission),
    }),
  )

const standaloneRoutes = flatRoutes
  .filter((route) => route.standalone)
  .map((route) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: route.path,
      component: lazyRouteComponent(route.component),
      pendingComponent: () => null,
      errorComponent: RouteError,
      // 独立页同样要过权限，只是不需要外壳
      beforeLoad: (ctx) => enforceRouteAccess(ctx)(route.permission),
    }),
  )

/**
 * AI 生成页面 · 单条通配路由
 *
 * 生成页来自 localStorage，数量与路径都在运行期才知道，
 * 而 TanStack Router 的路由树必须在模块加载期确定。
 * 这里用一条 `/generated/$` 通配路由承接全部生成页，
 * 组件内部按当前 path 到页面库里取规格（见 ai/generated-page-route.tsx）。
 *
 * 好处：应用到侧边栏不需要重建路由，刷新后依然直达。
 */
const generatedRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/generated/$',
  component: lazyRouteComponent(() => import('@/ai/generated-page-route'), 'GeneratedPageRoute'),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  ...standaloneRoutes,
  shellRoute.addChildren([...shellRoutes, generatedRoute]),
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadDelay: 40,
  // 骨架最短显示 160ms：避免「一闪而过」的闪烁，超过 260ms 才认为需要等待
  defaultPendingMs: 260,
  defaultPendingMinMs: 160,
  scrollRestoration: true,
  // 预加载时也把依赖 chunk 拉进来
  defaultPreloadStaleTime: 15_000,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
