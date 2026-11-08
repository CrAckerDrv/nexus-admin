import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  Bot,
  Check,
  CircleAlert,
  Copy,
  CornerDownLeft,
  RotateCcw,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  User,
  WandSparkles,
  Zap,
} from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CodeBlock,
  Kbd,
  PageContainer,
  PageHeader,
  Tag,
  Textarea,
  cn,
  toast,
} from '@nexus/ui'

/**
 * AI 助手对话
 *
 * 关键实现：
 * 1. **流式输出用逐步揭示已有文本，而不是每帧 setState 拼接字符串**
 *    —— 后者在长回答下会产生大量中间数组，这里只维护一个 cursor 数字
 * 2. 回答内容是预置的（演示不需要真连模型），但渲染路径与真实流式一致
 * 3. 支持「停止生成」「重新生成」「复制」「反馈」四个真实交互
 * 4. 引用来源可展开，模拟 RAG 场景
 */

interface Citation {
  id: string
  title: string
  source: string
  snippet: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  /** 助手消息是否走流式 */
  streaming?: boolean
  /** 流式完成后的耗时（ms） */
  latency?: number
  feedback?: 'up' | 'down' | null
}

const SUGGESTIONS = [
  {
    icon: Zap,
    label: '生成本月经营分析摘要',
    prompt: '帮我总结本月经营情况，重点看转化率和退款率',
  },
  {
    icon: Sparkles,
    label: '排查支付回调延迟',
    prompt: 'pay-svc 的支付回调 P95 延迟 820ms，帮我列出排查步骤',
  },
  {
    icon: WandSparkles,
    label: '写一条 SQL 统计留存',
    prompt: '写一条 SQL，统计近 7 日新增用户的次日留存率',
  },
]

/** 演示用的预置回答（含代码块与引用） */
const ANSWERS: Record<string, { text: string; citations: Citation[] }> = {
  default: {
    text: `好的，我从三个维度梳理一下：

**1. 转化率**
本月整体转化率 4.68%，环比 +0.8%。主要贡献来自「官网直达」渠道，其转化率比自然搜索高 1.9 倍。建议维持官网的投放预算。

**2. 退款率**
退款率 1.24%，处于健康区间（阈值 2%）。但 \`pay-svc\` 的回调延迟会间接推高「支付超时」导致的被动退款，需要优先处理。

**3. 建议动作**
- 把 \`pay-svc\` 的 P95 阈值从 500ms 下调到 300ms，提前暴露问题
- 对「待支付超过 15 分钟」的订单增加一次主动提醒

如果需要，我可以直接生成一份可导出 PDF 的分析报告。`,
    citations: [
      {
        id: 'c1',
        title: '2026-11 经营月报',
        source: 'reports/monthly/2026-11.md',
        snippet: '本月整体转化率 4.68%，环比上升 0.8 个百分点……',
      },
      {
        id: 'c2',
        title: '支付链路 SLO 定义',
        source: 'docs/slo.md',
        snippet: 'pay-svc 支付回调 P95 目标 500ms，错误预算每月 0.5%……',
      },
    ],
  },
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'm1',
    role: 'assistant',
    content:
      '你好，我是 Nexus 助手。我接入了经营数据、审计日志与组件文档，可以直接提问。\n\n试试下面的建议，或者直接输入你的问题。',
    latency: 820,
  },
]

export default function AiChatPage() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [draft, setDraft] = useState('')
  const [generating, setGenerating] = useState(false)
  /** 已揭示的字符数，用数字驱动渲染，避免频繁拼接长字符串 */
  const [cursor, setCursor] = useState(0)
  const streamRef = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef(false)

  const activeAssistant = useMemo(
    () => messages.find((message) => message.streaming) ?? null,
    [messages],
  )

  // 流式揭示
  useEffect(() => {
    if (!activeAssistant) return
    abortRef.current = false
    const full = activeAssistant.content
    const start = performance.now()

    const step = () => {
      if (abortRef.current) return
      setCursor((prev) => {
        const next = Math.min(prev + 3 + Math.floor(Math.random() * 4), full.length)
        if (next >= full.length) {
          // 收尾：标记完成并记录耗时
          setMessages((list) =>
            list.map((message) =>
              message.id === activeAssistant.id
                ? {
                    ...message,
                    streaming: false,
                    latency: Math.round(performance.now() - start),
                  }
                : message,
            ),
          )
          setGenerating(false)
          return full.length
        }
        return next
      })
      streamRef.current = requestAnimationFrame(step)
    }
    streamRef.current = requestAnimationFrame(step)

    return () => {
      if (streamRef.current) cancelAnimationFrame(streamRef.current)
    }
  }, [activeAssistant])

  // 自动滚到底
  useEffect(() => {
    const box = scrollRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [messages, cursor])

  const send = (text?: string) => {
    const content = (text ?? draft).trim()
    if (!content || generating) return

    const answer = ANSWERS.default!
    const userMessage: Message = { id: `u-${Date.now()}`, role: 'user', content }
    const assistantMessage: Message = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: answer.text,
      citations: answer.citations,
      streaming: true,
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setDraft('')
    setCursor(0)
    setGenerating(true)
  }

  const stop = () => {
    abortRef.current = true
    if (streamRef.current) cancelAnimationFrame(streamRef.current)
    setGenerating(false)
    setMessages((list) =>
      list.map((message) =>
        message.streaming ? { ...message, streaming: false, latency: 0 } : message,
      ),
    )
    toast.info('已停止生成')
  }

  const regenerate = () => {
    const answer = ANSWERS.default!
    setMessages((list) => {
      // 找到最后一条助手消息，重置为流式
      const index = [...list].reverse().findIndex((message) => message.role === 'assistant')
      if (index === -1) return list
      const target = list.length - 1 - index
      return list.map((message, i) =>
        i === target
          ? { ...message, content: answer.text, citations: answer.citations, streaming: true }
          : message,
      )
    })
    setCursor(0)
    setGenerating(true)
  }

  return (
    <PageContainer size="lg">
      <PageHeader
        title="AI 助手对话"
        description="流式输出、引用来源、指令模板；渲染路径与真实模型一致，替换 stream 数据源即可接入"
        badge={<Badge tone="primary">AI</Badge>}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RotateCcw className="size-3.5" />}
              onClick={regenerate}
            >
              重新生成
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setMessages(INITIAL_MESSAGES)
                setCursor(0)
                setGenerating(false)
                toast.success('已开始新会话')
              }}
            >
              新会话
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_16.75rem]">
        {/* 对话区 */}
        <Card bare className="flex h-[calc(100dvh-14.5rem)] flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
            <span className="grid size-7 place-items-center rounded-md bg-primary-weak text-primary">
              <Bot className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.8125rem] font-semibold text-fg">Nexus 助手</p>
              <p className="text-2xs text-fg-3">已接入经营数据 · 审计日志 · 组件文档</p>
            </div>
            <Badge tone="success" dot size="sm">
              在线
            </Badge>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 py-3">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                revealed={message.streaming ? cursor : message.content.length}
                onFeedback={(value) =>
                  setMessages((list) =>
                    list.map((item) =>
                      item.id === message.id
                        ? { ...item, feedback: item.feedback === value ? null : value }
                        : item,
                    ),
                  )
                }
              />
            ))}

            {generating && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Square className="size-3" />}
                  onClick={stop}
                >
                  停止生成
                </Button>
                <span className="text-2xs text-fg-4">正在生成…</span>
              </div>
            )}
          </div>

          {/* 输入区 */}
          <div className="border-t border-line p-3">
            <div className="focus-within:ring-primary-ring rounded-lg border border-line bg-surface transition-[border-color,box-shadow] focus-within:border-primary/70 focus-within:ring-2">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    send()
                  }
                }}
                placeholder="输入问题，Enter 发送，Shift + Enter 换行"
                showCount
                maxLength={2000}
                className="border-0 focus-within:ring-0"
              />
              <div className="flex items-center gap-2 border-t border-line-subtle px-2.5 py-1.5">
                <span className="flex items-center gap-1 text-2xs text-fg-4">
                  <Kbd>Enter</Kbd> 发送
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  {generating ? (
                    <Button size="sm" variant="secondary" onClick={stop}>
                      停止
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={!draft.trim()}
                      leftIcon={<ArrowDown className="size-3.5" />}
                      onClick={() => send()}
                    >
                      发送
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* 右侧：建议与指令 */}
        <div className="space-y-3">
          <Card className="p-3">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-fg">
              <Sparkles className="size-3.5 text-primary" />
              试试这样问
            </h3>
            <div className="space-y-1.5">
              {SUGGESTIONS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => send(item.prompt)}
                  className="group flex w-full items-start gap-2 rounded-md border border-line px-2.5 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary-weak/30"
                >
                  <item.icon className="mt-0.5 size-3.5 shrink-0 text-fg-3 group-hover:text-primary" />
                  <span className="min-w-0 flex-1 text-xs leading-5 text-fg-2 group-hover:text-fg">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-3">
            <h3 className="mb-2 text-xs font-semibold text-fg">会话能力</h3>
            <ul className="space-y-1.5 text-2xs text-fg-3">
              {[
                '流式逐字输出，可随时停止',
                '引用来源可展开查看原文',
                '回答支持复制与点赞/踩',
                'Enter 发送 · Shift+Enter 换行',
              ].map((line) => (
                <li key={line} className="flex items-start gap-1.5">
                  <Check className="mt-0.5 size-3 shrink-0 text-success" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-3">
            <h3 className="mb-1.5 text-xs font-semibold text-fg">接入方式</h3>
            <p className="text-2xs leading-5 text-fg-3">
              把 <code className="rounded bg-surface-2 px-1 font-mono">ANSWERS</code>{' '}
              换成你的流式接口， 用{' '}
              <code className="rounded bg-surface-2 px-1 font-mono">ReadableStream</code> 逐块追加到{' '}
              <code className="rounded bg-surface-2 px-1 font-mono">content</code> 即可。
            </p>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}

function MessageBubble({
  message,
  revealed,
  onFeedback,
}: {
  message: Message
  revealed: number
  onFeedback: (value: 'up' | 'down') => void
}) {
  const isUser = message.role === 'user'
  const visible = message.content.slice(0, revealed)

  return (
    <div className={cn('flex gap-2.5', isUser && 'flex-row-reverse')}>
      {isUser ? (
        <Avatar name="我" size="sm" className="shrink-0" />
      ) : (
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary-weak text-primary">
          <Bot className="size-3.5" />
        </span>
      )}

      <div className={cn('max-w-[82%] min-w-0', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-[0.8125rem] leading-6',
            isUser ? 'bg-primary text-primary-fg' : 'border border-line bg-surface text-fg-2',
          )}
        >
          {isUser ? (
            visible
          ) : (
            <RichText
              text={visible}
              streaming={Boolean(message.streaming) && revealed < message.content.length}
            />
          )}
        </div>

        {/* 助手消息的元信息与操作 */}
        {!isUser && !message.streaming && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {message.latency !== undefined && message.latency > 0 && (
              <span className="text-2xs text-fg-4 tabular-nums">耗时 {message.latency}ms</span>
            )}
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(message.content)
                toast.success('已复制回答')
              }}
              className="inline-flex items-center gap-0.5 text-2xs text-fg-4 transition-colors hover:text-fg-2"
            >
              <Copy className="size-3" />
              复制
            </button>
            <button
              type="button"
              onClick={() => onFeedback('up')}
              aria-label="有帮助"
              className={cn(
                'inline-flex items-center gap-0.5 text-2xs transition-colors',
                message.feedback === 'up' ? 'text-success' : 'text-fg-4 hover:text-fg-2',
              )}
            >
              <ThumbsUp className="size-3" />
            </button>
            <button
              type="button"
              onClick={() => onFeedback('down')}
              aria-label="没帮助"
              className={cn(
                'inline-flex items-center gap-0.5 text-2xs transition-colors',
                message.feedback === 'down' ? 'text-danger' : 'text-fg-4 hover:text-fg-2',
              )}
            >
              <ThumbsDown className="size-3" />
            </button>
          </div>
        )}

        {/* 引用来源 */}
        {!isUser && message.citations && revealed >= message.content.length && (
          <div className="mt-1.5 w-full space-y-1">
            {message.citations.map((citation) => (
              <details
                key={citation.id}
                className="group rounded-md border border-line bg-surface-2/60 px-2 py-1.5"
              >
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-2xs text-fg-2">
                  <CornerDownLeft className="size-3 shrink-0 text-fg-4" />
                  <span className="min-w-0 flex-1 truncate">{citation.title}</span>
                  <Tag tone="neutral" className="h-[1rem] shrink-0 px-1 text-[0.625rem]">
                    {citation.source}
                  </Tag>
                </summary>
                <p className="mt-1 border-t border-line-subtle pt-1 text-2xs leading-5 text-fg-3">
                  {citation.snippet}
                </p>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 极简富文本渲染
 *
 * 只支持演示需要的三种语法：**加粗**、`行内代码`、围栏代码块。
 * 刻意不引入 markdown 库 —— 模板里 90% 的对话场景用不到完整语法。
 */
function RichText({ text, streaming }: { text: string; streaming: boolean }) {
  const blocks = text.split(/(```[\s\S]*?```)/g)

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.startsWith('```')) {
          const body = block.replace(/^```\w*\n?/, '').replace(/```$/, '')
          return <CodeBlock key={index} code={body} language="sql" maxHeight={220} />
        }
        return (
          <div key={index} className="space-y-1.5">
            {block
              .split('\n')
              .filter((line) => line.trim().length > 0)
              .map((line, lineIndex) => (
                <p key={lineIndex} className="leading-6">
                  {renderInline(line)}
                </p>
              ))}
          </div>
        )
      })}
      {streaming && (
        <span className="inline-block h-4 w-1.5 animate-pulse rounded-sm bg-primary align-middle" />
      )}
    </div>
  )
}

/** 行内语法：**bold** 与 `code` */
function renderInline(line: string) {
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
        <code
          key={index}
          className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-primary"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('- ') || part.startsWith('* ')) {
      return (
        <span key={index} className="flex gap-1.5">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-fg-4" />
          <span>{part.slice(2)}</span>
        </span>
      )
    }
    return <span key={index}>{part}</span>
  })
}

void CircleAlert
void User
