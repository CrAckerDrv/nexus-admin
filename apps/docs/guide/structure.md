# 目录结构

```
nexus-admin/
├── apps/
│   ├── admin/
│   │   ├── index.html                # 内联主题预置脚本（防闪白）
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── main.tsx              # 入口：Mock 启动 + Provider 装配
│   │       ├── router.tsx            # 由模块清单生成路由树
│   │       ├── core/                 # 内核（与业务无关）
│   │       │   ├── module.ts         # 模块契约与工具函数
│   │       │   ├── http.ts           # fetch 封装
│   │       │   ├── auth-store.ts     # 登录态与权限码
│   │       │   ├── ui-store.ts       # 主题、密度、页签
│   │       │   ├── notification-store.ts
│   │       │   └── query-client.ts   # React Query 配置与 queryKey 工厂
│   │       ├── modules/              # ★ 业务模块
│   │       │   ├── registry.ts       # 模块注册表
│   │       │   ├── dashboard/        # 工作台
│   │       │   ├── business/         # 用户 / 订单 / 内容
│   │       │   ├── organization/     # 组织 / 角色
│   │       │   ├── components/       # 组件演示
│   │       │   ├── system/           # 审计 / 设置
│   │       │   └── errors/           # 403 / 500
│   │       ├── layout/               # 应用外壳
│   │       │   ├── app-shell.tsx
│   │       │   ├── topbar.tsx
│   │       │   ├── tab-bar.tsx
│   │       │   ├── sidebar-parts.tsx
│   │       │   └── command-palette.tsx
│   │       ├── components/charts/    # ECharts 封装
│   │       ├── services/queries.ts   # 数据访问层
│   │       ├── mock/                 # Mock 数据层
│   │       ├── pages/login-page.tsx
│   │       ├── routes/               # 根路由与错误边界
│   │       ├── types/domain.ts       # 领域模型
│   │       └── styles/globals.css
│   └── docs/                         # 本文档站
├── packages/
│   └── ui/
│       └── src/
│           ├── index.ts              # 统一导出
│           ├── components/           # 50+ 组件（含 media/ 资源与编辑器）
│           ├── lib/
│           │   ├── utils.ts          # cn / 格式化 / 模糊匹配
│           │   └── hooks.ts          # 通用 hooks
│           └── styles/tokens.css     # ★ 设计令牌
└── scripts/
    ├── screenshot.mjs                # 批量截图（README 用）
    └── shot.mjs                      # 单页截图
```

## 三条依赖规则

为了保证可维护性，约定三条**单向依赖**：

1. `packages/ui` **不得** import `apps/*`
2. `apps/admin/src/core` **不得** import `modules/*`（注册表除外）
3. `modules/a` **不得** import `modules/b`（共享逻辑放 `core` 或 `services`）

这三条规则可以用 ESLint 的 `import/no-restricted-paths` 强制，避免长期演进后模块互相缠绕。
