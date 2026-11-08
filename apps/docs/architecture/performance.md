# 性能设计

后台系统的性能痛点集中在三处：**首屏体积**、**长列表渲染**、**主题切换抖动**。下面逐项说明取舍。

## 1. 首屏体积

### 路由级代码分割

每个模块页面都是独立 chunk：

```
index-*.js         91 kB     ← 框架与外壳
react-*.js        218 kB     ← React 运行时
router-*.js       110 kB     ← 路由
overview-page-*.js 21 kB     ← 概览页
users-page-*.js    15 kB     ← 用户页
...
charts-*.js      673 kB     ← ECharts（仅在图表页加载）
```

### 图表库按需 + 动态加载

```ts
// echart.tsx
let promise: Promise<CoreModule> | null = null
function loadECharts() {
  promise ??= import('./echart-core') // 首次需要渲染图表时才加载
  return promise
}

// 且等首屏空闲再拉，避免与 react/router 抢带宽
scheduleIdle(() => void loadECharts()) // requestIdleCallback，1.2s 兜底
```

> 早期版本在图表组件挂载时立刻拉取。由于登录后的默认落地页就是概览页，
> 657 kB 的 ECharts 会和 react/router 等关键路径同时下载 —— 现在推迟到首帧空闲后。
>
> 实测（生产构建 + Edge headless）：图表 chunk 的请求起点从 **69ms 推迟到 ~152ms**，
> 让首帧渲染与其它 chunk 先拿到带宽。代价是图表晚 ~80ms 出现，
> 对「打开就看到骨架、随后补图」的观感没有影响。

`echart-core.ts` 精确注册所需模块，未注册的图表类型会被 tree-shaking 剔除：

```ts
echarts.use([LineChart, BarChart, PieChart, GaugeChart, RadarChart, CanvasRenderer, GridComponent, TooltipComponent, ...])
```

删掉 `HeatmapChart`、`ScatterChart` 还能再省一批体积。

### 图标按需导入

`lucide-react` 的具名导入在 Vite 下会被 tree-shaking：

```ts
import { Users, ShoppingCart } from 'lucide-react' // ✅ 只打包这 2 个
import * as icons from 'lucide-react' // ❌ 全量 2000+
```

## 2. 长列表渲染

### 虚拟滚动

`VirtualTable` 只渲染可视区 ±8 行：

```tsx
const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
const endIndex = Math.min(total, startIndex + viewportHeight / rowHeight + overscan * 2)
```

实现要点：

- 外层容器高度设为 `total * rowHeight`，让滚动条长度正确
- 内层 `<table>` 绝对定位到 `startIndex * rowHeight`
- `colgroup` 固定列宽，避免每行重新计算布局

### 为什么不用 `@tanstack/react-virtual`

`VirtualTable` 选择自研，原因：

- 表格场景比通用列表简单（固定行高、无动态测量），自研只需 120 行代码
- 避免多一层依赖与调试成本，也便于读者直接读懂实现

> 既然不用，`@tanstack/react-virtual` 这个依赖已经从 `package.json` 移除 ——
> 依赖表里留着「装了但没引用」的包，会让下一次审计多花时间去确认它到底有没有用。

### 避免在渲染函数里造对象

```tsx
// ❌ 每次渲染都新建 columns，导致 DataTable 内部 memo 失效
<DataTable columns={[...]} />

// ✅
const columns = useMemo(() => [...], [])
<DataTable columns={columns} />
```

## 3. 主题切换

### CSS 变量而非重渲染

```css
.dark {
  --n-surface: #15181f;
}
```

切换主题只是给 `<html>` 加一个 class，**React 组件不会重渲染**。
代价是少量 CSS 变量解析开销，远比 30 个组件的 re-render 便宜。

### 无闪白

`index.html` 内联脚本在首帧前设置 `class="dark"`，详见 [主题与设计令牌](/guide/theming#为什么要规避闪白)。

### 图表跟随主题

图表是命令式库，CSS 变量变了它不知道。解决办法是监听 `<html>` 的属性变化，把令牌解析成具体色值后重新 `setOption`：

```ts
const observer = new MutationObserver(() => setThemeVersion((v) => v + 1))
observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['class', 'data-accent'],
})
```

**实例只在挂载时创建一次**，主题变化仅触发 `setOption(..., { notMerge: true })`。
早期版本在主题变化时 `dispose + init`，异步初始化与清理交错会留下空容器 —— 这条路径已废弃。

真实开销：切主题会让**当前页面上的所有图表全量重绘一次**。
图表少（概览页 3 个）时可以忽略；如果单页有十几个图表，应改为
「每个图表各自订阅主题、并做可见性判断」。

## 4. 弹层

`Dialog` / `Drawer` 使用 `createPortal` 挂载到 `document.body`：

- 避免被父级 `overflow: hidden` 裁剪
- 不参与父组件布局计算
- 打开时锁 `body.overflow`，防止背景滚动

焦点管理：打开时记录 `document.activeElement`，关闭时归还；
Tab 键在弹层内循环，实现焦点陷阱。

## 5. 请求层

| 措施                        | 收益                             |
| --------------------------- | -------------------------------- |
| `staleTime: 30s`            | 路由往返不重复拉取               |
| `placeholderData: prev`     | 翻页不闪骨架                     |
| 关闭 `refetchOnWindowFocus` | 避免切窗口产生请求风暴           |
| 搜索防抖 300ms              | 打字过程中不发请求（防 QPS 放大）|
| 透传 `AbortSignal`          | 参数变化/卸载时中断在途请求      |
| 失败重试指数退避            | 削峰                             |
| 错误 toast 1.2s 去重        | 并发失败不刷屏                   |

## 实测数据

在 1440×900 的 Edge（headless）+ 生产构建（`vite preview`）环境：

| 指标                     | 数值                                        |
| ------------------------ | ------------------------------------------- |
| 登录页首屏传输           | 135 kB JS / 151 kB 总量，5 个请求           |
| 登录后落地概览页累计传输 | 264 kB                                      |
| 5,000 行虚拟表格滚动     | 帧间隔 p50 16.7ms / p95 16.8ms（≈60 fps）   |
| 虚拟表格实际渲染行数     | 27 行（总 5,000 行）                        |

> 数据来自本仓库的 Playwright 探针脚本，非实验室精确基准，仅作相对参考。
> 关于主题切换：布局不重渲染（CSS 变量），但**图表会重绘**，因此不再宣称「0 开销」。
