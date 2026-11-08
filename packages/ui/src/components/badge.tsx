import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/utils'

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
export type BadgeVariant = 'soft' | 'solid' | 'outline' | 'dot'

const SOFT: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-fg-2',
  primary: 'bg-primary-weak text-primary',
  success: 'bg-success-weak text-success',
  warning: 'bg-warning-weak text-warning',
  danger: 'bg-danger-weak text-danger',
  info: 'bg-info-weak text-info',
}

const SOLID: Record<Tone, string> = {
  neutral: 'bg-fg-3 text-white',
  primary: 'bg-primary text-primary-fg',
  success: 'bg-success text-white dark:text-[#06251a]',
  warning: 'bg-warning text-white dark:text-[#241a05]',
  danger: 'bg-danger text-white dark:text-[#2a0d0d]',
  info: 'bg-info text-white',
}

const OUTLINE: Record<Tone, string> = {
  neutral: 'border-line-strong text-fg-2',
  primary: 'border-primary/40 text-primary',
  success: 'border-success/40 text-success',
  warning: 'border-warning/40 text-warning',
  danger: 'border-danger/40 text-danger',
  info: 'border-info/40 text-info',
}

const DOT: Record<Tone, string> = {
  neutral: 'bg-fg-3',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  variant?: BadgeVariant
  size?: 'sm' | 'md'
  /** 左侧圆点 */
  dot?: boolean
  icon?: ReactNode
}

/**
 * 标签/徽标
 *
 * @example
 * <Badge tone="success" dot>运行中</Badge>
 * <Badge tone="danger" variant="solid">已过期</Badge>
 */
export function Badge({
  tone = 'neutral',
  variant = 'soft',
  size = 'md',
  dot,
  icon,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border border-transparent leading-none font-medium whitespace-nowrap',
        size === 'sm' ? 'h-[1.125rem] px-1.5 text-2xs' : 'h-[1.375rem] px-2 text-xs',
        variant === 'soft' && SOFT[tone],
        variant === 'solid' && SOLID[tone],
        variant === 'outline' && OUTLINE[tone],
        variant === 'dot' && 'bg-transparent px-0 text-fg-2',
        className,
      )}
      {...props}
    >
      {variant === 'dot' && <span className={cn('size-1.5 rounded-full', DOT[tone])} />}
      {dot && variant !== 'dot' && (
        <span
          className={cn('size-1.5 rounded-full', variant === 'solid' ? 'bg-current' : DOT[tone])}
        />
      )}
      {icon}
      {children}
    </span>
  )
}

/** 状态点（仅圆点 + 可选呼吸动画） */
export function StatusDot({
  tone = 'neutral',
  pulse,
  className,
  label,
}: {
  tone?: Tone
  pulse?: boolean
  className?: string
  label?: string
}) {
  return (
    <span className={cn('relative inline-flex size-2 shrink-0', className)} aria-label={label}>
      {pulse && (
        <span
          className={cn(
            'absolute inline-flex size-full animate-ping rounded-full opacity-60',
            DOT[tone],
          )}
        />
      )}
      <span className={cn('relative inline-flex size-2 rounded-full', DOT[tone])} />
    </span>
  )
}

/** 键值对式的计数标签，如“待处理 12” */
export function CountTag({
  count,
  tone = 'neutral',
  max = 99,
  className,
}: {
  count: number
  tone?: Tone
  max?: number
  className?: string
}) {
  if (!count) return null
  return (
    <span
      className={cn(
        'inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-1 text-2xs leading-none font-semibold',
        SOFT[tone],
        className,
      )}
    >
      {count > max ? `${max}+` : count}
    </span>
  )
}
