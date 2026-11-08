# 模块协议

模块协议是整套模板的核心。一个模块 = 一个普通对象，描述它需要的导航、路由与权限。

## 定义

```ts
// src/core/module.ts
export interface ModuleDefinition {
  id: string // 唯一标识
  title: string // 侧边栏分组标题
  description?: string
  icon?: LucideIcon
  order: number // 排序，越小越靠上
  permission?: string // 模块级权限（缺省=所有登录用户可见）
  section?: 'main' | 'demo' // 侧栏分区（缺省 main）
  grouped?: boolean // 是否渲染为可折叠分组（缺省 true）
  nav: NavNode[] // 侧边栏导航
  routes: ModuleRoute[] // 路由表
  enabled?: boolean // 功能开关
}
```

### 侧栏分区：`section`

侧边栏按 **业务区 → 演示区** 两段组织，中间用一条分隔线和小标题隔开：

| 取值          | 含义                                     | 放进来的模块                           |
| ------------- | ---------------------------------------- | -------------------------------------- |
| `main`（缺省）| 日常真正要用的业务入口，永远排在最上面   | 工作台、业务管理、组织与权限、系统管理 |
| `demo`        | 可复制、可抄的样板页（模板 / 组件 / 异常）| 模板中心、组件与示例、异常页           |

分区顺序固定为 `main → demo`，不受 `order` 数值影响 —— 分区是「业务优先」的结构性约定。
空分区会被裁掉，不会在侧栏留下孤立标题。核心逻辑在 `partitionBySection()`（有单测覆盖）。

### 平铺分组：`grouped: false`

默认每个模块渲染成一个**可折叠分组**（分组标题只负责收起 / 展开）。

`grouped: false` 时，模块的导航项直接平铺在侧栏顶层、分组图标也不再显示。
适合「工作台」这种只有两三个一级入口、且是登录后默认落地页的模块 ——
多一层折叠既没有信息量，又让首屏多一次点击。

## 编写一个模块

```ts
// src/modules/business/module.ts
import { defineModule } from '@/core/module'
import { Users, ShoppingCart, FileText } from 'lucide-react'

export const businessModule = defineModule({
  id: 'business',
  title: '业务管理',
  description: '用户、订单与内容运营的日常管理',
  order: 20,
  nav: [
    {
      key: 'users',
      title: '用户管理',
      path: '/business/users',
      icon: Users,
      permission: 'user:read',
    },
    {
      key: 'orders',
      title: '订单管理',
      path: '/business/orders',
      icon: ShoppingCart,
      permission: 'order:read',
      badge: 12,
    },
    {
      key: 'content',
      title: '内容中心',
      path: '/business/content',
      icon: FileText,
      permission: 'content:read',
    },
  ],
  routes: [
    {
      path: '/business/users',
      component: () => import('./pages/users-page'),
      permission: 'user:read',
    },
    {
      path: '/business/orders',
      component: () => import('./pages/orders-page'),
      permission: 'order:read',
    },
    {
      path: '/business/content',
      component: () => import('./pages/content-page'),
      permission: 'content:read',
    },
  ],
})
```

## 注册

```ts
// src/modules/registry.ts
export const modules: ModuleDefinition[] = [
  dashboardModule,
  businessModule, // ← 加一行
  organizationModule,
  componentsModule,
  systemModule,
  errorsModule,
].sort((a, b) => a.order - b.order)
```

**不需要**改 `router.tsx`、不需要改侧边栏组件。`router.tsx` 会在启动时调用 `flattenRoutes(modules)` 生成路由树。

## 协议做了什么

| 能力     | 实现位置                               | 说明                                                     |
| -------- | -------------------------------------- | -------------------------------------------------------- |
| 路由生成 | `flattenRoutes()` → `router.tsx`       | 每个 route 生成一个 `createRoute` + `lazyRouteComponent` |
| 侧边栏   | `filterNav()` / `partitionBySection()` → `app-shell.tsx` | 按权限过滤 + 按分区重排，支持二级菜单与徽标 |
| 面包屑   | `findNavTrail()`                       | 从 `nav` 树中递归匹配当前路径                            |
| 命令面板 | `flattenNav()` → `command-palette.tsx` | 展平叶子节点做模糊搜索（跨分区）                         |
| 多页签   | `app-shell.tsx`                        | 路由变化时写入 `ui-store`                                |
| 页面标题 | `route.title`                          | 可在 `beforeLoad` 中同步到 `document.title`              |

## 二级导航

```ts
nav: [
  {
    key: 'settings',
    title: '设置',
    children: [
      { key: 'profile', title: '个人资料', path: '/settings/profile' },
      { key: 'security', title: '安全设置', path: '/settings/security' },
    ],
  },
]
```

父节点不设 `path` 时仅作为分组；设置 `path` 会同时作为可点击项与分组标题。

## 功能开关

```ts
export const betaModule = defineModule({
  id: 'beta',
  // ...
  enabled: import.meta.env.VITE_ENABLE_BETA === 'true',
})
```

`enabled: false` 时导航与路由都不会被注册。

## 组织约定（推荐）

```
src/modules/<name>/
├── module.ts          # 协议声明
├── pages/             # 页面组件（默认导出）
├── components/        # 模块私有组件
└── hooks.ts           # 模块内数据逻辑
```

跨模块共享的逻辑放到 `src/services` 或 `src/core`，**不要**从别的模块 import。
