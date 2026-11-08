# 路由与懒加载

## 路由如何生成

`src/router.tsx` 在模块加载时一次性构建路由树：

```ts
const shellRoute = createRoute({
  id: 'shell',
  getParentRoute: () => rootRoute,
  component: lazyRouteComponent(() => import('./layout/app-shell'), 'AppShell'),
  beforeLoad: ({ location }) => {
    if (useAuthStore.getState().status !== 'authenticated') {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
})

const moduleRoutes = flattenRoutes(modules).map((route) =>
  createRoute({
    getParentRoute: () => shellRoute,
    path: route.path,
    component: lazyRouteComponent(route.component),
    pendingComponent: RoutePending,
    errorComponent: RouteError,
  }),
)
```

注意 `lazyRouteComponent(route.component)`：每个页面都是独立 chunk，
Vite 构建产物中可以看到 `users-page-*.js`、`orders-page-*.js` 等文件。

## 预加载

```ts
createRouter({
  defaultPreload: 'intent', // 鼠标悬停 60ms 后预取该路由的代码
  defaultPreloadDelay: 60,
  defaultPendingMs: 280, // 超过 280ms 才显示骨架，避免闪烁
  defaultPendingMinMs: 220, // 骨架最小展示时长
})
```

`intent` 策略的效果：用户把鼠标移到「订单管理」菜单上时，对应 chunk 已经在下载，
点击时几乎瞬间切换。

## 登录守卫

```ts
beforeLoad: ({ location }) => {
  const { status } = useAuthStore.getState()
  if (status !== 'authenticated') {
    throw redirect({ to: '/login', search: { redirect: location.href } })
  }
}
```

守卫挂在 `shellRoute` 上，因此**所有业务路由**自动受保护；
`/login` 是 `rootRoute` 的直接子路由，不受影响。

## 页面级错误与加载态

每个模块路由都挂载了统一的 `pendingComponent` 与 `errorComponent`：

```tsx
export function RouteError({ error, reset }: { error: unknown; reset?: () => void }) {
  return (
    <div className="p-5">
      <pre>{error instanceof Error ? error.message : String(error)}</pre>
      <Button onClick={() => reset?.()}>重试</Button>
    </div>
  )
}
```

一个模块崩了不会白屏整个应用。

## 404 与异常页

- `/errors/403`、`/errors/500`：可被权限系统复用的状态页（见 `modules/errors`）
- 未匹配路径：`rootRoute` 的 `notFoundComponent`

## 为什么不使用 Hash 路由

后台系统通常需要直接粘贴 URL 分享（如工单链接 `/business/orders?keyword=NO2026`），
History 路由更符合习惯。部署时需要在服务端配置 fallback：

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```
