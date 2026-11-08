import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { cn, clamp } from '../../lib/utils'
import { useControllableState } from '../../lib/hooks'
import { Badge } from '../badge'
import { Button } from '../button'
import { Slider } from '../slider'
import { Tabs } from '../tabs'
import { formatPreciseDuration, type EditKind } from './types'

/* ------------------------------------------------------------------ *
 * 编辑器四件套
 *
 * 共同约定（四个编辑器严格一致，用户从图片切到视频不用重新学）：
 * 1. **左预览、右属性**：预览占主要面积，参数放右侧窄栏，窄屏时参数折叠到下方；
 * 2. **每个参数都有「重置」**：右上角的「重置」把全部参数恢复到初始值；
 * 3. **状态写回**：不内置保存按钮，参数变化通过 `onChange` 交给调用方；
 * 4. **纯受控可选**：同时支持 `value` 与 `defaultValue`（`useControllableState`）。
 * ------------------------------------------------------------------ */

/* ================================================================== *
 * 1. 图片编辑
 * ================================================================== */

export interface ImageEditValue {
  /** 裁切比例 */
  ratio: string
  /** 旋转角度（90 的倍数） */
  rotate: number
  /** 缩放 1 ~ 2 */
  zoom: number
  brightness: number
  contrast: number
  saturation: number
}

export const DEFAULT_IMAGE_EDIT: ImageEditValue = {
  ratio: '16:9',
  rotate: 0,
  zoom: 1,
  brightness: 100,
  contrast: 100,
  saturation: 100,
}

const RATIOS = ['16:9', '4:3', '1:1', '9:16'] as const

export interface ImageEditorProps {
  src?: string
  alt: string
  value?: ImageEditValue
  defaultValue?: ImageEditValue
  onChange?: (value: ImageEditValue) => void
  className?: string
}

/**
 * 图片编辑器
 *
 * 真做了什么：比例、旋转、缩放、亮度 / 对比度 / 饱和度，
 * 全部即时作用在预览上（CSS `transform` + `filter`），参数以结构化对象写回。
 * 导出/上传属于调用方的事 —— 组件不假装能生成新文件。
 *
 * @example
 * <ImageEditor src={cover} alt="登录页改稿" onChange={setEdit} />
 */
export function ImageEditor({
  src,
  alt,
  value,
  defaultValue,
  onChange,
  className,
}: ImageEditorProps) {
  const [current, setCurrent] = useControllableState<ImageEditValue>({
    value,
    defaultValue: defaultValue ?? DEFAULT_IMAGE_EDIT,
    onChange,
  })

  const patch = (next: Partial<ImageEditValue>) => setCurrent((prev) => ({ ...prev, ...next }))
  const ratioStyle = current.ratio.replace(':', ' / ')
  const filters = [
    `brightness(${current.brightness}%)`,
    `contrast(${current.contrast}%)`,
    `saturate(${current.saturation}%)`,
  ].join(' ')

  return (
    <div className={cn('grid gap-3 lg:grid-cols-[minmax(0,1fr)_13.5rem]', className)}>
      {/* 预览：棋盘底 + 裁切框 + 三分线 */}
      <div className="min-w-0">
        <div
          className="relative grid place-items-center overflow-hidden rounded-lg border border-line bg-[repeating-conic-gradient(var(--n-surface-2)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-3"
          style={{ minHeight: 240 }}
        >
          <div
            className="relative overflow-hidden rounded-md bg-surface-3 shadow-sm"
            style={{ aspectRatio: ratioStyle, width: '100%', maxWidth: 460 }}
          >
            {src ? (
              <img
                src={src}
                alt={alt}
                draggable={false}
                className="size-full object-cover transition-[transform,filter] duration-300 ease-out"
                style={{
                  filter: filters,
                  transform: `rotate(${current.rotate}deg) scale(${current.zoom})`,
                }}
              />
            ) : (
              <div className="grid size-full place-items-center text-xs text-fg-4">暂无图片</div>
            )}
            {/* 三分构图线：只在编辑时出现，不遮挡画面主体 */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-45">
              <span className="absolute inset-y-0 left-1/3 w-px bg-white/70 mix-blend-difference" />
              <span className="absolute inset-y-0 left-2/3 w-px bg-white/70 mix-blend-difference" />
              <span className="absolute inset-x-0 top-1/3 h-px bg-white/70 mix-blend-difference" />
              <span className="absolute inset-x-0 top-2/3 h-px bg-white/70 mix-blend-difference" />
            </span>
          </div>

          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <Badge tone="primary" variant="outline" size="sm" className="bg-surface/85 font-mono">
              IMAGE EDIT
            </Badge>
            <span className="rounded-full bg-surface/85 px-1.5 py-0.5 font-mono text-[0.625rem] text-fg-3 backdrop-blur-sm">
              {current.ratio} · {current.zoom.toFixed(2)}×
            </span>
          </div>
        </div>

        {/* 比例切换：左右两组按钮，键盘可达 */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {RATIOS.map((ratio) => (
            <Button
              key={ratio}
              size="xs"
              variant={current.ratio === ratio ? 'primary' : 'secondary'}
              aria-pressed={current.ratio === ratio}
              onClick={() => patch({ ratio })}
            >
              {ratio}
            </Button>
          ))}
          <span className="mx-1 h-4 w-px bg-line" />
          <Button
            size="xs"
            variant="ghost"
            onClick={() => patch({ rotate: (current.rotate + 90) % 360 })}
          >
            旋转 90°
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setCurrent(DEFAULT_IMAGE_EDIT)}>
            重置
          </Button>
        </div>
      </div>

      {/* 参数 */}
      <div className="space-y-3 rounded-lg border border-line bg-surface-2/40 p-3">
        <ParamRow label="缩放" value={`${current.zoom.toFixed(2)}×`}>
          <Slider
            ariaLabel="缩放"
            min={1}
            max={2}
            step={0.01}
            value={current.zoom}
            onChange={(zoom) => patch({ zoom })}
          />
        </ParamRow>
        <ParamRow label="亮度" value={`${current.brightness}%`}>
          <Slider
            ariaLabel="亮度"
            min={50}
            max={150}
            value={current.brightness}
            onChange={(brightness) => patch({ brightness })}
          />
        </ParamRow>
        <ParamRow label="对比度" value={`${current.contrast}%`}>
          <Slider
            ariaLabel="对比度"
            min={50}
            max={150}
            value={current.contrast}
            onChange={(contrast) => patch({ contrast })}
          />
        </ParamRow>
        <ParamRow label="饱和度" value={`${current.saturation}%`}>
          <Slider
            ariaLabel="饱和度"
            min={0}
            max={200}
            value={current.saturation}
            onChange={(saturation) => patch({ saturation })}
          />
        </ParamRow>
        <p className="border-t border-line-subtle pt-2 text-2xs leading-5 text-fg-3">
          参数以{' '}
          <code className="font-mono">
            {'{ ratio, rotate, zoom, brightness, contrast, saturation }'}
          </code>{' '}
          写回，导出交给调用方。
        </p>
      </div>
    </div>
  )
}

function ParamRow({
  label,
  value,
  children,
}: {
  label: string
  value: string
  children: ReactNode
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-2xs">
        <span className="text-fg-2">{label}</span>
        <span className="font-mono text-fg-3 tabular-nums">{value}</span>
      </div>
      {children}
    </div>
  )
}

/* ================================================================== *
 * 2. 文本编辑
 * ================================================================== */

type InlineMarker = '**' | '_' | '`'
type BlockKind = 'p' | 'h2' | 'h3' | 'ul' | 'quote'

const BLOCK_ACTIONS: Array<{ key: BlockKind | 'p'; label: string; hint: string }> = [
  { key: 'h2', label: 'H2', hint: '二级标题' },
  { key: 'h3', label: 'H3', hint: '三级标题' },
  { key: 'p', label: '正文', hint: '普通段落' },
  { key: 'ul', label: '列表', hint: '无序列表' },
  { key: 'quote', label: '引用', hint: '引用块' },
]

/** 行级记号：与 BLOCK_ACTIONS 一一对应，正文（p）就是空前缀 */
const MARKER_BY_BLOCK: Record<BlockKind, string> = {
  h2: '## ',
  h3: '### ',
  p: '',
  ul: '- ',
  quote: '> ',
}

export const DEFAULT_TEXT_EDIT = `## 本周经营简报

营收 **环比 +12.4%**，主要来自华东区的续约订单。

- 新签 38 家，客单价 2.6 万
- 续约率 91.2%，高于目标 3.2 个点
- 待跟进商机 142 条

> 下周重点：把物流大屏接进客户侧演示环境。

补充说明：\`MRR\` 口径与财务对齐，不含一次性实施费。`

export interface TextEditorProps {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  /** 预览与编辑并排（缺省 true，窄屏自动上下堆叠） */
  split?: boolean
  className?: string
  /** 只读预览（如工具栏演示里只展示渲染结果） */
  readOnlyPreview?: boolean
}

/**
 * 文本编辑器
 *
 * 用 Markdown 记号而不是 contentEditable：
 * `contentEditable` 在不同浏览器里会产生完全不同的 DOM，
 * 光标、撤销栈、粘贴清洗都要重写一遍 —— 对后台模板来说不划算。
 * 这里「工具栏写入记号 + textarea + 实时渲染」，
 * 编辑器保持可预测，预览又能直接抄成任何 Markdown 渲染器的输入。
 */
export function TextEditor({
  value,
  defaultValue,
  onChange,
  split = true,
  className,
  readOnlyPreview,
}: TextEditorProps) {
  const [text, setText] = useControllableState<string>({
    value,
    defaultValue: defaultValue ?? DEFAULT_TEXT_EDIT,
    onChange,
  })
  const areaRef = useRef<HTMLTextAreaElement>(null)

  /** 在光标处包一层行内记号；有选区就包裹，没有就插入一对并落在中间 */
  const wrap = useCallback(
    (marker: InlineMarker) => {
      const area = areaRef.current
      if (!area) return
      const { selectionStart, selectionEnd } = area
      const selected = text.slice(selectionStart, selectionEnd)
      const next = `${text.slice(0, selectionStart)}${marker}${selected}${marker}${text.slice(selectionEnd)}`
      setText(next)
      requestAnimationFrame(() => {
        area.focus()
        const start = selectionStart + marker.length
        area.setSelectionRange(start, start + selected.length)
      })
    },
    [setText, text],
  )

  /** 行级：给当前行加前缀（标题 / 列表 / 引用），已经带有同一记号时再次点击即去掉 */
  const prefix = useCallback(
    (kind: BlockKind) => {
      const area = areaRef.current
      if (!area) return
      const cursor = area.selectionStart
      const lineStart = text.lastIndexOf('\n', cursor - 1) + 1
      const lineEndRaw = text.indexOf('\n', cursor)
      const lineEnd = lineEndRaw === -1 ? text.length : lineEndRaw
      const line = text.slice(lineStart, lineEnd)
      const body = line.replace(/^(#{1,3}\s+|[-*]\s+|>\s+)/, '')
      const marker = MARKER_BY_BLOCK[kind]
      // 记号相同时视为「取消」，避免点两次变成 `## ## 标题`
      const nextLine = !marker || line.startsWith(marker) ? body : `${marker}${body}`
      const next = `${text.slice(0, lineStart)}${nextLine}${text.slice(lineEnd)}`
      setText(next)
      requestAnimationFrame(() => {
        area.focus()
        const position = lineStart + nextLine.length
        area.setSelectionRange(position, position)
      })
    },
    [setText, text],
  )

  /** Tab 插入两个空格：代码片段粘进正文时不用手工对齐 */
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault()
      const area = event.currentTarget
      const { selectionStart, selectionEnd } = area
      const next = `${text.slice(0, selectionStart)}  ${text.slice(selectionEnd)}`
      setText(next)
      requestAnimationFrame(() => area.setSelectionRange(selectionStart + 2, selectionStart + 2))
      return
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
      event.preventDefault()
      wrap('**')
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'i') {
      event.preventDefault()
      wrap('_')
    }
  }

  const stats = useMemo(() => {
    const chars = Array.from(text.replace(/\s/g, '')).length
    const words = text.split(/\s+/).filter(Boolean).length
    const lines = text.split('\n').length
    return { chars, words, lines }
  }, [text])

  if (readOnlyPreview) {
    return (
      <div className={cn('rounded-lg border border-line bg-surface p-4', className)}>
        <MarkdownPreview text={text} />
      </div>
    )
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border border-line bg-surface', className)}>
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-1 border-b border-line bg-surface-2/50 px-2 py-1.5">
        {BLOCK_ACTIONS.map((action) => (
          <button
            key={action.key}
            type="button"
            title={action.hint}
            onClick={() => prefix(action.key as BlockKind)}
            className="inline-flex h-6 min-w-6 items-center justify-center rounded-sm px-1.5 text-2xs font-medium text-fg-2 transition-colors hover:bg-surface hover:text-fg"
          >
            {action.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-line" />
        <button
          type="button"
          title="加粗 ⌘B"
          aria-label="加粗"
          onClick={() => wrap('**')}
          className="inline-flex size-6 items-center justify-center rounded-sm font-serif text-xs font-bold text-fg-2 transition-colors hover:bg-surface hover:text-fg"
        >
          B
        </button>
        <button
          type="button"
          title="斜体 ⌘I"
          aria-label="斜体"
          onClick={() => wrap('_')}
          className="inline-flex size-6 items-center justify-center rounded-sm font-serif text-xs text-fg-2 italic transition-colors hover:bg-surface hover:text-fg"
        >
          I
        </button>
        <button
          type="button"
          title="行内代码"
          aria-label="行内代码"
          onClick={() => wrap('`')}
          className="inline-flex size-6 items-center justify-center rounded-sm font-mono text-2xs text-fg-2 transition-colors hover:bg-surface hover:text-fg"
        >
          {'</>'}
        </button>
        <span className="ml-auto font-mono text-[0.625rem] text-fg-4 tabular-nums">
          {stats.lines} 行 · {stats.chars} 字
        </span>
      </div>

      <div className={cn('grid', split && 'md:grid-cols-2')}>
        <textarea
          ref={areaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          aria-label="正文编辑"
          className="min-h-[17rem] w-full resize-none bg-transparent px-3 py-2.5 font-mono text-[0.75rem] leading-6 text-fg-2 outline-none placeholder:text-fg-4 md:border-r md:border-line"
        />
        {split && (
          <div className="min-h-[17rem] overflow-y-auto bg-bg-subtle/40 px-3 py-2.5">
            <MarkdownPreview text={text} />
          </div>
        )}
      </div>
    </div>
  )
}

/** 极简 Markdown 渲染：标题 / 列表 / 引用 / 段落 + 行内加粗、斜体、代码 */
export function MarkdownPreview({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => text.split('\n'), [text])
  return (
    <div className={cn('space-y-1.5 text-[0.8125rem] leading-6 text-fg-2', className)}>
      {blocks.map((raw, index) => {
        const line = raw.trimEnd()
        if (!line.trim()) return <div key={index} className="h-1.5" aria-hidden="true" />
        if (line.startsWith('### ')) {
          return (
            <h4 key={index} className="pt-1 text-[0.8125rem] font-semibold text-fg">
              {renderInline(line.slice(4))}
            </h4>
          )
        }
        if (line.startsWith('## ')) {
          return (
            <h3 key={index} className="pt-1.5 text-sm font-semibold text-fg">
              {renderInline(line.slice(3))}
            </h3>
          )
        }
        if (line.startsWith('# ')) {
          return (
            <h2 key={index} className="pt-1.5 text-base font-semibold text-fg">
              {renderInline(line.slice(2))}
            </h2>
          )
        }
        if (/^[-*]\s+/.test(line)) {
          return (
            <p key={index} className="flex gap-2 pl-1">
              <span className="mt-2.5 size-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              <span className="min-w-0">{renderInline(line.slice(2))}</span>
            </p>
          )
        }
        if (line.startsWith('> ')) {
          return (
            <blockquote
              key={index}
              className="border-l-2 border-primary/40 pl-2.5 text-xs leading-6 text-fg-3"
            >
              {renderInline(line.slice(2))}
            </blockquote>
          )
        }
        return <p key={index}>{renderInline(line)}</p>
      })}
    </div>
  )
}

const INLINE_REGEX = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/g

function renderInline(line: string): ReactNode {
  return line.split(INLINE_REGEX).map((part, index) => {
    if (!part) return null
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-fg">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={index}
          className="rounded-sm bg-surface-3 px-1 py-0.5 font-mono text-[0.75em] text-primary"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    return <span key={index}>{part}</span>
  })
}

/* ================================================================== *
 * 3. 代码编辑
 * ================================================================== */

const CODE_SAMPLES: Record<string, string> = {
  ts: `export interface MediaAsset {
  id: string
  kind: 'image' | 'video' | 'audio'
  src: string
  duration?: number
}

/** 按类型取默认角标文案 */
export function kindLabel(kind: MediaAsset['kind']) {
  return kind.toUpperCase()
}

export const MAX_UPLOAD_MB = 20`,
  json: `{
  "name": "nexus-admin",
  "private": true,
  "scripts": { "dev": "vite", "build": "tsc && vite build" },
  "dependencies": { "react": "19.3.1", "zustand": "5.0.16" }
}`,
  css: `:root {
  --n-radius: 0.5rem;
  --n-primary: #0d6efd;
}

.card {
  border-radius: var(--n-radius);
  background: var(--n-surface);
}`,
}

const TOKEN_RE =
  /(\/\/[^\n]*|#[^\n]*|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`|\b(?:export|import|from|interface|type|function|return|const|let|var|if|else|for|async|await|new|readonly|public|private)\b|\b\d+(?:\.\d+)?\b)/g

/** 代码编辑器头部的文件切换项：key 同时是内置样例的 key */
const CODE_FILES = [
  { key: 'ts', label: 'asset.ts' },
  { key: 'json', label: 'package.json' },
  { key: 'css', label: 'tokens.css' },
] as const

export interface CodeEditorProps {
  value?: string
  defaultValue?: string
  /** 当前文件名 / 语言（ts / json / css） */
  language?: string
  onLanguageChange?: (language: string) => void
  onChange?: (value: string) => void
  height?: number
  className?: string
}

/**
 * 代码编辑器
 *
 * 「行号 + 语言切换 + 高亮 + Tab 缩进」四件套。
 * 没有引入 CodeMirror / Monaco —— 一个演示级编辑器要拉 300 kB+，
 * 而这四个能力用 60 行 tokenizer 就能实现到「看得清、改得动」的程度。
 * 真正的业务编辑器请接 Monaco，本组件只保证视觉与交互口径一致。
 */
export function CodeEditor({
  value,
  defaultValue,
  language = 'ts',
  onLanguageChange,
  onChange,
  height = 300,
  className,
}: CodeEditorProps) {
  const sample = CODE_SAMPLES[language] ?? CODE_SAMPLES.ts!
  const [code, setCode] = useControllableState<string>({
    value,
    defaultValue: defaultValue ?? sample,
    onChange,
  })
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const lines = useMemo(() => code.split('\n'), [code])

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Tab') return
    event.preventDefault()
    const area = event.currentTarget
    const { selectionStart, selectionEnd } = area
    const next = `${code.slice(0, selectionStart)}  ${code.slice(selectionEnd)}`
    setCode(next)
    requestAnimationFrame(() => area.setSelectionRange(selectionStart + 2, selectionStart + 2))
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border border-line bg-[#0d1117]', className)}>
      <div className="flex items-center gap-2 border-b border-white/8 px-2.5 py-1.5">
        <span className="flex items-center gap-1" aria-hidden="true">
          <span className="size-2 rounded-full bg-[#ff5f57]" />
          <span className="size-2 rounded-full bg-[#febc2e]" />
          <span className="size-2 rounded-full bg-[#28c840]" />
        </span>
        {/*
          这里刻意不用共享的 Tabs：它的 pill 变体按「浅色底 + 深色字」设计，
          塞进深色编辑头里需要层层覆盖（还会把选中项的文字也一起染白）。
          编辑器头是深色专用区域，直接写一组同口径的角色化按钮更可控。
        */}
        <div role="tablist" className="flex items-center gap-0.5 rounded-md bg-white/8 p-0.5">
          {CODE_FILES.map((file) => {
            const active = file.key === language
            return (
              <button
                key={file.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onLanguageChange?.(file.key)}
                className={cn(
                  'h-6 rounded-sm px-2 font-mono text-[0.6875rem] transition-colors',
                  active ? 'bg-white/16 text-white' : 'text-white/50 hover:text-white/85',
                )}
              >
                {file.label}
              </button>
            )
          })}
        </div>
        <span className="ml-auto font-mono text-[0.625rem] text-white/40 tabular-nums">
          {lines.length} 行 · {Array.from(code).length} 字符
        </span>
      </div>

      <div className="relative flex" style={{ height: sxPx(height) }}>
        {/* 行号：与文本区共用 scrollTop，输入时始终对齐 */}
        <div
          aria-hidden="true"
          className="w-10 shrink-0 overflow-hidden border-r border-white/8 py-2 text-right font-mono text-[0.6875rem] leading-[1.5rem] text-white/25 select-none"
        >
          <div style={{ transform: `translateY(-${scrollTop}px)` }}>
            {lines.map((_, index) => (
              <div key={index} className="pr-2">
                {index + 1}
              </div>
            ))}
          </div>
        </div>

        <div ref={scrollerRef} className="relative min-w-0 flex-1 overflow-hidden">
          {/* 高亮层：与 textarea 逐字对齐（同字体、同行高、同内边距） */}
          <pre
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden py-2 pr-3 pl-3 font-mono text-[0.6875rem] leading-[1.5rem] text-[#c9d1d9]"
            style={{ transform: `translateY(-${scrollTop}px)` }}
          >
            <code>
              {lines.map((line, index) => (
                <span key={index} className="block whitespace-pre">
                  {highlightCode(line)}
                </span>
              ))}
            </code>
          </pre>

          <textarea
            ref={areaRef}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            aria-label="代码编辑"
            className="absolute inset-0 size-full resize-none overflow-auto bg-transparent py-2 pr-3 pl-3 font-mono text-[0.6875rem] leading-[1.5rem] whitespace-pre text-transparent caret-white outline-none selection:bg-white/20"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-white/8 px-2.5 py-1 text-[0.625rem] text-white/40">
        <span>UTF-8</span>
        <span>·</span>
        <span>LF</span>
        <span>·</span>
        <span>2 空格缩进</span>
        <span className="ml-auto">Tab 插入缩进</span>
      </div>
    </div>
  )
}

/** 数字 px → 内联高度（编辑器高度不做 rem 换算，避免和行高脱节） */
function sxPx(value: number): string {
  return `${value}px`
}
function highlightCode(line: string): ReactNode {
  return line.split(TOKEN_RE).map((token, index) => {
    if (!token) return null
    if (/^(\/\/|#)/.test(token)) {
      return (
        <span key={index} className="text-[#8b949e]">
          {token}
        </span>
      )
    }
    if (/^['"`]/.test(token)) {
      return (
        <span key={index} className="text-[#a5d6ff]">
          {token}
        </span>
      )
    }
    if (/^\d/.test(token)) {
      return (
        <span key={index} className="text-[#79c0ff]">
          {token}
        </span>
      )
    }
    if (TOKEN_RE.test(token)) {
      return (
        <span key={index} className="text-[#ff7b72]">
          {token}
        </span>
      )
    }
    return <span key={index}>{token}</span>
  })
}

/* ================================================================== *
 * 4. 视频编辑
 * ================================================================== */

export interface VideoClip {
  id: string
  label: string
  /** 秒 */
  start: number
  end: number
  tone?: 'primary' | 'info' | 'warning'
}

export interface VideoEditorProps {
  clips: VideoClip[]
  /** 总时长（秒） */
  duration: number
  poster?: string
  src?: string
  value?: VideoClip[]
  onChange?: (clips: VideoClip[]) => void
  className?: string
}

const CLIP_TONE: Record<NonNullable<VideoClip['tone']>, string> = {
  primary: 'var(--n-primary)',
  info: 'var(--n-chart-6)',
  warning: 'var(--n-warning)',
}

/**
 * 视频编辑器
 *
 * 时间轴 + 出入点 + 拆分：
 * - 拖轨道任意位置移动播放头，时间码同步到 0.1s；
 * - 「拆分」在当前播放头把所在片段切成两段；
 * - 每个片段的宽度 = 时长占比，缩放（每秒像素）只改显示，不改数据。
 */
export function VideoEditor({
  clips,
  duration,
  poster,
  src,
  value,
  onChange,
  className,
}: VideoEditorProps) {
  const [list, setList] = useControllableState<VideoClip[]>({
    value,
    defaultValue: clips,
    onChange,
  })
  const [playhead, setPlayhead] = useState(0)
  const [pxPerSecond, setPxPerSecond] = useState(26)
  const trackRef = useRef<HTMLDivElement>(null)
  const total = Math.max(duration, ...list.map((clip) => clip.end), 1)

  const seek = (clientX: number) => {
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    if (!rect.width) return
    setPlayhead(clamp(((clientX - rect.left) / rect.width) * total, 0, total))
  }

  const activeClip = list.find((clip) => playhead >= clip.start && playhead < clip.end)

  const split = () => {
    const target = activeClip
    if (!target) return
    const cut = Math.round(playhead * 10) / 10
    if (cut - target.start < 0.3 || target.end - cut < 0.3) return
    const next = list.flatMap((clip) =>
      clip.id === target.id
        ? [
            { ...clip, end: cut },
            { ...clip, id: `${clip.id}-b`, label: `${clip.label} · B`, start: cut },
          ]
        : [clip],
    )
    setList(next)
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border border-line bg-surface', className)}>
      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_11rem]">
        {/* 监视器 */}
        <div className="relative overflow-hidden rounded-md bg-black">
          {poster && (
            <img
              src={poster}
              alt="视频预览"
              className="aspect-video w-full object-cover opacity-90"
            />
          )}
          {src && (
            <video
              src={src}
              poster={poster}
              controls
              playsInline
              preload="metadata"
              className="absolute inset-0 size-full object-cover"
              aria-label="视频预览"
            />
          )}
          {!src && (
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-2">
              <span className="font-mono text-[0.625rem] text-white/80 tabular-nums">
                {formatPreciseDuration(playhead)} / {formatPreciseDuration(total)}
              </span>
              <Badge
                tone="danger"
                variant="outline"
                size="sm"
                className="bg-black/40 font-mono text-white/80"
              >
                VIDEO EDIT
              </Badge>
            </div>
          )}
        </div>

        {/* 片段参数 */}
        <div className="space-y-2 rounded-md border border-line bg-surface-2/40 p-2.5 text-2xs">
          <div className="flex items-center justify-between">
            <span className="text-fg-3">播放头</span>
            <span className="font-mono text-fg tabular-nums">
              {formatPreciseDuration(playhead)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-fg-3">片段</span>
            <span className="text-fg-2 tabular-nums">{list.length} 段</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-fg-3">当前段</span>
            <span className="max-w-[6rem] truncate text-fg-2">{activeClip?.label ?? '—'}</span>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-fg-3">时间轴缩放</span>
              <span className="font-mono text-fg-3 tabular-nums">{pxPerSecond}px/s</span>
            </div>
            <Slider
              ariaLabel="时间轴缩放"
              min={12}
              max={60}
              step={2}
              value={pxPerSecond}
              onChange={setPxPerSecond}
            />
          </div>
          <div className="flex gap-1.5 pt-1">
            <Button size="xs" variant="primary" onClick={split} className="flex-1">
              拆分
            </Button>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => {
                setList(clips)
                setPlayhead(0)
              }}
            >
              重置
            </Button>
          </div>
        </div>
      </div>

      {/* 时间轴 */}
      <div className="border-t border-line bg-surface-2/40 px-3 pt-2 pb-3">
        <div className="flex items-center justify-between pb-1">
          {Array.from({ length: 7 }).map((_, index) => (
            <span key={index} className="font-mono text-[0.5625rem] text-fg-4 tabular-nums">
              {formatPreciseDuration((total / 6) * index)}
            </span>
          ))}
        </div>

        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="播放头"
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(playhead)}
          aria-valuetext={formatPreciseDuration(playhead)}
          onPointerDown={(event) => seek(event.clientX)}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            event.preventDefault()
            setPlayhead((value) =>
              clamp(value + (event.key === 'ArrowRight' ? 0.2 : -0.2), 0, total),
            )
          }}
          className="relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary-ring"
        >
          <div className="relative h-11 overflow-hidden rounded-md bg-surface-3">
            {list.map((clip) => {
              const left = (clip.start / total) * 100
              const width = ((clip.end - clip.start) / total) * 100
              const color = CLIP_TONE[clip.tone ?? 'primary']
              return (
                <div
                  key={clip.id}
                  data-clip-id={clip.id}
                  className="absolute inset-y-1 flex items-center overflow-hidden rounded-sm border border-white/25 px-1.5"
                  style={{
                    left: `${left}%`,
                    width: `calc(${width}% - 2px)`,
                    background: `color-mix(in oklab, ${color} 30%, var(--n-surface-2))`,
                  }}
                >
                  <span className="truncate text-[0.5625rem] font-medium text-fg-2">
                    {clip.label}
                  </span>
                  <span className="ml-auto hidden font-mono text-[0.5625rem] text-fg-3 tabular-nums sm:inline">
                    {(clip.end - clip.start).toFixed(1)}s
                  </span>
                </div>
              )
            })}

            {/* 播放头 */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary"
              style={{ left: `${(playhead / total) * 100}%` }}
            >
              <span className="absolute -top-0.5 -left-[3px] size-2 rounded-full bg-primary" />
            </span>
          </div>
        </div>

        <p className="mt-1.5 flex items-center gap-1.5 text-[0.625rem] text-fg-4">
          <span className="inline-block size-1.5 rounded-full bg-primary" />
          点击轨道定位播放头，右侧「拆分」在播放头处切段
        </p>
      </div>
    </div>
  )
}

/* ================================================================== *
 * 工作台：资源 + 编辑器合一
 * ================================================================== */

export interface EditorWorkbenchProps {
  /** 当前编辑器（受控） */
  kind?: EditKind
  /** 默认打开的编辑器 */
  defaultKind?: EditKind
  onKindChange?: (kind: EditKind) => void
  kinds?: EditKind[]
  /** 各编辑器的内容，按 kind 渲染 */
  render: (kind: EditKind) => ReactNode
  footer?: ReactNode
  className?: string
}

const EDIT_LABEL: Record<EditKind, string> = {
  image: '图片编辑',
  text: '文本编辑',
  code: '代码编辑',
  video: '视频编辑',
}

/**
 * 编辑器工作台
 *
 * 把四种编辑器收进一个页签壳：业务侧只要按 kind 返回内容，
 * 页签、标题与「当前编辑什么」的说明就自动统一。
 */
export function EditorWorkbench({
  kind: kindProp,
  defaultKind = 'image',
  onKindChange,
  kinds = ['image', 'text', 'code', 'video'],
  render,
  footer,
  className,
}: EditorWorkbenchProps) {
  const [kind, setKind] = useControllableState<EditKind>({
    value: kindProp,
    defaultValue: defaultKind,
    onChange: onKindChange,
  })
  const id = useId()

  return (
    <div className={cn('rounded-xl border border-line bg-surface', className)} id={id}>
      <div className="border-b border-line px-3 py-2">
        <Tabs
          variant="line"
          size="sm"
          value={kind}
          onChange={(key) => setKind(key as EditKind)}
          items={kinds.map((item) => ({ key: item, label: EDIT_LABEL[item] }))}
        />
      </div>
      <div className="p-3">{render(kind)}</div>
      {footer && <div className="border-t border-line px-3 py-2">{footer}</div>}
    </div>
  )
}
