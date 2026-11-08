import { cn } from '@nexus/ui'
import {
  GroupIcon,
  ImageIcon,
  NoteIcon,
  SparkIcon,
  TextIcon,
  VideoIcon,
} from '@nexus/ui'
import type { DemoNodeKind } from '../../canvas-demo/scene-data'

/**
 * 左侧素材库
 *
 * 两段：
 * - 上半是「可新建的节点类型」，点击即在视口中心创建；
 * - 下半是「随手可用的提示」，把画布的交互说清楚（新手第一分钟能看懂）。
 *
 * 之所以不做拖拽入库：从侧栏拖到无限画布需要求「落点随相机移动」，
 * 在触屏与低帧率下体验不稳；点击创建 + 直接拖动节点更可靠。
 */

interface Entry {
  kind: DemoNodeKind
  label: string
  hint: string
  icon: typeof TextIcon
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
}

const ENTRIES: Entry[] = [
  { kind: 'text', label: '文本', hint: '双击编辑正文', icon: TextIcon, tone: 'neutral' },
  { kind: 'image', label: '图片', hint: '程序化生成 / 可替换', icon: ImageIcon, tone: 'primary' },
  { kind: 'video', label: '视频', hint: '镜头卡 + 播放态', icon: VideoIcon, tone: 'info' },
  { kind: 'note', label: '便签', hint: '评审意见、待办', icon: NoteIcon, tone: 'warning' },
  { kind: 'prompt', label: '提示词', hint: '结构化五段式', icon: SparkIcon, tone: 'success' },
  { kind: 'group', label: '分组框', hint: '圈定一个方向', icon: GroupIcon, tone: 'neutral' },
]

const TONE_STYLE: Record<Entry['tone'], string> = {
  primary: 'bg-primary-weak text-primary',
  success: 'bg-success-weak text-success',
  warning: 'bg-warning-weak text-warning',
  danger: 'bg-danger-weak text-danger',
  info: 'bg-info-weak text-info',
  neutral: 'bg-surface-3 text-fg-2',
}

export function CanvasLibrary({ onAdd }: { onAdd: (kind: DemoNodeKind) => void }) {
  return (
    <aside className="flex w-[9.5rem] shrink-0 flex-col gap-2" aria-label="素材库">
      <div className="rounded-lg border border-line bg-surface p-2">
        <p className="mb-1.5 px-1 text-[0.625rem] font-semibold tracking-[0.08em] text-fg-4 uppercase">
          添加节点
        </p>
        <div className="space-y-1">
          {ENTRIES.map((entry) => (
            <button
              key={entry.kind}
              type="button"
              onClick={() => onAdd(entry.kind)}
              className="group flex w-full items-center gap-2 rounded-md border border-transparent px-1.5 py-1.5 text-left transition-colors hover:border-line hover:bg-surface-2"
            >
              <span className={cn('grid size-6 shrink-0 place-items-center rounded-md', TONE_STYLE[entry.tone])}>
                <entry.icon size={13} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.75rem] text-fg-2 group-hover:text-fg">
                  {entry.label}
                </span>
                <span className="block truncate text-[0.5625rem] text-fg-4">{entry.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-line bg-surface p-2">
        <p className="mb-1 px-1 text-[0.625rem] font-semibold tracking-[0.08em] text-fg-4 uppercase">
          上手三步
        </p>
        <ol className="space-y-1 px-1 text-[0.625rem] leading-4 text-fg-3">
          <li>
            <span className="mr-1 font-semibold text-fg-2">1</span>拖空白处平移，滚轮缩放
          </li>
          <li>
            <span className="mr-1 font-semibold text-fg-2">2</span>点节点 → 打开 AI 对话框
          </li>
          <li>
            <span className="mr-1 font-semibold text-fg-2">3</span>从节点边上的圆点拖出连线
          </li>
        </ol>
      </div>
    </aside>
  )
}
