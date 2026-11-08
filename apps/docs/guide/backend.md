# 接入后端（完整版）

> 后台应用内也有一份同内容的交互式教程：`/guide/backend`，带目录、代码复制与自查清单。
> 这里保留纯 Markdown 版本，便于随仓库阅读与检索。

演示数据由 `src/mock` 提供（拦截原生 `fetch`）。切到真实接口需要改**三步**，页面代码零改动。

## 0. 先决条件

| 要确认的       | 怎么确认                                     |
| -------------- | -------------------------------------------- |
| 演示站跑得起来 | `pnpm dev` 后用演示账号登录成功              |
| 后端有基本接口 | 至少：登录、一个列表、一个详情               |
| 权限模型       | 权限码由登录接口下发，还是单独的用户信息接口 |

## 1. 配置基地址

```bash
# apps/admin/.env.local（不进版本库）
# 同源部署（推荐）：由 Nginx / Vite 代理把 /api 转发到后端
VITE_API_BASE=/api

# 跨域部署：写完整地址（需要后端放行 CORS）
VITE_API_BASE=https://api.your-domain.com

# 本地接真后端时显式关闭演示数据
VITE_ENABLE_MOCK=false
```

`src/core/http.ts` 会真正读取这个变量：

```ts
export const DEFAULT_BASE_URL: string =
  (import.meta.env.VITE_API_BASE as string | undefined)?.trim() || '/api'
```

- 绝对地址（`https://...`）会原样保留 host，请求真正跨域发出
- 同源前缀（`/api`）走相对路径，不触发预检，Mock 层也只认这个前缀

> 环境变量是**构建期**注入的：改完要重启 dev server，生产环境改完必须重新 build。

## 2. 移除 Mock 启动

```ts
// src/main.tsx
const MOCK_ENABLED =
  import.meta.env.VITE_ENABLE_MOCK === 'true' ||
  (import.meta.env.VITE_ENABLE_MOCK !== 'false' && import.meta.env.DEV)

async function bootstrap() {
  if (MOCK_ENABLED) {
    const { startMockServer } = await import('./mock')
    await startMockServer() // 生产构建里这段会被整块摇掉
  }
  // ...挂载 React
}
```

生产构建默认就是关闭的。只有本机开发时需要显式 `VITE_ENABLE_MOCK=false`。

## 3. 接入鉴权

默认实现**永远拒绝**登录（不内置任何演示口令后门）。换成真实接口只需替换 adapter：

```ts
// src/main.tsx
import { configureAuthAdapter } from './core/auth-store'
import { api } from './core/http'

configureAuthAdapter({
  login: async (email, password) => {
    const res = await api.post<{ token: string; user: CurrentUser }>(
      '/auth/login',
      { email, password },
      { anonymous: true }, // 登录请求不带旧 token
    )
    return res // { token, user } → store 自动持久化到 localStorage
  },
})
```

后端返回：

```jsonc
// POST /auth/login → 200
{
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
      "permissions": ["user:read", "user:write", "order:read"],
    },
  },
}
```

`permissions` 里的 `"*"` 表示超级管理员，`hasPermission()` 全部放行。

登录成功后自动发生这些事（无需自己实现）：

- token 与 user 写入 `localStorage: nexus-auth`，刷新不掉登录
- 每个请求自动带 `Authorization: Bearer` 与 `X-Trace-Id`
- 接口返回 401 时聚合成一次登出 + 提示 + 跳登录
- 侧栏菜单、路由守卫、按钮禁用同时按 `permissions` 生效

## 4. 人机验证（Cloudflare Turnstile）

登录页已经内置 Turnstile 组件（`src/components/turnstile-widget.tsx`）。
它只负责拿到一次性票据，**判定必须在你的后端完成** —— 这条边界不能挪。

### 出现时机：点「登录」才开始

组件用 `execution: 'execute'` 渲染，挂载后**不会自己运行**，也不占任何布局：
表单在提交前与没接入验证时长得一模一样（登录按钮与输入框的间距不变）。
用户点登录时才 `execute()` 出题，顺利通过时全程不闪；需要点一下才展开挑战。

```tsx
// src/pages/login-page.tsx（已接好）
<TurnstileWidget runKey={captchaRun} onVerify={setToken} onExpire={() => setToken(null)} />

// 提交时
setCaptchaRun((n) => n + 1)          // 「现在开始验证」
const ticket = await waitForCaptchaToken()
```

### 前端：把票据带进登录请求

```ts
// src/main.tsx
configureAuthAdapter({
  login: async (email, password, options) => {
    const res = await api.post<{ token: string; user: CurrentUser }>(
      '/auth/login',
      {
        email,
        password,
        'cf-turnstile-response': options?.captchaToken, // 字段名与官方约定一致
      },
      { anonymous: true },
    )
    return res
  },
})
```

登录页已经把票据塞进 `login(email, password, { captchaToken })` 的第三个参数；
失败后旧票据即作废，下次点登录会重新出题（token 一次性，复用必被上游判重）。

### 后端：siteverify 四项判定

```js
// 登录 handler 里，原有逻辑之前
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

// 2) 服务端调 siteverify —— 绝对不能从浏览器调
let result
try {
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(10_000),
    body: new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET,
      response: token,
      remoteip: req.ip,
    }),
  })
  if (!r.ok) throw new Error('siteverify ' + r.status)
  result = await r.json()
} catch {
  // 上游不可达 → 失败关闭，不放行
  return res.status(403).json({ code: 403, message: '人机验证服务不可用' })
}

// 3) success / action / hostname 三项全过
if (!result.success) {
  return res
    .status(403)
    .json({ code: 403, message: '人机验证未通过', detail: result['error-codes'] })
}
if (result.action !== EXPECTED_ACTION) {
  return res.status(403).json({ code: 403, message: 'action 不匹配' })
}
if (!EXPECTED_HOSTNAMES.has(result.hostname)) {
  return res.status(403).json({ code: 403, message: '来源域名不在白名单' })
}

// 4) 通过 → 继续原有登录逻辑
```

### 环境变量

```bash
# 后端（不带 VITE_ 前缀，永远不进浏览器包）
TURNSTILE_SECRET=<Cloudflare 控制台 → Turnstile → 组件 → Secret Key>
TURNSTILE_HOSTNAMES=admin.your-domain.com

# 前端（公开值）
VITE_TURNSTILE_SITE_KEY=0x4AAAAAAF1Fc2tsbu8bVO-a
# 只想由后端兜底时可关掉前端拦截
# VITE_TURNSTILE_ENFORCE=false
```

### 三条容易踩的坑

1. **secret 不能进浏览器**：任何 `VITE_*` 都会被打进产物，等于公开 secret。
2. **失败必须关闭**：上游超时 / 5xx 一律拒绝，不能「验证服务挂了就先放行」。
3. **本地一直 pending / 报 `600010`、`110200`**：组件的 Hostname Management 里没有
   `localhost` 与 `127.0.0.1`。加上即可；只想验证前端接线时，可临时用官方测试 key
   `1x00000000000000000000AA`（永远通过，票据恒为 `XXXX.DUMMY.TOKEN.XXXX`）。

> 演示构建（Mock 开启）自动使用官方测试 key：模板没有后端，票据不会被兑换，
> 用正式 key 会让登录被一张永远到不了的票据卡死。生产构建固定用正式 key。

## 5. 响应契约

`http.ts` 同时兼容两种风格：

```jsonc
// 风格 A：包裹式（推荐，能带 code / message / traceId）
{ "code": 0, "message": "ok", "data": { "items": [], "total": 0 } }

// 风格 B：裸数据
{ "items": [], "total": 0 }

// 错误：用 HTTP 状态码 + 同一结构
{ "code": 422, "message": "邮箱已被占用", "traceId": "trace_9f2a3b1c" }
```

列表参数约定（前端已按此发请求）：`page`（从 1 开始）、`pageSize`、`keyword`、`sortBy`、`sortOrder(asc|desc)`。

开发期建议补一层运行时校验（只在开发环境加载，生产包不含 zod）：

```ts
// src/services/schemas.ts
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['super_admin', 'admin', 'operator', 'auditor', 'viewer']),
  status: z.enum(['active', 'invited', 'disabled', 'locked']),
  permissions: z.array(z.string()),
})
```

字段改名时会当场抛「接口响应结构不符：/users」，而不是渲染出 `undefined`。

## 6. 页面代码不动

数据访问集中在 `src/services/queries.ts`，页面只调用 hook：

```ts
export function useUsers(params: UserListParams = {}) {
  return useQuery({
    queryKey: queryKeys.users(params),
    queryFn: ({ signal }) =>
      api.get<PageResult<User>>('/users', {
        params: params as Record<string, string | number>,
        signal, // 参数变化 / 卸载时真正中断在途请求
        schema: devSchema((m) => m.userPageSchema),
      }),
    placeholderData: (prev) => prev, // 翻页时保留旧数据，不闪白
  })
}
```

后端字段风格不同？在**这一层**映射，页面不受影响：

```ts
const toUser = (dto: ApiUser): User => ({ ...dto, role: dto.roleCode })
```

推荐逐模块替换：`users → orders → content → audit → overview`，每换一个都能独立验证。

## 7. 权限两端一致

清单里声明的权限码同时驱动三处：

```ts
// module.ts
nav: [{ key: 'users', path: '/business/users', permission: 'user:read' }]
routes: [{ path: '/business/users', permission: 'user:read', component: ... }]

// 按钮级
const { hasPermission } = useAuthStore()
{hasPermission('user:write') && <Button>新建用户</Button>}
```

- 菜单：无权限则不渲染（`filterNav`）
- 路由：直达 URL 也会被拦到 403，并说明缺哪个码
- 按钮：写操作自己判一次

## 8. 拦截器

```ts
import { addRequestInterceptor, addErrorHandler, addResponseInterceptor } from '@/core/http'

// 多租户头
addRequestInterceptor((config) => ({
  ...config,
  headers: { ...config.headers, 'X-Tenant-Id': tenantId },
}))

// 统计耗时
addResponseInterceptor((response, config) => {
  metrics.observe(config.baseURL, response.status)
})

// 上报错误
addErrorHandler((error) => Sentry.captureException(error))
```

`addXxx` 都返回注销函数；调用方要清理，避免 StrictMode / HMR 重复注册。

## 9. 错误处理

```ts
// 某个请求自己处理错误，不弹全局 toast
await api.get('/users', { silent: true })

// 需要把后端 detail 映射到表单字段
import { ApiError } from '@/core/http'
try {
  await api.post('/orders', payload)
} catch (error) {
  if (error instanceof ApiError && error.code === 422) setFieldErrors(parseDetail(error.detail))
  else throw error
}

// 超时默认 15s，可单独指定
await api.get('/reports/export', { timeout: 60_000 })
```

401 交给全局处理器（清登录态 + 跳登录）；403 交给路由守卫渲染说明页。

## 10. 跨域与部署

**本地开发代理**（彻底避开 CORS）：

```ts
// apps/admin/vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:8080',
      changeOrigin: true,
      // 后端本身没有 /api 前缀时：
      // rewrite: (path) => path.replace(/^\/api/, ''),
    },
  },
}
```

**生产 Nginx**（同源部署最省心）：

```nginx
server {
  listen 80;
  server_name admin.your-domain.com;
  root /usr/share/nginx/html;   # apps/admin/dist
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;   # SPA 路由回退，漏了会 404
  }

  location /api/ {
    proxy_pass http://127.0.0.1:8080/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Trace-Id $request_id;
  }
}
```

**确实要跨域**时后端需放行：

```
Access-Control-Allow-Origin: https://admin.your-domain.com
Access-Control-Allow-Headers: Authorization, Content-Type, X-Trace-Id
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
```

`Allow-Origin` 不能是 `*`，否则带 Authorization 的请求会被浏览器拒绝。

## 11. 自查清单

1. `.env.local` 配好 `VITE_API_BASE`
2. 生产环境关闭 `VITE_ENABLE_MOCK`
3. `configureAuthAdapter` 指向真实登录接口
4. 登录返回 `{ token, user.permissions }`
5. 后端用 siteverify 校验 `cf-turnstile-response`，断言 `success` / `action` / `hostname` 三项
6. `TURNSTILE_SECRET` 只在服务端环境变量；`TURNSTILE_HOSTNAMES` 不含 `localhost`
7. 列表接口支持 `page / pageSize / keyword / sortBy / sortOrder`
8. 错误响应统一 `{ code, message, traceId }`
9. 401 前端统一登出，403 由权限守卫处理
10. 跨域时放行 `Authorization` 与 `X-Trace-Id`，正确响应 OPTIONS
11. 逐模块替换：users → orders → content → audit → overview
12. 一切正常后删除 `src/mock` 目录
