import type {
  ActivityItem,
  Article,
  AuditLog,
  ChannelSlice,
  FunnelStage,
  Order,
  OrderStatus,
  OrgNode,
  OverviewMetric,
  Role,
  TodoItem,
  TrendPoint,
  User,
  UserRole,
  UserStatus,
} from '@/types/domain'
import {
  CITIES,
  DEPARTMENTS,
  GIVEN_NAMES,
  SURNAMES,
  chance,
  daysAgo,
  int,
  minutesAgo,
  pick,
  rand,
} from './seed'

/* ------------------------------------------------------------------ *
 * 数据生成（仅执行一次，模块级单例）
 * ------------------------------------------------------------------ */

const ROLE_MAP: Record<UserRole, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  operator: '运营专员',
  auditor: '审计员',
  viewer: '只读访客',
}

const USER_TAGS = ['核心客户', '内测用户', 'VIP', '风险关注', '新注册', '合作伙伴', '已实名']

function makeUser(index: number): User {
  const name = `${pick(SURNAMES)}${pick(GIVEN_NAMES)}`
  const role: UserRole =
    index === 0
      ? 'super_admin'
      : index < 3
        ? 'admin'
        : pick(['operator', 'auditor', 'viewer', 'operator'])
  const status: UserStatus =
    index < 3 ? 'active' : pick(['active', 'active', 'active', 'invited', 'disabled', 'locked'])
  return {
    id: `u_${1000 + index}`,
    name,
    email: `${name.toLowerCase().replace(/[^a-z]/g, '') || 'user'}${index}@nexus.dev`,
    phone: `1${int(3, 9)}${String(int(100000000, 999999999))}`,
    department: pick(DEPARTMENTS),
    title: pick([
      '产品经理',
      '前端工程师',
      '后端工程师',
      '数据分析师',
      '运营专家',
      '解决方案架构师',
      '测试工程师',
    ]),
    city: pick(CITIES),
    role,
    roleName: ROLE_MAP[role],
    status,
    mfa: chance(0.45),
    createdAt: daysAgo(int(1, 400)),
    lastActiveAt: minutesAgo(int(2, 60 * 24 * 14)),
    tags: Array.from(new Set(Array.from({ length: int(0, 3) }, () => pick(USER_TAGS)))),
  }
}

export const USERS: User[] = Array.from({ length: 268 }, (_, index) => makeUser(index))

const ORDER_STATUS: OrderStatus[] = [
  'pending',
  'paid',
  'shipped',
  'completed',
  'refunding',
  'closed',
]

function makeOrder(index: number): Order {
  const quantity = int(1, 4)
  const price = int(199, 12999) / 1
  const items = Array.from({ length: quantity }, (_, itemIndex) => ({
    sku: `SKU-${int(10000, 99999)}`,
    name: pick([
      '企业版年度订阅',
      '专业版季度订阅',
      '增值实施服务',
      '数据分析插件',
      '高级技术支持包',
      'API 调用包',
    ]),
    quantity: itemIndex === 0 ? int(1, 3) : 1,
    price: Math.round(price / quantity),
  }))
  return {
    id: `NO${String(20261104000 + index)}`,
    customer: `${pick(SURNAMES)}${pick(GIVEN_NAMES)}`,
    customerEmail: `buyer${index}@example.com`,
    amount: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    status: index < 2 ? 'pending' : pick(ORDER_STATUS),
    items,
    payment: pick(['wechat', 'alipay', 'bank', 'balance']),
    channel: pick(['web', 'app', 'api', 'offline']),
    riskScore: int(2, 96),
    createdAt: minutesAgo(int(10, 60 * 24 * 60)),
    remark: chance(0.25)
      ? pick(['客户要求分两次开票', '需要加急处理', '走线下合同流程', '已确认收货地址'])
      : undefined,
  }
}

export const ORDERS: Order[] = Array.from({ length: 186 }, (_, index) => makeOrder(index))

const ARTICLE_CATEGORIES = ['产品动态', '最佳实践', '客户案例', '技术解析', '行业观察']

export const ARTICLES: Article[] = Array.from({ length: 92 }, (_, index) => ({
  id: `a_${2000 + index}`,
  title:
    pick([
      '如何用 Nexus Admin 在一天内搭出管理后台',
      '模块化设计的 7 个实践要点',
      '从 1 万行表格到 60 行渲染：虚拟滚动实战',
      '设计令牌驱动的暗色模式实现',
      '权限系统设计：RBAC 与 ABAC 的取舍',
      '基于 TanStack Query 的数据流分层',
      '表单性能优化：受控 vs 非受控',
      '可访问性（a11y）在后台系统中的落地',
    ]) + (index > 7 ? ` · 第 ${index + 1} 篇` : ''),
  author: `${pick(SURNAMES)}${pick(GIVEN_NAMES)}`,
  category: pick(ARTICLE_CATEGORIES),
  status:
    index < 4 ? 'reviewing' : pick(['draft', 'reviewing', 'published', 'published', 'archived']),
  views: int(120, 48000),
  comments: int(0, 320),
  words: int(800, 8600),
  updatedAt: minutesAgo(int(5, 60 * 24 * 30)),
  createdAt: daysAgo(int(2, 200)),
  excerpt: '这是一段用于演示的文章摘要，包含关键词与业务背景说明，可在列表中展示两行文本。',
}))

export const ROLES: Role[] = [
  {
    id: 'r_1',
    key: 'super_admin',
    name: '超级管理员',
    description: '拥有全部系统权限，可管理权限策略与系统设置',
    memberCount: 3,
    permissions: ['*'],
    builtin: true,
  },
  {
    id: 'r_2',
    key: 'admin',
    name: '管理员',
    description: '可管理业务数据、导出报表，不可修改系统级配置',
    memberCount: 12,
    permissions: ['user:*', 'order:*', 'content:*', 'audit:read', 'org:read'],
    builtin: true,
  },
  {
    id: 'r_3',
    key: 'operator',
    name: '运营专员',
    description: '负责日常用户与内容运营，无删除与导出权限',
    memberCount: 46,
    permissions: ['user:read', 'user:write', 'order:read', 'content:read', 'content:write'],
    builtin: false,
  },
  {
    id: 'r_4',
    key: 'auditor',
    name: '审计员',
    description: '只读访问审计日志与操作记录，可导出合规报告',
    memberCount: 5,
    permissions: ['audit:read', 'audit:export', 'user:read', 'order:read'],
    builtin: false,
  },
  {
    id: 'r_5',
    key: 'viewer',
    name: '只读访客',
    description: '仅可浏览被授权的数据，不可执行任何写操作',
    memberCount: 88,
    permissions: ['user:read', 'order:read', 'content:read', 'audit:read'],
    builtin: true,
  },
]

export const ORG_TREE: OrgNode = {
  id: 'org_root',
  name: 'Nexus 科技有限公司',
  type: 'company',
  leader: '陈彦之',
  memberCount: 486,
  children: [
    {
      id: 'org_tech',
      name: '平台技术部',
      type: 'department',
      leader: '林知夏',
      memberCount: 128,
      children: [
        { id: 'org_fe', name: '前端工程组', type: 'team', leader: '周予安', memberCount: 18 },
        { id: 'org_be', name: '服务端组', type: 'team', leader: '吴星野', memberCount: 32 },
        { id: 'org_sre', name: 'SRE 组', type: 'team', leader: '黄清越', memberCount: 12 },
      ],
    },
    {
      id: 'org_growth',
      name: '用户增长组',
      type: 'department',
      leader: '赵书鸣',
      memberCount: 46,
      children: [
        { id: 'org_content', name: '内容运营', type: 'team', leader: '孙若溪', memberCount: 14 },
        { id: 'org_campaign', name: '活动运营', type: 'team', leader: '李锦程', memberCount: 9 },
      ],
    },
    {
      id: 'org_data',
      name: '数据智能组',
      type: 'department',
      leader: '郑念真',
      memberCount: 38,
      children: [
        { id: 'org_bi', name: 'BI 分析', type: 'team', leader: '王怀瑾', memberCount: 11 },
        { id: 'org_algo', name: '算法组', type: 'team', leader: '冯斯年', memberCount: 16 },
      ],
    },
    { id: 'org_cs', name: '客户成功部', type: 'department', leader: '韩亦然', memberCount: 72 },
    { id: 'org_fin', name: '财务共享中心', type: 'department', leader: '杨映川', memberCount: 24 },
    { id: 'org_sec', name: '安全合规部', type: 'department', leader: '徐嘉树', memberCount: 19 },
  ],
}

const AUDIT_ACTIONS = ['create', 'update', 'delete', 'login', 'export', 'approve'] as const
const AUDIT_TARGETS = [
  ['用户', 'user'],
  ['订单', 'order'],
  ['内容', 'article'],
  ['角色', 'role'],
  ['系统设置', 'setting'],
] as const

export const AUDIT_LOGS: AuditLog[] = Array.from({ length: 420 }, (_, index) => {
  const actor = USERS[int(0, 40)] ?? USERS[0]!
  const [targetName, targetType] = pick(AUDIT_TARGETS)
  const action = pick(AUDIT_ACTIONS)
  return {
    id: `log_${90000 + index}`,
    actor: actor.name,
    actorRole: actor.roleName,
    action,
    target: `${targetName} · ${targetType}_${int(1000, 9999)}`,
    targetType,
    result: chance(0.93) ? 'success' : 'failure',
    ip: `10.${int(0, 255)}.${int(0, 255)}.${int(1, 254)}`,
    ua: pick([
      'Chrome 141 / macOS 15',
      'Edge 140 / Windows 11',
      'Safari 19 / iOS 18',
      'Chrome 140 / Windows 10',
    ]),
    time: minutesAgo(int(1, 60 * 24 * 30)),
    detail: pick([
      '修改了角色权限范围',
      '导出了 1,204 条用户数据',
      '审核通过内容发布申请',
      '更新了用户联系方式',
      '登录失败：验证码错误',
      '删除了测试用订单',
    ]),
  }
})

export const OVERVIEW_METRICS: OverviewMetric[] = [
  {
    key: 'revenue',
    label: '本月交易额',
    value: 8_642_300,
    unit: '元',
    delta: 12.4,
    tone: 'primary',
    trend: [42, 48, 45, 61, 58, 72, 69, 84, 91, 88, 96, 108],
  },
  {
    key: 'users',
    label: '活跃用户',
    value: 128_460,
    delta: 8.2,
    tone: 'success',
    trend: [88, 92, 90, 96, 104, 101, 110, 118, 115, 124, 128, 132],
  },
  {
    key: 'orders',
    label: '新增订单',
    value: 12_846,
    delta: -3.1,
    tone: 'warning',
    trend: [96, 104, 92, 88, 91, 84, 86, 79, 82, 76, 74, 71],
  },
  {
    key: 'conversion',
    label: '转化率',
    value: 4.68,
    unit: '%',
    delta: 0.8,
    tone: 'danger',
    trend: [3.8, 3.9, 4.1, 4.0, 4.2, 4.3, 4.25, 4.4, 4.5, 4.55, 4.62, 4.68],
  },
]

/** 生成最近 n 天的连续日期标签 */
function lastDays(n: number): string[] {
  return Array.from({ length: n }, (_, index) => {
    const date = new Date(Date.now() - (n - 1 - index) * 86_400_000)
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  })
}

export const TRENDS: Record<'7d' | '30d' | '90d', TrendPoint[]> = {
  '7d': lastDays(7).map((date) => ({
    date,
    revenue: int(180000, 420000),
    orders: int(320, 780),
    users: int(1200, 3600),
    conversion: Number((3.6 + rand() * 1.8).toFixed(2)),
  })),
  '30d': lastDays(30).map((date) => ({
    date,
    revenue: int(150000, 460000),
    orders: int(280, 860),
    users: int(1000, 3800),
    conversion: Number((3.4 + rand() * 2.1).toFixed(2)),
  })),
  '90d': lastDays(90).map((date) => ({
    date,
    revenue: int(120000, 480000),
    orders: int(240, 920),
    users: int(900, 4100),
    conversion: Number((3.2 + rand() * 2.4).toFixed(2)),
  })),
}

export const CHANNELS: ChannelSlice[] = [
  { name: '官网直访', value: 38 },
  { name: '自然搜索', value: 24 },
  { name: '付费投放', value: 17 },
  { name: '渠道合作', value: 12 },
  { name: '客户推荐', value: 9 },
]

export const FUNNEL: FunnelStage[] = [
  { stage: '访问首页', value: 100 },
  { stage: '浏览产品', value: 62 },
  { stage: '注册账号', value: 34 },
  { stage: '试用激活', value: 21 },
  { stage: '付费转化', value: 8.6 },
]

export const TODOS: TodoItem[] = [
  {
    id: 't1',
    title: '审核 3 笔高风险订单',
    type: 'risk',
    priority: 'high',
    dueAt: minutesAgo(-90),
    owner: '陈彦之',
    done: false,
  },
  {
    id: 't2',
    title: '审批「专业版定价调整」变更单',
    type: 'approval',
    priority: 'medium',
    dueAt: minutesAgo(-360),
    owner: '林知夏',
    done: false,
  },
  {
    id: 't3',
    title: '跟进客户成功工单 #8821',
    type: 'ticket',
    priority: 'high',
    dueAt: minutesAgo(-720),
    owner: '周予安',
    done: false,
  },
  {
    id: 't4',
    title: '生成 Q4 用户留存分析报告',
    type: 'report',
    priority: 'low',
    dueAt: minutesAgo(-2880),
    owner: '吴星野',
    done: false,
  },
  {
    id: 't5',
    title: '确认本周内容发布排期',
    type: 'approval',
    priority: 'low',
    dueAt: minutesAgo(180),
    owner: '赵书鸣',
    done: true,
  },
]

export const ACTIVITIES: ActivityItem[] = [
  {
    id: 'ac1',
    actor: '林知夏',
    action: '更新了',
    target: '用户「陈星野」的角色权限',
    time: minutesAgo(4),
    tone: 'primary',
  },
  {
    id: 'ac2',
    actor: '周予安',
    action: '审核通过',
    target: '内容《模块化设计的 7 个实践要点》',
    time: minutesAgo(26),
    tone: 'success',
  },
  {
    id: 'ac3',
    actor: '吴星野',
    action: '导出',
    target: '10 月用户增长明细（1,204 行）',
    time: minutesAgo(58),
    tone: 'default',
  },
  {
    id: 'ac4',
    actor: '黄清越',
    action: '标记',
    target: '订单 NO20261104012 为异常交易',
    time: minutesAgo(120),
    tone: 'warning',
  },
  {
    id: 'ac5',
    actor: '赵书鸣',
    action: '删除',
    target: '过期的优惠券模板 12 个',
    time: minutesAgo(240),
    tone: 'danger',
  },
]
