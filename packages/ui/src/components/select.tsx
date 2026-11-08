import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn, fuzzyMatch } from '../lib/utils'
import { useClickOutside, useUILabels } from '../lib/hooks'
import { useFieldContext } from './input'

export interface SelectOption {
  label: ReactNode
  value: string
  description?: string
  disabled?: boolean
  /** 选项左侧图标 */
  icon?: ReactNode
  /** 分组名 */
  group?: string
}

export interface SelectProps {
  options: SelectOption[]
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  placeholder?: string
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  clearable?: boolean
  /** 是否可搜索 */
  searchable?: boolean
  /** 多选（受控：value 传数组时生效） */
  multiple?: boolean
  values?: string[]
  onValuesChange?: (values: string[]) => void
  className?: string
  /** 下拉层对齐宽度 */
  popupClassName?: string
  status?: 'default' | 'error'
  leftIcon?: ReactNode
}

/**
 * 从 `from` 起按方向找第一个可选项的下标
 *
 * 用于「用方向键唤起下拉」时定位高亮：
 * 直接落到 0 会撞上禁用项，落到 -1 又会让 Enter 选不中任何东西。
 */
function firstEnabledIndex(options: SelectOption[], from: number, step = 1): number {
  for (let index = from; index >= 0 && index < options.length; index += step) {
    if (!options[index]?.disabled) return index
  }
  return from
}

/**
 * 选择器（单选/多选/可搜索）
 *
 * 为什么自研：避免引入 3 万行 UI 库，同时保证键盘导航与 a11y
 *
 * @example
 * <Select options={regions} value={region} onChange={setRegion} searchable />
 */
export function Select({
  options,
  value,
  defaultValue,
  onChange,
  placeholder,
  size = 'md',
  disabled,
  clearable,
  searchable,
  multiple,
  values,
  onValuesChange,
  className,
  popupClassName,
  status = 'default',
  leftIcon,
}: SelectProps) {
  const L = useUILabels()
  const isMulti = Boolean(multiple)
  const field = useFieldContext()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [internalValue, setInternalValue] = useState(defaultValue ?? '')
  const [internalValues, setInternalValues] = useState<string[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const rootRef = useClickOutside<HTMLDivElement>(() => setOpen(false), open)
  const listId = useId()
  /** 供 aria-activedescendant 使用的选项 id 前缀 */
  const optionIdBase = useId()
  const resolvedStatus = status === 'default' && field?.invalid ? 'error' : status

  const selectedValue = value ?? internalValue
  const selectedValues = values ?? internalValues

  const filtered = query
    ? options.filter((opt) => fuzzyMatch(String(opt.label) + (opt.description ?? ''), query))
    : options

  const selectedLabels = isMulti
    ? options.filter((opt) => selectedValues.includes(opt.value))
    : options.filter((opt) => opt.value === selectedValue)

  const commit = (next: string) => {
    if (value === undefined) setInternalValue(next)
    onChange?.(next)
    if (!isMulti) {
      setOpen(false)
      setQuery('')
    }
  }

  const commitMulti = (next: string[]) => {
    if (values === undefined) setInternalValues(next)
    onValuesChange?.(next)
  }

  const toggleValue = (val: string) => {
    if (isMulti) {
      commitMulti(
        selectedValues.includes(val)
          ? selectedValues.filter((v) => v !== val)
          : [...selectedValues, val],
      )
    } else {
      commit(val)
    }
  }

  useEffect(() => {
    if (open && searchable) {
      // 打开时聚焦搜索框
      requestAnimationFrame(() => searchRef.current?.focus())
      setActiveIndex(-1)
    }
  }, [open, searchable])

  // 关闭时清掉高亮，避免下次用 Enter 唤起时直接选中上次的残留项
  useEffect(() => {
    if (!open) setActiveIndex(-1)
  }, [open])

  useEffect(() => {
    if (!open || activeIndex < 0) return
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    if (!open && ['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault()
      setOpen(true)
      // 用方向键唤起时顺手定位高亮：否则要按第二下才有反馈，
      // 且 Enter 会因为 activeIndex 仍是 -1 而选不中任何项
      if (event.key === 'ArrowDown') setActiveIndex(firstEnabledIndex(filtered, 0))
      if (event.key === 'ArrowUp')
        setActiveIndex(firstEnabledIndex(filtered, filtered.length - 1, -1))
      return
    }
    if (!open) return
    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        setOpen(false)
        break
      case 'ArrowDown':
        event.preventDefault()
        setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActiveIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter': {
        event.preventDefault()
        const opt = filtered[activeIndex]
        if (opt && !opt.disabled) toggleValue(opt.value)
        break
      }
      default:
        break
    }
  }

  const heightClass =
    size === 'sm'
      ? 'h-[var(--n-control-h-sm)]'
      : size === 'lg'
        ? 'h-[var(--n-control-h-lg)]'
        : 'h-[var(--n-control-h)]'

  const groups = filtered.reduce<Record<string, SelectOption[]>>((acc, opt) => {
    const key = opt.group ?? ''
    ;(acc[key] ??= []).push(opt)
    return acc
  }, {})

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      <div
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-labelledby={field?.labelledBy}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        aria-required={field?.required || undefined}
        aria-activedescendant={
          open && activeIndex >= 0 ? `${optionIdBase}-opt-${activeIndex}` : undefined
        }
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={cn(
          'flex w-full cursor-pointer items-center gap-1.5 rounded-md border bg-surface px-2.5 text-[0.8125rem] transition-[border-color,box-shadow] duration-150',
          heightClass,
          resolvedStatus === 'error' ? 'border-danger' : 'border-line',
          open && 'ring-primary-ring border-primary/70 ring-2',
          !open && 'hover:border-line-strong',
          disabled && 'cursor-not-allowed bg-surface-2 opacity-70',
        )}
      >
        {leftIcon && <span className="shrink-0 text-fg-3">{leftIcon}</span>}
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
          {selectedLabels.length === 0 && (
            <span className="truncate text-fg-4">{placeholder ?? L.selectPlaceholder}</span>
          )}
          {isMulti ? (
            selectedLabels.length > 2 ? (
              <span className="truncate text-fg">{L.selectedCount(selectedLabels.length)}</span>
            ) : (
              selectedLabels.map((opt) => (
                <span
                  key={opt.value}
                  className="inline-flex max-w-[6.875rem] items-center gap-1 rounded-sm bg-primary-weak px-1.5 py-0.5 text-xs text-primary"
                >
                  <span className="truncate">{opt.label}</span>
                </span>
              ))
            )
          ) : (
            <span className="truncate text-fg">{selectedLabels[0]?.label}</span>
          )}
        </div>
        {clearable && selectedLabels.length > 0 && !disabled && (
          <button
            type="button"
            aria-label={L.clear}
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation()
              if (isMulti) commitMulti([])
              else commit('')
            }}
            className="shrink-0 rounded-full p-0.5 text-fg-4 hover:bg-surface-3 hover:text-fg-2"
          >
            <svg viewBox="0 0 24 24" className="size-3" fill="none" aria-hidden="true">
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
        <svg
          viewBox="0 0 24 24"
          className={cn(
            'size-3.5 shrink-0 text-fg-3 transition-transform duration-200',
            open && 'rotate-180',
          )}
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable={isMulti || undefined}
          className={cn(
            'absolute top-[calc(100%+0.25rem)] right-0 left-0 z-50 max-h-64 overflow-hidden rounded-md border border-line bg-surface shadow-lg',
            'n-enter',
            popupClassName,
          )}
        >
          {searchable && (
            <div className="border-b border-line p-1.5">
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={L.searchOptions}
                className="h-7 w-full rounded-sm bg-surface-2 px-2 text-xs text-fg outline-none placeholder:text-fg-4"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation()
                    setOpen(false)
                  }
                }}
              />
            </div>
          )}
          <div ref={listRef} className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-fg-3">无匹配结果</p>
            )}
            {Object.entries(groups).map(([group, items]) => (
              <div key={group}>
                {group && (
                  <p className="px-2 py-1 text-2xs font-medium tracking-wide text-fg-4 uppercase">
                    {group}
                  </p>
                )}
                {items.map((opt) => {
                  const rawIndex = filtered.indexOf(opt)
                  const selected = isMulti
                    ? selectedValues.includes(opt.value)
                    : opt.value === selectedValue
                  return (
                    <div
                      key={opt.value}
                      id={`${optionIdBase}-opt-${rawIndex}`}
                      role="option"
                      aria-selected={selected}
                      aria-disabled={opt.disabled || undefined}
                      data-index={rawIndex}
                      onMouseEnter={() => setActiveIndex(rawIndex)}
                      onClick={() => !opt.disabled && toggleValue(opt.value)}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-[0.8125rem] transition-colors',
                        selected ? 'bg-primary-weak text-primary' : 'text-fg hover:bg-surface-2',
                        activeIndex === rawIndex && !selected && 'bg-surface-2',
                        opt.disabled && 'cursor-not-allowed opacity-40',
                      )}
                    >
                      {opt.icon && <span className="shrink-0 text-fg-3">{opt.icon}</span>}
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{opt.label}</p>
                        {opt.description && (
                          <p className="truncate text-2xs text-fg-3">{opt.description}</p>
                        )}
                      </div>
                      {selected && (
                        <svg
                          viewBox="0 0 24 24"
                          className="size-3.5 shrink-0"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="m5 12.5 4.5 4.5L19 7"
                            stroke="currentColor"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
