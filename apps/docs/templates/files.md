# 文件管理器

File Manager 模板：网格 / 列表双视图、拖拽上传、文件夹树与预览面板。

## 关键实现

拖拽上传用 `dragCounter` 计数避免子元素进出导致的闪烁。两种视图共用同一份数据，切换只改渲染路径，不重新取数。

## 复用它

源码：`apps/admin/src/modules/templates/pages/files-page.tsx` 

把文件复制到目标模块目录，在 `module.ts` 的 `routes` 里加一行即可。页面只依赖 `@nexus/ui`，没有模块内的私有依赖。

