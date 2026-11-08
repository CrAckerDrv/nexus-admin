import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/utils'

/* ------------------------------------------------------------------ *
 * 横幅（Banner）
 *
 * 后台里「一句话 + 一个按钮 + 一张图」的区块，出现在三个位置：
 *   1. 页面顶部的主横幅（欢迎 / 公告 / 活动）—— HeroBanner
 *   2. 卡片流里的方形横幅（功能入口）—— BannerCard
 *   3. 通栏的轻提示条（已有组件）—— alert.tsx 里的 Banner
 *
 * 设计约束（与本项目既有约定一致）：
 * - **不写死颜色**：六套色调全部映射到 `--n-chart-1..6`，因此自动跟随
 *   皮肤、深浅色与强调色，不需要为每个色调再写一份深色变量。
 * - **渐变只用 color-mix(in oklab, …)**：与 tokens.css / AboutBanner 同一套混色语法，
 *   避免出现「组件自带一套色板」的第二真相。
 * - **插画靠右、文字占左**，窄屏直接隐藏插画而不是压缩它 —— 压扁的 3D 图标比没有更难看。
 * - 动画只挂在 `--nb-*` 自定义属性与 `transform/opacity` 上，静止时绝不抖动。
 * ------------------------------------------------------------------ */

/** 六档色调：全部取自主题图表色板，因此跟随皮肤与深浅色 */
export type BannerTone = 'primary' | 'success' | 'warning' | 'violet' | 'rose' | 'cyan'

/** 三种配置模式：柔和底、实色底、玻璃暗底 */
export type BannerVariant = 'soft' | 'solid' | 'glass'

const TONE_VAR: Record<BannerTone, string> = {
  primary: 'var(--n-chart-1)',
  success: 'var(--n-chart-2)',
  warning: 'var(--n-chart-3)',
  violet: 'var(--n-chart-4)',
  rose: 'var(--n-chart-5)',
  cyan: 'var(--n-chart-6)',
}

/** 每个色调 + 模式组合出的一组 CSS 变量，正文与按钮只消费这些变量 */
function bannerVars(tone: BannerTone, variant: BannerVariant): CSSProperties {
  const c = TONE_VAR[tone]
  if (variant === 'solid') {
    return {
      '--nb-accent': c,
      '--nb-bg': `linear-gradient(135deg, color-mix(in oklab, ${c} 94%, #ffffff) 0%, color-mix(in oklab, ${c} 78%, #0a1020) 100%)`,
      '--nb-fg': '#ffffff',
      '--nb-fg-soft': 'rgb(255 255 255 / 0.82)',
      '--nb-fg-mute': 'rgb(255 255 255 / 0.66)',
      '--nb-halo': 'rgb(255 255 255 / 0.18)',
      '--nb-border': 'color-mix(in oklab, #ffffff 22%, transparent)',
    } as CSSProperties
  }
  if (variant === 'glass') {
    return {
      '--nb-accent': c,
      '--nb-bg': `linear-gradient(150deg, color-mix(in oklab, ${c} 20%, var(--n-surface)) 0%, color-mix(in oklab, ${c} 6%, var(--n-surface)) 58%, var(--n-surface) 100%)`,
      '--nb-fg': 'var(--n-fg)',
      '--nb-fg-soft': 'var(--n-fg-2)',
      '--nb-fg-mute': 'var(--n-fg-3)',
      '--nb-halo': `color-mix(in oklab, ${c} 26%, transparent)`,
      '--nb-border': 'var(--n-border)',
    } as CSSProperties
  }
  return {
    '--nb-accent': c,
    '--nb-bg': `linear-gradient(135deg, color-mix(in oklab, ${c} 17%, var(--n-surface)) 0%, color-mix(in oklab, ${c} 5%, var(--n-surface)) 62%, var(--n-surface) 100%)`,
    '--nb-fg': 'var(--n-fg)',
    '--nb-fg-soft': 'var(--n-fg-2)',
    '--nb-fg-mute': 'var(--n-fg-3)',
    '--nb-halo': `color-mix(in oklab, ${c} 30%, transparent)`,
    '--nb-border': `color-mix(in oklab, ${c} 26%, var(--n-border))`,
  } as CSSProperties
}

/**
 * 背景装饰层
 *
 * 一大一小两团同色调光斑 + 一条斜向高光。全部 absolute + pointer-events-none，
 * 不参与布局，也不随内容高度变化。
 */
function BannerDecoration() {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-1/3 -right-[12%] size-[26rem] rounded-full opacity-90 blur-[2px]"
        style={{
          background: 'radial-gradient(circle at 50% 50%, var(--nb-halo), transparent 68%)',
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-[6%] -bottom-1/2 size-[18rem] rounded-full opacity-60"
        style={{
          background: 'radial-gradient(circle at 50% 50%, var(--nb-halo), transparent 70%)',
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          background:
            'linear-gradient(102deg, transparent 42%, rgb(255 255 255 / 0.14) 50%, transparent 58%)',
        }}
      />
    </>
  )
}

/* ------------------------------ 主横幅 ------------------------------ */

export interface HeroBannerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** 主标题（必填） */
  title: ReactNode
  /** 说明文字 */
  description?: ReactNode
  /** 标题上方的小标签，用于「欢迎 / 公告 / 新功能」这类归类 */
  eyebrow?: ReactNode
  /** 操作区：通常放 1–2 个按钮 */
  actions?: ReactNode
  /** 右上角或标题后的徽标位 */
  extra?: ReactNode
  /** 右侧插画（PNG / WebP，建议透明底） */
  image?: string
  imageAlt?: string
  /** 插画尺寸档位，默认 md */
  imageSize?: 'sm' | 'md' | 'lg'
  /** 插画是否下沉贴边（数值大 + 透明底时更好看） */
  imageBleed?: boolean
  tone?: BannerTone
  variant?: BannerVariant
  /** 内边距档位 */
  size?: 'sm' | 'md' | 'lg'
  /** 自定义内容（放在描述与操作之间，用于 slot 场景） */
  children?: ReactNode
}

/**
 * 主横幅
 *
 * @example
 * // 1. 预设模式：只给色调，其余交给组件
 * <HeroBanner tone="primary" variant="soft" title="欢迎回来" description="今天有 3 条待办" actions={<Button>查看</Button>} />
 *
 * @example
 * // 2. 自定义插画 + slot
 * <HeroBanner title="探索星空计划" image={donut} imageBleed>
 *   <p>加入天文观测活动</p>
 * </HeroBanner>
 */
export function HeroBanner({
  title,
  description,
  eyebrow,
  actions,
  extra,
  image,
  imageAlt = '',
  imageSize = 'md',
  imageBleed,
  tone = 'primary',
  variant = 'soft',
  size = 'md',
  children,
  className,
  style,
  ...props
}: HeroBannerProps) {
  const padding = {
    sm: 'p-4',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
  }[size]

  const imageBox = {
    sm: 'size-[6.5rem]',
    md: 'size-[8.5rem]',
    lg: 'size-[11rem]',
  }[imageSize]

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-xl border',
        'transition-[border-color,box-shadow] duration-300',
        className,
      )}
      style={{ ...bannerVars(tone, variant), ...style }}
      {...props}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{ background: 'var(--nb-bg)' }}
      />
      <BannerDecoration />

      <div className={cn('relative flex items-center gap-4', padding)}>
        <div className="min-w-0 flex-1">
          {(eyebrow || extra) && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {eyebrow && (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium"
                  style={{
                    backgroundColor: 'color-mix(in oklab, var(--nb-accent) 16%, transparent)',
                    color: variant === 'solid' ? '#fff' : 'var(--nb-accent)',
                    border:
                      variant === 'solid'
                        ? '1px solid rgb(255 255 255 / 0.28)'
                        : '1px solid color-mix(in oklab, var(--nb-accent) 26%, transparent)',
                  }}
                >
                  {eyebrow}
                </span>
              )}
              {extra}
            </div>
          )}

          <h2
            className="text-lg leading-7 font-semibold tracking-tight sm:text-xl"
            style={{ color: 'var(--nb-fg)' }}
          >
            {title}
          </h2>

          {description && (
            <p
              className="mt-1.5 max-w-[42rem] text-xs leading-5 sm:text-[0.8125rem] sm:leading-6"
              style={{ color: 'var(--nb-fg-soft)' }}
            >
              {description}
            </p>
          )}

          {children && <div className="mt-3">{children}</div>}

          {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
        </div>

        {image && (
          <div
            className={cn(
              'relative hidden shrink-0 md:block',
              imageBox,
              imageBleed && '-mb-1 translate-y-1',
            )}
            aria-hidden={imageAlt ? undefined : 'true'}
          >
            <img
              src={image}
              alt={imageAlt}
              loading="lazy"
              decoding="async"
              className="size-full object-contain drop-shadow-[0_10px_24px_rgb(16_24_40/0.18)]"
            />
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------ 卡片横幅 ------------------------------ */

export interface BannerCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode
  description?: ReactNode
  /** 顶部插画 */
  image?: string
  imageAlt?: string
  /** 图标兜底：没有插画时显示这一行 */
  icon?: ReactNode
  tone?: BannerTone
  /** 底部操作区 */
  actions?: ReactNode
  /** 右上角角标 */
  extra?: ReactNode
  /** 整卡可点击 */
  onClick?: () => void
}

/**
 * 卡片横幅
 *
 * 与主横幅的区别：**纵向**排版（图在上、文在下），用于四列卡片流里的功能入口。
 * 三张并排时高度由最长的一段说明决定，所以描述固定 2 行高，避免卡片高矮不齐。
 *
 * @example
 * <BannerCard image={donut} title="数据分析报告" description="本周报告已完成" actions={<Button size="xs">下载</Button>} />
 */
export function BannerCard({
  title,
  description,
  image,
  imageAlt = '',
  icon,
  tone = 'primary',
  actions,
  extra,
  onClick,
  className,
  style,
  ...props
}: BannerCardProps) {
  const interactive = typeof onClick === 'function'

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={cn(
        'group relative isolate flex flex-col overflow-hidden rounded-lg border',
        'transition-[border-color,box-shadow,transform] duration-300',
        interactive && 'cursor-pointer hover:-translate-y-0.5 focus-visible:outline-2',
        className,
      )}
      style={{ ...bannerVars(tone, 'soft'), ...style }}
      {...props}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{ background: 'var(--nb-bg)' }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-8 -right-8 size-24 rounded-full opacity-70"
        style={{ background: 'radial-gradient(circle, var(--nb-halo), transparent 70%)' }}
      />

      {extra && <div className="absolute top-2.5 right-2.5 z-10">{extra}</div>}

      <div className="flex items-center justify-center px-4 pt-5 pb-1">
        {image ? (
          <img
            src={image}
            alt={imageAlt}
            loading="lazy"
            decoding="async"
            className="size-[5.5rem] object-contain transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <span
            className="grid size-11 place-items-center rounded-xl"
            style={{
              backgroundColor: 'color-mix(in oklab, var(--nb-accent) 14%, transparent)',
              color: 'var(--nb-accent)',
            }}
          >
            {icon}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center gap-1.5 px-4 pt-2 pb-4 text-center">
        <h3 className="text-[0.8125rem] font-semibold" style={{ color: 'var(--nb-fg)' }}>
          {title}
        </h3>
        {description && (
          <p className="line-clamp-2 text-2xs leading-5" style={{ color: 'var(--nb-fg-mute)' }}>
            {description}
          </p>
        )}
        {actions && (
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  )
}

/** 供业务方复用的色调表（做筛选、图例时不必再抄一遍常量） */
export const BANNER_TONES: BannerTone[] = [
  'primary',
  'success',
  'warning',
  'violet',
  'rose',
  'cyan',
]
