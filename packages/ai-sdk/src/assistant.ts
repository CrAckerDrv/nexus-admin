import { BUILTIN_TOOLS, apiOperationTools, type ToolDefinition } from './tools'
import { planLocally, detectIntent } from './planner'
import type { PageSpec } from './page-spec'
import type { ApiExecutor, AssistantRuntimeOptions, PagePort } from './ports'
import type {
  AssistantApiBridge,
  AssistantApiOperation,
  AssistantApiResult,
  AssistantEvent,
  AssistantHistoryPort,
  AssistantHistorySnapshot,
  AssistantMessage,
  AssistantSessionSummary,
  AssistantStoredSession,
  AssistantTransport,
  ChatMessage,
  ToolCallRecord,
  ToolContext,
  ToolOutcome,
} from './types'

/**
 * 助手内核 · 纯 TypeScript
 *
 * 不依赖 React：界面通过 `subscribe` + `getSnapshot`（useSyncExternalStore）订阅，
 * 因此同一份内核可以给 React / Vue / 原生页面用。
 *
 * 一轮对话的流程：
 *   用户输入 → 组装消息（含系统提示 + 工具清单）
 *   → transport.stream()（思考链 + 流式字幕）
 *   → 若模型要求调用工具：执行工具 → 把结果回灌模型 → 再取值
 *   → 最多 3 轮工具循环，最后落成一条 assistant 消息
 * 模型不可用时（无 key / 网关报错）自动切到本地规划器，并把原因写进界面。
 *
 * 多会话：
 * - 会话是「消息 + 当前页面」的容器，新建/切换/删除都不丢已生成页面与「已应用」状态
 * - 每轮结束才落盘（历史端口），流式分片不写存储
 * - `activeId` 也一起持久化，刷新后回到上次那段对话
 */

export interface AssistantConfig extends AssistantRuntimeOptions {
  transport?: AssistantTransport
  /** 追加的工具（与内置工具合并） */
  tools?: ToolDefinition[]
  /** 后端操作清单的读取函数（默认读注册表快照） */
  operations?: () => AssistantApiOperation[]
  /** 系统提示词覆盖 */
  systemPrompt?: (context: { lastPage?: PageSpec; locale: string }) => string
  /** 最多工具循环轮次 */
  maxToolRounds?: number
  /** 会话持久化端口（不提供则只在内存里保留多会话） */
  history?: AssistantHistoryPort
  /** 会话数上限，超出时丢弃最旧的非置顶会话 */
  maxSessions?: number
}

export type AssistantPhase = 'idle' | 'thinking' | 'tool' | 'done' | 'error'

export interface AssistantSnapshot {
  /** 当前会话的消息 */
  messages: AssistantMessage[]
  /** 流式中的字幕（未落成消息前） */
  draft: string
  /** 流式中的思考链（模型推理流 / 本地引擎的规划说明） */
  reasoningDraft: string
  /** 当前正在执行的工具名 */
  activeTool?: string
  phase: AssistantPhase
  /** 当前会话最近一次生成/修改的页面 */
  lastPage?: PageSpec
  /** 已相对页面库应用的 id 集合 */
  applied: string[]
  /** 传输层是否可用 */
  engine: { available: boolean; label: string; model?: string }
  /** 降级原因（null 表示模型链路正常） */
  fallbackReason: string | null
  /** 会话列表（不含消息体，按最近更新排序） */
  sessions: AssistantSessionSummary[]
  /** 当前会话 id */
  activeSessionId: string
}

type Listener = () => void

/** 内核里的完整会话记录：比对外的 summary 多带消息体与当前页面 */
interface SessionRecord {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  pinned: boolean
  messages: AssistantMessage[]
  lastPage?: PageSpec
}

const DEFAULT_SYSTEM = `你是 Nexus Admin 的 AI 运营助手，运行在管理后台右侧的助手抽屉里。
你的用户是运营/项目负责人，不是工程师。请用简体中文（除非用户用英文）简洁回答。

能做的事：
1. create_page：把一句话需求变成可预览的后台页面。用户说「帮我实现一个 XX 页面」时必须调用它。
2. update_page：调整已生成页面的配色、圆角、密度、标题、区块。
3. apply_page：把页面正式写入项目侧边栏。
4. list_api_operations / call_api：查看并调用项目已注册的后端接口。
5. explain_backend_integration：解释客户如何把后端接口交给助手。

风格要求：
- 先说结论，再补一句关键信息；不要复述工具参数。
- 不要输出 React 代码或 markdown 表格；页面效果由预览区承担。
- 生成页面后主动给 2~3 个可选下一步（配色、加图表、应用到侧边栏）。`

const MAX_TOOL_ROUNDS = 3
const TOOL_RESULT_SNIPPET = 1200
const DEFAULT_MAX_SESSIONS = 30
const TITLE_LENGTH = 22
const PREVIEW_LENGTH = 60

let sequence = 0
const nextId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(sequence += 1)}`

function createSession(title?: string): SessionRecord {
  const now = Date.now()
  return {
    id: nextId('s'),
    title: title ?? '',
    createdAt: now,
    updatedAt: now,
    pinned: false,
    messages: [],
  }
}

/** 单行摘要：给会话列表用的「最近说了什么」 */
function toPreview(message: AssistantMessage | undefined): string {
  if (!message) return ''
  return message.content.replace(/\s+/g, ' ').trim().slice(0, PREVIEW_LENGTH)
}

function deriveTitle(prompt: string): string {
  const clean = prompt.replace(/\s+/g, ' ').trim()
  return clean.length > TITLE_LENGTH ? `${clean.slice(0, TITLE_LENGTH)}…` : clean || '新会话'
}

/** 本地引擎的「思考过程」：把规划器做出的判断如实写出来，而不是假装在推理 */
function localReasoning(prompt: string, hasPage: boolean, page?: PageSpec): string {
  const intent = detectIntent(prompt, hasPage)
  const steps: string[] = [
    `解析需求：「${prompt.slice(0, 40)}${prompt.length > 40 ? '…' : ''}」`,
    `意图判定：${INTENT_LABEL[intent] ?? intent}`,
  ]
  if (intent === 'create-page') {
    steps.push('选型：匹配内置页面结构与区块顺序')
    steps.push('生成：页面规格（KPI / 图表 / 表格）')
  } else if (intent === 'update-visual') {
    steps.push('定位：当前页面主题令牌')
    steps.push('改写：只覆盖被提到的字段')
  } else if (intent === 'list-apis' || intent === 'call-api') {
    steps.push('查询：已登记的后端操作清单')
  }
  if (page) steps.push(`输出：${page.blocks.length} 个区块，等待确认`)
  return steps.join('\n')
}

const INTENT_LABEL: Record<string, string> = {
  'create-page': '生成页面',
  'update-visual': '调整视觉',
  'update-title': '修改标题',
  'apply-page': '应用到侧边栏',
  'list-apis': '查询接口清单',
  'call-api': '调用后端接口',
  'backend-guide': '后端接入说明',
  help: '能力说明',
  chat: '普通对话',
}

export class AssistantCore {
  private config: AssistantConfig
  private listeners = new Set<Listener>()
  private stored: Map<string, SessionRecord> = new Map()
  private activeId = ''
  private abortController: AbortController | null = null
  private pagePort?: PagePort
  private executeApi?: ApiExecutor
  private tools: ToolDefinition[]

  /** 「活」的状态：不属于任何一段历史，切换会话时保持不变 */
  private live = {
    draft: '',
    reasoningDraft: '',
    phase: 'idle' as AssistantPhase,
    activeTool: undefined as string | undefined,
    fallbackReason: null as string | null,
    applied: [] as string[],
  }

  private cached: AssistantSnapshot | null = null

  constructor(config: AssistantConfig = {}) {
    this.config = config
    this.pagePort = config.pages
    this.executeApi = config.executeApi
    this.tools = [...BUILTIN_TOOLS, ...(config.tools ?? [])]
    this.hydrate(config.history?.load())
  }

  /* ---------------- 订阅（useSyncExternalStore 契约） ---------------- */

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): AssistantSnapshot => {
    this.cached ??= this.buildSnapshot()
    return this.cached
  }

  private invalidate() {
    this.cached = null
    this.listeners.forEach((listener) => listener())
  }

  /**
   * 事件通道
   *
   * 工具内部也会往上抛（例如 `apply_page` 自己产生一版新页面规格），
   * 这类「非主流程产出的页面」同样要写回当前会话，否则界面上的
   * 「当前页面」会落后于工具的真实结果。
   */
  private emit = (event: AssistantEvent): void => {
    if (event.type === 'page') this.patchActive({ lastPage: event.page })
  }

  private buildSnapshot(): AssistantSnapshot {
    const session = this.current()
    return {
      messages: session?.messages ?? [],
      draft: this.live.draft,
      reasoningDraft: this.live.reasoningDraft,
      activeTool: this.live.activeTool,
      phase: this.live.phase,
      lastPage: session?.lastPage,
      applied: this.live.applied,
      engine: {
        available: Boolean(this.config.transport?.isConfigured()),
        label: this.config.transport?.label ?? '本地引擎',
        model: this.config.transport?.model,
      },
      fallbackReason: this.live.fallbackReason,
      sessions: this.summaries(),
      activeSessionId: this.activeId,
    }
  }

  /** 会话清单：置顶优先，其余按最近更新倒序 */
  private summaries(): AssistantSessionSummary[] {
    return [...this.stored.values()]
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return b.updatedAt - a.updatedAt
      })
      .map((session) => ({
        id: session.id,
        title: session.title || '新会话',
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: session.messages.length,
        pinned: session.pinned,
        preview: toPreview([...session.messages].reverse().find((m) => m.role === 'user')),
      }))
  }

  private current(): SessionRecord | undefined {
    return this.stored.get(this.activeId)
  }

  /** 当前会话必须存在：任何一条对外路径都不该因为空映射而崩 */
  private ensureSession(): SessionRecord {
    let session = this.stored.get(this.activeId)
    if (!session) {
      session = createSession()
      this.stored.set(session.id, session)
      this.activeId = session.id
    }
    return session
  }

  private patchActive(patch: Partial<SessionRecord>) {
    const session = this.ensureSession()
    Object.assign(session, patch, { updatedAt: Date.now() })
    this.invalidate()
  }

  /* ---------------- 持久化 ---------------- */

  private hydrate(snapshot: AssistantHistorySnapshot | undefined) {
    if (snapshot?.sessions?.length) {
      for (const raw of snapshot.sessions) {
        if (!raw?.id) continue
        this.stored.set(raw.id, {
          id: raw.id,
          title: raw.title ?? '',
          createdAt: raw.createdAt ?? Date.now(),
          updatedAt: raw.updatedAt ?? Date.now(),
          pinned: Boolean(raw.pinned),
          messages: Array.isArray(raw.messages) ? raw.messages : [],
          lastPage: raw.lastPage,
        })
      }
      this.activeId = snapshot.activeId
      if (!this.stored.has(this.activeId)) {
        this.activeId = this.summaries()[0]?.id ?? ''
      }
    }
    if (!this.activeId || !this.stored.has(this.activeId)) {
      const session = createSession()
      this.stored.set(session.id, session)
      this.activeId = session.id
    }
    this.cached = null
  }

  /**
   * 落盘
   *
   * 只在「消息边界」调用：流式分片每帧都写 localStorage 会把主线程拖垮，
   * 而会话的价值在于历史，刷新时最后一条已完成的回答还在就够了。
   */
  private persist() {
    const port = this.config.history
    if (!port) return
    try {
      port.save({
        activeId: this.activeId,
        sessions: [...this.stored.values()].map<AssistantStoredSession>((session) => ({
          id: session.id,
          title: session.title,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          pinned: session.pinned,
          messages: session.messages,
          lastPage: session.lastPage,
        })),
      })
    } catch {
      // 存储配额满 / 隐私模式：会话仍可在内存里用，不该把对话打断
    }
  }

  /* ---------------- 运行时配置 ---------------- */

  configure(patch: Partial<AssistantConfig>) {
    this.config = { ...this.config, ...patch }
    if (patch.pages) this.pagePort = patch.pages
    if (patch.executeApi) this.executeApi = patch.executeApi
    if (patch.tools) this.tools = [...BUILTIN_TOOLS, ...patch.tools]
    this.invalidate()
  }

  /** 外部（页面库）同步「已应用」状态，供按钮文案使用 */
  syncApplied(ids: string[]) {
    this.live.applied = ids
    this.invalidate()
  }

  /**
   * 还原「当前页面」
   *
   * 刷新后恢复的会话自带 `lastPage`（随会话持久化），此时不该被页面库里的
   * 「最近更新」覆盖 —— 否则在旧会话里说「把主色改成紫色」会改到别的页面上。
   * 只有会话还没有上下文时才回填一次。
   */
  restorePage(page: PageSpec | undefined) {
    if (!page) return
    const session = this.current()
    if (session?.lastPage) return
    this.patchActive({ lastPage: page })
  }

  /**
   * 记录降级原因
   *
   * 探活失败与运行时失败都走这里：界面要在「用户开口之前」就把
   * 「当前是本地引擎、为什么」说清楚，而不是等他发完消息才解释。
   */
  setFallbackReason(reason: string | null) {
    this.live.fallbackReason = reason
    this.invalidate()
  }

  /* ---------------- 会话操作 ---------------- */

  /** 新建会话并切换过去（旧会话原样保留） */
  createSession(title?: string): string {
    this.abortController?.abort()
    this.abortController = null
    const session = createSession(title)
    this.stored.set(session.id, session)
    this.activeId = session.id
    this.resetLive()
    this.prune()
    this.persist()
    this.invalidate()
    this.emit({ type: 'session-switch', id: session.id })
    return session.id
  }

  /**
   * 会话数上限
   *
   * 超过时只丢「最旧且未置顶」的一条：置顶是用户明确的保留意图，
   * 当前会话也永远不能因为新建而被挤掉。
   */
  private prune() {
    const max = this.config.maxSessions ?? DEFAULT_MAX_SESSIONS
    if (this.stored.size <= max) return
    const removable = [...this.stored.values()]
      .filter((session) => !session.pinned && session.id !== this.activeId)
      .sort((a, b) => a.updatedAt - b.updatedAt)
    while (this.stored.size > max && removable.length) {
      const victim = removable.shift()
      if (victim) this.stored.delete(victim.id)
    }
  }

  switchSession(id: string) {
    if (id === this.activeId || !this.stored.has(id)) return
    this.abortController?.abort()
    this.abortController = null
    this.activeId = id
    this.resetLive()
    this.persist()
    this.invalidate()
    this.emit({ type: 'session-switch', id })
  }

  /** 删除会话；删掉当前会话时自动切到最近一条，没有就新建一条空会话 */
  deleteSession(id: string) {
    if (!this.stored.has(id)) return
    this.stored.delete(id)
    if (this.activeId === id) {
      const next = this.summaries()[0]
      if (next) {
        this.activeId = next.id
      } else {
        const session = createSession()
        this.stored.set(session.id, session)
        this.activeId = session.id
      }
      this.resetLive()
    }
    this.persist()
    this.invalidate()
  }

  renameSession(id: string, title: string) {
    const session = this.stored.get(id)
    if (!session) return
    session.title = title.trim().slice(0, 60) || session.title
    this.persist()
    this.invalidate()
  }

  pinSession(id: string, pinned: boolean) {
    const session = this.stored.get(id)
    if (!session) return
    session.pinned = pinned
    this.persist()
    this.invalidate()
  }

  /** 清空当前会话的消息，但保留这条会话本身 */
  reset() {
    this.abortController?.abort()
    this.abortController = null
    const session = this.ensureSession()
    session.messages = []
    session.lastPage = undefined
    session.title = ''
    session.updatedAt = Date.now()
    this.resetLive()
    this.persist()
    this.invalidate()
    this.emit({ type: 'session-reset' })
  }

  private resetLive() {
    this.live.draft = ''
    this.live.reasoningDraft = ''
    this.live.phase = 'idle'
    this.live.activeTool = undefined
    this.live.fallbackReason = null
  }

  abort() {
    if (!this.abortController) return
    this.abortController.abort()
    this.abortController = null
    this.live.phase = 'idle'
    this.live.draft = ''
    this.live.reasoningDraft = ''
    this.live.activeTool = undefined
    this.invalidate()
  }

  get isBusy() {
    return this.live.phase === 'thinking' || this.live.phase === 'tool'
  }

  /* ---------------- 主流程 ---------------- */

  async send(text: string): Promise<void> {
    const prompt = text.trim()
    if (!prompt || this.isBusy) return

    const userMessage: AssistantMessage = {
      id: nextId('u'),
      role: 'user',
      content: prompt,
      createdAt: Date.now(),
      status: 'done',
    }
    const session = this.ensureSession()
    session.messages = [...session.messages, userMessage]
    if (!session.title) session.title = deriveTitle(prompt)
    session.updatedAt = Date.now()

    this.live.phase = 'thinking'
    this.live.draft = ''
    this.live.reasoningDraft = ''
    this.live.fallbackReason = null
    this.invalidate()
    // 用户的问题先落盘：即便这一轮模型挂了，刷新后仍能看到自己问过什么
    this.persist()

    const assistantId = nextId('a')
    const startedAt = Date.now()
    const controller = new AbortController()
    this.abortController = controller

    const transport = this.config.transport
    const useRemote = Boolean(transport?.isConfigured())

    if (!useRemote) {
      await this.runLocal(prompt, assistantId, startedAt)
      return
    }

    try {
      await this.runRemote(prompt, assistantId, startedAt, controller)
    } catch (error) {
      if (controller.signal.aborted) {
        this.resetLive()
        this.invalidate()
        return
      }
      const reason = (error as Error)?.message ?? '模型不可用'
      this.live.fallbackReason = reason
      this.invalidate()
      this.emit({ type: 'engine-fallback', reason })
      await this.runLocal(prompt, assistantId, startedAt, reason)
    } finally {
      if (this.abortController === controller) this.abortController = null
    }
  }

  /** 落一条 assistant 消息：会话、活状态、持久化一次做完 */
  private finish(message: AssistantMessage) {
    const session = this.ensureSession()
    session.messages = [...session.messages, message]
    session.updatedAt = Date.now()
    if (message.page) session.lastPage = message.page

    this.live.draft = ''
    this.live.reasoningDraft = ''
    this.live.phase = message.status === 'error' ? 'error' : 'done'
    this.live.activeTool = undefined
    this.invalidate()
    this.emit({ type: 'assistant-end', id: message.id, message })
    this.persist()
    this.autoApply(message)
  }

  /* ---------------- 模型链路 ---------------- */

  private async runRemote(
    prompt: string,
    assistantId: string,
    startedAt: number,
    controller: AbortController,
  ) {
    const transport = this.config.transport
    if (!transport) throw new Error('未配置传输层')

    const locale = this.config.locale?.() ?? 'zh-CN'
    const operations = this.operations()
    const tools = [...this.tools, ...apiOperationTools(operations)]
    const toolMap = new Map<string, ToolDefinition>(tools.map((tool) => [tool.name, tool]))

    const history: ChatMessage[] = [
      {
        role: 'system',
        content:
          this.config.systemPrompt?.({ lastPage: this.current()?.lastPage, locale }) ??
          `${DEFAULT_SYSTEM}\n\n当前语言：${locale}`,
      },
      ...this.historyMessages(),
      { role: 'user', content: prompt },
    ]

    const toolCalls: ToolCallRecord[] = []
    let finalText = ''
    let reasoning = ''
    let page: PageSpec | undefined
    let firstTokenAt = 0
    this.emit({ type: 'assistant-start', id: assistantId, engine: 'llm', model: transport.model })

    for (let round = 0; round < (this.config.maxToolRounds ?? MAX_TOOL_ROUNDS); round += 1) {
      this.live.phase = 'thinking'
      this.invalidate()

      const result = await transport.stream(
        {
          messages: history,
          tools: tools.map((tool) => tool.descriptor),
          signal: controller.signal,
        },
        {
          onDelta: (_chunk, full) => {
            firstTokenAt ||= Date.now()
            this.live.draft = full
            this.invalidate()
            this.emit({ type: 'assistant-delta', id: assistantId, text: _chunk })
          },
          onReasoning: (chunk) => {
            if (!chunk) return
            reasoning += chunk
            this.live.reasoningDraft = reasoning
            this.invalidate()
            this.emit({ type: 'assistant-reasoning', id: assistantId, text: chunk })
          },
        },
      )

      finalText = result.content.trim()
      this.live.draft = finalText
      this.invalidate()

      if (!result.toolCalls.length) break

      history.push({
        role: 'assistant',
        content: result.content,
        toolCalls: result.toolCalls,
      })

      for (const call of result.toolCalls) {
        const record: ToolCallRecord = {
          id: call.id,
          name: call.name,
          rawArguments: call.arguments,
          startedAt: Date.now(),
        }
        this.live.phase = 'tool'
        this.live.activeTool = toolMap.get(call.name)?.title ?? call.name
        this.invalidate()
        this.emit({ type: 'tool-start', id: assistantId, call: record })

        const definition = toolMap.get(call.name)
        let outcome: ToolOutcome
        try {
          if (!definition) throw new Error(`未注册的工具：${call.name}`)
          let parsed: Record<string, unknown> = {}
          try {
            const raw = call.arguments?.trim()
            parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
          } catch {
            parsed = {}
          }
          record.input = parsed
          outcome = await definition.run(parsed, this.toolContext())
        } catch (error) {
          record.error = (error as Error).message
          outcome = {
            kind: 'text',
            summary: `工具 ${call.name} 执行失败：${(error as Error).message}`,
          }
        }

        record.finishedAt = Date.now()
        record.outcome = outcome
        toolCalls.push(record)
        if (outcome.page) page = outcome.page
        this.emit({ type: 'tool-end', id: assistantId, call: record })
        this.live.phase = 'thinking'
        this.live.activeTool = undefined
        this.invalidate()

        history.push({
          role: 'tool',
          toolCallId: call.id,
          content: [
            `工具：${definition?.title ?? call.name}`,
            `结果：${outcome.summary}`,
            outcome.data !== undefined ? `数据：${safeJson(outcome.data)}` : '',
          ]
            .filter(Boolean)
            .join('\n')
            .slice(0, TOOL_RESULT_SNIPPET),
        })
      }

      // 不在这里 break：把工具结果回灌给模型，让它用自己的话把结论说出来。
      // 轮次由 maxToolRounds 兜底，页面已生成时最多再多一轮。
    }

    const message: AssistantMessage = {
      id: assistantId,
      role: 'assistant',
      // 模型没吐结论时，用工具摘要兜底：宁可少一句客套，也不能给一张空白回复
      content: finalText || toolCalls.at(-1)?.outcome?.summary || '已完成。',
      createdAt: Date.now(),
      status: 'done',
      engine: 'llm',
      model: transport?.model,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      reasoning: reasoning.trim() || undefined,
      thinkingMs: firstTokenAt ? firstTokenAt - startedAt : undefined,
      page,
      suggestions: toolCalls.flatMap((call) => call.outcome?.suggestions ?? []).slice(0, 3),
      latencyMs: Date.now() - startedAt,
    }

    this.finish(message)
  }

  /* ---------------- 本地链路 ---------------- */

  private async runLocal(prompt: string, assistantId: string, startedAt: number, reason?: string) {
    const locale = this.config.locale?.() ?? 'zh-CN'
    const operations = this.operations()
    this.emit({ type: 'assistant-start', id: assistantId, engine: 'local' })

    // 「思考」要有真实的可见停留，而不是瞬间跳变：本地引擎也把依据列出来
    const reasoning = localReasoning(prompt, Boolean(this.current()?.lastPage))
    await new Promise((resolve) => setTimeout(resolve, 160))
    const reasoningChars = [...reasoning]
    for (let index = 1; index <= reasoningChars.length; index += 2) {
      this.live.reasoningDraft = reasoningChars.slice(0, index).join('')
      this.invalidate()
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    const thinkingMs = Date.now() - startedAt

    const outcome = planLocally(prompt, {
      lastPage: this.current()?.lastPage,
      locale,
      apiOperations: operations,
    })

    // 本地引擎走「打字机」揭示，与真实流式的观感一致
    const full = outcome.summary
    const step = Math.max(2, Math.round(full.length / 45))
    for (let cursor = step; cursor < full.length; cursor += step) {
      this.live.draft = full.slice(0, cursor)
      this.invalidate()
      await new Promise((resolve) => setTimeout(resolve, 16))
    }
    this.live.draft = full
    this.invalidate()

    const record: ToolCallRecord | undefined = outcome.page
      ? {
          id: nextId('local'),
          name: 'create_page',
          rawArguments: safeJson({ prompt }),
          input: { requirement: prompt },
          outcome,
          startedAt,
          finishedAt: Date.now(),
        }
      : undefined

    const message: AssistantMessage = {
      id: assistantId,
      role: 'assistant',
      content: full,
      createdAt: Date.now(),
      status: 'done',
      engine: 'local',
      toolCalls: record ? [record] : undefined,
      reasoning,
      thinkingMs,
      page: outcome.page,
      suggestions: outcome.suggestions?.slice(0, 3),
      latencyMs: Date.now() - startedAt,
      error: reason,
    }

    this.finish(message)
  }

  /**
   * 自动落地
   *
   * 生成即写入「页面库」——但**不自动进侧边栏**。
   * 侧边栏是用户的地盘，必须由「应用到侧边栏」显式触发。
   */
  private autoApply(message: AssistantMessage) {
    if (!message.page) return
    this.pagePort?.save(message.page)
  }

  /* ---------------- 上下文与桥接 ---------------- */

  private operations(): AssistantApiOperation[] {
    return this.config.operations?.() ?? listAssistantApi()
  }

  private historyMessages(): ChatMessage[] {
    return (this.current()?.messages ?? [])
      .filter((message) => message.status === 'done' && message.content.trim())
      .slice(-8)
      .map((message) => ({ role: message.role, content: message.content }))
  }

  private toolContext(): ToolContext {
    const operations = this.operations()
    const bridge: AssistantApiBridge = {
      list: () => operations,
      call: async (id, input) => {
        const operation = operations.find((item) => item.id === id)
        if (!operation) return { ok: false, error: `未知操作：${id}` }
        const payload = input ?? {}
        const startedAt = Date.now()
        try {
          if (operation.run) {
            const data = await operation.run(payload)
            return { ok: true, data, elapsedMs: Date.now() - startedAt }
          }
          // 构造期可能还没注入执行器（应用在 configure 之后才注册），
          // 这里回落到注册表，避免「明明配了执行器却报未配置」
          const executor = this.executeApi ?? getAssistantApiExecutor()
          if (!executor) {
            return {
              ok: false,
              error: '未配置接口执行器：请调用 configureAssistantApiExecutor()',
            }
          }
          const result = await executor(
            {
              method: operation.method,
              path: operation.path,
              params: pickParams(operation, payload),
              body: operation.body ? pickBody(operation, payload) : undefined,
            },
            payload,
          )
          return { ...result, elapsedMs: result.elapsedMs ?? Date.now() - startedAt }
        } catch (error) {
          return { ok: false, error: (error as Error).message }
        }
      },
    }

    return {
      session: {
        messages: this.current()?.messages ?? [],
        lastPage: this.current()?.lastPage,
        locale: this.config.locale?.() ?? 'zh-CN',
      },
      api: bridge,
      emit: this.emit,
    }
  }

  /* ---------------- 对外动作（界面按钮直接调） ---------------- */

  async applyPage(page?: PageSpec): Promise<AssistantApiResult> {
    const target = page ?? this.current()?.lastPage
    if (!target) return { ok: false, error: '没有可应用的页面' }
    try {
      this.pagePort?.apply(target)
      this.live.applied = [...new Set([...this.live.applied, target.id])]
      this.invalidate()
      this.persist()
      return { ok: true, data: target }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  }

  patchLastPage(page: PageSpec) {
    this.pagePort?.save(page)
    this.patchActive({ lastPage: page })
    this.persist()
  }

  openPage(path: string) {
    if (this.pagePort?.open) this.pagePort.open(path)
    else this.config.navigate?.(path)
  }

  /** 供「客户如何接入」面板展示的代码片段 */
  describeApiBridge() {
    return {
      operations: this.operations(),
      hasExecutor: Boolean(this.executeApi ?? getAssistantApiExecutor()),
    }
  }
}

/* ------------------------------------------------------------------ *
 * 单例装配
 * ------------------------------------------------------------------ */

let singleton: AssistantCore | null = null

export function configureAssistant(config: AssistantConfig): AssistantCore {
  if (singleton) {
    singleton.configure(config)
    return singleton
  }
  singleton = new AssistantCore(config)
  return singleton
}

export function getAssistant(): AssistantCore {
  singleton ??= new AssistantCore()
  return singleton
}

export function resetAssistant() {
  singleton?.reset()
  singleton = null
}

/* ------------------------------------------------------------------ *
 * 接口操作注册表
 * ------------------------------------------------------------------ */

const apiRegistry: AssistantApiOperation[] = []
let apiExecutor: ApiExecutor | null = null
const apiListeners = new Set<Listener>()

/** 注册后端操作：追加并去重（同 id 以最新声明为准） */
export function registerAssistantApi(operations: AssistantApiOperation[]): AssistantApiOperation[] {
  for (const operation of operations) {
    const index = apiRegistry.findIndex((item) => item.id === operation.id)
    if (index >= 0) apiRegistry.splice(index, 1, operation)
    else apiRegistry.push(operation)
  }
  apiListeners.forEach((listener) => listener())
  singleton?.configure({ operations: listAssistantApi })
  return [...apiRegistry]
}

export function listAssistantApi(): AssistantApiOperation[] {
  return [...apiRegistry]
}

export function configureAssistantApiExecutor(executor: ApiExecutor | null) {
  apiExecutor = executor
  if (singleton) singleton.configure({ executeApi: executor ?? undefined })
}

export function getAssistantApiExecutor(): ApiExecutor | null {
  return apiExecutor
}

export function onAssistantApiChange(listener: Listener) {
  apiListeners.add(listener)
  return () => apiListeners.delete(listener)
}

/* ------------------------------------------------------------------ *
 * 工具函数
 * ------------------------------------------------------------------ */

function pickParams(
  operation: AssistantApiOperation,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const keys = Object.keys(operation.params ?? {})
  if (!keys.length) return input
  return Object.fromEntries(
    keys.filter((key) => input[key] !== undefined).map((key) => [key, input[key]]),
  )
}

function pickBody(
  operation: AssistantApiOperation,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const keys = Object.keys(operation.body ?? {})
  if (!keys.length) return input
  return Object.fromEntries(
    keys.filter((key) => input[key] !== undefined).map((key) => [key, input[key]]),
  )
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value).slice(0, TOOL_RESULT_SNIPPET)
  } catch {
    return String(value).slice(0, TOOL_RESULT_SNIPPET)
  }
}
