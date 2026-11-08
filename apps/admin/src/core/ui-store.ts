import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  EMPTY_PALETTE,
  applyPalette,
  colorsForMode,
  sampleSkinColors,
  type CustomPalette,
  type PaletteColors,
  type PaletteRegionKey,
} from './palette'

export type ThemeMode = 'light' | 'dark' | 'system'
/**
 * 皮肤（skin）
 *
 * 和「强调色」的分工：
 * - 皮肤决定**整套视觉气质**：中性色阶、侧栏配色、图表色板、投影质感
 * - 强调色只覆盖主色，用于「换了皮肤但想保留品牌色」的场景
 */
export type Skin =
  | 'cloud'
  | 'graphite'
  | 'sand'
  | 'pine'
  | 'ocean'
  | 'neon'
export type Accent =
  | 'blue'
  | 'violet'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'rosewood'
  | 'ocean'
  | 'sunset'
  | 'forest'
  | 'lavender'
/** 强调色选择：'auto' 表示跟随皮肤主色 */
export type AccentChoice = Accent | 'auto'
export type RadiusScale = 'none' | 'small' | 'medium' | 'large' | 'xlarge'
export type DensityScale = 'compact' | 'default' | 'comfortable' | 'ultra'
export type FontFamily = 'auto' | 'sans' | 'serif' | 'mono'
/**
 * 菜单布局
 *
 * 参考 Art Design Pro 的菜单布局方案并扩展两档：
 * - `vertical`  垂直：经典左侧边栏，整屏高度，分组可折叠成图标轨道
 * - `dual`      双列：模块导轨 + 当前模块子菜单，两级并列常驻
 * - `horizontal` 水平：模块全部横排在顶栏，悬停展开下拉，无侧栏
 * - `mixed`     混合：顶栏横排一级模块，左侧只放当前模块的子菜单
 * - `floating`  悬浮：结构同垂直，但侧栏与内容区是两块独立的圆角卡片
 * - `sidebar`   侧边栏：顶栏通栏在最上方，侧栏退到它下面（L 形）
 *
 * 与「整体布局」（`layout`）的分工：
 * 菜单布局决定**导航摆在哪**，整体布局决定**外壳留多少白、页面是否全屏**，
 * 两者正交，可以自由组合。
 */
export type MenuLayout = 'vertical' | 'dual' | 'horizontal' | 'mixed' | 'floating' | 'sidebar'
export type LayoutVariant = 'default' | 'compact' | 'fullscreen'
export type ContentWidth = 'full' | 'centered'
export type Direction = 'ltr' | 'rtl'
export type LocaleKey = 'zh-CN' | 'en-US'
/** 动效偏好：跟随系统 / 始终开启 / 减少 */
export type MotionPreference = 'system' | 'full' | 'reduced'

export interface UiPreferences {
  theme: ThemeMode
  /** 皮肤：决定中性色、侧栏、图表与投影 */
  skin: Skin
  /** 强调色覆盖；'auto' 跟随皮肤 */
  accent: AccentChoice
  radius: RadiusScale
  density: DensityScale
  font: FontFamily
  sidebarCollapsed: boolean
  /** 菜单布局：垂直 / 双列 / 水平 / 混合 / 悬浮 / 侧边栏 */
  menuLayout: MenuLayout
  /** 整体布局：默认 / 紧凑 / 全屏（全屏隐藏侧栏，改为浮层导航） */
  layout: LayoutVariant
  /** 内容区宽度：全宽 / 居中 */
  contentWidth: ContentWidth
  /** 文字方向 */
  direction: Direction
  /** 多页签 */
  tabBar: boolean
  /** 界面语言 */
  locale: LocaleKey
  /**
   * 动效偏好
   *
   * 优先级高于系统的 `prefers-reduced-motion`：
   * 很多 Windows 用户默认关闭了「显示动画」，导致换页/侧栏过渡全部消失，
   * 这里给一个应用内开关，让用户自己能决定是否要动效。
   */
  motion: MotionPreference
  /** 手动收起的导航分组 id（默认全部展开） */
  collapsedGroups: string[]
  /**
   * 自定义调色盘
   *
   * 与「皮肤」「强调色」的关系：调色盘是**叠加层**。
   * 只用它覆盖用户真正改过的区域，没动过的部分继续由皮肤决定，
   * 所以「换皮肤」与「微调某几个区域」不会互相打架。
   */
  palette: CustomPalette
}

export interface TabItem {
  key: string
  title: string
  path: string
  closable: boolean
}

interface UiState extends UiPreferences {
  setTheme: (theme: ThemeMode) => void
  setSkin: (skin: Skin) => void
  setAccent: (accent: AccentChoice) => void
  setRadius: (radius: RadiusScale) => void
  setDensity: (density: DensityScale) => void
  setFont: (font: FontFamily) => void
  setMenuLayout: (layout: MenuLayout) => void
  setLayout: (layout: LayoutVariant) => void
  setContentWidth: (width: ContentWidth) => void
  setDirection: (direction: Direction) => void
  setLocale: (locale: LocaleKey) => void
  setMotion: (motion: MotionPreference) => void
  setTabBar: (enabled: boolean) => void
  /** 开关调色盘（关闭 = 跟随皮肤，自定义值保留以便再打开） */
  setPaletteEnabled: (enabled: boolean) => void
  /**
   * 设置某个区域颜色；传 null 表示「跟随皮肤」
   *
   * `target` 显式指定要改明色还是暗色那套 —— 面板里可以先切到「暗色」预览再改，
   * 不能靠「当前解析出来的明暗」去猜，否则用户会改错另一套而不自知。
   */
  setPaletteColor: (
    region: PaletteRegionKey,
    color: string | null,
    target?: 'light' | 'dark',
  ) => void
  /** 整体替换某个模式下的图表色板（不传 target 则用当前解析出来的明暗） */
  setPaletteCharts: (charts: string[], target?: 'light' | 'dark') => void
  /** 用当前皮肤的配色一次性填充（作为自定义的起点） */
  sampleFromSkin: () => void
  /** 清空当前模式的全部自定义 */
  clearPalette: () => void
  /** 直接从 localStorage 导入一份调色盘（贴 JSON 用） */
  importPalette: (palette: CustomPalette) => void
  /** 切换导航分组展开状态 */
  toggleGroup: (groupId: string) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  resetPreferences: () => void
  /** 当前系统是否深色 */
  resolvedTheme: 'light' | 'dark'
  syncResolvedTheme: () => void
  // 标签页
  tabs: TabItem[]
  activeTab: string
  openTab: (tab: TabItem) => void
  closeTab: (key: string) => void
  closeOthers: (key: string) => void
  setActiveTab: (key: string) => void
}

const DEFAULTS: UiPreferences = {
  theme: 'light',
  skin: 'cloud',
  accent: 'auto',
  radius: 'medium',
  density: 'default',
  font: 'auto',
  sidebarCollapsed: false,
  menuLayout: 'vertical',
  layout: 'default',
  contentWidth: 'centered',
  direction: 'ltr',
  tabBar: true,
  locale: 'zh-CN',
  motion: 'system',
  collapsedGroups: [],
  palette: EMPTY_PALETTE,
}

/**
 * 皮肤清单
 *
 * `swatch` 只用于「选择器上的三色小圆点」这类无法依赖 CSS 变量的场景；
 * 真正的预览卡片直接挂 `data-skin`，色值由 tokens.css 提供 ——
 * 这样调色只改一个文件，TS 里不会再抄一份色值。
 */
export const SKIN_PRESETS: Record<
  Skin,
  {
    label: string
    labelEn: string
    tagline: string
    taglineEn: string
    /** 选择器圆点：[侧栏, 主色, 图表辅助色] */
    swatch: [string, string, string]
    /** 该皮肤偏好的深色侧栏（用于标注「深色导航」） */
    darkRail: boolean
  }
> = {
  cloud: {
    label: '清透云',
    labelEn: 'Cloud',
    tagline: '中性灰底 · 品牌蓝',
    taglineEn: 'Neutral grey · brand blue',
    swatch: ['#ffffff', '#0d6efd', '#12a150'],
    darkRail: false,
  },
  graphite: {
    label: '石墨工作台',
    labelEn: 'Graphite',
    tagline: '冷灰底 · 深色导航',
    taglineEn: 'Cool grey · dark rail',
    swatch: ['#171a21', '#4f46e5', '#0ea5e9'],
    darkRail: true,
  },
  sand: {
    label: '暖砂纸',
    labelEn: 'Warm Sand',
    tagline: '米色底 · 陶土橙',
    taglineEn: 'Paper beige · terracotta',
    swatch: ['#fbf5e9', '#c2410c', '#b7791f'],
    darkRail: false,
  },
  pine: {
    label: '松间',
    labelEn: 'Pine',
    tagline: '青绿底 · 云杉导航',
    taglineEn: 'Sage · spruce rail',
    swatch: ['#0f2018', '#15803d', '#0e7490'],
    darkRail: true,
  },
  ocean: {
    label: '深海',
    labelEn: 'Deep Sea',
    tagline: '海军蓝 · 青蓝主色',
    taglineEn: 'Navy · cyan',
    swatch: ['#0b1d33', '#0891b2', '#2563eb'],
    darkRail: true,
  },
  neon: {
    label: '霓虹夜航',
    labelEn: 'Neon Night',
    tagline: '紫青撞色 · 发光投影',
    taglineEn: 'Violet & cyan · glow',
    swatch: ['#1a1033', '#7c3aed', '#06b6d4'],
    darkRail: true,
  },
}

/** 强调色预设：只覆盖主色，颜色之外的一切由皮肤决定 */
export const ACCENT_PRESETS: Record<
  Accent,
  { label: string; labelEn: string; light: string; dark: string; swatch: [string, string] }
> = {
  blue: {
    label: '品牌蓝',
    labelEn: 'Brand Blue',
    light: '#0d6efd',
    dark: '#4c8dff',
    swatch: ['#0d6efd', '#4c8dff'],
  },
  violet: {
    label: '极光紫',
    labelEn: 'Aurora Violet',
    light: '#7c3aed',
    dark: '#a78bfa',
    swatch: ['#7c3aed', '#c4b5fd'],
  },
  emerald: {
    label: '翡翠绿',
    labelEn: 'Emerald',
    light: '#059669',
    dark: '#34d399',
    swatch: ['#059669', '#6ee7b7'],
  },
  amber: {
    label: '琥珀橙',
    labelEn: 'Amber',
    light: '#d97706',
    dark: '#fbbf24',
    swatch: ['#d97706', '#fcd34d'],
  },
  rose: {
    label: '玫瑰红',
    labelEn: 'Rose',
    light: '#e11d48',
    dark: '#fb7185',
    swatch: ['#e11d48', '#fda4af'],
  },
  rosewood: {
    label: '玫瑰花园',
    labelEn: 'Rosewood',
    light: '#be185d',
    dark: '#f472b6',
    swatch: ['#be185d', '#f9a8d4'],
  },
  ocean: {
    label: '海风',
    labelEn: 'Ocean Breeze',
    light: '#0e7490',
    dark: '#22d3ee',
    swatch: ['#0e7490', '#67e8f9'],
  },
  sunset: {
    label: '日落霞光',
    labelEn: 'Sunset Glow',
    light: '#ea580c',
    dark: '#fb923c',
    swatch: ['#ea580c', '#fdba74'],
  },
  forest: {
    label: '森林低语',
    labelEn: 'Forest Whisper',
    light: '#15803d',
    dark: '#4ade80',
    swatch: ['#15803d', '#86efac'],
  },
  lavender: {
    label: '薰衣草梦',
    labelEn: 'Lavender Dream',
    light: '#6366f1',
    dark: '#a5b4fc',
    swatch: ['#6366f1', '#c7d2fe'],
  },
}

function applyToDocument(state: UiPreferences) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const prefersDark =
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = state.theme === 'dark' || (state.theme === 'system' && prefersDark)
  root.classList.toggle('dark', dark)
  root.dataset.theme = dark ? 'dark' : 'light'
  root.dataset.skin = state.skin
  // 'auto' = 跟随皮肤主色：此时不写 data-accent，让皮肤自己的主色生效
  if (state.accent === 'auto') delete root.dataset.accent
  else root.dataset.accent = state.accent
  root.dataset.radius = state.radius
  root.dataset.density = state.density
  root.dataset.font = state.font
  root.dataset.menuLayout = state.menuLayout
  root.dataset.layout = state.layout
  root.dataset.content = state.contentWidth
  root.dataset.dir = state.direction
  root.setAttribute('dir', state.direction)
  // 动效：system 时不写 data-motion，交给 CSS 媒体查询；full/reduced 显式覆盖
  if (state.motion === 'system') delete root.dataset.motion
  else root.dataset.motion = state.motion === 'reduced' ? 'reduced' : 'full'
  /**
   * 调色盘写在 `<html style>` 的行内变量上
   *
   * 放在最后一步：它必须作用在「已经算好 dark / skin / accent」的同一帧里，
   * 否则会先看到皮肤的底色再被覆盖，切深浅色时会出现一帧跳色。
   */
  applyPalette(root, state.palette ?? EMPTY_PALETTE, dark)
}

let mediaQuery: MediaQueryList | null = null

/** 主题变更事件：图表等命令式渲染方监听它刷新色板 */
export const THEME_CHANGE_EVENT = 'nexus:theme-change'

function notifyThemeChange() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT))
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      resolvedTheme: 'light',

      setTheme: (theme) => {
        applyToDocument({ ...pickPrefs(get()), theme })
        set({ theme, resolvedTheme: computeResolved(theme) })
        notifyThemeChange()
      },
      setSkin: (skin) => {
        applyToDocument({ ...pickPrefs(get()), skin })
        set({ skin })
        notifyThemeChange()
      },
      setAccent: (accent) => {
        applyToDocument({ ...pickPrefs(get()), accent })
        set({ accent })
        notifyThemeChange()
      },
      setRadius: (radius) => {
        applyToDocument({ ...pickPrefs(get()), radius })
        set({ radius })
      },
      setDensity: (density) => {
        applyToDocument({ ...pickPrefs(get()), density })
        set({ density })
      },
      setFont: (font) => {
        applyToDocument({ ...pickPrefs(get()), font })
        set({ font })
      },
      setMenuLayout: (menuLayout) => {
        applyToDocument({ ...pickPrefs(get()), menuLayout })
        set({ menuLayout })
      },
      setLayout: (layout) => {
        applyToDocument({ ...pickPrefs(get()), layout })
        set({ layout })
      },
      setContentWidth: (contentWidth) => {
        applyToDocument({ ...pickPrefs(get()), contentWidth })
        set({ contentWidth })
      },
      setDirection: (direction) => {
        applyToDocument({ ...pickPrefs(get()), direction })
        set({ direction })
      },
      setLocale: (locale) => set({ locale }),
      setMotion: (motion) => {
        applyToDocument({ ...pickPrefs(get()), motion })
        set({ motion })
      },
      setTabBar: (tabBar) => set({ tabBar }),

      /* ---------------- 调色盘 ---------------- */

      setPaletteEnabled: (enabled) => {
        const palette = { ...get().palette, enabled }
        applyToDocument({ ...pickPrefs(get()), palette })
        set({ palette })
        notifyThemeChange()
      },
      setPaletteColor: (region, color, target) => {
        const state = get()
        // 目标模式由调用方指定：面板里可以先预览「暗色那套」再改，
        // 如果这里偷偷用「当前解析出来的明暗」，改的就会是另一套（很难发现的错）
        const mode = target ?? (computeResolved(state.theme) === 'dark' ? 'dark' : 'light')
        const current = colorsForMode(state.palette, mode === 'dark')
        // region === 'chart' 走 setPaletteCharts；这里只处理单色区域
        const nextColors: PaletteColors = { ...current }
        const key = region as Exclude<PaletteRegionKey, 'chart'>
        if (color) nextColors[key] = color
        else delete nextColors[key]
        const palette: CustomPalette = {
          ...state.palette,
          // 只要动了一个区域，就自动打开 —— 改完却看不到效果是最常见的困惑
          enabled: true,
          [mode]: nextColors,
        }
        applyToDocument({ ...pickPrefs(state), palette })
        set({ palette })
        notifyThemeChange()
      },
      setPaletteCharts: (charts, target) => {
        const state = get()
        const mode = target ?? (computeResolved(state.theme) === 'dark' ? 'dark' : 'light')
        const palette: CustomPalette = {
          ...state.palette,
          enabled: true,
          [mode]: { ...colorsForMode(state.palette, mode === 'dark'), charts },
        }
        applyToDocument({ ...pickPrefs(state), palette })
        set({ palette })
        notifyThemeChange()
      },
      sampleFromSkin: () => {
        const { light, dark } = sampleSkinColors()
        // 取样只是「把皮肤现有的配色抄进自定义」，默认仍保持关闭状态：
        // 用户取样之后通常要继续改一两个区域，改完才真正生效
        const palette: CustomPalette = { ...get().palette, light, dark }
        applyToDocument({ ...pickPrefs(get()), palette })
        set({ palette })
        notifyThemeChange()
      },
      clearPalette: () => {
        const state = get()
        const dark = computeResolved(state.theme) === 'dark'
        const mode = dark ? 'dark' : 'light'
        const palette: CustomPalette = { ...state.palette, [mode]: {} }
        applyToDocument({ ...pickPrefs(state), palette })
        set({ palette })
        notifyThemeChange()
      },
      importPalette: (palette) => {
        applyToDocument({ ...pickPrefs(get()), palette })
        set({ palette })
        notifyThemeChange()
      },

      toggleGroup: (groupId) =>
        set((state) => ({
          collapsedGroups: state.collapsedGroups.includes(groupId)
            ? state.collapsedGroups.filter((id) => id !== groupId)
            : [...state.collapsedGroups, groupId],
        })),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      resetPreferences: () => {
        // 保留语言与页签开关，只重置视觉相关的偏好
        const { locale, tabBar } = get()
        applyToDocument({ ...DEFAULTS, locale, tabBar })
        set({ ...DEFAULTS, locale, tabBar })
        notifyThemeChange()
      },
      syncResolvedTheme: () => set({ resolvedTheme: computeResolved(get().theme) }),

      tabs: [],
      activeTab: '',
      openTab: (tab) =>
        set((state) => {
          const exists = state.tabs.some((item) => item.key === tab.key)
          return {
            tabs: exists
              ? state.tabs.map((item) =>
                  item.key === tab.key ? { ...item, title: tab.title } : item,
                )
              : [...state.tabs, tab],
            activeTab: tab.key,
          }
        }),
      closeTab: (key) =>
        set((state) => {
          const index = state.tabs.findIndex((item) => item.key === key)
          const tabs = state.tabs.filter((item) => item.key !== key)
          const fallback = tabs[Math.max(0, index - 1)] ?? tabs[0]
          return {
            tabs,
            activeTab: state.activeTab === key ? (fallback?.key ?? '') : state.activeTab,
          }
        }),
      closeOthers: (key) =>
        set((state) => ({
          tabs: state.tabs.filter((item) => item.key === key || !item.closable),
          activeTab: key,
        })),
      setActiveTab: (key) => set({ activeTab: key }),
    }),
    {
      name: 'nexus-ui-prefs',
      version: 6,
      partialize: (state) => ({
        theme: state.theme,
        skin: state.skin,
        accent: state.accent,
        radius: state.radius,
        density: state.density,
        font: state.font,
        sidebarCollapsed: state.sidebarCollapsed,
        menuLayout: state.menuLayout,
        layout: state.layout,
        contentWidth: state.contentWidth,
        direction: state.direction,
        tabBar: state.tabBar,
        locale: state.locale,
        motion: state.motion,
        collapsedGroups: state.collapsedGroups,
        palette: state.palette,
      }),
      migrate: (persisted, version) => {
        /**
         * v1 → v2：旧的 radius/density 枚举值需要对齐
         * v2 → v3：补 motion
         * v3 → v4：引入皮肤；旧的 'blue' 其实是默认值，迁移成 'auto'（跟随皮肤），
         *          其余显式选择保留 —— 用户当时就是想要那个颜色
         * v4 → v5：侧边栏三档形态（attached / floating / panel）升级为六种菜单布局；
         *          floating 有直接对应项，attached / panel 都回落到 vertical
         *          （两者的差异本来只是外边距，已并入「整体布局」）
         * v5 → v6：引入用户自定义调色盘；老用户没有这个字段，补一个「关闭」的空盘，
         *          保证不会被默认值意外染色
         */
        const old = (persisted ?? {}) as Record<string, unknown>
        const legacySidebar = old.sidebarVariant
        const migratedLayout: MenuLayout =
          legacySidebar === 'floating' ? 'floating' : (DEFAULTS.menuLayout as MenuLayout)
        if (version < 5) {
          return {
            ...DEFAULTS,
            ...old,
            skin: (old.skin as Skin | undefined) ?? 'cloud',
            accent:
              old.accent === undefined || old.accent === 'blue'
                ? 'auto'
                : (old.accent as AccentChoice),
            radius: old.radius === 'square' ? 'none' : (old.radius ?? DEFAULTS.radius),
            motion: old.motion ?? 'system',
            menuLayout: old.menuLayout ?? migratedLayout,
            palette: EMPTY_PALETTE,
            // 旧的字段不再参与渲染，删掉避免再次回落到它
            sidebarVariant: undefined,
          } as never
        }
        if (version < 6) {
          return { ...(old as object), palette: EMPTY_PALETTE } as never
        }
        return persisted as never
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyToDocument(pickPrefs(state))
          state.syncResolvedTheme?.()
        }
      },
    },
  ),
)

function pickPrefs(state: UiPreferences): UiPreferences {
  return {
    theme: state.theme,
    skin: state.skin,
    accent: state.accent,
    radius: state.radius,
    density: state.density,
    font: state.font,
    sidebarCollapsed: state.sidebarCollapsed,
    menuLayout: state.menuLayout,
    layout: state.layout,
    contentWidth: state.contentWidth,
    direction: state.direction,
    tabBar: state.tabBar,
    locale: state.locale,
    motion: state.motion,
    collapsedGroups: state.collapsedGroups,
    palette: state.palette ?? EMPTY_PALETTE,
  }
}

function computeResolved(theme: ThemeMode): 'light' | 'dark' {
  if (theme === 'dark') return 'dark'
  if (theme === 'light') return 'light'
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** 订阅系统主题变化（在应用根组件调用一次） */
export function initThemeListener() {
  if (typeof window === 'undefined' || mediaQuery) return
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => {
    const state = useUiStore.getState()
    if (state.theme === 'system') {
      applyToDocument(pickPrefs(state))
      state.syncResolvedTheme()
      notifyThemeChange()
    }
  }
  mediaQuery.addEventListener('change', handler)
  const state = useUiStore.getState()
  applyToDocument(pickPrefs(state))
  state.syncResolvedTheme()
}
