import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { cn } from '../lib/utils'
import { CanvasNodeStatus, type CanvasNodeTone } from './node-frame'
import {
  CheckIcon,
  CloseIcon,
  CopyIcon,
  RefreshIcon,
  SendIcon,
  SparkIcon,
  StopIcon,
} from './icons'
import type { CanvasAIEngine, CanvasAIRequest } from './types'

/**
 * 节点 AI 对话框
 *
 * 交互定位（对齐 Figma AI / Lovart 的「就地对话」）：
 * - 它不是模态框，而是**锚定节点**的浮层：画布平移缩放时跟着节点走，
 *   用户可以一边看节点一边追问，操作上下文不丢失；
 * - 空间不够时自动翻转（右 → 左 → 下方），并用一条引导线指明它属于哪个节点；
 * - 内容三态：思考中（步骤条）/ 流式回答（逐字）/ 完成（可应用到节点）。
 *
 * 引擎完全可注入：`engine` 为 undefined 时用内置的**确定性演示引擎**，
 * 离线可跑、可复现；接真模型只要实现 `CanvasAIEngine`，组件零改动。
 */

export interface CanvasAIPopoverProps {
  open: boolean
  /** 节点在屏幕上的锚点（通常是节点左上角） */
  anchor: { x: number; y: number }
  /** 节点尺寸（屏幕坐标），用于计算翻转 */
  anchorSize?: { width: number; height: number }
  /** 画布可视区域尺寸，用于防溢出 */
  viewport: { width: number; height: number }
  /**
   * 内联模式：由外层负责定位（外层用 transform 跟随节点），
   * 浮层只相对自身锚点向右（或向左）偏移。
   *
   * 为什么要这个模式：画布平移时节点每帧都在动，
   * 若浮层靠 React 位置重算，会落后一帧并抖动；
   * 内联模式下外层直接写 transform，浮层与节点永远严丝合缝。
   */
  inline?: boolean
  /** 内联模式下是否翻到节点左侧 */
  inlineFlip?: 'left' | 'right'
  nodeTitle: string
  nodeKind: string
  nodeKindLabel: string
  tone?: CanvasNodeTone
  /** 当前节点内容摘要（展示 + 提交给引擎） */
  content: string
  /** 引擎；缺省用内置演示引擎 */
  engine?: CanvasAIEngine
  /** 快捷指令（按节点类型不同） */
  suggestions?: string[]
  /** 把回答应用到节点 */
  onApply: (text: string) => void
  /** 以回答为基础创建子节点 */
  onCreateChild?: (text: string) => void
  onClose: () => void
  className?: string
}

type Status = 'idle' | 'thinking' | 'streaming' | 'done' | 'error' | 'aborted'

interface Step {
  id: string
  label: string
  status: 'running' | 'done'
}

const WIDTH = 348
const MAX_HEIGHT = 420
const GAP = 14

/**
 * 计算浮层位置（右 → 左 → 下方，永远落在视口内）
 *
 * 导出成纯函数的原因：宿主若想在「跟随模式」下自己拿主意（例如放进 Portal），
 * 需要和组件内部完全一致的翻转规则，否则会算两套。
 */
export function resolveAIPopoverPosition(input: {
  anchor: { x: number; y: number }
  anchorSize?: { width: number; height: number }
  viewport: { width: number; height: number }
}): { left: number; top: number; flipped: boolean } {
  const { anchor, anchorSize, viewport } = input
  const rightEdge = anchor.x + (anchorSize?.width ?? 0)
  const spaceRight = viewport.width - rightEdge
  const spaceLeft = anchor.x
  const flipped = spaceRight < WIDTH + GAP * 2 && spaceLeft > WIDTH + GAP * 2
  const left = flipped
    ? Math.max(GAP, anchor.x - WIDTH - GAP)
    : Math.min(viewport.width - WIDTH - GAP, rightEdge + GAP)
  const top = Math.max(GAP, Math.min(anchor.y - 8, viewport.height - MAX_HEIGHT - GAP))
  return { left, top, flipped }
}

/**
 * 内置演示引擎
 *
 * 为什么要有它：`pnpm dev` 时不一定配了模型网关，
 * 而「演示页打不开 AI 对话框」比「回答是预置的」严重得多。
 * 它按节点类型生成**结构化、可落地**的回答，并且逐字流式输出，
 * 走的是和真实引擎完全一样的回调协议。
 */
export function createDemoEngine(locale: 'zh' | 'en' = 'zh'): CanvasAIEngine {
  return {
    id: 'demo',
    label: locale === 'zh' ? '本地演示引擎' : 'Local demo engine',
    live: false,
    async run(request, handlers, signal) {
      const steps: Array<[string, string]> = locale === 'zh'
        ? [
            ['parse', `解析节点上下文（${request.kind}）`],
            ['plan', '生成候选方案'],
            ['check', '校验与节点约束'],
          ]
        : [
            ['parse', `Parse node context (${request.kind})`],
            ['plan', 'Draft candidates'],
            ['check', 'Validate against node constraints'],
          ]

      const answer = buildDemoAnswer(request, locale)

      for (const [id, label] of steps) {
        if (signal.aborted) return
        handlers.onStep?.({ id, label, status: 'running' })
        await sleep(220 + Math.random() * 180, signal)
        handlers.onStep?.({ id, label, status: 'done' })
      }

      // 逐字：按「块」推进，块大小随长度自适应，长回答也不会等太久
      const chunk = answer.length > 320 ? 3 : 2
      for (let index = 0; index < answer.length; index += chunk) {
        if (signal.aborted) return
        handlers.onDelta(answer.slice(index, index + chunk))
        await sleep(12, signal)
      }
    },
  }
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

function buildDemoAnswer(request: CanvasAIRequest, locale: 'zh' | 'en'): string {
  const prompt = request.prompt.trim() || (locale === 'zh' ? '优化这个节点' : 'Improve this node')
  if (locale === 'en') {
    return `Here is a take for **${request.title}** based on “${prompt}”.

1. Keep the opening line under 12 words — it is what gets read at 0% zoom.
2. Replace abstract adjectives with a concrete scene detail.
3. End with a single call to action so the node can flow into the next one.

Draft:
${request.content.slice(0, 80) || 'A quiet morning, three frames, one promise.'}
— tightened for the storyboard rhythm.`
  }
  const kindHint: Record<string, string> = {
    text: '我把这段文字按「钩子 → 细节 → 行动」重写了一遍，长度控制在原节点的 1.2 倍以内，避免把框撑爆。',
    image: '我按当前的视觉基调给出了三个更具体的画面描述，每个都能直接送去出图。',
    video: '我把镜头拆成了三拍：建立空间 → 动作特写 → 收尾定格，并给了时长建议。',
    prompt: '我把提示词重构成「主体 + 光线 + 材质 + 构图 + 风格」五段式，模型更容易稳定复现。',
    note: '我把便签里的碎片信息归成了三条可执行结论。',
    group: '我按板块把这一组内容的顺序重排了一遍，让阅读动线更顺。',
  }
  return `${kindHint[request.kind] ?? '我按你的要求重写了一版。'}

针对「${prompt}」，建议这样改：

1. **先给结论** —— 第一句就交代结果，读者在低缩放下也能看懂这个节点是什么。
2. **具体化描述** —— 把"很有氛围"换成"午后三点，窗台的灰尘在光柱里浮着"。
3. **收束到下一步** —— 结尾留一句能被下一个节点接住的引子。

改写草稿：
${(request.content || '（节点内容为空）').slice(0, 60)}${request.content.length > 60 ? '…' : ''}
—— 调整为更适合画面表达的顺序。`
}

export function CanvasAIPopover({
  open,
  anchor,
  anchorSize,
  viewport,
  inline,
  inlineFlip = 'right',
  nodeTitle,
  nodeKind,
  nodeKindLabel,
  tone = 'primary',
  content,
  engine,
  suggestions,
  onApply,
  onCreateChild,
  onClose,
  className,
}: CanvasAIPopoverProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [draft, setDraft] = useState('')
  const [answer, setAnswer] = useState('')
  const [steps, setSteps] = useState<Step[]>([])
  const [error, setError] = useState<string | null>(null)
  const [autoApply, setAutoApply] = useState(true)
  const abortRef = useRef<AbortController | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastPromptRef = useRef('')

  const activeEngine = useMemo(() => engine ?? createDemoEngine(), [engine])

  /** 复位：每次重新打开都从干净状态开始（避免上一次的答案串味） */
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort()
      abortRef.current = null
      setStatus('idle')
      setDraft('')
      setAnswer('')
      setSteps([])
      setError(null)
      return
    }
    const timer = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  /** 流式输出后保持滚动到底部（只在用户没有手动上滚时） */
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 80
    if (nearBottom) body.scrollTop = body.scrollHeight
  }, [answer, steps])

  const run = useCallback(
    async (prompt: string) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setStatus('thinking')
      setAnswer('')
      setSteps([])
      setError(null)

      try {
        await activeEngine.run(
          {
            nodeId: '',
            title: nodeTitle,
            kind: nodeKind,
            content,
            prompt,
          },
          {
            onStep: (step) =>
              setSteps((prev) => {
                const exists = prev.findIndex((item) => item.id === step.id)
                if (exists === -1) return [...prev, step]
                const next = [...prev]
                next[exists] = step
                return next
              }),
            onDelta: (delta) => {
              setStatus((current) => (current === 'streaming' ? current : 'streaming'))
              setAnswer((prev) => prev + delta)
            },
          },
          controller.signal,
        )
        if (controller.signal.aborted) {
          setStatus('aborted')
          return
        }
        setStatus('done')
      } catch (cause) {
        if (controller.signal.aborted) {
          setStatus('aborted')
          return
        }
        setError(cause instanceof Error ? cause.message : String(cause))
        setStatus('error')
      }
    },
    [activeEngine, content, nodeKind, nodeTitle],
  )

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const value = draft.trim()
    if (!value || status === 'streaming' || status === 'thinking') return
    lastPromptRef.current = value
    setDraft('')
    void run(value)
  }

  const stop = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus('aborted')
  }

  const apply = useCallback(() => {
    if (!answer) return
    onApply(answer)
    if (autoApply) onClose()
  }, [answer, autoApply, onApply, onClose])

  if (!open) return null

  /* ---------------- 定位：右 → 左 → 下，永远落在视口内 ---------------- */

  const positioned = inline
    ? {
        left: inlineFlip === 'left' ? -WIDTH - GAP : (anchorSize?.width ?? 0) + GAP,
        top: 0,
        flipped: inlineFlip === 'left',
      }
    : resolveAIPopoverPosition({ anchor, anchorSize, viewport })
  const { left, top, flipped: flipLeft } = positioned

  const busy = status === 'thinking' || status === 'streaming'

  return (
    <div
      role="dialog"
      aria-label={`${nodeTitle} 的 AI 助手`}
      data-canvas-ai=""
      className={cn('n-canvas-ai', className)}
      style={{ left: inline ? left : Math.max(GAP, left), top, width: WIDTH, maxHeight: MAX_HEIGHT }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {/* 指向节点的引导线 */}
      <span
        aria-hidden="true"
        className={cn('n-canvas-ai__leader', flipLeft ? 'is-left' : 'is-right')}
        style={{ top: Math.max(10, Math.min((anchorSize?.height ?? 40) / 2, 48)) }}
      />

      <header className="flex items-center gap-1.5 border-b border-line-subtle px-3 py-2">
        <span className="grid size-5 place-items-center rounded-[5px] bg-primary-weak text-primary">
          <SparkIcon size={12} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.75rem] font-semibold text-fg">AI 编辑 · {nodeTitle}</p>
          <p className="flex items-center gap-1 text-[0.625rem] text-fg-4">
            <span className={cn('n-canvas-tone-chip', `n-canvas-tone-chip--${tone}`)}>{nodeKindLabel}</span>
            <span className="truncate">{activeEngine.label}</span>
            {!activeEngine.live && <span className="n-canvas-badge-soft">演示</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭 AI 对话框"
          className="grid size-6 place-items-center rounded-md text-fg-4 transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <CloseIcon size={13} />
        </button>
      </header>

      <div ref={bodyRef} className="n-canvas-ai__body min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
        {/* 上下文 */}
        <div className="mb-2.5 rounded-md border border-line-subtle bg-surface-2/60 px-2.5 py-2">
          <p className="mb-1 text-[0.625rem] font-medium tracking-wide text-fg-4 uppercase">当前上下文</p>
          <p className="line-clamp-3 text-[0.75rem] leading-5 text-fg-2">{content || '（空节点）'}</p>
        </div>

        {/* 快捷指令 */}
        {status === 'idle' && suggestions && suggestions.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setDraft(suggestion)
                  inputRef.current?.focus()
                }}
                className="rounded-full border border-line bg-surface px-2 py-1 text-[0.6875rem] text-fg-2 transition-colors hover:border-primary/40 hover:bg-primary-weak hover:text-primary"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* 步骤 */}
        {steps.length > 0 && (
          <ol className="mb-2.5 space-y-1">
            {steps.map((step) => (
              <li key={step.id} className="flex items-center gap-1.5 text-[0.6875rem] text-fg-3">
                <span
                  className={cn(
                    'grid size-3.5 place-items-center rounded-full',
                    step.status === 'done' ? 'bg-success-weak text-success' : 'n-canvas-step-spin text-primary',
                  )}
                >
                  {step.status === 'done' ? <CheckIcon size={9} /> : <span className="size-1.5 rounded-full bg-current" />}
                </span>
                <span className={cn(step.status === 'done' && 'text-fg-2')}>{step.label}</span>
              </li>
            ))}
          </ol>
        )}

        {/* 回答 */}
        {(answer || status === 'thinking') && (
          <div className="n-canvas-ai__answer whitespace-pre-wrap text-[0.75rem] leading-6 text-fg-2">
            {answer || '正在理解节点内容…'}
            {status === 'streaming' && <span className="n-canvas-caret" aria-hidden="true" />}
          </div>
        )}

        {status === 'error' && (
          <p className="rounded-md bg-danger-weak px-2 py-1.5 text-[0.6875rem] text-danger">
            生成失败：{error}（可重试，或检查网关配置）
          </p>
        )}
        {status === 'aborted' && !answer && (
          <p className="text-[0.6875rem] text-fg-4">已停止生成</p>
        )}
      </div>

      {/* 结果操作 */}
      {(status === 'done' || (status === 'aborted' && answer)) && (
        <div className="flex flex-wrap items-center gap-1 border-t border-line-subtle px-3 py-2">
          <button type="button" onClick={apply} className="n-canvas-btn n-canvas-btn--primary">
            <CheckIcon size={11} />
            应用到节点
          </button>
          {onCreateChild && (
            <button
              type="button"
              onClick={() => {
                onCreateChild(answer)
                onClose()
              }}
              className="n-canvas-btn"
            >
              另存为子节点
            </button>
          )}
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(answer)}
            aria-label="复制回答"
            className="n-canvas-icon-btn"
          >
            <CopyIcon size={12} />
          </button>
          <button
            type="button"
            onClick={() => void run(lastPromptRef.current)}
            aria-label="重新生成"
            className="n-canvas-icon-btn"
          >
            <RefreshIcon size={12} />
          </button>
          <label className="ml-auto flex cursor-pointer items-center gap-1 text-[0.625rem] text-fg-4">
            <input
              type="checkbox"
              checked={autoApply}
              onChange={(event) => setAutoApply(event.target.checked)}
              className="size-3 accent-[var(--n-primary)]"
            />
            应用后关闭
          </label>
        </div>
      )}

      {/* 输入 */}
      <form onSubmit={onSubmit} className="flex items-center gap-1.5 border-t border-line-subtle px-2.5 py-2">
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={status === 'done' ? '继续追问…' : '让 AI 改写这个节点…'}
          aria-label="AI 指令"
          className="h-8 min-w-0 flex-1 rounded-md border border-line bg-surface px-2.5 text-[0.75rem] text-fg outline-none transition-[border-color,box-shadow] placeholder:text-fg-4 focus:border-primary/60 focus:ring-2 focus:ring-primary-ring"
        />
        {busy ? (
          <button type="button" onClick={stop} aria-label="停止生成" className="n-canvas-icon-btn n-canvas-icon-btn--danger">
            <StopIcon size={12} />
          </button>
        ) : (
          <button type="submit" aria-label="发送" className="n-canvas-icon-btn n-canvas-icon-btn--primary" disabled={!draft.trim()}>
            <SendIcon size={12} />
          </button>
        )}
      </form>

      {status === 'thinking' && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b-lg">
          <span className="n-canvas-progress-bar" />
        </span>
      )}
    </div>
  )
}

/** 节点内容 → 提交给引擎的纯文本（图片/视频节点取描述与元信息） */
export function aiContentOf(node: { title: string; kind: string; text?: string; meta?: string[] }): string {
  if (node.text) return node.text
  if (node.meta && node.meta.length > 0) return `${node.title}（${node.meta.join(' · ')}）`
  return node.title
}

/** 状态徽标（复用 node-frame 的样式，便于演示页组合） */
export function CanvasAIStatus({ busy, children }: { busy?: boolean; children: ReactNode }) {
  return <CanvasNodeStatus tone={busy ? 'primary' : 'neutral'}>{children}</CanvasNodeStatus>
}
