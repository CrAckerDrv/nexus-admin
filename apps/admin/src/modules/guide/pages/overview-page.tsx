import { useState } from 'react'
import {
  ArrowRight,
  Boxes,
  Database,
  FileCode2,
  Fingerprint,
  KeyRound,
  Layers,
  PlugZap,
  ShieldCheck,
  Terminal,
} from 'lucide-react'
import {
  Badge,
  Button,
  CodeBlock,
  Descriptions,
  Grid,
  PageContainer,
  PageHeader,
  SectionCard,
  Steps,
  Tabs,
  toast,
} from '@nexus/ui'
import { useAppNavigate } from '@/components/app-link'

/**
 * 指南总览
 *
 * 回答一个问题：**在这个项目里把一个页面接到后端，一共要碰哪几个文件？**
 * 用一张调用链图 + 一份「文件 → 职责」表把链路讲清楚，
 * 后面的三个页面（接入后端 / 新增模块 / 接口契约）都建立在这张图上。
 */

const PIPELINE = [
  {
    key: 'page',
    title: '页面',
    file: 'src/modules/<name>/pages/*.tsx',
    desc: '只渲染数据，不关心数据从哪来',
    tone: 'primary' as const,
  },
  {
    key: 'query',
    title: '数据层',
    file: 'src/services/queries.ts',
    desc: 'React Query hooks：缓存、重试、取消都在这里',
    tone: 'success' as const,
  },
  {
    key: 'http',
    title: '传输层',
    file: 'src/core/http.ts',
    desc: '统一 baseURL / 拦截器 / 401 / 错误解包',
    tone: 'warning' as const,
  },
  {
    key: 'backend',
    title: '后端',
    file: 'VITE_API_BASE',
    desc: '任何返回 JSON 的 HTTP 服务',
    tone: 'danger' as const,
  },
]

const FILE_TABLE = [
  ['src/core/http.ts', '传输层', 'baseURL、超时、拦截器、响应解包、401 统一登出'],
  ['src/services/queries.ts', '数据访问', '每个业务实体一个 hook，页面只调用 hook'],
  ['src/services/schemas.ts', '运行时契约', 'zod 校验响应结构，只在开发环境加载'],
  ['src/core/auth-store.ts', '登录态', 'token / user / permissions，接后端时换 AuthAdapter'],
  ['src/core/route-guard.ts', '路由守卫', '权限码 → 放行 / 跳登录 / 跳 403'],
  ['src/modules/<name>/module.ts', '模块声明', '导航 + 路由 + 权限，注册后自动生效'],
  ['src/mock/*', '演示数据', '拦截 fetch 的内存服务，生产默认不打包'],
]

const DEMO_STORE = `# 1. 复制环境变量模板
Copy-Item apps/admin/.env.example apps/admin/.env.local

# 2. 指向你的后端（同源反代可写 /api，跨域直接写绝对地址）
# VITE_API_BASE=https://api.your-domain.com

# 3. 关闭演示数据（生产默认就是关闭的，本地想接真后端时显式关）
# VITE_ENABLE_MOCK=false

pnpm dev        # http://127.0.0.1:5173`

const DEMO_AUTH = `// src/main.tsx —— 接入真实后端后，把 Mock 启动换成真实鉴权适配器
import { configureAuthAdapter } from './core/auth-store'
import { api } from './core/http'

configureAuthAdapter({
  login: async (email, password) => {
    const { token, user } = await api.post<{
      token: string
      user: CurrentUser
    }>('/auth/login', { email, password })
    return { token, user }
  },
})

// Mock 分支仅在开发环境或 VITE_ENABLE_MOCK=true 时才会被打包
if (MOCK_ENABLED) {
  const { startMockServer } = await import('./mock')
  await startMockServer()
}`

export default function GuideOverviewPage() {
  const navigate = useAppNavigate()
  const [step, setStep] = useState(1)

  return (
    <PageContainer size="lg">
      <PageHeader
        title="开发指南"
        description="把这个模板接到你自己的后端，并且按它的规矩继续加模块——从这一页开始。"
        badge={<Badge tone="primary">Developer guide</Badge>}
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<Terminal className="size-3.5" />}
              onClick={() => {
                void navigator.clipboard?.writeText('pnpm dev')
                toast.success('已复制 pnpm dev')
              }}
            >
              pnpm dev
            </Button>
            <Button
              variant="primary"
              rightIcon={<ArrowRight className="size-3.5" />}
              onClick={() => navigate('/guide/backend')}
            >
              开始接入后端
            </Button>
          </>
        }
      />

      {/* ---------------- 调用链 ---------------- */}
      <SectionCard
        title="一次请求的完整链路"
        description="页面 → 数据层 → 传输层 → 后端；接后端时只需要改后三步，页面代码零改动"
      >
        <div className="p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {PIPELINE.map((node, index) => (
              <div
                key={node.key}
                className="relative rounded-lg border border-line bg-surface-2/40 p-3"
              >
                <span className="flex items-center gap-1.5">
                  <span className="grid size-5 place-items-center rounded-sm bg-surface text-2xs font-semibold text-fg-3 tabular-nums">
                    {index + 1}
                  </span>
                  <span className="text-[0.8125rem] font-semibold text-fg">{node.title}</span>
                </span>
                <p className="mt-1.5 font-mono text-2xs break-all text-fg-3">{node.file}</p>
                <p className="mt-1.5 text-2xs leading-5 text-fg-4">{node.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-md border border-line bg-surface p-3">
            <p className="mb-2 text-2xs font-medium text-fg-3">等价的一段代码</p>
            <CodeBlock
              maxHeight={220}
              filename="src/modules/business/pages/users-page.tsx"
              code={`// 页面里只做这件事：调用 hook，渲染结果
const { data, isLoading } = useUsers({ page, keyword, status })

// hook 内部（services/queries.ts）
export function useUsers(params: UserListParams = {}) {
  return useQuery({
    queryKey: queryKeys.users(params),
    queryFn: ({ signal }) =>
      api.get<PageResult<User>>('/users', {
        params,
        signal,                    // 组件卸载 / 参数变化时真正中断请求
        schema: devSchema((m) => m.userPageSchema), // 仅开发期校验响应
      }),
    placeholderData: (prev) => prev,
  })
}`}
            />
          </div>
        </div>
      </SectionCard>

      {/* ---------------- 文件职责 ---------------- */}
      <SectionCard
        className="mt-3"
        title="需要知道的文件"
        description="按「接后端会碰到」的顺序排列，前四个是必改的"
      >
        <div className="overflow-x-auto">
          <table className="n-table w-full text-left">
            <thead>
              <tr>
                <th className="h-9 px-4 text-2xs font-medium text-fg-3">文件</th>
                <th className="h-9 px-4 text-2xs font-medium text-fg-3">职责</th>
                <th className="h-9 px-4 text-2xs font-medium text-fg-3">说明</th>
              </tr>
            </thead>
            <tbody>
              {FILE_TABLE.map(([file, role, desc]) => (
                <tr key={file} className="border-t border-line-subtle">
                  <td className="px-4 py-2 font-mono text-2xs whitespace-nowrap text-primary">
                    {file}
                  </td>
                  <td className="px-4 py-2 text-xs whitespace-nowrap text-fg">{role}</td>
                  <td className="px-4 py-2 text-xs leading-5 text-fg-3">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ---------------- 快速开始 ---------------- */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SectionCard title="本机跑起来" description="Node ≥ 20.19、pnpm ≥ 10" bodyClassName="p-4">
          <CodeBlock
            language="powershell"
            filename="PowerShell"
            code={DEMO_STORE}
            maxHeight={220}
          />
        </SectionCard>

        <SectionCard
          title="换成真实鉴权"
          description="默认不内置任何演示口令；没有 adapter 就登录不了"
          bodyClassName="p-4"
        >
          <CodeBlock filename="src/main.tsx" code={DEMO_AUTH} maxHeight={280} />
        </SectionCard>
      </div>

      {/* ---------------- 建议顺序 ---------------- */}
      <SectionCard
        className="mt-3"
        title="推荐的上手顺序"
        description="按这个顺序做，每一步都能独立验证"
      >
        <div className="p-4">
          <Steps
            current={step}
            onChange={setStep}
            items={[
              { title: '跑通演示', description: 'pnpm dev + 演示账号' },
              { title: '定接口契约', description: '分页 / 错误 / 鉴权' },
              { title: '配 VITE_API_BASE', description: '关掉 Mock' },
              { title: '换 AuthAdapter', description: '登录走真实接口' },
              { title: '逐个模块替换', description: '按 queries.ts 顺序' },
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => navigate('/guide/contract')}>
              先看接口契约
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate('/guide/module')}>
              我只要加个模块
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* ---------------- 能力清单 ---------------- */}
      <Grid cols={3} gap="md" className="mt-3">
        {[
          {
            icon: <PlugZap className="size-4" />,
            title: '传输层已内置',
            desc: '鉴权头、Trace ID、超时、错误解包、401 统一登出与 toast 去重',
          },
          {
            icon: <ShieldCheck className="size-4" />,
            title: '权限两端一致',
            desc: '同一个权限码同时驱动侧栏过滤与路由守卫，直连 URL 也拦得住',
          },
          {
            icon: <Database className="size-4" />,
            title: '响应契约可校验',
            desc: 'zod schema 只在开发期加载，字段改名当场报错而不是渲染 undefined',
          },
          {
            icon: <Layers className="size-4" />,
            title: '新增模块两个文件',
            desc: 'module.ts 声明 nav / routes / permission，注册表加一行即可',
          },
          {
            icon: <Fingerprint className="size-4" />,
            title: '登录态可持久化',
            desc: 'zustand persist 写入 nexus-auth，刷新不掉登录',
          },
          {
            icon: <KeyRound className="size-4" />,
            title: '无演示口令兜底',
            desc: 'Mock 与演示账号只在开发环境或显式开启时打包',
          },
        ].map((item) => (
          <div key={item.title} className="rounded-lg border border-line bg-surface p-3.5">
            <span className="grid size-7 place-items-center rounded-md bg-primary-weak text-primary">
              {item.icon}
            </span>
            <p className="mt-2 text-[0.8125rem] font-medium text-fg">{item.title}</p>
            <p className="mt-1 text-2xs leading-5 text-fg-3">{item.desc}</p>
          </div>
        ))}
      </Grid>

      {/* ---------------- 入口 ---------------- */}
      <SectionCard className="mt-3" title="继续读" description="每一页都能独立看完，不必按顺序">
        <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-3">
          {[
            {
              to: '/guide/backend',
              label: '接入后端',
              desc: '环境变量 / 鉴权 / 契约 / 部署',
              icon: PlugZap,
            },
            {
              to: '/guide/module',
              label: '新增模块',
              desc: '两个文件，路由与菜单自动生成',
              icon: FileCode2,
            },
            { to: '/guide/contract', label: '接口契约', desc: '后端要实现的接口清单', icon: Boxes },
          ].map((item) => (
            <button
              key={item.to}
              type="button"
              onClick={() => navigate(item.to)}
              className="group flex items-start gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary-weak/20"
            >
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-surface-2 text-fg-3 group-hover:text-primary">
                <item.icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-fg group-hover:text-primary">
                  {item.label}
                </span>
                <span className="block text-2xs text-fg-3">{item.desc}</span>
              </span>
              <ArrowRight className="mt-1 size-3.5 shrink-0 text-fg-4" />
            </button>
          ))}
        </div>
      </SectionCard>

      <div className="mt-3">
        <Tabs
          variant="line"
          defaultValue="changelog"
          items={[
            {
              key: 'changelog',
              label: '变更记录',
              content: (
                <Descriptions
                  size="sm"
                  columns={1}
                  items={[
                    {
                      label: '指南模块',
                      value:
                        '由原来的「帮助中心」弹窗升级为 4 个页面（总览 / 接入后端 / 新增模块 / 接口契约）',
                    },
                    {
                      label: '组件总览',
                      value:
                        '改为带实时预览的橱窗页：左侧分类索引 + 搜索 + 真实渲染卡片 + Props 详情',
                    },
                    {
                      label: '传输层',
                      value:
                        'DEFAULT_BASE_URL 真正读取 VITE_API_BASE；跨域绝对地址不再被静默降级为同源',
                    },
                  ]}
                />
              ),
            },
            {
              key: 'faq',
              label: '常见疑问',
              content: (
                <div className="space-y-2 text-xs leading-6 text-fg-2">
                  <p>
                    <span className="font-medium text-fg">Q：能不改页面就换后端吗？</span>
                    <br />
                    能。页面只依赖 services/queries.ts 的 hooks，把 hook
                    里的路径与字段映射改掉即可。
                  </p>
                  <p>
                    <span className="font-medium text-fg">
                      Q：后端一定要返回 {'{ code, data }'} 吗？
                    </span>
                    <br />
                    不必。http.ts 同时兼容包裹式与裸数据两种风格，见「接入后端 → 响应契约」。
                  </p>
                </div>
              ),
            },
          ]}
        />
      </div>
    </PageContainer>
  )
}
