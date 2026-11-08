import { useState, type ReactNode } from 'react'
import { BrainCircuit, Check, ChevronRight, CircleAlert, LoaderCircle, Wrench } from 'lucide-react'
import type { ToolCallRecord } from '@nexus/ai-sdk'
import { cn } from '@nexus/ui'
import { useI18n, type DictKey } from '@/i18n'
import { NexusMark } from '@/components/brand-icons'

/**
 * 对话里的「零件」
 *
 * 抽成独立文件的原因：抽屉与整页工作台用的是同一套消息渲染，
 * 而思考链 / 工具调用是这次新增的两块重内容，单独维护比塞进 thread 更好改。
 *
 * 视觉取向：**去 AI 味**。
 * 不用渐变、不用发光、不用机器人头像；身份用品牌字标，信息用字重与留白区分，
 * 组件本身尽量贴近后台里已有的列表与卡片语言。
 */

/* ------------------------------------------------------------------ *
 * 身份
 * ------------------------------------------------------------------ */

/** 助手头像：品牌字标 + 中性底，代替「机器人 + 渐变」的通用 AI 图标 */
export function AssistantAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-fg',
        className,
      )}
    >
      <NexusMark className="h-3.5 w-auto" />
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * 思考链
 * ------------------------------------------------------------------ */

/**
 * 思考链
 *
 * 三条原则：
 * 1. **默认折叠**：思考过程是证据，不是正文；展开与否由用户决定
 * 2. **流式时自动展开**：正在思考却藏起来，用户只会看到一段空白等待
 * 3. **结束后可重新展开**：答案不对劲时，第一件事就是回看它是怎么想的
 */
export function ReasoningBlock({
  text,
  streaming,
  thinkingMs,
}: {
  text: string
  streaming?: boolean
  thinkingMs?: number
}) {
  const { t } = useI18n()
  const [manual, setManual] = useState<boolean | null>(null)
  const open = manual ?? Boolean(streaming)
  const lines = text.split('\n').filter((line) => line.trim().length > 0)

  if (!text.trim() && !streaming) return null

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border',
        streaming ? 'border-primary/25 bg-primary-weak/20' : 'border-line bg-surface-2/50',
      )}
    >
      <button
        type="button"
        onClick={() => setManual(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left transition-colors hover:bg-surface-2"
      >
        {streaming ? (
          <LoaderCircle className="size-3 shrink-0 animate-spin text-primary" />
        ) : (
          <BrainCircuit className="size-3 shrink-0 text-fg-4" />
        )}
        <span className={cn('text-2xs font-medium', streaming ? 'text-primary' : 'text-fg-3')}>
          {streaming ? t('assistant.thinkingLive') : t('assistant.thinkingProcess')}
        </span>
        {!streaming && thinkingMs ? (
          <span className="text-2xs text-fg-4 tabular-nums">
            · {t('assistant.thinkingSeconds', { s: (thinkingMs / 1000).toFixed(1) })}
          </span>
        ) : null}
        {!streaming && lines.length > 0 && (
          <span className="text-2xs text-fg-4">
            {t('assistant.thinkingSteps', { n: lines.length })}
          </span>
        )}
        <ChevronRight
          className={cn(
            'ml-auto size-3 shrink-0 text-fg-4 transition-transform duration-200',
            open && 'rotate-90',
          )}
        />
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-[var(--ease-out-expo)]',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-1 border-t border-line/60 px-2.5 py-2">
            {lines.length === 0 ? (
              <p className="text-2xs text-fg-4">{t('assistant.thinkingEmpty')}</p>
            ) : (
              lines.map((line, index) => (
                <p key={index} className="text-xs leading-5 text-fg-3">
                  {line}
                </p>
              ))
            )}
            {streaming && (
              <span className="inline-block h-3 w-1 animate-pulse rounded-sm bg-primary align-middle" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 工具调用
 * ------------------------------------------------------------------ */

const TOOL_LABEL: Record<string, DictKey> = {
  create_page: 'assistant.toolCreate',
  update_page: 'assistant.toolUpdate',
  apply_page: 'assistant.toolApply',
  list_api_operations: 'assistant.toolList',
  explain_backend_integration: 'assistant.toolGuide',
  call_api: 'assistant.toolApi',
}

function toolLabel(name: string, t: (key: DictKey) => string): string {
  const key = TOOL_LABEL[name]
  if (key) return t(key)
  if (name.startsWith('api_')) return `${t('assistant.toolApi')} · ${name.slice(4)}`
  return name
}

function duration(call: ToolCallRecord): string {
  if (!call.finishedAt) return ''
  const ms = call.finishedAt - call.startedAt
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

/**
 * 工具调用清单
 *
 * 每条一行：状态点 + 工具名 + 耗时；点开才看参数与结果。
 * 这样「专家用户」能追溯证据链，「普通用户」也不会被 JSON 淹没。
 */
export function ToolCallList({ calls }: { calls: ToolCallRecord[] }) {
  if (!calls.length) return null
  return (
    <div className="space-y-1">
      {calls.map((call) => (
        <ToolCallRow key={call.id} call={call} />
      ))}
    </div>
  )
}

/**
 * 单条工具
 *
 * 展开区只放**原始参数**与**失败原因**：
 * 成功的 `summary` 已经由助手在正文里转述过一遍，再原样贴一次就是同一段话出现两遍。
 * 参数为空（无参工具）且没报错时，这条行不通向任何信息 —— 索性不给箭头。
 */
function ToolCallRow({ call }: { call: ToolCallRecord }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const failed = Boolean(call.error)
  const pending = !call.finishedAt
  const args = prettyJson(call.rawArguments)
  const hasArgs = args.trim() !== '' && args.trim() !== '{}'
  const detail = failed ? call.error : undefined
  const expandable = hasArgs || Boolean(detail)

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border',
        failed ? 'border-danger/30 bg-danger-weak/40' : 'border-line bg-surface-2/40',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={expandable ? open : undefined}
        disabled={!expandable}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left disabled:cursor-default"
      >
        <span
          className={cn(
            'grid size-3.5 shrink-0 place-items-center',
            failed ? 'text-danger' : pending ? 'text-primary' : 'text-success',
          )}
        >
          {failed ? (
            <CircleAlert className="size-3" />
          ) : pending ? (
            <LoaderCircle className="size-3 animate-spin" />
          ) : (
            <Check className="size-3" strokeWidth={3} />
          )}
        </span>
        <Wrench className="size-2.5 shrink-0 text-fg-4" />
        <span className="min-w-0 truncate text-2xs font-medium text-fg-2">
          {toolLabel(call.name, t)}
        </span>
        <span className="shrink-0 text-2xs text-fg-4 tabular-nums">
          {failed
            ? t('assistant.toolFailed')
            : pending
              ? t('assistant.toolRunning')
              : duration(call)}
        </span>
        {expandable && (
          <ChevronRight
            className={cn(
              'ml-auto size-3 shrink-0 text-fg-4 transition-transform duration-200',
              open && 'rotate-90',
            )}
          />
        )}
      </button>
      {open && expandable && (
        <div className="n-reveal space-y-2 border-t border-line/60 px-2 py-2">
          {hasArgs && (
            <ToolField label={t('assistant.toolArgs')}>
              {/* 参数可能很长（模型偶尔塞整段对象）：给一个上限并允许内部滚动，
                  否则一条工具调用能把整屏对话顶出去 */}
              <p className="max-h-[200px] overflow-auto rounded-sm bg-surface-3/60 p-1.5 font-mono text-[11px] leading-4 break-words whitespace-pre-wrap text-fg-2">
                {args}
              </p>
            </ToolField>
          )}
          {detail && (
            <ToolField label={t('assistant.toolResult')}>
              <p className="max-h-[200px] overflow-auto text-[11px] leading-4 break-words whitespace-pre-wrap text-danger">
                {detail}
              </p>
            </ToolField>
          )}
        </div>
      )}
    </div>
  )
}

function ToolField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-medium tracking-wide text-fg-4 uppercase">{label}</p>
      {children}
    </div>
  )
}

/** 参数格式化：能美化就美化，解析失败就原样展示（模型偶尔会给半截 JSON） */
function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw || '{}'
  }
}

/* ------------------------------------------------------------------ *
 * 极简富文本
 *
 * 只支持助手真正会输出的语法：**加粗**、`行内代码`、围栏代码块、- 列表、1. 有序列表。
 * 刻意不引 markdown 库：多 40KB 换几个渲染分支并不划算。
 * ------------------------------------------------------------------ */

export function RichText({ text, streaming }: { text: string; streaming?: boolean }) {
  const blocks = text.split(/(```[\s\S]*?```)/g)
  return (
    <div className="space-y-1.5 text-[13px] leading-6 text-fg-2">
      {blocks.map((block, index) => {
        if (block.startsWith('```')) {
          const body = block.replace(/^```\w*\n?/, '').replace(/```$/, '')
          return (
            <pre
              key={index}
              className="overflow-x-auto rounded-md border border-line bg-surface-2 p-2.5 font-mono text-2xs leading-5 text-fg-2"
            >
              {body.trimEnd()}
            </pre>
          )
        }
        return (
          <div key={index} className="space-y-1">
            {block
              .split('\n')
              .filter((line) => line.trim().length > 0)
              .map((line, lineIndex) => (
                <Line key={lineIndex} line={line} />
              ))}
          </div>
        )
      })}
      {streaming && (
        <span className="inline-block h-3.5 w-1 animate-pulse rounded-sm bg-primary align-middle" />
      )}
    </div>
  )
}

function Line({ line }: { line: string }) {
  const bullet = /^[-*]\s+/.exec(line)
  const ordered = /^(\d+)[.)]\s+/.exec(line)
  if (bullet) {
    return (
      <p className="flex gap-1.5">
        <span className="mt-2.5 size-1 shrink-0 rounded-full bg-fg-4" />
        <span className="min-w-0 flex-1">{renderInline(line.replace(bullet[0], ''))}</span>
      </p>
    )
  }
  if (ordered) {
    return (
      <p className="flex gap-1.5">
        <span className="shrink-0 text-2xs font-semibold text-fg-4 tabular-nums">
          {ordered[1]}.
        </span>
        <span className="min-w-0 flex-1">{renderInline(line.replace(ordered[0], ''))}</span>
      </p>
    )
  }
  if (line.startsWith('### ')) {
    return <p className="pt-0.5 text-xs font-semibold text-fg">{line.slice(4)}</p>
  }
  return <p>{renderInline(line)}</p>
}

function renderInline(line: string): ReactNode {
  const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-fg">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-fg">
          {part.slice(1, -1)}
        </code>
      )
    }
    return <span key={index}>{part}</span>
  })
}
