import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Boxes,
  ChevronRight,
  CircleQuestionMark,
  Command,
  Heart,
  Layers,
  LoaderCircle,
  Lock,
  Mail,
  MoonStar,
  ShieldAlert,
  Sparkles,
  SunMedium,
  Zap,
} from 'lucide-react'
import { Button, Input, Kbd, Switch, Tooltip, cn, toast } from '@nexus/ui'
import { useAuthStore } from '@/core/auth-store'
import { useUiStore } from '@/core/ui-store'
import { originFromElement, runThemeTransition } from '@/core/theme-transition'
import { TURNSTILE_ENFORCE, preloadTurnstile } from '@/core/turnstile'
import { validateLoginForm } from '@/services/validators'
import { GithubIcon, NexusMark } from '@/components/brand-icons'
import { LoginGrid } from '@/components/login-grid'
import { TurnstileWidget } from '@/components/turnstile-widget'
import { useI18n } from '@/i18n'

interface DemoAccountHint {
  email: string
  password: string
  label: string
  tone: 'primary' | 'success' | 'warning'
}

/**
 * 演示账号提示
 *
 * 只在开启 Mock 时动态加载 `mock/accounts`：
 * 生产构建里这段分支被常量折叠掉，既不会请求该 chunk，
 * 也不会把演示口令打进产物。
 */
function useDemoAccounts(): DemoAccountHint[] {
  const [accounts, setAccounts] = useState<DemoAccountHint[]>([])

  useEffect(() => {
    if (!import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCK !== 'true') return
    let cancelled = false
    void import('@/mock/accounts').then((module) => {
      if (cancelled) return
      setAccounts(
        module.DEMO_ACCOUNTS.map(({ email, password, label, tone }) => ({
          email,
          password,
          label,
          tone,
        })),
      )
    })
    return () => {
      cancelled = true
    }
  }, [])

  return accounts
}

/**
 * 登录页
 *
 * 布局：左侧品牌叙事（极光 + 视差网格 + 内核星座 + 装配链路 + 特性卡），
 * 右侧表单（含一键体验角色）。
 *
 * 左侧视觉层的实现约定：
 * - 只动 `transform` / `opacity` / CSS 变量，指针交互不触发 React 重渲染
 * - 前景内容始终在装饰层之上，文字对比度优先于「好看」
 * - 所有常驻动画统一受 `--lg-play` 开关控制（见 globals.css），
 *   系统或应用内开启「减少动效」时整体暂停，入场动画直接取消
 * - 深浅色切换复用顶栏同一套圆形扩散动画，圆心取按钮中心
 */
export function LoginPage() {
  // 默认留空：演示账号由下方「一键体验」按需填充，生产环境不预置任何凭据
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<Record<string, string>>({})
  /**
   * 「现在开始验证」信号
   *
   * 组件挂载后**不会自己跑**（`execution: 'execute'`）。
   * 用户点登录时把它 +1，验证才开始 —— 于是表单在提交前完全不占位置、
   * 不显示任何东西，登录按钮与输入框的间距与接入验证之前一模一样。
   */
  const [captchaRun, setCaptchaRun] = useState(0)
  /**
   * 人机验证的失败提示
   *
   * 只在**真的没拿到票**时出现（例如用户始终没完成交互式挑战）。
   * 「正在等待出票」不设独立提示：它通常只持续几百毫秒，
   * 交给登录按钮的 loading 转圈更安静，也不会让人误以为出错了。
   */
  const [captchaNotice, setCaptchaNotice] = useState<string | null>(null)
  /**
   * 票据的「最新值」镜像
   *
   * `submit()` 是事件回调，闭包里的 state 是点击那一刻的快照。
   * 而票据通常在几百毫秒后才由人机验证回调异步写入 ——
   * 用户手快一点就会读到 null。用 ref 保存最新值，再配合下面的
   * `waitForCaptchaToken()` 短暂等待，才能既不错判也不卡死。
   */
  const captchaTokenRef = useRef<string | null>(null)
  const captchaWaiters = useRef<Array<(token: string | null) => void>>([])

  const applyCaptchaToken = (token: string | null) => {
    captchaTokenRef.current = token
    if (token) {
      // 票据一到，把所有在等它的提交全部唤醒
      const waiters = captchaWaiters.current
      captchaWaiters.current = []
      waiters.forEach((resolve) => resolve(token))
    }
  }

  /**
   * 等待票据，最多 `timeoutMs`
   *
   * 演示态用的是「永远通过」测试 key，通常 1 秒内出票；
   * 真实环境遇到交互式挑战时用户需要手动点一下，这时等太久没有意义，
   * 超时后就提示「请先完成人机验证」，用户点完图标再提交。
   */
  const waitForCaptchaToken = (timeoutMs = 5000): Promise<string | null> => {
    if (captchaTokenRef.current) return Promise.resolve(captchaTokenRef.current)
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        captchaWaiters.current = captchaWaiters.current.filter((item) => item !== settle)
        resolve(null)
      }, timeoutMs)
      const settle = (token: string | null) => {
        clearTimeout(timer)
        resolve(token)
      }
      captchaWaiters.current.push(settle)
    })
  }
  const login = useAuthStore((state) => state.login)
  const resolvedTheme = useUiStore((state) => state.resolvedTheme)
  const setTheme = useUiStore((state) => state.setTheme)
  const themeBtnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const demoAccounts = useDemoAccounts()
  const { t, locale, setLocale, isEn } = useI18n()

  /** 首屏就预下载 Turnstile 脚本：别等用户点提交才走那几百毫秒空窗 */
  useEffect(() => {
    preloadTurnstile()
  }, [])

  /** 与顶栏一致：从按钮中心扩散出新主题，系统「减少动效」时自动压缩时长 */
  const toggleTheme = () => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark'
    runThemeTransition(
      () => setTheme(next),
      originFromElement(themeBtnRef.current),
      next === 'dark',
    )
  }

  /**
   * 指针视差
   *
   * 坐标写进 CSS 变量，由网格 / 光斑自行消费：一次 pointermove 只改两三个自定义属性，
   * 不触发 React 渲染，也不引起布局。触屏没有 hover 语义，直接跳过。
   */
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return
    const panel = panelRef.current
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    panel.style.setProperty('--lg-mx', ((event.clientX - rect.left) / rect.width).toFixed(4))
    panel.style.setProperty('--lg-my', ((event.clientY - rect.top) / rect.height).toFixed(4))
    panel.style.setProperty('--lg-on', '1')
  }

  const handlePointerLeave = () => {
    panelRef.current?.style.setProperty('--lg-on', '0')
  }

  /** 特性卡里的跟手聚光：同样只写变量，不用 setState */
  const handleFeatureMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const card = event.currentTarget
    const rect = card.getBoundingClientRect()
    card.style.setProperty('--spot-x', `${event.clientX - rect.left}px`)
    card.style.setProperty('--spot-y', `${event.clientY - rect.top}px`)
  }

  const submit = async () => {
    setError(null)
    setCaptchaNotice(null)
    const result = validateLoginForm({ email, password }, t)
    if (!result.ok) {
      setFieldError(result.errors as Record<string, string>)
      return
    }
    setFieldError({})

    /**
     * 从点击这一刻起就是「进行中」
     *
     * 等待人机验证出票同样属于「正在处理」，交给按钮自己的转圈表达即可 ——
     * 不再额外插一行「正在等待…」的文字：那句提示通常只闪几百毫秒，
     * 闪现的文字比转圈更吵，还容易被误读成错误。
     *
     * 只有**真的没通过**（等不到票）才补一行错误提示。
     */
    setLoading(true)
    try {
      /**
       * 人机验证门禁
       *
       * 组件挂着但**不自动运行**：先看手里有没有还没用掉的票据；
       * 没有就「现在开始验证」（runKey +1），再等它出票。
       * 判定仍然在后端（siteverify），这里只负责拿到票。
       */
      let ticket = captchaTokenRef.current
      if (TURNSTILE_ENFORCE && !ticket) {
        setCaptchaRun((value) => value + 1)
        ticket = await waitForCaptchaToken()
        if (!ticket) {
          setCaptchaNotice(t('captcha.required'))
          return
        }
      }

      await login(result.values.email, result.values.password, {
        // 一次性票据随请求发出，后端用它调 siteverify
        captchaToken: ticket ?? undefined,
      })
      toast.success(t('login.welcomeBack'))
      window.location.assign('/dashboard/overview')
    } catch (err) {
      setError((err as Error).message)
      /**
       * 失败后作废旧票据
       *
       * 票据在服务端可能已经被兑换过（密码错但验证已消费），
       * 不换新的话第二次提交会被判 timeout-or-duplicate，用户会以为「账号锁了」。
       * 下一次点登录会重新 execute 出题，这里只需把票清掉。
       */
      applyCaptchaToken(null)
    } finally {
      setLoading(false)
    }
  }

  const features = useMemo(
    () => [
      {
        icon: <Boxes className="size-3.5" />,
        title: t('login.featureModular'),
        desc: t('login.featureModularDesc'),
      },
      {
        icon: <Layers className="size-3.5" />,
        title: t('login.featureUi'),
        desc: t('login.featureUiDesc'),
      },
      {
        icon: <Zap className="size-3.5" />,
        title: t('login.featurePerf'),
        desc: t('login.featurePerfDesc'),
      },
      {
        icon: <Sparkles className="size-3.5" />,
        title: t('login.featureReady'),
        desc: t('login.featureReadyDesc'),
      },
    ],
    [t],
  )

  const pipeline = useMemo(
    () => [t('login.pipelineCore'), t('login.pipelineModule'), t('login.pipelineView')],
    [t],
  )

  return (
    <div className="grid min-h-dvh grid-cols-1 bg-bg lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* ---------------- 左侧品牌区 ---------------- */}
      <div
        ref={panelRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className="n-login-panel relative hidden overflow-hidden bg-surface lg:flex lg:flex-col"
      >
        {/* ---- 装饰层（全部 aria-hidden，不吃指针事件） ---- */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {/* 极光：三团大模糊色块，慢速漂移制造纵深 */}
          <div className="n-login-aurora n-login-aurora--a" />
          <div className="n-login-aurora n-login-aurora--b" />
          <div className="n-login-aurora n-login-aurora--c" />

          {/* 底线网格：静态结构层，给流动方块一个「图纸」底盘 */}
          <div className="n-grid-bg absolute inset-0 opacity-45" />

          {/* 流动方块：Canvas 网格，行波 + 指针聚光 + 点击涟漪（见 components/login-grid） */}
          <LoginGrid className="absolute inset-0 h-full w-full" />

          {/* 内容压底：让方块在文字下方退半步，网格可见但不抢字形 */}
          <div className="n-login-scrim absolute inset-0" />

          {/* 指针光斑 / 扫描线 / 暗角 / 颗粒：依次叠在图形之上 */}
          <div className="n-login-spotlight" />
          <div className="n-login-scanline" />
          <div className="n-login-vignette absolute inset-0" />
          <div className="n-login-grain absolute inset-0" />
        </div>

        {/* ---- 内容层 ---- */}
        <div className="relative z-10 flex flex-1 flex-col p-10 xl:p-12">
          <div className="flex items-center justify-between">
            <Link to="/login" className="group/logo flex items-center gap-2.5">
              <span className="relative grid place-items-center">
                <span className="n-login-logo-halo" aria-hidden="true" />
                <NexusMark className="relative h-6 w-auto text-fg transition-colors group-hover/logo:text-primary" />
              </span>
              <span className="text-sm font-semibold tracking-tight text-fg">Nexus Admin</span>
            </Link>
            <span className="rounded-full border border-line bg-surface/70 px-2.5 py-1 text-2xs text-fg-3 backdrop-blur">
              v2.6
            </span>
          </div>

          <div className="my-auto max-w-[32.5rem]">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-2.5 py-1 font-mono text-2xs text-fg-2 backdrop-blur">
              <span className="relative flex size-1.5">
                <span className="n-login-ping absolute inset-0 rounded-full bg-success" />
                <span className="relative size-1.5 rounded-full bg-success" />
              </span>
              {t('login.heroEyebrow')}
            </p>

            <h1 className="relative mt-5 max-w-[27.5rem] text-[1.875rem] leading-[1.22] font-semibold tracking-tight text-fg xl:text-[2.0625rem]">
              {t('login.heroTitle')}
              {/* 扫光只画在字形里；真实文字保留实色，读屏与选中都不受影响 */}
              <span className="n-login-sheen" aria-hidden="true" data-text={t('login.heroTitle')} />
            </h1>
            <p className="mt-4 max-w-[28.75rem] text-[0.8125rem] leading-6 text-fg-3">
              {t('login.heroDesc')}
            </p>

            {/* 装配链路：一个文件 → 一条链路，光点按顺序流过 */}
            <div className="mt-7">
              <div className="flex items-center justify-between text-[0.625rem] tracking-[0.18em] text-fg-4 uppercase">
                <span>{t('login.pipeline')}</span>
                <span className="font-mono tracking-normal normal-case">module.ts → app</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                {pipeline.map((stage, index) => (
                  <span key={stage} className="flex min-w-0 items-center gap-1.5">
                    {index > 0 && (
                      <span
                        className="n-login-connector"
                        style={{ '--i': index - 1 } as React.CSSProperties}
                        aria-hidden="true"
                      />
                    )}
                    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface/70 px-2.5 text-2xs text-fg-2 backdrop-blur transition-colors hover:border-line-strong hover:text-fg">
                      {index === 0 ? (
                        <NexusMark className="h-2.5 w-auto text-primary" />
                      ) : (
                        <span className="size-1 rounded-full bg-primary/60" />
                      )}
                      <span className="truncate">{stage}</span>
                    </span>
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-2.5">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  onPointerMove={handleFeatureMove}
                  style={{ '--i': index } as React.CSSProperties}
                  className="n-login-feature group relative isolate overflow-hidden rounded-lg border border-line bg-surface/70 p-3 backdrop-blur transition-[border-color,box-shadow] duration-300 hover:border-primary/30 hover:shadow-md"
                >
                  <span className="n-login-feature-spot" aria-hidden="true" />
                  <span className="relative flex items-center gap-1.5 text-xs font-medium text-fg">
                    <span className="text-primary transition-transform duration-300 group-hover:scale-110">
                      {feature.icon}
                    </span>
                    {feature.title}
                  </span>
                  <span className="relative mt-1 block text-2xs leading-4 text-fg-3">
                    {feature.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-5 text-2xs text-fg-4">
            <span className="inline-flex items-center gap-1">
              <Command className="size-3" />
              <Kbd className="h-4">K</Kbd>
              {t('command.title')}
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart className="size-3" /> {t('login.mitLicense')}
            </span>
            <span className="inline-flex items-center gap-1">
              <GithubIcon className="size-3" /> GitHub
            </span>
          </div>
        </div>
      </div>

      {/* ---------------- 右侧表单区 ---------------- */}
      <div className="relative flex flex-col justify-center px-5 py-10 sm:px-8">
        {/* 右上角：语言 + 深浅色切换（与顶栏同一套扩散动画） */}
        <div className="absolute top-3 right-3 flex items-center gap-0.5">
          <Tooltip content={t('topbar.language')}>
            <button
              type="button"
              onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}
              aria-label={t('topbar.language')}
              className="h-8 rounded-lg px-2 text-2xs font-medium text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-primary-ring focus-visible:outline-none"
            >
              {locale === 'zh-CN' ? 'EN' : '中文'}
            </button>
          </Tooltip>
          <Tooltip content={t('login.toggleTheme')}>
            <button
              ref={themeBtnRef}
              type="button"
              onClick={toggleTheme}
              aria-label={t('login.toggleTheme')}
              aria-pressed={resolvedTheme === 'dark'}
              className="grid size-8 place-items-center rounded-lg text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-primary-ring focus-visible:outline-none"
            >
              <span className="relative grid size-[0.9375rem] place-items-center">
                <SunMedium
                  className={cn(
                    'absolute size-[0.9375rem] transition-[opacity,transform] duration-300',
                    resolvedTheme === 'dark'
                      ? 'scale-100 rotate-0 opacity-100'
                      : 'scale-50 -rotate-90 opacity-0',
                  )}
                  strokeWidth={1.9}
                />
                <MoonStar
                  className={cn(
                    'absolute size-[0.9375rem] transition-[opacity,transform] duration-300',
                    resolvedTheme === 'dark'
                      ? 'scale-50 rotate-90 opacity-0'
                      : 'scale-100 rotate-0 opacity-100',
                  )}
                  strokeWidth={1.9}
                />
              </span>
            </button>
          </Tooltip>
        </div>

        <div className="mx-auto w-full max-w-[23rem]">
          <div className="mb-7 flex items-center gap-2.5 lg:hidden">
            <NexusMark className="h-5 w-auto text-fg" />
            <span className="text-sm font-semibold text-fg">Nexus Admin</span>
          </div>

          <h2 className="text-xl font-semibold tracking-tight text-fg">{t('login.title')}</h2>
          <p className="mt-1 text-xs text-fg-3">{t('login.subtitle')}</p>

          <form
            className="mt-6 space-y-3.5"
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-medium text-fg-2">
                {t('login.email')}
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-fg-4" />
                <Input
                  id="email"
                  type="email"
                  size="lg"
                  autoComplete="username"
                  className="pl-9"
                  value={email}
                  status={fieldError.email || error ? 'error' : 'default'}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                />
              </div>
              {fieldError.email && <p className="text-2xs text-danger">{fieldError.email}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-medium text-fg-2">
                  {t('login.password')}
                </label>
                <button
                  type="button"
                  onClick={() => toast.info(t('login.forgot'))}
                  className="text-2xs text-primary hover:underline"
                >
                  {t('login.forgot')}
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-fg-4" />
                <Input
                  id="password"
                  type="password"
                  size="lg"
                  autoComplete="current-password"
                  className="pl-9"
                  value={password}
                  status={fieldError.password || error ? 'error' : 'default'}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                />
              </div>
              {fieldError.password && <p className="text-2xs text-danger">{fieldError.password}</p>}
              {error && <p className="text-2xs text-danger">{error}</p>}
            </div>

            <div className="flex items-center justify-between">
              <Switch
                checked={remember}
                onChange={setRemember}
                label={<span className="text-xs">{t('login.remember')}</span>}
                size="sm"
              />
              <span className="font-mono text-2xs text-fg-4">{t('login.demoHint')}</span>
            </div>

            {/*
              人机验证（点登录才出现）
              - 挂载后不运行、不占位：`execution: 'execute'` + `mode="on-demand"`
              - 用户点登录时 `runKey` +1，验证才开始；顺利通过时全程不闪
              - 需要点一下的话，挑战会展开在这一行的位置
            */}
            <TurnstileWidget
              runKey={captchaRun}
              onVerify={applyCaptchaToken}
              onExpire={() => applyCaptchaToken(null)}
            />

            {/*
              只有**真的没通过**才出现提示
              「正在等待出票」不再单独占一行：那通常只持续几百毫秒，
              交给登录按钮自己的 loading 转圈即可，比闪现一行文字安静得多。
            */}
            {captchaNotice && (
              <p className="flex items-center gap-1.5 text-2xs text-danger" role="alert">
                <ShieldAlert className="size-3 shrink-0" aria-hidden="true" />
                {captchaNotice}
              </p>
            )}

            {/*
              按钮**不**随票据禁用：
              提供商晚到 1 秒就禁用按钮，会让用户以为「点不动」，也让 48 个
              自动化验收脚本（`scripts/verify-*.mjs`）在等 enabled 时超时。
              真正的门禁放在 submit() 里 —— 没票据就不发请求，并给出可读提示。
            */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              loading={loading}
              rightIcon={
                loading ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="size-3.5" />
                )
              }
            >
              {t('login.submit')}
            </Button>
          </form>

          {demoAccounts.length > 0 ? (
            <>
              <div className="my-5 flex items-center gap-3 text-2xs text-fg-4">
                <span className="h-px flex-1 bg-line" />
                {t('login.quickRoles')}
                <span className="h-px flex-1 bg-line" />
              </div>

              <div className="space-y-1.5">
                {demoAccounts.map((account) => {
                  const active = email === account.email
                  return (
                    <button
                      key={account.email}
                      type="button"
                      onClick={() => {
                        setEmail(account.email)
                        setPassword(account.password)
                        setError(null)
                        setFieldError({})
                      }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all',
                        active
                          ? 'border-primary/40 bg-primary-weak/60 shadow-xs'
                          : 'border-line hover:border-line-strong hover:bg-surface-2',
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-6 shrink-0 place-items-center rounded-md text-2xs font-semibold',
                          account.tone === 'primary' && 'bg-primary-weak text-primary',
                          account.tone === 'success' && 'bg-success-weak text-success',
                          account.tone === 'warning' && 'bg-warning-weak text-warning',
                        )}
                      >
                        {isEn ? account.email.slice(0, 1).toUpperCase() : account.label.slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-fg">
                          {isEn ? account.email.split('@')[0] : account.label}
                        </span>
                        <span className="block truncate font-mono text-2xs text-fg-3">
                          {account.email}
                        </span>
                      </span>
                      <ChevronRight className="size-3.5 shrink-0 text-fg-4" />
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <p className="mt-5 rounded-md border border-line bg-surface-2 px-3 py-2.5 text-2xs leading-5 text-fg-3">
              {t('login.noMock')} {t('login.noMockDev')}
            </p>
          )}

          <p className="mt-6 flex items-center justify-center gap-1 text-2xs text-fg-4">
            <CircleQuestionMark className="size-3" />
            {t('login.firstTime')}
            <Link to="/login" className="text-primary hover:underline">
              {t('login.quickStart')}
            </Link>
          </p>
          <p className="mt-2 text-center text-2xs text-fg-4">
            {t('login.themeNow', {
              theme: resolvedTheme === 'dark' ? t('topbar.dark') : t('topbar.light'),
            })}
          </p>
        </div>
      </div>
    </div>
  )
}
