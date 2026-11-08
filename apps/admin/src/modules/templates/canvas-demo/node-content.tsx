import { memo, useMemo, useState } from 'react'
import {
  CanvasAIDock,
  CanvasInlineEdit,
  CanvasNodeFrame,
  CanvasNodeStatus,
  CanvasNodeToolbar,
  CanvasNodeCheck,
  cn,
} from '@nexus/ui'
import type { CanvasNodeRenderContext, CanvasNodeToolbarItem } from '@nexus/ui'
import {
  CopyIcon,
  GroupIcon,
  ImageIcon,
  LockIcon,
  NoteIcon,
  PauseIcon,
  PlayIcon,
  SparkIcon,
  TextIcon,
  TrashIcon,
  UndoIcon,
  UnlockIcon,
  VideoIcon,
} from '@nexus/ui'
import { aiSuggestions, nodeContent, type DemoNode, type DemoNodeKind } from './scene-data'

/**
 * 演示页的节点内容
 *
 * 这一层只关心「节点长什么样」，位置/选中/拖拽全部由画布组件负责。
 * 所有类型都套同一套 `CanvasNodeFrame`，保证：
 * - 标题栏高度一致（并排时基线齐）；
 * - 顶部菜单、底部 AI 输入区、选中光环的行为一致；
 * - LOD（极小尺寸只画色块）在各类型上表现一致。
 *
 * 两个关键交互（本页的「卡片级」差异点）：
 * 1. **顶部菜单**：hover / 选中时盖住标题栏，AI、编辑、复制、锁定、层级、编组、删除都在这里；
 * 2. **底部 AI 输入**：点节点即在该卡片底部展开输入框，回答就地显示，
 *    不遮挡别的节点，也不用浮层跟着相机跑。
 */

const KIND_META: Record<
  DemoNodeKind,
  {
    label: string
    icon: typeof TextIcon
    tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  }
> = {
  text: { label: 'TEXT', icon: TextIcon, tone: 'neutral' },
  image: { label: 'IMAGE', icon: ImageIcon, tone: 'primary' },
  video: { label: 'VIDEO', icon: VideoIcon, tone: 'info' },
  note: { label: 'NOTE', icon: NoteIcon, tone: 'warning' },
  prompt: { label: 'PROMPT', icon: SparkIcon, tone: 'success' },
  group: { label: 'GROUP', icon: GroupIcon, tone: 'neutral' },
}

export interface DemoNodeViewProps {
  node: DemoNode
  context: CanvasNodeRenderContext
  /** 正在就地编辑正文 */
  editing: boolean
  /** 该节点的 AI 输入区是否展开 */
  aiOpen: boolean
  /** 是否处于「所在分组被激活/高亮」状态 */
  grouped: boolean
  onRequestAI: () => void
  onCloseAI: () => void
  onAIApply: (text: string) => void
  onAICreateChild: (text: string) => void
  onStartEdit: () => void
  onCommitEdit: (value: string) => void
  onCancelEdit: () => void
  onDuplicate: () => void
  onToggleLock: () => void
  onBringToFront: () => void
  onGroup: () => void
  onUngroup: () => void
  onDelete: () => void
}

export const DemoNodeView = memo(function DemoNodeView({
  node,
  context,
  editing,
  aiOpen,
  grouped,
  onRequestAI,
  onCloseAI,
  onAIApply,
  onAICreateChild,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onDuplicate,
  onToggleLock,
  onBringToFront,
  onGroup,
  onUngroup,
  onDelete,
}: DemoNodeViewProps) {
  const meta = KIND_META[node.kind]
  const Icon = meta.icon
  const tone = node.data.tone ?? meta.tone
  const isGroup = node.kind === 'group'

  const topMenuItems = useMemo<CanvasNodeToolbarItem[]>(() => {
    if (isGroup) {
      return [
        { key: 'ungroup', label: '解组', icon: <UndoIcon size={11} />, wide: true, onClick: onUngroup },
        { key: 'front', label: '置于顶层', icon: <GroupIcon size={11} />, onClick: onBringToFront },
        { key: 'delete', label: '删除分组', icon: <TrashIcon size={11} />, danger: true, onClick: onDelete },
      ]
    }
    return [
      { key: 'ai', label: 'AI', icon: <SparkIcon size={11} />, wide: true, onClick: onRequestAI, active: aiOpen },
      { key: 'edit', label: '编辑内容', icon: <TextIcon size={11} />, onClick: onStartEdit },
      { key: 'duplicate', label: '创建副本', icon: <CopyIcon size={11} />, onClick: onDuplicate },
      {
        key: 'lock',
        label: node.locked ? '解除锁定' : '锁定位置',
        icon: node.locked ? <UnlockIcon size={11} /> : <LockIcon size={11} />,
        onClick: onToggleLock,
        active: node.locked,
      },
      { key: 'front', label: '置于顶层', icon: <GroupIcon size={11} />, onClick: onBringToFront },
      {
        key: 'group',
        label: node.groupId ? '解组' : '编组',
        icon: node.groupId ? <UndoIcon size={11} /> : <GroupIcon size={11} />,
        onClick: node.groupId ? onUngroup : onGroup,
      },
      { key: 'delete', label: '删除节点', icon: <TrashIcon size={11} />, danger: true, onClick: onDelete },
    ]
  }, [
    aiOpen,
    isGroup,
    node.groupId,
    node.locked,
    onBringToFront,
    onDelete,
    onDuplicate,
    onGroup,
    onRequestAI,
    onStartEdit,
    onToggleLock,
    onUngroup,
  ])

  return (
    <CanvasNodeFrame
      kind={node.kind}
      title={node.title}
      badge={isGroup ? undefined : meta.label}
      icon={<Icon size={11} />}
      tone={tone}
      selected={context.selected}
      dragging={context.dragging}
      locked={node.locked}
      size={{ width: node.width, height: node.height }}
      zoom={context.settledZoom}
      contentClassName={cn('relative', isGroup && 'n-canvas-group', grouped && 'is-active')}
      footer={renderFooter(node)}
      topMenu={<CanvasNodeToolbar items={topMenuItems} />}
      dock={
        isGroup ? null : (
          <CanvasAIDock
            open={aiOpen}
            nodeTitle={node.title}
            nodeKind={node.kind}
            nodeKindLabel={meta.label}
            tone={tone}
            content={nodeContent(node)}
            suggestions={aiSuggestions(node.kind)}
            compact={node.height < 200 || context.settledZoom < 0.6}
            onApply={onAIApply}
            onCreateChild={onAICreateChild}
            onDoubleClickBody={onStartEdit}
            onClose={onCloseAI}
          />
        )
      }
    >
      {isGroup ? (
        <GroupContent node={node} />
      ) : editing ? (
        <CanvasInlineEdit
          value={node.data.text ?? ''}
          placeholder="输入内容，Esc 取消"
          multiline
          onSubmit={onCommitEdit}
          onCancel={onCancelEdit}
        />
      ) : node.kind === 'text' || node.kind === 'note' || node.kind === 'prompt' ? (
        <TextContent node={node} onStartEdit={onStartEdit} />
      ) : node.kind === 'image' ? (
        <ImageContent node={node} tone={meta.tone} />
      ) : (
        <VideoContent node={node} />
      )}


    </CanvasNodeFrame>
  )
})

/* ------------------------------------------------------------------ *
 * 各类内容
 * ------------------------------------------------------------------ */

const TextContent = memo(function TextContent({
  node,
  onStartEdit,
}: {
  node: DemoNode
  onStartEdit: () => void
}) {
  const isPrompt = node.kind === 'prompt'
  return (
    <div
      className="size-full overflow-y-auto px-2.5 py-2"
      onDoubleClick={(event) => {
        event.stopPropagation()
        onStartEdit()
      }}
    >
      <p
        className={cn(
          'whitespace-pre-wrap text-[0.75rem] leading-5 text-fg-2',
          isPrompt && 'font-mono text-[0.6875rem] leading-[1.15rem] text-fg-2',
        )}
      >
        {node.data.text || <span className="text-fg-4">双击编辑内容…</span>}
      </p>
    </div>
  )
})

const ImageContent = memo(function ImageContent({
  node,
  tone,
}: {
  node: DemoNode
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
}) {
  const [loaded, setLoaded] = useState(false)
  const src = node.data.asset?.src

  return (
    <div className="relative size-full overflow-hidden">
      {!loaded && <div className="n-canvas-skeleton absolute inset-0" aria-hidden="true" />}
      {src && (
        <img
          src={src}
          alt={node.title}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          className={cn(
            'size-full object-cover transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
      {/* 底部元信息条：比例与来源，用毛玻璃压住画面 */}
      {node.data.asset?.ratio && (
        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/45 px-1.5 py-0.5 text-[0.5625rem] text-white/90 backdrop-blur-sm">
          {node.data.asset.ratio}
        </span>
      )}
      {node.data.status === 'busy' && (
        <span className="absolute top-1.5 right-1.5">
          <CanvasNodeStatus tone={tone}>生成中</CanvasNodeStatus>
        </span>
      )}
    </div>
  )
})

const VideoContent = memo(function VideoContent({ node }: { node: DemoNode }) {
  const [playing, setPlaying] = useState(false)
  const duration = node.data.asset?.duration ?? 0
  const hasVideo = Boolean(node.data.asset?.video)

  const shots = useMemo(() => node.data.shots ?? [], [node.data.shots])

  return (
    <div className="relative size-full overflow-hidden">
      {node.data.asset?.src && (
        <img
          src={node.data.asset.src}
          alt={node.title}
          loading="lazy"
          draggable={false}
          className="size-full object-cover"
        />
      )}

      {/* 播放态：真实视频不可用时用「封面 + 脉冲」表达，避免假装有视频 */}
      <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/55 via-transparent to-black/10 p-2">
        <div className="flex items-center gap-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[0.5625rem] text-white/90 backdrop-blur-sm">
            <span className={cn('size-1.5 rounded-full', playing ? 'bg-success' : 'bg-white/70')} />
            {playing ? '播放中' : hasVideo ? '就绪' : '静帧预览'}
          </span>
          <span className="rounded-full bg-black/45 px-1.5 py-0.5 text-[0.5625rem] text-white/90 tabular-nums backdrop-blur-sm">
            {duration.toFixed(1)}s
          </span>
        </div>

        <div className="flex items-end justify-between gap-2">
          <p className="line-clamp-2 flex-1 text-[0.625rem] leading-4 text-white/85">
            {shots.join(' · ')}
          </p>
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              setPlaying((value) => !value)
            }}
            aria-label={playing ? '暂停预览' : '播放预览'}
            className="grid size-7 shrink-0 place-items-center rounded-full bg-white/90 text-black shadow-sm transition-transform hover:scale-105"
          >
            {playing ? <PauseIcon size={11} /> : <PlayIcon size={11} />}
          </button>
        </div>
      </div>

      {/* 进度条：只有「播放中」才推进，纯粹表达状态，不假装有解码 */}
      <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white/20" aria-hidden="true">
        <span
          className="block h-full bg-white/80 transition-[width] duration-700 ease-out"
          style={{ width: playing ? '68%' : '4%' }}
        />
      </span>
    </div>
  )
})

const GroupContent = memo(function GroupContent({ node }: { node: DemoNode }) {
  const count = node.data.memberCount ?? 0
  return (
    <div className="relative size-full">
      <p className="absolute top-1 right-2 flex items-center gap-1 text-[0.625rem] text-fg-4">
        {count > 0 && (
          <span className="rounded-full bg-primary-weak px-1.5 text-[0.5625rem] font-medium text-primary tabular-nums">
            {count} 个成员
          </span>
        )}
        {node.data.subtitle}
      </p>
    </div>
  )
})

/* ------------------------------------------------------------------ *
 * 页脚
 * ------------------------------------------------------------------ */

function renderFooter(node: DemoNode) {
  if (node.kind === 'group') {
    return (
      <>
        <GroupIcon size={10} />
        <span>拖动分组可整体移动成员</span>
      </>
    )
  }
  const author = node.data.author
  const time = node.data.createdAt
  if (!author && !time) {
    if (node.kind === 'image') return <span>{node.data.asset?.ratio ?? '参考图'}</span>
    if (node.kind === 'video') return <span>{`${(node.data.shots ?? []).length} 个分镜`}</span>
    return null
  }
  return (
    <>
      <span className="truncate">{author}</span>
      {time && <span className="ml-auto tabular-nums">{time}</span>}
    </>
  )
}

/** 供演示页复用的「已应用」提示 */
export function AppliedHint({ text }: { text: string }) {
  return <CanvasNodeCheck>{text}</CanvasNodeCheck>
}
