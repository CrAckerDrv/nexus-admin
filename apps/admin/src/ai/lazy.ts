/**
 * AI 助手的按需加载
 *
 * 背景（实测数据见 `docs/OPTIMIZATION-BACKLOG.md` 第 3 节）：
 * 打开一张纯表格页也会下载 `assistant` + `session-list` + `page-renderer` + `ai-sdk`，
 * 因为 `app-shell` 静态引了 `AssistantPanel`、`main.tsx` 静态引了 `bootstrapAssistant`
 * 与 `api-operations` —— SDK 内核因此进了入口 chunk，且**每个页面**都要付一次。
 *
 * 现在的约定：
 * - `main.tsx` 只注入路由跳转回调，**完全不引用 `@/ai`**
 * - 顶栏入口按钮只订阅 `status-store` 的一个布尔值（零 SDK 依赖）
 * - 第一次真正需要用助手时（点开抽屉 / 进入工作台）才 `import('./index')`，
 *   而 `./index` 在模块求值末尾自动装配一次
 * - 接口清单 `./api-operations` 必须在装配**之前**执行（它在模块顶部注册接口），
 *   由 `loadAssistant()` 保证顺序
 *
 * 这个模块本身**不含任何** `@nexus/ai-sdk` 的静态引用 —— 否则按需加载就白做了。
 */

/**
 * `typeof import('./index')` 的类型标注会被 `consistent-type-imports` 判为
 * 「应该用 import type」；但这里**不能**写 `import type` ——
 * 那会把 `./index` 拉回静态依赖图，AI 就又被每页加载了。
 * 保持 `import()` 形式的类型查询（它是类型层的，不会产生运行时 import）。
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type AssistantModule = typeof import('./index')

/** 路由跳转回调：由 `main.tsx` 注入（助手要能「生成完页面后跳过去」） */
let navigateRef: (path: string) => void = () => {}

export function setAssistantNavigate(navigate: (path: string) => void): void {
  navigateRef = navigate
}

/** 供 `@/ai/index.ts` 在自装配时取用 */
export function getAssistantNavigate(): (path: string) => void {
  return navigateRef
}

let loading: Promise<AssistantModule> | null = null

/**
 * 加载并装配助手（幂等）
 *
 * 顺序很重要：`api-operations` 在**模块求值时**就注册接口清单，
 * 必须等它执行完再 `bootstrapAssistant` —— 否则助手首帧会认为「没有任何接口可调」。
 */
export function loadAssistant(): Promise<AssistantModule> {
  loading ??= (async () => {
    const [mod] = await Promise.all([import('./index'), import('./api-operations')])
    mod.ensureAssistant()
    return mod
  })()
  return loading
}

/** 是否已经发起过加载（供同步判断用，不触发加载） */
export function isAssistantLoaded(): boolean {
  return loading !== null
}
