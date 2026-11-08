import { useState } from 'react'
import {
  Check,
  CircleCheck,
  ExternalLink,
  FileChartColumn,
  Minimize2,
  Palette,
  RotateCcw,
  SquareArrowOutUpRight,
} from 'lucide-react'
import type { PageSpec, PageTheme } from '@nexus/ai-sdk'
import { Badge, Button, SegmentedControl, cn, toast } from '@nexus/ui'
import { ACCENT_PRESETS, useUiStore, type Accent } from '@/core/ui-store'
import { useI18n } from '@/i18n'
import { PageRenderer } from './page-renderer'

/**
 * 页面预览卡
 *
 * 三个入口共用：对话框气泡里的缩略预览、面板里的完整预览、工作台的预览页签。
 * 差别只在 `variant`：`inline` 收掉操作条，`full` 加配色快调与占满高度。
 *
 * 「改配色」为什么不走模型：
 * 这是一次纯本地状态变更（改一个 CSS 变量），走模型至少要 1~3 秒且可能失败。
 * 模型负责「从无到有」与「结构性修改」，微调交给确定性交互。
 */
export function PagePreviewCard({
  page,
  applied,
  onApply,
  onOpen,
  onAdjust,
  variant = 'full',
  className,
}: {
  page: PageSpec
  applied: boolean
  onApply: () => void
  onOpen: () => void
  onAdjust?: (patch: Partial<PageSpec>) => void
  variant?: 'full' | 'inline'
  className?: string
}) {
  const { t } = useI18n()
  const [showPalette, setShowPalette] = useState(false)
  const currentAccent = useUiStore((state) => state.accent)
  const setAccent = useUiStore((state) => state.setAccent)

  const accentOf = (page.theme.accent as Accent | undefined) ?? currentAccent

  const changeAccent = (accent: Accent) => {
    onAdjust?.({ theme: { ...page.theme, accent } })
    // 同时把整站配色对齐：生成页与后台视觉一致时才不像「外挂窗口」
    setAccent(accent)
  }

  const changeTheme = (patch: PageTheme) => {
    onAdjust?.({ theme: { ...page.theme, ...patch } })
  }

  return (
    <section
      className={cn(
        'overflow-hidden rounded-lg border border-line bg-surface',
        variant === 'full' && 'shadow-xs',
        className,
      )}
    >
      {/* 头部：页面身份（中性底 + 细描边，不用品牌色块 —— 预览本身才是主角） */}
      <header className="flex items-start gap-2 border-b border-line bg-surface-2/60 px-3 py-2.5">
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border border-line bg-surface text-fg-2">
          <FileChartColumn className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5">
            <span className="truncate text-[0.8125rem] font-semibold text-fg">{page.title}</span>
            <Badge tone={applied ? 'success' : 'primary'} size="sm">
              {applied ? t('assistant.applied') : 'v' + page.version}
            </Badge>
          </p>
          <p className="mt-0.5 truncate font-mono text-2xs text-fg-3">{page.path}</p>
        </div>
        {variant === 'full' && (
          <button
            type="button"
            aria-label={t('assistant.togglePalette')}
            aria-pressed={showPalette}
            onClick={() => setShowPalette((prev) => !prev)}
            className={cn(
              'grid size-7 shrink-0 place-items-center rounded-md text-fg-3 transition-colors',
              'hover:bg-surface-2 hover:text-fg',
              showPalette && 'bg-surface-2 text-primary',
            )}
          >
            <Palette className="size-3.5" />
          </button>
        )}
      </header>

      {/* 快捷调色：确定性交互，立等可见（原地展开，不带位移，避免压住上面的标题行） */}
      {variant === 'full' && showPalette && (
        <div className="n-reveal space-y-2 border-b border-line bg-surface-2/60 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-2xs text-fg-3">{t('assistant.accentLabel')}</span>
            {(Object.keys(ACCENT_PRESETS) as Accent[]).map((accent) => {
              const preset = ACCENT_PRESETS[accent]
              const active = accent === accentOf
              return (
                <button
                  key={accent}
                  type="button"
                  title={preset.label}
                  aria-label={preset.label}
                  aria-pressed={active}
                  onClick={() => changeAccent(accent)}
                  className={cn(
                    'relative size-5 rounded-full ring-offset-1 ring-offset-surface transition-transform',
                    'hover:scale-110',
                    active && 'ring-2 ring-primary',
                  )}
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${preset.swatch[0]}, ${preset.swatch[1]})`,
                  }}
                >
                  {active && <Check className="absolute inset-0 m-auto size-3 text-white" />}
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              size="sm"
              value={page.theme.density ?? 'default'}
              onChange={(value) => changeTheme({ density: value as PageTheme['density'] })}
              options={[
                { value: 'compact', label: t('theme.densityCompact') },
                { value: 'default', label: t('theme.densityDefault') },
                { value: 'comfortable', label: t('theme.densityComfortable') },
              ]}
            />
            <SegmentedControl
              size="sm"
              value={page.theme.surface ?? 'plain'}
              onChange={(value) => changeTheme({ surface: value as PageTheme['surface'] })}
              options={[
                { value: 'plain', label: t('assistant.surfacePlain') },
                { value: 'gradient', label: t('assistant.surfaceGradient') },
              ]}
            />
            <Button
              size="xs"
              variant="ghost"
              leftIcon={<RotateCcw className="size-3" />}
              onClick={() => {
                onAdjust?.({ theme: { accent: 'blue', surface: 'gradient' } })
                setAccent('blue')
                toast.info(t('theme.saved'))
              }}
            >
              {t('theme.reset')}
            </Button>
          </div>
        </div>
      )}

      {/* 页面本体 */}
      <div className="relative">
        <div
          className={cn(
            'overflow-y-auto',
            // 抽屉里只给一段可见高度：预览是「确认它长什么样」，
            // 不是在 552px 宽的侧栏里把整页读一遍 —— 想细看可以「打开页面」
            variant === 'full'
              ? 'max-h-[calc(100dvh-23.75rem)] min-h-[17.5rem]'
              : 'max-h-[18.75rem]',
          )}
        >
          <div
            className={cn(
              'p-3',
              page.theme.surface === 'gradient' &&
                'bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent',
            )}
          >
            <PageRenderer
              page={page}
              compact={variant === 'inline'}
              limit={variant === 'inline' ? 3 : undefined}
            />
          </div>
        </div>
        {/* 底部渐隐：让「还有内容」看起来是有意的裁切，而不是被切断 */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface to-transparent"
        />
      </div>

      {/* 操作条：主操作留一个，其余降为次要按钮 */}
      <footer className="flex flex-wrap items-center gap-2 border-t border-line bg-surface px-3 py-2.5">
        <Button
          size="sm"
          variant={applied ? 'secondary' : 'primary'}
          leftIcon={
            applied ? (
              <CircleCheck className="size-3.5" />
            ) : (
              <SquareArrowOutUpRight className="size-3.5" />
            )
          }
          onClick={onApply}
        >
          {applied ? t('assistant.appliedAction') : t('assistant.applyAction')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<ExternalLink className="size-3.5" />}
          onClick={onOpen}
        >
          {t('assistant.openPage')}
        </Button>
        <span className="ml-auto flex items-center gap-1 text-2xs text-fg-4">
          <Minimize2 className="size-3" />
          {page.blocks.length} {t('assistant.blocksUnit')}
        </span>
      </footer>
    </section>
  )
}
