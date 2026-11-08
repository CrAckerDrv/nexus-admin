import type { ReactNode } from 'react'
import { AnimatedNumber, Sparkline, cn } from '@nexus/ui'

/**
 * 指标卡（工作台共用）
 *
 * 经营概览与数据分析两个页面共用同一张卡片，保证「同一个指标在哪个页面看都一样顺眼」：
 * - 版式：标签在上、数值居中偏左、环比在数值下方，图标独立成块停靠在右侧中线
 * - 底部的迷你趋势占满整宽，作为「走势」而不是装饰
 *
 * 百分比类的指标用 `decimals + suffix` 表达，不做字符串拼接 ——
 * 数字滚动动画需要对原始数值插值，一旦提前格式化成字符串就没法滚动了。
 */
export interface KpiTileProps {
  label: string
  value: number
  /** 小数位（0 = 整数，2 = 百分比常见） */
  decimals?: number
  prefix?: string
  suffix?: string
  /** 环比变化，正负决定颜色与箭头方向 */
  delta?: number
  deltaLabel?: string
  /** 迷你趋势数据 */
  trend?: number[]
  tone?: 'primary' | 'success' | 'warning' | 'danger'
  icon?: ReactNode
  /** 右上角「实时」脉冲点 */
  live?: boolean
  /** 入场动画延迟（按卡片序号传入） */
  index?: number
  className?: string
  footer?: ReactNode
}

const TONE_TILE = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
} as const

export function KpiTile({
  label,
  value,
  decimals = 0,
  prefix,
  suffix,
  delta,
  deltaLabel = '较上周期',
  trend,
  tone = 'primary',
  icon,
  live,
  index = 0,
  className,
  footer,
}: KpiTileProps) {
  const positive = (delta ?? 0) >= 0

  return (
    <article
      className={cn(
        'n-rise group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface',
        'transition-[border-color,box-shadow] duration-300 hover:border-primary/30 hover:shadow-md',
        className,
      )}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="relative flex min-h-[5.375rem] flex-col justify-center px-3.5 pt-3 sm:min-h-[6.5rem] sm:px-4 sm:pt-3.5">
        <div className="flex items-center gap-1.5 pr-0 sm:pr-14">
          <span className="truncate text-xs text-fg-3">{label}</span>
          {live && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-1.5 py-0.5 text-[0.625rem] leading-3 font-medium text-success">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-70" />
                <span className="relative inline-flex size-1.5 rounded-full bg-success" />
              </span>
              实时
            </span>
          )}
        </div>

        <AnimatedNumber
          value={value}
          decimals={decimals}
          prefix={prefix}
          suffix={suffix}
          duration={1100 + index * 120}
          className="mt-1.5 block text-xl leading-7 font-semibold tracking-tight text-fg sm:text-[1.625rem] sm:leading-8"
        />

        {(delta !== undefined || footer) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-2xs">
            {delta !== undefined && (
              <>
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 font-medium tabular-nums',
                    positive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger',
                  )}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={cn('size-2.5', !positive && 'rotate-180')}
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 4l7 11H5L12 4z" />
                  </svg>
                  {Math.abs(delta).toFixed(1)}%
                </span>
                <span className="truncate text-fg-4">{deltaLabel}</span>
              </>
            )}
            {footer}
          </div>
        )}

        {/* 图标：右侧中线停靠，hover 时轻微上浮；窄屏下让位给数值，避免挤在一起 */}
        {icon && (
          <span
            className={cn(
              'absolute top-1/2 right-4 hidden size-11 -translate-y-1/2 place-items-center rounded-xl sm:grid',
              'transition-transform duration-300 group-hover:-translate-y-[calc(50%+0.125rem)]',
              TONE_TILE[tone],
            )}
          >
            {icon}
          </span>
        )}
      </div>

      {trend && trend.length > 1 && (
        <div className="mt-auto px-1 pb-1">
          <Sparkline data={trend} width={260} height={30} tone={tone} className="w-full" />
        </div>
      )}
    </article>
  )
}
