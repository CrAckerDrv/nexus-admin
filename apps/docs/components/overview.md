# 组件总览

`@nexus/ui` 是一个零运行时依赖的组件库（peer 依赖仅 `react` / `react-dom`）。

## 安装方式

作为 workspace 包直接引用，无需发布：

```json
// apps/admin/package.json
{ "dependencies": { "@nexus/ui": "workspace:*" } }
```

```tsx
import { Button, DataTable, StatCard, toast } from '@nexus/ui'
```

## 设计约定

| 约定     | 说明                                                               |
| -------- | ------------------------------------------------------------------ |
| 样式入口 | 只消费语义类名（`bg-surface` / `text-fg-2` / `border-line`）       |
| 尺寸     | 使用 CSS 变量 `--n-control-h`，跟随全局密度                        |
| 受控     | 同时支持 `value` 与 `defaultValue`（`useControllableState`）       |
| 无障碍   | 交互元素带 `role` / `aria-*` / 键盘支持                            |
| 组合     | 优先小原子（`Card` + `CardHeader`），再提供组合件（`SectionCard`） |

## 组件清单

### 基础

| 组件                               | 说明                                                            |
| ---------------------------------- | --------------------------------------------------------------- |
| `Button`                           | 7 变体 × 7 尺寸，`loading` / `leftIcon` / `rightIcon` / `block` |
| `ButtonGroup`                      | 相邻按钮共享边框                                                |
| `Card` / `SectionCard`             | 卡片容器 / 带标题栏的区块卡片                                   |
| `Badge` / `StatusDot` / `CountTag` | 状态徽标、呼吸圆点、计数                                        |
| `Tag` / `Kbd`                      | 可关闭标签、键盘按键                                            |
| `Avatar` / `AvatarGroup`           | 首字母头像、头像组                                              |

### 表单

| 组件                                 | 说明                                 |
| ------------------------------------ | ------------------------------------ |
| `Input`                              | 尺寸 / 状态 / 前后缀 / 可清除        |
| `Textarea`                           | 字数统计、自动高度                   |
| `FormField`                          | 标签 + 提示 + 错误统一布局           |
| `Select`                             | 单选 / 多选 / 搜索 / 分组 / 键盘导航 |
| `Switch` / `Checkbox` / `RadioGroup` | 三种开关控件（Radio 支持卡片式）     |
| `Slider`                             | 支持刻度、键盘步进                   |
| `SegmentedControl`                   | 紧凑分段切换                         |
| `Transfer`                           | 穿梭框                               |

### 数据展示

| 组件                 | 说明                                       |
| -------------------- | ------------------------------------------ |
| `DataTable`          | 泛型列定义、排序、选择、空态、骨架、固定列 |
| `VirtualTable`       | 虚拟滚动（固定行高）                       |
| `Pagination`         | 页码 + 每页条数                            |
| `TableToolbar`       | 批量操作条                                 |
| `Descriptions`       | 键值对详情列表                             |
| `Timeline`           | 竖向时间线                                 |
| `Tree`               | 树形控件（完整键盘导航）                   |
| `Steps`              | 步骤条（横向/纵向/错误态）                 |
| `Collapse`           | 折叠面板（支持手风琴）                     |
| `Calendar`           | 月视图日历                                 |
| `Progress` / `Meter` | 条形/环形进度、阈值感知                    |
| `UploadList`         | 上传进度列表                               |

### 反馈

| 组件                                      | 说明                                    |
| ----------------------------------------- | --------------------------------------- |
| `Dialog`                                  | 焦点陷阱、ESC 关闭、滚动锁              |
| `ConfirmDialog`                           | 二次确认（危险操作样式）                |
| `Drawer`                                  | 侧滑面板                                |
| `toast` / `Toaster`                       | 命令式调用，`useSyncExternalStore` 驱动 |
| `Alert` / `Banner`                        | 四级语义提示                            |
| `EmptyState`                              | 空态占位                                |
| `Skeleton` / `Spinner` / `LoadingOverlay` | 加载占位                                |

### 横幅与动效

| 组件         | 说明                                                                        |
| ------------ | --------------------------------------------------------------------------- |
| `HeroBanner` | 主横幅：6 色调 × `soft`/`glass`/`solid`，插画靠右、`children` 承载 slot     |
| `BannerCard` | 卡片横幅：图在上、文在下，`image` / `icon` 二选一，`onClick` 给按钮语义     |
| `MotionCard` | 动效卡片：`lift` / `spotlight` / `tilt` / `sweep` / `aurora` 五种低干扰效果 |

```tsx
<HeroBanner
  tone="primary"
  title="欢迎使用 Nexus Admin"
  description="模块化内核 + 零依赖组件库：React 19 / Vite 8 / TypeScript 6 / Tailwind v4"
  actions={<Button size="sm">开始探索</Button>}
/>

<MotionCard effect="spotlight" tone="violet" index={0} onClick={open}>
  本月活跃 128,460
</MotionCard>
```

三条约定：色调全部映射到 `--n-chart-1..6`（跟随皮肤与深浅色）；
指针坐标只写 CSS 变量、不触发 React 渲染；`prefers-reduced-motion` 与
`[data-motion='reduced']` 都会关掉动效，且卡片仍可读、可聚焦。

### 导航与布局

| 组件                           | 说明                            |
| ------------------------------ | ------------------------------- |
| `Tabs` / `SideTabs`            | 标签页 / 侧边导航               |
| `Breadcrumb`                   | 面包屑（自动折叠）              |
| `Dropdown`                     | 下拉菜单（自动翻转 + 键盘导航） |
| `Tooltip`                      | 轻提示                          |
| `PageHeader` / `PageContainer` | 页面头 / 内容容器               |
| `Grid` / `Stack` / `Inline`    | 原子布局                        |
| `StatCard`                     | 指标卡（含 sparkline）          |

### 工具

| 组件                           | 说明                         |
| ------------------------------ | ---------------------------- |
| `ClipboardText` / `CopyButton` | 一键复制                     |
| `CodeBlock`                    | 轻量高亮代码块（演示代码用） |
| `HighlightText`                | 关键词高亮                   |
| `SearchInput`                  | 带清空的搜索框               |
