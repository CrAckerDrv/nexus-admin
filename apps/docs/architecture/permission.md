# 权限模型

## 权限码设计

采用 `资源:动作` 的扁平字符串，不用位运算也不用嵌套对象。

```
user:read      user:write      user:delete     user:invite
order:read     order:verify    order:refund    order:export
content:read   content:write   content:publish content:delete
audit:read     audit:export    role:read       role:write     setting:write
```

特点：

- **可读**：日志里直接看到 `order:refund`，比 `1 << 7` 直观
- **可扩展**：新增权限只需约定字符串，不改类型
- **可通配**：`*` 表示全部；未来可支持 `user:*`

## 三层校验

```
┌──────────────┐   登录态      ┌──────────────┐   权限码     ┌──────────────┐
│  路由守卫     │ ───────────► │  导航过滤     │ ───────────► │  按钮禁用     │
│ beforeLoad   │              │  filterNav   │              │ hasPermission│
└──────────────┘              └──────────────┘              └──────────────┘
```

三者读的是**同一个权限码**——这是模块协议的价值：`permission` 字段写一次，三处生效。

## 数据模型

```ts
interface CurrentUser {
  id: string
  name: string
  role: RoleKey // 角色（用于展示与粗粒度判断）
  permissions: string[] // 细粒度权限码（用于实际校验）
}
```

角色与权限码分离的好处：角色是**给用户看的**（"运营专员"），权限码是**给系统判断的**。
角色可以预设一批权限码，但最终校验永远基于权限码，便于后续引入自定义角色。

## 典型用法

```tsx
// 1. 组件级
const canWrite = useAuthStore((s) => s.hasPermission('user:write'))

// 2. 菜单级（模块协议里声明即可）
nav: [{ key: 'roles', title: '角色权限', path: '/organization/roles', permission: 'role:read' }]

// 3. 条件渲染整个区块
{
  hasPermission('audit:export') && <Button>导出日志</Button>
}
```

## 服务端仍然必须校验

前端权限只解决**体验**问题（不显示不能用的按钮），**不是安全边界**。
后端每个接口都要独立校验 token 对应的权限码，前端状态可以被篡改。

## 未来的 RBAC → ABAC

如果出现"只能看自己部门的数据"这类需求，在 `permissions` 之外增加**数据范围**：

```ts
interface CurrentUser {
  permissions: string[]
  dataScope: { type: 'all' | 'department' | 'self'; departmentId?: string }
}
```

查询时把 `dataScope` 作为请求参数传给后端（或在后端根据 token 推导），
页面层不需要改动——继续保持"权限码控制功能、数据范围控制数据"的分工。
