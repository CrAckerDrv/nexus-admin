import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../lib/utils'
import { Spinner } from './spinner'

export type ButtonVariant =
  'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'text' | 'link'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm' | 'icon-xs'

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-fg shadow-xs hover:bg-primary-hover active:bg-primary-active disabled:hover:bg-primary',
  secondary:
    'bg-surface-2 text-fg border border-line hover:border-line-strong hover:bg-surface-3 active:bg-surface-3',
  outline:
    'bg-transparent text-fg border border-line-strong hover:border-primary hover:text-primary hover:bg-primary-weak/40',
  ghost: 'bg-transparent text-fg-2 hover:bg-surface-2 hover:text-fg active:bg-surface-3',
  danger:
    'bg-danger text-white shadow-xs hover:brightness-110 active:brightness-95 dark:text-[#1a0f10]',
  text: 'bg-transparent text-fg-2 hover:text-primary',
  link: 'bg-transparent text-primary hover:underline underline-offset-4 px-0',
}

const SIZE: Record<ButtonSize, string> = {
  xs: 'h-6 gap-1 px-2 text-2xs rounded-sm',
  sm: 'h-[var(--n-control-h-sm)] gap-1.5 px-2.5 text-xs rounded-sm',
  md: 'h-[var(--n-control-h)] gap-1.5 px-3 text-[0.8125rem] rounded-md',
  lg: 'h-[var(--n-control-h-lg)] gap-2 px-4 text-sm rounded-md',
  icon: 'h-[var(--n-control-h)] w-[var(--n-control-h)] rounded-md',
  'icon-sm': 'h-[var(--n-control-h-sm)] w-[var(--n-control-h-sm)] rounded-sm',
  'icon-xs': 'h-6 w-6 rounded-sm',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** 加载态：禁用交互并显示 Spinner */
  loading?: boolean
  /** 左侧图标 */
  leftIcon?: ReactNode
  /** 右侧图标 */
  rightIcon?: ReactNode
  /** 占满父容器宽度 */
  block?: boolean
}

/** 生成按钮样式（用于 <a> / <Link> 等非 button 元素复用同一视觉） */
export function buttonVariants(
  options: {
    variant?: ButtonVariant
    size?: ButtonSize
    block?: boolean
    className?: string
  } = {},
): string {
  const { variant = 'secondary', size = 'md', block, className } = options
  return cn(
    'relative inline-flex items-center justify-center font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,opacity] duration-150 select-none',
    'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary/60',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45',
    VARIANT[variant],
    SIZE[size],
    block && 'w-full',
    className,
  )
}

/**
 * 按钮
 *
 * @example
 * <Button variant="primary" loading={isPending}>保存</Button>
 * <Button variant="ghost" size="icon-sm" aria-label="更多"><MoreHorizontal /></Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    leftIcon,
    rightIcon,
    block,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonVariants({ variant, size, block, className })}
      {...props}
    >
      {loading ? (
        <Spinner size={size === 'lg' ? 16 : 14} />
      ) : (
        leftIcon && <span className="inline-flex shrink-0 items-center">{leftIcon}</span>
      )}
      {children}
      {!loading && rightIcon && (
        <span className="inline-flex shrink-0 items-center">{rightIcon}</span>
      )}
    </button>
  )
})

export interface ButtonGroupProps {
  children: ReactNode
  className?: string
  /** 是否横向吸附（默认横向） */
  vertical?: boolean
}

/** 按钮组：相邻按钮共享边框，避免多重描边 */
export function ButtonGroup({ children, className, vertical }: ButtonGroupProps) {
  return (
    <div
      role="group"
      className={cn(
        'inline-flex',
        vertical ? 'flex-col' : 'flex-row',
        '[&>*]:rounded-none',
        vertical
          ? '[&>*+*]:-mt-px [&>*:first-child]:rounded-t-md [&>*:last-child]:rounded-b-md'
          : '[&>*+*]:-ml-px [&>*:first-child]:rounded-l-md [&>*:last-child]:rounded-r-md',
        className,
      )}
    >
      {children}
    </div>
  )
}
