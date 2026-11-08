/**
 * 页面规格（Page Spec）
 *
 * 「零代码开发」的关键：模型不生成 React 代码，而是生成一份**受限的描述**。
 * 好处：
 * - 渲染侧只有一套受控组件，不存在任意代码注入 / 样式失控 / 包体膨胀
 * - 规格可序列化，可以存 localStorage、导出 JSON、交给同事复用
 * - 同一份规格既能生成路由页，也能渲染成对话框里的预览
 *
 * 本文件只做「纯数据」：校验、归一化、示例模板。不含任何 React 依赖。
 */

export type PageBlockKind = 'kpi' | 'chart' | 'table' | 'list' | 'text' | 'progress' | 'steps'

export type ChartVariant = 'line' | 'area' | 'bar' | 'pie' | 'donut'

export type ToneName = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'

export interface KpiItem {
  label: string
  value: string
  suffix?: string
  delta?: number
  tone?: ToneName
  /** 迷你趋势线，长度 >= 2 才绘制 */
  trend?: number[]
}

export interface KpiBlock {
  kind: 'kpi'
  items: KpiItem[]
}

export interface ChartSeries {
  name: string
  data: number[]
}

export interface ChartBlock {
  kind: 'chart'
  title: string
  description?: string
  variant: ChartVariant
  /** 横轴类别（饼图时用作扇区名） */
  categories: string[]
  series: ChartSeries[]
  /** 数值单位，显示在轴标签/提示里 */
  unit?: string
  /** 高度（px），缺省 260 */
  height?: number
}

export interface TableColumn {
  key: string
  label: string
  /** 右对齐（数值列） */
  align?: 'left' | 'right'
  /** 数字格式化：整数千分位 / 百分比 / 金额 */
  format?: 'number' | 'percent' | 'currency' | 'text'
}

export interface TableBlock {
  kind: 'table'
  title: string
  description?: string
  columns: TableColumn[]
  rows: Array<Record<string, string | number>>
  /** 是否显示表尾统计 */
  footer?: string
}

export interface ListItem {
  title: string
  description?: string
  meta?: string
  tone?: ToneName
  progress?: number
}

export interface ListBlock {
  kind: 'list'
  title: string
  description?: string
  items: ListItem[]
}

export interface TextBlock {
  kind: 'text'
  title?: string
  body: string
}

export interface ProgressBlock {
  kind: 'progress'
  title: string
  description?: string
  items: Array<{ label: string; value: number; max?: number; tone?: ToneName; hint?: string }>
}

export interface StepsBlock {
  kind: 'steps'
  title: string
  description?: string
  items: Array<{ title: string; description?: string; status?: 'done' | 'current' | 'pending' }>
}

export type PageBlock =
  KpiBlock | ChartBlock | TableBlock | ListBlock | TextBlock | ProgressBlock | StepsBlock

export interface PageTheme {
  /** 强调色 id（由宿主应用映射到具体色板） */
  accent?: string
  /** 圆角：none / small / medium / large / xlarge */
  radius?: string
  /** 密度：compact / default / comfortable */
  density?: string
  /** 背景气质：plain / gradient */
  surface?: 'plain' | 'gradient'
}

export interface PageNav {
  /** 侧边栏分组标题，缺省「AI 生成」 */
  group?: string
  /** 排序权重，越小越靠上 */
  order?: number
  /** 侧栏徽标 */
  badge?: string
}

export interface PageSpec {
  id: string
  title: string
  description: string
  /** 路由路径，必须以 / 开头 */
  path: string
  /** 图标 id（宿主映射到图标组件） */
  icon: string
  createdAt: number
  updatedAt: number
  /** 版本号：每次修改 +1，方便判断是否为「新生成」 */
  version: number
  source: 'ai' | 'template' | 'manual'
  theme: PageTheme
  nav: PageNav
  blocks: PageBlock[]
  /** 数据来源说明：演示数据 / 某个后端接口 */
  dataSource?: string
  /** 生成时的原始需求，便于「继续修改」时给模型上下文 */
  prompt?: string
}

/* ------------------------------------------------------------------ *
 * 常量
 * ------------------------------------------------------------------ */

export const PAGE_BLOCK_KINDS: PageBlockKind[] = [
  'kpi',
  'chart',
  'table',
  'list',
  'text',
  'progress',
  'steps',
]

export const CHART_VARIANTS: ChartVariant[] = ['line', 'area', 'bar', 'pie', 'donut']

export const TONES: ToneName[] = ['primary', 'success', 'warning', 'danger', 'neutral']

export const ACCENTS = [
  'blue',
  'violet',
  'emerald',
  'amber',
  'rose',
  'rosewood',
  'ocean',
  'sunset',
  'forest',
  'lavender',
] as const

export const ICON_IDS = [
  'sparkles',
  'users',
  'chart',
  'table',
  'layers',
  'activity',
  'file',
  'settings',
  'wallet',
  'shield',
] as const

export type IconId = (typeof ICON_IDS)[number]

/** 单页最大区块数：避免模型一次吐出上百个区块把页面撑爆 */
export const MAX_BLOCKS = 14
/** 单表最大行数 */
export const MAX_ROWS = 60

/* ------------------------------------------------------------------ *
 * 归一化（把模型输出收敛成可用规格）
 * ------------------------------------------------------------------ */

const str = (value: unknown, fallback = '', max = 400): string => {
  if (typeof value === 'string') return value.trim().slice(0, max) || fallback
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

const num = (value: unknown): number | undefined => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const tone = (value: unknown): ToneName | undefined =>
  TONES.includes(value as ToneName) ? (value as ToneName) : undefined

const chartVariant = (value: unknown): ChartVariant =>
  CHART_VARIANTS.includes(value as ChartVariant) ? (value as ChartVariant) : 'bar'

function numberList(value: unknown, max = 24): number[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => num(item))
    .filter((item): item is number => item !== undefined)
    .slice(0, max)
}

function stringList(value: unknown, max = 24): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => str(item, '', 60))
    .filter(Boolean)
    .slice(0, max)
}

function normalizeBlock(input: unknown, index: number): PageBlock | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Record<string, unknown>
  const kind = str(raw.kind, '', 20) as PageBlockKind

  if (kind === 'kpi') {
    const items = Array.isArray(raw.items) ? raw.items : []
    const normalized: KpiItem[] = items.slice(0, 8).flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const entry = item as Record<string, unknown>
      const label = str(entry.label, '', 40)
      if (!label) return []
      const trend = numberList(entry.trend, 16)
      return [
        {
          label,
          value: str(entry.value, '—', 24),
          suffix: str(entry.suffix, '', 10) || undefined,
          delta: num(entry.delta),
          tone: tone(entry.tone),
          trend: trend.length >= 2 ? trend : undefined,
        },
      ]
    })
    return normalized.length ? { kind: 'kpi', items: normalized } : null
  }

  if (kind === 'chart') {
    const categories = stringList(raw.categories, 24)
    const rawSeries = Array.isArray(raw.series) ? raw.series : []
    const series: ChartSeries[] = rawSeries.slice(0, 4).flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const entry = item as Record<string, unknown>
      const name = str(entry.name, '', 40)
      const data = numberList(entry.data, 24)
      if (!name || data.length === 0) return []
      return [{ name, data }]
    })
    if (!series.length) return null
    const width = Math.max(...series.map((item) => item.data.length), categories.length)
    return {
      kind: 'chart',
      title: str(raw.title, `图表 ${index + 1}`, 60),
      description: str(raw.description, '', 120) || undefined,
      variant: chartVariant(raw.variant),
      categories: categories.length
        ? categories.slice(0, width)
        : Array.from({ length: width }, (_, i) => String(i + 1)),
      series: series.map((item) => ({
        ...item,
        data: Array.from({ length: width }, (_, i) => item.data[i] ?? 0),
      })),
      unit: str(raw.unit, '', 10) || undefined,
      height: Math.min(Math.max(num(raw.height) ?? 260, 160), 420),
    }
  }

  if (kind === 'table') {
    const columns = (Array.isArray(raw.columns) ? raw.columns : []).slice(0, 8).flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const entry = item as Record<string, unknown>
      const key = str(entry.key, '', 32)
      const label = str(entry.label, '', 40)
      if (!key || !label) return []
      const format = ['number', 'percent', 'currency', 'text'].includes(String(entry.format))
        ? (entry.format as TableColumn['format'])
        : undefined
      return [
        {
          key,
          label,
          align: entry.align === 'right' ? ('right' as const) : undefined,
          format,
        },
      ]
    })
    const rows = (Array.isArray(raw.rows) ? raw.rows : []).slice(0, MAX_ROWS).flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const entry = item as Record<string, unknown>
      const row: Record<string, string | number> = {}
      for (const column of columns) {
        const value = entry[column.key]
        row[column.key] = typeof value === 'number' ? value : str(value, '', 80)
      }
      return [row]
    })
    if (!columns.length || !rows.length) return null
    return {
      kind: 'table',
      title: str(raw.title, `数据表 ${index + 1}`, 60),
      description: str(raw.description, '', 120) || undefined,
      columns,
      rows,
      footer: str(raw.footer, '', 80) || undefined,
    }
  }

  if (kind === 'list') {
    const items = (Array.isArray(raw.items) ? raw.items : []).slice(0, 12).flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const entry = item as Record<string, unknown>
      const title = str(entry.title, '', 60)
      if (!title) return []
      return [
        {
          title,
          description: str(entry.description, '', 160) || undefined,
          meta: str(entry.meta, '', 40) || undefined,
          tone: tone(entry.tone),
          progress: num(entry.progress),
        },
      ]
    })
    return items.length
      ? {
          kind: 'list',
          title: str(raw.title, `清单 ${index + 1}`, 60),
          description: str(raw.description, '', 120) || undefined,
          items,
        }
      : null
  }

  if (kind === 'text') {
    const body = str(raw.body, '', 1200)
    return body ? { kind: 'text', title: str(raw.title, '', 60) || undefined, body } : null
  }

  if (kind === 'progress') {
    const items = (Array.isArray(raw.items) ? raw.items : []).slice(0, 8).flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const entry = item as Record<string, unknown>
      const label = str(entry.label, '', 40)
      const value = num(entry.value)
      if (!label || value === undefined) return []
      return [
        {
          label,
          value,
          max: num(entry.max) ?? 100,
          tone: tone(entry.tone),
          hint: str(entry.hint, '', 40) || undefined,
        },
      ]
    })
    return items.length
      ? {
          kind: 'progress',
          title: str(raw.title, '进度', 60),
          description: str(raw.description, '', 120) || undefined,
          items,
        }
      : null
  }

  if (kind === 'steps') {
    const items = (Array.isArray(raw.items) ? raw.items : []).slice(0, 8).flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const entry = item as Record<string, unknown>
      const title = str(entry.title, '', 60)
      if (!title) return []
      const status = ['done', 'current', 'pending'].includes(String(entry.status))
        ? (entry.status as 'done' | 'current' | 'pending')
        : undefined
      return [{ title, description: str(entry.description, '', 160) || undefined, status }]
    })
    return items.length
      ? {
          kind: 'steps',
          title: str(raw.title, '流程', 60),
          description: str(raw.description, '', 120) || undefined,
          items,
        }
      : null
  }

  return null
}

/** 路径归一化：必须以 / 开头，只保留安全字符 */
export function normalizePath(value: unknown, fallbackTitle: string): string {
  const raw = str(value, '', 80)
  const base = raw
    .replace(/[^a-zA-Z0-9/_-]/g, '')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '')
  if (base.startsWith('/generated/') && base.length > '/generated/'.length) return base
  const slug = base.replace(/^\//, '').split('/').pop() ?? ''
  const safeSlug =
    slug ||
    fallbackTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') ||
    `page-${Date.now().toString(36)}`
  return `/generated/${safeSlug.replace(/^-+|-+$/g, '').slice(0, 40)}`
}

/**
 * 把任意输入收敛成合法 PageSpec
 *
 * 失败返回 null（例如模型只回了空数组）——调用方据此走兜底模板，
 * 而不是渲染一个空壳页面。
 */
export function normalizePageSpec(input: unknown, now = Date.now()): PageSpec | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Record<string, unknown>
  const title = str(raw.title, '', 60)
  if (!title) return null
  const blocks = (Array.isArray(raw.blocks) ? raw.blocks : [])
    .slice(0, MAX_BLOCKS)
    .map((block, index) => normalizeBlock(block, index))
    .filter((block): block is PageBlock => Boolean(block))
  if (!blocks.length) return null

  const themeRaw = (raw.theme && typeof raw.theme === 'object' ? raw.theme : {}) as Record<
    string,
    unknown
  >
  const navRaw = (raw.nav && typeof raw.nav === 'object' ? raw.nav : {}) as Record<string, unknown>
  const accent = str(themeRaw.accent, '', 20)
  const path = normalizePath(raw.path, title)
  const id = str(raw.id, '', 64) || `page_${path.split('/').pop() ?? Date.now().toString(36)}`

  return {
    id,
    title,
    description: str(raw.description, '', 160),
    path,
    icon: ICON_IDS.includes(raw.icon as IconId) ? (raw.icon as IconId) : 'sparkles',
    createdAt: num(raw.createdAt) ?? now,
    updatedAt: now,
    version: Math.max(1, Math.round(num(raw.version) ?? 1)),
    source: raw.source === 'template' || raw.source === 'manual' ? raw.source : 'ai',
    theme: {
      accent: ACCENTS.includes(accent as (typeof ACCENTS)[number]) ? accent : undefined,
      radius: ['none', 'small', 'medium', 'large', 'xlarge'].includes(String(themeRaw.radius))
        ? String(themeRaw.radius)
        : undefined,
      density: ['compact', 'default', 'comfortable'].includes(String(themeRaw.density))
        ? String(themeRaw.density)
        : undefined,
      surface: themeRaw.surface === 'gradient' ? 'gradient' : 'plain',
    },
    nav: {
      group: str(navRaw.group, '', 30) || 'AI 生成',
      order: Math.min(Math.max(num(navRaw.order) ?? 900, 100), 999),
      badge: str(navRaw.badge, '', 10) || undefined,
    },
    blocks,
    dataSource: str(raw.dataSource, '', 80) || undefined,
    prompt: str(raw.prompt, '', 400) || undefined,
  }
}

/**
 * 局部修改页面规格
 *
 * 用于「把主色改成紫色」「去掉表格」这类增量指令：
 * 只改动指定字段，其余保持原样，避免模型每次都要重吐整页。
 */
export function patchPageSpec(
  base: PageSpec,
  patch: {
    title?: string
    description?: string
    theme?: PageTheme
    nav?: PageNav
    blocks?: unknown
    icon?: string
  },
  now = Date.now(),
): PageSpec {
  const blocks = patch.blocks
    ? (Array.isArray(patch.blocks) ? patch.blocks : [])
        .slice(0, MAX_BLOCKS)
        .map((block, index) => normalizeBlock(block, index))
        .filter((block): block is PageBlock => Boolean(block))
    : base.blocks

  const accent = patch.theme?.accent
  return {
    ...base,
    title: patch.title ? str(patch.title, base.title, 60) : base.title,
    description:
      patch.description !== undefined ? str(patch.description, '', 160) : base.description,
    icon: patch.icon && ICON_IDS.includes(patch.icon as IconId) ? patch.icon : base.icon,
    theme: {
      ...base.theme,
      ...patch.theme,
      accent:
        accent && ACCENTS.includes(accent as (typeof ACCENTS)[number])
          ? accent
          : patch.theme && 'accent' in patch.theme
            ? undefined
            : base.theme.accent,
    },
    nav: { ...base.nav, ...patch.nav },
    blocks: blocks.length ? blocks : base.blocks,
    updatedAt: now,
    version: base.version + 1,
  }
}

/* ------------------------------------------------------------------ *
 * 内置模板：用户数据统计（本地引擎与兜底都用它）
 * ------------------------------------------------------------------ */

const hasCjk = (value: string) => /[\u4e00-\u9fa5]/.test(value)

/**
 * 需求 → 页面里用的主题词
 *
 * 两个坑：
 * 1. 模型常把 `topic` 填成英文（"user stats"）而标题是中文 ——
 *    直接拼进区块标题就会出现「user stats总数」这种中英混排；
 * 2. 「用户数据统计」直接进标题会变成「用户数据统计总数」。
 *
 * 所以：优先取含中文的部分，去掉尾部品类词；都不含中文时回落到默认主题。
 */
const describeTopic = (topic: string, fallback = '用户数据') => {
  const normalized = topic
    .replace(/[，。！？,.!?]/g, ' ')
    .replace(/(统计|分析|报表|看板|大屏|页面|数据表)$/g, '')
    .trim()
  if (!normalized || !hasCjk(normalized)) return fallback
  return normalized.slice(0, 16)
}

/** 标题 → 路径 slug（中文标题回落到时间戳，避免出现空 slug） */
export function slugFromTitle(title: string, seed: number): string {
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  return ascii || `page-${seed.toString(36)}`
}

/**
 * 生成「用户数据统计」页面
 *
 * 刻意写死成一份**真实可看**的结构（KPI + 趋势 + 渠道 + 明细表 + 排行），
 * 本地引擎在没有模型可用时也能交付一个完成度足够的页面。
 */
export function createUserStatsPage(topic: string, now = Date.now()): PageSpec {
  const subject = describeTopic(topic || '用户数据')
  const months = ['6月', '7月', '8月', '9月', '10月', '11月']
  const newUsers = [4120, 4680, 5210, 5890, 6340, 7120]
  const activeUsers = [9800, 10420, 11350, 12180, 13460, 14820]
  const channels = [
    { name: '自然搜索', value: 32 },
    { name: '官网直达', value: 24 },
    { name: '内容投放', value: 18 },
    { name: '渠道合作', value: 14 },
    { name: '社群裂变', value: 12 },
  ]
  const cities = [
    { city: '杭州', users: 4820, active: 3960, rate: '82.2%', spend: '¥186,400' },
    { city: '北京', users: 4380, active: 3410, rate: '77.9%', spend: '¥168,900' },
    { city: '深圳', users: 3960, active: 3120, rate: '78.8%', spend: '¥152,700' },
    { city: '上海', users: 3510, active: 2740, rate: '78.1%', spend: '¥141,300' },
    { city: '成都', users: 2480, active: 1830, rate: '73.8%', spend: '¥96,200' },
  ]

  const page: PageSpec = {
    id: `page_user_stats_${now.toString(36)}`,
    title: `${subject}统计`,
    description: `按月的${subject}规模、活跃与渠道结构，数据可在「接入后端」中替换为真实接口`,
    path: '/generated/user-stats',
    icon: 'users',
    createdAt: now,
    updatedAt: now,
    version: 1,
    source: 'template',
    theme: { accent: 'blue', surface: 'gradient' },
    nav: { group: 'AI 生成', order: 900, badge: 'AI' },
    dataSource: '演示数据（可用 registerAssistantApi 换成真实接口）',
    blocks: [
      {
        kind: 'kpi',
        items: [
          {
            label: `${subject}总数`,
            value: '27,420',
            delta: 12.4,
            tone: 'primary',
            trend: [18, 19, 21, 23, 25, 27],
          },
          {
            label: '月活跃用户',
            value: '14,820',
            delta: 8.7,
            tone: 'success',
            trend: [10, 11, 12, 13, 13.5, 14.8],
          },
          {
            label: '次日留存率',
            value: '41.6',
            suffix: '%',
            delta: 2.1,
            tone: 'warning',
            trend: [37, 38, 39, 40, 40.8, 41.6],
          },
          {
            label: '客单贡献',
            value: '¥86.4',
            delta: -1.3,
            tone: 'danger',
            trend: [92, 90, 89, 88, 87, 86.4],
          },
        ],
      },
      {
        kind: 'chart',
        title: `${subject}增长趋势`,
        description: '近 6 个月新增与活跃对比',
        variant: 'area',
        categories: months,
        series: [
          { name: '新增用户', data: newUsers },
          { name: '活跃用户', data: activeUsers },
        ],
        unit: '人',
        height: 260,
      },
      {
        kind: 'chart',
        title: '来源渠道占比',
        description: '新增用户的渠道结构',
        variant: 'donut',
        categories: channels.map((item) => item.name),
        series: [{ name: '占比', data: channels.map((item) => item.value) }],
        unit: '%',
        height: 240,
      },
      {
        kind: 'table',
        title: '城市分布明细',
        description: '按用户规模排序',
        columns: [
          { key: 'city', label: '城市' },
          { key: 'users', label: '用户数', align: 'right', format: 'number' },
          { key: 'active', label: '活跃数', align: 'right', format: 'number' },
          { key: 'rate', label: '活跃率', align: 'right' },
          { key: 'spend', label: '贡献金额', align: 'right' },
        ],
        rows: cities,
        footer: '共 5 个城市 · 数据每日 06:00 更新',
      },
      {
        kind: 'progress',
        title: '关键目标完成度',
        items: [
          { label: '年度用户目标', value: 68, tone: 'primary', hint: '27.4k / 40k' },
          { label: '月活渗透率', value: 54, tone: 'success', hint: '14.8k / 27.4k' },
          { label: '留存改善进度', value: 82, tone: 'warning', hint: '目标 45%' },
        ],
      },
    ],
  }
  return page
}

/**
 * 通用「数据看板」模板
 *
 * 需求没命中内置模板时使用：不承诺业务语义，但保证结构完整可用。
 */
export function createGenericDashboardPage(topic: string, now = Date.now()): PageSpec {
  const subject = describeTopic(topic || '业务数据', '业务数据')
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  return {
    id: `page_dashboard_${now.toString(36)}`,
    title: `${subject}看板`,
    description: `由助手生成的${subject}概览页，可按需继续调整颜色、指标与图表`,
    path: '/generated/dashboard',
    icon: 'chart',
    createdAt: now,
    updatedAt: now,
    version: 1,
    source: 'template',
    theme: { accent: 'ocean', surface: 'gradient' },
    nav: { group: 'AI 生成', order: 900, badge: 'AI' },
    dataSource: '演示数据',
    blocks: [
      {
        kind: 'kpi',
        items: [
          {
            label: '今日总量',
            value: '8,642',
            delta: 6.2,
            tone: 'primary',
            trend: [6, 7, 7.5, 8, 8.3, 8.6],
          },
          {
            label: '本周累计',
            value: '51,308',
            delta: 9.1,
            tone: 'success',
            trend: [40, 44, 46, 48, 50, 51],
          },
          { label: '平均耗时', value: '312', suffix: 'ms', delta: -4.5, tone: 'warning' },
          {
            label: '异常数',
            value: '12',
            delta: -18.0,
            tone: 'danger',
            trend: [22, 19, 17, 15, 13, 12],
          },
        ],
      },
      {
        kind: 'chart',
        title: '近 7 天走势',
        variant: 'bar',
        categories: days,
        series: [{ name: '数量', data: [6420, 7130, 6840, 7920, 8460, 5210, 4890] }],
        unit: '次',
      },
      {
        kind: 'list',
        title: '待关注事项',
        items: [
          {
            title: '接口 P95 超过阈值',
            description: 'pay-svc 近 1 小时 P95 820ms',
            meta: '高',
            tone: 'danger',
          },
          {
            title: '渠道成本上涨',
            description: '内容投放 CPA 环比 +12%',
            meta: '中',
            tone: 'warning',
          },
          {
            title: '新增用户结构优化',
            description: '自然搜索占比提升 3.2pt',
            meta: '低',
            tone: 'success',
          },
        ],
      },
      {
        kind: 'table',
        title: '最近记录',
        columns: [
          { key: 'name', label: '名称' },
          { key: 'value', label: '数值', align: 'right', format: 'number' },
          { key: 'status', label: '状态' },
        ],
        rows: [
          { name: '订单同步', value: 1284, status: '成功' },
          { name: '用户导入', value: 320, status: '成功' },
          { name: '对账任务', value: 48, status: '进行中' },
        ],
      },
    ],
  }
}
