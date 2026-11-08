# 资源与编辑器（模板）

`/templates/media-workbench` —— 一条从「资源显示」到「编辑」的完整链路：
左侧混排素材库（图片 / 视频 / 音频共用一张卡），右侧编辑器工作台，点到哪个资源就自动切到对应编辑器。

## 页面结构

```
┌─ 三个资源类型计数（图片 3 / 视频 2 / 音频 2）─────────────────────┐
├─ 左：素材库（19rem）──────────┬─ 右：资源详情 + 编辑工作台 ─────┤
│  筛选 chips + 搜索           │  类型角标 / 版本 / 分组 / 元信息  │
│  MediaCard × 7（混排）        │  原始预览（按类型换组件）        │
│  容量进度                     │  EditorWorkbench（四个页签）     │
└──────────────────────────────┴─────────────────────────────────┘
```

## 关键实现

1. **资源类型决定默认页签**：`select()` 里调 `EDITOR_BY_MEDIA_KIND[asset.kind]`，
   点视频资源直接落到「视频编辑」，仍可手动切到任意编辑器。
2. **一份数据两个视角**：素材库的卡片与编辑器的预览读同一条 `AssetItem`，
   「改完参数回列表」不会出现两份状态打架。
3. **音频复用视频时间轴**：音频没有专属编辑器，`EDITOR_BY_MEDIA_KIND.audio === 'video'`，
   避免两套时间轴口径。
4. **混排不歪**：`MediaCard` 三种类型共用外框，画面区高度由 `ratio` 锁定。

## 组件拆分

页面只做三件事：持有资源清单、决定选哪一个、把编辑器内容按 `kind` 分派。
所有「怎么显示」「怎么编辑」都在 `@nexus/ui` 的 `media/` 子目录里，
换数据源（后台上传 / AI 生成 / 素材市场）时页面不需要改结构。

## 复用它

源码：`apps/admin/src/modules/templates/pages/media-workbench-page.tsx`

依赖：`@nexus/ui` 的 `MediaCard` / `ImagePreview` / `VideoPreview` / `AudioPreview` /
`ImageEditor` / `TextEditor` / `CodeEditor` / `VideoEditor` / `EditorWorkbench`，
素材在 `apps/admin/src/assets/media/`（`node scripts/_gen-media-assets.mjs` 可重新生成）。

把页面文件复制到目标模块目录，在 `module.ts` 的 `routes` 里加一行即可；
素材换成自己的 CDN 地址时，只改 `assets/media/index.ts` 的导出，页面不用动。
