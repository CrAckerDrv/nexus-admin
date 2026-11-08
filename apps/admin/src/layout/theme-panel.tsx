import { useMemo } from 'react'
import {
  ArrowLeftRight,
  Check,
  Frame,
  Languages,
  LayoutGrid,
  Maximize2,
  Monitor,
  Moon,
  Palette,
  Pipette,
  Rows3,
  RotateCcw,
  Sparkles,
  Square,
  Sun,
  SunMoon,
  SwatchBook,
  Type,
} from 'lucide-react'
import { Button, Drawer, SegmentedControl, Switch, cn, toast } from '@nexus/ui'
import {
  ACCENT_PRESETS,
  SKIN_PRESETS,
  useUiStore,
  type Accent,
  type AccentChoice,
  type ContentWidth,
  type DensityScale,
  type Direction,
  type FontFamily,
  type LayoutVariant,
  type MotionPreference,
  type MenuLayout,
  type RadiusScale,
  type Skin,
  type ThemeMode,
} from '@/core/ui-store'
import { useThemePanelStore } from '@/core/theme-panel-store'
import { runThemeTransition } from '@/core/theme-transition'
import { useI18n } from '@/i18n'
import type { DictKey } from '@/i18n'
import { MenuLayoutPicker } from './menu-layout'
import { PaletteEditor } from './palette-editor'

type TabKey = 'basic' | 'skin' | 'palette' | 'layout' | 'detail'

/**
 * 「收起」在不同布局里的含义
 *
 * 同一个布尔值，六种布局指向不同东西：整条侧栏、双列的第二列、混合布局的子菜单。
 * 用统一文案「收起侧边栏」会让双列布局的用户找不到被收起的到底是哪一块。
 */
const COLLAPSE_LABEL = {
  vertical: 'nav.collapse',
  // 双列折叠的是第二列（模块子菜单），导轨保留 —— 文案必须点明是哪一块
  dual: 'theme.collapseSubmenu',
  horizontal: 'nav.collapse',
  mixed: 'theme.collapseSubmenu',
  floating: 'nav.collapse',
  sidebar: 'nav.collapse',
} satisfies Record<MenuLayout, DictKey>

/**
 * 外观设置面板（右侧抽屉）
 *
 * 为什么从「居中对话框」改成「右侧抽屉」：
 * 1. 调外观时页面本身就是素材 —— 居中弹窗会把它整块盖住，只能靠小缩略图猜效果；
 *    抽屉只占右侧一条，左侧页面保持可见，改动即时能对照到真实界面。
 * 2. 分组多、纵向内容长，居中弹窗必然出现内部滚动条（旧版密度一栏就被截断）；
 *    抽屉占满视口高度，再用**分页签**承载分组，每个页签一屏放得下。
 * 3. 顶部常驻一块「实时预览」，它消费的是当前真实令牌（含皮肤），
 *    配色/圆角/密度/字体改动都能立刻看到，不必来回关面板。
 */
export function ThemePanel() {
  const open = useThemePanelStore((state) => state.open)
  const setOpen = useThemePanelStore((state) => state.setOpen)
  const { t, isEn } = useI18n()

  const theme = useUiStore((state) => state.theme)
  const setTheme = useUiStore((state) => state.setTheme)
  const skin = useUiStore((state) => state.skin)
  const setSkin = useUiStore((state) => state.setSkin)
  const accent = useUiStore((state) => state.accent)
  const setAccent = useUiStore((state) => state.setAccent)
  const radius = useUiStore((state) => state.radius)
  const setRadius = useUiStore((state) => state.setRadius)
  const density = useUiStore((state) => state.density)
  const setDensity = useUiStore((state) => state.setDensity)
  const font = useUiStore((state) => state.font)
  const setFont = useUiStore((state) => state.setFont)
  const menuLayout = useUiStore((state) => state.menuLayout)
  const setMenuLayout = useUiStore((state) => state.setMenuLayout)
  const layout = useUiStore((state) => state.layout)
  const setLayout = useUiStore((state) => state.setLayout)
  const contentWidth = useUiStore((state) => state.contentWidth)
  const setContentWidth = useUiStore((state) => state.setContentWidth)
  const direction = useUiStore((state) => state.direction)
  const setDirection = useUiStore((state) => state.setDirection)
  const tabBar = useUiStore((state) => state.tabBar)
  const setTabBar = useUiStore((state) => state.setTabBar)
  const motion = useUiStore((state) => state.motion)
  const setMotion = useUiStore((state) => state.setMotion)
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed)
  const setSidebarCollapsed = useUiStore((state) => state.setSidebarCollapsed)
  const resetPreferences = useUiStore((state) => state.resetPreferences)
  const palette = useUiStore((state) => state.palette)

  // 页签状态放在 store 里：系统设置页可以「直接打开调色盘」，命令行也能指定落点
  const tab = useThemePanelStore((state) => state.tab)
  const setTab = useThemePanelStore((state) => state.setTab)

  const skinList = useMemo(
    () => Object.entries(SKIN_PRESETS) as Array<[Skin, (typeof SKIN_PRESETS)[Skin]]>,
    [],
  )
  const accentList = useMemo(
    () => Object.entries(ACCENT_PRESETS) as Array<[Accent, (typeof ACCENT_PRESETS)[Accent]]>,
    [],
  )

  const applyTheme = (next: ThemeMode) => {
    if (next === 'system') {
      setTheme('system')
      return
    }
    runThemeTransition(() => setTheme(next), undefined, next === 'dark')
  }

  const currentSkin = SKIN_PRESETS[skin]

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      title={t('theme.title')}
      description={t('theme.subtitle')}
      width="min(100vw - 24px, 404px)"
      overlay="soft"
      bodyClassName="px-4 py-0"
      footerLeft={
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<RotateCcw className="size-3.5" />}
          onClick={() => {
            resetPreferences()
            toast.success(t('theme.saved'))
          }}
        >
          {t('theme.reset')}
        </Button>
      }
      footer={
        <Button variant="primary" size="sm" onClick={() => setOpen(false)}>
          {t('common.finish')}
        </Button>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* 实时预览：常驻顶部，任何改动都能立刻看到结果 */}
        <div className="sticky top-0 z-10 -mx-4 bg-surface px-4 pt-3 pb-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-2xs font-medium tracking-wide text-fg-3 uppercase">
              {t('theme.preview')}
            </span>
            <span className="flex min-w-0 items-center gap-1 truncate text-2xs text-fg-4">
              {palette.enabled && (
                <span className="flex shrink-0 items-center gap-0.5 rounded-sm bg-primary/10 px-1 text-[0.5625rem] leading-4 text-primary">
                  <Pipette className="size-2.5" />
                  {t('theme.tabPalette')}
                </span>
              )}
              <span className="truncate">
                {isEn ? currentSkin.labelEn : currentSkin.label}
                {accent !== 'auto' && (
                  <>
                    {' · '}
                    {isEn ? ACCENT_PRESETS[accent].labelEn : ACCENT_PRESETS[accent].label}
                  </>
                )}
              </span>
            </span>
          </div>
          <LivePreview menuLayout={menuLayout} />
        </div>

        {/* 分页签：把长表单拆成四屏，避免抽屉内部再滚动一大截 */}
        <div className="-mx-4 border-y border-line bg-surface px-3 py-2">
          <SegmentedControl
            size="sm"
            block
            options={[
              { label: t('theme.tabBasic'), value: 'basic' },
              { label: t('theme.tabSkin'), value: 'skin' },
              { label: t('theme.tabPalette'), value: 'palette' },
              { label: t('theme.tabLayout'), value: 'layout' },
              { label: t('theme.tabDetail'), value: 'detail' },
            ]}
            value={tab}
            onChange={(value) => setTab(value as TabKey)}
          />
        </div>

        <div className="min-h-0 flex-1 space-y-5 py-4">
          {/* ---------------- 调色盘：按区域自定义配色 ---------------- */}
          {tab === 'palette' && <PaletteEditor palette={palette} />}

          {/* ---------------- 基础：明暗 + 强调色 ---------------- */}
          {tab === 'basic' && (
            <>
              <Section icon={<SunMoon className="size-3.5" />} title={t('theme.mode')}>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      {
                        value: 'system',
                        icon: <Monitor className="size-3.5" />,
                        label: t('topbar.system'),
                      },
                      {
                        value: 'light',
                        icon: <Sun className="size-3.5" />,
                        label: t('topbar.light'),
                      },
                      {
                        value: 'dark',
                        icon: <Moon className="size-3.5" />,
                        label: t('topbar.dark'),
                      },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => applyTheme(item.value)}
                      aria-pressed={theme === item.value}
                      className={cn(
                        'group relative overflow-hidden rounded-lg border p-1 text-left transition-colors',
                        theme === item.value
                          ? 'border-primary ring-1 ring-primary/25'
                          : 'border-line hover:border-line-strong',
                      )}
                    >
                      <ThemePreview mode={item.value} />
                      <span className="mt-1 flex items-center justify-center gap-1 py-0.5 text-2xs text-fg-2">
                        {item.icon}
                        {item.label}
                      </span>
                      {theme === item.value && (
                        <span className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-primary text-primary-fg">
                          <Check className="size-2.5" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </Section>

              <Section
                icon={<Palette className="size-3.5" />}
                title={t('theme.accent')}
                hint={t('theme.accentHint')}
              >
                <div className="grid grid-cols-4 gap-2">
                  <AccentChip
                    active={accent === 'auto'}
                    label={t('theme.accentAuto')}
                    onClick={() => setAccent('auto')}
                  />
                  {accentList.map(([key, preset]) => (
                    <AccentChip
                      key={key}
                      active={accent === key}
                      label={isEn ? preset.labelEn : preset.label}
                      gradient={preset.swatch}
                      onClick={() => setAccent(key as AccentChoice)}
                    />
                  ))}
                </div>
              </Section>
            </>
          )}

          {/* ---------------- 皮肤 ---------------- */}
          {tab === 'skin' && (
            <>
              <Section
                icon={<SwatchBook className="size-3.5" />}
                title={t('theme.skin')}
                hint={t('theme.skinHint')}
              >
                <div className="grid grid-cols-2 gap-2">
                  {skinList.map(([key, preset]) => {
                    const active = skin === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSkin(key)}
                        aria-pressed={active}
                        className={cn(
                          'group flex flex-col overflow-hidden rounded-lg border p-1 text-left transition-colors',
                          active
                            ? 'border-primary ring-1 ring-primary/25'
                            : 'border-line hover:border-line-strong',
                        )}
                      >
                        <SkinThumbnail skin={key} />
                        <span className="mt-1.5 flex items-center gap-1 px-0.5">
                          <span
                            className={cn(
                              'truncate text-2xs font-medium',
                              active ? 'text-primary' : 'text-fg-2',
                            )}
                          >
                            {isEn ? preset.labelEn : preset.label}
                          </span>
                          {preset.darkRail && (
                            <span className="shrink-0 rounded-sm bg-surface-3 px-1 text-[0.5625rem] leading-4 text-fg-4">
                              {t('theme.darkRail')}
                            </span>
                          )}
                          {active && (
                            <Check
                              className="ml-auto size-3 shrink-0 text-primary"
                              strokeWidth={3}
                            />
                          )}
                        </span>
                        <span className="mt-0.5 block truncate px-0.5 text-[0.625rem] text-fg-4">
                          {isEn ? preset.taglineEn : preset.tagline}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-2 flex items-start gap-1.5 rounded-md bg-surface-2 px-2.5 py-2 text-2xs leading-4 text-fg-3">
                  <Sparkles className="mt-0.5 size-3 shrink-0 text-primary" />
                  {t('theme.skinHint')}
                </p>
              </Section>
            </>
          )}

          {/* ---------------- 布局 ---------------- */}
          {tab === 'layout' && (
            <>
              <Section icon={<LayoutGrid className="size-3.5" />} title={t('theme.menuLayout')}>
                <p className="mb-2 text-2xs leading-4 text-fg-4">{t('theme.menuLayoutHint')}</p>
                <MenuLayoutPicker value={menuLayout} onChange={setMenuLayout} />
                {/* 水平布局没有侧栏，折叠开关无从谈起 —— 直接不渲染，比给一个灰掉的开关更清楚 */}
                {menuLayout !== 'horizontal' && (
                  <ToggleRow
                    label={t(COLLAPSE_LABEL[menuLayout])}
                    checked={sidebarCollapsed}
                    onChange={setSidebarCollapsed}
                  />
                )}
              </Section>

              <Section icon={<Frame className="size-3.5" />} title={t('theme.layout')}>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      {
                        value: 'default',
                        label: t('theme.layoutDefault'),
                        icon: <LayoutGrid className="size-3.5" />,
                      },
                      {
                        value: 'compact',
                        label: t('theme.layoutCompact'),
                        icon: <Rows3 className="size-3.5" />,
                      },
                      {
                        value: 'fullscreen',
                        label: t('theme.layoutFull'),
                        icon: <Maximize2 className="size-3.5" />,
                      },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setLayout(item.value as LayoutVariant)}
                      aria-pressed={layout === item.value}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors',
                        layout === item.value
                          ? 'border-primary bg-primary-weak/30 text-primary'
                          : 'border-line text-fg-2 hover:border-line-strong',
                      )}
                    >
                      {item.icon}
                      <span className="text-2xs">{item.label}</span>
                    </button>
                  ))}
                </div>
                <ToggleRow label={t('theme.tabs')} checked={tabBar} onChange={setTabBar}>
                  <span className="text-2xs text-fg-4">{layout === 'fullscreen' ? '⌘K' : ''}</span>
                </ToggleRow>
              </Section>

              <Section icon={<ArrowLeftRight className="size-3.5" />} title={t('theme.direction')}>
                <div className="space-y-2">
                  <ToggleRow label={t('theme.contentWidth')}>
                    <SegmentedControl
                      size="sm"
                      options={[
                        { label: t('theme.contentFull'), value: 'full' },
                        { label: t('theme.contentCentered'), value: 'centered' },
                      ]}
                      value={contentWidth}
                      onChange={(value) => setContentWidth(value as ContentWidth)}
                    />
                  </ToggleRow>
                  <ToggleRow label={t('theme.direction')}>
                    <SegmentedControl
                      size="sm"
                      options={[
                        { label: 'LTR', value: 'ltr' },
                        { label: 'RTL', value: 'rtl' },
                      ]}
                      value={direction}
                      onChange={(value) => setDirection(value as Direction)}
                    />
                  </ToggleRow>
                </div>
              </Section>
            </>
          )}

          {/* ---------------- 细节 ---------------- */}
          {tab === 'detail' && (
            <>
              <Section icon={<Square className="size-3.5" />} title={t('theme.radius')}>
                <div className="grid grid-cols-5 gap-2">
                  {(
                    [
                      { value: 'none', label: '0' },
                      { value: 'small', label: '0.3' },
                      { value: 'medium', label: '0.5' },
                      { value: 'large', label: '0.75' },
                      { value: 'xlarge', label: '1.0' },
                    ] as const
                  ).map((item, index) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setRadius(item.value as RadiusScale)}
                      aria-pressed={radius === item.value}
                      className={cn(
                        'group flex flex-col items-center gap-1 rounded-lg px-1 py-1.5 transition-colors',
                        radius === item.value ? 'text-primary' : 'text-fg-3 hover:text-fg-2',
                      )}
                    >
                      <span
                        className={cn(
                          'block h-8 w-full border-2 transition-colors',
                          radius === item.value ? 'border-primary' : 'border-line-strong',
                        )}
                        style={{ borderRadius: [0, 5, 8, 12, 16][index] }}
                      />
                      <span className="text-2xs tabular-nums">{item.label}</span>
                    </button>
                  ))}
                </div>
              </Section>

              <Section icon={<Rows3 className="size-3.5" />} title={t('theme.density')}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      { value: 'compact', label: t('theme.densityCompact'), rows: 5 },
                      { value: 'default', label: t('theme.densityDefault'), rows: 4 },
                      { value: 'comfortable', label: t('theme.densityComfortable'), rows: 3 },
                      { value: 'ultra', label: t('theme.densityUltra'), rows: 2 },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setDensity(item.value as DensityScale)}
                      aria-pressed={density === item.value}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors',
                        density === item.value
                          ? 'border-primary bg-primary-weak/30'
                          : 'border-line hover:border-line-strong',
                      )}
                    >
                      <span className="flex w-full flex-col justify-center gap-[0.1875rem]">
                        {Array.from({ length: item.rows }).map((_, index) => (
                          <span
                            key={index}
                            className="h-[0.125rem] w-full rounded-full bg-current opacity-40"
                          />
                        ))}
                      </span>
                      <span className="text-2xs text-fg-2">{item.label}</span>
                    </button>
                  ))}
                </div>
              </Section>

              <Section icon={<Type className="size-3.5" />} title={t('theme.font')}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      { value: 'auto', label: t('theme.fontAuto'), cls: 'font-sans' },
                      { value: 'sans', label: t('theme.fontSans'), cls: 'font-sans' },
                      { value: 'serif', label: t('theme.fontSerif'), cls: 'font-serif' },
                      { value: 'mono', label: 'Mono', cls: 'font-mono' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setFont(item.value as FontFamily)}
                      aria-pressed={font === item.value}
                      className={cn(
                        'flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2 transition-colors',
                        font === item.value
                          ? 'border-primary bg-primary-weak/40 text-primary'
                          : 'border-line text-fg-2 hover:border-line-strong',
                      )}
                    >
                      <span className={cn('text-lg leading-none', item.cls)}>Aa</span>
                      <span className="text-2xs">{item.label}</span>
                    </button>
                  ))}
                </div>
              </Section>

              <Section icon={<Languages className="size-3.5" />} title={t('topbar.language')}>
                <ToggleRow label={t('settings.language')}>
                  <I18nToggle />
                </ToggleRow>
                <ToggleRow label={t('theme.motion')}>
                  <SegmentedControl
                    size="sm"
                    options={[
                      { label: t('theme.motionSystem'), value: 'system' },
                      { label: t('theme.motionFull'), value: 'full' },
                      { label: t('theme.motionReduced'), value: 'reduced' },
                    ]}
                    value={motion}
                    onChange={(value) => setMotion(value as MotionPreference)}
                  />
                </ToggleRow>
                {/*
                 * 说明这条开关管到哪里
                 *
                 * 早期它只对 CSS 动画生效，数字滚动仍然只看系统媒体查询，
                 * 用户打开「始终开启」后卡片在动、数字却直接跳到位 ——
                 * 现在两者都走 useMotionEnabled()，这里把口径写清楚。
                 */}
                <p className="mt-1.5 px-0.5 text-2xs leading-4 text-fg-3">
                  {isEn
                    ? 'Affects CSS transitions and JS number rolling (KPI cards, dashboards, big screens, RingMetric). Pick “Reduced” to show final values immediately.'
                    : '同时作用于 CSS 过渡与 JS 数字滚动（KPI 卡、工作台与大屏数字、环形指标）。选「减少动效」时数字直接显示终值。'}
                </p>
              </Section>
            </>
          )}
        </div>
      </div>
    </Drawer>
  )
}

/* ------------------------------------------------------------------ *
 * 内部小组件
 * ------------------------------------------------------------------ */

function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h4 className="flex items-center gap-1.5 text-xs font-semibold text-fg-2">
        <span className="text-fg-3">{icon}</span>
        {title}
      </h4>
      {hint && <p className="mt-1 text-2xs leading-4 text-fg-4">{hint}</p>}
      <div className="mt-2">{children}</div>
    </section>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
  children,
}: {
  label: string
  checked?: boolean
  onChange?: (checked: boolean) => void
  children?: React.ReactNode
}) {
  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-line px-2.5 py-2">
      <span className="flex items-center gap-1.5 text-xs text-fg-2">{label}</span>
      {children}
      {onChange && <Switch size="sm" checked={Boolean(checked)} onChange={onChange} />}
    </div>
  )
}

function AccentChip({
  active,
  label,
  gradient,
  onClick,
}: {
  active: boolean
  label: string
  gradient?: [string, string]
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        'group flex w-full flex-col items-center gap-1 rounded-lg border p-1 transition-colors',
        active ? 'border-primary' : 'border-transparent hover:border-line',
      )}
    >
      <span
        className={cn(
          'relative grid h-8 w-full place-items-center overflow-hidden rounded-md border border-black/5',
          active && 'ring-1 ring-primary/40',
          !gradient && 'bg-surface-2',
        )}
        style={
          gradient
            ? { background: `linear-gradient(120deg, ${gradient[0]}, ${gradient[1]})` }
            : undefined
        }
      >
        {active && (
          <span className="grid size-4 place-items-center rounded-full bg-white/90 text-[#0d6efd] shadow-sm">
            <Check className="size-2.5" strokeWidth={3.5} />
          </span>
        )}
        {!active && !gradient && <SwatchBook className="size-3.5 text-fg-3" />}
      </span>
      <span className="w-full truncate text-center text-[0.625rem] text-fg-3">{label}</span>
    </button>
  )
}

/**
 * 皮肤缩略图
 *
 * 关键点：色值**不写在 TS 里**。给根节点挂 `data-skin`，CSS 变量就地生效，
 * 子元素消费的 `var(--n-*)` 全部自动变成这套皮肤的配色 ——
 * 因此缩略图不可能与真实界面脱节，加皮肤也不用改这个文件。
 */
function SkinThumbnail({ skin }: { skin: Skin }) {
  const dark = useUiStore((state) => state.resolvedTheme) === 'dark'
  return (
    <span
      data-skin={skin}
      className={cn('block overflow-hidden rounded-md border border-line/60', dark && 'dark')}
      style={{ backgroundColor: 'var(--n-bg)' }}
      aria-hidden="true"
    >
      <span className="flex h-[3.375rem] w-full">
        {/* 侧栏 */}
        <span
          className="flex h-full w-[30%] flex-col justify-center gap-1 px-1"
          style={{
            backgroundColor: 'var(--n-sidebar-bg)',
            borderInlineEnd: '1px solid var(--n-sidebar-border)',
          }}
        >
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="h-1 w-full rounded-full"
              style={{
                backgroundColor:
                  index === 0 ? 'var(--n-sidebar-active)' : 'var(--n-sidebar-border)',
                boxShadow: index === 0 ? 'inset 2px 0 0 var(--n-sidebar-accent)' : undefined,
              }}
            />
          ))}
        </span>
        {/* 内容区 */}
        <span className="flex h-full flex-1 flex-col gap-1 p-1">
          <span
            className="h-2.5 w-full rounded-[0.1875rem]"
            style={{ backgroundColor: 'var(--n-surface)' }}
          />
          <span className="flex flex-1 items-end gap-[0.1875rem]">
            {[4, 8, 6, 11, 9].map((height, index) => (
              <span
                key={index}
                className="flex-1 rounded-t-[0.125rem]"
                style={{
                  height,
                  backgroundColor: `var(--n-chart-${(index % 3) + 1})`,
                  opacity: 0.9,
                }}
              />
            ))}
          </span>
        </span>
      </span>
    </span>
  )
}

/**
 * 顶部实时预览
 *
 * 消费当前真实令牌（皮肤色、主色、圆角、侧栏配色），并且**跟着菜单布局变形**：
 * 换了布局之后，这里立刻画出「导航在哪一列、顶栏是不是通栏」，
 * 不必先关掉面板再回头看真实界面。缩略图里不放真实菜单（那会重得离谱），
 * 只用色块表达结构，和下面选择器里的线框缩略图形成「结构示意 → 真实配色」的对照。
 */
function LivePreview({ menuLayout }: { menuLayout: MenuLayout }) {
  const topbar = (
    <div
      className="flex shrink-0 items-center gap-1 px-1.5"
      style={{
        height: 18,
        backgroundColor: 'var(--n-surface)',
        borderBottom: '1px solid var(--n-border)',
      }}
    >
      <span className="h-1 w-6 rounded-full" style={{ backgroundColor: 'var(--n-fg-4)' }} />
      {(menuLayout === 'horizontal' || menuLayout === 'mixed') && (
        <span className="flex items-center gap-1">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="h-1.5 w-4 rounded-full"
              style={{
                backgroundColor: index === 0 ? 'var(--n-primary)' : 'var(--n-border-strong)',
              }}
            />
          ))}
        </span>
      )}
      <span className="ml-auto flex items-center gap-1">
        <span
          className="h-2.5 w-5 rounded-[0.125rem]"
          style={{ backgroundColor: 'var(--n-primary)' }}
        />
        <span
          className="size-2.5 rounded-[0.125rem]"
          style={{ backgroundColor: 'var(--n-surface-3)' }}
        />
      </span>
    </div>
  )

  const rail = (width: string, rows = 3, radius = 0) => (
    <div
      className="flex h-full flex-col gap-1 p-1.5"
      style={{
        width,
        flexShrink: 0,
        backgroundColor: 'var(--n-sidebar-bg)',
        borderInlineEnd: '1px solid var(--n-sidebar-border)',
        borderRadius: radius,
      }}
    >
      <span className="h-1 w-5 rounded-full" style={{ backgroundColor: 'var(--n-sidebar-fg-3)' }} />
      {Array.from({ length: rows }).map((_, index) => (
        <span
          key={index}
          className="flex h-2.5 items-center gap-1 rounded-[0.125rem] px-1"
          style={{ backgroundColor: index === 0 ? 'var(--n-sidebar-active)' : 'transparent' }}
        >
          <span
            className="size-1 shrink-0 rounded-full"
            style={{
              backgroundColor: index === 0 ? 'var(--n-sidebar-accent)' : 'var(--n-sidebar-fg-4)',
            }}
          />
          <span
            className="h-0.5 flex-1 rounded-full"
            style={{
              backgroundColor:
                index === 0 ? 'var(--n-sidebar-accent)' : 'var(--n-sidebar-border-strong)',
              opacity: index === 0 ? 0.85 : 0.7,
            }}
          />
        </span>
      ))}
    </div>
  )

  const content = (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2">
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-8 rounded-full" style={{ backgroundColor: 'var(--n-fg-4)' }} />
      </div>
      <div className="grid flex-1 grid-cols-3 gap-1.5">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="flex flex-col justify-center gap-1 rounded-[0.25rem] border p-1"
            style={{ backgroundColor: 'var(--n-surface)', borderColor: 'var(--n-border)' }}
          >
            <span className="h-1 w-4 rounded-full" style={{ backgroundColor: 'var(--n-fg-4)' }} />
            <span className="h-1 w-6 rounded-full" style={{ backgroundColor: 'var(--n-fg-2)' }} />
          </div>
        ))}
      </div>
      <div className="flex items-end gap-1" style={{ height: 18 }}>
        {[7, 11, 8, 14, 10, 16, 12].map((height, index) => (
          <span
            key={index}
            className="flex-1 rounded-t-[0.125rem]"
            style={{ height, backgroundColor: `var(--n-chart-${(index % 4) + 1})` }}
          />
        ))}
      </div>
    </div>
  )

  const frame = (children: React.ReactNode, padded = false) => (
    <div
      className="overflow-hidden rounded-lg border border-line bg-bg"
      style={padded ? { padding: 4, display: 'flex', gap: 4 } : undefined}
    >
      <div
        className={padded ? 'flex flex-1 overflow-hidden rounded-md' : 'flex'}
        style={{ height: 78 }}
      >
        {children}
      </div>
    </div>
  )

  if (menuLayout === 'floating') {
    return frame(
      <>
        <span className="flex min-w-0 flex-1 overflow-hidden rounded-[0.375rem] border border-line">
          {rail('30%')}
        </span>
        <span className="flex min-w-0 flex-[2.2] flex-col overflow-hidden rounded-[0.375rem] border border-line bg-surface">
          {content}
        </span>
      </>,
      true,
    )
  }

  if (menuLayout === 'dual') {
    return frame(
      <>
        {rail('18%', 4)}
        {rail('26%', 3)}
        {content}
      </>,
    )
  }

  if (menuLayout === 'sidebar') {
    return frame(
      <div className="flex min-w-0 flex-1 flex-col">
        {topbar}
        <div className="flex min-h-0 flex-1">
          {rail('30%')}
          {content}
        </div>
      </div>,
    )
  }

  if (menuLayout === 'horizontal') {
    return frame(
      <div className="flex min-w-0 flex-1 flex-col">
        {topbar}
        {content}
      </div>,
    )
  }

  if (menuLayout === 'mixed') {
    return frame(
      <div className="flex min-w-0 flex-1 flex-col">
        {topbar}
        <div className="flex min-h-0 flex-1">
          {rail('28%')}
          {content}
        </div>
      </div>,
    )
  }

  return frame(
    <>
      {rail('30%')}
      {content}
    </>,
  )
}

/** 主题缩略图：左侧栏 + 内容卡片 + 迷你柱状图，用配色区分明暗 */
function ThemePreview({ mode }: { mode: ThemeMode }) {
  const light = { bg: '#f2f3f5', card: '#ffffff', line: '#e4e6eb' }
  const dark = { bg: '#0a0d13', card: '#151a22', line: '#2a313d' }
  const isDark = mode === 'dark'
  const systemSplit = mode === 'system'
  const panel = systemSplit || isDark ? dark : light

  return (
    <span className="block w-full overflow-hidden rounded-md border border-line/60">
      <span className="flex h-[2.875rem] w-full">
        <span
          className="flex h-full w-[26%] flex-col gap-1 p-1"
          style={{ backgroundColor: panel.card }}
        >
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="h-1 w-full rounded-full"
              style={{ backgroundColor: index === 0 ? 'var(--n-primary)' : panel.line }}
            />
          ))}
        </span>
        <span
          className="relative flex h-full flex-1 flex-col gap-1 p-1"
          style={{ backgroundColor: isDark ? dark.bg : light.bg }}
        >
          {systemSplit && (
            <span
              className="absolute inset-y-0 right-0 w-1/2"
              style={{ backgroundColor: light.bg }}
              aria-hidden="true"
            />
          )}
          <span
            className="relative z-10 h-2 w-3/4 rounded-[0.1875rem]"
            style={{
              backgroundColor: isDark ? dark.card : light.card,
              border: `1px solid ${isDark ? dark.line : light.line}`,
            }}
          />
          <span className="relative z-10 flex flex-1 items-end gap-0.5">
            {[5, 9, 7, 12].map((height, index) => (
              <span
                key={index}
                className="w-1 rounded-t-[0.125rem]"
                style={{
                  height,
                  backgroundColor: 'var(--n-primary)',
                  opacity: 0.35 + index * 0.15,
                }}
              />
            ))}
          </span>
        </span>
      </span>
    </span>
  )
}

/** 语言切换（中文 / EN 双态胶囊） */
function I18nToggle() {
  const { locale, setLocale } = useI18n()
  return (
    <span className="inline-flex items-center rounded-md bg-surface-3 p-0.5">
      {(
        [
          { key: 'zh-CN', label: '中文' },
          { key: 'en-US', label: 'EN' },
        ] as const
      ).map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => setLocale(item.key)}
          aria-pressed={locale === item.key}
          className={cn(
            'h-5 rounded-[calc(var(--n-radius)-0.1875rem)] px-2 text-2xs font-medium transition-colors',
            locale === item.key ? 'bg-surface text-fg shadow-xs' : 'text-fg-3 hover:text-fg-2',
          )}
        >
          {item.label}
        </button>
      ))}
    </span>
  )
}
