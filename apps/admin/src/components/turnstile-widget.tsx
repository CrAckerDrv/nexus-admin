import { useCallback, useEffect, useRef, useState } from 'react'
import { RotateCw, ShieldAlert } from 'lucide-react'
import { Button, cn } from '@nexus/ui'
import { useI18n } from '@/i18n'
import { useUiStore } from '@/core/ui-store'
import {
  TURNSTILE_ACTION,
  executeTurnstile,
  getTurnstileSiteKey,
  renderTurnstile,
  removeTurnstile,
  resetTurnstile,
} from '@/core/turnstile'

export interface TurnstileWidgetProps {
  /** 通过时拿到的一次性 token（`cf-turnstile-response`） */
  onVerify: (token: string) => void
  /** 票据过期 / 校验失败：父组件应清空已保存的 token */
  onExpire?: () => void
  /** 组件级错误（脚本被拦截、域名未配对等），code 是 Cloudflare 的错误码 */
  onError?: (code: string) => void
  /** 受保护动作名，必须与后端 siteverify 断言的 action 一致 */
  action?: string
  /** 覆盖 site key（默认读 `VITE_TURNSTILE_SITE_KEY`，演示态回退到官方测试 key） */
  siteKey?: string
  /**
   * 触发信号：每次 +1 表示「现在开始验证」
   *
   * 组件用 `execution: 'execute'` 渲染，本身**不会自动跑**。
   * 父组件在用户点提交时把它 +1，验证才开始 —— 这是「点了登录才出现」的机制。
   */
  runKey?: number
  /**
   * 呈现方式
   *
   * - `'on-demand'`（默认）：零占位。不需要交互时完全不可见、不占布局，
   *   需要交互时才展开到原位。登录页用这个 ——
   *   登录按钮与输入框的间距与接入验证之前一模一样。
   * - `'always'`：始终显示组件（65px 占位 + 自动验证）。
   */
  mode?: 'on-demand' | 'always'
  className?: string
}

/** `always` 模式下的占位高度：组件加载完成时不应把下方按钮顶下去 */
const MIN_HEIGHT = 65

type Status = 'loading' | 'ready' | 'error'

/**
 * Cloudflare Turnstile 人机验证
 *
 * 这是**纯前端**组件：只负责拿到 token，判定必须由你的后端完成
 * （浏览器里调 siteverify 等于把 secret 公开，见 `core/turnstile.ts` 顶部说明）。
 *
 * 默认 `mode="on-demand"`：挂载时既不运行也不占位，父组件把 `runKey` +1 才开始验证。
 *
 * @example
 * <TurnstileWidget runKey={captchaRun} onVerify={setToken} />
 */
export function TurnstileWidget({
  onVerify,
  onExpire,
  onError,
  action = TURNSTILE_ACTION,
  siteKey = getTurnstileSiteKey(),
  runKey = 0,
  mode = 'on-demand',
  className,
}: TurnstileWidgetProps) {
  const { t, locale } = useI18n()
  const resolvedTheme = useUiStore((state) => state.resolvedTheme)
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef('')
  const [status, setStatus] = useState<Status>('loading')
  const [failureCode, setFailureCode] = useState('')
  /** 重新渲染计数：脚本失败后点「重试」由它驱动 */
  const [attempt, setAttempt] = useState(0)
  /**
   * 是否正在展示挑战
   *
   * 只有 Cloudflare 明确要求交互时才展开，其余时间保持零占位。
   * 靠 `before-interactive-callback` / `after-interactive-callback` 驱动。
   */
  const [challenging, setChallenging] = useState(false)

  /**
   * 回调走 ref
   *
   * 父组件大概率传内联箭头函数，直接进依赖数组会让每次渲染都销毁重建组件 ——
   * 那等于把用户已经验证好的票据反复作废。
   */
  const handlers = useRef({ onVerify, onExpire, onError })
  handlers.current = { onVerify, onExpire, onError }

  /**
   * 已经处理过的触发信号
   *
   * 用户可能在组件还没渲染完成时就点了登录：此时 runKey 已变化，
   * 但 widgetId 还不存在。渲染完成的回调里会比对它，补跑一次 execute。
   *
   * 用两个 ref 而不是一个：`latest` 记录最新信号（在 effect 里同步，避免
   * 渲染期写 ref），`applied` 记录已经真正执行过的那个。
   */
  const latestRunRef = useRef(runKey)
  const appliedRunRef = useRef(runKey)

  /** 跑一次验证：先 reset 清掉旧票据，再 execute 出题 */
  const runWidget = useCallback(async (widgetId: string) => {
    if (!widgetId) return
    await resetTurnstile(widgetId).catch(() => {})
    await executeTurnstile(widgetId).catch(() => {})
  }, [])

  /** 把最新信号同步进 ref（effect 里写，渲染期不碰 ref） */
  useEffect(() => {
    latestRunRef.current = runKey
  }, [runKey])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    /**
     * 自己造一个宿主节点，交给 Cloudflare 独占
     *
     * 为什么不直接把 React 的 div 交给 `turnstile.render()`：
     * StrictMode 的「挂载 → 卸载 → 再挂载」拿到的是**同一个 DOM 节点**
     * （<StrictMode> 不重建 DOM，只重跑 effect）。Turnstile 会在容器上留标记，
     * 第二次 render 直接被拒，控制台报 "already been rendered in this container"，
     * 组件从此停在空壳状态 —— 票据永远出不来。
     *
     * 让每次 effect 都新建一个宿主节点、卸载时移除，标记随节点一起消失，
     * React 只负责外层的稳定容器，两者互不干扰。
     */
    const host = document.createElement('div')
    container.appendChild(host)

    let cancelled = false
    setStatus('loading')
    setFailureCode('')

    void renderTurnstile(host, {
      sitekey: siteKey,
      action,
      theme: resolvedTheme === 'dark' ? 'dark' : 'light',
      // Cloudflare 的语言标签是 `zh-cn` / `en-us` 小写形式；
      // 直接用 `zh-CN` 会被拒并回退到英文，这里统一折成小写。
      language: locale.toLowerCase(),
      size: 'flexible',
      appearance: 'interaction-only',
      // 关键：挂着但不自己跑。只有 execute() 被调用时才验证，
      // 于是表单在提交前完全不碰 Cloudflare，也不占任何布局。
      execution: mode === 'on-demand' ? 'execute' : 'render',
      retry: 'auto',
      callback: (token) => {
        if (cancelled) return
        setChallenging(false)
        handlers.current.onVerify(token)
      },
      'error-callback': (code) => {
        if (cancelled) return
        // 210 / 300-600 是 Cloudflare 的配置与网络类错误，值得把码展示出来
        setChallenging(true)
        setFailureCode(String(code ?? ''))
        setStatus('error')
        handlers.current.onError?.(String(code ?? ''))
      },
      'expired-callback': () => {
        if (cancelled) return
        setChallenging(false)
        handlers.current.onExpire?.()
      },
      'timeout-callback': () => {
        if (cancelled) return
        setChallenging(false)
        handlers.current.onExpire?.()
      },
      // 需要用户点一下时才展开位置；不需要交互的话全程零占位
      'before-interactive-callback': () => {
        if (!cancelled) setChallenging(true)
      },
      'after-interactive-callback': () => {
        if (!cancelled) setChallenging(false)
      },
    })
      .then((widgetId) => {
        if (cancelled) {
          // StrictMode 的第一次挂载：渲染完成时组件已经卸载了，
          // 实例仍登记在 Cloudflare 侧，必须回收，否则会持续报警告
          if (widgetId) void removeTurnstile(widgetId)
          return
        }
        widgetIdRef.current = widgetId
        setStatus('ready')
        // 渲染期间用户已经点过登录：补跑一次，别让第一次点击白点
        if (mode === 'on-demand' && latestRunRef.current !== appliedRunRef.current) {
          appliedRunRef.current = latestRunRef.current
          void runWidget(widgetId)
        }
      })
      .catch((error: Error) => {
        if (cancelled) return
        setFailureCode(error.message)
        setStatus('error')
        handlers.current.onError?.(error.message)
      })

    return () => {
      cancelled = true
      const widgetId = widgetIdRef.current
      widgetIdRef.current = ''
      if (widgetId) void removeTurnstile(widgetId)
      // 宿主节点整个丢掉：下次挂载是全新节点，不会撞上「已渲染过」
      host.remove()
    }
  }, [siteKey, action, resolvedTheme, locale, attempt, mode, runWidget])

  /** 父组件的触发信号：runKey 变化即开始一次新的验证 */
  useEffect(() => {
    if (mode !== 'on-demand') return
    if (runKey === appliedRunRef.current) return
    const widgetId = widgetIdRef.current
    // 还没渲染好：交给渲染完成的回调补跑（见上面的 .then）
    if (!widgetId) return
    appliedRunRef.current = runKey
    void runWidget(widgetId)
  }, [runKey, mode, runWidget])

  const retry = () => {
    // 整体重建：脚本加载阶段的失败没有 widgetId，reset 无从谈起
    const widgetId = widgetIdRef.current
    widgetIdRef.current = ''
    if (widgetId) void removeTurnstile(widgetId)
    setAttempt((value) => value + 1)
  }

  /** 只有「要展示挑战」或「已出错」时才占位 */
  const expanded = status === 'error' || challenging

  return (
    /**
     * 布局策略
     *
     * 登录表单是 `space-y-3.5`（14px 间距）的流式布局：任何一个多出来的
     * 兄弟节点都会把「登录」按钮往下顶 14px —— 用户会立刻发现按钮变远了。
     *
     * 所以未展开时用 `-mt-3.5 h-0` 把这 14px 与自身高度一起抵消，
     * 表单与没接入验证时完全一致；只有真正要出题了才解除抵消。
     */
    <div
      className={cn(
        'w-full',
        expanded ? 'mt-0' : '-mt-3.5 h-0',
        className,
      )}
    >
      <div
        ref={containerRef}
        role="group"
        aria-label={t('captcha.label')}
        aria-busy={status === 'loading' || undefined}
        style={mode === 'always' ? { minHeight: MIN_HEIGHT } : undefined}
        className={cn('flex items-center justify-start', status === 'error' && 'hidden')}
      />

      {status === 'error' ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-md border border-danger/25 bg-danger-weak/60 px-2.5 py-2"
        >
          <span className="flex min-w-0 items-center gap-1.5 text-2xs text-danger">
            <ShieldAlert className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {t('captcha.loadFailed')}
              {failureCode ? `（${failureCode}）` : ''}
            </span>
          </span>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RotateCw className="size-3" />}
            onClick={retry}
          >
            {t('captcha.retry')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
