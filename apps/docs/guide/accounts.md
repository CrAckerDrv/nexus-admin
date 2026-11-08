# 演示账号与权限

演示环境内置三个账号，密码均为 `nexus123`。

| 账号                 | 姓名   | 角色       | 权限码                                                               |
| -------------------- | ------ | ---------- | -------------------------------------------------------------------- |
| `admin@nexus.dev`    | 陈彦之 | 超级管理员 | `*`                                                                  |
| `operator@nexus.dev` | 林知夏 | 运营专员   | `user:read` `user:write` `order:read` `content:read` `content:write` |
| `viewer@nexus.dev`   | 周予安 | 只读访客   | `user:read` `order:read` `content:read` `audit:read`                 |

## 权限在三处生效

同一个 `permission` 字段会同时驱动：

### 1. 侧边栏过滤

```ts
// layout/app-shell.tsx
const navModules = modules
  .filter((mod) => can(mod.permission))
  .map((mod) => ({ ...mod, nav: filterNav(mod.nav, can) }))
```

无权限的菜单**不渲染**，而不是渲染后置灰——减少视觉噪音。

### 2. 路由守卫

```ts
// 模块路由的 permission 会被收集，可在 beforeLoad 中校验
beforeLoad: ({ location }) => {
  if (useAuthStore.getState().status !== 'authenticated') {
    throw redirect({ to: '/login', search: { redirect: location.href } })
  }
}
```

### 3. 按钮级控制

```tsx
const canWrite = useAuthStore((s) => s.hasPermission('user:write'))

<Button disabled={!canWrite} onClick={openCreateDialog}>新建用户</Button>
```

## 自定义角色

进入「组织与权限 → 角色权限」：

1. 左侧选择角色，右侧查看权限矩阵
2. 点击「编辑权限」打开对话框，按模块勾选权限码
3. 打开「全部权限」开关等价于授予 `*`

内置角色（`builtin: true`）不允许修改，用于保护超级管理员不被误删权限。
