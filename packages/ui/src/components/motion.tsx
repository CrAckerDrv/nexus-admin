import { useCallback, useRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '../lib/utils'

/* ------------------------------------------------------------------ *
 * 动效卡片（MotionCard）
 *
 * 后台里的「卡片」最容易被做成一块静止的色块。这里把五种**低干扰**动效
 * 收敛成一个组件，避免每个页面各写一套：
 *
 * - `lift`      悬停轻微抬升 + 阴影加深（最保守，适合大多数内容卡）
 * - `spotlight` 鼠标跟随的径向光斑（写 CSS 变量，不触发渲染）
 * - `tilt`      指针驱动的 3D 倾斜（最大 6°，超过就晕）
 * - `sweep`     一条高光沿卡片斜向掠过（周期触发，悬停加速）
 * - `aurora`    极慢的渐变漂移（长时间停留的卡片才用，静止也不刺眼）
 *
 * 三条硬约束：
 * 1. **手势期间不 setState**：指针坐标只写 `--mc-*` 自定义属性，React 一次都不重渲染。
 * 2. **静止时绝对静止**：除 `aurora` 外没有任何常驻动画；
 *    `aurora` 的位移幅度 < 6%，14s 一个周期，不用肉眼去「等它动」。
 * 3. **减少动效即全关**：`prefers-reduced-motion` 与 `[data-motion='reduced']` 都生效，
 *    关掉后卡片仍然可读、可聚焦，不会停在动画第 0 帧。
 * ------------------------------------------------------------------ */

export type MotionEffect = 'lift' | 'spotlight' | 'tilt' | 'sweep' | 'aurora' | 'none'

/** 色调取自主题图表色板，跟随皮肤与深浅色 */
export type MotionTone = 'primary' | 'success' | 'warning' | 'violet' | 'rose' | 'cyan'

const TONE_VAR: Record<MotionTone, string> = {
  primary: 'var(--n-chart-1)',
  success: 'var(--n-chart-2)',
  warning: 'var(--n-chart-3)',
  violet: 'var(--n-chart-4)',
  rose: 'var(--n-chart-5)',
  cyan: 'var(--n-chart-6)',
}

export interface MotionCardProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'title' | 'children'
> {
  children: ReactNode
  /** 动效类型，默认 lift */
  effect?: MotionEffect
  /** 色调（spotlight / sweep / aurora 的着色） */
  tone?: MotionTone
  /** 入场延迟序号：卡片流里按 index 传，形成错峰入场 */
  index?: number
  /** 整卡可点击 */
  onClick?: () => void
  /** 是否画描边，默认 true */
  bordered?: boolean
}

export function MotionCard({
  children,
  effect = 'lift',
  tone = 'primary',
  index = 0,
  onClick,
  bordered = true,
  className,
  style,
  ...props
}: MotionCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const interactive = typeof onClick === 'function'

  /**
   * 指针移动：只写 CSS 变量
   *
   * `--mc-x/--mc-y` 是相对卡片的百分比坐标（光斑用），
   * `--mc-rx/--mc-ry` 是 tilt 的旋转角（按中心偏移 × 最大 6°）。
   */
  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (effect !== 'spotlight' && effect !== 'tilt') return
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const dx = (event.clientX - rect.left) / rect.width
      const dy = (event.clientY - rect.top) / rect.height
      el.style.setProperty('--mc-x', `${(dx * 100).toFixed(2)}%`)
      el.style.setProperty('--mc-y', `${(dy * 100).toFixed(2)}%`)
      if (effect === 'tilt') {
        // 6° 是体验上限：再大就会有「卡片在晃」的不适感
        el.style.setProperty('--mc-ry', `${((dx - 0.5) * 12).toFixed(2)}deg`)
        el.style.setProperty('--mc-rx', `${((0.5 - dy) * 12).toFixed(2)}deg`)
      }
      el.style.setProperty('--mc-on', '1')
    },
    [effect],
  )

  const onPointerLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--mc-on', '0')
    el.style.setProperty('--mc-rx', '0deg')
    el.style.setProperty('--mc-ry', '0deg')
  }, [])

  return (
    <div
      ref={ref}
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
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      data-effect={effect}
      className={cn(
        'n-motion-card n-rise group relative isolate overflow-hidden rounded-lg bg-surface',
        bordered && 'border border-line',
        interactive && 'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2',
        className,
      )}
      style={
        {
          '--mc-accent': TONE_VAR[tone],
          animationDelay: `${index * 60}ms`,
          ...style,
        } as CSSProperties
      }
      {...props}
    >
      {/* 光斑层：只有 spotlight 会点亮（--mc-on 由指针写） */}
      {effect === 'spotlight' && (
        <span
          aria-hidden="true"
          className="n-motion-card__spot pointer-events-none absolute inset-0 -z-10"
        />
      )}
      {/* 掠光层：sweep 用，常驻但只在周期内可见 */}
      {effect === 'sweep' && (
        <span
          aria-hidden="true"
          className="n-motion-card__sweep pointer-events-none absolute inset-0"
        />
      )}
      {/* 极光层：aurora 用，两层缓慢反向漂移 */}
      {effect === 'aurora' && (
        <>
          <span aria-hidden="true" className="n-motion-card__aurora n-motion-card__aurora--a" />
          <span aria-hidden="true" className="n-motion-card__aurora n-motion-card__aurora--b" />
        </>
      )}

      <div className="relative flex h-full flex-col">{children}</div>
    </div>
  )
}

/** 供筛选器与图例复用，避免各处再抄一遍常量 */
export const MOTION_EFFECTS: MotionEffect[] = ['lift', 'spotlight', 'tilt', 'sweep', 'aurora']
