/**
 * 主题调色盘
 *
 * 目标：让用户**按区域**改配色（页面底、卡片面、顶栏、侧栏、主色、描边、正文、图表），
 * 而不是像「强调色」那样只能换一个主色。
 *
 * 三条设计约束：
 * 1. **只覆盖、不重建**：用户没动过的区域不写变量，皮肤/强调色继续生效。
 *    「自定义」是叠加层，不是另起一套主题。
 * 2. **派生而非罗列**：用户只需要给一个底色，hover / 弱色 / 对比文字 / 描边层级
 *    全部按所选颜色推导。否则调色盘会变成 40 个变量的人肉表单。
 * 3. **明暗分开存**：同一组区域各有一套明色 / 暗色值，切换深浅色时自动换用对应的那套。
 *
 * 变量写在 `<html style>` 的行内属性上：优先级高于所有 `data-skin` / `data-accent`
 * 规则（CSS 选择器规则永远打不过行内），所以不需要靠 `!important` 或提高特异性。
 */

export type PaletteRegionKey =
  | 'bg'
  | 'surface'
  | 'chrome'
  | 'sidebar'
  | 'primary'
  | 'border'
  | 'text'
  | 'chart'

/** 某个明暗模式下的区域配色；缺省即「跟随皮肤」 */
export interface PaletteColors {
  bg?: string
  surface?: string
  chrome?: string
  sidebar?: string
  primary?: string
  border?: string
  text?: string
  /** 图表 6 色，顺序即 --n-chart-1..6 */
  charts?: string[]
}

export interface CustomPalette {
  /** 关闭时完全不写变量，等同「跟随皮肤」 */
  enabled: boolean
  light: PaletteColors
  dark: PaletteColors
}

export const EMPTY_PALETTE: CustomPalette = { enabled: false, light: {}, dark: {} }

/** 区域清单（顺序即面板里的展示顺序） */
export const PALETTE_REGIONS: Array<{
  key: Exclude<PaletteRegionKey, 'chart'>
  labelKey: 'theme.regionBg' | 'theme.regionSurface' | 'theme.regionChrome' | 'theme.regionSidebar' | 'theme.regionPrimary' | 'theme.regionBorder' | 'theme.regionText'
}> = [
  { key: 'bg', labelKey: 'theme.regionBg' },
  { key: 'surface', labelKey: 'theme.regionSurface' },
  { key: 'chrome', labelKey: 'theme.regionChrome' },
  { key: 'sidebar', labelKey: 'theme.regionSidebar' },
  { key: 'primary', labelKey: 'theme.regionPrimary' },
  { key: 'border', labelKey: 'theme.regionBorder' },
  { key: 'text', labelKey: 'theme.regionText' },
]

/** 调色盘可能写到的全部变量名（重置时要逐个 removeProperty） */
export const PALETTE_VAR_NAMES = [
  '--n-bg',
  '--n-bg-subtle',
  '--n-surface',
  '--n-surface-2',
  '--n-surface-3',
  '--n-surface-inset',
  '--n-topbar-bg',
  '--n-sidebar-bg',
  '--n-sidebar-hover',
  '--n-sidebar-fg',
  '--n-sidebar-fg-2',
  '--n-sidebar-fg-3',
  '--n-sidebar-fg-4',
  '--n-sidebar-border',
  '--n-sidebar-border-subtle',
  '--n-sidebar-border-strong',
  '--n-sidebar-accent',
  '--n-sidebar-active',
  '--n-primary',
  '--n-primary-hover',
  '--n-primary-active',
  '--n-primary-weak',
  '--n-primary-weak-2',
  '--n-primary-fg',
  '--n-primary-ring',
  '--n-border',
  '--n-border-strong',
  '--n-border-subtle',
  '--n-fg',
  '--n-fg-2',
  '--n-fg-3',
  '--n-fg-4',
  '--n-chart-1',
  '--n-chart-2',
  '--n-chart-3',
  '--n-chart-4',
  '--n-chart-5',
  '--n-chart-6',
] as const

/* ------------------------------------------------------------------ *
 * 颜色工具（只在 sRGB 里做混合，够用且没有依赖）
 * ------------------------------------------------------------------ */

export interface Rgb {
  r: number
  g: number
  b: number
}

const clampChannel = (value: number) => Math.min(255, Math.max(0, Math.round(value)))

/** 解析 #rgb / #rrggbb / rgb() / rgba()；解析失败返回 null */
export function parseColor(input: string | null | undefined): Rgb | null {
  if (!input) return null
  const text = input.trim().toLowerCase()
  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/)
  if (hex) {
    const raw = hex[1] as string
    if (raw.length === 3) {
      return {
        r: parseInt(raw[0]! + raw[0]!, 16),
        g: parseInt(raw[1]! + raw[1]!, 16),
        b: parseInt(raw[2]! + raw[2]!, 16),
      }
    }
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16),
    }
  }
  const rgb = text.match(/^rgba?\(([^)]+)\)$/)
  if (rgb) {
    const parts = (rgb[1] as string).split(/[\s,/]+/).filter(Boolean).map(Number)
    const [r, g, b] = parts
    if ([r, g, b].every((value) => typeof value === 'number' && !Number.isNaN(value))) {
      return { r: clampChannel(r as number), g: clampChannel(g as number), b: clampChannel(b as number) }
    }
  }
  return null
}

export function toHex({ r, g, b }: Rgb): string {
  const part = (value: number) => clampChannel(value).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

/** 线性混合：t=0 取 a，t=1 取 b */
export function mix(a: string, b: string, t: number): string {
  const from = parseColor(a)
  const to = parseColor(b)
  if (!from || !to) return a
  const ratio = Math.min(1, Math.max(0, t))
  return toHex({
    r: from.r + (to.r - from.r) * ratio,
    g: from.g + (to.g - from.g) * ratio,
    b: from.b + (to.b - from.b) * ratio,
  })
}

/** 带透明度的颜色（ECharts / 焦点环需要 rgba 而不是 8 位 hex） */
export function alpha(color: string, value: number): string {
  const rgb = parseColor(color)
  if (!rgb) return color
  return `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${value})`
}

/** 相对亮度（WCAG） */
export function luminance(color: string): number {
  const rgb = parseColor(color)
  if (!rgb) return 0
  const channel = (value: number) => {
    const v = value / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
}

/** 这块底色算不算「深色轨道」 */
export function isDarkColor(color: string): boolean {
  return luminance(color) < 0.42
}

/** 在这块底色上应该用深字还是浅字 */
export function readableOn(color: string): string {
  return isDarkColor(color) ? '#f4f6fa' : '#15181e'
}

/** 规范化用户输入：合法则返回 #rrggbb，否则 null */
export function normalizeColor(input: string): string | null {
  const rgb = parseColor(input)
  return rgb ? toHex(rgb) : null
}

/* ------------------------------------------------------------------ *
 * 派生：一个区域 → 一组变量
 * ------------------------------------------------------------------ */

const LIGHT_BASE = { bg: '#f2f3f5', surface: '#ffffff', fg: '#1d2129' }
const DARK_BASE = { bg: '#0a0d13', surface: '#151a22', fg: '#eef1f6' }

/** 某个区域配色 → 要写入的 CSS 变量（只包含用户显式设置过的区域） */
export function derivePaletteVars(colors: PaletteColors, dark: boolean): Record<string, string> {
  const base = dark ? DARK_BASE : LIGHT_BASE
  const vars: Record<string, string> = {}

  const bg = colors.bg
  const surface = colors.surface ?? base.surface
  const text = colors.text ?? base.fg
  const pageBg = bg ?? base.bg
  const primary = colors.primary

  if (bg) {
    vars['--n-bg'] = bg
    // 次级底色往卡片面方向抬一点，避免「页面底 / 卡片底」贴成一片
    vars['--n-bg-subtle'] = mix(bg, surface, 0.5)
    vars['--n-surface-inset'] = bg
  }

  if (colors.surface) {
    vars['--n-surface'] = colors.surface
    // 次表面：朝页面底走 55%，得到 hover / 表头那一档
    vars['--n-surface-2'] = mix(colors.surface, pageBg, 0.55)
    // 第三档再压一档：朝正文色走 5%
    vars['--n-surface-3'] = mix(pageBg, text, 0.05)
  }

  if (colors.chrome) {
    vars['--n-topbar-bg'] = colors.chrome
  }

  if (primary) {
    // 悬停 / 按下：深色下提亮，浅色下压暗（在深色底上「变暗」几乎看不见）
    const toward = dark ? '#ffffff' : '#000000'
    vars['--n-primary'] = primary
    vars['--n-primary-hover'] = mix(primary, toward, dark ? 0.14 : 0.12)
    vars['--n-primary-active'] = mix(primary, toward, dark ? 0.26 : 0.22)
    // 弱色 = 主色与卡片面混合，因此换皮肤底色时弱色依然协调
    vars['--n-primary-weak'] = mix(primary, surface, 0.88)
    vars['--n-primary-weak-2'] = mix(primary, surface, 0.76)
    vars['--n-primary-ring'] = alpha(primary, dark ? 0.35 : 0.3)
    // 主色上的文字：按对比度自动取黑/白，不要求用户再选一次
    vars['--n-primary-fg'] = readableOn(primary)
  }

  if (colors.border) {
    vars['--n-border'] = colors.border
    vars['--n-border-strong'] = mix(colors.border, text, 0.2)
    vars['--n-border-subtle'] = mix(colors.border, surface, 0.5)
  }

  if (colors.text) {
    vars['--n-fg'] = colors.text
    vars['--n-fg-2'] = mix(colors.text, pageBg, 0.28)
    vars['--n-fg-3'] = mix(colors.text, pageBg, 0.46)
    vars['--n-fg-4'] = mix(colors.text, pageBg, 0.62)
  }

  if (colors.sidebar) {
    const rail = colors.sidebar
    const railText = readableOn(rail)
    const railDark = isDarkColor(rail)
    vars['--n-sidebar-bg'] = rail
    vars['--n-sidebar-hover'] = mix(rail, railText, 0.08)
    // 侧栏文字按轨道底色自动取黑白：这是「浅色页面 + 深色导轨」能成立的根本
    vars['--n-sidebar-fg'] = railText
    vars['--n-sidebar-fg-2'] = mix(railText, rail, 0.26)
    vars['--n-sidebar-fg-3'] = mix(railText, rail, 0.46)
    vars['--n-sidebar-fg-4'] = mix(railText, rail, 0.64)
    vars['--n-sidebar-border'] = mix(rail, railText, 0.13)
    vars['--n-sidebar-border-subtle'] = mix(rail, railText, 0.09)
    vars['--n-sidebar-border-strong'] = mix(rail, railText, 0.24)
    if (primary) {
      // 强调色要在轨道上看得清：深轨提亮、浅轨压暗
      vars['--n-sidebar-accent'] = railDark
        ? mix(primary, '#ffffff', 0.22)
        : mix(primary, '#000000', 0.06)
      vars['--n-sidebar-active'] = mix(rail, primary, railDark ? 0.18 : 0.12)
    } else {
      // 没改主色时，选中块用「文字色混一点点」做中性高亮，避免沿用皮肤里为另一条轨道设计的弱色
      vars['--n-sidebar-active'] = mix(rail, railText, railDark ? 0.14 : 0.08)
    }
  }

  if (colors.charts?.length) {
    colors.charts.forEach((color, index) => {
      if (index < 6 && color) vars[`--n-chart-${index + 1}`] = color
    })
  }

  return vars
}

/* ------------------------------------------------------------------ *
 * 应用 / 读取
 * ------------------------------------------------------------------ */

/** 当前模式下的区域配色 */
export function colorsForMode(palette: CustomPalette, dark: boolean): PaletteColors {
  return dark ? palette.dark : palette.light
}

/** 把调色盘写到 `<html>` 的行内变量上；关闭时清空 */
export function applyPalette(root: HTMLElement, palette: CustomPalette, dark: boolean): void {
  for (const name of PALETTE_VAR_NAMES) root.style.removeProperty(name)
  if (!palette.enabled) {
    cachePaletteVars(palette)
    return
  }
  const vars = derivePaletteVars(colorsForMode(palette, dark), dark)
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value)
  cachePaletteVars(palette)
}

/** 缓存键：给 index.html 的内联脚本用 */
export const PALETTE_CACHE_KEY = 'nexus-palette-cache'

/**
 * 把「明 / 暗两套已派生的变量」写进 localStorage
 *
 * 为什么需要：调色盘的派生逻辑在 TS 里（混合、对比度、自动文字色），
 * 而首帧必须由 index.html 的内联脚本同步应用，否则会先闪一下皮肤色再跳到自定义色。
 * 内联脚本读不了 TS 函数，所以这里把**成品**缓存下来，让它直接照抄。
 */
function cachePaletteVars(palette: CustomPalette): void {
  if (typeof window === 'undefined') return
  try {
    const payload = palette.enabled
      ? {
          light: derivePaletteVars(palette.light, false),
          dark: derivePaletteVars(palette.dark, true),
        }
      : { light: {}, dark: {} }
    window.localStorage.setItem(PALETTE_CACHE_KEY, JSON.stringify(payload))
  } catch {
    /* 配额 / 隐私模式：首帧退化为皮肤色，不影响运行期 */
  }
}

/**
 * 读取「当前皮肤」的区域配色，用于「从当前皮肤取样」
 *
 * 调色盘是行内变量，会污染 getComputedStyle；因此这里先摘下来、读完再挂回去 ——
 * 用户在一个自定义主题上继续取样时，拿到的是底层皮肤而不是自己的自定义值。
 */
export function sampleSkinColors(): { light: PaletteColors; dark: PaletteColors } {
  const root = document.documentElement
  const saved = PALETTE_VAR_NAMES.map(
    (name) => [name, root.style.getPropertyValue(name)] as const,
  )
  for (const name of PALETTE_VAR_NAMES) root.style.removeProperty(name)

  const snapshot = (): PaletteColors => {
    // 每次取样都要重新取 computedStyle：缓存一次会把上面那套明/暗切换读成同一份
    const styles = getComputedStyle(root)
    const read = (name: string) => styles.getPropertyValue(name).trim()
    const charts: string[] = []
    for (let index = 1; index <= 6; index += 1) {
      const value = read(`--n-chart-${index}`)
      if (value) charts.push(normalizeColor(value) ?? value)
    }
    return {
      bg: normalizeColor(read('--n-bg')) ?? undefined,
      surface: normalizeColor(read('--n-surface')) ?? undefined,
      chrome: normalizeColor(read('--n-topbar-bg') || read('--n-surface')) ?? undefined,
      sidebar: normalizeColor(read('--n-sidebar-bg')) ?? undefined,
      primary: normalizeColor(read('--n-primary')) ?? undefined,
      border: normalizeColor(read('--n-border')) ?? undefined,
      text: normalizeColor(read('--n-fg')) ?? undefined,
      charts: charts.length === 6 ? charts : undefined,
    }
  }

  // 同一个函数要读两套：临时切到相对的另一模式取样
  const wasDark = root.classList.contains('dark')
  const theme = root.dataset.theme

  // 关键：先 force style recalc。不读一次计算样式，下面两次 snapshot 会拿到同一份缓存值，
  // 「明色/暗色」两套就会被抄成一样的颜色（这是最隐蔽的一种错）。
  void getComputedStyle(root).getPropertyValue('--n-bg')

  root.classList.remove('dark')
  root.dataset.theme = 'light'
  void getComputedStyle(root).getPropertyValue('--n-bg')
  const light = snapshot()

  root.classList.add('dark')
  root.dataset.theme = 'dark'
  void getComputedStyle(root).getPropertyValue('--n-bg')
  const dark = snapshot()

  root.classList.toggle('dark', wasDark)
  if (theme) root.dataset.theme = theme

  for (const [name, value] of saved) {
    if (value) root.style.setProperty(name, value)
  }

  return { light, dark }
}

/** 导出的 JSON（方便贴进 issue / 存成预设） */
export function paletteToJson(palette: CustomPalette): string {
  return JSON.stringify(palette, null, 2)
}
