import type { ReactNode } from 'react'
import {
  Columns2,
  LayoutPanelLeft,
  Menu,
  PanelLeft,
  PanelTop,
  SquareSplitVertical,
} from 'lucide-react'
import { cn } from '@nexus/ui'
import type { MenuLayout } from '@/core/ui-store'
import { useI18n } from '@/i18n'
import type { DictKey } from '@/i18n'

/**
 * 菜单布局清单
 *
 * 顺序刻意按「导航从竖到横」排列：垂直 → 双列 → 水平 → 混合 → 悬浮 → 侧边栏。
 * 每一项只描述**导航摆在哪**，配色、圆角、密度仍由皮肤与外观面板的其它分区决定 ——
 * 所以六种布局都能和六套皮肤、十组强调色自由组合，而不是六套写死的主题。
 */
export const MENU_LAYOUTS: Array<{
  value: MenuLayout
  labelKey: DictKey
  hintKey: DictKey
  icon: typeof Menu
}> = [
  {
    value: 'vertical',
    labelKey: 'theme.menuVertical',
    hintKey: 'theme.menuHintVertical',
    icon: PanelLeft,
  },
  { value: 'dual', labelKey: 'theme.menuDual', hintKey: 'theme.menuHintDual', icon: Columns2 },
  {
    value: 'horizontal',
    labelKey: 'theme.menuHorizontal',
    hintKey: 'theme.menuHintHorizontal',
    icon: PanelTop,
  },
  {
    value: 'mixed',
    labelKey: 'theme.menuMixed',
    hintKey: 'theme.menuHintMixed',
    icon: SquareSplitVertical,
  },
  {
    value: 'floating',
    labelKey: 'theme.menuFloating',
    hintKey: 'theme.menuHintFloating',
    icon: LayoutPanelLeft,
  },
  { value: 'sidebar', labelKey: 'theme.menuSidebar', hintKey: 'theme.menuHintSidebar', icon: Menu },
]

/**
 * 菜单布局选择器
 *
 * 三列网格 + 线框缩略图，与参考方案一致：**先看图，再看字**。
 * 只看文字「双列 / 混合 / 侧边栏」很难区分，缩略图能一眼看出导航在哪一侧。
 */
export function MenuLayoutPicker({
  value,
  onChange,
}: {
  value: MenuLayout
  onChange: (layout: MenuLayout) => void
}) {
  const { t } = useI18n()
  return (
    <div className="grid grid-cols-3 gap-2">
      {MENU_LAYOUTS.map((item) => {
        const active = value === item.value
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            aria-pressed={active}
            title={t(item.hintKey)}
            className={cn(
              'group flex flex-col gap-1 rounded-lg border p-1 transition-colors',
              active ? 'border-primary bg-primary-weak/30' : 'border-line hover:border-line-strong',
            )}
          >
            <MenuLayoutPreview layout={item.value} />
            <span
              className={cn(
                'block truncate px-0.5 text-center text-2xs',
                active ? 'font-medium text-primary' : 'text-fg-2',
              )}
            >
              {t(item.labelKey)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 线框缩略图
 *
 * 全部用设计令牌（surface / line / primary / fg-4）绘制，因此皮肤一换，
 * 六张缩略图会同步换色 —— 预览图不会和真实界面脱节。
 * ------------------------------------------------------------------ */

const BARS = [0, 1, 2, 3, 4]

/** 导航块：若干条横杠，首条用主色表示选中 */
function NavBlock({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <span className={cn('flex flex-col justify-center gap-[0.1875rem] px-[0.25rem]', className)}>
      {BARS.slice(0, rows).map((index) => (
        <span
          key={index}
          className={cn(
            'h-[0.1875rem] w-full rounded-full',
            index === 0 ? 'bg-primary/70' : 'bg-fg-4/25',
          )}
        />
      ))}
    </span>
  )
}

/** 内容块：一条标题 + 若干行，模拟真实页面的信息密度 */
function ContentBlock({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <span className={cn('flex min-w-0 flex-1 flex-col gap-[0.1875rem] p-[0.25rem]', className)}>
      <span className="h-[0.25rem] w-[46%] rounded-full bg-fg-4/35" />
      {BARS.slice(0, rows).map((index) => (
        <span
          key={index}
          className={cn(
            'h-[0.1875rem] rounded-full bg-fg-4/15',
            index === rows - 1 ? 'w-[62%]' : 'w-full',
          )}
        />
      ))}
    </span>
  )
}

/** 顶栏块：品牌点 + 菜单条 */
function TopBlock({ items = 4, className }: { items?: number; className?: string }) {
  return (
    <span
      className={cn(
        'flex h-[0.6875rem] shrink-0 items-center gap-[0.1875rem] border-b border-line/70 px-[0.25rem]',
        className,
      )}
    >
      <span className="size-[0.1875rem] shrink-0 rounded-full bg-primary/80" />
      {BARS.slice(0, items).map((index) => (
        <span
          key={index}
          className={cn(
            'h-[0.1875rem] rounded-full',
            index === 0 ? 'w-[0.625rem] bg-primary/55' : 'w-[0.4375rem] bg-fg-4/25',
          )}
        />
      ))}
    </span>
  )
}

/** 一块「页面卡片」，让缩略图有内外层次 */
function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'flex h-[2.875rem] w-full overflow-hidden rounded-[0.3125rem] border border-line bg-surface',
        className,
      )}
      aria-hidden="true"
    >
      {children}
    </span>
  )
}

/** 菜单布局缩略图：六种摆放方式的线框示意 */
export function MenuLayoutPreview({ layout }: { layout: MenuLayout }) {
  if (layout === 'horizontal') {
    return (
      <Frame className="flex-col">
        <TopBlock items={5} />
        <ContentBlock rows={3} />
      </Frame>
    )
  }

  if (layout === 'dual') {
    return (
      <Frame>
        <NavBlock rows={5} className="w-[18%] border-r border-line/70 bg-surface-2/70" />
        <NavBlock rows={4} className="w-[26%] border-r border-line/70" />
        <ContentBlock rows={3} />
      </Frame>
    )
  }

  if (layout === 'sidebar') {
    return (
      <Frame className="flex-col">
        <TopBlock items={4} />
        <span className="flex min-h-0 flex-1">
          <NavBlock rows={4} className="w-[26%] border-r border-line/70" />
          <ContentBlock rows={2} />
        </span>
      </Frame>
    )
  }

  if (layout === 'mixed') {
    return (
      <Frame className="flex-col">
        <TopBlock items={5} />
        <span className="flex min-h-0 flex-1">
          <NavBlock rows={4} className="w-[24%] border-r border-line/70 bg-surface-2/50" />
          <ContentBlock rows={2} />
        </span>
      </Frame>
    )
  }

  if (layout === 'floating') {
    return (
      <span
        className="flex h-[2.875rem] w-full gap-[0.1875rem] rounded-[0.3125rem] bg-surface-3 p-[0.1875rem]"
        aria-hidden="true"
      >
        <span className="flex w-[26%] overflow-hidden rounded-[0.1875rem] border border-line bg-surface">
          <NavBlock rows={5} className="w-full" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[0.1875rem] border border-line bg-surface">
          <ContentBlock rows={3} />
        </span>
      </span>
    )
  }

  // vertical（默认）：整高侧栏 + 内容
  return (
    <Frame>
      <NavBlock rows={5} className="w-[26%] border-r border-line/70" />
      <ContentBlock rows={3} />
    </Frame>
  )
}
