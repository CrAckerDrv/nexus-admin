# 工作流设计器

Workflow 设计器模板：节点拖拽、SVG 贝塞尔连线、右侧属性面板联动。

## 关键实现

节点是真实 DOM（可聚焦、可被读屏识别），拖拽时只写 `style.translate` 不触发 React 渲染，松手才提交坐标。连线用三次贝塞尔，水平出、水平入，符合流程图惯例。

## 复用它

源码：`apps/admin/src/modules/templates/pages/workflow-page.tsx` 

把文件复制到目标模块目录，在 `module.ts` 的 `routes` 里加一行即可。页面只依赖 `@nexus/ui`，没有模块内的私有依赖。

