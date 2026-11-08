import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '../lib/utils'
import { useControllableState } from '../lib/hooks'

export interface TabItem {
  key: string
  label: ReactNode
  icon?: ReactNode
  badge?: ReactNode
  disabled?: boolean
  /** 懒加载内容 */
  content?: ReactNode
}

export interface TabsProps {
  items: TabItem[]
  value?: string
  defaultValue?: string
  onChange?: (key: string) => void
  variant?: 'line' | 'pill' | 'enclosed' | 'card'
  size?: 'sm' | 'md'
  className?: string
  /** 右侧操作区 */
  extra?: ReactNode
  /** 撑满宽度 */
  block?: boolean
}

/**
 * 标签页 · 支持键盘左右切换，可作纯导航使用
 *
 * @example
 * <Tabs items={[{key:'basic',label:'基本信息'},{key:'log',label:'操作日志'}]} variant="line" />
 */
export function Tabs({
  items,
  value,
  defaultValue,
  onChange,
  variant = 'line',
  size = 'md',
  className,
  extra,
  block,
}: TabsProps) {
  const baseId = useId()
  const [current, setCurrent] = useControllableState<string>({
    value,
    defaultValue: defaultValue ?? items[0]?.key ?? '',
    onChange,
  })
  const listRef = useRef<HTMLDivElement>(null)

  const onKeyDown = (event: React.KeyboardEvent) => {
    const enabled = items.filter((item) => !item.disabled)
    const index = enabled.findIndex((item) => item.key === current)
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const dir = event.key === 'ArrowRight' ? 1 : -1
      const next = enabled[(index + dir + enabled.length) % enabled.length]
      if (next) setCurrent(next.key)
    }
  }

  const active = items.find((item) => item.key === current)

  return (
    <div className={className}>
      <div className={cn('flex items-center gap-2', variant === 'line' && 'border-b border-line')}>
        <div
          ref={listRef}
          role="tablist"
          onKeyDown={onKeyDown}
          className={cn(
            'flex min-w-0 items-center overflow-x-auto',
            variant === 'line' && '-mb-px gap-1',
            variant === 'pill' && 'gap-1 rounded-md bg-surface-3 p-0.5',
            variant === 'enclosed' && 'gap-1',
            variant === 'card' && 'gap-1',
            block && 'flex-1',
          )}
        >
          {items.map((item) => {
            const selected = item.key === current
            return (
              <button
                key={item.key}
                role="tab"
                id={`${baseId}-tab-${item.key}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${item.key}`}
                tabIndex={selected ? 0 : -1}
                disabled={item.disabled}
                onClick={() => setCurrent(item.key)}
                className={cn(
                  'relative inline-flex shrink-0 items-center gap-1.5 font-medium whitespace-nowrap transition-colors duration-150',
                  size === 'sm' ? 'text-xs' : 'text-[0.8125rem]',
                  variant === 'line' &&
                    cn(
                      'h-9 border-b-2 px-1 pt-0.5',
                      selected
                        ? 'border-primary text-primary'
                        : 'border-transparent text-fg-3 hover:text-fg-2',
                    ),
                  variant === 'pill' &&
                    cn(
                      'h-6 rounded-[calc(var(--n-radius)-0.125rem)] px-2.5',
                      selected ? 'bg-surface text-fg shadow-xs' : 'text-fg-3 hover:text-fg-2',
                    ),
                  variant === 'enclosed' &&
                    cn(
                      'h-[var(--n-control-h)] rounded-t-md border border-b-0 px-3',
                      selected
                        ? 'border-line bg-surface text-fg'
                        : 'border-transparent text-fg-3 hover:text-fg-2',
                    ),
                  variant === 'card' &&
                    cn(
                      'h-[var(--n-control-h)] rounded-md border px-3',
                      selected
                        ? 'border-primary/45 bg-primary-weak text-primary'
                        : 'border-line text-fg-3 hover:border-line-strong hover:text-fg-2',
                    ),
                  item.disabled && 'cursor-not-allowed opacity-40',
                )}
              >
                {item.icon}
                {item.label}
                {item.badge}
              </button>
            )
          })}
        </div>
        {extra && <div className="ml-auto shrink-0 pb-1.5">{extra}</div>}
      </div>
      {active?.content !== undefined && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${active.key}`}
          aria-labelledby={`${baseId}-tab-${active.key}`}
          className="n-enter pt-3"
        >
          {active.content}
        </div>
      )}
    </div>
  )
}

export interface BreadcrumbProps {
  items: Array<{ label: ReactNode; href?: string; onClick?: () => void; icon?: ReactNode }>
  /** 分隔符 */
  separator?: ReactNode
  className?: string
  /** 折叠中间项（超过 n 项时） */
  maxItems?: number
}

/** 面包屑 */
export function Breadcrumb({ items, separator, className, maxItems = 4 }: BreadcrumbProps) {
  const [expanded, setExpanded] = useState(false)
  const hidden = !expanded && items.length > maxItems ? items.length - maxItems + 1 : 0
  const visibleItems = (hidden > 0 ? [items[0], ...items.slice(hidden + 1)] : items).filter(
    (item): item is NonNullable<typeof item> => Boolean(item),
  )

  return (
    <nav aria-label="面包屑" className={cn('flex min-w-0 items-center gap-1 text-xs', className)}>
      {visibleItems.map((item, index) => {
        if (!item) return null
        const isLast = index === visibleItems.length - 1
        return (
          <span key={index} className="flex min-w-0 items-center gap-1">
            {index > 0 && (
              <span className="shrink-0 text-fg-4" aria-hidden="true">
                {separator ?? (
                  <svg viewBox="0 0 24 24" className="size-3" fill="none">
                    <path
                      d="m9 6 6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </span>
            )}
            {index === 0 && hidden > 0 && (
              <>
                {item.href || item.onClick ? (
                  <a
                    href={item.href}
                    onClick={(e) => {
                      if (item.onClick) {
                        e.preventDefault()
                        item.onClick()
                      }
                    }}
                    className="truncate text-fg-3 transition-colors hover:text-primary"
                  >
                    {item.label}
                  </a>
                ) : (
                  <span className="truncate text-fg-3">{item.label}</span>
                )}
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  aria-label="展开更多层级"
                  className="shrink-0 rounded-sm p-0.5 text-fg-4 hover:bg-surface-2 hover:text-fg-2"
                >
                  <svg viewBox="0 0 24 24" className="size-3" fill="currentColor">
                    <circle cx="5" cy="12" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="19" cy="12" r="1.5" />
                  </svg>
                </button>
              </>
            )}
            {!(index === 0 && hidden > 0) && (
              <>
                {isLast ? (
                  <span className="truncate font-medium text-fg" aria-current="page">
                    {item.icon}
                    {item.label}
                  </span>
                ) : item.href || item.onClick ? (
                  <a
                    href={item.href}
                    onClick={(e) => {
                      if (item.onClick) {
                        e.preventDefault()
                        item.onClick()
                      }
                    }}
                    className="truncate text-fg-3 transition-colors hover:text-primary"
                  >
                    {item.icon}
                    {item.label}
                  </a>
                ) : (
                  <span className="truncate text-fg-3">
                    {item.icon}
                    {item.label}
                  </span>
                )}
              </>
            )}
          </span>
        )
      })}
    </nav>
  )
}

/** 垂直标签导航（设置页左栏） */
export function SideTabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[]
  value: string
  onChange: (key: string) => void
  className?: string
}) {
  useEffect(() => {
    // 保留接口一致性（滚动定位可由调用方扩展）
  }, [value])

  return (
    <nav
      className={cn('flex flex-col gap-0.5', className)}
      role="tablist"
      aria-orientation="vertical"
    >
      {items.map((item) => {
        const selected = item.key === value
        return (
          <button
            key={item.key}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.key)}
            className={cn(
              'flex h-8 items-center gap-2 rounded-md px-2.5 text-left text-[0.8125rem] transition-colors',
              selected
                ? 'bg-primary-weak font-medium text-primary'
                : 'text-fg-2 hover:bg-surface-2',
            )}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
