import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import './styles/globals.css'
import { queryClient } from './core/query-client'
import { MOCK_ENABLED } from './core/env-mode'
import { router } from './router'
import { Toaster } from '@nexus/ui'
import { setAssistantNavigate } from './ai/lazy'
import { bootLocale } from './i18n'
import { useUiStore } from './core/ui-store'
import { installVitals } from './core/vitals'

/**
 * 演示数据开关
 *
 * 只有显式开启时才会下载并执行 Mock 层：
 * - 开发环境默认开启
 * - 生产环境默认关闭 —— 否则演示账号（含明文口令）与全量假数据会随包发布，
 *   这是「删一行代码才安全」的反模式
 * - 演示站构建时用 `VITE_ENABLE_MOCK=true` 重新打开
 *
 * 判断本身在 `core/env-mode.ts`：登录页的「人机验证用哪把 site key」
 * 读的是同一个常量 —— 两处各写一份迟早会漂移（演示站开着 Mock
 * 却用了要求真后端的正式 key，登录就被卡死）。
 */
async function bootstrap() {
  if (MOCK_ENABLED) {
    // 动态 import：独立 chunk，生产构建里这段代码可被完整 tree-shake
    const { startMockServer } = await import('./mock')
    await startMockServer()
  }

  /**
   * 英文用户立刻预取词典
   *
   * `zh.ts` 是静态的（默认语言），`en.ts` 走动态 import ——
   * 上一轮实测两份字典都进了入口（各 ~8~9 kB gzip），中文用户永远用不到英文那份。
   * 这里按「上一次选的语言」决定要不要现在拉，切换语言时 `useI18n` 也会预取。
   */
  bootLocale(useUiStore.getState().locale)

  /**
   * AI 助手：只注入跳转回调，**不触发装配**
   *
   * 装配改由「谁先用到谁触发」：点开抽屉（`loadAssistant`）、进助手工作台、
   * 或渲染生成页（`useAssistantSnapshot` 内部会 `ensureAssistant`）。
   * 这样打开一张普通表格页时，AI 相关 chunk 与 SDK 内核完全不下发 ——
   * 见 `docs/OPTIMIZATION-BACKLOG.md` 第 3 节。
   */
  setAssistantNavigate((path) => void router.navigate({ to: path as never }))

  // 真实用户监控：只采三项 Core Web Vitals，匿名上报，失败静默
  installVitals()

  const container = document.getElementById('root')
  if (!container) throw new Error('缺少 #root 容器')

  createRoot(container).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </StrictMode>,
  )
}

void bootstrap()
