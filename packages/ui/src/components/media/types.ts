import type { Tone } from '../badge'

/**
 * 资源与编辑器的公共协议
 *
 * 为什么要单独一层 `types.ts`：
 * 图片 / 视频 / 音频的「展示」与「编辑」在业务里总是成对出现
 * （列表里是缩略卡、点开是浏览器、再点编辑进工作台），
 * 把类型、角标文案、时长格式与波形生成收敛到一处，
 * 列表页、工作台、画布节点就不会各自发明一套叫法。
 */

/** 资源显示类型：决定用哪个渲染器、上传框接受什么 MIME */
export type MediaKind = 'image' | 'video' | 'audio'

/** 编辑器类型：资源进入工作台后可以选择的能力 */
export type EditKind = 'image' | 'text' | 'code' | 'video'

/** 与 Badge 共用六种语义色，不另造色板 */
export type MediaTone = Tone

export interface MediaKindMeta {
  /** 中文名 */
  label: string
  /** 角标里的英文短标签（全大写，窄卡片里也放得下） */
  en: string
  /** `<input type="file">` 的 accept */
  accept: string
  /** 语义色（角标、图标底色） */
  tone: MediaTone
  /** 一句话说明 */
  hint: string
}

/**
 * 三种资源显示类型的元数据
 *
 * 角标统一「IMAGE / VIDEO / AUDIO」而不是中文：
 * 卡片窄、且用户对这三个英文词没有认知负担，
 * 中文留给标题与说明，层级更清楚。
 */
export const MEDIA_KIND_META: Record<MediaKind, MediaKindMeta> = {
  image: {
    label: '图片',
    en: 'IMAGE',
    accept: 'image/*',
    tone: 'primary',
    hint: '静态图，可裁剪、旋转与调色',
  },
  video: {
    label: '视频',
    en: 'VIDEO',
    accept: 'video/*',
    tone: 'info',
    hint: '封面 + 时长，可裁出入点与拆分镜头',
  },
  audio: {
    label: '音频',
    en: 'AUDIO',
    accept: 'audio/*',
    tone: 'success',
    hint: '波形进度，点击任意位置试听',
  },
}

export interface EditKindMeta {
  label: string
  en: string
  tone: MediaTone
  hint: string
}

/** 四种编辑器的元数据（工作台的页签与侧栏说明共用） */
export const EDIT_KIND_META: Record<EditKind, EditKindMeta> = {
  image: { label: '图片编辑', en: 'IMAGE EDIT', tone: 'primary', hint: '比例、旋转、缩放与滤镜' },
  text: { label: '文本编辑', en: 'TEXT EDIT', tone: 'warning', hint: '工具栏、字数统计与实时预览' },
  code: { label: '代码编辑', en: 'CODE EDIT', tone: 'info', hint: '行号、语法高亮与缩进' },
  video: { label: '视频编辑', en: 'VIDEO EDIT', tone: 'danger', hint: '时间轴、出入点与镜头拆分' },
}

/** 资源类型 → 对应可用的编辑器（工作台自动切换页签用） */
export const EDITOR_BY_MEDIA_KIND: Record<MediaKind, EditKind> = {
  image: 'image',
  video: 'video',
  audio: 'video',
}

/** 00:06 —— 时间轴、时长角标用；非有限值按 0 处理 */
export function formatDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  const total = Math.floor(safe)
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

/** 00:04.6 —— 剪辑点需要 0.1s 精度，用这个 */
export function formatPreciseDuration(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0)
  const minutes = Math.floor(safe / 60)
  const rest = safe - minutes * 60
  return `${String(minutes).padStart(2, '0')}:${rest.toFixed(1).padStart(4, '0')}`
}

/**
 * 由字符串种子生成的确定性波形（0.12 ~ 1）
 *
 * 不请求音频、不做 FFT：演示只需要「看起来像音频」的包络，
 * 同一 src 永远得到同一条波形，刷新不会换形状。
 * 两端收窄、中间隆起 —— 真实语音/音乐的包络大约就是这样。
 */
export function seedWaveform(seed: string, count = 44): number[] {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash ^ seed.charCodeAt(index)) * 16777619
  }
  let state = Math.abs(hash) % 2147483647 || 1
  const bars: number[] = []
  for (let index = 0; index < count; index += 1) {
    state = (state * 16807) % 2147483647
    const noise = (state - 1) / 2147483646
    const envelope = 0.34 + 0.66 * Math.sin((Math.PI * (index + 0.5)) / count)
    bars.push(Math.max(0.12, Math.min(1, 0.22 + noise * envelope * 0.9)))
  }
  return bars
}

/** 把 0~1 的进度夹紧（滑块与波形共用） */
export function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}
