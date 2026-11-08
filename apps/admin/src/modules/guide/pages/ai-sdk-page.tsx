import { useState } from 'react'
import { ArrowRight, Boxes, Braces, Cpu, Layers, Wrench } from 'lucide-react'
import { Badge, Button, CodeBlock, Descriptions, SectionCard, Tabs } from '@nexus/ui'
import { useAppNavigate } from '@/components/app-link'
import {
  CodeTabs,
  FileRef,
  GuideNext,
  GuideNote,
  GuidePage,
  GuideSection,
  Level,
} from '../components'

/**
 * AI SDK 教程
 *
 * 这一页把 `@nexus/ai-sdk` 讲清楚：它是什么、契约长什么样、
 * 怎么从零接上自己的模型 / 后端 / 页面渲染。
 *
 * 所有类型与签名都对齐 packages/ai-sdk/src/*.ts 的实际导出，
 * 不写「设想中的 API」——文档和源码不一致比没有文档更糟。
 */

const TOC = [
  { id: 'what', label: '0. 它是什么' },
  { id: 'pagespec', label: '1. PageSpec 契约' },
  { id: 'transport', label: '2. 传输层' },
  { id: 'tools', label: '3. 工具' },
  { id: 'planner', label: '4. 本地引擎' },
  { id: 'core', label: '5. AssistantCore' },
  { id: 'host', label: '6. 宿主接入' },
  { id: 'custom', label: '7. 扩展' },
  { id: 'pitfalls', label: '8. 坑与约束' },
]

const INSTALL = `# 作为 workspace 包直接引用，无需发布
# apps/admin/package.json
{ "dependencies": { "@nexus/ai-sdk": "workspace:*" } }

# 注意：exports 指向 TS 源码（没有 dist）
# 消费方需要转译 TS，或在 bundler 里配别名：
# apps/admin/vite.config.ts
resolve: {
  alias: { '@nexus/ai-sdk': fileURLToPath(new URL('../../packages/ai-sdk/src/index.ts', import.meta.url)) },
}`

const STRUCTURE = `packages/ai-sdk/           零运行时依赖（无 React / 无 UI 库 / 无后端 SDK）
├── types.ts               消息、工具、事件、传输、会话契约
├── ports.ts               宿主端口：PagePort / ApiExecutor / RuntimeOptions
├── page-spec.ts           PageSpec + 常量 + normalizePageSpec / patchPageSpec
├── transport.ts           OpenAI Chat Completions 兼容流式传输
├── tools.ts               6 个内置工具 + apiOperationTools 投影
├── planner.ts             本地降级引擎（无模型密钥时的规则规划器）
└── assistant.ts           AssistantCore：工具循环、订阅、注册表、单例

apps/admin/src/ai/         装配层（唯一认识路由与 core/http 的地方）
├── index.ts               传输配置 + 执行器 + 页面端口 + useSyncExternalStore
├── page-store.ts          页面库（localStorage）+ 动态侧栏模块
├── api-operations.ts      ★ 接入自己的后端时唯一要改的文件
├── history-store.ts       多会话持久化端口
└── components/            抽屉 / 会话列 / 对话流 / 页面渲染器 / 接口接入面板`

const PAGESPEC = `// packages/ai-sdk/src/page-spec.ts
export interface PageSpec {
  id: string
  title: string            // ≤ 60 字，归一化时必填
  description: string      // ≤ 160 字
  path: string             // 永远收敛到 /generated/<slug>
  icon: string             // ICON_IDS 白名单，非法回退 'sparkles'
  createdAt: number
  updatedAt: number        // 每次 patch 强制刷新为 now
  version: number          // 每次 patch +1
  source: 'ai' | 'template' | 'manual'
  theme: PageTheme
  nav: PageNav
  blocks: PageBlock[]      // ≤ 14 块
  dataSource?: string
  prompt?: string
}

export interface PageTheme {
  accent?: string          // ACCENTS 白名单：blue / violet / emerald / …
  radius?: string          // none / small / medium / large / xlarge
  density?: string         // compact / default / comfortable
  surface?: 'plain' | 'gradient'
}

export interface PageNav {
  group?: string           // 缺省「AI 生成」
  order?: number           // 钳 100–999，默认 900
  badge?: string
}`

const BLOCKS = `type PageBlock =
  | { kind: 'kpi';      items: KpiItem[] }
  | { kind: 'chart';    title; description?; variant; categories; series; unit?; height? }
  | { kind: 'table';    title; description?; columns; rows; footer? }
  | { kind: 'list';     title; description?; items }
  | { kind: 'text';     title?; body }
  | { kind: 'progress'; title; description?; items }
  | { kind: 'steps';    title; description?; items }

// 七种区块的字段
KpiItem      { label; value; suffix?; delta?; tone?; trend?: number[] }   // trend 需 ≥2 点
ChartBlock   { variant: 'line' | 'area' | 'bar' | 'pie' | 'donut' }
             { categories: string[]; series: { name; data: number[] }[] } // ≤4 条序列
TableColumn  { key; label; align?: 'left'|'right'; format?: 'number'|'percent'|'currency'|'text' }
ListItem     { title; description?; meta?; tone?; progress? }
StepsBlock   { items: { title; description?; status?: 'done'|'current'|'pending' }[] }`

const NORMALIZE = `import { normalizePageSpec, patchPageSpec } from '@nexus/ai-sdk'

// 归一化：模型返回什么脏数据都能收敛成合法规格（失败返回 null）
const page = normalizePageSpec({
  title: '用户数据统计',
  icon: 'users',
  theme: { accent: 'ocean', surface: 'gradient' },
  blocks: [
    { kind: 'kpi', items: [{ label: '总用户', value: 268, delta: 8.2 }] },
    { kind: 'chart', title: '近 7 日趋势', variant: 'line', categories: days,
      series: [{ name: '新增', data: [...] }] },
  ],
})

// 局部修改：只改主题与区块，path / source / id 不可变
const next = patchPageSpec(page, { theme: { radius: 'large' } })`

const LIMITS = `// 静默截断（不报错，只收敛）
MAX_BLOCKS = 14        // 区块
MAX_ROWS   = 60        // 表格行
kpi        8 项
chart      4 条序列 / 单序列 24 点（短序列补 0）
table      8 列
list       12 项
progress   8 项
steps      8 步
text       1200 字

// 归一化规则
title 必填，否则返回 null；blocks 归一化后为空也返回 null
chart.variant 非法 → 'bar'
chart.height 钳 160–420
accent 非法 → undefined（回退主题默认色）
path 永远以 /generated/ 开头（中文 slug 退化为 page-<时间戳>）
nav.order 钳 100–999，默认 900`

const TRANSPORT = `import { createOpenAICompatibleTransport } from '@nexus/ai-sdk'

const transport = createOpenAICompatibleTransport({
  id: 'my-gateway',                     // 默认 'openai-compatible'
  label: '公司网关',
  baseUrl: 'https://bff.example.com/v1', // POST {baseUrl}/chat/completions
  model: 'deepseek-v4.1-flash-free',
  apiKey: undefined,                     // 不要放进浏览器包！生产走 BFF
  headers: { 'x-tenant': 'acme' },
  sessionId: 'ses_abc',                  // 可选：粘性路由 / 提示缓存
  temperature: 0.4,
})

// 它实现了 AssistantTransport：
// { id, label, model, isConfigured(), stream(request, handlers) }`

const TRANSPORT_BODY = `// 请求体（固定 stream: true，没有 max_tokens / stream 开关）
{
  model,
  messages: toWireMessages(request.messages),
  stream: true,
  temperature: request.temperature ?? config.temperature ?? 0.4,
  tools: toWireTools(request.tools),      // 无工具时省略该字段
  tool_choice: 'auto',
}

// 流式解析：只取 data: 行；坏 JSON 静默跳过；忽略 [DONE]
// 文本：delta.content → onDelta(chunk, full)，累加返回
// 思考链：delta.reasoning_content ?? delta.reasoning → onReasoning(chunk)
// 工具：按 tool_calls[].index 累积（id 覆盖、name 与 arguments 拼接）

// 错误：非 2xx → TransportError(status)，流内 chunk.error → TransportError()`

const SELF_TRANSPORT = `// 非 OpenAI 兼容网关？自己实现一个 AssistantTransport 即可
import type { AssistantTransport, TransportRequest, TransportDeltaHandlers } from '@nexus/ai-sdk'

export const myTransport: AssistantTransport = {
  id: 'my-llm',
  label: '自研模型',
  model: 'internal-v3',
  isConfigured: () => Boolean(import.meta.env.VITE_LLM_BASE),
  async stream(request: TransportRequest, handlers: TransportDeltaHandlers) {
    const response = await fetch('/my-llm/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: request.messages, tools: request.tools }),
      signal: request.signal,          // 一定要透传，中止才能生效
    })
    if (!response.ok) throw new Error(\`模型网关返回 \${response.status}\`)
    // …自行解析，边解析边调用 handlers.onDelta(chunk, full)
    return { content, toolCalls: [], model: 'internal-v3' }
  },
}`

const TOOLS = `// 6 个内置工具（tools.ts → BUILTIN_TOOLS）
create_page                 requirement(必填) · title · topic · accent · blocks · dataSource
update_page                 title · accent · radius · density · surface · blocks
apply_page                  path（可选）
list_api_operations         无参数
call_api                    id(必填) · input(object)
explain_backend_integration 无参数

// ToolDefinition 的写法（没有 defineTool 工厂，直接写字面量）
import type { ToolDefinition } from '@nexus/ai-sdk'

export const pingTool: ToolDefinition = {
  name: 'ping',
  title: '连通性检查',
  description: '检查某个接口是否可达，返回耗时。',
  descriptor: {
    name: 'ping',
    description: '检查接口可达性',
    parameters: {
      type: 'object',
      properties: { url: { type: 'string', description: '接口路径' } },
      required: ['url'],
    },
  },
  async run(input, context) {
    const started = performance.now()
    const data = await context.api.call('user_stats', {})
    return {
      summary: \`\${input.url} 耗时 \${Math.round(performance.now() - started)}ms\`,
      kind: 'data',
      data,
    }
  },
}`

const API_OPS = `// 把你的后端接口交给助手 —— 只登记「允许它访问」的那些
import { registerAssistantApi } from '@nexus/ai-sdk'
import type { AssistantApiOperation } from '@nexus/ai-sdk'

export const OPERATIONS: AssistantApiOperation[] = [
  {
    id: 'user_list',                 // → 工具名 api_user_list（只保留字母数字下划线）
    title: '用户列表',
    description: '分页查询用户，支持关键字与状态过滤',
    method: 'GET',                   // 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    path: '/users',
    params: {                        // 既是给模型看的字段说明，也是执行器挑查询参数的依据
      page: '页码，从 1 开始',
      pageSize: '每页条数',
      keyword: '姓名 / 邮箱',
    },
  },
  {
    id: 'order_create',
    title: '创建订单',
    description: '新建一笔订单',
    method: 'POST',
    path: '/orders',
    body: { customer: '客户名', amount: 0 },
    mutating: true,                  // 声明写操作（见「坑与约束」第 4 条）
  },
]

registerAssistantApi(OPERATIONS)     // 幂等：同 id 后者覆盖前者`

const PLANNER = `// 没有模型密钥时自动降级到本地引擎（不是报错，是换实现）
import { planLocally, detectIntent } from '@nexus/ai-sdk'

const intent = detectIntent('帮我实现一个用户统计页面', false)
// 'create-page' | 'update-visual' | 'update-title' | 'apply-page'
// | 'list-apis' | 'call-api' | 'backend-guide' | 'help' | 'chat'

const outcome = planLocally(text, {
  lastPage,          // 当前会话的页面，用于「把主色改成紫色」
  locale: 'zh-CN',
  apiOperations: [],
})
// outcome: { summary, kind: 'text'|'data'|'page'|'guide'|'api', data?, page?, suggestions? }`

const PLANNER_ABILITY = `✅ 能做（中英文指令都认）
   生成内置模板页面（用户统计 / 通用看板）
   改主色、圆角、密度、标题
   应用页面到侧边栏
   列出已登记接口、讲接入步骤

❌ 不能做
   按任意需求自由编排区块（这需要模型）
   真的调用后端接口（call-api 在本地引擎里没有执行分支）
   产出 LLM 级别的说明文案`

const CORE_API = `import { AssistantCore, configureAssistant, getAssistant } from '@nexus/ai-sdk'

const core = new AssistantCore({
  transport,                        // 不传即纯本地引擎
  pages: { save, apply, open, isApplied },   // PagePort
  executeApi: async (operation, input) => ({ ok: true, data }), // 默认执行器
  locale: () => 'zh-CN',
  navigate: (path) => router.navigate(path),
  history: { load: () => snapshot, save: (s) => persist(s) },   // 多会话持久化
  maxSessions: 30,
  maxToolRounds: 3,
  systemPrompt: ({ lastPage, locale }) => \`…\`,   // 覆盖默认系统提示
})

// 公开方法（全部同步返回，异步只有 send / applyPage）
core.subscribe(listener)     // () => unsubscribe
core.getSnapshot()           // AssistantSnapshot
core.send(text)              // Promise<void>
core.abort()                 // 中止当前这一轮（不产生 assistant 消息）
core.applyPage(page?)        // Promise<AssistantApiResult>
core.patchLastPage(page)     // 直接改当前页面（界面里的配色切换用它）
core.restorePage(page?)      // 刷新后还原「当前页面」
core.syncApplied(ids)        // 同步「已应用」状态
core.configure(patch)        // 热更新配置（transport / tools / pages…）
core.setFallbackReason(r)    // 显示「为什么降级」
core.createSession(title) / switchSession(id) / deleteSession(id)
core.renameSession(id, title) / pinSession(id, pinned) / reset()`

const SNAPSHOT = `// snapshot 是唯一的渲染数据源（useSyncExternalStore 消费）
interface AssistantSnapshot {
  messages: AssistantMessage[]
  draft: string                 // 流式中的字幕
  reasoningDraft: string        // 流式中的思考链
  activeTool?: string
  phase: 'idle' | 'thinking' | 'tool' | 'done' | 'error'
  lastPage?: PageSpec
  applied: string[]
  engine: { available: boolean; label: string; model?: string }
  fallbackReason: string | null
  sessions: AssistantSessionSummary[]
  activeSessionId: string
}

// React 侧只需要三行
const subscribe = (cb: () => void) => getAssistant().subscribe(cb)
const snapshot = () => getAssistant().getSnapshot()
const state = useSyncExternalStore(subscribe, snapshot, snapshot)`

const HOST_MIN = `// 最小 20 行：一个项目要接上助手，只需要这些
import {
  configureAssistant,
  configureAssistantApiExecutor,
  createOpenAICompatibleTransport,
  registerAssistantApi,
} from '@nexus/ai-sdk'
import { api } from '@/core/http'
import { pageStore } from './page-store'

configureAssistant({
  transport: createOpenAICompatibleTransport({
    baseUrl: '/ai-gateway',        // 由 BFF 注入密钥
    model: 'deepseek-v4.1-flash-free',
  }),
  locale: () => 'zh-CN',
  navigate: (path) => router.navigate(path),
  pages: {
    save: (page) => pageStore.save(page),
    apply: (page) => pageStore.apply(page),
    open: (path) => router.navigate(path),
    isApplied: (id) => pageStore.isApplied(id),
  },
  history: {
    load: () => JSON.parse(localStorage.getItem('ai-sessions') || 'null') ?? undefined,
    save: (s) => localStorage.setItem('ai-sessions', JSON.stringify(s)),
  },
})

configureAssistantApiExecutor(async (operation, input) => {
  const data = await api.request(operation.method, operation.path, { params: input })
  return { ok: true, data }
})

registerAssistantApi([{ id: 'user_list', title: '用户列表', description: '分页查询用户',
  method: 'GET', path: '/users' }])`

const EXAMPLES = `// ① 只用本地引擎（不配模型也能跑通链路）
const core = new AssistantCore({ pages: { save: pageStore.save, apply: pageStore.apply } })
await core.send('帮我实现一个用户数据统计页面')
core.getSnapshot().messages.at(-1)?.engine   // 'local'
core.getSnapshot().lastPage?.blocks.length   // 5

// ② 接 OpenAI 兼容网关
configureAssistant({ transport: createOpenAICompatibleTransport({ baseUrl, model }) })

// ③ 追加自定义工具（注意：整体替换，不是累加）
configureAssistant({ tools: [myTool] })

// ④ 手动渲染一份 PageSpec（不经过模型）
const page = normalizePageSpec(raw)!
return <PageRenderer page={page} />`

const PITFALLS: Array<[string, string]> = [
  [
    'PageSpec 是受限 DSL',
    '模型不生成 React 代码，只生成规格；未知 kind 会被静默跳过，表达力受区块类型限制。',
  ],
  [
    'normalizePageSpec 会返回 null',
    '无 title 或 blocks 归一化后为空时返回 null，且不抛错——调用方必须判空。',
  ],
  [
    '大量静默截断',
    '区块 14 / 行 60 / KPI 8 / 序列 4 等上限到了就截断，不会提示「你的数据被裁了」。',
  ],
  [
    'patchPageSpec 的 accent 三态',
    'theme 里出现 accent 键但值非法时会「清空」主色，而不是沿用原值——只改圆角时要留意。',
  ],
  [
    'apply_page 不等于写进侧边栏',
    '工具只更新 lastPage 并 emit 事件；真正调用 PagePort.apply 的是 AssistantCore.applyPage()。',
  ],
  ['mutating 只是声明', 'SDK 内部没有读它做二次确认；安全边界靠「只登记允许访问的接口」。'],
  [
    'configure({ tools }) 是整体替换',
    '不是追加：多次调用会丢掉上一次的自定义工具，要么一次给全，要么自己合并 BUILTIN_TOOLS。',
  ],
  [
    '工具参数坏 JSON 会被吞成 {}',
    '工具仍会执行：参数校验要靠 required + 默认值兜底，别指望 SDK 拦。',
  ],
  ['只带最近 8 条消息给模型', '长对话的早期上下文会自动缺失，重要约束请写进 systemPrompt。'],
  ['工具循环最多 3 轮', '每轮都重发完整 history，token 消耗比看上去高；复杂任务建议拆成多轮对话。'],
  ['abort 不留痕', '中止后不产生 assistant 消息（用户消息保留），界面要自己恢复输入框状态。'],
  [
    'transport 无超时 / 无重试',
    '要超时请自己传 AbortSignal；SSE 解析只认 data: 行，非标准网关需自实现 ports。',
  ],
]

export default function GuideAiSdkPage() {
  const navigate = useAppNavigate()
  const [tab, setTab] = useState('core')

  return (
    <GuidePage
      title="AI 助手 SDK"
      subtitle="@nexus/ai-sdk 是本项目里唯一一套「让模型生成页面」的内核：零运行时依赖、纯 TypeScript、可单独接入任何 React（甚至非 React）项目。这一页把它的契约、扩展点与坑一次讲完。"
      toc={TOC}
      actions={
        <>
          <Badge tone="primary" variant="outline" size="sm">
            零依赖
          </Badge>
          <Button
            size="sm"
            variant="secondary"
            rightIcon={<ArrowRight className="size-3.5" />}
            onClick={() => navigate('/assistant/workspace')}
          >
            打开助手工作台
          </Button>
        </>
      }
    >
      {/* ---------------- 0. 它是什么 ---------------- */}
      <GuideSection
        id="what"
        eyebrow="Overview"
        title={
          <span className="flex flex-wrap items-center gap-2">
            0. 它是什么 <Level value="必读" />
          </span>
        }
        description="一句话：把「自然语言 → 可序列化页面规格 → 受控渲染」这条链路做成一个与 UI 框架无关的包。"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            {
              icon: <Cpu className="size-4" />,
              title: '内核与宿主分离',
              desc: 'SDK 不认识路由、localStorage、core/http；这些都由装配层注入',
            },
            {
              icon: <Braces className="size-4" />,
              title: '只产出规格',
              desc: '模型输出 PageSpec，不是 React 代码：无任意代码执行、样式不失控',
            },
            {
              icon: <Layers className="size-4" />,
              title: '可降级',
              desc: '没有模型密钥时切本地规则引擎，链路不中断、界面说明原因',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border border-line bg-surface p-3.5">
              <span className="grid size-7 place-items-center rounded-md bg-primary-weak text-primary">
                {item.icon}
              </span>
              <p className="mt-2 text-[13px] font-medium text-fg">{item.title}</p>
              <p className="mt-1 text-2xs leading-5 text-fg-3">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <SectionCard title="安装与引用" bodyClassName="p-4">
            <CodeBlock language="json" filename="workspace 引用" code={INSTALL} maxHeight={230} />
          </SectionCard>
          <SectionCard title="包结构" bodyClassName="p-4">
            <CodeBlock
              language="bash"
              filename="packages/ai-sdk"
              code={STRUCTURE}
              maxHeight={230}
            />
          </SectionCard>
        </div>

        <GuideNote tone="warn" title="exports 指向 TS 源码，没有 dist">
          这是刻意的：workspace 里省掉一次构建，IDE 跳转也直达实现。 代价是消费方必须能转译 TS（Vite
          可以），或像本仓库一样在 <code className="font-mono">vite.config.ts</code>{' '}
          里配别名。发布到 npm 前需要补一次 build。
        </GuideNote>
      </GuideSection>

      {/* ---------------- 1. PageSpec ---------------- */}
      <GuideSection
        id="pagespec"
        eyebrow="Contract"
        title={
          <span className="flex flex-wrap items-center gap-2">
            1. PageSpec 契约 <Level value="必读" />
          </span>
        }
        description="整个 SDK 的核心数据结构：一份可存 localStorage、可导出 JSON、可发给同事复用的页面规格。"
      >
        <CodeTabs
          filename="packages/ai-sdk/src/page-spec.ts"
          tabs={[
            { key: 'spec', label: 'PageSpec', code: PAGESPEC },
            { key: 'blocks', label: '七种区块', code: BLOCKS },
          ]}
        />

        <div className="space-y-3">
          <SectionCard title="归一化" description="模型给什么脏数据都能收敛" bodyClassName="p-4">
            <CodeBlock filename="normalize / patch" code={NORMALIZE} maxHeight={280} />
          </SectionCard>
          <SectionCard title="上限与规则" description="静默截断，不报错" bodyClassName="p-4">
            <CodeBlock filename="limits" code={LIMITS} maxHeight={280} />
          </SectionCard>
        </div>

        <GuideNote tone="tip" title="为什么用规格而不是 React 代码">
          规格的失败模式是「少一个区块」，可解释、可修复、可回放；而模型生成代码需要把运行时编译器打进产物、
          把预览隔离进 iframe，失败模式是「白屏且不知道为什么」。
        </GuideNote>
      </GuideSection>

      {/* ---------------- 2. 传输层 ---------------- */}
      <GuideSection
        id="transport"
        eyebrow="Transport"
        title={
          <span className="flex flex-wrap items-center gap-2">
            2. 传输层 <Level value="进阶" />
          </span>
        }
        description="默认实现是 OpenAI Chat Completions 兼容的流式传输；换网关只换配置，换协议就自己实现 4 个成员。"
      >
        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-2xs font-medium text-fg-3">创建传输</p>
            <CodeBlock filename="transport" code={TRANSPORT} maxHeight={300} />
          </div>
          <div className="space-y-2">
            <p className="text-2xs font-medium text-fg-3">它替你做了什么</p>
            <CodeBlock filename="wire format" code={TRANSPORT_BODY} maxHeight={300} />
          </div>
        </div>

        <SectionCard title="非 OpenAI 兼容？实现 AssistantTransport" bodyClassName="p-4">
          <CodeBlock filename="my-transport.ts" code={SELF_TRANSPORT} maxHeight={360} />
        </SectionCard>

        <GuideNote tone="danger" title="密钥永远不要进浏览器包">
          <code className="font-mono">apiKey</code> 只适合服务端到服务端；
          浏览器里应当请求你自己的同源网关（本项目的 <code className="font-mono">/ai-gateway</code>
          ）， 由它注入密钥与 session 头。
        </GuideNote>
      </GuideSection>

      {/* ---------------- 3. 工具 ---------------- */}
      <GuideSection
        id="tools"
        eyebrow="Tools"
        title={
          <span className="flex flex-wrap items-center gap-2">
            3. 工具与接口注册 <Level value="必读" />
          </span>
        }
        description="模型能做的事 = 你注册的工具。工具循环最多 3 轮，每轮把结构回灌给模型再要下一步。"
      >
        <div className="space-y-3">
          <SectionCard title="内置工具与自定义写法" bodyClassName="p-4">
            <CodeBlock filename="tools" code={TOOLS} maxHeight={420} />
          </SectionCard>
          <SectionCard title="后端接口注册表" bodyClassName="p-4">
            <CodeBlock filename="api-operations.ts" code={API_OPS} maxHeight={420} />
          </SectionCard>
        </div>

        <SectionCard title="运行表" bodyClassName="px-0">
          <Descriptions
            className="p-4"
            columns={2}
            size="sm"
            items={[
              { label: 'create_page', value: '生成页面：有 blocks 走归一化，无 blocks 用内置模板' },
              { label: 'update_page', value: '改配色 / 圆角 / 密度 / 标题 / 区块' },
              { label: 'apply_page', value: '把 lastPage 标记为已应用（见坑 5）' },
              { label: 'list_api_operations', value: '列出所有已登记接口' },
              { label: 'call_api', value: '真的发请求，结果回填给模型' },
              { label: 'explain_backend_integration', value: '按语言返回三步接入说明' },
            ]}
          />
        </SectionCard>
      </GuideSection>

      {/* ---------------- 4. 本地引擎 ---------------- */}
      <GuideSection
        id="planner"
        eyebrow="Fallback"
        title={
          <span className="flex flex-wrap items-center gap-2">
            4. 本地引擎 <Level value="可选" />
          </span>
        }
        description="无模型时的降级实现：规则 + 关键词匹配。它不是玩具——界面上的配色切换、应用页面全靠它。"
      >
        <div className="space-y-3">
          <div className="space-y-2">
            <CodeBlock filename="planner" code={PLANNER} maxHeight={260} />
          </div>
          <div className="space-y-2">
            <CodeBlock language="bash" filename="能力边界" code={PLANNER_ABILITY} maxHeight={260} />
          </div>
        </div>
      </GuideSection>

      {/* ---------------- 5. AssistantCore ---------------- */}
      <GuideSection
        id="core"
        eyebrow="Core"
        title={
          <span className="flex flex-wrap items-center gap-2">
            5. AssistantCore <Level value="必读" />
          </span>
        }
        description="一个外部 store：工具循环、多会话、降级、持久化都在这里；React 只负责订阅快照。"
      >
        <Tabs
          variant="line"
          value={tab}
          onChange={setTab}
          items={[
            {
              key: 'core',
              label: '配置与方法',
              content: <CodeBlock filename="AssistantCore" code={CORE_API} maxHeight={420} />,
            },
            {
              key: 'snapshot',
              label: '快照与订阅',
              content: <CodeBlock filename="AssistantSnapshot" code={SNAPSHOT} maxHeight={420} />,
            },
            {
              key: 'examples',
              label: '四个最小示例',
              content: <CodeBlock filename="examples" code={EXAMPLES} maxHeight={420} />,
            },
          ]}
        />
        <GuideNote tone="tip" title="没有 regenerate / stop / newSession 这些方法">
          旧文档里的叫法容易误导。实际对应关系：重发 = 再调一次{' '}
          <code className="font-mono">send</code>；停止 = <code className="font-mono">abort()</code>
          ；新建会话 = <code className="font-mono">createSession()</code>；改当前页面 ={' '}
          <code className="font-mono">patchLastPage()</code>。
        </GuideNote>
      </GuideSection>

      {/* ---------------- 6. 宿主接入 ---------------- */}
      <GuideSection
        id="host"
        eyebrow="Integration"
        title={
          <span className="flex flex-wrap items-center gap-2">
            6. 宿主接入 <Level value="必读" />
          </span>
        }
        description="SDK 不认识你的路由、存储与 HTTP 层——所以接入只需要实现四个端口，再加一次执行器配置。"
      >
        <div className="space-y-3">
          <SectionCard title="四个端口" bodyClassName="p-4">
            <Descriptions
              size="sm"
              columns={1}
              items={[
                { label: 'PagePort.save', value: '保存/更新页面（持久化由应用负责）' },
                { label: 'PagePort.apply', value: '真正落地：写侧边栏 + 生成路由' },
                { label: 'PagePort.open', value: '应用内跳转' },
                { label: 'PagePort.isApplied', value: '按钮文案用（注意：SDK 内部不调用它）' },
                {
                  label: 'ApiExecutor',
                  value: '(operation, input) => Promise<AssistantApiResult>',
                },
                { label: 'HistoryPort', value: '{ load, save } 多会话持久化' },
                { label: 'navigate', value: '需要跳转时回调' },
              ]}
            />
          </SectionCard>
          <SectionCard title="最小接入" bodyClassName="p-4">
            <CodeBlock filename="bootstrap.ts" code={HOST_MIN} maxHeight={420} />
          </SectionCard>
        </div>

        <SectionCard
          title="本项目的接线位置"
          description="换 UI 框架只需重写装配层，内核不动"
          bodyClassName="p-4"
        >
          <div className="space-y-1.5">
            <FileRef
              path="apps/admin/src/ai/index.ts"
              note="传输 + 执行器 + 页面端口 + React 绑定"
            />
            <FileRef
              path="apps/admin/src/ai/page-store.ts"
              note="页面库（localStorage）+ 动态侧栏模块"
            />
            <FileRef
              path="apps/admin/src/ai/api-operations.ts"
              note="★ 接入自己后端时唯一要改的文件"
            />
            <FileRef path="apps/admin/src/ai/history-store.ts" note="会话持久化端口" />
            <FileRef
              path="apps/admin/src/ai/components/page-renderer.tsx"
              note="唯一一套受控渲染实现"
            />
          </div>
        </SectionCard>
      </GuideSection>

      {/* ---------------- 7. 扩展 ---------------- */}
      <GuideSection
        id="custom"
        eyebrow="Extend"
        title={
          <span className="flex flex-wrap items-center gap-2">
            7. 扩展点 <Level value="进阶" />
          </span>
        }
        description="三处可以安全扩展：工具、接口清单、系统提示。任何一处都不用改 SDK 源码。"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            {
              icon: <Wrench className="size-4" />,
              title: '自定义工具',
              desc: 'configureAssistant({ tools }) —— 注意是整体替换',
            },
            {
              icon: <Boxes className="size-4" />,
              title: '接口清单',
              desc: 'registerAssistantApi() 幂等注册，同 id 覆盖',
            },
            {
              icon: <Braces className="size-4" />,
              title: '系统提示',
              desc: 'systemPrompt({ lastPage, locale }) 返回完整提示词',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border border-line bg-surface px-3 py-2.5">
              <span className="text-primary">{item.icon}</span>
              <p className="mt-1.5 text-xs font-medium text-fg">{item.title}</p>
              <p className="mt-0.5 text-2xs leading-5 text-fg-3">{item.desc}</p>
            </div>
          ))}
        </div>
        <CodeBlock
          filename="systemPrompt 覆盖"
          maxHeight={220}
          code={`configureAssistant({
  systemPrompt: ({ lastPage, locale }) => \`你是 \${locale === 'en-US' ? 'an ops assistant' : '运营助手'}。
当前页面：\${lastPage?.title ?? '无'}。
要求：先结论后细节；不要输出代码；生成页面后给 2~3 个下一步建议。\`,
})`}
        />
      </GuideSection>

      {/* ---------------- 8. 坑 ---------------- */}
      <GuideSection
        id="pitfalls"
        eyebrow="Pitfalls"
        title="8. 坑与约束"
        description="以下每一条都来自源码实际行为，不是猜测——接之前先读完，能省半天。"
      >
        <div className="space-y-2">
          {PITFALLS.map(([title, body], index) => (
            <div
              key={title}
              className="flex items-start gap-2.5 rounded-md border border-line bg-surface px-3 py-2.5"
            >
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-warning-weak text-[10px] font-semibold text-warning tabular-nums">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-fg">{title}</p>
                <p className="mt-0.5 text-2xs leading-5 text-fg-3">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <SectionCard
          title="自测"
          description="SDK 的纯逻辑都有单测，改动后先跑它们"
          bodyClassName="p-4"
        >
          <CodeBlock
            language="bash"
            filename="命令"
            maxHeight={140}
            code={`pnpm --filter @nexus/ai-sdk test        # page-spec / tools / transport / planner / assistant
node scripts/verify-assistant.mjs       # 全链路 8 步 + 截图`}
          />
        </SectionCard>
      </GuideSection>

      <GuideNext
        to="/guide/backend"
        label="接入后端"
        desc="AI 助手的接口也走同一套 core/http 契约"
      />
    </GuidePage>
  )
}
