import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '../lib/utils'
import { sx } from '../lib/scale'

export type FuzzyTreeFilter = (keyword: string, node: TreeItem) => boolean

export interface TreeItem {
  key: string
  title: ReactNode
  icon?: ReactNode
  extra?: ReactNode
  disabled?: boolean
  children?: TreeItem[]
}

export interface TreeProps {
  items: TreeItem[]
  /** 选中节点 */
  selectedKey?: string
  defaultSelectedKey?: string
  onSelect?: (key: string, item: TreeItem) => void
  /** 是否默认展开全部 */
  defaultExpandAll?: boolean
  /** 展开受控 */
  expandedKeys?: string[]
  onExpandedChange?: (keys: string[]) => void
  /** 显示连接线 */
  showLine?: boolean
  className?: string
  /** 空状态 */
  empty?: ReactNode
}

/**
 * 树形控件 · 键盘完全可达
 *
 * 键位（遵循 WAI-ARIA tree 模式）：
 * - ↑ / ↓      在可见节点间移动
 * - →          展开当前节点；已展开则进入第一个子节点
 * - ←          收起当前节点；已收起则回到父节点
 * - Home / End 跳到第一个 / 最后一个可见节点
 * - Enter / Space 选中当前节点
 *
 * @example
 * <Tree items={orgTree} defaultExpandAll onSelect={(key) => setSelected(key)} showLine />
 */
export function Tree({
  items,
  selectedKey,
  defaultSelectedKey,
  onSelect,
  defaultExpandAll = false,
  expandedKeys,
  onExpandedChange,
  showLine = true,
  className,
  empty,
}: TreeProps) {
  const [internalSelected, setInternalSelected] = useState(defaultSelectedKey ?? '')
  const [internalExpanded, setInternalExpanded] = useState<string[]>(() =>
    defaultExpandAll ? collectKeys(items) : [],
  )
  /** 键盘焦点节点（roving tabindex），与 selected 解耦 */
  const [activeKey, setActiveKey] = useState('')
  const rootRef = useRef<HTMLUListElement>(null)

  const selected = selectedKey ?? internalSelected
  const expanded = expandedKeys ?? internalExpanded

  const setExpanded = (next: string[]) => {
    if (expandedKeys === undefined) setInternalExpanded(next)
    onExpandedChange?.(next)
  }

  const toggleExpand = (key: string) => {
    setExpanded(
      expanded.includes(key) ? expanded.filter((item) => item !== key) : [...expanded, key],
    )
  }

  const select = (key: string, node: TreeItem) => {
    if (selectedKey === undefined) setInternalSelected(key)
    onSelect?.(key, node)
  }

  /** 当前可见（父级均已展开）的扁平节点列表，键盘导航的唯一数据源 */
  const visibleNodes = useMemo(() => flattenVisible(items, expanded), [items, expanded])

  /** 初始焦点：选中项 → 第一个可用项 */
  const focusKey = useMemo(() => {
    if (activeKey && visibleNodes.some((node) => node.key === activeKey)) return activeKey
    if (selected && visibleNodes.some((node) => node.key === selected)) return selected
    return visibleNodes.find((node) => !node.disabled)?.key ?? ''
  }, [activeKey, visibleNodes, selected])

  const moveFocus = useCallback((target: string | undefined) => {
    if (!target) return
    setActiveKey(target)
    // 遍历比较 dataset，避免依赖 CSS.escape（jsdom / 老浏览器可能缺失）
    const nodes = rootRef.current?.querySelectorAll<HTMLElement>('[data-tree-key]')
    if (!nodes) return
    for (const node of nodes) {
      if (node.dataset.treeKey === target) {
        node.focus()
        return
      }
    }
  }, [])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    const index = visibleNodes.findIndex((node) => node.key === focusKey)
    const current = visibleNodes[index]
    if (!current) return

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        moveFocus(nextEnabled(visibleNodes, index, 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        moveFocus(nextEnabled(visibleNodes, index, -1))
        break
      case 'Home':
        event.preventDefault()
        moveFocus(visibleNodes.find((node) => !node.disabled)?.key)
        break
      case 'End':
        event.preventDefault()
        moveFocus([...visibleNodes].reverse().find((node) => !node.disabled)?.key)
        break
      case 'ArrowRight': {
        event.preventDefault()
        if (current.children?.length) {
          if (!expanded.includes(current.key)) toggleExpand(current.key)
          else moveFocus(current.children.find((child) => !child.disabled)?.key)
        }
        break
      }
      case 'ArrowLeft': {
        event.preventDefault()
        if (current.children?.length && expanded.includes(current.key)) toggleExpand(current.key)
        else if (current.parentKey) moveFocus(current.parentKey)
        break
      }
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (!current.disabled) select(current.key, current)
        break
      default:
        break
    }
  }

  if (items.length === 0) {
    return <div className="py-6 text-center text-xs text-fg-3">{empty ?? '暂无数据'}</div>
  }

  return (
    <ul
      ref={rootRef}
      role="tree"
      aria-label="树形导航"
      onKeyDown={handleKeyDown}
      className={cn('text-[0.8125rem]', className)}
    >
      {items.map((item) => (
        <TreeRow
          key={item.key}
          item={item}
          depth={0}
          selected={selected}
          expanded={expanded}
          focusKey={focusKey}
          showLine={showLine}
          onToggle={(key) => toggleExpand(key)}
          onFocus={setActiveKey}
          onSelect={select}
        />
      ))}
    </ul>
  )
}

/** 按展开状态压平成可见节点，并记录父节点 key */
interface FlatNode extends TreeItem {
  parentKey?: string
}

function flattenVisible(items: TreeItem[], expanded: string[], parentKey?: string): FlatNode[] {
  const result: FlatNode[] = []
  for (const item of items) {
    result.push({ ...item, parentKey })
    if (item.children?.length && expanded.includes(item.key)) {
      result.push(...flattenVisible(item.children, expanded, item.key))
    }
  }
  return result
}

/** 方向查找时跳过 disabled 节点 */
function nextEnabled(nodes: FlatNode[], from: number, step: 1 | -1): string | undefined {
  for (let i = from + step; i >= 0 && i < nodes.length; i += step) {
    if (!nodes[i]?.disabled) return nodes[i]!.key
  }
  return undefined
}

function TreeRow({
  item,
  depth,
  selected,
  expanded,
  focusKey,
  showLine,
  onToggle,
  onFocus,
  onSelect,
}: {
  item: TreeItem
  depth: number
  selected: string
  expanded: string[]
  focusKey: string
  showLine: boolean
  onToggle: (key: string) => void
  onFocus: (key: string) => void
  onSelect: (key: string, item: TreeItem) => void
}) {
  const hasChildren = Boolean(item.children?.length)
  const isOpen = expanded.includes(item.key)
  const isSelected = selected === item.key
  const isFocused = focusKey === item.key

  return (
    <li role="treeitem" aria-expanded={hasChildren ? isOpen : undefined} aria-selected={isSelected}>
      <div
        className={cn(
          'group flex h-7 items-center gap-1 rounded-md pr-1.5 transition-colors',
          isSelected ? 'bg-primary-weak text-primary' : 'hover:bg-surface-2',
          item.disabled && 'pointer-events-none opacity-50',
        )}
        style={{ paddingLeft: depth * 14 }}
      >
        {hasChildren ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label={isOpen ? '收起' : '展开'}
            onClick={() => onToggle(item.key)}
            className="grid size-4 shrink-0 place-items-center text-fg-4 transition-colors hover:text-fg-2"
          >
            <svg
              viewBox="0 0 24 24"
              className={cn('size-3 transition-transform duration-150', isOpen && 'rotate-90')}
              fill="none"
              aria-hidden="true"
            >
              <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        ) : (
          showLine && (
            <span className="grid size-4 shrink-0 place-items-center text-fg-4/50">
              <svg viewBox="0 0 24 24" className="size-3" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
            </span>
          )
        )}
        <button
          type="button"
          data-tree-key={item.key}
          tabIndex={isFocused ? 0 : -1}
          onFocus={() => onFocus(item.key)}
          onClick={() => onSelect(item.key, item)}
          className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md text-left outline-none"
        >
          {item.icon && (
            <span className={cn('shrink-0', isSelected ? 'text-primary' : 'text-fg-3')}>
              {item.icon}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate">{item.title}</span>
          {item.extra && <span className="shrink-0">{item.extra}</span>}
        </button>
      </div>
      {hasChildren && isOpen && (
        <ul role="group" className={cn(showLine && 'relative')}>
          {showLine && (
            <span
              className="absolute top-0 bottom-1 w-px bg-line-subtle"
              style={{ left: depth * 14 + 7 }}
              aria-hidden="true"
            />
          )}
          {item.children?.map((child) => (
            <TreeRow
              key={child.key}
              item={child}
              depth={depth + 1}
              selected={selected}
              expanded={expanded}
              focusKey={focusKey}
              showLine={showLine}
              onToggle={onToggle}
              onFocus={onFocus}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function collectKeys(items: TreeItem[]): string[] {
  const keys: string[] = []
  const walk = (nodes: TreeItem[]) => {
    for (const node of nodes) {
      if (node.children?.length) {
        keys.push(node.key)
        walk(node.children)
      }
    }
  }
  walk(items)
  return keys
}

/* ------------------------------------------------------------------ *
 * Transfer 穿梭框：把左侧候选移到右侧已选
 * ------------------------------------------------------------------ */

export interface TransferItem {
  key: string
  title: ReactNode
  description?: ReactNode
  disabled?: boolean
}

export interface TransferProps {
  dataSource: TransferItem[]
  targetKeys: string[]
  onChange: (keys: string[]) => void
  titles?: [ReactNode, ReactNode]
  height?: number
  className?: string
  searchable?: boolean
}

/** 穿梭框 */
export function Transfer({
  dataSource,
  targetKeys,
  onChange,
  titles = ['待选', '已选'],
  height = 280,
  className,
  searchable = true,
}: TransferProps) {
  const [sourceQuery, setSourceQuery] = useState('')
  const [targetQuery, setTargetQuery] = useState('')
  const [sourceChecked, setSourceChecked] = useState<string[]>([])
  const [targetChecked, setTargetChecked] = useState<string[]>([])

  const sourceItems = dataSource.filter(
    (item) =>
      !targetKeys.includes(item.key) && (!sourceQuery || String(item.title).includes(sourceQuery)),
  )
  const targetItems = dataSource.filter(
    (item) =>
      targetKeys.includes(item.key) && (!targetQuery || String(item.title).includes(targetQuery)),
  )

  const moveToTarget = () => {
    onChange([...new Set([...targetKeys, ...sourceChecked])])
    setSourceChecked([])
  }
  const moveToSource = () => {
    onChange(targetKeys.filter((key) => !targetChecked.includes(key)))
    setTargetChecked([])
  }

  return (
    <div className={cn('flex items-stretch gap-2', className)}>
      <TransferPanel
        title={titles[0]}
        query={sourceQuery}
        onQueryChange={setSourceQuery}
        searchable={searchable}
        height={height}
        items={sourceItems}
        checked={sourceChecked}
        onCheckedChange={setSourceChecked}
        footer={`${sourceChecked.length} / ${sourceItems.length}`}
      />
      <div className="flex flex-col justify-center gap-1.5">
        <button
          type="button"
          disabled={sourceChecked.length === 0}
          onClick={moveToTarget}
          className="grid size-7 place-items-center rounded-md border border-line bg-surface text-fg-3 transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40"
          aria-label="移到已选"
        >
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" aria-hidden="true">
            <path
              d="m9 6 6 6-6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          disabled={targetChecked.length === 0}
          onClick={moveToSource}
          className="grid size-7 place-items-center rounded-md border border-line bg-surface text-fg-3 transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40"
          aria-label="移回待选"
        >
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" aria-hidden="true">
            <path
              d="m15 6-6 6 6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <TransferPanel
        title={titles[1]}
        query={targetQuery}
        onQueryChange={setTargetQuery}
        searchable={searchable}
        height={height}
        items={targetItems}
        checked={targetChecked}
        onCheckedChange={setTargetChecked}
        footer={`${targetChecked.length} / ${targetItems.length}`}
      />
    </div>
  )
}

function TransferPanel({
  title,
  items,
  checked,
  onCheckedChange,
  query,
  onQueryChange,
  searchable,
  height,
  footer,
}: {
  title: ReactNode
  items: TransferItem[]
  checked: string[]
  onCheckedChange: (keys: string[]) => void
  query: string
  onQueryChange: (value: string) => void
  searchable: boolean
  height: number
  footer: string
}) {
  const allChecked = items.length > 0 && items.every((item) => checked.includes(item.key))

  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-md border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-2.5 py-1.5">
        <span className="text-xs font-medium text-fg-2">{title}</span>
        <span className="text-2xs text-fg-4 tabular-nums">{footer}</span>
      </div>
      {searchable && (
        <div className="border-b border-line-subtle p-1.5">
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索…"
            className="h-6 w-full rounded-sm bg-surface-2 px-2 text-2xs text-fg outline-none placeholder:text-fg-4"
          />
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-1" style={{ height: sx(height) }}>
        {items.length === 0 && <p className="py-6 text-center text-2xs text-fg-4">暂无数据</p>}
        {items.map((item) => {
          const isChecked = checked.includes(item.key)
          return (
            <label
              key={item.key}
              className={cn(
                'flex cursor-pointer items-start gap-2 rounded-sm px-1.5 py-1 transition-colors hover:bg-surface-2',
                item.disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <input
                type="checkbox"
                checked={isChecked}
                disabled={item.disabled}
                onChange={() =>
                  onCheckedChange(
                    isChecked ? checked.filter((key) => key !== item.key) : [...checked, item.key],
                  )
                }
                className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-primary"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-fg">{item.title}</span>
                {item.description && (
                  <span className="block truncate text-2xs text-fg-3">{item.description}</span>
                )}
              </span>
            </label>
          )
        })}
      </div>
      <div className="flex items-center justify-between border-t border-line px-2 py-1">
        <label className="flex cursor-pointer items-center gap-1.5 text-2xs text-fg-3">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={() => onCheckedChange(allChecked ? [] : items.map((item) => item.key))}
            className="size-3 cursor-pointer accent-primary"
          />
          全选
        </label>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Timeline 竖向进度 + 上传列表
 * ------------------------------------------------------------------ */

export interface UploadFileItem {
  id: string
  name: string
  size: number
  /** 0-100 */
  progress: number
  status: 'uploading' | 'done' | 'error'
}

export interface UploadListProps {
  files: UploadFileItem[]
  onRemove?: (id: string) => void
  onRetry?: (id: string) => void
  className?: string
  formatSize?: (bytes: number) => string
}

/** 上传列表（展示进度与状态） */
export function UploadList({ files, onRemove, onRetry, className, formatSize }: UploadListProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={cn('space-y-1.5', className)}>
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5"
        >
          <span
            className={cn(
              'grid size-7 shrink-0 place-items-center rounded-sm',
              file.status === 'done'
                ? 'bg-success-weak text-success'
                : file.status === 'error'
                  ? 'bg-danger-weak text-danger'
                  : 'bg-primary-weak text-primary',
            )}
          >
            <FileIcon />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-xs text-fg">{file.name}</p>
              <span className="shrink-0 text-2xs text-fg-4 tabular-nums">
                {formatSize ? formatSize(file.size) : `${(file.size / 1024 / 1024).toFixed(1)} MB`}
              </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-3">
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-300',
                  file.status === 'done'
                    ? 'bg-success'
                    : file.status === 'error'
                      ? 'bg-danger'
                      : 'bg-primary',
                )}
                style={{ width: `${file.progress}%` }}
              />
            </div>
          </div>
          {file.status === 'error' && onRetry && (
            <button
              type="button"
              onClick={() => onRetry(file.id)}
              className="shrink-0 text-2xs text-primary hover:underline"
            >
              重试
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              aria-label={`移除 ${file.name}`}
              onClick={() => onRemove(file.id)}
              className="shrink-0 rounded p-0.5 text-fg-4 hover:text-danger"
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
        </div>
      ))}
      <input ref={inputRef} type="file" className="hidden" multiple />
    </div>
  )
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" aria-hidden="true">
      <path
        d="M6 3.5h8l4 4v13H6v-17Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 3.5v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

/* ------------------------------------------------------------------ *
 * Calendar 日历：月视图，支持标记与选中
 * ------------------------------------------------------------------ */

export interface CalendarProps {
  value?: Date
  onChange?: (date: Date) => void
  /** 有事件的日期（YYYY-MM-DD） */
  markedDates?: string[]
  className?: string
  /** 周起始日：0 周日 / 1 周一 */
  weekStartsOn?: 0 | 1
}

function toKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** 日历（月视图） */
export function Calendar({
  value,
  onChange,
  markedDates = [],
  className,
  weekStartsOn = 1,
}: CalendarProps) {
  const [cursor, setCursor] = useState(() => value ?? new Date())
  const [selected, setSelected] = useState<Date | null>(value ?? null)
  const todayKey = toKey(new Date())

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leading = (firstDay.getDay() - weekStartsOn + 7) % 7
  const weekLabels =
    weekStartsOn === 1
      ? ['一', '二', '三', '四', '五', '六', '日']
      : ['日', '一', '二', '三', '四', '五', '六']

  const cells = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]

  return (
    <div className={cn('rounded-md border border-line bg-surface p-2.5', className)}>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="上个月"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="grid size-6 place-items-center rounded-sm text-fg-3 hover:bg-surface-2 hover:text-fg"
        >
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" aria-hidden="true">
            <path
              d="m14 6-6 6 6 6"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span className="text-xs font-semibold text-fg">
          {year} 年 {month + 1} 月
        </span>
        <button
          type="button"
          aria-label="下个月"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="grid size-6 place-items-center rounded-sm text-fg-3 hover:bg-surface-2 hover:text-fg"
        >
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" aria-hidden="true">
            <path
              d="m10 6 6 6-6 6"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {weekLabels.map((label) => (
          <span key={label} className="grid h-6 place-items-center text-2xs text-fg-4">
            {label}
          </span>
        ))}
        {cells.map((day, index) => {
          if (day === null) return <span key={`empty-${index}`} />
          const date = new Date(year, month, day)
          const key = toKey(date)
          const isSelected = selected ? toKey(selected) === key : false
          const isToday = key === todayKey
          const marked = markedDates.includes(key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setSelected(date)
                onChange?.(date)
              }}
              className={cn(
                'relative grid h-7 place-items-center rounded-sm text-xs transition-colors',
                isSelected
                  ? 'bg-primary font-medium text-primary-fg'
                  : isToday
                    ? 'text-primary ring-1 ring-inset ring-primary/40'
                    : 'text-fg-2 hover:bg-surface-2',
              )}
            >
              {day}
              {marked && !isSelected && (
                <span
                  className="absolute bottom-0.5 size-1 rounded-full bg-warning"
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>
      {markedDates.length > 0 && (
        <p className="mt-2 flex items-center gap-1 border-t border-line-subtle pt-1.5 text-2xs text-fg-4">
          <span className="size-1 rounded-full bg-warning" />
          {markedDates.length} 个日程
        </p>
      )}
    </div>
  )
}
