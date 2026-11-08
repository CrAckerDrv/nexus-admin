# AI 助手对话

AI 对话模板：流式输出、引用来源、停止生成、复制与反馈。

## 关键实现

流式用 `cursor` 数字逐步揭示已有文本，而不是每帧拼接字符串 —— 长回答下不会产生大量中间数组。富文本只支持加粗、行内代码、围栏代码块三种语法，刻意不引入 markdown 库。

## 复用它

源码：`apps/admin/src/modules/templates/pages/ai-chat-page.tsx` 

把文件复制到目标模块目录，在 `module.ts` 的 `routes` 里加一行即可。页面只依赖 `@nexus/ui`，没有模块内的私有依赖。

