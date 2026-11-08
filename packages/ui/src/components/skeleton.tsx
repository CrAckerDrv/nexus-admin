import type { HTMLAttributes } from 'react'
import { cn } from '../lib/utils'

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** 是否使用流光动画 */
  shimmer?: boolean
}

/** 骨架屏块 */
export function Skeleton({ shimmer = true, className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(shimmer && 'n-skeleton', !shimmer && 'bg-surface-3', 'rounded-sm', className)}
      {...props}
    />
  )
}

/** 文本骨架：多行 */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn('h-3', index === lines - 1 ? 'w-1/2' : index % 2 ? 'w-11/12' : 'w-full')}
        />
      ))}
    </div>
  )
}

/** 表格骨架 */
export function SkeletonTable({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="w-full">
      <div className="flex gap-3 border-b border-line px-4 py-2.5">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 border-b border-line-subtle px-4 py-3">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
