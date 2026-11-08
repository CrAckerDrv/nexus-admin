import {
  createGenericDashboardPage,
  createUserStatsPage,
  patchPageSpec,
  type PageSpec,
} from './page-spec'
import type { AssistantApiOperation, ToolOutcome } from './types'

/**
 * 本地规划器（无模型时的降级引擎）
 *
 * 定位：**没有 API Key / 网关不通时，助手依然可用**。
 * 它不理解自然语言的全部细节，但能稳定识别演示与文档里承诺的几类指令：
 * - 生成页面（识别「用户数据统计」等关键词 → 选内置结构）
 * - 调整配色 / 标题 / 圆角密度
 * - 应用页面、查看接口清单、接入后端说明
 *
 * 这样「0 代码开发」与「客户把后端交给助手」两条主链路在任何环境下都走得通，
 * 也让演示环境不必依赖外网。
 */

export type PlannerIntent =
  | 'create-page'
  | 'update-visual'
  | 'update-title'
  | 'apply-page'
  | 'list-apis'
  | 'call-api'
  | 'backend-guide'
  | 'help'
  | 'chat'

export const ACCENT_KEYWORDS: Array<[string, string]> = [
  ['紫', 'violet'],
  ['极光', 'violet'],
  ['绿', 'emerald'],
  ['翡翠', 'emerald'],
  ['森林', 'forest'],
  ['橙', 'sunset'],
  ['琥珀', 'amber'],
  ['红', 'rose'],
  ['玫瑰', 'rosewood'],
  ['粉', 'rosewood'],
  ['青', 'ocean'],
  ['海风', 'ocean'],
  ['蓝', 'blue'],
  ['薰衣草', 'lavender'],
  ['purple', 'violet'],
  ['violet', 'violet'],
  ['green', 'emerald'],
  ['orange', 'sunset'],
  ['red', 'rose'],
  ['pink', 'rosewood'],
  ['cyan', 'ocean'],
  ['teal', 'ocean'],
  ['blue', 'blue'],
]

/** 识别「把主色改成紫色」这类要求 */
export function detectAccent(text: string): string | undefined {
  const lower = text.toLowerCase()
  for (const [keyword, accent] of ACCENT_KEYWORDS) {
    if (lower.includes(keyword)) return accent
  }
  return undefined
}

/** 识别密度 / 圆角 */
export function detectShape(text: string): { radius?: string; density?: string } {
  const result: { radius?: string; density?: string } = {}
  // 允许「圆角再大一点」「圆角调大」这类中间夹字的说法
  if (/(圆角|半径)[^。]{0,4}(大|圆|增)/.test(text) || /更圆/.test(text)) result.radius = 'large'
  else if (/(直角|方角|不要圆角|更方)/.test(text)) result.radius = 'none'
  if (/(紧凑|更密|更紧凑)/.test(text)) result.density = 'compact'
  else if (/(宽松|更舒适|疏松|更松)/.test(text)) result.density = 'comfortable'
  return result
}

/** 从「标题是 XX / 改成 XX」里抠标题 */
export function detectTitle(text: string): string | undefined {
  const patterns = [
    /标题(?:改|换)?(?:成|为|叫)[「“"']?([^」”"'，。,.!?]{2,24})/,
    /(?:改名|重命名)(?:为|成)[「“"']?([^」”"'，。,.!?]{2,24})/,
    /名字(?:改|换)(?:成|为)[「“"']?([^」”"'，。,.!?]{2,24})/,
  ]
  for (const pattern of patterns) {
    const match = pattern.exec(text)
    if (match?.[1]) return match[1].trim()
  }
  return undefined
}

/** 需求里的主题词：去掉动词与虚词后剩下的名词 */
export function detectTopic(text: string): string {
  const cleaned = text
    .replace(/^(帮我|请|麻烦|我想|我要|给我)+/g, '')
    .replace(/^(实现|做|生成|创建|搭|写|弄|建)(一个|个|一套|一份)?/g, '')
    .replace(/(页面|看板|报表|统计|分析|大屏|界面|功能)$/g, '')
    .replace(/[，。！？,.!?]/g, ' ')
    .trim()
  return cleaned.slice(0, 20)
}

export function isCreateRequest(text: string): boolean {
  if (/^(我)?(想要|想|需要)(一个|个)/.test(text))
    return /(页面|看板|报表|统计|分析|图表|大屏)/.test(text)
  if (
    /(实现|做|生成|创建|搭|建|写)(一个|个|一套|一份)?[^。]{0,12}(页面|看板|报表|统计|分析|大屏)/.test(
      text,
    )
  ) {
    return true
  }
  // 英文：build / create / make / generate ... (page|dashboard|report|stats)
  return /\b(build|create|make|generate|design|scaffold)\b[\s\S]{0,40}\b(page|dashboard|report|stats|statistics|screen|view)\b/i.test(
    text,
  )
}

export function isApplyRequest(text: string): boolean {
  if (/(应用|添加到侧边栏|加入侧边栏|上线|落地|放到菜单|挂到菜单|加到菜单)/.test(text)) return true
  return /\b(apply|add (it )?to (the )?sidebar|ship it|publish)\b/i.test(text)
}

export function isBackendGuideRequest(text: string): boolean {
  if (
    /(后端|接口|API|api).{0,8}(交给|接入|对接|绑定|怎么|如何|注册)|怎么.{0,4}接.{0,2}(后端|接口)/.test(
      text,
    )
  ) {
    return true
  }
  return /\b(hand|connect|wire|integrate)\b[\s\S]{0,24}\b(backend|api|endpoint)\b/i.test(text)
}

export function isListApiRequest(text: string): boolean {
  if (/(哪些|多少个|列出|清单|列表).{0,6}(接口|API|api|操作)/.test(text)) return true
  if (/(接口清单)/.test(text)) return true
  return /\b(which|list|what)\b[\s\S]{0,20}\b(api|endpoint|operation)s?\b/i.test(text)
}

export function isCallApiRequest(text: string): boolean {
  if (/(查一下|查询|调用|请求|拉取|取一下).{0,12}(接口|API|api|用户列表|订单)/.test(text))
    return true
  return /\b(fetch|call|query|pull)\b[\s\S]{0,20}\b(api|endpoint|user list|orders?)\b/i.test(text)
}

export function isVisualUpdateRequest(text: string): boolean {
  return /(颜色|配色|主色|主题色|换成|改成|变).{0,10}(色|紫|蓝|绿|红|橙|青|粉)?/.test(text)
}

export function detectIntent(text: string, hasPage: boolean): PlannerIntent {
  const normalized = text.trim()
  if (!normalized) return 'help'
  if (isCallApiRequest(normalized)) return 'call-api'
  if (isListApiRequest(normalized)) return 'list-apis'
  if (isBackendGuideRequest(normalized)) return 'backend-guide'
  if (hasPage && isApplyRequest(normalized)) return 'apply-page'
  if (hasPage && detectAccent(normalized)) return 'update-visual'
  if (hasPage && detectShape(normalized).radius) return 'update-visual'
  if (hasPage && detectShape(normalized).density) return 'update-visual'
  if (hasPage && detectTitle(normalized)) return 'update-title'
  if (isCreateRequest(normalized)) return 'create-page'
  if (hasPage && /(再|加|增加).{0,4}(一个|个)?(图|表|卡片)/.test(normalized)) return 'update-visual'
  return 'chat'
}

/** 执行本地规划：产出与工具一致的 ToolOutcome */
export function planLocally(
  text: string,
  options: {
    lastPage?: PageSpec
    locale?: string
    apiOperations?: AssistantApiOperation[]
  } = {},
): ToolOutcome {
  const { lastPage, locale = 'zh-CN' } = options
  const intent = detectIntent(text, Boolean(lastPage))
  const isEn = locale.startsWith('en')

  if (intent === 'apply-page' && lastPage) {
    return {
      kind: 'page',
      page: lastPage,
      summary: isEn
        ? `Applied "${lastPage.title}" to the sidebar.`
        : `已把《${lastPage.title}》加入侧边栏，入口在「AI 生成」分组下。`,
      suggestions: isEn ? ['Generate an order report'] : ['再生成一个订单分析页'],
    }
  }

  if (intent === 'update-visual' && lastPage) {
    const accent = detectAccent(text)
    const shape = detectShape(text)
    const wantsExtraChart = /(再|加|增加).{0,4}(一个|个)?(图|表)/.test(text)
    if (wantsExtraChart) {
      const blocks = [
        ...lastPage.blocks,
        {
          kind: 'chart' as const,
          title: isEn ? 'Extra trend' : '补充趋势',
          description: isEn ? 'Added by the assistant' : '由助手追加',
          variant: 'line' as const,
          categories: ['第 1 周', '第 2 周', '第 3 周', '第 4 周'],
          series: [{ name: isEn ? 'Value' : '数值', data: [32, 46, 41, 58] }],
        },
      ]
      const page = patchPageSpec(lastPage, { blocks })
      return {
        kind: 'page',
        page,
        summary: isEn
          ? `Added a trend chart to "${page.title}".`
          : `已给《${page.title}》追加一个趋势图。`,
        suggestions: isEn
          ? ['Apply to sidebar', 'Make it purple']
          : ['应用到侧边栏', '把主色改成紫色'],
      }
    }
    if (!accent && !shape.radius && !shape.density) {
      return {
        kind: 'text',
        summary: isEn
          ? 'Tell me the colour, e.g. "make it purple".'
          : '告诉我想要什么效果，例如「把主色改成紫色」「圆角再大一点」「用紧凑密度」。',
        suggestions: isEn ? ['Make it purple'] : ['把主色改成紫色', '圆角再大一点', '用紧凑密度'],
      }
    }
    const page = patchPageSpec(lastPage, {
      theme: { accent, radius: shape.radius, density: shape.density },
    })
    const changed: string[] = []
    if (accent) changed.push(isEn ? `accent → ${accent}` : `主色 → ${accent}`)
    if (shape.radius) changed.push(isEn ? `radius → ${shape.radius}` : `圆角 → ${shape.radius}`)
    if (shape.density) changed.push(isEn ? `density → ${shape.density}` : `密度 → ${shape.density}`)
    return {
      kind: 'page',
      page,
      summary: isEn
        ? `Updated "${page.title}": ${changed.join(', ')}.`
        : `已更新《${page.title}》：${changed.join('，')}。`,
      suggestions: isEn ? ['Apply to sidebar'] : ['应用到侧边栏', '把背景换成渐变'],
    }
  }

  if (intent === 'update-title' && lastPage) {
    const title = detectTitle(text)
    if (title) {
      const page = patchPageSpec(lastPage, { title })
      return {
        kind: 'page',
        page,
        summary: isEn ? `Renamed to "${title}".` : `已把标题改成《${title}》。`,
        suggestions: isEn ? ['Make it purple'] : ['把主色改成紫色'],
      }
    }
  }

  if (intent === 'create-page') {
    const topic = detectTopic(text) || (isEn ? 'User data' : '用户数据')
    const isUserRelated = /用户|账号|会员|user|member/i.test(text)
    const template = isUserRelated ? createUserStatsPage(topic) : createGenericDashboardPage(topic)
    const page: PageSpec = { ...template, prompt: text }
    return {
      kind: 'page',
      page,
      summary: isEn
        ? `Generated "${page.title}" with ${page.blocks.length} blocks. Preview below — apply it to the sidebar when ready.`
        : `已生成《${page.title}》：${page.blocks.length} 个区块。右侧可预览，满意后点「应用到侧边栏」。`,
      suggestions: isEn
        ? ['Make it purple', 'Add a detail table', 'Apply to sidebar']
        : ['把主色改成紫色', '再加一个明细表', '应用到侧边栏'],
    }
  }

  if (intent === 'list-apis') {
    const operations = options.apiOperations ?? []
    if (!operations.length) {
      return {
        kind: 'guide',
        summary: isEn
          ? 'No backend operations registered yet. Declare them with registerAssistantApi([...]) and the assistant can call them right away.'
          : '还没有注册后端接口。用 registerAssistantApi([...]) 声明一条，助手立刻就能调用它。',
        suggestions: isEn
          ? ['How do I hand my backend to the assistant?']
          : ['怎么把后端接口交给助手'],
      }
    }
    return {
      kind: 'api',
      summary: isEn
        ? `Registered operations:\n${operations.map((op) => `${op.method} ${op.path} — ${op.title}`).join('\n')}`
        : `已注册的接口：\n${operations.map((op) => `${op.method} ${op.path} — ${op.title}`).join('\n')}`,
      data: { operations },
      suggestions: isEn ? ['Fetch the user list'] : ['查一下用户列表'],
    }
  }

  if (intent === 'backend-guide') {
    return {
      kind: 'guide',
      summary: isEn
        ? `Hand the backend to the assistant in three steps:

1. Declare it — src/ai/api-operations.ts
   registerAssistantApi([{ id: 'user_list', title: 'Users', method: 'GET', path: '/users' }])
2. The executor is already wired to core/http; override with configureAssistantApiExecutor if needed.
3. Ask "which API operations can you call?" to verify.`
        : `把后端接口交给助手只要三步：

1. 声明 —— src/ai/api-operations.ts
   registerAssistantApi([{ id: 'user_list', title: '用户列表', method: 'GET', path: '/users' }])
2. 执行器已默认接到 core/http；需要自定义时用 configureAssistantApiExecutor 覆盖。
3. 在这里问「助手能调哪些接口」即可验证，再问「查一下用户列表」它会真的发起请求。`,
      suggestions: isEn ? ['Which API operations can you call?'] : ['助手能调哪些接口'],
    }
  }

  return {
    kind: 'text',
    summary: isEn
      ? `I can build pages for you, adjust their colours, and apply them to the sidebar. Try: "Build a user statistics page".`
      : `我可以帮你生成页面、调整配色，并把它落到侧边栏。试试：「帮我实现一个用户数据统计页面」。`,
    suggestions: isEn
      ? ['Build a user statistics page', 'How do I hand my backend to the assistant?']
      : ['帮我实现一个用户数据统计页面', '怎么把后端接口交给助手'],
  }
}

/** 供界面展示：本地引擎响应的语气前缀 */
export function localEngineNotice(locale: string): string {
  return locale.startsWith('en')
    ? 'Local engine · no model key configured'
    : '本地引擎 · 未配置模型密钥'
}
