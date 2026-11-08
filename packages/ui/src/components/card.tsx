import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/utils'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** 无内边距容器（用于表格/图表贴边） */
  bare?: boolean
  /** 悬浮抬升效果 */
  hoverable?: boolean
  /** 是否显示描边（false 时仅背景） */
  bordered?: boolean
}

/** 卡片容器：后台最基础的区块单元 */
export function Card({ bare, hoverable, bordered = true, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'relative rounded-lg bg-surface',
        bordered && 'border border-line',
        !bare && 'p-4',
        hoverable && 'transition-shadow duration-200 hover:shadow-md',
        className,
      )}
      {...props}
    />
  )
}

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode
  description?: ReactNode
  extra?: ReactNode
  icon?: ReactNode
  /** 标题下方显示分割线 */
  divided?: boolean
}

export function CardHeader({
  title,
  description,
  extra,
  icon,
  divided,
  className,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3',
        divided && 'border-b border-line pb-3',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-2">
        {icon && (
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary-weak text-primary">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-[0.8125rem] font-semibold text-fg">{title}</h3>
          {description && <p className="mt-0.5 truncate text-xs text-fg-3">{description}</p>}
        </div>
      </div>
      {extra && <div className="flex shrink-0 items-center gap-2">{extra}</div>}
    </div>
  )
}

/** 卡片主体：用于无描边内容区 */
export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('min-w-0', className)} {...props} />
}

/** 卡片底部操作区 */
export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'mt-3 flex items-center justify-end gap-2 border-t border-line pt-3',
        className,
      )}
      {...props}
    />
  )
}

/**
 * 区块卡片：标题 + 主体，后台页面最常用组合
 *
 * @example
 * <SectionCard title="实例信息" extra={<Button size="sm">编辑</Button>}>
 *   <Descriptions items={...} />
 * </SectionCard>
 */
export function SectionCard({
  title,
  description,
  extra,
  icon,
  children,
  className,
  bodyClassName,
  divided = true,
}: {
  title: ReactNode
  description?: ReactNode
  extra?: ReactNode
  icon?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  divided?: boolean
}) {
  return (
    <Card bare className={cn('flex flex-col', className)}>
      <CardHeader
        title={title}
        description={description}
        extra={extra}
        icon={icon}
        divided={divided}
        className="px-4 py-3"
      />
      <div className={cn('min-w-0 flex-1', bodyClassName)}>{children}</div>
    </Card>
  )
}
