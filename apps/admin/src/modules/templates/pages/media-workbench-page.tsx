import { useMemo, useState } from 'react'
import { Images, Music4, Plus, Search, Video, Wand2 } from 'lucide-react'
import {
  AudioPreview,
  Badge,
  Button,
  CodeEditor,
  DEFAULT_TEXT_EDIT,
  EDIT_KIND_META,
  EDITOR_BY_MEDIA_KIND,
  EditorWorkbench,
  EmptyState,
  ImageEditor,
  ImagePreview,
  MEDIA_KIND_META,
  MediaCard,
  MediaKindBadge,
  PageContainer,
  PageHeader,
  Progress,
  SearchInput,
  TextEditor,
  VideoEditor,
  VideoPreview,
  cn,
  formatDuration,
  toast,
} from '@nexus/ui'
import { MEDIA_IMAGES, MEDIA_SOURCES } from '@/assets/media'
import type { EditKind, MediaKind, VideoClip } from '@nexus/ui'

/**
 * 资源工作台 · 模板中心
 *
 * 一页打通「资源显示 → 选中 → 编辑」的完整链路：
 * 左侧是混排的素材库（图片 / 视频 / 音频共用一张卡），
 * 右侧是编辑器工作台，点到哪个资源就自动切到对应的编辑器。
 *
 * 两个刻意的设计：
 * 1. **资源与编辑器分离**：编辑器不认识「资源列表」，
 *    只接收 src / clips 这些原始数据；换一个数据源（后台上传、AI 生成）照样能用。
 * 2. **同一份数据两个视角**：列表里的卡片和编辑器的预览读的是同一条记录，
 *    所以「改完参数回列表」不会出现两份状态打架。
 */

type KindFilter = 'all' | MediaKind

interface AssetItem {
  id: string
  kind: MediaKind
  title: string
  /** 图片 / 视频封面 */
  src?: string
  /** 视频源 */
  videoSrc?: string
  /** 音频源 */
  audioSrc?: string
  /** 列表里的元信息 */
  meta: string
  duration?: number
  /** 归属分组 */
  folder: string
  /** 版本号：AI 生成场景里同一个资源会迭代很多版 */
  version: number
}

const ASSETS: AssetItem[] = [
  {
    id: 'a1',
    kind: 'image',
    title: '登录页改版稿',
    src: MEDIA_IMAGES.studio,
    meta: '4.8 MB · 1536 × 1024',
    folder: '设计交付物',
    version: 3,
  },
  {
    id: 'a2',
    kind: 'image',
    title: '大促主视觉',
    src: MEDIA_IMAGES.warm,
    meta: '2.6 MB · 1920 × 1080',
    folder: '运营素材',
    version: 7,
  },
  {
    id: 'a3',
    kind: 'image',
    title: '数据看板头图',
    src: MEDIA_IMAGES.mint,
    meta: '1.9 MB · 1600 × 1000',
    folder: '运营素材',
    version: 2,
  },
  {
    id: 'a4',
    kind: 'video',
    title: '品牌短片 · 30s 成片',
    src: MEDIA_IMAGES.aurora,
    videoSrc: MEDIA_SOURCES.video,
    meta: '34 KB · 640 × 360 · 00:06',
    duration: 6,
    folder: '视频成品',
    version: 4,
  },
  {
    id: 'a5',
    kind: 'video',
    title: '产品演示录屏',
    src: MEDIA_IMAGES.aurora,
    videoSrc: MEDIA_SOURCES.video,
    meta: '268 MB · 1920 × 1080 · 00:06',
    duration: 6,
    folder: '视频成品',
    version: 1,
  },
  {
    id: 'a6',
    kind: 'audio',
    title: '配乐片段 · ambient-pad',
    src: MEDIA_SOURCES.audio,
    audioSrc: MEDIA_SOURCES.audio,
    meta: '36 KB · 48 kbps · 00:06',
    duration: 6,
    folder: '配乐与音效',
    version: 2,
  },
  {
    id: 'a7',
    kind: 'audio',
    title: '片头音效 · riser',
    src: MEDIA_SOURCES.audio,
    audioSrc: MEDIA_SOURCES.audio,
    meta: '12 KB · 64 kbps · 00:02',
    duration: 2,
    folder: '配乐与音效',
    version: 1,
  },
]

const KIND_TABS: Array<{ key: KindFilter; label: string; icon: typeof Images }> = [
  { key: 'all', label: '全部', icon: Images },
  { key: 'image', label: '图片', icon: Images },
  { key: 'video', label: '视频', icon: Video },
  { key: 'audio', label: '音频', icon: Music4 },
]

const CLIPS: VideoClip[] = [
  { id: 'c1', label: '开场', start: 0, end: 2.4, tone: 'primary' },
  { id: 'c2', label: '主体', start: 2.4, end: 5.2, tone: 'info' },
  { id: 'c3', label: '落定', start: 5.2, end: 6, tone: 'warning' },
]

export default function MediaWorkbenchPage() {
  const [filter, setFilter] = useState<KindFilter>('all')
  const [keyword, setKeyword] = useState('')
  const [selectedId, setSelectedId] = useState('a1')
  const [editKind, setEditKind] = useState<EditKind>('image')

  const selected = ASSETS.find((asset) => asset.id === selectedId) ?? ASSETS[0]!

  const visible = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    return ASSETS.filter((asset) => {
      if (filter !== 'all' && asset.kind !== filter) return false
      if (!query) return true
      return `${asset.title}${asset.folder}${MEDIA_KIND_META[asset.kind].label}`
        .toLowerCase()
        .includes(query)
    })
  }, [filter, keyword])

  /** 选中资源时自动切到它的主编辑器（音频没有专属编辑器，用时间轴那一套） */
  const select = (asset: AssetItem) => {
    setSelectedId(asset.id)
    setEditKind(EDITOR_BY_MEDIA_KIND[asset.kind])
  }

  const counts = useMemo(
    () => ({
      image: ASSETS.filter((asset) => asset.kind === 'image').length,
      video: ASSETS.filter((asset) => asset.kind === 'video').length,
      audio: ASSETS.filter((asset) => asset.kind === 'audio').length,
    }),
    [],
  )

  return (
    <PageContainer size="full">
      <PageHeader
        title="资源与编辑器"
        description="图片 / 视频 / 音频三种显示类型 + 图片、文本、代码、视频四种编辑器，点资源即切换编辑面板"
        badge={<Badge tone="primary">Media</Badge>}
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Wand2 className="size-3.5" />}
              onClick={() => toast.info('演示环境：接入 AI 生成接口后可用')}
            >
              AI 生成素材
            </Button>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Plus className="size-3.5" />}
              onClick={() => toast.info('演示环境：接入上传接口后可用')}
            >
              上传资源
            </Button>
          </>
        }
      />

      {/* 三个显示类型各自的数量，和组件橱窗里的角标口径一致 */}
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(['image', 'video', 'audio'] as MediaKind[]).map((kind) => {
          const meta = MEDIA_KIND_META[kind]
          const Icon = kind === 'image' ? Images : kind === 'video' ? Video : Music4
          return (
            <button
              key={kind}
              type="button"
              onClick={() => setFilter(kind)}
              aria-pressed={filter === kind}
              className={cn(
                'flex items-center gap-3 rounded-lg border bg-surface px-3 py-2.5 text-left transition-[border-color,box-shadow]',
                filter === kind
                  ? 'border-primary/50 shadow-sm ring-2 ring-primary-ring'
                  : 'border-line hover:border-line-strong hover:shadow-sm',
              )}
            >
              <span
                className="grid size-9 shrink-0 place-items-center rounded-md"
                style={{
                  background: `color-mix(in oklab, var(--n-${meta.tone}) 14%, transparent)`,
                  color: `var(--n-${meta.tone})`,
                }}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="text-[0.8125rem] font-medium text-fg">{meta.label}</span>
                  <span className="font-mono text-[0.625rem] text-fg-4">{meta.en}</span>
                </span>
                <span className="mt-0.5 block truncate text-2xs text-fg-3">{meta.hint}</span>
              </span>
              <span className="ml-auto font-mono text-sm font-semibold text-fg tabular-nums">
                {counts[kind]}
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[19rem_minmax(0,1fr)]">
        {/* ---------------- 左：素材库 ---------------- */}
        <div className="flex min-h-0 flex-col rounded-lg border border-line bg-surface">
          <div className="flex flex-wrap items-center gap-1 border-b border-line px-2 py-1.5">
            {KIND_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                aria-pressed={filter === tab.key}
                className={cn(
                  // whitespace-nowrap：19rem 的窄列里「全部 / 图片」会被折成两行
                  'inline-flex h-6 shrink-0 items-center gap-1 rounded-sm px-2 text-2xs font-medium whitespace-nowrap transition-colors',
                  filter === tab.key
                    ? 'bg-primary-weak text-primary'
                    : 'text-fg-3 hover:bg-surface-2 hover:text-fg',
                )}
              >
                {tab.label}
              </button>
            ))}
            <SearchInput
              value={keyword}
              onChange={setKeyword}
              placeholder="搜索"
              size="sm"
              className="ml-auto w-[7rem] shrink"
            />
          </div>

          <div className="max-h-[34rem] overflow-y-auto p-2">
            {visible.length === 0 ? (
              <EmptyState
                size="sm"
                title="没有匹配的资源"
                description="换个关键词，或切回「全部」"
                action={
                  <Button size="xs" variant="secondary" onClick={() => setKeyword('')}>
                    清空搜索
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {visible.map((asset) => (
                  <MediaCard
                    key={asset.id}
                    kind={asset.kind}
                    title={asset.title}
                    src={asset.src}
                    videoSrc={asset.videoSrc}
                    meta={asset.meta}
                    duration={asset.duration}
                    selected={asset.id === selectedId}
                    onClick={() => select(asset)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-line px-3 py-2">
            <div className="mb-1 flex items-center justify-between text-2xs text-fg-3">
              <span>素材库容量</span>
              <span className="tabular-nums">6.4 / 20 GB</span>
            </div>
            <Progress value={32} size="xs" tone="primary" />
          </div>
        </div>

        {/* ---------------- 右：详情 + 编辑器 ---------------- */}
        <div className="min-w-0 space-y-3">
          {/* 资源详情头 */}
          <div className="flex flex-wrap items-start gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <MediaKindBadge kind={selected.kind} />
                <span className="truncate text-[0.8125rem] font-medium text-fg">
                  {selected.title}
                </span>
                <Badge tone="neutral" variant="outline" size="sm">
                  v{selected.version}
                </Badge>
              </span>
              <span className="mt-1 block truncate text-2xs text-fg-3">
                {selected.folder} · {selected.meta}
                {selected.duration ? ` · 时长 ${formatDuration(selected.duration)}` : ''}
              </span>
            </span>
            <span className="flex items-center gap-2">
              {(['image', 'video', 'audio'] as MediaKind[]).map((kind) => (
                <span
                  key={kind}
                  className={cn(
                    'font-mono text-[0.625rem]',
                    kind === selected.kind ? 'text-primary' : 'text-fg-4',
                  )}
                >
                  {MEDIA_KIND_META[kind].en}
                </span>
              ))}
            </span>
          </div>

          {/* 资源原始预览：编辑器之外先看一眼纯净的显示效果 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {selected.kind === 'image' && (
              <ImagePreview
                src={selected.src}
                alt={selected.title}
                ratio="16:9"
                sizeLabel="1536 × 1024"
              />
            )}
            {selected.kind === 'video' && (
              <VideoPreview
                src={selected.videoSrc}
                poster={selected.src}
                title={selected.title}
                duration={selected.duration ?? 0}
                shots={CLIPS.map((clip) => clip.label)}
              />
            )}
            {selected.kind === 'audio' && (
              <AudioPreview
                src={selected.audioSrc}
                title={selected.title}
                subtitle={selected.folder}
                duration={selected.duration ?? 0}
              />
            )}

            <div className="rounded-lg border border-line bg-surface-2/40 px-3 py-2.5">
              <p className="text-2xs font-medium tracking-wide text-fg-3 uppercase">
                {EDIT_KIND_META[editKind].label}
              </p>
              <p className="mt-1 text-xs leading-5 text-fg-2">{EDIT_KIND_META[editKind].hint}</p>
              <p className="mt-2 flex items-center gap-1.5 text-2xs text-fg-4">
                <Search className="size-3" />
                资源类型决定默认页签，仍可手动切到任意编辑器
              </p>
            </div>
          </div>

          {/* 编辑工作台 */}
          <EditorWorkbench
            kind={editKind}
            onKindChange={setEditKind}
            footer={
              <div className="flex flex-wrap items-center gap-2 text-2xs text-fg-3">
                <span>
                  当前编辑：
                  <span className="font-mono text-fg-2">{editKind}</span>
                </span>
                <span className="text-fg-4">·</span>
                <span>
                  资源：
                  <span className="text-fg-2">{selected.title}</span>
                </span>
                <Button
                  size="xs"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => toast.success(`已保存「${selected.title}」的编辑结果`)}
                >
                  保存到素材库
                </Button>
              </div>
            }
            render={(kind) =>
              kind === 'image' ? (
                <ImageEditor src={selected.src} alt={selected.title} />
              ) : kind === 'text' ? (
                <TextEditor defaultValue={DEFAULT_TEXT_EDIT} />
              ) : kind === 'code' ? (
                <CodeEditor language="ts" height={260} />
              ) : (
                <VideoEditor
                  clips={CLIPS}
                  duration={selected.duration ?? 6}
                  poster={selected.src}
                  src={selected.videoSrc ?? MEDIA_SOURCES.video}
                />
              )
            }
          />
        </div>
      </div>
    </PageContainer>
  )
}
