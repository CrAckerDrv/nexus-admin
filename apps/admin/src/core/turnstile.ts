/**
 * Cloudflare Turnstile · 前端内核
 *
 * 职责边界（这是前端模板，**不含任何服务端实现**）：
 * - 这里只负责：加载脚本、渲染组件、拿到一次性 token、重置 token
 * - 判定「是不是真人」必须发生在你的后端：拿 token 调
 *   `https://challenges.cloudflare.com/turnstile/v0/siteverify`，
 *   校验 `success` / `action` / `hostname` 三项。
 * - **绝不能在浏览器里调 siteverify**：secret 一旦进包就等于公开，
 *   任何人都能自己伪造通过结果，验证会退化成装饰。
 *   参考实现见 `docs/guide/backend.md` 的「4. 人机验证（Turnstile）」，
 *   应用内的 `/guide/backend` 有同一份带复制的教程。
 *
 * token 生命周期（官方硬性约束）：
 * - `cf-turnstile-response` **一次性**，兑换过一次就失效；
 * - 登录成功后页面跳走，无需处理；
 * - 登录失败 / 停留在本页重试时，**必须** `reset()` 换一张新票据，
 *   否则第二次提交一定被判 `timeout-or-duplicate`。
 *
 * 为什么用 `render=explicit`：
 * 隐式渲染靠扫描 `.cf-turnstile` 节点，与 React 的挂载时机、StrictMode 的
 * 双次执行都会打架（组件被移除后 Cloudflare 仍持有旧节点引用）。
 * 显式渲染把「何时创建 / 何时销毁」完全交给我们。
 */

import { MOCK_ENABLED } from './env-mode'

/** 官方脚本地址；`?render=explicit` 表示由我们调用 `render()` */
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

/** 已在 Cloudflare 控制台创建好的组件 site key */
export const DEFAULT_SITE_KEY = '0x4AAAAAAF1Fc2tsbu8bVO-a'

/**
 * Cloudflare 官方「永远通过」测试 key
 *
 * 只用于没有真实后端的演示态：正式 key 要求「请求域名在该组件的域名列表里」，
 * 演示站（含自定义域名、内网预览地址）不可能一一登记，会永远停在 pending，
 * 结果是登录按钮被一个永远到不了的 token 按死。测试 key 没有域名限制。
 *
 * 它的 token 恒为 `XXXX.DUMMY.TOKEN.XXXX`，因此**只在演示态兜底**，
 * 生产构建永远走正式 key（见 `getTurnstileSiteKey`）。
 */
export const ALWAYS_PASS_TEST_SITE_KEY = '1x00000000000000000000AA'

/**
 * 当前该用哪个 site key
 *
 * 优先级：`VITE_TURNSTILE_SITE_KEY` 显式覆盖 > 演示态测试 key > 正式 key。
 *
 * 为什么演示态要换成测试 key：
 * 这个模板默认没有后端（Mock 拦截 fetch），票据根本不会被兑换；
 * 而正式 key 要求「当前域名在该组件的 Hostname Management 里」，
 * 演示站的自定义域名、内网预览地址不可能一一登记，widget 会长期停在 pending，
 * 结果是登录按钮被一张永远到不了的票据按死 —— 演示站原地失去登录能力。
 *
 * 想在本机验证正式 key（需先把 localhost / 127.0.0.1 加进组件域名列表）：
 * `.env.local` 里写 `VITE_TURNSTILE_SITE_KEY=0x4AAAAAA...` 即可。
 *
 * @param overrides.mock 仅供单测注入「是否为演示态」，运行期不要传
 */
export function getTurnstileSiteKey(overrides: { mock?: boolean } = {}): string {
  const override = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim()
  if (override) return override
  return (overrides.mock ?? MOCK_ENABLED) ? ALWAYS_PASS_TEST_SITE_KEY : DEFAULT_SITE_KEY
}

/**
 * 是否在前端拦截提交
 *
 * 注意这**不是**安全边界：真正的判定在你的后端（siteverify）。
 * 这里只为「没通过时别把请求发出去」，省一次必然失败的往返，并给用户即时反馈。
 * 后端接好之后，即使有人绕过前端直接打登录接口，仍然会被服务端拒掉。
 *
 * 默认开启；演示态用测试 key（秒过），因此不会卡住演示。
 * 显式 `VITE_TURNSTILE_ENFORCE=false` 可关掉前端拦截（联调阶段常用）。
 */
export const TURNSTILE_ENFORCE = import.meta.env.VITE_TURNSTILE_ENFORCE !== 'false'

/** 受保护动作名：必须与后端 siteverify 里断言的 `action` 一致 */
export const TURNSTILE_ACTION = 'login'

export type TurnstileTheme = 'auto' | 'light' | 'dark'
export type TurnstileSize = 'normal' | 'compact' | 'flexible'

export interface TurnstileRenderOptions {
  sitekey: string
  action?: string
  theme?: TurnstileTheme
  language?: string
  size?: TurnstileSize
  appearance?: 'always' | 'execute' | 'interaction-only'
  execution?: 'render' | 'execute'
  retry?: 'auto' | 'never'
  callback?: (token: string) => void
  'error-callback'?: (code: string) => void
  'expired-callback'?: () => void
  'timeout-callback'?: () => void
  'before-interactive-callback'?: () => void
  'after-interactive-callback'?: () => void
  'unsupported-callback'?: () => void
}

export interface TurnstileApi {
  render: (container: HTMLElement | string, options: TurnstileRenderOptions) => string | undefined
  reset: (widgetId?: string) => void
  remove: (widgetId?: string) => void
  execute: (widgetId?: string) => void
  getResponse: (widgetId?: string) => string | undefined
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

/** 脚本加载结果：只加载一次；失败时置空，允许下次挂载重试 */
let scriptPromise: Promise<TurnstileApi> | null = null

/** 脚本 onload 到 `window.turnstile` 可用之间有一个极短的空窗 */
function waitForApi(timeoutMs = 12_000): Promise<TurnstileApi> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      const api = window.turnstile
      if (api) return resolve(api)
      if (Date.now() - started > timeoutMs) return reject(new Error('Turnstile 初始化超时'))
      setTimeout(tick, 50)
    }
    tick()
  })
}

function loadScript(): Promise<TurnstileApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Turnstile 只能在浏览器里加载'))
  }
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    // 已有标签（HMR / 重复挂载）：等它就绪，重复插入会让 Cloudflare 二次初始化
    if (document.querySelector('script[data-nexus-turnstile]')) {
      waitForApi().then(resolve, reject)
      return
    }

    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.dataset.nexusTurnstile = 'true'
    script.addEventListener('load', () => {
      waitForApi().then(resolve, reject)
    })
    script.addEventListener('error', () => {
      script.remove()
      // 内网抖动、拦截插件临时放行都能自愈
      scriptPromise = null
      reject(new Error('Turnstile 脚本加载失败'))
    })
    document.head.appendChild(script)
  })

  return scriptPromise
}

/**
 * 预加载
 *
 * 登录页首屏就把脚本拉下来，别等用户点提交才下载（那是首屏之外最关键的空窗）。
 * 失败保持静默：真正渲染时组件内会给出可见的错误与重试入口。
 */
export function preloadTurnstile(): void {
  void loadScript().catch(() => {})
}

/**
 * 渲染一个组件实例
 *
 * @returns widgetId（Cloudflare 未返回时为空串，此时只能整体重建）
 */
export async function renderTurnstile(
  container: HTMLElement,
  options: TurnstileRenderOptions,
): Promise<string> {
  const api = await loadScript()
  return api.render(container, options) ?? ''
}

/** 重置：立即作废旧票据并按同一套参数重新出题（重试前必须调用） */
export async function resetTurnstile(widgetId: string): Promise<void> {
  if (!widgetId) return
  const api = await loadScript()
  api.reset(widgetId)
}

/**
 * 执行一次验证
 *
 * 仅当渲染时用了 `execution: 'execute'` 才有意义：
 * 该模式下组件挂载后**不会自己跑**，要等我们显式调用 execute。
 * 登录页正是靠它做到「点了登录才开始验证」—— 表单在提交前完全不碰网络、
 * 不显示任何占位，登录按钮与输入框的间距与接入验证之前一模一样。
 */
export async function executeTurnstile(widgetId: string): Promise<void> {
  if (!widgetId) return
  const api = await loadScript()
  api.execute(widgetId)
}

/** 销毁：组件卸载 / sitekey 变化时调用，避免 Cloudflare 侧泄漏实例 */
export async function removeTurnstile(widgetId: string): Promise<void> {
  if (!widgetId) return
  try {
    const api = await loadScript()
    api.remove(widgetId)
  } catch {
    // 节点已脱离文档 / 脚本没加载成功时无需销毁，也不该把卸载流程搞崩
  }
}
