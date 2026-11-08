import { useState, type ReactNode } from 'react'
import { cn } from '../lib/utils'

export type StepStatus = 'wait' | 'process' | 'finish' | 'error'

export interface StepItem {
  title: ReactNode
  description?: ReactNode
  status?: StepStatus
  icon?: ReactNode
}

export interface StepsProps {
  items: StepItem[]
  current?: number
  /** 当前步骤状态（默认按 current 推导） */
  status?: 'process' | 'error'
  direction?: 'horizontal' | 'vertical'
  size?: 'sm' | 'md'
  className?: string
  onChange?: (index: number) => void
}

const STATUS_CIRCLE: Record<StepStatus, string> = {
  wait: 'border-line-strong bg-surface text-fg-4',
  process: 'border-primary bg-primary text-primary-fg shadow-[0_0_0_4px_var(--n-primary-ring)]',
  finish: 'border-primary bg-primary-weak text-primary',
  error: 'border-danger bg-danger text-white',
}

/**
 * 步骤条
 *
 * @example
 * <Steps current={1} items={[{title:'填写信息'},{title:'确认配置'},{title:'完成'}]} />
 */
export function Steps({
  items,
  current = 0,
  status = 'process',
  direction = 'horizontal',
  size = 'md',
  className,
  onChange,
}: StepsProps) {
  const resolveStatus = (index: number): StepStatus => {
    if (index < current) return 'finish'
    if (index === current) return status === 'error' ? 'error' : 'process'
    return 'wait'
  }

  const circleSize = size === 'sm' ? 'size-6 text-2xs' : 'size-7 text-xs'

  if (direction === 'vertical') {
    return (
      <ol className={cn('flex flex-col', className)}>
        {items.map((item, index) => {
          const stepStatus = item.status ?? resolveStatus(index)
          const isLast = index === items.length - 1
          return (
            <li key={index} className="relative flex gap-3 pb-5 last:pb-0">
              {!isLast && (
                <span
                  className={cn(
                    'absolute top-8 left-[0.8125rem] h-[calc(100%-1.75rem)] w-px',
                    index < current ? 'bg-primary/40' : 'bg-line',
                  )}
                  aria-hidden="true"
                />
              )}
              <button
                type="button"
                onClick={() => onChange?.(index)}
                className={cn(
                  'relative z-10 grid shrink-0 place-items-center rounded-full border font-medium transition-colors',
                  circleSize,
                  STATUS_CIRCLE[stepStatus],
                  !onChange && 'cursor-default',
                )}
                aria-current={stepStatus === 'process' ? 'step' : undefined}
              >
                {stepStatus === 'finish' ? (
                  <svg viewBox="0 0 24 24" className="size-3.5" fill="none" aria-hidden="true">
                    <path
                      d="m5 12.5 4.5 4.5L19 7"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  (item.icon ?? index + 1)
                )}
              </button>
              <div className="min-w-0 pt-0.5">
                <p
                  className={cn(
                    'text-[0.8125rem] font-medium',
                    stepStatus === 'wait' ? 'text-fg-3' : 'text-fg',
                  )}
                >
                  {item.title}
                </p>
                {item.description && (
                  <p className="mt-0.5 text-2xs leading-4 text-fg-3">{item.description}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <ol className={cn('flex w-full items-start', className)}>
      {items.map((item, index) => {
        const stepStatus = item.status ?? resolveStatus(index)
        const isLast = index === items.length - 1
        return (
          <li
            key={index}
            className={cn(
              'relative flex min-w-0 flex-1 items-start gap-2.5',
              isLast && 'flex-none',
            )}
          >
            {!isLast && (
              <span
                className={cn(
                  'absolute top-3.5 right-0 left-7 h-px',
                  index < current ? 'bg-primary/45' : 'bg-line',
                )}
                aria-hidden="true"
              />
            )}
            <button
              type="button"
              onClick={() => onChange?.(index)}
              className={cn(
                'relative z-10 grid shrink-0 place-items-center rounded-full border font-medium transition-colors',
                circleSize,
                STATUS_CIRCLE[stepStatus],
                !onChange && 'cursor-default',
              )}
              aria-current={stepStatus === 'process' ? 'step' : undefined}
            >
              {stepStatus === 'finish' ? (
                <svg viewBox="0 0 24 24" className="size-3.5" fill="none" aria-hidden="true">
                  <path
                    d="m5 12.5 4.5 4.5L19 7"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                (item.icon ?? index + 1)
              )}
            </button>
            <div className="min-w-0 pr-2 pb-1">
              <p
                className={cn(
                  'truncate text-[0.8125rem] font-medium',
                  stepStatus === 'wait' ? 'text-fg-3' : 'text-fg',
                )}
              >
                {item.title}
              </p>
              {item.description && (
                <p className="mt-0.5 line-clamp-2 text-2xs leading-4 text-fg-3">
                  {item.description}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export interface CollapseItem {
  key: string
  title: ReactNode
  extra?: ReactNode
  content: ReactNode
  disabled?: boolean
}

export interface CollapseProps {
  items: CollapseItem[]
  /** 受控展开项 */
  value?: string[]
  defaultValue?: string[]
  onChange?: (keys: string[]) => void
  /** 手风琴模式：同时只展开一个 */
  accordion?: boolean
  bordered?: boolean
  className?: string
}

/** 折叠面板 */
export function Collapse({
  items,
  value,
  defaultValue,
  onChange,
  accordion,
  bordered = true,
  className,
}: CollapseProps) {
  const [internal, setInternal] = useState<string[]>(
    defaultValue ?? (accordion ? [items[0]?.key ?? ''] : []),
  )
  const openKeys = value ?? internal

  const toggle = (key: string) => {
    const next = openKeys.includes(key)
      ? openKeys.filter((item) => item !== key)
      : accordion
        ? [key]
        : [...openKeys, key]
    if (value === undefined) setInternal(next)
    onChange?.(next)
  }

  return (
    <div
      className={cn(
        'divide-y divide-line-subtle overflow-hidden rounded-md',
        bordered && 'border border-line',
        className,
      )}
    >
      {items.map((item) => {
        const open = openKeys.includes(item.key)
        return (
          <div key={item.key}>
            <button
              type="button"
              disabled={item.disabled}
              aria-expanded={open}
              onClick={() => toggle(item.key)}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors',
                open ? 'bg-surface-2/60' : 'hover:bg-surface-2',
                item.disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <svg
                viewBox="0 0 24 24"
                className={cn(
                  'size-3.5 shrink-0 text-fg-3 transition-transform duration-200',
                  open && 'rotate-90',
                )}
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="m9 6 6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="min-w-0 flex-1 text-[0.8125rem] font-medium text-fg">{item.title}</span>
              {item.extra && <span className="shrink-0">{item.extra}</span>}
            </button>
            <div
              className={cn(
                'grid transition-[grid-template-rows] duration-200 ease-[var(--ease-out-expo)]',
                open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden">
                <div className="px-3 pb-3 pl-9 text-xs leading-6 text-fg-2">{item.content}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
