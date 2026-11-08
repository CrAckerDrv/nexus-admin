import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { cn } from '../lib/utils'
import { createDemoEngine } from './ai-popover'
import { CheckIcon, CloseIcon, CopyIcon, RefreshIcon, SendIcon, SparkIcon, StopIcon } from './icons'
import type { CanvasNodeTone } from './node-frame'
import type { CanvasAIEngine } from './types'

/**
 * 卡片底部 AI 输入区（inline dock）
 *
 * 与 `CanvasAIPopover` 的分工：
 * - Popover：浮在画布上的独立对话面板，适合「边看画布边聊」；
 * - Dock（本组件）：**长在卡片底部**，输入框与回答都贴着节点，
 *   视觉上属于这个节点本身。内容画布上这样更不容易「面板挡住宿主」，
 *   也不会因为相机移动而飘到无关节点上。
 *
 * 实现要点：
 * - 绝对定位在卡片底部内侧，高度受卡片约束（`max-h-[68%]`），
 *   内容不会把卡片撑破，也不会覆盖整张卡；
 * - 所有指针事件 stopPropagation：否则点输入框会被画布当成「拖节点」；
 * - 流式输出沿用 `CanvasAIEngine` 协议，与 Popover 共用同一套引擎。
 */

export interface CanvasAIDockProps {
  open: boolean
  nodeTitle: string
  nodeKind: string
  nodeKindLabel: string
  tone?: CanvasNodeTone
  /** 节点当前内容（作为上下文展示 + 提交给引擎） */
  content: string
  engine?: CanvasAIEngine
  suggestions?: string[]
  onApply: (text: string) => void
  onCreateChild?: (text: string) => void
  /** 应用后是否自动收起（默认收起） */
  autoClose?: boolean
  /**
   * 紧凑模式
   *
   * 卡片在屏幕上很小时（低缩放或小结点了），完整的面板会把内容挤没。
   * 紧凑模式只保留抬头 + 输入行，快捷指令与回答区按需展开。
   */
  compact?: boolean
  /**
   * 双击输入区时的回调
   *
   * 默认输入区会吞掉所有指针事件（否则点它会被画布当成拖节点）。
   * 但「双击进入编辑」是卡片级语义，宿主仍需要这个机会 ——
   * 传了它，双击面板空白处就会转交给宿主（例如切到就地编辑）。
   */
  onDoubleClickBody?: () => void
  onClose: () => void
  className?: string
}

type Status = 'idle' | 'thinking' | 'streaming' | 'done' | 'error' | 'aborted'

const TONE_CHIP: Record<CanvasNodeTone, string> = {
  primary: 'n-canvas-tone-chip--primary',
  success: 'n-canvas-tone-chip--success',
  warning: 'n-canvas-tone-chip--warning',
  danger: 'n-canvas-tone-chip--danger',
  info: 'n-canvas-tone-chip--info',
  neutral: 'n-canvas-tone-chip--neutral',
}

export function CanvasAIDock({
  open,
  nodeTitle,
  nodeKind,
  nodeKindLabel,
  tone = 'primary',
  content,
  engine,
  suggestions,
  onApply,
  onCreateChild,
  autoClose = true,
  compact = false,
  onDoubleClickBody,
  onClose,
  className,
}: CanvasAIDockProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [draft, setDraft] = useState('')
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const lastPromptRef = useRef('')

  const activeEngine = useMemo(() => engine ?? createDemoEngine(), [engine])

  // 关闭时彻底复位，避免下一次打开带着上一次的答案
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
    abortRef.current?.abort()
    abortRef.current = null
    setStatus('idle')
    setDraft('')
    setAnswer('')
    setError(null)
    setExpanded(false)
  }, [open])

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 60
    if (nearBottom) body.scrollTop = body.scrollHeight
  }, [answer])

  const run = useCallback(
    async (prompt: string) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setStatus('thinking')
      setAnswer('')
      setError(null)
      setExpanded(true)

      try {
        await activeEngine.run(
          { nodeId: '', title: nodeTitle, kind: nodeKind, content, prompt },
          {
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

  const busy = status === 'thinking' || status === 'streaming'

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const value = draft.trim()
    if (!value || busy) return
    lastPromptRef.current = value
    setDraft('')
    void run(value)
  }

  const stop = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus('aborted')
  }

  if (!open) return null

  return (
    <div
      data-canvas-ai-dock=""
      className={cn('n-canvas-ai-dock', className)}
      role="region"
      aria-label={`${nodeTitle} 的 AI 输入`}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => {
        event.stopPropagation()
        const el = event.target as HTMLElement
        // 输入框 / 按钮上的双击不转交（用户只是在选词或连点）
        if (el.closest('input, textarea, button, form')) return
        onDoubleClickBody?.()
      }}
    >
      {/* 抬头：谁在被编辑 + 用哪个引擎 */}
      <div className="n-canvas-ai-dock__head">
        <span className="n-canvas-ai-dock__dot" aria-hidden="true">
          <SparkIcon size={10} />
        </span>
        <span className={cn('n-canvas-tone-chip shrink-0', TONE_CHIP[tone])}>{nodeKindLabel}</span>
        <span className="min-w-0 flex-1 truncate text-[0.6875rem] font-medium text-fg-2">
          {activeEngine.label}
        </span>
        {!activeEngine.live && <span className="n-canvas-badge-soft shrink-0">演示</span>}
        <button
          type="button"
          onClick={onClose}
          aria-label="收起 AI 输入"
          className="n-canvas-icon-btn shrink-0 !size-4"
        >
          <CloseIcon size={10} />
        </button>
      </div>

      {/* 回答区：有内容才占位，避免空闲时把卡片撑高 */}
      {(expanded || answer || status === 'thinking') && (
        <div ref={bodyRef} className="n-canvas-ai-dock__body n-canvas-no-scrollbar">
          {status === 'thinking' && !answer ? (
            <p className="text-[0.6875rem] text-fg-4">正在理解这个节点…</p>
          ) : (
            <p className="whitespace-pre-wrap text-[0.6875rem] leading-5 text-fg-2">
              {answer}
              {status === 'streaming' && <span className="n-canvas-caret" aria-hidden="true" />}
            </p>
          )}
          {status === 'error' && (
            <p className="mt-1 rounded bg-danger-weak px-1.5 py-1 text-[0.625rem] text-danger">
              生成失败：{error}
            </p>
          )}
        </div>
      )}

      {/* 结果动作 */}
      {(status === 'done' || (status === 'aborted' && answer)) && (
        <div className="n-canvas-ai-dock__actions">
          <button
            type="button"
            onClick={() => {
              onApply(answer)
              if (autoClose) onClose()
            }}
            className="n-canvas-btn !h-5 !text-[0.625rem]"
          >
            <CheckIcon size={9} />
            应用到节点
          </button>
          {onCreateChild && (
            <button
              type="button"
              onClick={() => onCreateChild(answer)}
              className="n-canvas-btn !h-5 !text-[0.625rem]"
            >
              另存为子节点
            </button>
          )}
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(answer)}
            aria-label="复制回答"
            className="n-canvas-icon-btn !size-5"
          >
            <CopyIcon size={10} />
          </button>
          <button
            type="button"
            onClick={() => void run(lastPromptRef.current)}
            aria-label="重新生成"
            className="n-canvas-icon-btn !size-5"
          >
            <RefreshIcon size={10} />
          </button>
        </div>
      )}

      {/* 快捷指令 */}
      {!compact && status === 'idle' && suggestions && suggestions.length > 0 && (
        <div className="n-canvas-ai-dock__chips">
          {suggestions.slice(0, 3).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setDraft(suggestion)
                inputRef.current?.focus()
              }}
              className="rounded-full border border-line bg-surface px-1.5 py-0.5 text-[0.5625rem] text-fg-3 transition-colors hover:border-primary/40 hover:text-primary"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* 输入行 */}
      <form onSubmit={onSubmit} className="n-canvas-ai-dock__input">
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="让 AI 改写这个节点…"
          aria-label="AI 指令"
          className="h-6 min-w-0 flex-1 rounded border border-line bg-surface px-1.5 text-[0.6875rem] text-fg outline-none transition-[border-color,box-shadow] placeholder:text-fg-4 focus:border-primary/60 focus:ring-1 focus:ring-primary-ring"
        />
        {busy ? (
          <button type="button" onClick={stop} aria-label="停止生成" className="n-canvas-icon-btn n-canvas-icon-btn--danger !size-6">
            <StopIcon size={10} />
          </button>
        ) : (
          <button
            type="submit"
            aria-label="发送"
            disabled={!draft.trim()}
            className="n-canvas-icon-btn n-canvas-icon-btn--primary !size-6"
          >
            <SendIcon size={10} />
          </button>
        )}
      </form>
    </div>
  )
}
