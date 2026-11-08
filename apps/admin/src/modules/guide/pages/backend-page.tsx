import { useState } from 'react'
import {
  ArrowRight,
  CircleCheck,
  Copy,
  Database,
  KeyRound,
  PlugZap,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { Alert, Badge, Button, CodeBlock, Descriptions, SectionCard, Tabs, toast } from '@nexus/ui'
import { useAppNavigate } from '@/components/app-link'
import { useAuthStore } from '@/core/auth-store'
import {
  CodeTabs,
  FileRef,
  GuideNext,
  GuideNote,
  GuidePage,
  GuideSection,
  GuideStep,
  Level,
} from '../components'

/**
 * 接入后端：完整教程
 *
 * 这一页是这个项目最重要的一页文档——它必须能让一个没看过这个模板的人，
 * 在半小时内把前端从 Mock 数据切到自己的后端，并且知道出问题该看哪里。
 *
 * 结构：
 * 0. 前置检查（跑得起来、看得懂链路）
 * 1. 配 baseURL
 * 2. 关 Mock
 * 3. 换鉴权
 * 4. 对齐响应契约
 * 5. 逐模块替换数据层
 * 6. 权限与 403
 * 7. 错误处理与 Trace
 * 8. 跨域 / 代理 / 部署
 * 9. 自查清单
 */

const TOC = [
  { id: 'prepare', label: '0. 先决条件' },
  { id: 'base-url', label: '1. 配置基地址' },
  { id: 'disable-mock', label: '2. 关闭 Mock' },
  { id: 'auth', label: '3. 接入鉴权' },
  { id: 'turnstile', label: '4. 人机验证' },
  { id: 'contract', label: '5. 响应契约' },
  { id: 'services', label: '6. 替换数据层' },
  { id: 'permission', label: '7. 权限同步' },
  { id: 'error', label: '8. 错误处理' },
  { id: 'cors', label: '9. 跨域与部署' },
  { id: 'checklist', label: '10. 自查清单' },
]

const ENV_SNIPPET = `# apps/admin/.env.local（此文件不进版本库）
#
# 同源部署（推荐）：由 Nginx / Vite 代理把 /api 转发到后端
# VITE_API_BASE=/api

# 跨域部署：写完整地址，浏览器会直接请求该域名（需要后端放行 CORS）
VITE_API_BASE=https://api.your-domain.com

# 本地想接真后端、同时保留演示站时，显式关闭 Mock
# VITE_ENABLE_MOCK=false`

const MAIN_SNIPPET = `// src/main.tsx
const MOCK_ENABLED =
  import.meta.env.VITE_ENABLE_MOCK === 'true' ||
  (import.meta.env.VITE_ENABLE_MOCK !== 'false' && import.meta.env.DEV)

async function bootstrap() {
  if (MOCK_ENABLED) {
    const { startMockServer } = await import('./mock')
    await startMockServer()      // ← 生产构建里这段会被整块摇掉
  }
  // ... 挂载 React
}`

const AUTH_SNIPPET = `// src/core/auth-store.ts —— 默认实现是「永远拒绝」
let authAdapter: AuthAdapter = {
  login: async () => {
    throw new Error(tStatic('http.authNotConfigured'))
  },
}
export function configureAuthAdapter(adapter: AuthAdapter) {
  authAdapter = adapter
}

// 你在 src/main.tsx 里换掉它即可，store / 守卫 / 页面都不用改：
import { configureAuthAdapter } from './core/auth-store'
import { api } from './core/http'

configureAuthAdapter({
  login: async (email, password) => {
    const res = await api.post<{ token: string; user: CurrentUser }>(
      '/auth/login',
      { email, password },
      { anonymous: true },        // 登录请求不带旧 token
    )
    return res                    // { token, user } → store 自动持久化到 localStorage
  },
})`

const AUTH_RESPONSE = `// POST /auth/login  →  200
{
  "code": 0,
  "message": "ok",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "u_1001",
      "name": "陈彦之",
      "email": "admin@nexus.dev",
      "avatar": "https://cdn.example.com/a.png",
      "role": "admin",
      "roleName": "管理员",
      "department": "平台技术部",
      "permissions": ["user:read", "user:write", "order:read", "role:read"]
    }
  }
}

// permissions 里的 "*" 表示超级管理员：hasPermission() 全部放行`

/* ---------------- 4. 人机验证（Turnstile） ---------------- */

const CAPTCHA_CLIENT_SNIPPET = `// 登录页已经接好了，这里只说明「票据是怎么走的」
import { TurnstileWidget } from '@/components/turnstile-widget'

<TurnstileWidget
  runKey={captchaRun}                      // 点登录才 +1：挂载后不运行、不占位
  onVerify={setCaptchaToken}               // 拿到 cf-turnstile-response
  onExpire={() => setCaptchaToken(null)}   // 过期/超时：清掉，别拿旧的去提交
/>

// 提交时
setCaptchaRun((n) => n + 1)                // 「现在开始验证」
const ticket = await waitForCaptchaToken() // 等它出票（测试 key 通常 < 1s）
await login(email, password, { captchaToken: ticket })`

const CAPTCHA_ONDEMAND_SNIPPET = `// 为什么「点了登录才出现」
// 1) execution: 'execute' —— 渲染后不自动跑，等显式 execute()
// 2) appearance: 'interaction-only' —— 不需要交互时零尺寸
// 3) 父组件把这一行用 -mt-3.5 h-0 抵消掉表单的 space-y 间距
//
// 结果：没点提交时，登录按钮与输入框的间距与「没接入验证」时完全一致；
// 需要点一下时，挑战才展开在这一行的位置。`

const CAPTCHA_ADAPTER_SNIPPET = `// src/main.tsx —— 把票据塞进登录请求体
configureAuthAdapter({
  login: async (email, password, options) => {
    const res = await api.post<{ token: string; user: CurrentUser }>(
      '/auth/login',
      {
        email,
        password,
        'cf-turnstile-response': options?.captchaToken,  // 字段名与官方约定一致
      },
      { anonymous: true },
    )
    return res
  },
})`

const CAPTCHA_SERVER_SNIPPET = `// 你的后端：登录 handler 里，原有逻辑之前插这一段（Node / Express 写法）
const EXPECTED_ACTION = 'login'
const EXPECTED_HOSTNAMES = new Set(
  (process.env.TURNSTILE_HOSTNAMES ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean),
)

const token = req.body['cf-turnstile-response']

// 1) 形状检查：空 / 超长直接拒，别浪费一次上游调用
if (typeof token !== 'string' || !token || token.length > 2048) {
  return res.status(403).json({ code: 403, message: '人机验证未通过' })
}

// 2) 服务端调 siteverify —— **绝对不能**从浏览器调
let result
try {
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(10_000),
    body: new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET,   // 只在服务端环境变量里
      response: token,
      remoteip: req.ip,                       // 有代理时用 X-Forwarded-For 首段
    }),
  })
  if (!r.ok) throw new Error('siteverify ' + r.status)
  result = await r.json()
} catch {
  // 上游不可达时**失败关闭**，不放行
  return res.status(403).json({ code: 403, message: '人机验证服务不可用' })
}

// 3) 三项全过才算真人：success / action / hostname
if (!result.success) {
  return res.status(403).json({ code: 403, message: '人机验证未通过', detail: result['error-codes'] })
}
if (result.action !== EXPECTED_ACTION) {
  return res.status(403).json({ code: 403, message: '人机验证 action 不匹配' })
}
if (!EXPECTED_HOSTNAMES.has(result.hostname)) {
  return res.status(403).json({ code: 403, message: '人机验证来源域名不在白名单' })
}

// 4) 通过 → 继续你原来的登录逻辑（账号密码校验、签发 token…）`

const CAPTCHA_ENV_SNIPPET = `# 后端环境变量（不是 VITE_ 前缀，永远不会进浏览器包）
TURNSTILE_SECRET=<Cloudflare 控制台 → Turnstile → 你的组件 → Secret Key>

# 前端域名白名单，逗号分隔。**生产环境不要写 localhost / 127.0.0.1**
TURNSTILE_HOSTNAMES=admin.your-domain.com

# 本地联调时可以把本地域名也加上（同一个后端部署不要与生产共用这份配置）
# TURNSTILE_HOSTNAMES=admin.your-domain.com,localhost,127.0.0.1`

const CAPTCHA_CONFIG_SNIPPET = `# 前端（app/admin/.env.local，都是公开值）
# site key 是公开的，写进仓库也没关系；secret 绝对不能
VITE_TURNSTILE_SITE_KEY=0x4AAAAAAF1Fc2tsbu8bVO-a

# 前端是否拦截「没通过就不提交」。默认开启；只想由后端兜底时可关掉
# VITE_TURNSTILE_ENFORCE=false

# 组件默认域名列表里没有这两个时，本地会一直停在 pending：
#   Cloudflare 控制台 → Turnstile → 你的组件 → Hostname Management
#   加入 localhost 与 127.0.0.1（仅本地联调）`

const HTTP_SNIPPET = `// src/core/http.ts —— 已经内置的部分（不用重写）
export const DEFAULT_BASE_URL =
  (import.meta.env.VITE_API_BASE as string | undefined)?.trim() || '/api'

// 1) 请求拦截器：注入 token（use-http.ts 已注册 Bearer 与 X-Trace-Id）
addRequestInterceptor((config) => {
  const { token } = useAuthStore.getState()
  if (!token || config.anonymous) return config
  const headers = new Headers(config.headers)
  headers.set('Authorization', \`Bearer \${token}\`)
  headers.set('X-Trace-Id', crypto.randomUUID())
  return { ...config, headers }
})

// 2) 响应解包：{ code, message, data } 与裸数据两种风格都吃
const data = payload && typeof payload === 'object' && 'data' in payload
  ? payload.data
  : payload

// 3) 401 统一登出；其它错误走全局 toast（1200ms 内去重）
addErrorHandler((error) => {
  if (error.code === 401) {
    useAuthStore.getState().logout()
    toast.warning(tStatic('http.sessionExpired'))
    return
  }
  toast.error(error.message, { description: error.traceId && \`Trace: \${error.traceId}\` })
})`

const CONTRACT_SNIPPET = `// 后端可以二选一，http.ts 都认

// A. 包裹式（推荐：能带 code / message / traceId）
{ "code": 0, "message": "ok", "data": { "items": [], "total": 0 } }

// B. 裸数据
{ "items": [], "total": 0 }

// 错误统一走 HTTP 状态码 + 下面的结构：
// 401 / 403 / 404 / 422 / 500
{ "code": 422, "message": "邮箱已被占用", "traceId": "trace_9f2a3b1c" }

// 列表分页参数（前端已按这个约定发请求）
// GET /users?page=1&pageSize=20&keyword=chen&sortBy=createdAt&sortOrder=desc`

const SCHEMA_SNIPPET = `// src/services/schemas.ts —— 只在开发环境动态加载，生产包不含 zod
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['super_admin', 'admin', 'operator', 'auditor', 'viewer']),
  status: z.enum(['active', 'invited', 'disabled', 'locked']),
  permissions: z.array(z.string()),
})

// 字段改名后不会静默渲染 undefined，而是当场抛「接口响应结构不符：/users」
// 只校验你正在迁移的那几个接口即可，全量校验可以慢慢补`

const QUERY_SNIPPET = `// src/services/queries.ts —— 页面唯一的取数入口
export function useUsers(params: UserListParams = {}) {
  return useQuery({
    queryKey: queryKeys.users(params),
    queryFn: ({ signal }) =>
      api.get<PageResult<User>>('/users', {
        params: params as Record<string, string | number>,
        signal,                                  // 参数变化 / 卸载时中断在途请求
        schema: devSchema((m) => m.userPageSchema),
      }),
    placeholderData: (prev) => prev,             // 翻页时保留旧数据，不闪白
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<User> }) =>
      api.patch<User>(\`/users/\${id}\`, patch),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['users'] }),
  })
}

// 后端字段风格不同？就在这一层映射，页面不用动：
const toUser = (dto: ApiUser): User => ({ ...dto, role: dto.roleCode })`

const FIELD_MAP_SNIPPET = `// 后端返回 list / count 之类的命名？在数据层做一次映射即可
async function fetchUsers(params: UserListParams): Promise<PageResult<User>> {
  const raw = await api.get<{ list: ApiUser[]; count: number }>('/users', {
    params: { page: params.page, size: params.pageSize },
  })
  return {
    items: raw.list.map(toUser),
    total: raw.count,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
  }
}`

const PERMISSION_SNIPPET = `// 1) 模块清单里声明（导航与路由共用同一个权限码）
export const businessModule = defineModule({
  id: 'business',
  title: '业务管理',
  order: 20,
  nav: [{ key: 'users', title: '用户管理', path: '/business/users', permission: 'user:read' }],
  routes: [
    { path: '/business/users', permission: 'user:read', component: () => import('./pages/users-page') },
  ],
})

// 2) 路由守卫：无权限时直接输入 URL 也进不去
//    src/core/route-guard.ts → decideRouteAccess() 返回 allow / login / forbidden
//    403 页面会显示「缺哪个权限码、当前账号有哪些权限」

// 3) 按钮级：用同一个码控制可写操作
const { hasPermission } = useAuthStore()
<Button disabled={!hasPermission('user:write')}>删除</Button>`

const ERROR_SNIPPET = `// 调用方想让某个请求自己处理错误，不弹全局 toast：
await api.get('/users', { silent: true })

// 需要给用户看 Trace ID 时，ApiError 上带着后端给的 traceId：
import { ApiError } from '@/core/http'
try {
  await api.post('/orders', payload)
} catch (error) {
  if (error instanceof ApiError && error.code === 422) {
    setFieldErrors(parseDetail(error.detail))
  } else {
    throw error
  }
}

// 请求超时默认 15s，可单独指定；AbortSignal 会被透传到 fetch
await api.get('/reports/export', { timeout: 60_000 })`

const VITE_PROXY = `// apps/admin/vite.config.ts —— 本地开发用同源代理，彻底避开 CORS
export default defineConfig({
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',   // 你的后端
        changeOrigin: true,
        // 后端本身没有 /api 前缀时，用 rewrite 去掉
        // rewrite: (path) => path.replace(/^\\/api/, ''),
      },
    },
  },
})`

const NGINX_SNIPPET = `# 生产：前端静态产物 + /api 反代到后端，同源部署最省心
server {
  listen 80;
  server_name admin.your-domain.com;

  root /usr/share/nginx/html;          # pnpm build 产物
  index index.html;

  # SPA 路由回退（TanStack Router 用的是 history 模式）
  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:8080/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # 透传 Trace ID，前后端用同一个 id 排查问题
    proxy_set_header X-Trace-Id $request_id;
  }
}`

const CORS_SNIPPET = `# 如果确实要跨域（前后端不同域名），后端必须放行这两项：
Access-Control-Allow-Origin: https://admin.your-domain.com
Access-Control-Allow-Headers: Authorization, Content-Type, X-Trace-Id
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Expose-Headers: X-Trace-Id

# 并且要正确响应预检请求（OPTIONS），返回 204。
# 注意：Allow-Origin 不能是 *，否则带 Authorization 的请求会被浏览器拒绝。`

const DEPLOY_SNIPPET = `# 构建（会先跑 tsc 类型检查）
pnpm build

# 产物：apps/admin/dist
# 只需要把它交给静态服务器，不需要 Node 运行时

# 环境变量是「构建期」注入的：改 VITE_API_BASE 后必须重新 build
VITE_API_BASE=/api pnpm build`

export default function GuideBackendPage() {
  const navigate = useAppNavigate()
  const permissions = useAuthStore((state) => state.user?.permissions ?? [])
  const [copied, setCopied] = useState(false)

  const copyChecklist = async () => {
    const text = [
      '接入后端自查清单',
      '1. .env.local 配好 VITE_API_BASE',
      '2. 生产环境已关闭 VITE_ENABLE_MOCK',
      '3. configureAuthAdapter 指向真实登录接口',
      '4. 登录返回 { token, user.permissions }',
      '5. 后端用 siteverify 校验 cf-turnstile-response（success / action / hostname）',
      '6. TURNSTILE_SECRET 只在服务端；TURNSTILE_HOSTNAMES 不含 localhost',
      '7. 列表接口实现 page / pageSize / keyword / sortBy / sortOrder',
      '8. 错误响应统一 { code, message, traceId }',
      '9. 401 触发前端登出，403 由权限守卫处理',
      '10. CORS / 反向代理已放行 Authorization 与 X-Trace-Id',
    ].join('\n')
    const ok = await navigator.clipboard
      ?.writeText(text)
      .then(() => true)
      .catch(() => false)
    if (ok) {
      setCopied(true)
      toast.success('自查清单已复制')
      setTimeout(() => setCopied(false), 1600)
    } else {
      toast.error('复制失败，请手动选择文本')
    }
  }

  return (
    <GuidePage
      title="接入后端"
      subtitle="从「跑演示数据」到「跑你自己的接口」：配置、鉴权、契约、权限、错误与部署，一步步来。每一步都能独立验证，不需要一次性改完。"
      toc={TOC}
      actions={
        <>
          <Badge tone="danger" variant="outline" size="sm">
            必读
          </Badge>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Copy className="size-3.5" />}
            onClick={() => void copyChecklist()}
          >
            {copied ? '已复制' : '复制清单'}
          </Button>
          <Button
            size="sm"
            variant="primary"
            rightIcon={<ArrowRight className="size-3.5" />}
            onClick={() => navigate('/guide/contract')}
          >
            接口契约
          </Button>
        </>
      }
    >
      {/* ---------------- 0. 先决条件 ---------------- */}
      <GuideSection
        id="prepare"
        eyebrow="Prerequisites"
        title="0. 先决条件"
        description="先确认三件事，再动手改代码——这三件事没确认，后面每一步都会变成猜。"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            {
              icon: <PlugZap className="size-4" />,
              title: '演示站跑得起来',
              desc: 'pnpm dev 后能用演示账号登录，说明前端本身没问题',
            },
            {
              icon: <Database className="size-4" />,
              title: '后端有几个接口',
              desc: '至少要有登录、一个列表、一个详情，才能验证链路',
            },
            {
              icon: <ShieldCheck className="size-4" />,
              title: '确定权限模型',
              desc: '权限码由谁下发：登录接口返回，还是单独的用户信息接口',
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
        </div>

        <GuideNote tone="tip" title="现在的登录态是什么？">
          当前账号：
          <span className="font-medium text-fg-2">
            {permissions.includes('*') ? '超级管理员（全部权限）' : `${permissions.length} 项权限`}
          </span>
          。换成真实后端后，这份权限列表改由登录接口返回，页面与导航会自动跟着变。
        </GuideNote>
      </GuideSection>

      {/* ---------------- 1. baseURL ---------------- */}
      <GuideSection
        id="base-url"
        eyebrow="Step 1"
        title={
          <span className="flex flex-wrap items-center gap-2">
            配置接口基地址 <Level value="必读" />
          </span>
        }
        description="只有一个环境变量：VITE_API_BASE。它会在构建期被静态替换进包里。"
      >
        <GuideStep
          index={1}
          title="新建 .env.local"
          description="放在 apps/admin 下；.gitignore 已排除，不会被提交"
        >
          <CodeBlock language="bash" filename="apps/admin/.env.local" code={ENV_SNIPPET} />
        </GuideStep>

        <GuideStep index={2} title="确认传输层读到了它" description="源码已经支持，无需改动">
          <FileRef path="src/core/http.ts" note="DEFAULT_BASE_URL 与 buildURL" />
          <CodeBlock
            filename="src/core/http.ts"
            code={`export const DEFAULT_BASE_URL =
  (import.meta.env.VITE_API_BASE as string | undefined)?.trim() || '/api'

// 跨域绝对地址会原样保留 host；同源前缀仍走相对路径（不触发预检）
const url = new URL(\`\${base}/\${path}\`, window.location.origin)
return /^https?:\\/\\//i.test(base) ? url.toString() : url.pathname + url.search`}
          />
        </GuideStep>

        <GuideNote tone="warn" title="两个容易踩的坑">
          <ul className="list-inside list-disc space-y-1">
            <li>
              环境变量是<b>构建期</b>注入的，改完要重启 dev server；生产环境改完要重新 build。
            </li>
            <li>
              只有 <code className="font-mono">VITE_</code>{' '}
              前缀的变量才会暴露给浏览器，别把密钥写进来。
            </li>
          </ul>
        </GuideNote>
      </GuideSection>

      {/* ---------------- 2. 关闭 Mock ---------------- */}
      <GuideSection
        id="disable-mock"
        eyebrow="Step 2"
        title={
          <span className="flex flex-wrap items-center gap-2">
            关闭演示数据 <Level value="必读" />
          </span>
        }
        description="Mock 层通过拦截 window.fetch 工作，只认 /api/ 前缀；关掉它，请求才会真正发出去。"
      >
        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-xs leading-6 text-fg-2">
              生产构建默认就是关闭的（<code className="font-mono text-2xs">MOCK_ENABLED</code>{' '}
              里要求 <code className="font-mono text-2xs">import.meta.env.DEV</code>
              ）。只有本地开发时它会自动开启，所以「本地接真后端」才需要显式关掉。
            </p>
            <CodeBlock
              language="bash"
              filename="apps/admin/.env.local"
              code={`VITE_ENABLE_MOCK=false`}
              maxHeight={120}
            />
            <CodeBlock filename="src/main.tsx" code={MAIN_SNIPPET} maxHeight={220} />
          </div>
          <div className="space-y-2 rounded-lg border border-line bg-surface p-3.5">
            <p className="text-2xs font-medium text-fg-3">关闭后如何确认？</p>
            <ol className="list-inside list-decimal space-y-1.5 text-2xs leading-5 text-fg-2">
              <li>
                打开 DevTools → Network，刷新页面，应该看不到{' '}
                <code className="font-mono">[Mock] 演示数据已启用</code> 这条 console 信息；
              </li>
              <li>
                登录会直接失败并提示「未配置鉴权服务」——这是<b>正确</b>的，因为默认 adapter
                永远拒绝（项目不内置任何口令后门）；
              </li>
              <li>接下来做第 3 步，把登录接到你的接口上。</li>{' '}
            </ol>
          </div>
        </div>
      </GuideSection>

      {/* ---------------- 3. 鉴权 ---------------- */}
      <GuideSection
        id="auth"
        eyebrow="Step 3"
        title={
          <span className="flex flex-wrap items-center gap-2">
            接入鉴权 <Level value="必读" />
          </span>
        }
        description="登录本身只做一件事：把 { token, user } 交给 store。其余（持久化、注入请求头、401 登出）都已内置。"
      >
        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-2xs font-medium text-fg-3">前端要做的事</p>
            <CodeBlock filename="src/main.tsx" code={AUTH_SNIPPET} maxHeight={330} />
          </div>
          <div className="space-y-2">
            <p className="text-2xs font-medium text-fg-3">后端要返回的结构</p>
            <CodeBlock
              language="json"
              filename="POST /auth/login"
              code={AUTH_RESPONSE}
              maxHeight={330}
            />
          </div>
        </div>

        <div className="rounded-lg border border-line bg-surface p-3.5">
          <p className="mb-2 flex items-center gap-1.5 text-2xs font-medium text-fg-2">
            <KeyRound className="size-3.5 text-primary" />
            登录之后自动发生的事
          </p>
          <ul className="grid grid-cols-1 gap-1.5 text-2xs leading-5 text-fg-3 sm:grid-cols-2">
            <li className="flex gap-1.5">
              <CircleCheck className="mt-0.5 size-3 shrink-0 text-success" />
              token 与 user 写入 localStorage（key：nexus-auth），刷新不掉登录
            </li>
            <li className="flex gap-1.5">
              <CircleCheck className="mt-0.5 size-3 shrink-0 text-success" />
              每个请求自动带 Authorization: Bearer 与 X-Trace-Id
            </li>
            <li className="flex gap-1.5">
              <CircleCheck className="mt-0.5 size-3 shrink-0 text-success" />
              接口返回 401 时自动登出并跳回登录页
            </li>
            <li className="flex gap-1.5">
              <CircleCheck className="mt-0.5 size-3 shrink-0 text-success" />
              侧栏菜单、路由守卫、按钮禁用同时按 permissions 生效
            </li>
          </ul>
        </div>

        <GuideNote tone="tip" title="想改成 HttpOnly Cookie？">
          删掉 auth-store 里的 token 逻辑，在 <code className="font-mono">http.ts</code> 的 fetch
          选项里加 <code className="font-mono">credentials: 'include'</code>，后端的 401
          照旧会触发登出——其余代码不用动。
        </GuideNote>
      </GuideSection>

      {/* ---------------- 4. 人机验证 ---------------- */}
      <GuideSection
        id="turnstile"
        eyebrow="Step 4"
        title={
          <span className="flex flex-wrap items-center gap-2">
            人机验证（Turnstile） <Level value="进阶" />
          </span>
        }
        description="登录页已经内置 Cloudflare Turnstile 组件。前端只负责拿票据，判定必须在你的后端完成 —— 这条边界不能挪。"
      >
        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-2xs font-medium text-fg-3">前端已经接好了（点登录才验证，不占位）</p>
            <CodeBlock
              filename="src/pages/login-page.tsx"
              code={CAPTCHA_CLIENT_SNIPPET}
              maxHeight={300}
            />
            <CodeBlock
              filename="src/components/turnstile-widget.tsx"
              code={CAPTCHA_ONDEMAND_SNIPPET}
              maxHeight={180}
            />
          </div>

          <div className="space-y-2">
            <p className="text-2xs font-medium text-fg-3">你需要在 adapter 里把票据带上</p>
            <CodeBlock filename="src/main.tsx" code={CAPTCHA_ADAPTER_SNIPPET} maxHeight={280} />
          </div>

          <div className="space-y-2">
            <p className="text-2xs font-medium text-fg-3">后端：调 siteverify 判定（关键步骤）</p>
            <CodeBlock
              filename="POST /auth/login（你的后端）"
              code={CAPTCHA_SERVER_SNIPPET}
              maxHeight={460}
            />
          </div>

          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            <CodeBlock
              language="bash"
              filename="后端环境变量"
              code={CAPTCHA_ENV_SNIPPET}
              maxHeight={260}
            />
            <CodeBlock
              language="bash"
              filename="前端环境变量"
              code={CAPTCHA_CONFIG_SNIPPET}
              maxHeight={260}
            />
          </div>
        </div>

        <GuideNote tone="danger" title="四条不能省的判定">
          <ul className="list-inside list-disc space-y-1">
            <li>
              <b>只在服务端调 siteverify</b>：secret 一旦进浏览器包就等于公开，任何 token
              都会被伪造通过，验证退化成装饰。
            </li>
            <li>
              <b>三项全过</b>：<code className="font-mono">success === true</code>、
              <code className="font-mono">action</code> 与预期一致、
              <code className="font-mono">hostname</code> 在白名单内。少一项都能被跨站复用。
            </li>
            <li>
              <b>失败关闭</b>：上游超时 / 5xx 一律拒绝，不能「验证服务挂了就先放行」。
            </li>
            <li>
              <b>token 一次性</b>：登录失败后前端会 reset 换新票据；后端也应拒绝重复兑换
              （siteverify 会回 <code className="font-mono">timeout-or-duplicate</code>）。
            </li>
          </ul>
        </GuideNote>

        <GuideNote tone="warn" title="本地一直转圈、控制台报 600010 / 110200？">
          组件的 Hostname Management 里还没有
          <code className="font-mono">localhost</code> 与
          <code className="font-mono">127.0.0.1</code>。去 Cloudflare 控制台加上即可；
          只想验证前端接线通不通，可临时把{' '}
          <code className="font-mono">VITE_TURNSTILE_SITE_KEY</code> 换成官方测试 key{' '}
          <code className="font-mono">1x00000000000000000000AA</code>
          （永远通过，票据恒为 <code className="font-mono">XXXX.DUMMY.TOKEN.XXXX</code>）。
        </GuideNote>

        <GuideNote tone="tip" title="演示态为什么不会卡住">
          模板默认没有后端，票据不会被兑换，因此演示构建自动使用官方测试 key； 生产构建固定使用正式
          key。真实判定与你的后端一起上线，见上面那段代码。
        </GuideNote>
      </GuideSection>

      {/* ---------------- 5. 响应契约 ---------------- */}
      <GuideSection
        id="contract"
        eyebrow="Step 5"
        title={
          <span className="flex flex-wrap items-center gap-2">
            对齐响应契约 <Level value="进阶" />
          </span>
        }
        description="前端对后端只有很少的硬性要求：能返回 JSON、错误用 HTTP 状态码、列表带分页字段。"
      >
        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-2xs font-medium text-fg-3">两种响应风格，二选一</p>
            <CodeBlock language="json" filename="响应体" code={CONTRACT_SNIPPET} maxHeight={300} />
          </div>
          <div className="space-y-2">
            <p className="text-2xs font-medium text-fg-3">开发期校验（可选，强烈建议）</p>
            <CodeBlock filename="src/services/schemas.ts" code={SCHEMA_SNIPPET} maxHeight={300} />
          </div>
        </div>

        <SectionCard title="http.ts 已经替你处理的细节" bodyClassName="px-0">
          <Descriptions
            className="p-4"
            columns={2}
            size="sm"
            items={[
              { label: '鉴权头', value: '自动注入 Bearer（可用 anonymous 跳过）' },
              { label: 'Trace ID', value: '自动生成 X-Trace-Id，并在错误提示里展示' },
              { label: '超时', value: '默认 15s，可按请求覆盖' },
              { label: '取消', value: 'signal 透传 fetch，切页 / 输入防抖真正中断' },
              { label: '解包', value: '有 data 字段就取 data，否则用整个响应体' },
              { label: '去重', value: '并发失败时 1200ms 内只弹一条 toast' },
            ]}
          />
        </SectionCard>

        <CodeBlock filename="src/core/http.ts（节选）" code={HTTP_SNIPPET} maxHeight={320} />
      </GuideSection>

      {/* ---------------- 6. 数据层 ---------------- */}
      <GuideSection
        id="services"
        eyebrow="Step 6"
        title={
          <span className="flex flex-wrap items-center gap-2">
            逐模块替换数据层 <Level value="必读" />
          </span>
        }
        description="一次只改一个模块：先改 users，登录进去看到真实数据，再动下一个。这样出问题范围永远很小。"
      >
        <CodeTabs
          filename="src/services/queries.ts"
          tabs={[
            { key: 'hook', label: '查询与变更', code: QUERY_SNIPPET },
            { key: 'map', label: '字段不一致时', language: 'tsx', code: FIELD_MAP_SNIPPET },
          ]}
        />

        <div className="overflow-hidden rounded-lg border border-line">
          <table className="n-table w-full text-left">
            <thead>
              <tr>
                <th className="h-9 px-4 text-2xs font-medium text-fg-3">页面都在用</th>
                <th className="h-9 px-4 text-2xs font-medium text-fg-3">hooks</th>
                <th className="h-9 px-4 text-2xs font-medium text-fg-3">对应接口</th>
              </tr>
            </thead>
            <tbody>
              {[
                [
                  '用户管理',
                  'useUsers / useUserStats / useCreateUser / useUpdateUser',
                  'GET/POST/PATCH /users',
                ],
                ['订单管理', 'useOrders / useOrderStats', 'GET /orders'],
                ['内容中心', 'useArticles / useArticleStats', 'GET /articles'],
                ['审计日志', 'useAuditLogs / useAuditStats', 'GET /audit-logs'],
                ['组织与角色', 'useOrgTree / useRoles', 'GET /org/tree、GET /roles'],
                [
                  '经营概览',
                  'useOverviewMetrics / useTrends / useChannels / useFunnel',
                  'GET /overview/*',
                ],
              ].map(([page, hooks, api]) => (
                <tr key={page} className="border-t border-line-subtle align-top">
                  <td className="px-4 py-2 text-xs whitespace-nowrap text-fg">{page}</td>
                  <td className="px-4 py-2 font-mono text-2xs leading-5 text-fg-2">{hooks}</td>
                  <td className="px-4 py-2 font-mono text-2xs whitespace-nowrap text-fg-3">
                    {api}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <GuideNote tone="warn" title="页面代码零改动的前提">
          页面里<b>不要</b>直接写 <code className="font-mono">fetch</code> 或{' '}
          <code className="font-mono">api.get</code>。所有取数都必须经过{' '}
          <code className="font-mono">services/queries.ts</code>；新增页面时照抄一个 hook
          再改路径即可，否则接后端时会散落到每个页面里。
        </GuideNote>
      </GuideSection>

      {/* ---------------- 7. 权限 ---------------- */}
      <GuideSection
        id="permission"
        eyebrow="Step 7"
        title={
          <span className="flex flex-wrap items-center gap-2">
            权限同步 <Level value="进阶" />
          </span>
        }
        description="权限码是前后端之间的约定：后端下发，前端只负责「按码隐藏入口 + 拦截直达 URL」。"
      >
        <CodeBlock filename="权限三处生效点" code={PERMISSION_SNIPPET} maxHeight={360} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            ['菜单过滤', 'filterNav：没有权限码的菜单根本不渲染', 'primary'],
            ['路由守卫', 'beforeLoad：直接输入 URL 也会被拦到 403', 'warning'],
            ['按钮禁用', 'hasPermission：写操作按钮置灰或隐藏', 'success'],
          ].map(([title, desc]) => (
            <div key={title} className="rounded-lg border border-line bg-surface px-3 py-2.5">
              <p className="text-xs font-medium text-fg">{title}</p>
              <p className="mt-0.5 text-2xs leading-5 text-fg-3">{desc}</p>
            </div>
          ))}
        </div>
        <GuideNote tone="tip" title="权限码怎么命名？">
          建议 <code className="font-mono">资源:动作</code>（如{' '}
          <code className="font-mono">user:read</code>、
          <code className="font-mono">order:delete</code>），超级管理员用{' '}
          <code className="font-mono">&quot;*&quot;</code>{' '}
          兜底。前端不写死任何角色名——角色到权限码的映射完全由后端决定。
        </GuideNote>
      </GuideSection>

      {/* ---------------- 8. 错误处理 ---------------- */}
      <GuideSection
        id="error"
        eyebrow="Step 8"
        title={
          <span className="flex flex-wrap items-center gap-2">
            错误处理与 Trace <Level value="进阶" />
          </span>
        }
        description="默认策略：所有失败都弹一条带 Trace ID 的 toast；需要精细化时用 silent 自己接管。"
      >
        <CodeBlock filename="错误处理" code={ERROR_SNIPPET} maxHeight={340} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Alert tone="warning" compact title="401 不要自己处理">
            全局错误处理器已经把 401
            当成「登录失效」：清空登录态、提示、跳登录。页面里再处理会重复跳转。
          </Alert>
          <Alert tone="info" compact title="403 不是错误弹窗">
            403 由路由守卫接管并渲染说明页，告诉用户缺哪个权限码、当前账号有什么权限，比弹 toast
            有用得多。
          </Alert>
        </div>
      </GuideSection>

      {/* ---------------- 9. 跨域 ---------------- */}
      <GuideSection
        id="cors"
        eyebrow="Step 9"
        title={
          <span className="flex flex-wrap items-center gap-2">
            跨域、代理与部署 <Level value="进阶" />
          </span>
        }
        description="开发期用 Vite 代理、生产期用 Nginx 反代，是最省心的组合：前端永远只请求同源的 /api。"
      >
        <Tabs
          variant="line"
          defaultValue="dev"
          items={[
            {
              key: 'dev',
              label: '本地开发代理',
              content: (
                <CodeBlock filename="apps/admin/vite.config.ts" code={VITE_PROXY} maxHeight={300} />
              ),
            },
            {
              key: 'prod',
              label: '生产 Nginx',
              content: (
                <CodeBlock
                  language="nginx"
                  filename="nginx.conf"
                  code={NGINX_SNIPPET}
                  maxHeight={360}
                />
              ),
            },
            {
              key: 'cors',
              label: '确实要跨域',
              content: (
                <CodeBlock
                  language="bash"
                  filename="CORS 响应头"
                  code={CORS_SNIPPET}
                  maxHeight={280}
                />
              ),
            },
            {
              key: 'build',
              label: '构建与发布',
              content: (
                <CodeBlock language="bash" filename="构建" code={DEPLOY_SNIPPET} maxHeight={220} />
              ),
            },
          ]}
        />
        <GuideNote tone="danger" title="SPA 刷新 404 不是后端的锅">
          TanStack Router 用 history 模式，部署时必须把未知路径回退到{' '}
          <code className="font-mono">index.html</code>（Nginx 的{' '}
          <code className="font-mono">try_files</code>）。漏了这一步，直接在详情页刷新就会 404。
        </GuideNote>
      </GuideSection>

      {/* ---------------- 10. 清单 ---------------- */}
      <GuideSection
        id="checklist"
        eyebrow="Checklist"
        title="10. 自查清单"
        description="按顺序过一遍，勾完就可以把演示数据彻底下线了。"
        extra={
          <Button
            size="xs"
            variant="secondary"
            onClick={() => void copyChecklist()}
            leftIcon={<Copy className="size-3" />}
          >
            复制
          </Button>
        }
      >
        <ol className="space-y-2">
          {[
            'apps/admin/.env.local 配好 VITE_API_BASE（同源 /api 或跨域绝对地址）',
            '生产构建关闭 Mock：不设 VITE_ENABLE_MOCK，或显式设为 false',
            'configureAuthAdapter 指向真实登录接口，返回 { token, user }',
            'user.permissions 由后端下发，超管用 "*"',
            '后端把 cf-turnstile-response 交给 siteverify，且断言 success / action / hostname 三项',
            'TURNSTILE_SECRET 只存在于服务端环境变量；TURNSTILE_HOSTNAMES 不含 localhost',
            '列表接口支持 page / pageSize / keyword / sortBy / sortOrder',
            '错误响应统一 { code, message, traceId }，并用 HTTP 状态码表达语义',
            '401 由后端返回、前端统一登出；403 交给权限守卫渲染说明页',
            '跨域时放行 Authorization 与 X-Trace-Id，并正确响应 OPTIONS 预检',
            '确认逐模块替换顺序：users → orders → content → audit → overview',
            '文档站同步更新：apps/docs/guide/backend.md',
          ].map((line, index) => (
            <li
              key={line}
              className="flex items-start gap-2 rounded-md border border-line bg-surface px-3 py-2"
            >
              <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-line text-[0.5625rem] text-fg-4 tabular-nums">
                {index + 1}
              </span>
              <span className="text-xs leading-5 text-fg-2">{line}</span>
            </li>
          ))}
        </ol>

        <Alert
          tone="success"
          icon={<TriangleAlert className="size-4" />}
          title="最后一步：删掉演示数据"
        >
          确认一切正常后，把 <code className="font-mono">src/mock</code> 整个目录删掉即可，
          <code className="font-mono">main.tsx</code> 里那段动态 import
          会自动变成空分支（打包时被摇掉）。
        </Alert>
      </GuideSection>

      <GuideNext
        to="/guide/contract"
        label="接口契约"
        desc="后端要实现的接口清单，可以直接拿去对齐"
      />
    </GuidePage>
  )
}
