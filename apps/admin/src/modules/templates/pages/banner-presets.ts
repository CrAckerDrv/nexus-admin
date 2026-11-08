import type { BannerTone, BannerVariant } from '@nexus/ui'
import { BANNER_IMAGES } from '@/assets/banners'

/**
 * 横幅模板清单（单一事实来源）
 *
 * 模板中心、组件橱窗、经营概览的欢迎横幅都读这一份：
 * 新增一个横幅不只是加一张图，而是同时更新「模板页 / 组件库 / 实际落地页」三处，
 * 所以把内容集中在这里，页面只负责排版。
 *
 * 字段约定：
 * - `image` 取 `BANNER_IMAGES` 的 key，页面按需取地址，避免各处手写路径；
 * - `preset` 为 true 表示「只给色调，样式全由组件决定」；
 * - `slot` 标记该样例演示 `children` 自定义内容，而不是预设的 description。
 */

export interface BannerSample {
  key: string
  /** 标题 */
  title: string
  /** 说明 */
  description: string
  /** 主按钮文案 */
  action: string
  /** 次按钮文案（可选） */
  secondaryAction?: string
  /** 插画 key（缺省则只有文字） */
  image?: keyof typeof BANNER_IMAGES
  tone: BannerTone
  variant: BannerVariant
  /** 是否用 children 自定义内容（演示 slot） */
  slot?: boolean
  /** 徽标文案 */
  eyebrow?: string
  /** 实现要点，模板页里逐条列出 */
  notes: string[]
}

/** 主横幅样例：覆盖「预设 / 插画 / slot / 抽象配置」四类用法 */
export const HERO_BANNERS: BannerSample[] = [
  {
    key: 'status',
    title: '数据中心运行状态',
    description: '系统访问量同比增长 23%，所有服务运行稳定，数据监控正常。',
    action: '查看',
    tone: 'warning',
    variant: 'soft',
    eyebrow: '运维',
    notes: ['tone 决定底色与按钮色，不写任何自定义样式', '适合公告 / 状态类横幅'],
  },
  {
    key: 'welcome',
    title: '欢迎使用 Nexus Admin',
    description:
      '模块化内核 + 零依赖组件库 + 可插拔数据层：React 19 / Vite 8 / TypeScript 6 / Tailwind v4 / TanStack Router。',
    action: '开始探索',
    tone: 'cyan',
    variant: 'soft',
    notes: [
      '标题写项目名、描述写技术栈，一眼说清「这是什么」',
      '不传 image 时是纯文字横幅，最接近「欢迎区」的本意',
    ],
  },
  {
    key: 'campaign',
    title: '探索星空计划',
    description: '加入我们的天文观测活动，发现宇宙的奥秘。',
    action: '立即参与',
    tone: 'rose',
    variant: 'soft',
    image: 'donut',
    slot: true,
    notes: [
      '传 image 即出现右侧插画，窄屏自动隐藏而不是压扁',
      '插画是透明底 WebP，压在渐变上不带白边',
    ],
  },
  {
    key: 'components',
    title: '智能组件系统',
    description: '灵活配置，强大扩展，支持自定义插槽内容。',
    action: '查看文档',
    tone: 'primary',
    variant: 'soft',
    image: 'toolbox',
    notes: [
      'children 可插入任意内容（表单、标签、迷你图表）',
      '插画与文字共用同一套间距，不需要额外对齐',
    ],
  },
  {
    key: 'discount',
    title: '限时优惠活动',
    description: '精选商品 48 小时闪购，最高享受 7 折优惠，数量有限！',
    action: '立即抢购',
    tone: 'success',
    variant: 'glass',
    image: 'gift',
    notes: [
      'variant="glass" 把底色压到 6–20% 混色，适合深色页里不抢眼',
      '按钮由外部传入，可换成任意交互',
    ],
  },
  {
    key: 'renew',
    title: '服务到期提醒',
    description: '您的高级服务将在 7 天后到期，请及时续费以继续享受完整功能。',
    action: '立即续费',
    tone: 'rose',
    variant: 'solid',
    notes: ['variant="solid" 是实色底，正文与按钮自动转白', '同一 tonal 语义在深浅色下都不需要改'],
  },
]

/** 卡片横幅样例：四列卡片流里的功能入口 */
export const CARD_BANNERS: BannerSample[] = [
  {
    key: 'drone',
    title: '系统运行正常',
    description: '所有核心服务运行稳定，响应时间在正常范围内。',
    action: '查看详情',
    image: 'drone',
    tone: 'warning',
    variant: 'soft',
    notes: ['图在上、文在下，四列并排高度由 line-clamp-2 对齐'],
  },
  {
    key: 'notify',
    title: '重要消息通知',
    description: '您有 3 条待处理的重要消息，请及时查看。',
    action: '查看详情',
    image: 'sandwich',
    tone: 'warning',
    variant: 'soft',
    notes: ['actions 可放一个或两个按钮，自动换行不溢出'],
  },
  {
    key: 'report',
    title: '数据分析报告',
    description: '本周业务数据分析报告已完成，请查看关键指标。',
    action: '下载报告',
    image: 'donut',
    tone: 'rose',
    variant: 'soft',
    notes: ['插画不传时改用 icon，尺寸与插画区对齐'],
  },
  {
    key: 'update',
    title: '版本更新提醒',
    description: 'Nexus Admin v0.2.0 已发布，新增横幅组件、欢迎横幅与动效卡片。',
    action: '立即更新',
    secondaryAction: '稍后提醒',
    image: 'keyboard',
    tone: 'warning',
    variant: 'soft',
    notes: ['主次按钮并排，主按钮在右（与 Element Plus 一致）'],
  },
]

/** 预设模式表格：把「色调 × 模式」说明清楚，使用者照着选即可 */
export const PRESET_MATRIX: Array<{
  variant: BannerVariant
  label: string
  description: string
}> = [
  {
    variant: 'soft',
    label: 'soft · 柔和底',
    description: '15–17% 混色渐变，最通用的默认值，深浅色都不刺眼',
  },
  {
    variant: 'glass',
    label: 'glass · 玻璃底',
    description: '6–20% 混色 + 高光，压在深色内容区里不抢主数据流',
  },
  {
    variant: 'solid',
    label: 'solid · 实色底',
    description: '近 90% 实色，用于「必须被看见」的到期、风险类提醒',
  },
]
