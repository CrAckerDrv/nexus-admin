# 甘特图排期

Gantt 排期模板：跨月任务排期，今天线自动定位、周/月/季三档缩放、里程碑与状态着色。

## 关键实现

用 CSS Grid + 绝对定位实现，不用 canvas。任务条宽度按「天 × 缩放列宽」计算，Padding 与网格线同源，所以缩放切换时不会错位。

## 复用它

源码：`apps/admin/src/modules/templates/pages/gantt-page.tsx` 

把文件复制到目标模块目录，在 `module.ts` 的 `routes` 里加一行即可。页面只依赖 `@nexus/ui`，没有模块内的私有依赖。

