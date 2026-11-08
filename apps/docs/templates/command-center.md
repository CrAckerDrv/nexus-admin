# 实时运营大屏

Command Center 大屏模板：全深色投屏看板，实时 KPI、SLO 环形指标、服务耗时排行与事件流。

## 关键实现

数据是「假实时」：本地每 2s 推进一个采集点。真实接入时保留初始序列，把定时器换成 WebSocket 消息订阅即可，渲染路径不用改。日志流鼠标悬停会自动暂停，符合值班阅读习惯。

## 复用它

源码：`apps/admin/src/modules/templates/pages/command-center-page.tsx` 

把文件复制到目标模块目录，在 `module.ts` 的 `routes` 里加一行即可。页面只依赖 `@nexus/ui`，没有模块内的私有依赖。

