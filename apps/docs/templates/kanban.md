# 项目看板

Kanban 看板模板：拖拽卡片在列间流转，列头显示 WIP 上限。

## 关键实现

原生 HTML5 拖拽，无第三方 dnd 库。拖拽期间只维护 `dragOverColumn` 与 `dropIndex`，通过落点指示线给出精确插入位置；WIP 超限只告警不阻止。

## 复用它

源码：`apps/admin/src/modules/templates/pages/kanban-page.tsx`

把文件复制到目标模块目录，在 `module.ts` 的 `routes` 里加一行即可。页面只依赖 `@nexus/ui`，没有模块内的私有依赖。
