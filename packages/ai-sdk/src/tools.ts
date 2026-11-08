import type { PageSpec } from './page-spec'
import {
  ACCENTS,
  CHART_VARIANTS,
  createGenericDashboardPage,
  createUserStatsPage,
  normalizePageSpec,
  patchPageSpec,
} from './page-spec'
import type {
  AssistantApiOperation,
  AssistantEvent,
  AssistantSessionView,
  ToolContext,
  ToolDescriptor,
  ToolOutcome,
} from './types'

/**
 * 内置工具
 *
 * 「助手能干什么」= 工具清单。每个工具同时服务于两个对象：
 * - 模型：看到 `descriptor` 中的 JSON Schema，决定何时调用
 * - 人：看到 `run` 产出的 `summary` / `page`，直接得到可读结果
 *
 * 新增能力只需要 `defineTool({...})` 再注册进 registry，
 * 助手循环、界面渲染、后端注册说明全部自动跟上。
 */

export interface ToolDefinition {
  name: string
  /** 给模型看的说明：什么时候用、参数含义 */
  description: string
  /** 给界面看的短标题 */
  title: string
  descriptor: ToolDescriptor
  run: (input: Record<string, unknown>, context: ToolContext) => Promise<ToolOutcome> | ToolOutcome
}

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : fallback

/* ------------------------------------------------------------------ *
 * create_page：零代码生成页面
 * ------------------------------------------------------------------ */

export const createPageTool: ToolDefinition = {
  name: 'create_page',
  title: '生成页面',
  description:
    '把一句话需求变成一个可预览、可应用的后台页面。当用户说“帮我做一个/实现一个/生成一个 XX 页面、看板、报表、统计页”时调用。返回页面规格，界面会渲染预览并提供「应用到侧边栏」。',
  descriptor: {
    name: 'create_page',
    description:
      '根据自然语言需求生成后台页面规格（KPI/图表/表格/清单等区块）。返回的页面会立即出现在预览区。',
    parameters: {
      type: 'object',
      properties: {
        requirement: {
          type: 'string',
          description: '用户的原始需求描述，尽量保留原文',
        },
        title: { type: 'string', description: '页面标题，例如「用户数据统计」' },
        topic: { type: 'string', description: '页面主题关键词，用于选择内置结构' },
        accent: {
          type: 'string',
          description: '强调色',
          enum: [...ACCENTS],
        },
        blocks: {
          type: 'array',
          description:
            '可选：自定义区块。留空则由内置模板生成（kpi/chart/table/list/progress/steps/text）',
          items: { type: 'object' },
        },
        dataSource: { type: 'string', description: '数据来源说明，例如「/api/users」' },
      },
      required: ['requirement'],
    },
  },
  run(input) {
    const requirement = str(input.requirement)
    const title = str(input.title)
    const topic = str(input.topic) || title || requirement

    // 模型给了自定义区块就优先用它；否则走内置模板
    const blocks = Array.isArray(input.blocks) ? input.blocks : undefined
    if (blocks?.length) {
      const spec = normalizePageSpec(
        {
          title: title || `${topic}页面`,
          description: requirement.slice(0, 120),
          path: input.path,
          icon: input.icon,
          blocks,
          theme: { accent: str(input.accent) || undefined, surface: 'gradient' },
          nav: { group: 'AI 生成', badge: 'AI' },
          dataSource: str(input.dataSource) || '演示数据',
          source: 'ai',
          prompt: requirement,
        },
        Date.now(),
      )
      if (spec) {
        return {
          kind: 'page' as const,
          page: spec,
          summary: `已生成页面《${spec.title}》，包含 ${spec.blocks.length} 个区块。`,
          suggestions: ['把主色改成紫色', '再加一个趋势图', '应用到侧边栏'],
        }
      }
    }

    const template = /用户|账号|会员/.test(`${topic} ${title}`)
      ? createUserStatsPage(topic)
      : createGenericDashboardPage(topic)
    const page: PageSpec = {
      ...template,
      title: title || template.title,
      description: requirement ? requirement.slice(0, 120) : template.description,
      theme: { ...template.theme, accent: str(input.accent) || template.theme.accent },
      prompt: requirement || template.prompt,
      dataSource: str(input.dataSource) || template.dataSource,
    }

    return {
      kind: 'page' as const,
      page,
      summary: `已生成页面《${page.title}》：${page.blocks.length} 个区块，可直接预览并应用到侧边栏。`,
      suggestions: ['把主色改成紫色', '再加一个明细表', '应用到侧边栏'],
    }
  },
}

/* ------------------------------------------------------------------ *
 * update_page：改标题 / 配色 / 区块
 * ------------------------------------------------------------------ */

export const updatePageTool: ToolDefinition = {
  name: 'update_page',
  title: '调整页面',
  description:
    '修改当前页面：换主色、调圆角密度、改标题、替换区块。用户说「改成紫色」「标题换成 XX」「去掉表格」时调用。',
  descriptor: {
    name: 'update_page',
    description: '对当前（最近一次生成的）页面做增量修改，未提供的字段保持不变。',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '新标题' },
        accent: { type: 'string', description: '强调色', enum: [...ACCENTS] },
        radius: {
          type: 'string',
          description: '圆角',
          enum: ['none', 'small', 'medium', 'large', 'xlarge'],
        },
        density: {
          type: 'string',
          description: '密度',
          enum: ['compact', 'default', 'comfortable'],
        },
        surface: { type: 'string', description: '背景气质', enum: ['plain', 'gradient'] },
        blocks: {
          type: 'array',
          description: '完整替换区块（可选，一般只改配色时不要传）',
          items: { type: 'object' },
        },
      },
    },
  },
  run(input, context) {
    const base = context.session.lastPage
    if (!base) {
      return {
        kind: 'guide' as const,
        summary: '当前没有可修改的页面。先说一句「帮我做一个用户数据统计页面」即可生成。',
        suggestions: ['帮我实现一个用户数据统计页面'],
      }
    }

    const page = patchPageSpec(
      base,
      {
        title: str(input.title) || undefined,
        theme: {
          accent: str(input.accent) || undefined,
          radius: str(input.radius) || undefined,
          density: str(input.density) || undefined,
          surface:
            input.surface === 'plain' || input.surface === 'gradient' ? input.surface : undefined,
        },
        blocks: Array.isArray(input.blocks) ? input.blocks : undefined,
      },
      Date.now(),
    )

    const changed: string[] = []
    if (str(input.title)) changed.push(`标题 → ${page.title}`)
    if (str(input.accent)) changed.push(`主色 → ${str(input.accent)}`)
    if (str(input.radius)) changed.push(`圆角 → ${str(input.radius)}`)
    if (str(input.density)) changed.push(`密度 → ${str(input.density)}`)
    if (input.surface) changed.push(`背景 → ${input.surface}`)
    if (Array.isArray(input.blocks)) changed.push(`区块 → ${page.blocks.length} 个`)

    return {
      kind: 'page' as const,
      page,
      summary: changed.length
        ? `已更新《${page.title}》：${changed.join('，')}。`
        : `页面《${page.title}》已刷新（无字段变化）。`,
      suggestions: ['换成深色更克制的配色', '再加一个趋势图', '应用到侧边栏'],
    }
  },
}

/* ------------------------------------------------------------------ *
 * apply_page：落到侧边栏
 * ------------------------------------------------------------------ */

export const applyPageTool: ToolDefinition = {
  name: 'apply_page',
  title: '应用到侧边栏',
  description:
    '把当前页面正式写入项目：新增侧边栏入口与路由。用户说「应用」「添加到侧边栏」「上线」时调用。',
  descriptor: {
    name: 'apply_page',
    description: '将最近生成的页面应用到项目模板（加入侧边栏与路由）。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '可选：自定义路由路径' },
      },
    },
  },
  run(input, context) {
    const page = context.session.lastPage
    if (!page) {
      return {
        kind: 'guide' as const,
        summary: '还没有可应用的页面，先生成一个吧。',
        suggestions: ['帮我实现一个用户数据统计页面'],
      }
    }
    const target: PageSpec = {
      ...page,
      path: str(input.path) ? normalizePathLike(str(input.path)) : page.path,
    }
    context.emit({ type: 'page', id: 'tool', page: target })
    return {
      kind: 'page' as const,
      page: target,
      summary: `已把《${target.title}》加入侧边栏（${target.path}），刷新后仍保留。`,
      suggestions: ['再生成一个订单分析页'],
    }
  },
}

function normalizePathLike(value: string): string {
  const slug = value
    .replace(/[^a-zA-Z0-9/_-]/g, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
  return slug.startsWith('generated/') ? `/${slug}` : `/generated/${slug || 'page'}`
}

/* ------------------------------------------------------------------ *
 * 后端接口相关：注册 / 列清单 / 调用
 * ------------------------------------------------------------------ */

export const listApisTool: ToolDefinition = {
  name: 'list_api_operations',
  title: '接口清单',
  description:
    '列出项目已交给助手的后端接口。用户问「助手能调哪些接口」「怎么把后端交给助手」时调用。',
  descriptor: {
    name: 'list_api_operations',
    description: '列出已注册给助手的后端操作（id / 方法 / 路径 / 说明）。',
    parameters: { type: 'object', properties: {} },
  },
  run(_input, context) {
    const operations = context.api.list()
    if (!operations.length) {
      return {
        kind: 'api' as const,
        summary:
          '目前还没有注册后端接口。用 registerAssistantApi([...]) 声明一条即可，助手会立刻能调用它。',
        data: { operations: [] },
        suggestions: ['怎么把后端接口交给助手'],
      }
    }
    const lines = operations
      .map((op) => `${op.method} ${op.path} — ${op.title}（${op.id}）`)
      .join('\n')
    return {
      kind: 'api' as const,
      summary: `已注册 ${operations.length} 个接口：\n${lines}`,
      data: { operations },
      suggestions: ['调用用户列表接口看看', '怎么把后端接口交给助手'],
    }
  },
}

/**
 * 操作 id 归一化
 *
 * 模型从工具清单里看到的名字是 `api_user_list`（前缀是我们加的），
 * 但 `list_api_operations` 返回的摘要里写的是 `user_list` —— 两种都会被它拿去当参数。
 * 与其让它失败一次再纠正，不如两种写法都认。
 *
 * 顺带兜住三类同义输入：带 `api_` 前缀、带空格/大小写差异、直接给中文标题。
 */
function resolveOperation(
  operations: AssistantApiOperation[],
  raw: string,
): { operation?: AssistantApiOperation; input: string } {
  const wanted = raw.trim()
  if (!wanted) return { input: '' }
  const normalized = wanted
    .toLowerCase()
    .replace(/^api_/, '')
    .replace(/[\s-]+/g, '_')

  const exact = operations.find((item) => item.id === wanted)
  if (exact) return { operation: exact, input: wanted }

  const byId = operations.find(
    (item) => item.id.toLowerCase().replace(/[\s-]+/g, '_') === normalized,
  )
  if (byId) return { operation: byId, input: wanted }

  // 中文标题 / 路径片段：用户说「用户统计」时模型可能直接把标题塞进 id
  const byTitle = operations.find(
    (item) => item.title === wanted || item.path === wanted || wanted.includes(item.title),
  )
  return { operation: byTitle, input: wanted }
}

export const callApiTool: ToolDefinition = {
  name: 'call_api',
  title: '调用后端接口',
  description:
    '调用一个已注册的后端操作，把真实数据取回来。用户说「查一下用户列表」「调用 XX 接口」时调用。',
  descriptor: {
    name: 'call_api',
    description: '调用已注册的后端操作并返回结果摘要。',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '操作 id（来自 list_api_operations，例如 user_list；带 api_ 前缀也接受）',
        },
        input: { type: 'object', description: '参数对象，例如 { keyword: "陈" }' },
      },
      required: ['id'],
    },
  },
  async run(input, context) {
    const operations = context.api.list()
    const { operation } = resolveOperation(operations, str(input.id))
    if (!operation) {
      const wanted = str(input.id) || '(空)'
      return {
        kind: 'api' as const,
        summary: `没有找到 id 为 ${wanted} 的操作。可用：${operations.map((item) => item.id).join('、') || '无'}。请改用其中之一重试。`,
        suggestions: ['助手能调哪些接口'],
      }
    }
    const payload =
      input.input && typeof input.input === 'object' ? (input.input as Record<string, unknown>) : {}
    const result = await context.api.call(operation.id, payload)
    if (!result.ok) {
      return {
        kind: 'api' as const,
        summary: `调用 ${operation.method} ${operation.path} 失败：${result.error ?? '未知错误'}`,
        data: result,
      }
    }
    return {
      kind: 'data' as const,
      summary: `调用 ${operation.method} ${operation.path} 成功（${result.elapsedMs ?? 0}ms）：${previewData(result.data)}`,
      data: result.data,
      suggestions: ['把这份数据做成一个页面'],
    }
  },
}

function previewData(data: unknown): string {
  if (data === undefined || data === null) return '无返回'
  if (Array.isArray(data)) return `返回 ${data.length} 条记录`
  if (typeof data === 'object') {
    const record = data as Record<string, unknown>
    if (Array.isArray(record.items))
      return `返回 ${record.items.length} 条（共 ${String(record.total ?? record.items.length)}）`
    return `字段：${Object.keys(record).slice(0, 8).join('、')}`
  }
  return String(data).slice(0, 120)
}

/* ------------------------------------------------------------------ *
 * 使用指南：告诉客户怎么把后端交给助手
 * ------------------------------------------------------------------ */

const BACKEND_GUIDE_ZH = `把后端接口交给助手，只要三步：

1. 声明操作（src/ai/api-operations.ts）
\`\`\`ts
import { registerAssistantApi } from '@/ai'

registerAssistantApi([
  {
    id: 'user_list',
    title: '用户列表',
    description: '分页查询用户，支持关键字搜索',
    method: 'GET',
    path: '/users',
    params: { page: '页码', pageSize: '每页条数', keyword: '姓名/邮箱关键字' },
  },
  {
    id: 'order_stats',
    title: '订单统计',
    method: 'GET',
    path: '/orders/stats',
  },
])
\`\`\`

2. 执行器（已内置，默认走 core/http 的 api 客户端）
\`\`\`ts
configureAssistantApiExecutor(async (operation, input) => {
  const data = await api.request(operation.method, operation.path, { params: input })
  return { ok: true, data, elapsedMs }
})
\`\`\`

3. 验证：在这里问一句「助手能调哪些接口」，助手会列出当前清单；
   再问「查一下用户列表」，它会真的发起请求。

要点：
- 只登记**允许助手访问**的接口，不要贪多；
- 写操作请把 mutating 设为 true，界面会标记为高风险；
- 接口签名变了只改这一处，页面与助手都不受影响。`

const BACKEND_GUIDE_EN = `Hand your backend to the assistant in three steps:

1. Declare operations (src/ai/api-operations.ts)
\`\`\`ts
registerAssistantApi([
  { id: 'user_list', title: 'Users', description: 'Paged user search',
    method: 'GET', path: '/users', params: { keyword: 'name or email' } },
])
\`\`\`

2. Executor (built in, defaults to the core/http client)
\`\`\`ts
configureAssistantApiExecutor(async (operation, input) => {
  const data = await api.request(operation.method, operation.path, { params: input })
  return { ok: true, data }
})
\`\`\`

3. Verify: ask "which API operations can you call?" and then "fetch the user list".`

export const backendGuideTool: ToolDefinition = {
  name: 'explain_backend_integration',
  title: '接入后端说明',
  description:
    '用户问「怎么把后端接口交给助手」「如何接入接口」「怎样让助手调用我的 API」时调用，返回带代码示例的步骤。',
  descriptor: {
    name: 'explain_backend_integration',
    description: '返回「把后端接口交给助手」的步骤与代码示例。',
    parameters: { type: 'object', properties: {} },
  },
  run(_input, context) {
    const isEn = context.session.locale.startsWith('en')
    const operations = context.api.list()
    return {
      kind: 'guide' as const,
      summary: isEn ? BACKEND_GUIDE_EN : BACKEND_GUIDE_ZH,
      data: { registered: operations.length },
      suggestions: ['助手能调哪些接口', '帮我实现一个用户数据统计页面'],
    }
  },
}

/* ------------------------------------------------------------------ *
 * 注册表
 * ------------------------------------------------------------------ */

export const BUILTIN_TOOLS: ToolDefinition[] = [
  createPageTool,
  updatePageTool,
  applyPageTool,
  listApisTool,
  callApiTool,
  backendGuideTool,
]

/** 把注册的后端操作投影成「工具」——模型看到的是统一函数调用 */
export function apiOperationTools(operations: AssistantApiOperation[]): ToolDefinition[] {
  return operations.map((operation) => ({
    name: `api_${operation.id}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64),
    title: operation.title,
    description: operation.description,
    descriptor: {
      name: `api_${operation.id}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64),
      description: `${operation.title}：${operation.description}（${operation.method} ${operation.path}）`,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(operation.params ?? {}).map(([key, description]) => [
            key,
            { type: 'string' as const, description },
          ]),
        ),
        required: [],
      },
    },
    async run(input, context) {
      const result = await context.api.call(operation.id, input)
      return {
        kind: 'data' as const,
        summary: result.ok
          ? `${operation.title} 调用成功：${previewData(result.data)}`
          : `${operation.title} 调用失败：${result.error ?? '未知错误'}`,
        data: result.data,
      }
    },
  }))
}

/** 事件通道：工具内部上报进度（目前只有页面事件会被界面消费） */
export function createEventBus(sink: (event: AssistantEvent) => void) {
  return (event: AssistantEvent) => sink(event)
}

export type { AssistantSessionView }
export const CHART_VARIANT_HINT = CHART_VARIANTS.join(' / ')
