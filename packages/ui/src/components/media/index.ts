/**
 * 资源与编辑器组件
 *
 * 分成三组导出：
 * - 资源显示：`ImagePreview` / `VideoPreview` / `AudioPreview` / `MediaCard` / `MediaKindBadge`
 * - 编辑器：`ImageEditor` / `TextEditor` / `CodeEditor` / `VideoEditor`（+ `EditorWorkbench`）
 * - 协议：`MEDIA_KIND_META` / `EDIT_KIND_META` / 时长与波形工具
 *
 * 之所以收敛到一个子目录而不是散在 `components/*.tsx`：
 * 这 10 个组件共享 `MediaKind` / `EditKind` 两套枚举与角标口径，
 * 散开之后「视频」的角标文案很容易在第二个页面里被写成另一种叫法。
 */
export {
  MEDIA_KIND_META,
  EDIT_KIND_META,
  EDITOR_BY_MEDIA_KIND,
  formatDuration,
  formatPreciseDuration,
  seedWaveform,
  clampRatio,
} from './types'
export type { MediaKind, MediaTone, MediaKindMeta, EditKind, EditKindMeta } from './types'

export { ImagePreview, VideoPreview, AudioPreview, MediaCard, MediaKindBadge } from './preview'
export type {
  ImagePreviewProps,
  VideoPreviewProps,
  AudioPreviewProps,
  MediaCardProps,
} from './preview'

export {
  ImageEditor,
  TextEditor,
  CodeEditor,
  VideoEditor,
  EditorWorkbench,
  MarkdownPreview,
  DEFAULT_IMAGE_EDIT,
  DEFAULT_TEXT_EDIT,
} from './editors'
export type {
  ImageEditValue,
  ImageEditorProps,
  TextEditorProps,
  CodeEditorProps,
  VideoClip,
  VideoEditorProps,
  EditorWorkbenchProps,
} from './editors'
