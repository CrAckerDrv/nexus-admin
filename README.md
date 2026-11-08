<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/nexus-mark-white.svg" />
  <img src="brand/nexus-mark-black.svg" alt="Nexus Admin" height="76" />
</picture>

# Nexus Admin

**模块化 · 零依赖组件库 · 高性能 · 开箱即用的通用管理后台模板**

React 19 · Vite 8 · TypeScript · Tailwind CSS v4 · TanStack Router / Query · ECharts 6

[![CI](https://img.shields.io/badge/CI-pnpm%20verify-brightgreen)](https://github.com/CrAckerDrv/nexus-admin/actions)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)
[![Security Policy](https://img.shields.io/badge/security-policy-4baaaa)](SECURITY.md)
[![Code of Conduct](https://img.shields.io/badge/code%20of%20conduct-2.1-4baaaa)](CODE_OF_CONDUCT.md)

[快速开始](#-快速开始) · [截图](#-截图) · [架构设计](#-架构设计) · [组件库](#-组件库) · [文档](#-文档) · [性能报告](docs/PERFORMANCE.md)

</div>

---

## 这是什么

一套**可直接用于生产**的通用后台模板。不是又一个把 Ant Design 包一层的脚手架，而是：

- **自研零依赖组件库**：50+ 组件全部手写，只依赖 React + Tailwind，没有 `antd` / `element` / `@radix-ui` 的黑盒
- **模块化内核**：新增一个业务模块 = 写一个 `module.ts` + 在数组里加一行，路由、菜单、面包屑、命令面板、权限全部自动生成
- **真实可跑**：内置 Mock 数据层（拦截原生 `fetch`，无需 Service Worker），克隆即可看到完整交互
- **性能优先**：路由级代码分割 + 意图预加载、虚拟滚动表格、ECharts 动态加载、CSS 变量驱动的主题（0 运行时开销）
- **设计令牌驱动**：深浅色 / **10 组配色** / 5 档圆角 / 4 档密度 / 3 种侧栏形态 / RTL，切换即时生效且无闪白
- **中英双语**：零依赖 i18n（词典 + 插值，漏译编译期报错），导航、顶栏、主题面板、登录页均已双语
- **登录页人机验证**：内置 Cloudflare Turnstile（只取票据，判定交后端 siteverify），一次性 token 的重试路径已处理
- **动效克制的细节**：主题切换的圆形扩散、页面级入场、骨架与真实页面同构、侧栏折叠图标始终居中
- **两段式信息架构**：侧栏按「业务导航 / 演示与示例」分区，经营概览与数据分析重排为「结论 → 趋势 → 归因 → 明细」
- **运维面板**：工作台内置「性能监控」——54 节点健康矩阵、四档资源/吞吐趋势、SLO 与错误预算、告警处置、实时日志、存储水位与负载热力图，全部由自研组件与 ECharts 拼装
- **AI 运营助手（SDK 架构）**：顶栏一句话生成页面 → 预览 → 一键落到侧边栏；配色/圆角/密度改完即生效；
  客户只需登记一份接口清单即可交给助手调用。详见 [docs/AI-ASSISTANT.md](docs/AI-ASSISTANT.md)

> 数据来自 `src/mock`，**生产构建默认不包含**（演示账号与假数据都不会进包）。
> 演示站构建时设置 `VITE_ENABLE_MOCK=true`；接入真实后端只需配置 `VITE_API_BASE`，页面代码零改动。

## AI 运营助手

顶栏右侧「AI 运营助手」按钮（或 `Ctrl/⌘ + J`）打开右侧全高抽屉（宽度可拖拽并记忆）：

| 你说                              | 它做                                   |
| --------------------------------- | -------------------------------------- |
| 帮我实现一个用户数据统计页面      | 生成页面规格 → 预览 → 一键应用到侧边栏 |
| 把主色改成紫色 / 圆角再大一点     | 改页面主题，即时生效                   |
| 怎么把后端接口交给助手            | 返回三步代码示例                       |
| 助手能调哪些接口 / 查一下用户列表 | 列出并真的调用已登记的接口             |

架构分两层，换 UI 框架或换后端都只动一层：

```
packages/ai-sdk/     纯 TS 内核：PageSpec、工具循环、流式传输、本地降级引擎
apps/admin/src/ai/   装配层：路由、页面库(localStorage)、core/http 执行器
```

- **零代码**：模型只产出可序列化的 `PageSpec`（KPI / 图表 / 表格 / 清单…），
  由唯一一套受控渲染器绘制 —— 不存在任意代码执行，也不会样式失控
- **把后端交给助手**：只改 `apps/admin/src/ai/api-operations.ts`，
  声明 `{ id, method, path, params }` 即可；执行器默认已接到 `core/http`
- **真实 API + 供应商回退链**：浏览器只认同源 `/ai-gateway`，网关按顺序尝试
  `opencode`（有 key）→ `custom`（任意 OpenAI 兼容服务）→ `pollinations`（免密钥兜底）。
  401/402/403/429/5xx 自动换下一家；密钥只在服务端，`VITE_*` 一律不进包。
  **一个密钥都不配也能用**（免密钥通道每 IP 45 秒 1 条，网关据此把工具轮次压到 1）

```bash
# apps/admin/.env.local —— 三选一即可，都配则按上面顺序优先
OPENCODE_API_KEY=oc_sk_xxxxxxxxxxxx   # ① OpenCode 免费档 / Go
# AI_API_KEY=sk-xxxxxxxxxxxx          # ② 任意 OpenAI 兼容服务
# AI_UPSTREAM=https://api.deepseek.com/v1
# AI_PROVIDER=pollinations            # 强制只用某一家（排查用）
```

```bash
pnpm dev                      # 开发服务器（已内置 /ai-gateway 中间件）
pnpm ai:gateway               # 独立网关（生产/自建 BFF 参考实现，默认 8787）
pnpm verify:assistant         # 交互全链路（本地引擎也跑得通）+ 截图
pnpm verify:assistant:llm     # 真实模型链路（断言界面已切到模型）
```

完整说明见 [docs/AI-ASSISTANT.md](docs/AI-ASSISTANT.md) 与文档站 `/guide/assistant`。

## 截图

| 经营概览                                  | 数据分析                                   |
| ----------------------------------------- | ------------------------------------------ |
| ![概览](docs/screenshots/02-overview.png) | ![分析](docs/screenshots/03-analytics.png) |

| 性能监控                                     | 深色模式                                          |
| -------------------------------------------- | ------------------------------------------------- |
| ![监控](docs/screenshots/32-performance.png) | ![深色](docs/screenshots/32-performance-dark.png) |

| 用户管理                               | 订单管理                                |
| -------------------------------------- | --------------------------------------- |
| ![用户](docs/screenshots/04-users.png) | ![订单](docs/screenshots/05-orders.png) |

| 角色权限                               | 数据表格                                |
| -------------------------------------- | --------------------------------------- |
| ![角色](docs/screenshots/07-roles.png) | ![表格](docs/screenshots/09-tables.png) |

| 图表可视化                              | 模板中心                                   |
| --------------------------------------- | ------------------------------------------ |
| ![图表](docs/screenshots/10-charts.png) | ![模板](docs/screenshots/16-templates.png) |

| 系统设置                                  | 深色模式                              |
| ----------------------------------------- | ------------------------------------- |
| ![设置](docs/screenshots/14-settings.png) | ![深色](docs/screenshots/15-dark.png) |

### 模板中心：8 块大屏 + 8 个业务页面骨架

数据大屏（`/templates/screens` 选型，点卡片新标签页打开）：

| 运营大屏                                        | 运维监控墙                                  |
| ----------------------------------------------- | ------------------------------------------- |
| ![大屏](docs/screenshots/21-command-center.png) | ![运维](docs/screenshots/29-screen-ops.png) |
| 极简暗色、Hero 数字 + 7 项 KPI、区域与漏斗      | 主机健康矩阵、QPS/P95 双轴阈值线、告警日志  |

| 财务驾驶舱                                      | 仓储物流大屏                                      |
| ----------------------------------------------- | ------------------------------------------------- |
| ![财务](docs/screenshots/30-screen-finance.png) | ![仓储](docs/screenshots/31-screen-logistics.png) |
| 浅色纸感、预算执行、分部门收支与达成率          | 仓网地图 + 干线流向、出入库、爆仓预警             |

| 城市运行大屏                                 | 生产制造大屏                                          |
| -------------------------------------------- | ----------------------------------------------------- |
| ![城市](docs/screenshots/36-screen-city.png) | ![制造](docs/screenshots/37-screen-manufacturing.png) |
| 网格热力 + 点位详情联动、事件流 hover 暂停   | OEE 仪表、产线联动、工位四态矩阵、安灯呼叫            |

| 大促战报大屏                                     | 智算中心大屏                                    |
| ------------------------------------------------ | ----------------------------------------------- |
| ![大促](docs/screenshots/38-screen-campaign.png) | ![算力](docs/screenshots/39-screen-compute.png) |
| 秒级 GMV 跳动、波次倒计时、品类 PK 与售罄进度    | GPU 卡阵热力 + 单卡详情、Token 吞吐、租户配额   |

业务页面骨架：

| 项目看板                                    | 甘特图排期                                 |
| ------------------------------------------- | ------------------------------------------ |
| ![看板](docs/screenshots/22-kanban.png)     | ![甘特](docs/screenshots/23-gantt.png)     |
| 原生 HTML5 拖拽、列内精确排序、WIP 超限告警 | 今天线自动定位、周/月/季缩放、进度与里程碑 |

| AI 助手对话                            | 工作流设计器                                |
| -------------------------------------- | ------------------------------------------- |
| ![AI](docs/screenshots/24-ai-chat.png) | ![工作流](docs/screenshots/25-workflow.png) |
| 逐字流式渲染、停止生成、引用来源可展开 | DOM 节点 + SVG 贝塞尔连线，拖拽不触发重渲染 |

| 文件管理器                              | 大屏选型页                                           |
| --------------------------------------- | ---------------------------------------------------- |
| ![文件](docs/screenshots/26-files.png)  | ![大屏选型](docs/screenshots/28-screens-gallery.png) |
| 网格/列表双视图、拖拽上传、预览面板联动 | 8 块屏的版式预览（纯 CSS 骨架）+ 深/浅色筛选         |

| 资源与编辑器                                             | 资源与编辑器（深色）                                  |
| -------------------------------------------------------- | ----------------------------------------------------- |
| ![资源与编辑器](docs/screenshots/56-media-workbench.png) | ![深色](docs/screenshots/58-media-workbench-dark.png) |
| 混排素材库 + 资源详情 + 四种编辑器工作台                 | 深色下角标、波形、代码高亮全部跟随设计令牌            |

| 无限画布                                       | 卡片顶部菜单                                        |
| ---------------------------------------------- | --------------------------------------------------- |
| ![无限画布](docs/screenshots/40-canvas.png)    | ![顶部菜单](docs/screenshots/48-canvas-topmenu.png) |
| 自研相机内核 + 视口剔除，1,000 节点 60fps 平移 | AI / 编辑 / 复制 / 锁定 / 编组 / 删除，悬停即现     |

| 卡片底部 AI 输入                         | 编组                                          |
| ---------------------------------------- | --------------------------------------------- |
| ![AI](docs/screenshots/41-canvas-ai.png) | ![编组](docs/screenshots/47-canvas-group.png) |
| 点节点就地展开，流式回答写在卡片里       | 多选 → 底部工具条编组，拖动分组框整组移动     |

## 快速开始

```bash
# Node >= 20.19，pnpm >= 10
pnpm install
pnpm dev          # http://127.0.0.1:5173
```

Windows 一键启动（PowerShell）：

```powershell
cd nexus-admin
pnpm install
pnpm dev
```

演示账号（密码统一 `nexus123`）：

| 账号                 | 角色       | 权限范围                                   |
| -------------------- | ---------- | ------------------------------------------ |
| `admin@nexus.dev`    | 超级管理员 | 全部权限                                   |
| `operator@nexus.dev` | 运营专员   | 用户/订单/内容的读写（无删除、无系统设置） |
| `viewer@nexus.dev`   | 只读访客   | 只读，写操作按钮自动禁用                   |

用不同账号登录，可以直观看到**菜单过滤、路由守卫、按钮禁用**三处同时生效。

```bash
pnpm build        # 生产构建（含类型检查）
pnpm preview      # 预览构建产物
pnpm test         # 单元测试（103 个用例）
pnpm lint         # ESLint
pnpm verify       # typecheck + lint + test
pnpm dev:docs     # 文档站 http://127.0.0.1:5174
pnpm screenshot   # 自动遍历全部路由截图 + 控制台错误检查
pnpm verify:assistant   # AI 助手 8 步全链路验证
pnpm ai:gateway   # 独立 AI 网关（生产 / 自建 BFF 参考）
```

### 目录导航

| 想了解               | 看这里                                                   |
| -------------------- | -------------------------------------------------------- |
| 怎么跑起来           | 本节                                                     |
| 跑起来长什么样       | [docs/screenshots](docs/screenshots)                     |
| 性能数据与实测       | [docs/PERFORMANCE.md](docs/PERFORMANCE.md)               |
| 架构与模块化原理     | 本文件「架构设计」+ [文档站](apps/docs)                  |
| **怎么接自己的后端** | 侧边栏底部「开发指南」→ `/guide/backend`（应用内可交互） |
| **组件长什么样**     | 侧边栏「组件总览」→ `/components/overview`（实时预览）   |
| 组件 API             | `pnpm dev:docs` 后访问 `/components/overview`            |
| 如何接入真实后端     | [apps/docs/guide/backend.md](apps/docs/guide/backend.md) |
| **AI 助手怎么接**    | [docs/AI-ASSISTANT.md](docs/AI-ASSISTANT.md)             |
| 品牌图标与规范       | [brand/README.md](brand/README.md)                       |
| 如何贡献代码         | [CONTRIBUTING.md](CONTRIBUTING.md)                       |

## 架构设计

```
nexus-admin/
├── apps/
│   ├── admin/                     # 后台应用
│   │   ├── src/
│   │   │   ├── core/              # 内核：模块协议 / 路由 / HTTP / 状态 / 权限
│   │   │   │   ├── module.ts      # ★ 模块契约（defineModule / flattenRoute / filterNav）
│   │   │   │   ├── http.ts        # ★ 传输层（拦截器 / 超时 / 统一错误）
│   │   │   │   ├── auth-store.ts  # 登录态 + 权限码
│   │   │   │   ├── ui-store.ts    # 主题 / 密度 / 页签（持久化）
│   │   │   │   └── query-client.ts
│   │   │   ├── modules/           # ★ 业务模块（每个目录自成一体）
│   │   │   │   ├── dashboard/
│   │   │   │   │   ├── module.ts      # 声明导航 + 路由 + 权限
│   │   │   │   │   └── pages/*.tsx
│   │   │   │   ├── business/
│   │   │   │   ├── organization/
│   │   │   │   ├── components/
│   │   │   │   ├── system/
│   │   │   │   ├── templates/         # ★ 模板中心（8 块大屏 + 8 个业务页面骨架）
│   │   │   │   └── registry.ts        # 注册表（新增模块只改这里）
│   │   │   ├── layout/            # 外壳：侧边栏 / 顶栏 / 页签 / 命令面板
│   │   │   ├── ai/                # ★ AI 运营助手装配层（页面库 / 执行器 / 抽屉 / 渲染器）
│   │   │   │   └── api-operations.ts  # ★ 客户唯一需要改的文件：登记后端接口
│   │   │   ├── mock/              # 演示数据层（fetch 拦截）
│   │   │   ├── services/          # 数据访问层（React Query hooks）
│   │   │   └── components/charts/ # ECharts 按需封装
│   └── docs/                      # VitePress 文档站
├── packages/
│   ├── ui/                        # ★ @nexus/ui 零依赖组件库
│   │   └── src/
│   │       ├── components/        # 50+ 组件（含 media/ 资源与编辑器子目录）
│   │       ├── lib/               # hooks / 工具函数
│   │       └── styles/tokens.css  # 设计令牌（CSS 变量）
│   └── ai-sdk/                    # ★ @nexus/ai-sdk 助手内核（纯 TS，零 React 依赖）
│       └── src/
│           ├── types.ts           # 消息 / 工具 / 事件 / 传输契约
│           ├── page-spec.ts       # PageSpec 契约 + 归一化 + 内置模板
│           ├── transport.ts       # OpenAI 兼容流式传输（含工具调用分片累积）
│           ├── tools.ts           # 内置工具（生成/调整/应用/接口）
│           ├── planner.ts         # 本地降级引擎（无模型密钥也可用）
│           └── assistant.ts       # 工具循环 + 订阅 + 接口注册表
└── scripts/                       # 截图 / 构建 / AI 网关 / 验收脚本
```

### 一句话理解模块化

```ts
// src/modules/business/module.ts
export const businessModule = defineModule({
  id: 'business',
  title: '业务管理',
  order: 20,
  nav: [
    {
      key: 'users',
      title: '用户管理',
      path: '/business/users',
      icon: Users,
      permission: 'user:read',
    },
  ],
  routes: [
    {
      path: '/business/users',
      component: () => import('./pages/users-page'),
      permission: 'user:read',
    },
  ],
})
```

注册到 `src/modules/registry.ts` 后：

- ✅ 侧边栏自动出现「业务管理 → 用户管理」
- ✅ 路由自动挂载并**按需懒加载**（独立 chunk）
- ✅ 无权限用户看不到菜单，**直接访问 URL 也会被守卫拦截**（`beforeLoad` 校验同一权限码，跳 403 并说明缺什么权限）
- ✅ 命令面板（⌘K）可搜到该页面
- ✅ 面包屑、多页签、文档目录表自动同步

### 性能设计

| 场景       | 方案                                                         | 效果                          |
| ---------- | ------------------------------------------------------------ | ----------------------------- |
| 首屏体积   | 路由级 `lazyRouteComponent` + 模块独立 chunk                 | 首页只加载概览相关代码        |
| chunk 分组 | `manualChunks`：charts / icons / react / tanstack / vendor   | 请求数 154 → 103，碎片 64 → 5 |
| 图表库     | 空闲时（`requestIdleCallback`）拉取 + 按需注册 7 图表 9 组件 | 不与 react/router 抢首屏带宽  |
| 万行表格   | 自研窗口化虚拟滚动（约 27 行/帧）                            | 5,000 行实测 60 fps           |
| 主题切换   | CSS 变量 + `index.html` 内联脚本预置                         | 无闪白、布局零重渲染          |
| 列表请求   | React Query `staleTime 30s` + 搜索防抖 300ms + 取消在途请求  | 往返不闪屏、打字不刷接口      |
| 弹层       | Portal + 焦点陷阱 + 滚动锁                                   | 不触发父级重排                |
| 组件橱窗   | IntersectionObserver 进视口才渲染 demo                       | 移动端 TBT 5,144ms → 0ms      |
| AI 助手    | 抽屉 `lazy()` + 入口按钮零 SDK 依赖                          | 每页少 2 个请求 / 11 kB gzip  |
| 英文词典   | `en.ts` 动态 import，`useI18n` 订阅版本号                    | 入口 gzip 73 → 33.7 kB        |
| 数字滚动   | `useMotionEnabled()` 统一开关 + rAF 插值                     | 关动效时零动画开销            |
| RUM        | 零依赖 LCP/INP/CLS + `sendBeacon` 上报                       | 线上劣化可被发现              |

> 说明：ECharts 仅在图表页需要，因此**登录页首屏不含它**；
> 而概览页是登录后的默认落地页，图表会在首帧空闲时加载（约 713 kB / gzip 236 kB）。
> README 早期版本写的「首屏不含 ECharts」只对登录页成立，这里按实测口径修正。

#### 实测数据与对标

完整方法论、16 组 Core Web Vitals、交互压测与开源项目对照见
**[docs/PERFORMANCE.md](docs/PERFORMANCE.md)**；逐项优化清单与归因实验见
**[docs/OPTIMIZATION-BACKLOG.md](docs/OPTIMIZATION-BACKLOG.md)**；服务器配置见
**[docs/DEPLOYMENT-PERF.md](docs/DEPLOYMENT-PERF.md)**。要点：

| 指标                           | 本项目（桌面档）     | 本项目（Slow-4G） | 开源门槛              |
| ------------------------------ | -------------------- | ----------------- | --------------------- |
| 入口 JS（gzip）                | **33.7 kB**          | 同左              | < 200 KB 为上第一梯队 |
| 首屏 preload（gzip）           | **≈150 kB**          | 同左              | —                     |
| LCP                            | **0.17~0.52 s**      | 2.3~4.8 s ❌      | ≤ 2.5 s               |
| TBT                            | **0~73 ms**          | 0~943 ms          | < 200 ms              |
| CLS                            | **0~0.008**          | 0~0.060           | ≤ 0.1                 |
| 万行表格滚动 / 画布拖动 / 大屏 | **59 / 55 / 60 fps** | —                 | ≥ 55 fps 流畅         |
| JS chunk 数 / 碎片（<1 kB）    | **103 / 5**          | 同左              | 碎片越少越好          |

> 桌面端 8 条路由四项指标全优，**入口 chunk 33.7 kB 优于全部对照项**（Vben 62.1 kB）。
> **移动弱网仍不达标**：优化后请求数已从 64~74 降到 32~40、移动 FCP 平均降 1.1s，
> 但 150ms RTT × 32 个请求的物理下限还在 —— 兑现第一梯队需要部署侧开 HTTP/2 + CDN 边缘。

**动效与数字递增**：数字滚动与 CSS 动画读同一个开关 ——
`<html data-motion="full|reduced">` 优先，未设置时跟随 `prefers-reduced-motion`。
主题面板选「始终开启」时，KPI、工作台、8 块大屏、环形指标的数字都会从当前值递增到目标值；
选「减少动效」时直接显示终值，且 `animate-ping/spin/pulse` 也会一并停掉。
实时指标（GMV、QPS）刷新时**从当前读数续滚**，不会每次归零重爬。

```tsx
// 字符串型指标用 ScreenNumber 自动拆：'1,284,600' / '99.99%' / '412 / 448'
<ScreenNumber value="99.99%" duration={1100} />
```

### 主题与设计令牌

所有颜色、圆角、控件高度都来自 CSS 变量，组件只消费语义类名：

```css
:root {
  --n-primary: #0d6efd;
  --n-surface: #ffffff;
  --n-radius: 8px;
  --n-control-h: 34px;
}
.dark {
  --n-surface: #15181f;
}
[data-accent='violet'] {
  --n-primary: #7c3aed;
}
```

```tsx
<button className="h-[var(--n-control-h)] rounded-md bg-primary text-primary-fg">保存</button>
```

支持维度：**3 种主题模式**（浅色/深色/跟随系统）× **10 组配色** × **5 档圆角**（0 / 0.3 / 0.5 / 0.75 / 1.0）× **4 档密度** × **3 种侧栏形态**（贴合/浮动/面板）× **内容宽度**（全宽/居中）× **文字方向**（LTR/RTL）× **动效偏好**（跟随系统/始终开启/减少）。
配置持久化在 `localStorage: nexus-ui-prefs`，首帧由 `index.html` 内联脚本提前应用。

> **关于"日夜切换没有特效"**：很多 Windows 机器关闭了系统"显示动画"（`MinAnimate = 0`），
> Chromium 因此报告 `prefers-reduced-motion: reduce`。本项目已针对性处理：
> 用户**主动点击**的主题切换始终播放扩散动画（时长压到 420ms），
> 同时在主题面板里提供「动效」开关，可显式选择「始终开启」覆盖系统偏好。

### 宽屏适配

字号**固定**（根字号 16px），不做视口等比缩放 —— 这是 Ant Design Pro、shadcn、
GitHub、Linear 一致的选择，原因见 `packages/ui/src/styles/tokens.css` 里 `html` 的注释
（一句话：媒体查询里的 rem 恒按 16px 折算，等比缩放不会让断点跟着走，大屏只会把卡片吹大）。

宽屏靠三件事吃满空间：

1. **内容宽度分级放宽**（`.n-page-shell`）：1440 → 1500 收口，1680 → 1600，
   1920 → 1760，2240 → 2048，2560 → 2200 封顶。实测 1440~2850 之间内容
   始终占可用宽度 84%~88%
2. **宽屏断点** `3xl`(1920) / `4xl`(2560)，页面里直接写 `4xl:grid-cols-6`
3. **容器查询**：卡片内部按自身宽度换行，而不是跟着视口走

## 组件库

`@nexus/ui` —— 50+ 组件，零运行时依赖（仅 peer `react`）。

**应用内组件总览 `/components/overview`** 是 Element Plus 风格的橱窗页：
左侧常驻组件索引（滚动高亮当前分类）、顶部搜索（支持中英文、拼音与 Props 名）、
主体按分类分段，每张卡片都是**真实渲染**的组件，点「用法」可看源码示例与 Props 表。
新增组件只需往 `src/modules/components/gallery/*.tsx` 里加一条声明。

<details>
<summary><b>展开查看组件清单</b></summary>

| 分类     | 组件                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 通用     | Button / ButtonGroup / Card / SectionCard / Badge / StatusDot / CountTag / Tag / Kbd / Avatar / AvatarGroup                                            |
| 表单     | Input / Textarea / FormField / Select（单选/多选/搜索/分组）/ Switch / Checkbox / RadioGroup / Slider / SegmentedControl / Transfer                    |
| 数据展示 | DataTable / VirtualTable / Pagination / TableToolbar / Descriptions / Timeline / Tree / Steps / Collapse / Calendar / Progress / Meter / UploadList    |
| 反馈     | Dialog / ConfirmDialog / Drawer / Toast / Alert / Banner / EmptyState / Skeleton / Spinner / LoadingOverlay                                            |
| 横幅     | HeroBanner（六色调 × soft / glass / solid）/ BannerCard（插画或图标 + 双按钮）                                                                         |
| 动效     | MotionCard（lift / spotlight / tilt / sweep / aurora；指针驱动零重渲染，减少动效即全关）                                                               |
| 资源     | ImagePreview / VideoPreview / AudioPreview / MediaCard / MediaKindBadge（三种资源显示类型 + 混排卡片）                                                 |
| 编辑器   | ImageEditor（比例/旋转/缩放/滤镜）/ TextEditor（Markdown 工具栏 + 实时预览）/ CodeEditor（行号 + 高亮）/ VideoEditor（时间轴 + 拆段）/ EditorWorkbench |
| 导航     | Tabs / SideTabs / Breadcrumb / Dropdown / Tooltip                                                                                                      |
| 布局     | PageHeader / PageContainer / Grid / Stack / Inline / StatCard                                                                                          |
| 工具     | ClipboardText / CopyButton / CodeBlock / HighlightText / SearchInput                                                                                   |
| 画布     | InfiniteCanvas / CanvasNodeFrame / CanvasAIPopover / CanvasMinimap / CanvasControls / edgeGeometry（相机、剔除、连线、节点 AI 对话框）                 |
| Hooks    | useControllableState / useMediaQuery / useBreakpoint / useClickOutside / useElementSize / useLocalStorageState / useCountdown / useHotkey / sx         |

</details>

```tsx
import { Button, DataTable, StatCard, toast } from '@nexus/ui'

<StatCard label="今日订单" value="12,846" delta={8.2} trend={[3, 5, 4, 7]} />
<Button variant="primary" onClick={() => toast.success('保存成功')}>保存</Button>
```

组件特性：

- 受控 / 非受控双支持（`useControllableState`）
- 键盘可达：Dialog 焦点陷阱、Select ↑↓ 导航（含 `aria-activedescendant`）、Tree 完整 WAI-ARIA 键盘导航、Tabs ←→ 切换、Slider 方向键步进
- `FormField` 自动下发 `id` / `aria-describedby` / `aria-invalid` / `aria-required` / `aria-labelledby`，无需手工接线
- 宽表固定列：`pinned: 'left' | 'right'`，纯 `sticky` 实现、不复制 DOM、无固定列时零开销
- 全部跟随设计令牌，深浅色自动适配

## 模板中心

`/templates/*` 下 8 块大屏 + 8 个可直接复用的业务页面骨架（源码在 `apps/admin/src/modules/templates/pages/`）：

数据大屏（`standalone: true` 独立路由，从侧栏以新标签页打开）：

| 模板         | 业务场景        | 关键技术点                                                      |
| ------------ | --------------- | --------------------------------------------------------------- |
| 运营大屏     | 电商 / 增长运营 | Hero 数字 + 7 项 KPI、发丝线分区、地图 / 漏斗 / 商品排行        |
| 运维监控墙   | 运维 / SRE      | 主机健康矩阵（heatmap 格）、QPS/P95 双轴 + 阈值线、告警与日志流 |
| 财务驾驶舱   | 财务 / 经营分析 | 浅色纸感、预算执行、分部门收支与达成率进度                      |
| 仓储物流大屏 | 仓储 / 供应链   | 中国地图 + 干线流向动画、出入库对比、库存告警                   |
| 城市运行大屏 | 政务 / 城市治理 | 8×12 网格热力 + 点位联动、事件流 hover 暂停、处置时效双轴       |
| 生产制造大屏 | 制造 / MES      | OEE 仪表、产线点击联动、棒图按目标分色、工位四态矩阵            |
| 大促战报大屏 | 电商大促 / 直播 | 秒级 GMV 跳动、波次倒计时、雷达同比、售罄进度                   |
| 智算中心大屏 | AI 平台 / 算力  | GPU 卡阵 + 单卡详情、Token 吞吐与队列双轴、租户配额水位         |

八块屏共用 `screen-primitives.tsx`（外壳 / 顶栏 / 分区 / Delta / 迷你条 / 分段控件 / 时钟 / 假实时序列），
配色由各自的 `ScreenTokens` 决定 —— 手感统一但不换皮。

业务页面骨架：

| 模板         | 关键技术点                                                                         |
| ------------ | ---------------------------------------------------------------------------------- |
| 横幅模板     | 区块级版式：6 色调 × 3 模式、插画靠右窄屏收起、slot 自定义内容（详见下节）         |
| 项目看板     | 原生 HTML5 拖拽、列内精确排序、WIP 超限告警                                        |
| 甘特图排期   | CSS Grid + 绝对定位任务条、今天线自动定位、三档缩放                                |
| AI 助手对话  | 逐字流式渲染（cursor 数字驱动）、停止生成、引用来源展开                            |
| 工作流设计器 | DOM 节点 + SVG 贝塞尔连线、拖拽不触发 React 渲染、属性面板联动                     |
| 无限画布     | 自研相机内核 + 视口剔除 + LOD 聚合 + 右键菜单 + 顶部菜单 + 底部 AI 输入 + 多选编组 |
| 文件管理器   | 网格/列表双视图、拖拽上传、文件夹树与预览面板联动                                  |
| 资源与编辑器 | 图片 / 视频 / 音频混排素材库 + 四种编辑器工作台，点资源自动切页签                  |

### 横幅（`/templates/banner` 与 `@nexus/ui` 双入口）

横幅是「一句标题 + 一段说明 + 一个按钮 + 一张插画」的**区块级版式**，
两处入口读同一份实现，区别只在展示目的：

| 入口                   | 内容                                                            |
| ---------------------- | --------------------------------------------------------------- |
| `/templates/banner`    | 成套业务样例（6 个主横幅 + 4 个卡片横幅），可整段复制           |
| `/components/overview` | 「Banner」分类：色调矩阵、模式矩阵、插画 / slot、卡片形态的 API |

- **色调**：6 档全部映射到 `--n-chart-1..6`，自动跟随皮肤、深浅色与强调色
- **模式**：`soft`（15–17% 混色）/ `glass`（6–20% 混色）/ `solid`（实色底，前景转白）
- **插画**：透明底 3D 黏土 PNG 先转 WebP，384px 单张 13–26 KB；窄屏直接收起而不是压扁
- **实际落地**：经营概览页顶部的「欢迎横幅」就是 `HeroBanner`，带用户名、问候语、待办数与目标进度

插画由 `scripts/_gen-banners.py` 调用图片生成接口产出，`scripts/_optimize-banners.py` 转 WebP 并裁边，
产物在 `apps/admin/src/assets/banners/`（两个脚本只在换素材时才需要跑）。

### 资源与编辑器（`/templates/media-workbench`）

资源型后台（素材库、内容中心、剪辑台）最先要用到的两组能力，这一页把它们串成一条链路：

- **三种资源显示类型**：`ImagePreview`（固定比例 + 尺寸胶囊）、`VideoPreview`（封面 + 时长 + 播放态）、
  `AudioPreview`（确定性波形，点击跳转试听）。三者共用 `MEDIA_KIND_META` 的角标文案与语义色，
  列表里混排时不会出现「图片 / IMAGE」两种叫法。
- **四种编辑器**：`ImageEditor`（比例 / 旋转 / 缩放 / 亮度 / 对比度 / 饱和度）、
  `TextEditor`（Markdown 工具栏 + 字数统计 + 实时预览）、`CodeEditor`（行号 + 高亮 + Tab 缩进）、
  `VideoEditor`（时间轴 + 播放头 + 拆分镜头）。参数一律以结构化对象经 `onChange` 写回，组件不假装能导出文件。
- **工作台**：`EditorWorkbench` 把四个编辑器收进一个页签壳，`EDITOR_BY_MEDIA_KIND` 决定「点图片资源默认开哪个页签」。

演示素材（一张 6 秒渐变短片、一条 6 秒环境音、四张 960×600 静帧）由 ffmpeg 的 `gradients` / `sine` 滤镜生成，
合计约 80 KB，产物在 `apps/admin/src/assets/media/`，脚本见 `scripts/_gen-media-assets.mjs` —— 离线可跑、无版权风险。

组件橱窗里对应 **Media 分类（10 个条目）**：三种显示类型、类型角标、资源卡片、四种编辑器与工作台。

新增一块屏只需：页面文件 + `screen-meta.ts` 一条记录 + 列表页一个版式预览分支，侧栏与路由自动生效。

侧边栏按「业务导航 → 演示与示例」两段组织，中间用细分隔线切开：

| 分区                 | 放什么                                     | 交互                                               |
| -------------------- | ------------------------------------------ | -------------------------------------------------- |
| 业务导航（`main`）   | 工作台、业务、组织、系统 —— 每天真正要用的 | 工作台两个入口平铺（`grouped: false`），其余可折叠 |
| 演示与示例（`demo`） | 模板中心、组件示例、异常页 —— 可抄的样板   | 按「解决什么问题」再分二级，折叠状态持久化         |

分区顺序固定为 `main → demo`，不受 `order` 数值影响；分区是模块协议里声明的（`section`），
新增模块只要写一行就能落到正确的那一段。侧栏收起时平铺所有叶子菜单，用一条加宽的细分隔线保留分区感，
而不是只留分组图标。

## 文档

```bash
pnpm dev:docs   # http://127.0.0.1:5174
```

文档站包含：快速开始、目录结构、模块开发指南、权限模型、主题定制、从 Mock 切到真实后端、组件 API。
文档源码在 `apps/docs/`，用 VitePress 构建，可独立部署到 GitHub Pages。

**仓库内的四份专题文档**（都在 `docs/`）：

| 文档                                                    | 内容                                                                    |
| ------------------------------------------------------- | ----------------------------------------------------------------------- |
| [PERFORMANCE.md](docs/PERFORMANCE.md)                   | 性能方法论、16 组 Core Web Vitals、交互压测、开源项目对照、自研程度审计 |
| [OPTIMIZATION-BACKLOG.md](docs/OPTIMIZATION-BACKLOG.md) | 优化项盘点：归因实验（网络 vs CPU）、每项收益与代价、优先级与执行结果   |
| [DEPLOYMENT-PERF.md](docs/DEPLOYMENT-PERF.md)           | 部署侧基线：brotli / cache-control / HTTP2 / RUM 接收端 / CI 性能预算   |
| [AI-ASSISTANT.md](docs/AI-ASSISTANT.md)                 | AI 助手架构、网关回退链、接入自己的接口                                 |

**应用内的「开发指南」**（侧边栏底部入口，`/guide/*`）是同一套知识的可交互版本，
接后端时不用离开后台就能读、能复制代码：

| 页面        | 路径              | 内容                                                                                                  |
| ----------- | ----------------- | ----------------------------------------------------------------------------------------------------- |
| 指南总览    | `/guide/overview` | 一次请求的完整链路、需要知道的文件、推荐上手顺序                                                      |
| 接入后端    | `/guide/backend`  | 11 步完整教程：基地址 / 关 Mock / 鉴权 / 人机验证 / 契约 / 数据层 / 权限 / 错误 / 跨域部署 / 自查清单 |
| 新增模块    | `/guide/module`   | 两个文件加一个模块，含字段速查表                                                                      |
| 接口契约    | `/guide/contract` | 17 个接口的方法、参数、请求体与响应示例，可搜索                                                       |
| AI 助手 SDK | `/guide/ai-sdk`   | `@nexus/ai-sdk` 的 PageSpec 契约、传输层、工具、本地引擎、宿主接入、12 条坑                           |
| 组件库      | `/guide/ui-kit`   | `@nexus/ui` 的目录结构、设计令牌、双模受控、文案注入、无障碍、新增组件三步                            |
| 协作流程    | `/guide/workflow` | 7 步改动闭环、5 道门禁、验收脚本写法、提交与发布清单                                                  |

## 接入真实后端

> 后台应用内有一份带目录、代码复制与自查清单的**完整教程**：启动 `pnpm dev` 后打开
> **侧边栏底部「开发指南」→ 接入后端**（`/guide/backend`）。
> 同一份内容的纯 Markdown 版在 [`apps/docs/guide/backend.md`](apps/docs/guide/backend.md)。

最简三步：

```bash
# 1. 设置接口基地址（apps/admin/.env.local）
#    同源反代写 /api；跨域直接写绝对地址
VITE_API_BASE=https://api.your-domain.com
VITE_ENABLE_MOCK=false          # 生产默认关闭，本地接真后端时显式关
```

```ts
// 2. 把登录接到你的接口（src/main.tsx）—— 其余登录态、请求头、401 都已内置
import { configureAuthAdapter } from './core/auth-store'
import { api } from './core/http'

configureAuthAdapter({
  login: async (email, password, options) => {
    const res = await api.post<{ token: string; user: CurrentUser }>(
      '/auth/login',
      { email, password, 'cf-turnstile-response': options?.captchaToken },
      { anonymous: true },
    )
    return res
  },
})
```

```ts
// 3. 页面代码无需改动 —— 数据层已抽象在 src/services/queries.ts
```

传输层 `src/core/http.ts` 已内置：鉴权头注入、Trace ID、超时中断、`{ code, message, data }` 解包、401 统一登出、错误 toast 去重。需要自定义时注册拦截器即可：

```ts
addRequestInterceptor((config) => ({
  ...config,
  headers: { ...config.headers, 'X-Tenant': tenant },
}))
addErrorHandler((error) => reportToSentry(error))
```

`DEFAULT_BASE_URL` 会真正读取 `VITE_API_BASE`；写绝对地址时请求会保留 host 真正跨域发出（同源前缀则走相对路径，不触发预检）。

### 人机验证（Cloudflare Turnstile）

登录表单自带 Turnstile 组件（site key `0x4AAAAAAF1Fc2tsbu8bVO-a`，前端只负责取一次性票据）：

```tsx
// src/components/turnstile-widget.tsx —— 已经接在登录页上
<TurnstileWidget resetKey={captchaReset} onVerify={setCaptchaToken} />
```

**判定必须在后端**：拿 `cf-turnstile-response` 调 `turnstile/v0/siteverify`，断言
`success` / `action` / `hostname` 三项，失败关闭。绝不能在浏览器里调 —— secret 进包等于公开。
完整代码见 [`apps/docs/guide/backend.md`](apps/docs/guide/backend.md) 的「4. 人机验证」，
或后台内 `/guide/backend`。

> 演示构建（Mock 开启）自动换成官方测试 key（永远通过），因为模板没有后端、
> 票据不会被兑换，用正式 key 会把登录卡在一张永远到不了的票据上；生产构建固定用正式 key。
> 想在本地验证正式 key，需先在 Cloudflare 控制台把 `localhost` / `127.0.0.1`
> 加进该组件的 Hostname Management。

## 兼容性

| 浏览器        | 版本                           |
| ------------- | ------------------------------ |
| Chrome / Edge | ≥ 111（CSS `color-mix`、嵌套） |
| Safari        | ≥ 16.4                         |
| Firefox       | ≥ 121                          |

## 贡献

欢迎 Issue 与 PR。请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。如果是第一次参与开源，可以从 [`good first issue`](https://github.com/CrAckerDrv/nexus-admin/labels/good%20first%20issue) 标签开始。

如果这个模板帮你省下了搭后台的时间，**点个 Star ⭐** 就是最好的支持。

## License

[MIT](LICENSE) © Nexus Admin Contributors
