# 图表封装

图表部分位于 `apps/admin/src/components/charts`，属于**应用层**而非组件库——
这样 `@nexus/ui` 可以保持零依赖（不含 ECharts）。

## 使用

```tsx
import { EChart } from '@/components/charts/echart'

;<EChart
  height={320}
  loading={isLoading}
  option={{
    grid: { left: 8, right: 12, top: 24, bottom: 4, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: dates },
    yAxis: { type: 'value' },
    series: [{ type: 'line', smooth: 0.35, areaStyle: { opacity: 0.15 }, data: values }],
  }}
/>
```

## 内置能力

| 能力     | 说明                                                 |
| -------- | ---------------------------------------------------- |
| 按需加载 | `echarts/core` 动态 import，首屏不含图表代码         |
| 主题联动 | 监听 `<html>` 的 `class` / `data-accent`，自动换色板 |
| 自适应   | `ResizeObserver` 触发 `resize()`，缩放窗口不变形     |
| 清理     | 组件卸载时 `dispose()`，不泄漏实例                   |
| 加载态   | `loading` 使用 ECharts 原生 loading 遮罩             |

## 主题令牌

`readThemeTokens()` 从 CSS 变量读取当前色板：

```ts
const tokens = readThemeTokens()
// { fg, fg2, fg3, grid, surface, chart: [6 个颜色] }
```

`buildOption()` 会把它合并进你的 option（深合并，数组整体替换）：

```ts
{
  color: tokens.chart,
  textStyle: { color: tokens.fg2 },
  tooltip: { backgroundColor: tokens.surface, borderColor: tokens.grid, textStyle: { color: tokens.fg } },
}
```

因此你只需要写与数据相关的 option，配色自动跟随主题。

## 注册的图表与组件

`echart-core.ts`：

```ts
echarts.use([
  // 图表
  LineChart,
  BarChart,
  PieChart,
  GaugeChart,
  RadarChart,
  HeatmapChart,
  ScatterChart,
  // 组件
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkPointComponent,
  GraphicComponent,
  TransformComponent,
  // 渲染器
  CanvasRenderer,
])
```

要减体积，删掉不用的图表类型即可（例如不做热力图就移除 `HeatmapChart`）。

## 常见 chart 配方

### 双轴折线

```ts
yAxis: [
  { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
  { type: 'value', splitLine: { show: false } },
],
series: [
  { name: '交易额', type: 'line', smooth: 0.35, areaStyle: { opacity: 0.14 }, data: revenue },
  { name: '订单量', type: 'line', yAxisIndex: 1, lineStyle: { type: 'dashed' }, data: orders },
]
```

### 环形占比

```ts
series: [
  {
    type: 'pie',
    radius: ['52%', '76%'],
    padAngle: 2,
    itemStyle: { borderRadius: 4 },
    label: { show: false },
    data: channels,
  },
]
```

### 漏斗

ECharts 的漏斗图在深色模式下观感一般，模板用**横向条形**模拟：

```ts
yAxis: { type: 'category', data: stages, axisLine: { show: false } },
series: [{
  type: 'bar',
  barWidth: 14,
  showBackground: true,
  backgroundStyle: { color: 'var(--n-surface-3)', borderRadius: 7 },
  itemStyle: { borderRadius: 7 },
  data: values,
}]
```

### 仪表盘

```ts
series: [
  {
    type: 'gauge',
    startAngle: 210,
    endAngle: -30,
    progress: { show: true, width: 12, roundCap: true },
    axisLine: { lineStyle: { width: 12, color: [[1, 'var(--n-surface-3)']] } },
    detail: { fontSize: 26, offsetCenter: [0, '32%'], formatter: '{value}%' },
    data: [{ value: 92.4, name: '本月 SLA' }],
  },
]
```

## 联动（多图）

```tsx
<EChart group="dashboard" option={optionA} />
<EChart group="dashboard" option={optionB} />
```

同组的图表 tooltip 与 `dataZoom` 会联动。

## 大屏/大数据量注意

- 超过 5,000 个点请开启 `large: true`（散点/折线内置性能模式）
- 时间跨度大时用 `dataZoom` 而不是压缩数据
- 动画在数据频繁刷新时建议关闭：`animation: false`
