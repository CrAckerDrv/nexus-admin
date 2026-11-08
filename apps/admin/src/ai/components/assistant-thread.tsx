import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ArrowUp,
  Check,
  Copy,
  CornerDownLeft,
  RotateCcw,
  Sparkles,
  Square,
  UserRound,
} from 'lucide-react'
import type { AssistantMessage, PageSpec } from '@nexus/ai-sdk'
import { Avatar, Badge, Button, Kbd, Textarea, cn, toast } from '@nexus/ui'
import { getAssistant, useAssistantSnapshot } from '@/ai'
import { useGeneratedPages } from '@/ai/page-store'
import { useAuthStore } from '@/core/auth-store'
import { useI18n } from '@/i18n'
import { PagePreviewCard } from './page-preview'
import { AssistantAvatar, ReasoningBlock, RichText, ToolCallList } from './message-parts'

/**
 * 助手对话流
 *
 * 抽屉与工作台共用：布局差异交给 `variant`，会话状态由内核单例承载。
 *
 * 视觉约定（对齐后台而不是「AI 产品」）：
 * - 助手消息**不套高饱和气泡**：正文直接落在底色上，靠身份行与留白分区，
 *   长回答读起来像文档而不是一串彩色方块
 * - 用户消息右对齐、中性底，不抢品牌色 —— 一屏出现两次高饱和就会显得吵
 * - 头像：助手用品牌字标，用户用**当前登录账号**的头像与姓名
 *
 * 三个交互细节：
 * 1. **流式不拼数组**：字幕是内核里的一个字符串，这里只读不写
 * 2. **自动滚动只在贴底时生效**：用户往上翻看历史时不该被拽回底部
 * 3. **空会话给可点建议**：首次打开就有事情可做，而不是一片空白
 */
export function AssistantThread({
  variant = 'panel',
  className,
}: {
  variant?: 'panel' | 'page'
  className?: string
}) {
  const { t } = useI18n()
  const snapshot = useAssistantSnapshot()
  const pages = useGeneratedPages((state) => state.pages)
  const appliedIds = useGeneratedPages((state) => state.appliedIds)
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const assistant = getAssistant()

  const messages = snapshot.messages
  const busy = snapshot.phase === 'thinking' || snapshot.phase === 'tool'
  const streaming = Boolean(snapshot.reasoningDraft || snapshot.draft)

  // 贴底时才跟随；用户往上滚则停止自动滚动
  useLayoutEffect(() => {
    const box = scrollRef.current
    if (!box || !stickToBottom.current) return
    box.scrollTop = box.scrollHeight
  }, [messages.length, snapshot.draft, snapshot.reasoningDraft, snapshot.activeTool])

  // 切换会话时重新贴底：新会话的第一屏应当看到最新内容
  const activeSessionId = snapshot.activeSessionId
  useEffect(() => {
    stickToBottom.current = true
    const box = scrollRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [activeSessionId])

  const onScroll = () => {
    const box = scrollRef.current
    if (!box) return
    stickToBottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < 48
  }

  const send = (text?: string) => {
    const content = (text ?? draft).trim()
    if (!content || busy) return
    stickToBottom.current = true
    setDraft('')
    void assistant.send(content)
  }

  const applyPage = (page: PageSpec) => {
    void assistant.applyPage(page).then((result) => {
      if (result.ok) toast.success(t('assistant.applyDone'))
      else toast.error(result.error ?? t('assistant.applyFailed'))
    })
  }

  const suggestions =
    messages.length === 0 ? [] : (messages[messages.length - 1]?.suggestions ?? [])

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col bg-surface', className)}>
      {/* 会话主体 */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className={cn(
          'min-h-0 flex-1 overflow-y-auto',
          variant === 'panel' ? 'px-4 pt-4 pb-2' : 'px-5 pt-5 pb-2',
        )}
        aria-live="polite"
        aria-busy={busy}
      >
        <div
          className={cn(
            'mx-auto flex w-full flex-col gap-5',
            variant === 'page' && 'max-w-[52rem]',
            // 空会话时把问候语垂直居中：否则上重下空，像一张没加载完的页面
            messages.length === 0 && !streaming && 'min-h-full justify-center gap-0 py-6',
          )}
        >
          {messages.length === 0 && !streaming && (
            <EmptyState variant={variant} onPick={(text) => send(text)} />
          )}

          {messages.map((message) => (
            <MessageRow
              key={message.id}
              message={message}
              pages={pages}
              appliedIds={appliedIds}
              onApply={applyPage}
              onOpen={(page) => assistant.openPage(page.path)}
              onAdjust={(page) => assistant.patchLastPage(page)}
              onSuggestion={send}
              variant={variant}
            />
          ))}

          {/* 正在生成的这一轮：思考链 + 字幕 + 工具状态 */}
          {busy && (
            <div className="flex gap-3">
              <AssistantAvatar />
              <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                {/* 思考链为空时不渲染空块：本地引擎的规划文本有几十毫秒延迟 */}
                {snapshot.reasoningDraft ? (
                  <ReasoningBlock text={snapshot.reasoningDraft} streaming />
                ) : null}
                {snapshot.draft ? (
                  <RichText text={snapshot.draft} streaming />
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-fg-3">
                    <span className="flex gap-0.5" aria-hidden="true">
                      <Dot delay="0ms" />
                      <Dot delay="140ms" />
                      <Dot delay="280ms" />
                    </span>
                    {snapshot.activeTool
                      ? t('assistant.runningTool', { name: snapshot.activeTool })
                      : t('assistant.thinking')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 建议胶囊 */}
      {suggestions.length > 0 && !busy && (
        <div className="flex shrink-0 flex-wrap gap-1.5 px-4 pt-1 pb-2">
          {suggestions.slice(0, 3).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => send(item)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1',
                'text-2xs text-fg-2 transition-colors hover:border-line-strong hover:bg-surface-2 hover:text-fg',
              )}
            >
              <Sparkles className="size-2.5 text-fg-4" />
              {item}
            </button>
          ))}
        </div>
      )}

      {/* 输入区 */}
      <div
        className={cn(
          'shrink-0 px-3 pb-3',
          variant === 'page' && 'mx-auto w-full max-w-[52rem] px-4',
        )}
      >
        <div className="rounded-xl border border-line bg-surface transition-[border-color,box-shadow] focus-within:border-line-strong focus-within:ring-2 focus-within:ring-primary-ring">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                send()
              }
            }}
            rows={variant === 'page' ? 3 : 2}
            autoResize
            placeholder={t('assistant.placeholder')}
            /* 组件库的 min-h / resize 落在内部 textarea 上，这里用子选择器覆盖：
               输入框随内容长高，但**不出现右下角的拖拽手柄** */
            className={cn(
              'border-0 focus-within:ring-0',
              '[&_textarea]:max-h-[40vh] [&_textarea]:min-h-[52px] [&_textarea]:resize-none',
              '[&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:text-[13px] [&_textarea]:leading-6',
            )}
            aria-label={t('assistant.placeholder')}
          />
          <div className="flex items-center gap-1.5 px-2 pb-1.5">
            <span className="hidden items-center gap-1 text-2xs text-fg-4 sm:flex">
              <Kbd>Enter</Kbd>
              {t('assistant.send')}
              <span className="mx-0.5 text-fg-4/60">·</span>
              <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd>
              {t('assistant.newline')}
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              {messages.length > 0 && !busy && (
                <Button
                  size="xs"
                  variant="ghost"
                  leftIcon={<RotateCcw className="size-3" />}
                  onClick={() => {
                    const lastUser = [...messages].reverse().find((item) => item.role === 'user')
                    if (lastUser) send(lastUser.content)
                  }}
                >
                  {t('assistant.regenerate')}
                </Button>
              )}
              {busy ? (
                <Button
                  size="icon-sm"
                  variant="secondary"
                  aria-label={t('assistant.stop')}
                  onClick={() => assistant.abort()}
                >
                  <Square className="size-3" />
                </Button>
              ) : (
                <Button
                  size="icon-sm"
                  variant="primary"
                  disabled={!draft.trim()}
                  aria-label={t('assistant.send')}
                  onClick={() => send()}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** 思考中的三个点：只做透明度起伏，不位移（元素静止时不能晃） */
function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="size-1 animate-pulse rounded-full bg-fg-4"
      style={{ animationDelay: delay, animationDuration: '1.1s' }}
    />
  )
}

/* ------------------------------------------------------------------ *
 * 空会话：把「助手能干什么」直接变成可点的入口
 * ------------------------------------------------------------------ */

function EmptyState({
  variant,
  onPick,
}: {
  variant: 'panel' | 'page'
  onPick: (text: string) => void
}) {
  const { t } = useI18n()
  const items = t('assistant.emptyActions')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [label, prompt] = line.split('::')
      return { label: label ?? '', prompt: prompt ?? label ?? '' }
    })

  return (
    <div className="pt-6 pb-2">
      <AssistantAvatar className="mt-0 mb-3 size-9 rounded-xl bg-surface-2" />
      <h3 className="text-[15px] font-semibold text-fg">{t('assistant.greeting')}</h3>
      <p className="mt-1 max-w-[34rem] text-xs leading-5 text-fg-3">
        {t('assistant.greetingDesc')}
      </p>
      <p className="mt-5 mb-2 text-2xs font-medium tracking-wide text-fg-4 uppercase">
        {t('assistant.suggestTitle')}
      </p>
      <div className={cn('grid gap-1.5', variant === 'page' ? 'sm:grid-cols-2' : 'grid-cols-1')}>
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onPick(item.prompt)}
            className={cn(
              'group flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-left',
              'transition-colors hover:border-line-strong hover:bg-surface-2',
            )}
          >
            <Sparkles className="size-3 shrink-0 text-fg-4" />
            <span className="min-w-0 flex-1 text-xs leading-5 text-fg-2 group-hover:text-fg">
              {item.label}
            </span>
            <CornerDownLeft className="size-3 shrink-0 text-fg-4 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 单条消息
 * ------------------------------------------------------------------ */

function MessageRow({
  message,
  pages,
  appliedIds,
  onApply,
  onOpen,
  onAdjust,
  onSuggestion,
  variant,
}: {
  message: AssistantMessage
  pages: PageSpec[]
  appliedIds: string[]
  onApply: (page: PageSpec) => void
  onOpen: (page: PageSpec) => void
  onAdjust: (page: PageSpec) => void
  onSuggestion: (text: string) => void
  variant: 'panel' | 'page'
}) {
  const { t } = useI18n()
  const isUser = message.role === 'user'
  const page = message.page
    ? (pages.find((item) => item.id === message.page?.id) ?? message.page)
    : undefined

  if (isUser) return <UserMessage content={message.content} createdAt={message.createdAt} />

  return (
    <div className="flex gap-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1 space-y-2 pt-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-fg">{t('assistant.assistantName')}</span>
          {message.engine === 'local' && (
            <Badge tone="warning" size="sm">
              {t('assistant.engineLocal')}
            </Badge>
          )}
        </div>

        {/* 思考链：先想后说，顺序与内核一致 */}
        {message.reasoning && (
          <ReasoningBlock text={message.reasoning} thinkingMs={message.thinkingMs} />
        )}

        {/* 工具调用：证据链 */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <ToolCallList calls={message.toolCalls} />
        )}

        {message.content ? <RichText text={message.content} /> : null}

        {/* 页面预览 */}
        {page && (
          <PagePreviewCard
            page={page}
            applied={appliedIds.includes(page.id)}
            onApply={() => onApply(page)}
            onOpen={() => onOpen(page)}
            onAdjust={(patch) => onAdjust({ ...page, ...patch })}
            variant={variant === 'page' ? 'full' : 'inline'}
          />
        )}

        <MessageMeta message={message} onSuggestion={onSuggestion} variant={variant} />
      </div>
    </div>
  )
}

/** 用户消息：右对齐，用当前登录账号的真实头像与姓名 */
function UserMessage({ content, createdAt }: { content: string; createdAt: number }) {
  const { t } = useI18n()
  const user = useAuthStore((state) => state.user)
  const name = user?.name || t('assistant.you')

  return (
    <div className="flex justify-end gap-2.5">
      <div className="flex max-w-[84%] min-w-0 flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-fg-4 tabular-nums">{formatClock(createdAt)}</span>
          <span className="text-xs font-medium text-fg-2">{name}</span>
        </div>
        <div className="rounded-xl rounded-tr-sm bg-surface-2 px-3.5 py-2 text-[13px] leading-6 whitespace-pre-wrap text-fg">
          {content}
        </div>
      </div>
      {/* 有账号就用账号头像（有图用图，无图用姓名首字），没有账号才退化为通用图标 */}
      {user ? (
        <Avatar name={name} src={user.avatar} size="sm" className="mt-4" />
      ) : (
        <span
          aria-hidden="true"
          className="mt-4 grid size-7 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-2"
        >
          <UserRound className="size-3.5" />
        </span>
      )}
    </div>
  )
}

/** 元信息：模型 / 耗时 / 工具数 / 复制 */
function MessageMeta({
  message,
  onSuggestion,
  variant,
}: {
  message: AssistantMessage
  onSuggestion: (text: string) => void
  variant: 'panel' | 'page'
}) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)

  const copy = () => {
    void navigator.clipboard?.writeText(message.content)
    setCopied(true)
    toast.success(t('common.copied'))
    setTimeout(() => setCopied(false), 1600)
  }

  const meta = [
    message.model ? { label: t('assistant.modelLabel'), value: message.model } : null,
    message.latencyMs
      ? { label: t('assistant.latencyLabel'), value: `${(message.latencyMs / 1000).toFixed(1)}s` }
      : null,
    message.toolCalls?.length
      ? { label: t('assistant.toolCalls'), value: String(message.toolCalls.length) }
      : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item))

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-0.5 text-2xs text-fg-4">
      {meta.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1">
          <span>{item.label}</span>
          <span className="font-mono text-fg-3 tabular-nums">{item.value}</span>
        </span>
      ))}
      {message.content ? (
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-0.5 transition-colors hover:text-fg-2"
        >
          {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
          {t('common.copy')}
        </button>
      ) : null}
      {message.suggestions && message.suggestions.length > 0 && variant === 'page' && (
        <button
          type="button"
          onClick={() => onSuggestion(message.suggestions?.[0] ?? '')}
          className="inline-flex items-center gap-0.5 text-primary transition-colors hover:underline"
        >
          <CornerDownLeft className="size-3" />
          {message.suggestions[0]}
        </button>
      )}
    </div>
  )
}

/** 时间戳：同一天只显示时分，跨天带上日期，避免每条都重复一大串 */
function formatClock(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  const pad = (value: number) => String(value).padStart(2, '0')
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  return sameDay ? clock : `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${clock}`
}
