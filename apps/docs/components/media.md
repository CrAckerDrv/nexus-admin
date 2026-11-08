# 资源与编辑器（Media）

资源型后台（素材库、内容中心、剪辑台）最先要用到的两组能力：**资源显示**与**编辑**。
`@nexus/ui` 把它们收敛到一个 `media/` 子目录，共享 `MediaKind` / `EditKind` 两套枚举。

```tsx
import {
  ImagePreview,
  VideoPreview,
  AudioPreview,
  MediaCard,
  ImageEditor,
  TextEditor,
  CodeEditor,
  VideoEditor,
  EditorWorkbench,
} from '@nexus/ui'
```

## 为什么单独成一个分类

| 分类      | 解决的问题                           |
| --------- | ------------------------------------ |
| Data      | 把结构化的数变成表格 / 树 / 时间轴   |
| Canvas    | 把节点摆在一张无限纸上               |
| **Media** | 把一份二进制资源显示出来并改它的参数 |

三者的输入、状态与交互都不一样。混进 Data 之后，用户搜「图片」会先命中表格里的头像列，
反而找不到真正需要的那个预览器。

## 资源显示类型

三种预览器共用同一套外壳语言：固定比例画布、左上角类型角标、压在下方的半透明元信息胶囊，
加载中是 `n-skeleton` 流光，失败时给一句人话而不是碎图图标。

| 组件             | 关键点                                                                       |
| ---------------- | ---------------------------------------------------------------------------- |
| `ImagePreview`   | `ratio` 固定比例（列表里卡片基线不歪）、`fit` 裁切方式、`sizeLabel` 尺寸胶囊 |
| `VideoPreview`   | 有 `src` 才可播；没有视频源时明确显示「静帧预览」，**不假装在播**            |
| `AudioPreview`   | 确定性波形（种子生成，刷新不换脸）、点击波形任意位置跳转试听                 |
| `MediaCard`      | 三种资源共用一张卡，混排时不会一行高一行低                                   |
| `MediaKindBadge` | `IMAGE` / `VIDEO` / `AUDIO` 三态角标，文案来自 `MEDIA_KIND_META`             |

文案与语义色的唯一来源是 `MEDIA_KIND_META`：`tone`、`accept`、中文名、一句话说明都在里面，
所以「视频」不会在第二个页面被写成「影片」。

```tsx
<ImagePreview src={cover} alt="登录页改版稿" ratio="16:9" sizeLabel="1536 × 1024" />

<VideoPreview src={clip} poster={cover} title="品牌短片" duration={6} shots={['开场', '落定']} />

<AudioPreview src={pad} title="配乐片段" subtitle="环境音" duration={6} seed="ambient" />
```

### 一个容易踩的坑：整卡可点时别再嵌按钮

`MediaCard` 给了 `onClick` 时根节点就是 `role="button"`。这时若内层 `VideoPreview` 仍然渲染
自己的播放按钮，浏览器会对 `<button>` 嵌套 `<button>` 报 HTML 校验错误，两边的事件也会互相抢。
组件已内置处理：`MediaCard` 会把 `interactive={false}` 传给 `VideoPreview`，改为静态播放标识。
自己组合这两个组件时请照做。

## 编辑器

四个编辑器的行为约定完全一致：

1. **左预览、右参数**，窄屏时参数折到下方；
2. 每个编辑器都有「重置」，把全部参数恢复初始值；
3. 参数通过 `onChange` 以**结构化对象**写回，组件不做导出、不做上传；
4. 同时支持 `value` 与 `defaultValue`（内部走 `useControllableState`）。

| 组件          | 能改什么                                                | 实现取舍                                       |
| ------------- | ------------------------------------------------------- | ---------------------------------------------- |
| `ImageEditor` | 比例 / 旋转 / 缩放 / 亮度 / 对比度 / 饱和度             | CSS `transform` + `filter`，即时预览           |
| `TextEditor`  | 标题、列表、引用、加粗、斜体、行内代码（Markdown 记号） | 不用 `contentEditable`：跨浏览器 DOM 太难控    |
| `CodeEditor`  | 行号、语言切换、语法高亮、Tab 缩进                      | 不引 Monaco / CodeMirror，60 行 tokenizer 足够 |
| `VideoEditor` | 时间轴缩放、播放头、出入点、按播放头拆分镜头            | 片段宽度 = 时长占比，缩放只改显示不改数据      |

```tsx
const [edit, setEdit] = useState({ ratio: '16:9', rotate: 0, zoom: 1, brightness: 100 })

<ImageEditor src={cover} alt="改稿" value={edit} onChange={setEdit} />

<TextEditor defaultValue={markdown} onChange={save} split />

<CodeEditor language="ts" onLanguageChange={setLanguage} height={300} />

<VideoEditor clips={clips} duration={6} poster={cover} src={clip} onChange={setClips} />
```

`MarkdownPreview` 单独导出：只要渲染结果、不要编辑区时直接用它。

## 工作台

`EditorWorkbench` 把四个编辑器收进一个页签壳，业务只按 `kind` 返回内容：

```tsx
<EditorWorkbench
  kind={editKind}
  onKindChange={setEditKind}
  render={(kind) =>
    kind === 'image' ? <ImageEditor ... /> :
    kind === 'text'  ? <TextEditor ... /> :
    kind === 'code'  ? <CodeEditor ... /> :
                       <VideoEditor ... />
  }
/>
```

`EDITOR_BY_MEDIA_KIND` 给出「资源类型 → 默认编辑器」的映射：图片开图片编辑、视频开视频编辑，
**音频复用视频编辑**的时间轴（音频没有独立的轨道编辑器，硬造一个只会有两套时间轴口径）。

## 演示素材

`apps/admin/src/assets/media/` 下的短片、静帧与环境音全部由 ffmpeg 滤镜合成（约 80 KB）：

| 文件                          | 规格                                   |
| ----------------------------- | -------------------------------------- |
| `clip-aurora.mp4`             | 640×360 / H.264 crf30 / 6s / 约 29 KB  |
| `clip-aurora-poster.webp`     | 短片首帧，960×600                      |
| `still-studio/warm/mint.webp` | 三张静帧，单张 2.6–3.8 KB                  |
| `ambient-pad.mp3`             | 220 Hz + 轻回声 / 48 kbps / 6s / 36 KB |

换素材后重跑 `node scripts/_gen-media-assets.mjs` 即可（需要 ffmpeg 在 PATH，或设 `FFMPEG_PATH`）。
文件名保持不变，页面与组件都只认 `@/assets/media` 的导出，不认路径。
