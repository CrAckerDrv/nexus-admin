/**
 * ECharts 按需注册（静态命名导入，可被 tree-shaking 裁剪）
 *
 * 这个文件只会在图表模块首次渲染时被动态 import，
 * 因此首屏 bundle 不包含 ECharts。
 *
 * 只注册**业务真正用到**的类型
 * ------------------------------
 * 按需注册的收益完全取决于「注册了什么」，所以这里必须和代码对齐，
 * 多注册一个就是白白多下几 kB。核对方式（`scripts/_charts-probe.mjs`）：
 *
 *   图表类型     出现位置
 *   line        概览 / 分析 / 性能 / 大屏 / 指南（大量）
 *   bar         分析 / 大屏 / 组件页（大量）
 *   pie         概览 / 大屏 / AI 生成页（大量）
 *   gauge       分析页 / 制造大屏 / 组件页
 *   radar       分析页 / 战报大屏 / 组件页
 *   funnel      概览页 / 运营大屏
 *   map         运营大屏 / 仓储大屏（配合 `echart-map.ts` 的 china.json）
 *
 * 已被删掉的 4 项（全项目零引用，实测 charts chunk 740.2 → 729.7 kB raw）：
 *   - `HeatmapChart`   性能监控页的「负载热力图」是 CSS grid，不是 ECharts
 *   - `ScatterChart`   无人使用
 *   - `GraphicComponent`   无人使用（`graphic` 只在类型里出现）
 *   - `TransformComponent` 无人使用（数据变换在页面侧的 mock 里完成）
 *
 * 若将来要用散点图 / 热力图，把它们加回 `echarts.use([...])` 即可 ——
 * 但请同时更新这段注释，否则下一个人会以为它们本来就在。
 */
import * as echarts from 'echarts/core'
import {
  BarChart,
  FunnelChart,
  GaugeChart,
  LineChart,
  MapChart,
  PieChart,
  RadarChart,
} from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GaugeChart,
  RadarChart,
  FunnelChart,
  MapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkPointComponent,
  VisualMapComponent,
  CanvasRenderer,
])

export { echarts }
export default echarts
export type { ECharts, EChartsOption } from 'echarts'
