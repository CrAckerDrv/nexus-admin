import type { DictKey } from '../index'

/**
 * 路径 → 词条 key 的索引
 *
 * 模块清单里已经声明了可读的中文 title；这里补一层「路径到词条」的映射，
 * 让 i18n 不必逐个修改 8 个 module.ts，同时新增模块仍可用 titleKey 覆盖
 * （titleKey 优先级高于本索引）。
 *
 * 约定：key 必须存在于 zh.ts / en.ts，否则回退到模块里写的中文 title。
 */
export const NAV_KEY_BY_PATH: Record<string, DictKey> = {
  // 工作台
  '/dashboard/overview': 'nav.overview',
  '/dashboard/analytics': 'nav.analytics',
  '/dashboard/performance': 'nav.performance',
  // AI 助手
  '/assistant/workspace': 'nav.assistantWorkspace',
  // 业务
  '/business/users': 'nav.users',
  '/business/orders': 'nav.orders',
  '/business/content': 'nav.content',
  // 组织
  '/organization/structure': 'nav.structure',
  '/organization/roles': 'nav.roles',
  // 模板中心
  '/templates/overview': 'nav.templatesOverview',
  '/templates/banner': 'nav.templateBanner',
  '/templates/screens': 'nav.templateScreenGallery',
  '/templates/command-center': 'nav.templateCommandCenter',
  '/templates/screen-ops': 'nav.templateScreenOps',
  '/templates/screen-finance': 'nav.templateScreenFinance',
  '/templates/screen-logistics': 'nav.templateScreenLogistics',
  '/templates/screen-city': 'nav.templateScreenCity',
  '/templates/screen-manufacturing': 'nav.templateScreenManufacturing',
  '/templates/screen-campaign': 'nav.templateScreenCampaign',
  '/templates/screen-compute': 'nav.templateScreenCompute',
  '/templates/gantt': 'nav.templateGantt',
  '/templates/kanban': 'nav.templateKanban',
  '/templates/workflow': 'nav.templateWorkflow',
  '/templates/infinite-canvas': 'nav.templateInfiniteCanvas',
  '/templates/ai-chat': 'nav.templateAiChat',
  '/templates/files': 'nav.templateFiles',
  '/templates/media-workbench': 'nav.templateMediaWorkbench',
  // 组件
  '/components/overview': 'nav.componentsOverview',
  '/components/tables': 'nav.tables',
  '/components/charts': 'nav.charts',
  '/components/forms': 'nav.forms',
  '/components/feedback': 'nav.feedback',
  '/components/premium': 'nav.premium',
  '/components/templates': 'nav.templates',
  // 开发指南
  '/guide/overview': 'nav.guideOverview',
  '/guide/backend': 'nav.guideBackend',
  '/guide/module': 'nav.guideModule',
  '/guide/contract': 'nav.guideContract',
  '/guide/ai-sdk': 'nav.guideAiSdk',
  '/guide/ui-kit': 'nav.guideUiKit',
  '/guide/workflow': 'nav.guideWorkflow',
  // 系统
  '/system/audit': 'nav.audit',
  '/system/settings': 'nav.settings',
  // 账号
  '/account/profile': 'nav.profile',
  // 异常
  '/errors/403': 'nav.forbidden',
  '/errors/500': 'nav.serverError',
}

/** 模块 id → 词条 key */
export const MODULE_KEY_BY_ID: Record<string, DictKey> = {
  dashboard: 'nav.dashboard',
  assistant: 'nav.assistant',
  business: 'nav.business',
  organization: 'nav.organization',
  templates: 'nav.templatesGroup',
  components: 'nav.components',
  guide: 'nav.developerGuide',
  system: 'nav.system',
  account: 'nav.account',
  errors: 'nav.errors',
}

/** 角色 id → 词条（当前登录用户的角色名显示用，人名作为专有名词保留原文） */
export const ROLE_KEY_BY_ID: Record<string, DictKey> = {
  super_admin: 'role.super_admin',
  admin: 'role.admin',
  operator: 'role.operator',
  auditor: 'role.auditor',
  viewer: 'role.viewer',
}

/** 分组导航（无 path）的 key → 词条 */
export const GROUP_KEY_BY_KEY: Record<string, DictKey> = {
  'group-screens': 'nav.groupScreens',
  'group-visual': 'nav.groupVisual',
  'group-workflow': 'nav.groupWorkflow',
  'group-content': 'nav.groupContent',
  'group-sdk': 'nav.guideGroupSdk',
}
