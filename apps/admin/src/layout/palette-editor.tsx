import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Pipette, Plus, RotateCcw, Sparkles, Trash2, TriangleAlert, Upload } from 'lucide-react'
import { Button, Input, cn, toast } from '@nexus/ui'
import {
  PALETTE_REGIONS,
  colorsForMode,
  luminance,
  mix,
  normalizeColor,
  paletteToJson,
  readableOn,
  sampleSkinColors,
  type CustomPalette,
  type PaletteColors,
} from '@/core/palette'
import { useUiStore } from '@/core/ui-store'
import type { DictKey } from '@/i18n'
import { useI18n } from '@/i18n'

/**
 * 调色盘编辑器
 *
 * 交互取舍：
 * - **按区域而不是按变量**：用户面对的是「页面底 / 卡片 / 顶栏 / 侧栏 / 主色 / 描边 / 正文 + 图表」，
 *   而不是 40 个 `--n-*`。其余变量（hover、弱色、二三级文字、焦点环）全部派生。
 * - **没改就是跟随皮肤**：每个区域都有一个「跟随皮肤」空态，不强迫用户重新定义所有颜色。
 * - **明暗分开**：顶部切换「明色 / 暗色」，正在编辑的那一套会标出来；
 *   切换深浅色时自动换用对应的一套，不需要再调一遍。
 * - **对比度即时反馈**：主色与侧栏轨道会计算「自动文字色」的对比度，
 *   配色翻车（白字压在白底上）能当场看见，而不是上线后被用户投诉。
 */

type Mode = 'light' | 'dark'

/** 区域键 → 说明文案 */
const REGION_HINT: Record<string, DictKey> = {
  bg: 'theme.regionBgHint',
  surface: 'theme.regionSurfaceHint',
  chrome: 'theme.regionChromeHint',
  sidebar: 'theme.regionSidebarHint',
  primary: 'theme.regionPrimaryHint',
  border: 'theme.regionBorderHint',
  text: 'theme.regionTextHint',
}

/** 内置起步方案：只给四个「能直接用的方向」，不做成几十个预设的色板墙 */
const STARTERS: Array<{
  key: 'ink' | 'midnight' | 'paper' | 'mint'
  labelKey: DictKey
  descKey: DictKey
  light: PaletteColors
  dark: PaletteColors
}> = [
  {
    key: 'ink',
    labelKey: 'theme.palettePresetInk',
    descKey: 'theme.palettePresetInkDesc',
    light: {
      bg: '#f5f6f8',
      surface: '#ffffff',
      chrome: '#ffffff',
      sidebar: '#fafbfc',
      primary: '#3355ff',
      border: '#e2e5ea',
      text: '#14181f',
      charts: ['#3355ff', '#0f9d58', '#e8a33d', '#7c5cff', '#e2568c', '#27a9c4'],
    },
    dark: {
      bg: '#0c0f14',
      surface: '#161a21',
      chrome: '#12161c',
      sidebar: '#0f1318',
      primary: '#7c93ff',
      border: '#262c36',
      text: '#eef1f6',
      charts: ['#7c93ff', '#34d399', '#fbbf24', '#a78bfa', '#f472b6', '#22d3ee'],
    },
  },
  {
    key: 'midnight',
    labelKey: 'theme.palettePresetMidnight',
    descKey: 'theme.palettePresetMidnightDesc',
    light: {
      bg: '#eef2f8',
      surface: '#ffffff',
      chrome: '#0f2038',
      sidebar: '#132743',
      primary: '#0f8fb0',
      border: '#d5dee9',
      text: '#12202f',
      charts: ['#0f8fb0', '#2563eb', '#12a150', '#e0a33c', '#8b5cf6', '#64748b'],
    },
    dark: {
      bg: '#040b16',
      surface: '#0b1626',
      chrome: '#08111f',
      sidebar: '#061323',
      primary: '#22d3ee',
      border: '#1b2b42',
      text: '#e8f1fa',
      charts: ['#22d3ee', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#94a3b8'],
    },
  },
  {
    key: 'paper',
    labelKey: 'theme.palettePresetPaper',
    descKey: 'theme.palettePresetPaperDesc',
    light: {
      bg: '#f3ecdd',
      surface: '#fffaf0',
      chrome: '#fbf4e6',
      sidebar: '#f6efe1',
      primary: '#2f6a4f',
      border: '#e0d3bd',
      text: '#2b2418',
      charts: ['#2f6a4f', '#b07d33', '#7d8a3b', '#a05f78', '#456c8a', '#8a7358'],
    },
    dark: {
      bg: '#17130e',
      surface: '#221c15',
      chrome: '#1b1611',
      sidebar: '#1d1812',
      primary: '#6ee7a8',
      border: '#3a2f23',
      text: '#f3ecdf',
      charts: ['#6ee7a8', '#eab308', '#a3e635', '#f0abfc', '#38bdf8', '#c8a27a'],
    },
  },
  {
    key: 'mint',
    labelKey: 'theme.palettePresetMint',
    descKey: 'theme.palettePresetMintDesc',
    light: {
      bg: '#ebf6f3',
      surface: '#ffffff',
      chrome: '#f4fbf9',
      sidebar: '#f0faf7',
      primary: '#0f8a6a',
      border: '#cfe6df',
      text: '#0f2a24',
      charts: ['#0f8a6a', '#1f8fc4', '#6a9b1f', '#c98a1a', '#a45a8c', '#4f7a6a'],
    },
    dark: {
      bg: '#07130f',
      surface: '#0f1f19',
      chrome: '#0b1814',
      sidebar: '#0b1a15',
      primary: '#4ade9c',
      border: '#213a31',
      text: '#e9f5f0',
      charts: ['#4ade9c', '#38bdf8', '#a3e635', '#fbbf24', '#f0abfc', '#94a3b8'],
    },
  },
]

export function PaletteEditor({ palette }: { palette: CustomPalette }) {
  const { t } = useI18n()
  const resolvedTheme = useUiStore((state) => state.resolvedTheme)
  const mode: Mode = resolvedTheme === 'dark' ? 'dark' : 'light'
  const [previewMode, setPreviewMode] = useState<Mode>(mode)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')

  const setColor = useUiStore((state) => state.setPaletteColor)
  const setCharts = useUiStore((state) => state.setPaletteCharts)
  const setEnabled = useUiStore((state) => state.setPaletteEnabled)
  const clearMode = useUiStore((state) => state.clearPalette)
  const importPalette = useUiStore((state) => state.importPalette)

  // 切换深浅色后，自动切到「正在使用的」那一套，避免在暗色下继续编辑明色值
  useEffect(() => setPreviewMode(mode), [mode])

  const colors = colorsForMode(palette, previewMode === 'dark') ?? {}
  const chartColors = colors.charts ?? []

  return (
    <div className="space-y-4">
      {/* ---------- 总开关 ---------- */}
      <section className="rounded-lg border border-line bg-surface-2/40 p-2.5">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-xs font-medium text-fg">
              <Pipette className="size-3.5 text-primary" />
              {t('theme.paletteEnable')}
            </span>
            <span className="mt-0.5 block text-2xs leading-4 text-fg-4">
              {t('theme.paletteEnableHint')}
            </span>
          </span>
          <SwitchMini checked={palette.enabled} onChange={setEnabled} />
        </div>
      </section>

      {/* ---------- 明 / 暗 两套 ---------- */}
      <section>
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-fg-2">
            <Sparkles className="size-3.5 text-fg-3" />
            {t('theme.paletteMode')}
          </h4>
          <span className="text-2xs text-fg-4 tabular-nums">
            {countColors(colors)} / {PALETTE_REGIONS.length + 1}
          </span>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {(['light', 'dark'] as const).map((item) => {
            const active = previewMode === item
            const editing = mode === item
            return (
              <button
                key={item}
                type="button"
                onClick={() => setPreviewMode(item)}
                aria-pressed={active}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left transition-colors',
                  active
                    ? 'border-primary bg-primary-weak/40 text-primary'
                    : 'border-line text-fg-2 hover:border-line-strong',
                )}
              >
                <span
                  className="size-3 shrink-0 rounded-full border border-black/10"
                  style={{
                    background:
                      item === 'light'
                        ? 'linear-gradient(135deg,#ffffff,#e6e9ef)'
                        : 'linear-gradient(135deg,#2b3240,#0b0d12)',
                  }}
                />
                <span className="min-w-0 flex-1 truncate text-2xs font-medium">
                  {t(item === 'light' ? 'theme.paletteModeLight' : 'theme.paletteModeDark')}
                </span>
                {editing && (
                  <span className="shrink-0 rounded-sm bg-primary/10 px-1 text-[0.5625rem] leading-4 text-primary">
                    {t('theme.preview')}
                  </span>
                )}
                <span className="shrink-0 text-[0.5625rem] text-fg-4 tabular-nums">
                  {countColors(colorsForMode(palette, item === 'dark'))}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-1 text-2xs leading-4 text-fg-4">{t('theme.paletteModeHint')}</p>
      </section>

      {/* ---------- 逐个区域 ---------- */}
      <section className="space-y-1.5">
        {PALETTE_REGIONS.map((region) => (
          <RegionRow
            key={region.key}
            label={t(region.labelKey)}
            hint={t(REGION_HINT[region.key] ?? region.labelKey)}
            value={colors[region.key]}
            onChange={(next) => setColor(region.key, next, previewMode)}
            contrast={region.key === 'sidebar' || region.key === 'primary'}
          />
        ))}
      </section>

      {/* ---------- 图表色板 ---------- */}
      <section className="rounded-lg border border-line p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-fg-2">{t('theme.regionChart')}</h4>
            <p className="mt-0.5 text-2xs leading-4 text-fg-4">{t('theme.regionChartHint')}</p>
          </div>
          <button
            type="button"
            onClick={() => setCharts([], previewMode)}
            aria-label={t('theme.paletteResetRegion')}
            title={t('theme.paletteResetRegion')}
            className="shrink-0 rounded-md p-1 text-fg-4 transition-colors hover:bg-surface-2 hover:text-fg-2"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
        <div className="mt-2 grid grid-cols-6 gap-1.5">
          {Array.from({ length: 6 }).map((_, index) => (
            <ColorSwatch
              key={index}
              value={chartColors[index]}
              label={`${index + 1}`}
              onChange={(next) => {
                const nextCharts = [...chartColors]
                if (next) nextCharts[index] = next
                else nextCharts.splice(index, 1)
                setCharts(nextCharts.filter(Boolean) as string[], previewMode)
              }}
            />
          ))}
        </div>
      </section>

      {/* ---------- 起步方案 / 取样 / 导入导出 ---------- */}
      <section>
        <h4 className="text-xs font-semibold text-fg-2">{t('theme.palette')}</h4>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {STARTERS.map((starter) => (
            <button
              key={starter.key}
              type="button"
              onClick={() => {
                importPalette({
                  enabled: true,
                  light: starter.light,
                  dark: starter.dark,
                })
                toast.success(t('theme.paletteApplied', { name: t(starter.labelKey) }))
              }}
              className="overflow-hidden rounded-md border border-line p-1 text-left transition-colors hover:border-line-strong"
            >
              <span className="flex h-5 w-full overflow-hidden rounded-[0.1875rem]">
                {[
                  starter.light.sidebar,
                  starter.light.bg,
                  starter.light.primary,
                  ...(starter.light.charts ?? []).slice(1, 3),
                ]
                  .filter(Boolean)
                  .map((color, index) => (
                    <span key={index} className="flex-1" style={{ backgroundColor: color }} />
                  ))}
              </span>
              <span className="mt-1 block truncate px-0.5 text-2xs font-medium text-fg-2">
                {t(starter.labelKey)}
              </span>
              <span className="mt-0.5 block truncate px-0.5 text-[0.5625rem] text-fg-4">
                {t(starter.descKey)}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Button
            size="xs"
            variant="secondary"
            leftIcon={<Sparkles className="size-3" />}
            onClick={() => {
              const { light, dark } = sampleSkinColors()
              importPalette({ ...palette, light, dark })
              setPreviewMode(mode)
            }}
          >
            {t('theme.paletteSampleSkin')}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            leftIcon={<Trash2 className="size-3" />}
            onClick={() => {
              clearMode()
              toast.success(t('theme.paletteClear'))
            }}
          >
            {t('theme.paletteClear')}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            leftIcon={<Copy className="size-3" />}
            onClick={() => {
              const text = paletteToJson(palette)
              const write = navigator.clipboard?.writeText(text)
              if (write) {
                void write
                  .then(() => toast.success(t('theme.paletteCopied')))
                  .catch(() => toast.error(t('theme.paletteCopied')))
              } else {
                toast.info(text)
              }
            }}
          >
            {t('theme.paletteExport')}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            leftIcon={<Upload className="size-3" />}
            onClick={() => setImportOpen((prev) => !prev)}
          >
            {t('theme.paletteImport')}
          </Button>
        </div>

        {importOpen && (
          <div className="mt-2 space-y-1.5">
            <Input
              size="sm"
              value={importText}
              placeholder={t('theme.paletteImportPlaceholder')}
              onChange={(event) => setImportText(event.target.value)}
            />
            <Button
              size="xs"
              variant="primary"
              onClick={() => {
                try {
                  const parsed = JSON.parse(importText) as CustomPalette
                  if (!parsed || typeof parsed !== 'object' || !parsed.light || !parsed.dark) {
                    throw new Error('bad shape')
                  }
                  importPalette({ ...parsed, enabled: parsed.enabled ?? true })
                  setImportOpen(false)
                  setImportText('')
                  toast.success(t('theme.paletteImported'))
                } catch {
                  toast.error(t('theme.paletteInvalid'))
                }
              }}
            >
              {t('theme.paletteImport')}
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 内部小组件
 * ------------------------------------------------------------------ */

function RegionRow({
  label,
  hint,
  value,
  onChange,
  contrast,
}: {
  label: string
  hint: string
  value?: string
  onChange: (next: string | null) => void
  contrast?: boolean
}) {
  const { t } = useI18n()

  return (
    <div className="rounded-md border border-line px-2 py-1.5">
      <div className="flex items-center gap-2">
        <ColorSwatch value={value} label={label} onChange={onChange} compact />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1">
            <span className="truncate text-xs font-medium text-fg">{label}</span>
            {!value && (
              <span className="shrink-0 rounded-sm bg-surface-2 px-1 text-[0.5625rem] leading-4 text-fg-4">
                {t('theme.paletteFollowSkin')}
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-2xs text-fg-4" title={hint}>
            {hint}
          </span>
        </span>
        {value ? (
          <span className="flex shrink-0 items-center gap-1">
            <HexInput value={value} onCommit={onChange} />
            <button
              type="button"
              aria-label={t('theme.paletteResetRegion')}
              title={t('theme.paletteResetRegion')}
              onClick={() => onChange(null)}
              className="rounded-sm p-0.5 text-fg-4 transition-colors hover:bg-surface-2 hover:text-fg-2"
            >
              <RotateCcw className="size-3" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onChange('#8a93a3')}
            className="shrink-0 rounded-md border border-dashed border-line-strong px-2 py-0.5 text-2xs text-fg-3 transition-colors hover:border-primary hover:text-primary"
          >
            {t('theme.paletteAuto')}
          </button>
        )}
      </div>
      {contrast && value && <ContrastBadge color={value} />}
    </div>
  )
}

/** 色块：点开原生取色器；未设置时显示虚线 + 加号 */
function ColorSwatch({
  value,
  label,
  onChange,
  compact,
}: {
  value?: string
  label: string
  onChange: (next: string | null) => void
  compact?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const shown = value ?? '#cbd2dd'

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={label}
        title={value ?? label}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'grid place-items-center rounded-md transition-transform hover:scale-105',
          compact ? 'size-6' : 'aspect-square w-full',
          value ? 'border border-black/10' : 'border border-dashed border-line-strong',
        )}
        style={{ backgroundColor: shown }}
      >
        {!value && <Plus className="size-3 text-white/80" />}
      </button>
      <input
        ref={inputRef}
        type="color"
        value={normalizeColor(shown) ?? '#cbd2dd'}
        onChange={(event) => onChange(event.target.value)}
        className="pointer-events-none absolute size-0 opacity-0"
        tabIndex={-1}
        aria-hidden="true"
      />
    </span>
  )
}

/** hex 输入：回车 / 失焦时归一化，非法值回弹到原值 */
function HexInput({ value, onCommit }: { value: string; onCommit: (next: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  const commit = () => {
    const normalized = normalizeColor(draft)
    if (normalized) {
      onCommit(normalized)
      setDraft(normalized)
    } else {
      setDraft(value)
    }
  }

  return (
    <input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit()
        }
      }}
      spellCheck={false}
      aria-label={value}
      className="h-5 w-[4.75rem] rounded-sm border border-line bg-surface px-1.5 font-mono text-[0.625rem] leading-none text-fg-2 tabular-nums outline-none focus:border-primary/70"
    />
  )
}

/** 对比度徽标：这块底色上「自动文字色」够不够读 */
function ContrastBadge({ color }: { color: string }) {
  const { t } = useI18n()
  const fg = readableOn(color)
  const ratio = useMemo(() => {
    const a = luminance(color)
    const b = luminance(fg)
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  }, [color, fg])

  const level = ratio >= 4.5 ? 'ok' : ratio >= 3 ? 'warn' : 'bad'
  const text =
    level === 'ok'
      ? t('theme.paletteContrastOk')
      : level === 'warn'
        ? t('theme.paletteContrastWarn')
        : t('theme.paletteContrastBad')

  return (
    <div className="mt-1.5 flex items-center gap-1.5 border-t border-line-subtle pt-1.5">
      <span
        className="grid size-4 shrink-0 place-items-center rounded-sm border border-line text-[0.5rem] font-semibold"
        style={{ backgroundColor: color, color: fg }}
        aria-hidden="true"
      >
        Aa
      </span>
      {level === 'bad' && <TriangleAlert className="size-3 shrink-0 text-danger" />}
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-[0.625rem]',
          level === 'ok' && 'text-fg-4',
          level === 'warn' && 'text-warning',
          level === 'bad' && 'text-danger',
        )}
      >
        {text}
      </span>
      <span className="shrink-0 text-[0.625rem] text-fg-4 tabular-nums">{ratio.toFixed(1)}:1</span>
    </div>
  )
}

/** 极简开关：抽屉里控件已经很多，不再引一个带 label 的完整 Switch */
function SwitchMini({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full border transition-colors',
        checked ? 'border-primary bg-primary' : 'border-line-strong bg-surface-3',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 size-3.5 rounded-full bg-white shadow-sm transition-[left] duration-150',
          checked ? 'left-[1.125rem]' : 'left-0.5',
        )}
      />
    </button>
  )
}

function countColors(colors?: PaletteColors): number {
  if (!colors) return 0
  const { charts, ...rest } = colors
  return Object.values(rest).filter(Boolean).length + (charts?.length ? 1 : 0)
}

/** 主色 / 轨道的派生色预览（悬停、弱色、选中态各一格） */
export function PaletteDerivedPreview({ color }: { color: string }) {
  const steps = [
    { label: 'hover', value: mix(color, '#ffffff', 0.14) },
    { label: 'weak', value: mix(color, '#ffffff', 0.86) },
    { label: 'fg', value: readableOn(color) },
  ]
  return (
    <div className="flex items-center gap-1">
      {steps.map((step) => (
        <span
          key={step.label}
          className="size-3 rounded-sm border border-black/10"
          style={{ backgroundColor: step.value }}
          title={`${step.label} ${step.value}`}
        />
      ))}
    </div>
  )
}
