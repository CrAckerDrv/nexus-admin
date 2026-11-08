import { useState } from 'react'
import {
  AudioPreview,
  Badge,
  Button,
  CodeEditor,
  DEFAULT_TEXT_EDIT,
  EditorWorkbench,
  ImageEditor,
  ImagePreview,
  MediaCard,
  MediaKindBadge,
  Tabs,
  TextEditor,
  VideoEditor,
  VideoPreview,
} from '@nexus/ui'
import { MEDIA_IMAGES, MEDIA_SOURCES } from '@/assets/media'
import type { EditKind, MediaKind, VideoClip } from '@nexus/ui'
import type { GalleryCategory } from './types'

/* ================================================================== *
 * 资源显示与编辑器（Media）
 *
 * 这一组是「资源类后台」绕不开的九件套：
 * 图片 / 视频 / 音频三种显示类型，加上图片 / 文本 / 代码 / 视频四种编辑器。
 *
 * 为什么单独成类而不是塞进 Data 或 Canvas：
 * Data 是「把结构化的数变成表」，Canvas 是「把节点摆在一张无限纸上」，
 * 而这一组是「把一份二进制资源显示出来并改它的参数」——
 * 三类问题的输入、状态与交互都不一样，混在一起会让索引失去检索价值。
 * ================================================================== */

/* ------------------------------ 图片显示 ------------------------------ */

function ImagePreviewDemo() {
  const [ratio, setRatio] = useState('16:9')
  const [fit, setFit] = useState<'cover' | 'contain'>('cover')
  return (
    <div className="w-full space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          size="sm"
          variant="pill"
          value={ratio}
          onChange={setRatio}
          items={[
            { key: '16:9', label: '16:9' },
            { key: '4:3', label: '4:3' },
            { key: '1:1', label: '1:1' },
          ]}
        />
        <Button
          size="xs"
          variant="ghost"
          onClick={() => setFit((value) => (value === 'cover' ? 'contain' : 'cover'))}
        >
          fit = {fit}
        </Button>
      </div>
      <ImagePreview
        src={MEDIA_IMAGES.studio}
        alt="登录页改版稿"
        ratio={ratio}
        fit={fit}
        sizeLabel="1536 × 1024"
        className="max-w-[26rem]"
      />
    </div>
  )
}

function VideoPreviewDemo() {
  const [playing, setPlaying] = useState(false)
  return (
    <div className="w-full space-y-2">
      <VideoPreview
        src={MEDIA_SOURCES.video}
        poster={MEDIA_IMAGES.aurora}
        title="品牌短片 · 30s 成片"
        duration={6}
        shots={['空镜开场', '人的动作特写', '产品落定']}
        className="max-w-[26rem]"
        onPlayStateChange={setPlaying}
      />
      <p className="text-2xs text-fg-3">
        真实视频源，点击即可播放 · 当前状态：
        <span className="ml-1 font-mono text-fg-2">{playing ? 'playing' : 'paused'}</span>
      </p>
    </div>
  )
}

function AudioPreviewDemo() {
  const [seed, setSeed] = useState('ambient')
  return (
    <div className="w-full space-y-2.5">
      <AudioPreview
        src={MEDIA_SOURCES.audio}
        title="配乐片段 · ambient-pad.mp3"
        subtitle="环境音"
        duration={6}
        seed={seed}
        className="max-w-[26rem]"
      />
      <div className="flex items-center gap-2">
        <Button size="xs" variant="secondary" onClick={() => setSeed(String(Date.now()))}>
          换一条波形
        </Button>
        <span className="text-2xs text-fg-4">波形由种子生成，点击任意位置可跳转试听</span>
      </div>
    </div>
  )
}

function MediaKindBadgeDemo() {
  const kinds: MediaKind[] = ['image', 'video', 'audio']
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {kinds.map((kind) => (
          <MediaKindBadge key={kind} kind={kind} size="md" />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {kinds.map((kind) => (
          <Badge key={kind} tone="neutral" variant="soft">
            {kind}
          </Badge>
        ))}
      </div>
    </div>
  )
}

function MediaCardDemo() {
  const [selected, setSelected] = useState('image')
  return (
    <div className="grid w-full grid-cols-3 gap-2">
      <MediaCard
        kind="image"
        title="登录页改版稿.png"
        src={MEDIA_IMAGES.studio}
        meta="4.8 MB · 1536 × 1024"
        selected={selected === 'image'}
        onClick={() => setSelected('image')}
      />
      <MediaCard
        kind="video"
        title="产品演示录屏.mp4"
        src={MEDIA_IMAGES.aurora}
        videoSrc={MEDIA_SOURCES.video}
        duration={6}
        selected={selected === 'video'}
        onClick={() => setSelected('video')}
      />
      <MediaCard
        kind="audio"
        title="配乐片段.mp3"
        src={MEDIA_SOURCES.audio}
        subtitle="环境音 · 00:06"
        selected={selected === 'audio'}
        onClick={() => setSelected('audio')}
      />
    </div>
  )
}

/* ------------------------------ 图片编辑 ------------------------------ */

function ImageEditorDemo() {
  const [zoom, setZoom] = useState(1)
  return (
    <div className="w-full space-y-2">
      <ImageEditor
        src={MEDIA_IMAGES.studio}
        alt="登录页改版稿"
        onChange={(next) => setZoom(next.zoom)}
      />
      <p className="text-2xs text-fg-3">
        比例 / 旋转 / 缩放 / 亮度 / 对比度 / 饱和度都会即时作用在预览上，当前缩放{' '}
        <span className="font-mono text-fg-2">{zoom.toFixed(2)}×</span>
      </p>
    </div>
  )
}

/* ------------------------------ 文本编辑 ------------------------------ */

function TextEditorDemo() {
  const [preview, setPreview] = useState(false)
  return (
    <div className="w-full space-y-2">
      <Tabs
        size="sm"
        variant="pill"
        value={preview ? 'preview' : 'edit'}
        onChange={(key) => setPreview(key === 'preview')}
        items={[
          { key: 'edit', label: '编辑 + 预览' },
          { key: 'preview', label: '仅预览' },
        ]}
      />
      <TextEditor defaultValue={DEFAULT_TEXT_EDIT.slice(0, 320)} readOnlyPreview={preview} />
    </div>
  )
}

/* ------------------------------ 代码编辑 ------------------------------ */

function CodeEditorDemo() {
  const [language, setLanguage] = useState('ts')
  return <CodeEditor language={language} onLanguageChange={setLanguage} height={260} />
}

/* ------------------------------ 视频编辑 ------------------------------ */

const DEMO_CLIPS: VideoClip[] = [
  { id: 'c1', label: '开场', start: 0, end: 2.4, tone: 'primary' },
  { id: 'c2', label: '主体', start: 2.4, end: 5.2, tone: 'info' },
  { id: 'c3', label: '落定', start: 5.2, end: 6, tone: 'warning' },
]

function VideoEditorDemo() {
  return (
    <VideoEditor
      clips={DEMO_CLIPS}
      duration={6}
      poster={MEDIA_IMAGES.aurora}
      src={MEDIA_SOURCES.video}
    />
  )
}

/* ------------------------------ 工作台 ------------------------------ */

function EditorWorkbenchDemo() {
  const [kind, setKind] = useState<EditKind>('image')
  return (
    <EditorWorkbench
      kind={kind}
      onKindChange={setKind}
      footer={
        <p className="flex flex-wrap items-center gap-2 text-2xs text-fg-3">
          <span>当前编辑：</span>
          <span className="font-mono text-fg-2">{kind}</span>
          <span className="ml-auto">四个页签共用同一份资源</span>
        </p>
      }
      render={(current) =>
        current === 'image' ? (
          <ImageEditor src={MEDIA_IMAGES.warm} alt="成品图" />
        ) : current === 'text' ? (
          <TextEditor defaultValue={DEFAULT_TEXT_EDIT.slice(0, 240)} />
        ) : current === 'code' ? (
          <CodeEditor language="ts" height={240} />
        ) : (
          <VideoEditor
            clips={DEMO_CLIPS}
            duration={6}
            poster={MEDIA_IMAGES.aurora}
            src={MEDIA_SOURCES.video}
          />
        )
      }
    />
  )
}

/* ------------------------------ 分类清单 ------------------------------ */

export const mediaCategory: GalleryCategory = {
  id: 'media',
  name: 'Media',
  title: '资源与编辑器',
  description: '图片 / 视频 / 音频的显示类型，以及图片、文本、代码、视频四种编辑器',
  items: [
    {
      key: 'image-preview',
      name: 'ImagePreview',
      nameZh: '图片显示',
      summary: '固定比例 + 类型角标 + 尺寸胶囊，加载中流光、失败给人话',
      demo: ImagePreviewDemo,
      wide: true,
      previewHeight: 220,
      keywords: ['tupian', 'image', 'preview', '缩略图'],
      code: `<ImagePreview
  src={cover}
  alt="登录页改版稿"
  ratio="16:9"
  sizeLabel="1536 × 1024"
  fit="cover"
/>`,
      props: [
        { name: 'src / alt', type: 'string', desc: '图片地址与替代文本（alt 必填）' },
        {
          name: 'ratio',
          type: "string，如 '16:9'",
          default: "'16:9'",
          desc: '画面比例，非法值退回 16:9',
        },
        { name: 'fit', type: "'cover' | 'contain'", default: "'cover'", desc: '裁切方式' },
        { name: 'sizeLabel', type: 'string', desc: '右下角尺寸胶囊（分辨率 / 文件大小）' },
        { name: 'selected', type: 'boolean', desc: '选中态：主色描边 + 焦点环' },
      ],
    },
    {
      key: 'video-preview',
      name: 'VideoPreview',
      nameZh: '视频显示',
      summary: '封面 + 时长 + 播放态；无视频源时明示「静帧预览」而不是假装在播',
      demo: VideoPreviewDemo,
      wide: true,
      previewHeight: 230,
      keywords: ['shipin', 'video', 'player', '播放器'],
      code: `<VideoPreview
  src={clip}
  poster={cover}
  title="品牌短片 · 30s 成片"
  duration={6}
  shots={['空镜开场', '人的动作特写']}
/>`,
      props: [
        { name: 'src / poster', type: 'string', desc: '视频源与封面（src 缺省时只做静帧展示）' },
        { name: 'duration', type: 'number', desc: '时长（秒），显示为 00:06' },
        { name: 'shots', type: 'string[]', desc: '分镜说明，压在画面底部' },
        { name: 'ratio', type: 'string', default: "'16:9'", desc: '画面比例' },
        { name: 'onPlayStateChange', type: '(playing: boolean) => void', desc: '播放状态回调' },
      ],
    },
    {
      key: 'audio-preview',
      name: 'AudioPreview',
      nameZh: '音频显示',
      summary: '确定性波形 + 可点击跳转的进度，不需要 FFT 也能一眼看出「这是一段音频」',
      demo: AudioPreviewDemo,
      wide: true,
      previewHeight: 150,
      keywords: ['yinpin', 'audio', 'waveform', '波形'],
      code: `<AudioPreview
  src={pad}
  title="配乐片段 · ambient-pad.mp3"
  subtitle="环境音"
  duration={6}
  seed="ambient"
/>`,
      props: [
        { name: 'src', type: 'string', desc: '音频源；缺省时只有 UI 状态，不发声' },
        { name: 'duration', type: 'number', desc: '时长（秒）' },
        { name: 'seed', type: 'string', desc: '波形种子：同种子同形状，刷新不换脸' },
        { name: 'bars', type: 'number', default: '44', desc: '波形柱数量' },
        { name: 'onProgress', type: '(ratio: number) => void', desc: '进度回调（0~1）' },
      ],
    },
    {
      key: 'media-kind-badge',
      name: 'MediaKindBadge',
      nameZh: '资源类型角标',
      summary: 'IMAGE / VIDEO / AUDIO 三态，与 MEDIA_KIND_META 共用一份文案与语义色',
      demo: MediaKindBadgeDemo,
      previewHeight: 130,
      keywords: ['jiaobiao', 'badge', 'kind', '资源类型'],
      code: `<MediaKindBadge kind="image" />
<MediaKindBadge kind="video" size="md" />
<MediaKindBadge kind="audio" />`,
      props: [
        { name: 'kind', type: "'image' | 'video' | 'audio'", desc: '资源显示类型' },
        { name: 'size', type: "'sm' | 'md'", default: "'sm'", desc: '尺寸' },
      ],
    },
    {
      key: 'media-card',
      name: 'MediaCard',
      nameZh: '资源卡片',
      summary: '三种资源共用一张卡：混排时基线不歪，选中态与点击态一致',
      demo: MediaCardDemo,
      wide: true,
      previewHeight: 250,
      keywords: ['ziyuan ka', 'asset card', '媒体卡片'],
      code: `<MediaCard
  kind="video"
  title="产品演示录屏.mp4"
  src={cover}
  videoSrc={clip}
  duration={6}
  selected={selected === 'video'}
  onClick={() => setSelected('video')}
/>`,
      props: [
        { name: 'kind', type: "'image' | 'video' | 'audio'", desc: '资源显示类型（必填）' },
        { name: 'title / meta', type: 'string', desc: '标题与元信息' },
        { name: 'src / videoSrc', type: 'string', desc: '封面与视频源' },
        { name: 'selected / onClick', type: 'boolean / () => void', desc: '选中态与点击' },
      ],
    },
    {
      key: 'image-editor',
      name: 'ImageEditor',
      nameZh: '图片编辑',
      summary: '比例 / 旋转 / 缩放 / 亮度 / 对比度 / 饱和度，参数结构化写回',
      demo: ImageEditorDemo,
      wide: true,
      previewHeight: 340,
      keywords: ['图片编辑', 'image edit', '裁剪', '裁切', '滤镜'],
      code: `<ImageEditor
  src={cover}
  alt="登录页改版稿"
  defaultValue={{ ratio: '16:9', rotate: 0, zoom: 1, brightness: 100, contrast: 100, saturation: 100 }}
  onChange={(next) => save(next)}
/>`,
      props: [
        { name: 'src / alt', type: 'string', desc: '预览图与替代文本' },
        {
          name: 'value / defaultValue',
          type: '{ ratio; rotate; zoom; brightness; contrast; saturation }',
          desc: '受控 / 非受控参数',
        },
        { name: 'onChange', type: '(value: ImageEditValue) => void', desc: '参数写回' },
      ],
    },
    {
      key: 'text-editor',
      name: 'TextEditor',
      nameZh: '文本编辑',
      summary: 'Markdown 工具栏 + 字数统计 + 实时预览；⌘B / ⌘I、Tab 缩进都有',
      demo: TextEditorDemo,
      wide: true,
      previewHeight: 340,
      keywords: ['文本编辑', 'text edit', 'markdown', '富文本', '编辑器'],
      code: `<TextEditor
  defaultValue={DEFAULT_TEXT_EDIT}
  onChange={(markdown) => save(markdown)}
  split
/>
// 只要渲染结果
<MarkdownPreview text={markdown} />`,
      props: [
        { name: 'value / defaultValue', type: 'string', desc: 'Markdown 文本' },
        { name: 'onChange', type: '(value: string) => void', desc: '内容写回' },
        { name: 'split', type: 'boolean', default: 'true', desc: '编辑与预览并排（窄屏自动堆叠）' },
        { name: 'readOnlyPreview', type: 'boolean', desc: '只渲染预览，不显示编辑区' },
      ],
    },
    {
      key: 'code-editor',
      name: 'CodeEditor',
      nameZh: '代码编辑',
      summary: '行号 + 语言切换 + 语法高亮 + Tab 缩进，零编辑器依赖的轻量实现',
      demo: CodeEditorDemo,
      wide: true,
      previewHeight: 320,
      keywords: ['代码编辑', 'code edit', 'editor', '高亮', '行号'],
      code: `<CodeEditor
  language="ts"
  onLanguageChange={setLanguage}
  onChange={(source) => setSource(source)}
  height={300}
/>`,
      props: [
        {
          name: 'language',
          type: 'string',
          default: "'ts'",
          desc: '内置 ts / json / css 三种样例',
        },
        { name: 'value / defaultValue', type: 'string', desc: '源码' },
        { name: 'onLanguageChange / onChange', type: '(v) => void', desc: '语言与内容回调' },
        { name: 'height', type: 'number', default: '300', desc: '编辑区高度（px）' },
      ],
    },
    {
      key: 'video-editor',
      name: 'VideoEditor',
      nameZh: '视频编辑',
      summary: '时间轴、播放头、出入点与拆段；片段宽度随时长占比自适应',
      demo: VideoEditorDemo,
      wide: true,
      previewHeight: 360,
      keywords: ['视频编辑', 'video edit', 'timeline', '时间轴', '剪辑'],
      code: `const clips: VideoClip[] = [
  { id: 'c1', label: '开场', start: 0, end: 2.4 },
  { id: 'c2', label: '主体', start: 2.4, end: 5.2 },
]

<VideoEditor clips={clips} duration={6} poster={cover} src={clip} />`,
      props: [
        { name: 'clips', type: 'VideoClip[]', desc: '片段（必填）：id / label / start / end' },
        { name: 'duration', type: 'number', desc: '总时长（秒）' },
        { name: 'poster / src', type: 'string', desc: '封面与视频源' },
        { name: 'value / onChange', type: 'VideoClip[] / (clips) => void', desc: '受控拆分结果' },
      ],
    },
    {
      key: 'editor-workbench',
      name: 'EditorWorkbench',
      nameZh: '编辑器工作台',
      summary: '把四种编辑器收进一个页签壳，业务只按 kind 返回内容',
      demo: EditorWorkbenchDemo,
      wide: true,
      previewHeight: 420,
      keywords: ['gongzuotai', 'workbench', 'tabs', '工作台'],
      code: `<EditorWorkbench
  defaultKind="image"
  render={(kind) =>
    kind === 'image' ? <ImageEditor ... /> :
    kind === 'text'  ? <TextEditor ... /> :
    kind === 'code'  ? <CodeEditor ... /> :
                       <VideoEditor ... />
  }
/>`,
      props: [
        {
          name: 'defaultKind',
          type: "'image' | 'text' | 'code' | 'video'",
          default: "'image'",
          desc: '默认页签',
        },
        { name: 'kinds', type: 'EditKind[]', desc: '要展示的页签（默认四种全开）' },
        { name: 'render', type: '(kind: EditKind) => ReactNode', desc: '按页签渲染内容（必填）' },
        { name: 'footer', type: 'ReactNode', desc: '底部说明 / 操作区' },
      ],
    },
  ],
}
