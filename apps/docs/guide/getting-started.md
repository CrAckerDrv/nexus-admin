# 快速开始

## 环境要求

- Node.js ≥ 20.19
- pnpm ≥ 10（`npm i -g pnpm`）

## 安装与启动

```bash
git clone https://github.com/your-org/nexus-admin.git
cd nexus-admin

pnpm install
pnpm dev          # 应用 http://127.0.0.1:5173
pnpm dev:docs     # 文档 http://127.0.0.1:5174
```

## 可用脚本

| 命令             | 说明                         |
| ---------------- | ---------------------------- |
| `pnpm dev`       | 启动后台应用（含 Mock 数据） |
| `pnpm build`     | 生产构建（先类型检查）       |
| `pnpm preview`   | 预览构建产物                 |
| `pnpm test`      | 运行单元测试                 |
| `pnpm typecheck` | 全量类型检查                 |
| `pnpm lint`      | ESLint                       |
| `pnpm format`    | Prettier 格式化              |
| `pnpm dev:docs`  | 文档站开发模式               |

## 第一次运行

1. 打开 `http://127.0.0.1:5173`，会自动跳转到登录页
2. 点击「超级管理员」卡片自动填充账号，或直接使用 `admin@nexus.dev` / `nexus123`
3. 登录后进入经营概览；按 <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>K</kbd> 打开命令面板
4. 右上角头像菜单 → 偏好设置，可切换深浅色、强调色、圆角与密度

## 体验权限差异

退出登录后改用 `viewer@nexus.dev` 重新登录：

- 侧边栏「角色权限」菜单消失（无 `role:read`）
- 用户管理页顶部的「新建用户」按钮变为禁用
- 直接访问 `/organization/roles` 仍可渲染页面，但接口层会被 403 拦截（示例中由前端守卫演示）

更多角色说明见 [演示账号与权限](/guide/accounts)。
