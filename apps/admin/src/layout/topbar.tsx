import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Bell,
  ChevronsUpDown,
  Languages,
  LogOut,
  Maximize2,
  Minimize2,
  MoonStar,
  Palette,
  Search,
  Settings,
  SunMedium,
  User,
} from 'lucide-react'
import { Avatar, ChromeScope, Dropdown, Kbd, Tooltip, cn, toast } from '@nexus/ui'
import { useAuthStore } from '@/core/auth-store'
import { useUiStore } from '@/core/ui-store'
import { useNotificationStore } from '@/core/notification-store'
import { AppLink, useAppNavigate } from '@/components/app-link'
import { NexusMark } from '@/components/brand-icons'
import { useThemePanelStore } from '@/core/theme-panel-store'
import { originFromElement, runThemeTransition } from '@/core/theme-transition'
import { useI18n } from '@/i18n'
import { ROLE_KEY_BY_ID } from '@/i18n/locales/keys'
import { AssistantLauncher } from '@/ai/components/assistant-launcher'

/**
 * 顶部操作栏
 *
 * 与「参考设计（图 3）」的对齐点：
 * - 侧边栏与顶栏使用**同一个背景色**，不画分割线 —— 只有内容区交界处需要一条线
 * - 左侧是「侧栏开关 + 搜索」，右侧是「通知 + 语言 + 外观 + 头像」
 * - 图标按钮统一 32×32、无边框，hover 才出现底色
 *
 * 交互要点：
 * - 侧栏开关常驻在搜索按钮左侧（同一行，不再独占一行）
 * - 移动端搜索退化为图标按钮：窄屏放不下搜索框的占位文案，
 *   留一个放大镜入口直接唤起命令面板即可
 * - 主题切换播放圆形扩散动画（时长 720ms，缓动偏慢更丝滑）
 */
export function Topbar({
  onOpenCommand,
  navToggle,
  brand,
  topNav,
  search = 'full',
}: {
  onOpenCommand: () => void
  /**
   * 侧栏开关
   *
   * 桌面端是「折叠 / 展开」，移动端是「打开抽屉」——
   * 两种语义由外壳决定，顶栏只负责渲染同一个 32×32 按钮。
   */
  navToggle?: {
    label: string
    expanded: boolean
    onClick: () => void
  }
  /**
   * 品牌字标
   *
   * 与侧栏头部同源（同一个 NexusMark + 同一措辞），因此「Logo 从侧栏搬到顶栏」
   * 时视觉上只是位移，不是换了一个标记。
   */
  brand?: boolean
  /**
   * 顶部菜单插槽（水平 / 混合布局）
   *
   * 由外壳传入 `TopNav`：顶栏只负责「放在哪」，不关心菜单怎么渲染，
   * 避免顶栏与导航互相依赖。
   */
  topNav?: ReactNode
  /**
   * 搜索入口形态
   *
   * 顶栏被菜单占用时（`topNav` 存在）退化为纯图标：一套横向菜单 + 一个 300px 搜索框
   * 在 1280px 下会把右侧按钮挤出去。
   */
  search?: 'full' | 'icon'
}) {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const resolvedTheme = useUiStore((state) => state.resolvedTheme)
  const setTheme = useUiStore((state) => state.setTheme)
  const openPanel = useThemePanelStore((state) => state.setOpen)
  const [fullscreen, setFullscreen] = useState(false)
  const notifications = useNotificationStore((state) => state.items)
  const markAllRead = useNotificationStore((state) => state.markAllRead)
  const unread = notifications.filter((item) => !item.read).length
  const navigate = useAppNavigate()
  const themeBtnRef = useRef<HTMLButtonElement>(null)
  const { t, locale, toggle: toggleLocale, isEn } = useI18n()

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
      else await document.exitFullscreen()
    } catch {
      toast.warning(t('topbar.fullscreen'))
    }
  }

  const toggleTheme = () => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark'
    runThemeTransition(
      () => setTheme(next),
      originFromElement(themeBtnRef.current),
      next === 'dark',
    )
  }

  return (
    // ChromeScope：标记浮层来源（顶栏），提示与下拉据此保持与按钮同尺度
    <ChromeScope>
      <header
        className={cn(
          // 与侧栏同色，默认无下边框；分割线交给内容区左侧那条
          // 底色用 --n-topbar-bg：默认是 var(--n-surface)，调色盘可以把顶栏单独染一档
          'n-chrome relative z-40 flex h-[var(--n-header-h)] shrink-0 items-center gap-2 bg-[var(--n-topbar-bg)] px-3',
          'after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-line',
        )}
      >
        {/* 品牌位：导航搬离侧栏时，由顶栏接管 Logo，避免整屏丢掉品牌识别 */}
        {brand && (
          <AppLink
            to="/dashboard/overview"
            className="mr-1 flex h-8 shrink-0 items-center gap-2 rounded-lg pr-1 text-fg"
          >
            <span className="grid size-7 shrink-0 place-items-center">
              <NexusMark className="h-[1.125rem] w-auto" />
            </span>
            <span className="hidden truncate text-[0.8125rem] font-semibold tracking-tight lg:inline">
              Nexus Admin
            </span>
          </AppLink>
        )}

        {/* 侧栏开关：与搜索入口同一行，永远在它左侧 */}
        {navToggle && (
          <Tooltip content={navToggle.label}>
            <button
              type="button"
              onClick={navToggle.onClick}
              aria-label={navToggle.label}
              aria-expanded={navToggle.expanded}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-primary-ring focus-visible:outline-none"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
                <rect
                  x="3.25"
                  y="4.25"
                  width="17.5"
                  height="15.5"
                  rx="2.75"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path d="M9 4.5v15" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>
          </Tooltip>
        )}

        {/* 顶部菜单：水平 / 混合布局时占满中间区域 */}
        {topNav}

        {/* 搜索入口：桌面端是带占位文案的输入框样式，移动端收成一个图标按钮 */}
        <button
          type="button"
          onClick={onOpenCommand}
          aria-label={t('nav.searchPlaceholder')}
          title={t('nav.searchPlaceholder')}
          className={cn(
            'group flex h-8 items-center rounded-lg text-xs text-fg-3',
            'transition-[background-color,border-color,box-shadow,color] duration-150',
            'hover:bg-surface-2 hover:text-fg',
            'focus-visible:ring-2 focus-visible:ring-primary-ring focus-visible:outline-none',
            // 窄屏：与侧栏开关同款的纯图标按钮，不描边（避免顶栏出现两个风格不一致的方块）
            'w-8 shrink-0 justify-center',
            // 桌面端：恢复成带描边的搜索框，可以按剩余宽度收缩（768px 下右侧按钮不能被挤出屏幕）
            search === 'full' &&
              'md:w-full md:max-w-[18.75rem] md:min-w-0 md:shrink md:justify-start md:gap-2 md:border md:border-line md:bg-surface-2/60 md:px-2.5',
            search === 'full' &&
              'md:hover:border-line-strong md:hover:bg-surface-2 md:hover:text-fg-2',
            search === 'full' && 'md:focus-visible:border-primary/40',
          )}
        >
          <Search className="size-3.5 shrink-0 transition-colors group-hover:text-primary" />
          {search === 'full' && (
            <>
              <span className="hidden truncate md:inline">{t('nav.searchPlaceholder')}</span>
              <span className="ml-auto hidden shrink-0 items-center gap-0.5 lg:flex">
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </span>
            </>
          )}
        </button>

        <div className="ml-auto flex items-center gap-0.5">
          {/* AI 运营助手：常驻在最左侧，与「通知 / 语言 / 外观」同一轨道 */}
          <AssistantLauncher />

          <NotificationDropdown
            unread={unread}
            items={notifications}
            onReadAll={markAllRead}
            onOpen={(href) => href && navigate(href)}
          />

          {/* 语言切换：窄屏只留图标 —— 320px 档位要同时容纳「助手 + 通知 + 外观 + 头像」，
            语言自称（中/EN）删掉不影响可发现性（有 aria-label 与气泡） */}
          <Tooltip content={t('topbar.language')}>
            <button
              type="button"
              onClick={toggleLocale}
              aria-label={t('topbar.language')}
              className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <Languages className="size-4" />
              <span className="hidden tabular-nums sm:inline">{isEn ? 'EN' : '中'}</span>
            </button>
          </Tooltip>

          {/* 深浅色：图标略小于其它项，视觉重量才和其它 32px 按钮持平 */}
          <Tooltip content={resolvedTheme === 'dark' ? t('topbar.light') : t('topbar.dark')}>
            <IconButton
              ref={themeBtnRef}
              aria-label={t('topbar.toggleTheme')}
              onClick={toggleTheme}
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
            </IconButton>
          </Tooltip>

          {/* 外观面板 */}
          <Tooltip content={t('topbar.appearance')}>
            <IconButton aria-label={t('topbar.appearance')} onClick={() => openPanel(true)}>
              <Palette className="size-4" />
            </IconButton>
          </Tooltip>

          <Tooltip content={t('topbar.fullscreen')}>
            <IconButton
              aria-label={t('topbar.fullscreen')}
              className="hidden sm:grid"
              onClick={() => void toggleFullscreen()}
            >
              {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </IconButton>
          </Tooltip>

          <span className="mx-1.5 h-5 w-px bg-line" />

          <UserDropdown
            name={user?.name ?? t('topbar.guest')}
            roleName={user ? t(ROLE_KEY_BY_ID[user.role] ?? 'topbar.guest') : ''}
            email={user?.email ?? ''}
            localeLabel={locale === 'zh-CN' ? '中文' : 'English'}
            labels={{
              profile: t('topbar.profile'),
              preferences: t('topbar.preferences'),
              logout: t('topbar.logout'),
            }}
            onProfile={() => navigate('/account/profile')}
            onSettings={() => navigate('/system/settings')}
            onLogout={() => {
              logout()
              navigate('/login')
            }}
          />
        </div>
      </header>
    </ChromeScope>
  )
}

/* ------------------------------------------------------------------ *
 * 内部小组件
 * ------------------------------------------------------------------ */

function IconButton({
  children,
  className,
  ref,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  ref?: React.Ref<HTMLButtonElement>
}) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'grid size-8 place-items-center rounded-lg text-fg-3',
        'transition-[background-color,color] duration-150',
        'hover:bg-surface-2 hover:text-fg',
        'focus-visible:ring-2 focus-visible:ring-primary-ring focus-visible:outline-none',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function NotificationDropdown({
  unread,
  items,
  onReadAll,
  onOpen,
}: {
  unread: number
  items: Array<{
    id: string
    title: string
    description: string
    tone: 'info' | 'success' | 'warning' | 'danger'
    time: string
    read: boolean
    href?: string
  }>
  onReadAll: () => void
  onOpen: (href?: string) => void
}) {
  const { t } = useI18n()
  return (
    <Dropdown
      align="end"
      width={360}
      trigger={
        <button
          type="button"
          aria-label={`${t('topbar.notifications')} (${unread})`}
          className="relative grid size-8 place-items-center rounded-lg text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 grid min-w-[0.875rem] place-items-center rounded-full bg-danger px-0.5 text-[0.5625rem] leading-[0.875rem] font-semibold text-white ring-2 ring-surface">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      }
      items={[
        {
          key: 'head',
          label: (
            <span className="flex w-full items-center justify-between gap-2">
              <span className="font-semibold text-fg">{t('topbar.notifications')}</span>
              <span className="rounded-full bg-danger-weak px-1.5 text-2xs text-danger">
                {t('topbar.unread', { n: unread })}
              </span>
            </span>
          ),
          disabled: true,
        },
        {
          key: 'read-all',
          label: <span className="text-2xs text-primary">{t('topbar.markAllRead')}</span>,
          onSelect: onReadAll,
        },
        'divider',
        ...items.slice(0, 4).map((item) => ({
          key: item.id,
          label: (
            <span className="flex w-full items-start gap-2.5 py-1 text-left">
              <span
                className={cn(
                  'mt-1.5 grid size-5 shrink-0 place-items-center rounded-full',
                  item.tone === 'danger' && 'bg-danger-weak text-danger',
                  item.tone === 'warning' && 'bg-warning-weak text-warning',
                  item.tone === 'success' && 'bg-success-weak text-success',
                  item.tone === 'info' && 'bg-info-weak text-info',
                )}
              >
                <span className="size-1.5 rounded-full bg-current" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[0.8125rem] text-fg">{item.title}</span>
                  {!item.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-2xs leading-4 text-fg-3">
                  {item.description}
                </span>
                <span className="mt-0.5 block text-2xs text-fg-4">{item.time}</span>
              </span>
            </span>
          ),
          onSelect: () => onOpen(item.href),
        })),
        'divider',
        {
          key: 'all',
          label: (
            <span className="flex w-full items-center justify-center text-2xs text-fg-3">
              {t('topbar.viewAll')}
            </span>
          ),
          onSelect: () => onOpen('/account/profile'),
        },
      ]}
    />
  )
}

function UserDropdown({
  name,
  roleName,
  email,
  localeLabel,
  labels,
  onProfile,
  onSettings,
  onLogout,
}: {
  name: string
  roleName: string
  email: string
  localeLabel: string
  labels: { profile: string; preferences: string; logout: string }
  onProfile: () => void
  onSettings: () => void
  onLogout: () => void
}) {
  return (
    <Dropdown
      align="end"
      width={252}
      trigger={
        <button
          type="button"
          className={cn(
            'flex h-8 items-center gap-2 rounded-lg pr-1.5 pl-1 transition-colors',
            'hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary-ring focus-visible:outline-none',
          )}
        >
          <Avatar name={name} size="sm" status="online" />
          <span className="hidden min-w-0 text-left sm:block">
            <span className="block truncate text-xs leading-4 font-medium text-fg">{name}</span>
            <span className="block truncate text-2xs leading-3 text-fg-3">{roleName}</span>
          </span>
          <ChevronsUpDown className="hidden size-3 shrink-0 text-fg-4 sm:block" />
        </button>
      }
      items={[
        {
          key: 'head',
          label: (
            <span className="flex w-full items-center gap-2.5 py-1">
              <Avatar name={name} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem] font-medium text-fg">{name}</span>
                <span className="block truncate text-2xs text-fg-3">{email}</span>
              </span>
            </span>
          ),
          disabled: true,
        },
        'divider',
        {
          key: 'profile',
          label: labels.profile,
          icon: <User className="size-3.5" />,
          onSelect: onProfile,
        },
        {
          key: 'settings',
          label: labels.preferences,
          icon: <Settings className="size-3.5" />,
          hint: localeLabel,
          onSelect: onSettings,
        },
        'divider',
        {
          key: 'logout',
          label: labels.logout,
          icon: <LogOut className="size-3.5" />,
          danger: true,
          onSelect: onLogout,
        },
      ]}
    />
  )
}
