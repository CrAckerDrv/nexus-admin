import { useState } from 'react'
import {
  Bell,
  CircleCheck,
  Globe,
  Monitor,
  Moon,
  Palette,
  Pipette,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Sun,
  Type,
} from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CodeBlock,
  Descriptions,
  FormField,
  Input,
  PageContainer,
  PageHeader,
  RadioGroup,
  SectionCard,
  SegmentedControl,
  Select,
  SideTabs,
  Switch,
  cn,
  toast,
} from '@nexus/ui'
import type { TabItem } from '@nexus/ui'
import {
  useUiStore,
  ACCENT_PRESETS,
  SKIN_PRESETS,
  type Accent,
  type AccentChoice,
  type LocaleKey,
  type Skin,
  type ThemeMode,
} from '@/core/ui-store'
import {
  formatByPref,
  useAppSettingsStore,
  type NumberFormat,
  type SessionTimeout,
  type TimeZoneKey,
} from '@/core/app-settings-store'
import { colorsForMode } from '@/core/palette'
import { useThemePanelStore } from '@/core/theme-panel-store'
import { MenuLayoutPicker } from '@/layout/menu-layout'

const SECTIONS: TabItem[] = [
  { key: 'appearance', label: '外观与布局', icon: <Palette className="size-3.5" /> },
  { key: 'preferences', label: '交互偏好', icon: <SlidersHorizontal className="size-3.5" /> },
  { key: 'security', label: '安全策略', icon: <Monitor className="size-3.5" /> },
  { key: 'developer', label: '开发者选项', icon: <Type className="size-3.5" /> },
]

const THEME_OPTIONS = [
  { key: 'light', label: '浅色', icon: <Sun className="size-4" /> },
  { key: 'dark', label: '深色', icon: <Moon className="size-4" /> },
  { key: 'system', label: '跟随系统', icon: <Monitor className="size-4" /> },
] as const

const ACCENT_OPTIONS: Array<{ key: Accent; label: string; color: string }> = (
  Object.entries(ACCENT_PRESETS) as Array<[Accent, { label: string; light: string }]>
).map(([key, preset]) => ({ key, label: preset.label, color: preset.light }))

const SKIN_OPTIONS: Array<{ key: Skin; label: string; tagline: string }> = (
  Object.entries(SKIN_PRESETS) as Array<[Skin, { label: string; tagline: string }]>
).map(([key, preset]) => ({ key, label: preset.label, tagline: preset.tagline }))

export default function SettingsPage() {
  const [section, setSection] = useState('appearance')
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
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed)
  const setSidebarCollapsed = useUiStore((state) => state.setSidebarCollapsed)
  const menuLayout = useUiStore((state) => state.menuLayout)
  const setMenuLayout = useUiStore((state) => state.setMenuLayout)
  const tabBar = useUiStore((state) => state.tabBar)
  const locale = useUiStore((state) => state.locale)
  const setLocale = useUiStore((state) => state.setLocale)
  const resetPreferences = useUiStore((state) => state.resetPreferences)
  const [localTabBar, setLocalTabBar] = useState(tabBar)

  // 系统级设置（时区 / 分页 / 数字格式 / 通知 / 安全策略）走独立 store：
  // 它们不属于「外观偏好」，「恢复默认外观」不该把它们一起清掉
  const timeZone = useAppSettingsStore((state) => state.timeZone)
  const setTimeZone = useAppSettingsStore((state) => state.setTimeZone)
  const defaultPageSize = useAppSettingsStore((state) => state.defaultPageSize)
  const setDefaultPageSize = useAppSettingsStore((state) => state.setDefaultPageSize)
  const numberFormat = useAppSettingsStore((state) => state.numberFormat)
  const setNumberFormat = useAppSettingsStore((state) => state.setNumberFormat)
  const notify = useAppSettingsStore((state) => state.notify)
  const setNotify = useAppSettingsStore((state) => state.setNotify)
  const security = useAppSettingsStore((state) => state.security)
  const setSecurity = useAppSettingsStore((state) => state.setSecurity)
  const sessionTimeout = useAppSettingsStore((state) => state.sessionTimeout)
  const setSessionTimeout = useAppSettingsStore((state) => state.setSessionTimeout)
  const savedAt = useAppSettingsStore((state) => state.savedAt)
  const resetAppSettings = useAppSettingsStore((state) => state.reset)

  // 调色盘：只做「状态摘要 + 跳转」，具体取色交给外观抽屉 —— 取色要边看页面边调，
  // 塞进设置页的卡片里会变成「改完还得滚回顶部看效果」
  const palette = useUiStore((state) => state.palette)
  const setPaletteEnabled = useUiStore((state) => state.setPaletteEnabled)
  const openThemePanelAt = useThemePanelStore((state) => state.openAt)
  const countPaletteColors = () => {
    const colors = colorsForMode(palette, false)
    const { charts, ...rest } = colors
    return Object.values(rest).filter(Boolean).length + (charts?.length ? 1 : 0)
  }

  return (
    <PageContainer size="lg">
      <PageHeader
        title="系统设置"
        description="外观、交互与安全策略的一站式配置，改动即时生效并持久化到本地"
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<RotateCcw className="size-3.5" />}
              onClick={() => {
                resetPreferences()
                resetAppSettings()
                toast.success('已恢复默认外观与设置')
              }}
            >
              恢复默认
            </Button>
            <Button
              variant="primary"
              leftIcon={<Save className="size-3.5" />}
              onClick={() => {
                // 每个控件都已经即时落库，这个按钮负责「确认 + 给出时间戳」：
                // 演示环境没有后端，写一次 localStorage 就是真实的保存动作
                useAppSettingsStore.setState({ savedAt: new Date().toISOString() })
                toast.success(
                  savedAt
                    ? `设置已保存 · 上次保存 ${new Date(savedAt).toLocaleTimeString('zh-CN')}`
                    : '设置已保存（本地持久化）',
                )
              }}
            >
              保存设置
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[200px_minmax(0,1fr)]">
        <Card bare className="p-2">
          <SideTabs items={SECTIONS} value={section} onChange={setSection} />
        </Card>

        <div className="space-y-3">
          {section === 'appearance' && (
            <>
              <SectionCard title="主题模式" description="深色模式基于 CSS 变量，切换无闪烁">
                <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-3">
                  {THEME_OPTIONS.map((option) => {
                    const active = theme === option.key
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setTheme(option.key as ThemeMode)}
                        className={cn(
                          'flex items-center gap-2 rounded-md border px-3 py-2.5 text-left transition-colors',
                          active
                            ? 'border-primary bg-primary-weak/60'
                            : 'border-line hover:border-line-strong',
                        )}
                      >
                        <span
                          className={cn(
                            'grid size-7 place-items-center rounded-md',
                            active ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-fg-3',
                          )}
                        >
                          {option.icon}
                        </span>
                        <span className="text-[0.8125rem] font-medium text-fg">{option.label}</span>
                        {active && <CircleCheck className="ml-auto size-4 text-primary" />}
                      </button>
                    )
                  })}
                </div>
              </SectionCard>

              <SectionCard
                title="皮肤"
                description="一套皮肤同时决定底色、侧栏、图表色板与投影质感；也可以在这里直接预览切换"
              >
                <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {SKIN_OPTIONS.map((option) => {
                    const active = skin === option.key
                    const preset = SKIN_PRESETS[option.key]
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setSkin(option.key)}
                        aria-pressed={active}
                        className={cn(
                          'flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors',
                          active
                            ? 'border-primary bg-primary-weak/50'
                            : 'border-line hover:border-line-strong',
                        )}
                      >
                        {/* 三色小圆点：侧栏 / 主色 / 图表辅助色，用真实资产而不是再抄一份色值 */}
                        <span className="flex shrink-0 -space-x-1">
                          {preset.swatch.map((color, index) => (
                            <span
                              key={index}
                              className="size-4 rounded-full border border-black/10"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-fg">
                            {option.label}
                          </span>
                          <span className="block truncate text-2xs text-fg-3">
                            {option.tagline}
                          </span>
                        </span>
                        {active && <CircleCheck className="size-4 shrink-0 text-primary" />}
                      </button>
                    )
                  })}
                </div>
              </SectionCard>

              <SectionCard
                title="调色盘"
                description="按区域自定义配色：页面底、卡片、顶栏、侧栏、主色、描边、正文与图表；没改的区域继续跟随皮肤"
              >
                <div className="flex flex-wrap items-center gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-fg">
                      {palette.enabled ? '已启用自定义配色' : '当前跟随皮肤配色'}
                    </p>
                    <p className="mt-0.5 text-2xs text-fg-3">
                      {countPaletteColors() > 0
                        ? `已自定义 ${countPaletteColors()} 个区域，明暗两套分开保存`
                        : '还没有自定义任何区域，点右侧按钮开始调色'}
                    </p>
                  </div>
                  <SegmentedControl
                    size="sm"
                    options={[
                      { label: '跟随皮肤', value: 'off' },
                      { label: '自定义', value: 'on' },
                    ]}
                    value={palette.enabled ? 'on' : 'off'}
                    onChange={(value) => setPaletteEnabled(value === 'on')}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<Pipette className="size-3.5" />}
                    onClick={() => openThemePanelAt('palette')}
                  >
                    打开调色盘
                  </Button>
                </div>
              </SectionCard>

              <SectionCard
                title="强调色"
                description="只替换品牌主色；「跟随皮肤」则使用皮肤自带的主色"
              >
                <div className="flex flex-wrap gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => setAccent('auto')}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                      accent === 'auto'
                        ? 'border-primary font-medium text-primary'
                        : 'border-line text-fg-2 hover:border-line-strong',
                    )}
                  >
                    <span className="grid size-3.5 place-items-center rounded-full border border-dashed border-current" />
                    跟随皮肤
                  </button>
                  {ACCENT_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setAccent(option.key as AccentChoice)}
                      className={cn(
                        'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                        accent === option.key
                          ? 'border-primary font-medium text-primary'
                          : 'border-line text-fg-2 hover:border-line-strong',
                      )}
                    >
                      <span
                        className="size-3.5 rounded-full border border-black/10"
                        style={{ backgroundColor: option.color }}
                      />
                      {option.label}
                    </button>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="形状与密度"
                description="控制圆角与控件高度，适配不同屏幕与行业审美"
              >
                <div className="space-y-3 p-3">
                  <FormField label="圆角风格" inline>
                    <SegmentedControl
                      options={[
                        { label: '直角', value: 'none' },
                        { label: '小圆角', value: 'small' },
                        { label: '中圆角', value: 'medium' },
                        { label: '大圆角', value: 'large' },
                      ]}
                      value={radius}
                      onChange={(value) => setRadius(value as typeof radius)}
                      block
                    />
                  </FormField>
                  <FormField label="界面密度" inline>
                    <SegmentedControl
                      options={[
                        { label: '紧凑', value: 'compact' },
                        { label: '默认', value: 'default' },
                        { label: '宽松', value: 'comfortable' },
                        { label: '超大', value: 'ultra' },
                      ]}
                      value={density}
                      onChange={(value) => setDensity(value as typeof density)}
                      block
                    />
                  </FormField>
                  <FormField label="多页签" inline hint="开启后在顶部显示已访问页面的快捷标签">
                    <Switch
                      checked={localTabBar}
                      onChange={(checked) => {
                        setLocalTabBar(checked)
                        useUiStore.setState({ tabBar: checked })
                      }}
                      label={<span className="text-xs">显示页签栏</span>}
                    />
                  </FormField>
                </div>
              </SectionCard>

              {/*
               * 菜单布局
               *
               * 与外观面板「布局」页签里的选择器共用同一个组件与同一份 store，
               * 因此两处改的是同一个值，不存在「设置页改了、抽屉没跟着变」的分裂。
               * 放在外观分组里而不是交互偏好：它改的是视觉结构，不是行为偏好。
               */}
              <SectionCard
                title="菜单布局"
                description="导航摆在哪：侧栏、双列导轨、顶栏或混合；六种布局都能和任意皮肤、配色组合"
              >
                <div className="space-y-3 p-3">
                  <MenuLayoutPicker value={menuLayout} onChange={setMenuLayout} />
                  {menuLayout !== 'horizontal' && (
                    <FormField label="收起导航" inline hint="折叠成图标轨道，或收掉子菜单列">
                      <Switch
                        checked={sidebarCollapsed}
                        onChange={setSidebarCollapsed}
                        label={<span className="text-xs">默认收起</span>}
                      />
                    </FormField>
                  )}
                </div>
              </SectionCard>
            </>
          )}

          {section === 'preferences' && (
            <>
              <SectionCard title="通知偏好" description="选择接收哪些类型的系统通知">
                <div className="divide-y divide-line-subtle">
                  {(
                    [
                      {
                        key: 'business',
                        title: '业务提醒',
                        desc: '新订单、异常交易与待办审批',
                      },
                      {
                        key: 'security',
                        title: '安全告警',
                        desc: '异地登录、权限变更与敏感操作',
                      },
                      { key: 'system', title: '系统公告', desc: '版本更新与维护通知' },
                      { key: 'weekly', title: '周报邮件', desc: '每周一发送经营数据摘要' },
                    ] as const
                  ).map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-[0.8125rem] text-fg">{item.title}</p>
                        <p className="mt-0.5 text-2xs text-fg-3">{item.desc}</p>
                      </div>
                      <Switch
                        checked={notify[item.key]}
                        onChange={(checked) => setNotify(item.key, checked)}
                      />
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="语言与地区" description="影响日期、数字与货币格式">
                <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
                  <FormField label="界面语言" hint="切换立即生效，无需刷新">
                    <Select
                      options={[
                        { label: '简体中文', value: 'zh-CN' },
                        { label: 'English', value: 'en-US' },
                      ]}
                      value={locale}
                      onChange={(value) => setLocale(value as LocaleKey)}
                    />
                  </FormField>
                  <FormField label="时区" hint="影响绝对时间与「x 小时前」的计算基准">
                    <Select
                      options={[
                        { label: '(UTC+08:00) 北京 / 上海', value: 'Asia/Shanghai' },
                        { label: '(UTC+00:00) 伦敦', value: 'Europe/London' },
                        { label: '(UTC-08:00) 洛杉矶', value: 'America/Los_Angeles' },
                      ]}
                      value={timeZone}
                      onChange={(value) => setTimeZone(value as TimeZoneKey)}
                    />
                  </FormField>
                  <FormField label="默认页码大小" hint="新打开的列表页默认用这个条数">
                    <Select
                      options={[
                        { label: '10 条/页', value: '10' },
                        { label: '20 条/页', value: '20' },
                        { label: '50 条/页', value: '50' },
                      ]}
                      value={String(defaultPageSize)}
                      searchable
                      onChange={(value) => setDefaultPageSize(Number(value))}
                    />
                  </FormField>
                  <FormField
                    label="数字格式"
                    hint={`当前示例：${formatByPref(1234.56, numberFormat)}`}
                  >
                    <RadioGroup
                      direction="horizontal"
                      options={[
                        { label: '1,234.56', value: 'comma' },
                        { label: '1 234,56', value: 'space' },
                      ]}
                      value={numberFormat}
                      onChange={(value) => setNumberFormat(value as NumberFormat)}
                    />
                  </FormField>
                </div>
              </SectionCard>
            </>
          )}

          {section === 'security' && (
            <>
              <Alert tone="warning" title="安全策略为全局配置" compact>
                修改后将影响所有管理员账号，建议先在小范围灰度验证。
              </Alert>
              <SectionCard title="登录与会话">
                <div className="divide-y divide-line-subtle">
                  {(
                    [
                      {
                        key: 'forceMfa',
                        title: '强制两步验证',
                        desc: '管理员角色必须绑定 MFA 才能登录',
                      },
                      {
                        key: 'verifyForeignLogin',
                        title: '异地登录校验',
                        desc: '检测到异常地区登录时要求二次验证',
                      },
                      {
                        key: 'sso',
                        title: '单点登录（SSO）',
                        desc: '对接企业 IdP（OIDC / SAML 2.0）',
                      },
                    ] as const
                  ).map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div>
                        <p className="text-[0.8125rem] text-fg">{item.title}</p>
                        <p className="mt-0.5 text-2xs text-fg-3">{item.desc}</p>
                      </div>
                      <Switch
                        checked={security[item.key]}
                        onChange={(checked) => setSecurity(item.key, checked)}
                      />
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div>
                      <p className="text-[0.8125rem] text-fg">会话有效期</p>
                      <p className="mt-0.5 text-2xs text-fg-3">超时后需要重新登录</p>
                    </div>
                    <Select
                      className="w-[8.75rem]"
                      options={[
                        { label: '2 小时', value: '2h' },
                        { label: '8 小时', value: '8h' },
                        { label: '24 小时', value: '24h' },
                        { label: '7 天', value: '7d' },
                      ]}
                      value={sessionTimeout}
                      onChange={(value) => setSessionTimeout(value as SessionTimeout)}
                    />
                  </div>
                </div>
              </SectionCard>
              <SectionCard
                title="密码策略"
                description="保存时校验范围，避免出现「最小长度 0 位」这种配置"
              >
                <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
                  <FormField label="最小长度" hint="8 ~ 64 位">
                    <Input
                      type="number"
                      value={String(security.minPasswordLength)}
                      min={8}
                      max={64}
                      addonAfter="位"
                      onChange={(event) => {
                        const next = Number(event.target.value)
                        setSecurity(
                          'minPasswordLength',
                          Number.isFinite(next) ? Math.min(64, Math.max(8, next)) : 8,
                        )
                      }}
                    />
                  </FormField>
                  <FormField label="更换周期" hint="30 ~ 365 天">
                    <Input
                      type="number"
                      value={String(security.rotateDays)}
                      min={30}
                      max={365}
                      addonAfter="天"
                      onChange={(event) => {
                        const next = Number(event.target.value)
                        setSecurity(
                          'rotateDays',
                          Number.isFinite(next) ? Math.min(365, Math.max(30, next)) : 30,
                        )
                      }}
                    />
                  </FormField>
                </div>
              </SectionCard>
            </>
          )}

          {section === 'developer' && (
            <>
              <SectionCard title="技术栈与运行信息">
                <div className="p-3">
                  <Descriptions
                    columns={2}
                    size="sm"
                    items={[
                      { label: 'React', value: '19.3.1' },
                      { label: 'Vite', value: '8.3.5' },
                      { label: 'TypeScript', value: '6.0.3' },
                      { label: 'Tailwind CSS', value: '4.3.4' },
                      { label: 'TanStack Router', value: '1.170.46' },
                      { label: 'TanStack Query', value: '5.105.3' },
                      { label: 'Zustand', value: '5.0.16' },
                      { label: 'ECharts', value: '6.1.0' },
                    ]}
                  />
                </div>
              </SectionCard>
              <SectionCard title="接入真实后端" description="三步完成切换">
                <div className="p-3">
                  <CodeBlock
                    language="ts"
                    filename="src/core/http.ts"
                    maxHeight={260}
                    code={`// 1. 设置接口基地址
// .env.local
VITE_API_BASE=https://api.your-domain.com

// 2. 删除 Mock 启动（src/main.tsx）
// await startMockServer()

// 3. 数据层无需改动，页面照常工作
export const api = {
  get: <T>(path: string, config?: RequestConfig) => request<T>(path, { ...config, method: 'GET' }),
  post: <T>(path: string, body?: unknown, config?: RequestConfig) =>
    request<T>(path, { ...config, method: 'POST', body }),
}`}
                  />
                </div>
              </SectionCard>
              <SectionCard title="设计令牌" description="所有颜色、圆角、密度都来自 CSS 变量">
                <div className="p-3">
                  <CodeBlock
                    language="css"
                    filename="packages/ui/src/styles/tokens.css"
                    maxHeight={220}
                    code={`:root {
  --n-primary: #0d6efd;
  --n-surface: #ffffff;
  --n-radius: 8px;
  --n-control-h: 34px;
}

/* 组件里只需要语义类 */
<button className="h-[var(--n-control-h)] rounded-md bg-primary text-primary-fg">
  保存
</button>`}
                  />
                </div>
              </SectionCard>
            </>
          )}
        </div>
      </div>

      <Card className="mt-3 flex flex-wrap items-center gap-3">
        <Badge tone="primary">提示</Badge>
        <p className="text-xs text-fg-3">
          外观偏好保存于{' '}
          <code className="rounded bg-surface-2 px-1 font-mono">localStorage: nexus-ui-prefs</code>
          ，时区 / 分页 / 通知 / 安全策略保存于{' '}
          <code className="rounded bg-surface-2 px-1 font-mono">nexus-app-settings</code>
          ；两者都即时落库，首帧由 index.html 的内联脚本提前应用，避免深色模式闪白。
        </p>
        <Button
          size="xs"
          variant="ghost"
          className="ml-auto"
          leftIcon={<Bell className="size-3" />}
          // 「测试通知」原来只是一个固定 toast；现在按通知偏好决定发不发，
          // 于是「通知偏好」那组开关立刻有了可验证的效果
          onClick={() =>
            notify.business
              ? toast.success('测试通知已发送（业务提醒已开启）')
              : toast.info('业务提醒已关闭，测试通知被拦截')
          }
        >
          测试通知
        </Button>
        <Button
          size="xs"
          variant="ghost"
          leftIcon={<Globe className="size-3" />}
          onClick={() => toast.success(`网络状态正常 · 时区 ${timeZone}`)}
        >
          测试连通性
        </Button>
      </Card>
    </PageContainer>
  )
}
