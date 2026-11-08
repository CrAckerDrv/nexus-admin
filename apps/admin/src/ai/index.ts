import { useSyncExternalStore } from 'react'
import {
  configureAssistant,
  configureAssistantApiExecutor,
  createOpenAICompatibleTransport,
  getAssistant,
  type AssistantApiResult,
  type AssistantConfig,
  type AssistantSnapshot,
  type PageSpec,
} from '@nexus/ai-sdk'
import { api, type ApiError } from '@/core/http'
import { useUiStore } from '@/core/ui-store'
import { createHistoryPort } from './history-store'
import { getAssistantNavigate } from './lazy'
import { latestPage, useGeneratedPages } from './page-store'
import { setAssistantBusy } from './status-store'

/**
 * 助手装配（应用侧）
 *
 * SDK 不认识路由、localStorage、core/http —— 这些都在这里注入。
 * 换后端 / 换模型都只改本文件，`@nexus/ai-sdk` 保持零应用依赖。
 */

/* ------------------------------------------------------------------ *
 * 传输层配置
 * ------------------------------------------------------------------ */

/**
 * 走同源 `/ai-gateway`：
 * - 开发态由 `vite.config.ts` 的中间件转发（`pnpm dev` 一条命令）
 * - 生产态由 `scripts/ai-gateway.mjs` 或你自己的 BFF 承担
 *
 * 网关内部维护供应商回退链（OpenCode → 自定义 → 免密钥通道），
 * 前端只认一个地址、一个协议：`POST /ai-gateway/chat/completions`。
 *
 * 为什么不直连模型厂商：
 * 1. 密钥绝不能进浏览器包（`VITE_*` 会被打进产物）
 * 2. 各家的 CORS / 鉴权 / 限流策略不同，收敛在服务端只需维护一处
 */
export const AI_GATEWAY_URL =
  (import.meta.env.VITE_AI_BASE_URL as string | undefined) ?? '/ai-gateway'

/** 兜底模型名：真实模型由网关按供应商决定，这里只用于「网关不可达」时的展示 */
export const AI_MODEL =
  (import.meta.env.VITE_AI_MODEL as string | undefined) ?? 'deepseek-v4.1-flash-free'

/** `/ai-gateway/health` 的结构（服务端返回 `ok`，前端统一收敛成 `ready`） */
interface GatewayHealthPayload {
  ok?: boolean
  ready?: boolean
  provider?: string | null
  providers?: Array<{ id: string; label: string; model: string; keyless?: boolean }>
  model?: string | null
  maxToolRounds?: number
  note?: string | null
  reason?: string | null
}

interface GatewayInfo {
  ready: boolean
  provider?: string | null
  providers?: Array<{ id: string; label: string; model: string; keyless?: boolean }>
  model?: string | null
  maxToolRounds?: number
  note?: string | null
  reason?: string | null
}

/** 会话 id：同一标签页稳定复用，便于网关做粘性路由与提示缓存 */
function sessionId(): string {
  if (typeof window === 'undefined') return 'ses_server'
  const key = 'nexus-ai-session'
  const existing = window.sessionStorage.getItem(key)
  if (existing) return existing
  const created = `ses_${Math.random().toString(36).slice(2, 12)}`
  window.sessionStorage.setItem(key, created)
  return created
}

/**
 * 网关探活
 *
 * 返回「当前用哪家供应商、哪个模型、允许几轮工具调用」——
 * 这些都由服务端决定，前端不猜。缓存一次结果，避免每次开面板都打一遍。
 */
let gatewayProbe: Promise<GatewayInfo> | null = null

async function probeGateway(): Promise<GatewayInfo> {
  gatewayProbe ??= fetch(`${AI_GATEWAY_URL}/health`, { method: 'GET' })
    .then(async (response) => {
      if (!response.ok) {
        return { ready: false, reason: `网关健康检查返回 ${response.status}` }
      }
      const payload = (await response.json().catch(() => null)) as GatewayHealthPayload | null
      if (!payload) return { ready: false, reason: '网关健康检查返回了非 JSON 内容' }
      // 服务端字段是 `ok`，这里必须显式映射：
      // 直接把它当 `ready` 读会让 `undefined` 一路走到「判定为不可用」的分支，
      // 表现为「网关明明能用，界面却一直显示本地引擎」
      return { ...payload, ready: (payload.ready ?? payload.ok) === true }
    })
    .catch(() => ({ ready: false, reason: '网关未启动（/ai-gateway 无响应）' }))
  return gatewayProbe
}

/** 由探活结果构造传输层：模型名与标题都跟着服务端走 */
function transportFrom(info: GatewayInfo) {
  const provider = info.providers?.find((item) => item.id === info.provider) ?? info.providers?.[0]
  return createOpenAICompatibleTransport({
    id: provider?.id ?? 'gateway',
    label: provider?.label ?? 'AI 网关',
    baseUrl: AI_GATEWAY_URL,
    model: provider?.model ?? info.model ?? AI_MODEL,
    sessionId: sessionId(),
  })
}

/* ------------------------------------------------------------------ *
 * 接口执行器：默认接到 core/http
 * ------------------------------------------------------------------ */

function attachExecutor() {
  configureAssistantApiExecutor(async (operation, input) => {
    const startedAt = performance.now()
    try {
      const params = Object.fromEntries(
        Object.entries(operation.params ?? {}).filter(
          ([, value]) => value !== undefined && value !== null && value !== '',
        ),
      ) as Record<string, string | number | boolean>
      const body = operation.body as Record<string, unknown> | undefined
      let data: unknown
      switch (operation.method.toUpperCase()) {
        case 'POST':
          data = await api.post(operation.path, body ?? input)
          break
        case 'PUT':
          data = await api.put(operation.path, body ?? input)
          break
        case 'PATCH':
          data = await api.patch(operation.path, body ?? input)
          break
        case 'DELETE':
          data = await api.delete(operation.path)
          break
        default:
          data = await api.get(operation.path, { params })
      }
      return {
        ok: true,
        data,
        status: 200,
        elapsedMs: Math.round(performance.now() - startedAt),
      } satisfies AssistantApiResult
    } catch (error) {
      const apiError = error as ApiError
      return {
        ok: false,
        status: apiError.code,
        error: apiError.message ?? String(error),
        elapsedMs: Math.round(performance.now() - startedAt),
      } satisfies AssistantApiResult
    }
  })
}

/* ------------------------------------------------------------------ *
 * 页面落地端口
 * ------------------------------------------------------------------ */

function pagesPort(navigate: (path: string) => void) {
  return {
    save: (page: PageSpec) => useGeneratedPages.getState().save(page),
    apply: (page: PageSpec) => useGeneratedPages.getState().apply(page),
    open: (path: string) => navigate(path),
    isApplied: (id: string) => useGeneratedPages.getState().isApplied(id),
  }
}

/* ------------------------------------------------------------------ *
 * 单例装配
 * ------------------------------------------------------------------ */

let booted = false

/**
 * 确保助手已装配（幂等）
 *
 * 与旧版的差别：**不再由 `main.tsx` 主动调用**。
 * `main.tsx` 现在完全不引用 `@/ai`（见 `ai/lazy.ts` 的说明），
 * 因此「谁来触发第一次装配」变成：任何真正 import 了本模块的代码 ——
 * 可能是点开了抽屉（`loadAssistant()`）、进入了助手工作台、或访问了生成页。
 *
 * 这些入口都在本文件末尾统一调 `ensureAssistant()`，装配参数（路由跳转回调）由
 * `./lazy` 的 `getAssistantNavigate()` 提供（值由 `main.tsx` 在启动时写入）。
 */
export function ensureAssistant(): void {
  bootstrapAssistant(getAssistantNavigate())
}

/**
 * 启动助手（幂等）
 *
 * 分两段：
 * 1. **同步**装配内核（页面库 / 执行器 / 历史），保证首次点击就有响应；
 * 2. **异步**探活网关，拿到供应商与模型后再挂传输层 ——
 *    探活只是本地请求，通常几毫秒，期间界面显示「本地引擎」不算误导。
 */
export function bootstrapAssistant(navigate: (path: string) => void): void {
  const base: AssistantConfig = {
    locale: () => useUiStore.getState().locale,
    navigate,
    pages: pagesPort(navigate),
    // 多会话：历史落 localStorage（由 history-store 的 persist 负责），
    // 内核只在「一轮对话结束」时调用 save，不会写爆存储
    history: createHistoryPort(),
  }

  if (booted) {
    getAssistant().configure(base)
    return
  }
  booted = true
  attachExecutor()

  const assistant = configureAssistant(base)
  const { pages, appliedIds } = useGeneratedPages.getState()
  assistant.syncApplied(appliedIds)
  // 刷新后会话是空的，但「当前页面」应当还原：
  // 否则用户还得重新生成一遍，才能说「把主色改成紫色」
  assistant.restorePage(latestPage(pages))
  // 页面库变化时同步「已应用」状态，保证按钮文案与侧边栏一致
  useGeneratedPages.subscribe((state) => {
    getAssistant().syncApplied(state.appliedIds)
    getAssistant().restorePage(latestPage(state.pages))
  })

  void probeGateway().then((info) => {
    if (!info.ready) {
      getAssistant().setFallbackReason(info.reason ?? '网关没有可用的模型供应商，已切换到本地引擎')
      return
    }
    getAssistant().configure({
      transport: transportFrom(info),
      // 免密钥通道有节流，服务端会把轮次压到 1；前端照做，不为第二次配额干等
      maxToolRounds: info.maxToolRounds ?? 3,
    })
    getAssistant().setFallbackReason(null)
    // 记下来源，界面上的「本地引擎 / 模型」角标据此显示
    lastGatewayNote = info.note ?? null
  })

  /**
   * 把「是否忙碌」同步给极轻量的 status-store
   *
   * 顶栏入口按钮订阅它来显示脉冲点。若按钮直接订阅整个快照，
   * 每次流式增量都会重渲染外壳，也会把 SDK 静态拉进入口 chunk。
   * 这里只在 phase 变化时通知，流式 token 不会穿透到这里。
   */
  const syncBusy = (snapshot: AssistantSnapshot) =>
    setAssistantBusy(snapshot.phase === 'thinking' || snapshot.phase === 'tool')
  syncBusy(assistant.getSnapshot())
  assistant.subscribe(() => syncBusy(getAssistant().getSnapshot()))
}

/** 网关附注（例如免密钥通道的节流说明），供界面提示 */
let lastGatewayNote: string | null = null
export function getGatewayNote(): string | null {
  return lastGatewayNote
}

/* ------------------------------------------------------------------ *
 * React 绑定
 * ------------------------------------------------------------------ */

const subscribe = (listener: () => void) => getAssistant().subscribe(listener)
const snapshot = () => getAssistant().getSnapshot()

/**
 * 订阅助手快照（内核是外部 store，用 useSyncExternalStore 保证一致性）
 *
 * 装配在**模块求值时**已经完成（见文件末尾的 `ensureAssistant()`）——
 * 不要在渲染期调用，那会在 `configure()` 里触发订阅者重渲染，
 * 形成「渲染 → configure → 通知 → 重渲染」的死循环（实测会让整页卡死）。
 */
export function useAssistantSnapshot(): AssistantSnapshot {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

export { getAssistant }
export type { AssistantSnapshot }

/* ------------------------------------------------------------------ *
 * 自动装配
 *
 * 本模块只会在「真正需要助手」的路径上被 import（抽屉懒加载、工作台、
 * 生成页、消息线程），因此在这里装配一次就够了：
 * - `main.tsx` 完全不引用 `@/ai`，打开普通页面不会加载本模块
 * - 接口清单 `./api-operations` 的注册是幂等的，晚到也会通过
 *   `registerAssistantApi` 里的 `singleton?.configure(...)` 补进单例
 *   （SDK 侧已处理，见 packages/ai-sdk/src/assistant.ts 的 apiRegistry）
 * ------------------------------------------------------------------ */
ensureAssistant()
