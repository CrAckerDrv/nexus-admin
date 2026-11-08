import { useMemo, useState } from 'react'
import { ArrowRight, Copy, Filter, Search } from 'lucide-react'
import { Badge, Button, CodeBlock, Descriptions, Input, SectionCard, Tabs, toast } from '@nexus/ui'
import { useAppNavigate } from '@/components/app-link'
import { GuideNext, GuideNote, GuidePage, GuideSection } from '../components'

/**
 * 接口契约
 *
 * 这一页把「后端要配合实现什么」写成可检索的清单：
 * 每个接口给出方法、路径、查询参数、请求体与响应示例。
 * 前端实际发的请求参数以 src/services/queries.ts 为准，这一页与它保持一致。
 */

interface Endpoint {
  id: string
  group: string
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  path: string
  title: string
  description: string
  params?: Array<[string, string, string]>
  body?: string
  response: string
}

const ENDPOINTS: Endpoint[] = [
  {
    id: 'login',
    group: '鉴权',
    method: 'POST',
    path: '/auth/login',
    title: '登录',
    description: '返回 token 与带权限码的用户信息；前端把它写进 nexus-auth。',
    body: `{
  "email": "admin@nexus.dev",
  "password": "••••••••"
}`,
    response: `{
  "code": 0,
  "message": "ok",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "u_1001",
      "name": "陈彦之",
      "email": "admin@nexus.dev",
      "avatar": null,
      "role": "admin",
      "roleName": "管理员",
      "department": "平台技术部",
      "permissions": ["*"]
    }
  }
}`,
  },
  {
    id: 'users',
    group: '业务',
    method: 'GET',
    path: '/users',
    title: '用户列表',
    description: '分页列表；字段名不同就在 queries.ts 里映射，页面无需感知。',
    params: [
      ['page', 'number', '页码，从 1 开始'],
      ['pageSize', 'number', '每页条数'],
      ['keyword', 'string', '模糊搜索：姓名 / 邮箱 / 手机号'],
      ['status', 'string', 'active | invited | disabled | locked'],
      ['role', 'string', '角色 id'],
      ['sortBy / sortOrder', 'string', '排序字段与方向 asc | desc'],
    ],
    response: `{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "u_1001",
        "name": "陈彦之",
        "email": "admin@nexus.dev",
        "phone": "138****0001",
        "department": "平台技术部",
        "title": "前端负责人",
        "city": "杭州",
        "role": "super_admin",
        "roleName": "超级管理员",
        "status": "active",
        "mfa": true,
        "createdAt": "2026-01-08T09:12:00Z",
        "lastActiveAt": "2026-11-05T10:24:00Z",
        "tags": ["核心团队"]
      }
    ],
    "total": 268,
    "page": 1,
    "pageSize": 20
  }
}`,
  },
  {
    id: 'user-detail',
    group: '业务',
    method: 'GET',
    path: '/users/:id',
    title: '用户详情',
    description: '单个实体；404 时返回 { code: 404, message }。',
    response: `{ "code": 0, "data": { "id": "u_1001", "name": "陈彦之", "...": "同上" } }`,
  },
  {
    id: 'user-create',
    group: '业务',
    method: 'POST',
    path: '/users',
    title: '新建用户',
    description: '返回创建后的完整实体（前端会用它就地更新列表）。',
    body: `{ "name": "林知夏", "email": "lin@nexus.dev", "role": "operator" }`,
    response: `{ "code": 0, "data": { "id": "u_1301", "status": "invited", "...": "完整实体" } }`,
  },
  {
    id: 'user-update',
    group: '业务',
    method: 'PATCH',
    path: '/users/:id',
    title: '更新用户',
    description: '局部更新：只传要改的字段。',
    body: `{ "status": "disabled" }`,
    response: `{ "code": 0, "data": { "id": "u_1001", "status": "disabled", "...": "完整实体" } }`,
  },
  {
    id: 'user-delete',
    group: '业务',
    method: 'DELETE',
    path: '/users/:id',
    title: '删除用户',
    description: '幂等删除；重复删除也返回 200。',
    response: `{ "code": 0, "data": { "success": true } }`,
  },
  {
    id: 'users-stats',
    group: '业务',
    method: 'GET',
    path: '/users/stats',
    title: '用户统计',
    description: '列表页顶部的四个指标卡。',
    response: `{
  "code": 0,
  "data": { "total": 268, "active": 231, "invited": 24, "disabled": 13, "mfa": 96 }
}`,
  },
  {
    id: 'orders',
    group: '业务',
    method: 'GET',
    path: '/orders',
    title: '订单列表',
    description: '与用户列表同一套分页约定。',
    params: [
      ['page / pageSize / keyword', 'number | string', '同上'],
      ['status', 'string', 'pending | paid | shipped | completed | refunding | closed'],
      ['channel', 'string', 'web | app | api | offline'],
      ['risk', 'string', 'high | low（风控分筛选）'],
    ],
    response: `{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "NO-20261105-8421",
        "customer": "陈彦之",
        "customerEmail": "chen@nexus.dev",
        "amount": 1284.5,
        "status": "paid",
        "items": [{ "sku": "SKU-01", "name": "标准版", "quantity": 2, "price": 642.25 }],
        "payment": "wechat",
        "channel": "web",
        "riskScore": 12,
        "createdAt": "2026-11-05T02:12:00Z"
      }
    ],
    "total": 12846,
    "page": 1,
    "pageSize": 20
  }
}`,
  },
  {
    id: 'orders-stats',
    group: '业务',
    method: 'GET',
    path: '/orders/stats',
    title: '订单统计',
    description: '待处理 / 已支付 / 退款中 / 金额 / 高危笔数。',
    response: `{ "code": 0, "data": { "pending": 42, "paid": 1180, "refunding": 6, "amount": 8642300.5, "risky": 3 } }`,
  },
  {
    id: 'articles',
    group: '业务',
    method: 'GET',
    path: '/articles',
    title: '内容列表',
    description: '内容中心的列表与统计。',
    params: [
      ['page / pageSize / keyword', 'number | string', '同上'],
      ['status', 'string', 'draft | reviewing | published | archived'],
      ['category', 'string', '分类名'],
    ],
    response: `{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "a_201",
        "title": "Q4 增长复盘",
        "author": "林知夏",
        "category": "运营",
        "status": "published",
        "views": 12840,
        "comments": 42,
        "words": 3210,
        "updatedAt": "2026-11-04T08:00:00Z",
        "createdAt": "2026-10-28T08:00:00Z",
        "excerpt": "……"
      }
    ],
    "total": 1, "page": 1, "pageSize": 20
  }
}`,
  },
  {
    id: 'audit',
    group: '系统',
    method: 'GET',
    path: '/audit-logs',
    title: '审计日志',
    description: '按动作与结果筛选，配合虚拟滚动展示上万条。',
    params: [
      ['page / pageSize / keyword', 'number | string', '同上'],
      ['action', 'string', 'create | update | delete | login | export | approve'],
      ['result', 'string', 'success | failure'],
    ],
    response: `{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "log_9001",
        "actor": "陈彦之",
        "actorRole": "超级管理员",
        "action": "login",
        "target": "后台",
        "targetType": "session",
        "result": "success",
        "ip": "116.62.***.***",
        "ua": "Chrome 142 / Windows",
        "time": "2026-11-05T10:24:00Z",
        "detail": "从杭州登录"
      }
    ],
    "total": 128460, "page": 1, "pageSize": 20
  }
}`,
  },
  {
    id: 'org',
    group: '系统',
    method: 'GET',
    path: '/org/tree',
    title: '组织架构',
    description: '返回嵌套树；前端 Tree 组件直接消费。',
    response: `{ "code": 0, "data": { "id": "root", "name": "Nexus 集团", "children": [{ "id": "tech", "name": "平台技术部", "children": [] }] } }`,
  },
  {
    id: 'roles',
    group: '系统',
    method: 'GET',
    path: '/roles',
    title: '角色与权限',
    description: '角色权限矩阵页读取它。',
    response: `{
  "code": 0,
  "data": [
    {
      "id": "super_admin",
      "name": "超级管理员",
      "description": "拥有全部权限",
      "permissions": ["*"],
      "memberCount": 2
    }
  ]
}`,
  },
  {
    id: 'overview',
    group: '报表',
    method: 'GET',
    path: '/overview/metrics',
    title: '概览指标',
    description: '工作台顶部四个 KPI，含迷你趋势线数据。',
    response: `{
  "code": 0,
  "data": [
    {
      "key": "revenue",
      "label": "本月营收",
      "value": 8642300.5,
      "unit": "元",
      "delta": 12.4,
      "trend": [3, 8, 6, 12, 9, 15, 18],
      "tone": "primary"
    }
  ]
}`,
  },
  {
    id: 'trends',
    group: '报表',
    method: 'GET',
    path: '/overview/trends',
    title: '趋势数据',
    description: 'query 参数 range=7d | 30d | 90d。',
    params: [['range', 'string', '7d | 30d | 90d']],
    response: `{
  "code": 0,
  "data": [
    { "date": "2026-11-01", "revenue": 128400, "orders": 42, "users": 1284, "conversion": 3.8 }
  ]
}`,
  },
  {
    id: 'channels',
    group: '报表',
    method: 'GET',
    path: '/overview/channels',
    title: '渠道占比',
    description: '环形图数据。',
    response: `{ "code": 0, "data": [{ "name": "自然搜索", "value": 4210 }, { "name": "推荐", "value": 3180 }] }`,
  },
  {
    id: 'funnel',
    group: '报表',
    method: 'GET',
    path: '/overview/funnel',
    title: '转化漏斗',
    description: '从访问到支付的各阶段人数。',
    response: `{ "code": 0, "data": [{ "stage": "访问", "value": 128460 }, { "stage": "注册", "value": 32840 }] }`,
  },
]

const GROUPS = ['鉴权', '业务', '系统', '报表']

const METHOD_TONE = {
  GET: 'info',
  POST: 'success',
  PATCH: 'warning',
  PUT: 'warning',
  DELETE: 'danger',
} as const

export default function GuideContractPage() {
  const navigate = useAppNavigate()
  const [keyword, setKeyword] = useState('')
  const [group, setGroup] = useState('all')

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    return ENDPOINTS.filter((endpoint) => {
      if (group !== 'all' && endpoint.group !== group) return false
      if (!query) return true
      return `${endpoint.path} ${endpoint.title} ${endpoint.description} ${endpoint.group}`
        .toLowerCase()
        .includes(query)
    })
  }, [keyword, group])

  return (
    <GuidePage
      title="接口契约"
      subtitle="后端需要实现的接口清单。前端实际发出的请求参数以 src/services/queries.ts 为准，这一页与它保持同步；字段名不同就在数据层做一次映射，页面无需改动。"
      toc={[
        { id: 'common', label: '通用约定' },
        { id: 'list', label: '接口清单' },
        { id: 'error', label: '错误码' },
      ]}
      actions={
        <Badge tone="primary" variant="outline" size="sm">
          {ENDPOINTS.length} 个接口
        </Badge>
      }
    >
      <GuideSection
        id="common"
        eyebrow="Conventions"
        title="通用约定"
        description="只要遵守这四条，前端就能零改动接上。"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            {
              title: '响应风格',
              desc: '包裹式 { code, message, data } 或裸数据都支持；列表统一 { items, total, page, pageSize }。',
            },
            {
              title: '鉴权',
              desc: 'Authorization: Bearer <token>；前端还带 X-Trace-Id，建议原样写进日志。',
            },
            {
              title: '时间格式',
              desc: 'ISO 8601 字符串（2026-11-05T10:24:00Z），前端统一按本地时区渲染。',
            },
            {
              title: '分页与排序',
              desc: 'page 从 1 开始；sortBy + sortOrder(asc|desc) 可选；空值字段请显式返回 null。',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border border-line bg-surface px-3.5 py-3">
              <p className="text-[0.8125rem] font-medium text-fg">{item.title}</p>
              <p className="mt-1 text-2xs leading-5 text-fg-3">{item.desc}</p>
            </div>
          ))}
        </div>

        <CodeBlock
          filename="统一响应"
          language="json"
          maxHeight={260}
          code={`// 成功
{ "code": 0, "message": "ok", "data": { ... } }

// 失败（同时给出对应的 HTTP 状态码）
{ "code": 422, "message": "邮箱已被占用", "traceId": "trace_9f2a3b1c" }

// 列表
{
  "code": 0,
  "data": { "items": [], "total": 0, "page": 1, "pageSize": 20 }
}`}
        />
      </GuideSection>

      <GuideSection
        id="list"
        eyebrow="Endpoints"
        title="接口清单"
        description="按模块分组，可用搜索框过滤（支持路径与中文名）。"
      >
        <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 bg-bg/85 px-1 py-2 backdrop-blur">
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索接口路径或名称"
            leftIcon={<Search className="size-3.5" />}
            className="h-9 max-w-[17.5rem]"
          />
          <Tabs
            variant="pill"
            size="sm"
            value={group}
            onChange={setGroup}
            items={[
              { key: 'all', label: '全部' },
              ...GROUPS.map((item) => ({ key: item, label: item })),
            ]}
          />
          <span className="ml-auto flex items-center gap-1 text-2xs text-fg-4">
            <Filter className="size-3" />
            {filtered.length} / {ENDPOINTS.length}
          </span>
        </div>

        <div className="space-y-3">
          {filtered.length === 0 && (
            <p className="rounded-lg border border-dashed border-line py-8 text-center text-xs text-fg-3">
              没有匹配的接口，换个关键字试试
            </p>
          )}
          {filtered.map((endpoint) => (
            <SectionCard
              key={endpoint.id}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={METHOD_TONE[endpoint.method]} variant="solid" size="sm">
                    {endpoint.method}
                  </Badge>
                  <span className="font-mono text-xs text-fg">{endpoint.path}</span>
                  <span className="text-xs font-normal text-fg-3">{endpoint.title}</span>
                </span>
              }
              extra={
                <Button
                  size="xs"
                  variant="ghost"
                  leftIcon={<Copy className="size-3" />}
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(`${endpoint.method} ${endpoint.path}`)
                      .then(() => toast.success('已复制接口路径'))
                      .catch(() => toast.error('复制失败'))
                  }}
                >
                  复制
                </Button>
              }
            >
              <div className="space-y-3 p-4">
                <p className="text-xs leading-5 text-fg-3">{endpoint.description}</p>

                {endpoint.params && (
                  <div className="overflow-hidden rounded-md border border-line">
                    <table className="n-table w-full text-left">
                      <thead>
                        <tr>
                          <th className="h-8 px-3 text-2xs font-medium text-fg-3">参数</th>
                          <th className="h-8 px-3 text-2xs font-medium text-fg-3">类型</th>
                          <th className="h-8 px-3 text-2xs font-medium text-fg-3">说明</th>
                        </tr>
                      </thead>
                      <tbody>
                        {endpoint.params.map(([name, type, desc]) => (
                          <tr key={name} className="border-t border-line-subtle">
                            <td className="px-3 py-1.5 font-mono text-2xs whitespace-nowrap text-primary">
                              {name}
                            </td>
                            <td className="px-3 py-1.5 font-mono text-2xs text-fg-2">{type}</td>
                            <td className="px-3 py-1.5 text-2xs leading-5 text-fg-3">{desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {endpoint.body && (
                  <CodeBlock
                    language="json"
                    filename="请求体"
                    code={endpoint.body}
                    maxHeight={180}
                  />
                )}
                <CodeBlock
                  language="json"
                  filename="响应"
                  code={endpoint.response}
                  maxHeight={320}
                />
              </div>
            </SectionCard>
          ))}
        </div>
      </GuideSection>

      <GuideSection
        id="error"
        eyebrow="Errors"
        title="错误码"
        description="前端只对少数几个码做特殊处理，其余统一弹 toast 并展示 Trace ID。"
      >
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="n-table w-full text-left">
            <thead>
              <tr>
                <th className="h-9 px-4 text-2xs font-medium text-fg-3">HTTP</th>
                <th className="h-9 px-4 text-2xs font-medium text-fg-3">含义</th>
                <th className="h-9 px-4 text-2xs font-medium text-fg-3">前端行为</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['401', '登录失效', '清空登录态、提示、跳登录页（不要自己再处理）'],
                ['403', '无权限', '路由守卫渲染说明页，展示所需权限码'],
                ['404', '资源不存在', '弹 toast；详情页可引导返回列表'],
                ['422', '参数校验失败', '把 detail 映射到表单字段'],
                ['429', '限流', '指数退避重试（React Query 已内置 retry）'],
                ['5xx', '服务异常', '弹 toast 并展示 Trace ID，页面保留重试入口'],
              ].map(([code, meaning, behavior]) => (
                <tr key={code} className="border-t border-line-subtle">
                  <td className="px-4 py-2">
                    <Badge
                      tone={
                        code === '401' || code === '403'
                          ? 'warning'
                          : code === '5xx'
                            ? 'danger'
                            : 'info'
                      }
                      variant="outline"
                      size="sm"
                    >
                      {code}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-xs whitespace-nowrap text-fg">{meaning}</td>
                  <td className="px-4 py-2 text-xs leading-5 text-fg-3">{behavior}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <GuideNote tone="tip" title="字段映射放哪一层">
          后端字段与前端类型不一致时（如 <code className="font-mono">roleCode</code> →
          <code className="font-mono">role</code>），在{' '}
          <code className="font-mono">services/queries.ts</code> 里做一次映射即可；
          <b>不要</b>把映射写进页面，否则页面就绑死在某一种后端字段风格上。
        </GuideNote>

        <SectionCard title="一致性检查" bodyClassName="p-4">
          <Descriptions
            size="sm"
            columns={2}
            items={[
              {
                label: '接口数量',
                value: `${ENDPOINTS.length} 个（鉴权 1 · 业务 7 · 系统 3 · 报表 4）`,
              },
              { label: '前端入口', value: 'src/services/queries.ts' },
              { label: '契约校验', value: 'src/services/schemas.ts（仅开发期）' },
              { label: 'Mock 实现', value: 'src/mock/handlers.ts（同结构）' },
            ]}
          />
        </SectionCard>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            rightIcon={<ArrowRight className="size-3.5" />}
            onClick={() => navigate('/guide/backend')}
          >
            回到接入后端
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/components/overview')}>
            浏览组件
          </Button>
        </div>
      </GuideSection>

      <GuideNext to="/guide/module" label="新增模块" desc="按这套契约加自己的业务模块" />
    </GuidePage>
  )
}
