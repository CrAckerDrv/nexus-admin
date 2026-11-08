import { ArrowRight, Boxes, FolderTree, Route, ShieldCheck } from 'lucide-react'
import { Badge, Button, CodeBlock, CodeBlock as Code, Descriptions, SectionCard } from '@nexus/ui'
import { useAppNavigate } from '@/components/app-link'
import { GuideNext, GuideNote, GuidePage, GuideSection, GuideStep, Level } from '../components'

/**
 * 新增模块：这个项目最重要的扩展约定
 *
 * 核心信息只有一句：**新增业务模块 = 写一个 module.ts + 在注册表加一行**，
 * 路由、侧边栏、页签、面包屑、命令面板、权限守卫全部自动生成。
 */

const TOC = [
  { id: 'how', label: '一条约定' },
  { id: 'declare', label: '1. 声明模块' },
  { id: 'register', label: '2. 注册' },
  { id: 'page', label: '3. 写页面' },
  { id: 'data', label: '4. 接数据' },
  { id: 'permission', label: '5. 权限' },
  { id: 'fields', label: '字段速查' },
]

const MODULE_SNIPPET = `// src/modules/business/module.ts
import { ShoppingCart, Users } from 'lucide-react'
import { defineModule } from '@/core/module'

export const businessModule = defineModule({
  id: 'business',              // 唯一标识，也是权限与折叠状态的 key
  title: '业务管理',            // 侧栏分组标题
  description: '用户、订单与内容运营的日常管理',
  icon: Users,                 // 分组图标
  order: 20,                   // 越小越靠上
  section: 'main',             // main = 业务区，demo = 演示区
  nav: [
    {
      key: 'users',
      title: '用户管理',
      path: '/business/users',
      icon: Users,
      permission: 'user:read', // 没有该权限的账号看不到这个菜单
    },
    {
      key: 'orders',
      title: '订单管理',
      path: '/business/orders',
      icon: ShoppingCart,
      badge: 12,               // 徽标：数字或文案
      permission: 'order:read',
    },
  ],
  routes: [
    {
      path: '/business/users',
      permission: 'user:read',       // 直达 URL 时由守卫校验同一个权限码
      component: () => import('./pages/users-page'), // 懒加载，独立 chunk
    },
    {
      path: '/business/orders',
      permission: 'order:read',
      component: () => import('./pages/orders-page'),
    },
  ],
})`

const REGISTER_SNIPPET = `// src/modules/registry.ts —— 唯一需要手改的"总开关"
import { businessModule } from './business/module'

export const modules: ModuleDefinition[] = [
  dashboardModule,
  businessModule,     // ← 加这一行
  organizationModule,
  // ...
].sort((a, b) => a.order - b.order)

// 注册后自动获得：
// ✅ 侧边栏分组与菜单（按 section / order 排序）
// ✅ 路由挂载 + 懒加载 chunk + 悬停预取
// ✅ 页签、面包屑、⌘K 命令面板条目
// ✅ 按 permission 过滤菜单 + 拦截直达 URL
// ✅ 折叠状态持久化（localStorage: nexus-ui-prefs）`

const PAGE_SNIPPET = `// src/modules/business/pages/users-page.tsx
import { Button, DataTable, PageContainer, PageHeader } from '@nexus/ui'
import { useUsers } from '@/services/queries'

export default function UsersPage() {
  const { data, isLoading } = useUsers({ page: 1, pageSize: 20 })

  return (
    <PageContainer size="lg">
      <PageHeader
        title="用户管理"
        description="管理组织成员、角色分配与账号安全状态"
        actions={<Button variant="primary">新建用户</Button>}
      />
      <DataTable
        rows={data?.items ?? []}
        loading={isLoading}
        getRowId={(row) => row.id}
        columns={[
          { key: 'name', header: '用户', cell: (row) => row.name },
          { key: 'role', header: '角色', cell: (row) => row.role },
        ]}
      />
    </PageContainer>
  )
}

// 注意：必须默认导出 —— 路由用 lazyRouteComponent 读取 default 字段。`

const DATA_SNIPPET = `// 1) 类型：src/types/domain.ts
export interface User {
  id: string
  name: string
  email: string
  role: RoleKey
  status: 'active' | 'invited' | 'disabled' | 'locked'
}

// 2) 数据层：src/services/queries.ts（页面只调用它）
export function useUsers(params: UserListParams = {}) {
  return useQuery({
    queryKey: queryKeys.users(params),
    queryFn: ({ signal }) =>
      api.get<PageResult<User>>('/users', { params, signal }),
    placeholderData: (prev) => prev,
  })
}

// 3) 页面里只用 hook：不写 fetch、不拼 URL、不管 loading 与重试
const { data, isLoading, error } = useUsers({ page, keyword })`

const PERMISSION_SNIPPET = `// 同一个权限码，三处同时生效
permission: 'user:read'

// ① 菜单：没有权限 → 侧栏不渲染（filterNav）
// ② 路由：直接输入 URL → 守卫跳 403，并说明缺哪个码（route-guard）
// ③ 按钮：写操作自己判一次
const { hasPermission } = useAuthStore()
{hasPermission('user:write') && <Button variant="primary">新建用户</Button>}`

const NAV_CHILDREN_SNIPPET = `// 二级菜单：父节点不写 path，子节点照常懒加载
nav: [
  {
    key: 'group-screens',
    title: '数据大屏',
    icon: MonitorPlay,
    children: [
      { key: 'gallery', title: '大屏模板', path: '/templates/screens' },
      { key: 'ops', title: '运维监控墙', path: '/templates/screen-ops', openInNewTab: true },
    ],
  },
]

// 独立页面（不套侧栏 / 顶栏 / 页签）—— 投屏大屏用
routes: [{ path: '/templates/screen-ops', standalone: true, component: () => import('./pages/ops') }]`

const NO_NAV_SNIPPET = `// 个人资料这类页面从顶栏头像菜单进入，
// 侧栏不需要重复入口 —— nav 直接给空数组即可。
export const accountModule = defineModule({
  id: 'account',
  title: '账号',
  order: 90,
  nav: [],
  routes: [
    {
      path: '/account/profile',
      title: '个人资料',
      component: () => import('./pages/profile-page'),
    },
  ],
})`

const DIRECTORY_SNIPPET = `src/modules/warehouse/
├── module.ts          # 声明导航、路由、权限
├── pages/
│   ├── stock-page.tsx
│   └── inbound-page.tsx
└── components/        # 可选：只在本模块内使用
    └── stock-filter.tsx`

const FIELD_ROWS: Array<[string, string, string]> = [
  ['id', 'string', '唯一标识；也是权限与折叠状态的命名空间'],
  ['title', 'string', '侧栏分组标题（可用 titleKey 走 i18n）'],
  ['order', 'number', '排序，越小越靠上'],
  ['section', "'main' | 'demo'", '业务区 / 演示区，影响侧栏分区'],
  ['grouped', 'boolean', 'false 时导航平铺，不渲染可折叠分组'],
  ['permission', 'string?', '模块级权限，缺省表示登录即可见'],
  ['nav', 'NavNode[]', '侧栏导航；可为空（只贡献路由时）'],
  ['routes', 'ModuleRoute[]', '路由表；component 必须是懒加载函数'],
  ['enabled', 'boolean?', '功能开关，可用于灰度'],
]

const ROUTE_ROWS: Array<[string, string, string]> = [
  ['path', 'string', '绝对路径，如 /business/users'],
  ['component', '() => Promise<{ default: ComponentType }>', '懒加载；页面必须默认导出'],
  ['permission', 'string?', '缺省继承模块权限'],
  ['title / titleKey', 'string?', '页签与文档标题'],
  ['standalone', 'boolean?', '不套应用外壳（投屏大屏）'],
]

const NAV_ROWS: Array<[string, string, string]> = [
  ['key', 'string', '导航项唯一标识（同模块内）'],
  ['title / titleKey', 'string', '菜单文案'],
  ['path', 'string?', '跳转路径；有 children 时可省略'],
  ['icon', 'LucideIcon?', '图标（lucide-react）'],
  ['badge', 'number | string?', '右侧徽标'],
  ['permission', 'string?', '访问所需权限码'],
  ['children', 'NavNode[]?', '二级菜单'],
  ['openInNewTab', 'boolean?', '新标签页打开（沉浸页面）'],
  ['external', 'string?', '外链地址'],
]

export default function GuideModulePage() {
  const navigate = useAppNavigate()

  return (
    <GuidePage
      title="新增模块"
      subtitle="这个模板所有扩展都收敛在一条约定里：写一个 module.ts，再去注册表加一行。路由、菜单、页签、面包屑、命令面板与权限守卫全部自动生成——不要手改路由表或侧栏。"
      toc={TOC}
      actions={
        <>
          <Badge tone="primary" variant="outline" size="sm">
            两个文件
          </Badge>
          <Button
            size="sm"
            variant="secondary"
            rightIcon={<ArrowRight className="size-3.5" />}
            onClick={() => navigate('/components/overview')}
          >
            看看有哪些组件
          </Button>
        </>
      }
    >
      <GuideSection
        id="how"
        eyebrow="Convention"
        title="一条约定，五处自动生效"
        description="模块清单是唯一的真相来源：它同时驱动菜单、路由、页签、命令面板与权限。"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { icon: <FolderTree className="size-4" />, label: '侧边栏', desc: '分组 + 二级菜单' },
            { icon: <Route className="size-4" />, label: '路由', desc: '懒加载 + 预取' },
            { icon: <Boxes className="size-4" />, label: '页签与面包屑', desc: '自动同步' },
            {
              icon: <ShieldCheck className="size-4" />,
              label: '权限守卫',
              desc: '菜单 + 直达 URL',
            },
            { icon: <ArrowRight className="size-4" />, label: '命令面板', desc: '⌘K 可搜到' },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-line bg-surface px-3 py-2.5">
              <span className="text-primary">{item.icon}</span>
              <p className="mt-1.5 text-xs font-medium text-fg">{item.label}</p>
              <p className="text-2xs text-fg-4">{item.desc}</p>
            </div>
          ))}
        </div>

        <GuideNote tone="danger" title="不要改的两个文件">
          <code className="font-mono">src/router.tsx</code> 与{' '}
          <code className="font-mono">src/layout/app-shell.tsx</code>{' '}
          都是「消费模块清单」的通用代码。往里面加具体业务页，等于放弃这套约定：下一个模块要改两处、下下个模块要改三处。
        </GuideNote>
      </GuideSection>

      <GuideSection
        id="declare"
        eyebrow="Step 1"
        title={
          <span className="flex flex-wrap items-center gap-2">
            声明模块 <Level value="必读" />
          </span>
        }
        description="在 src/modules/<name>/module.ts 里调用 defineModule；目录里再放一个 pages/ 存页面。"
        extra={
          <Badge tone="neutral" variant="outline" size="sm">
            module.ts
          </Badge>
        }
      >
        <GuideStep
          index={1}
          title="新建目录"
          description="约定：一个模块一个目录，页面放 pages/，私有组件放 components/"
        >
          <CodeBlock language="bash" filename="目录结构" maxHeight={200} code={DIRECTORY_SNIPPET} />
        </GuideStep>

        <GuideStep
          index={2}
          title="写 module.ts"
          description="照抄一个现有模块，改成你的业务名与路径"
        >
          <CodeBlock
            filename="src/modules/business/module.ts"
            code={MODULE_SNIPPET}
            maxHeight={520}
          />
        </GuideStep>

        <div className="space-y-3">
          <SectionCard
            title="二级菜单与大屏"
            description="children 与 standalone 的写法"
            bodyClassName="p-4"
          >
            <CodeBlock filename="module.ts（节选）" code={NAV_CHILDREN_SNIPPET} maxHeight={260} />
          </SectionCard>
          <SectionCard
            title="也可以不写菜单"
            description="只贡献路由、从别处进入的页面"
            bodyClassName="p-4"
          >
            <CodeBlock
              filename="src/modules/account/module.ts"
              maxHeight={260}
              code={NO_NAV_SNIPPET}
            />
          </SectionCard>
        </div>
      </GuideSection>

      <GuideSection
        id="register"
        eyebrow="Step 2"
        title={
          <span className="flex flex-wrap items-center gap-2">
            注册 <Level value="必读" />
          </span>
        }
        description="在 registry.ts 的数组里加一行，模块立刻出现在侧边栏——不需要改路由表，也不需要重启任何配置文件。"
      >
        <CodeBlock filename="src/modules/registry.ts" code={REGISTER_SNIPPET} maxHeight={320} />
      </GuideSection>

      <GuideSection
        id="page"
        eyebrow="Step 3"
        title="写页面"
        description="页面用 PageContainer + PageHeader 起头，正文用 SectionCard 分段；组件全部从 @nexus/ui 取。"
      >
        <Code
          filename="src/modules/business/pages/users-page.tsx"
          code={PAGE_SNIPPET}
          maxHeight={420}
        />
        <GuideNote tone="warn" title="页面必须默认导出">
          <code className="font-mono">lazyRouteComponent</code> 读取的是模块的{' '}
          <code className="font-mono">default</code>{' '}
          字段。写成具名导出会在运行时白屏报错，类型检查却不一定拦得住。
        </GuideNote>
      </GuideSection>

      <GuideSection
        id="data"
        eyebrow="Step 4"
        title={
          <span className="flex flex-wrap items-center gap-2">
            接数据 <Level value="必读" />
          </span>
        }
        description="三步固定：类型 → hook → 页面。页面里永远不出现 fetch 与 URL 拼接。"
      >
        <CodeBlock filename="从类型到页面" code={DATA_SNIPPET} maxHeight={420} />
        <GuideNote tone="tip" title="为什么一定要经过 services/queries.ts">
          它是唯一知道「后端长什么样」的地方。接真实后端、换字段名、加缓存策略，都只改这一层；页面从始至终不动（这也是模板敢说「接后端页面零改动」的底气）。
        </GuideNote>
      </GuideSection>

      <GuideSection
        id="permission"
        eyebrow="Step 5"
        title="权限"
        description="一个权限码字符串，同时驱动菜单过滤、路由守卫与按钮禁用。"
      >
        <CodeBlock filename="同一权限码，三处生效" code={PERMISSION_SNIPPET} maxHeight={240} />
      </GuideSection>

      <GuideSection
        id="fields"
        eyebrow="Reference"
        title="字段速查"
        description="完整的类型定义在 src/core/module.ts，这里只列最常改的字段。"
      >
        <div className="space-y-3">
          {[
            { title: 'ModuleDefinition', rows: FIELD_ROWS },
            { title: 'ModuleRoute', rows: ROUTE_ROWS },
            { title: 'NavNode', rows: NAV_ROWS },
          ].map((group) => (
            <SectionCard
              key={group.title}
              title={<span className="font-mono">{group.title}</span>}
              bodyClassName="px-0"
            >
              <table className="n-table w-full text-left">
                <thead>
                  <tr>
                    <th className="h-9 px-4 text-2xs font-medium text-fg-3">字段</th>
                    <th className="h-9 px-4 text-2xs font-medium text-fg-3">类型</th>
                    <th className="h-9 px-4 text-2xs font-medium text-fg-3">说明</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map(([field, type, desc]) => (
                    <tr key={field} className="border-t border-line-subtle align-top">
                      <td className="px-4 py-2 font-mono text-2xs whitespace-nowrap text-primary">
                        {field}
                      </td>
                      <td className="px-4 py-2 font-mono text-2xs leading-5 text-fg-2">{type}</td>
                      <td className="px-4 py-2 text-xs leading-5 text-fg-3">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
          ))}
        </div>

        <SectionCard title="新增模块的完整检查项" bodyClassName="p-4">
          <Descriptions
            size="sm"
            columns={2}
            items={[
              { label: '目录', value: 'src/modules/<name>/module.ts + pages/' },
              { label: '注册', value: 'src/modules/registry.ts 加一行' },
              { label: '页面', value: '默认导出 + PageContainer 包裹' },
              { label: '数据', value: '只用 services/queries.ts 的 hook' },
              { label: '权限', value: 'nav 与 routes 用同一个权限码' },
              { label: '词条', value: 'i18n/locales/zh.ts 与 en.ts 同步补' },
            ]}
          />
        </SectionCard>
      </GuideSection>

      <GuideNext to="/guide/contract" label="接口契约" desc="新模块要后端配合什么接口" />
    </GuidePage>
  )
}
