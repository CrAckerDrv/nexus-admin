import {
  createContext,
  useContext,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
  type ThHTMLAttributes,
} from 'react'
import { cn } from '../lib/utils'
import { useControllableState } from '../lib/hooks'
import { sx, sxSize } from '../lib/scale'

/* ------------------------------------------------------------------ *
 * 表格基础件：Table / THead / TBody / Tr / Th / Td
 * 统一边框、悬停、选中态，业务侧只需描述列
 * ------------------------------------------------------------------ */

export function Table({
  children,
  className,
  striped = true,
  hover = true,
  density = 'default',
}: {
  children: ReactNode
  className?: string
  /** 斑马纹 */
  striped?: boolean
  /** 行悬停高亮 */
  hover?: boolean
  density?: 'compact' | 'default' | 'comfortable'
}) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table
        className="n-table w-full"
        data-striped={striped || undefined}
        data-hover={hover || undefined}
        data-density={density}
      >
        {children}
      </table>
    </div>
  )
}

export function THead({ children, sticky }: { children: ReactNode; sticky?: boolean }) {
  return <thead className={cn(sticky && 'sticky top-0 z-10')}>{children}</thead>
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>
}

export function Tr({
  children,
  className,
  selected,
  onClick,
}: {
  children: ReactNode
  className?: string
  selected?: boolean
  onClick?: () => void
}) {
  return (
    <tr
      onClick={onClick}
      data-selected={selected || undefined}
      className={cn('transition-colors', onClick && 'cursor-pointer', className)}
    >
      {children}
    </tr>
  )
}

export interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /** 排序方向 */
  sort?: 'asc' | 'desc' | null
  onSort?: () => void
  align?: 'left' | 'center' | 'right'
  width?: number | string
}

export function Th({
  sort,
  onSort,
  align = 'left',
  width,
  className,
  style,
  children,
  ...props
}: ThProps) {
  return (
    <th
      scope="col"
      // `style` 合并而非覆盖：固定列会传入 sticky 偏移，列宽不能因此丢失
      style={width ? { width: sxSize(width), ...style } : style}
      className={cn(
        'h-10 px-3 text-left font-medium whitespace-nowrap',
        align === 'center' && 'text-center',
        align === 'right' && 'n-num',
        className,
      )}
      {...props}
    >
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            'inline-flex items-center gap-1 transition-colors hover:text-fg',
            sort && 'text-primary',
            align === 'right' && 'flex-row-reverse',
          )}
        >
          {children}
          <span className={cn('inline-flex flex-col', sort ? 'opacity-100' : 'opacity-30')}>
            <svg
              viewBox="0 0 24 24"
              className={cn('-mb-0.5 size-2.5', sort === 'asc' && 'text-primary')}
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 5l6 8H6l6-8z" />
            </svg>
            <svg
              viewBox="0 0 24 24"
              className={cn('size-2.5', sort === 'desc' && 'text-primary')}
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 19l-6-8h12l-6 8z" />
            </svg>
          </span>
        </button>
      ) : (
        children
      )}
    </th>
  )
}

export function Td({
  children,
  align = 'left',
  className,
  colSpan,
  mono,
  numeric,
}: {
  children: ReactNode
  align?: 'left' | 'center' | 'right'
  className?: string
  colSpan?: number
  mono?: boolean
  numeric?: boolean
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        'px-3 align-middle',
        align === 'center' && 'text-center',
        align === 'right' && 'n-num',
        mono && 'font-mono text-xs',
        numeric && 'n-num',
        className,
      )}
    >
      {children}
    </td>
  )
}

/* ------------------------------------------------------------------ *
 * DataTable：泛型数据表，支持排序 / 选择 / 空态 / 加载
 * ------------------------------------------------------------------ */

export interface Column<T> {
  key: string
  header: ReactNode
  /** 单元格渲染 */
  cell: (row: T, index: number) => ReactNode
  /** 排序值访问器（提供则表头可排序） */
  sortValue?: (row: T) => string | number
  align?: 'left' | 'center' | 'right'
  width?: number | string
  className?: string
  /** 列可见性默认开关 */
  hidden?: boolean
  /**
   * 固定列位置。`true` 等价于 `'right'`（兼容旧写法）。
   * 固定列必须给出 `width`，否则 sticky 偏移无法计算。
   */
  pinned?: boolean | 'left' | 'right'
}

/** 把 `pinned` 归一化为方向，未固定返回 undefined */
export function pinnedSide<T>(column: Column<T>): 'left' | 'right' | undefined {
  if (!column.pinned) return undefined
  return column.pinned === true ? 'right' : column.pinned
}

/** 把列宽归一化为 px 数值（sticky 偏移计算需要） */
function toPx(width: Column<unknown>['width']): number {
  if (typeof width === 'number') return width
  if (typeof width === 'string' && /^\d+(\.\d+)?(px)?$/.test(width.trim())) {
    return Number.parseFloat(width)
  }
  return 0
}

/**
 * 计算每列的 sticky 偏移
 *
 * 只对固定列返回样式；未固定的列不产生任何 sticky 开销。
 * `selectable` 时左侧选择列并入 left 区，偏移整体右移。
 *
 * 偏移量用 rem 表达（`left: '11.25rem'`），与列宽的书写单位保持一致 ——
 * 若混用 px 数字，改列宽或改单位时固定列就会错位。
 */
export function computeSticky<T>(
  columns: Column<T>[],
  selectable: boolean,
  selectWidth = 40,
): Map<string, { style?: CSSProperties; side: 'left' | 'right' }> {
  const result = new Map<string, { style?: CSSProperties; side: 'left' | 'right' }>()
  const lefts = columns.filter((column) => pinnedSide(column) === 'left')
  const rights = columns.filter((column) => pinnedSide(column) === 'right')

  let offset = selectable ? selectWidth : 0
  for (const column of lefts) {
    result.set(column.key, {
      side: 'left',
      style: { position: 'sticky', left: offset ? sx(offset) : 0, zIndex: 1 },
    })
    offset += toPx(column.width)
  }

  offset = 0
  for (let index = rights.length - 1; index >= 0; index -= 1) {
    const column = rights[index]!
    result.set(column.key, {
      side: 'right',
      style: { position: 'sticky', right: offset ? sx(offset) : 0, zIndex: 1 },
    })
    offset += toPx(column.width)
  }

  return result
}

/** sticky 单元格类名：实底 + 边缘投影 */
export function stickyCellClass(side: 'left' | 'right', isLast: boolean, head = false): string {
  return cn(
    head ? 'n-sticky-head' : 'n-sticky-cell',
    isLast && (side === 'left' ? 'n-sticky-edge-l' : 'n-sticky-edge-r'),
  )
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  getRowId: (row: T) => string
  loading?: boolean
  /** 行选择 */
  selectable?: boolean
  selectedIds?: string[]
  onSelectedChange?: (ids: string[]) => void
  /** 行点击 */
  onRowClick?: (row: T) => void
  /** 空状态 */
  empty?: ReactNode
  /** 最小行数占位，避免高度抖动 */
  minRows?: number
  className?: string
  /** 表格容器最大高度（开启纵向滚动 + 吸顶表头） */
  maxHeight?: number
  /** 默认排序 */
  defaultSort?: { key: string; dir: 'asc' | 'desc' }
  /** 行附加类名 */
  rowClassName?: (row: T) => string | undefined
  /** 斑马纹（默认开启） */
  striped?: boolean
  /** 行悬停高亮（默认开启） */
  hoverable?: boolean
  /** 行高密度 */
  density?: 'compact' | 'default' | 'comfortable'
}

const SelectionContext = createContext<{
  selected: string[]
  toggle: (id: string) => void
  toggleAll: (ids: string[], next: boolean) => void
} | null>(null)

/**
 * 数据表格
 *
 * 关键设计：
 * 1. 泛型列定义，渲染与数据解耦
 * 2. 排序/选择状态内置，业务只需传 rows
 * 3. 骨架与空态统一，避免页面跳变
 *
 * @example
 * <DataTable
 *   rows={users}
 *   getRowId={(u) => u.id}
 *   columns={[
 *     { key: 'name', header: '姓名', cell: (u) => u.name, sortValue: (u) => u.name },
 *     { key: 'status', header: '状态', cell: (u) => <Badge>{u.status}</Badge> },
 *   ]}
 * />
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  loading,
  selectable,
  selectedIds,
  onSelectedChange,
  onRowClick,
  empty,
  minRows = 6,
  className,
  maxHeight,
  defaultSort,
  rowClassName,
  striped = true,
  hoverable = true,
  density = 'default',
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(defaultSort ?? null)
  const [internalSelected, setInternalSelected] = useControllableState<string[]>({
    value: selectedIds,
    defaultValue: [],
    onChange: onSelectedChange,
  })

  const visibleColumns = useMemo(() => columns.filter((c) => !c.hidden), [columns])

  const sortedRows = useMemo(() => {
    if (!sort) return rows
    const column = columns.find((c) => c.key === sort.key)
    if (!column?.sortValue) return rows
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = column.sortValue!(a)
      const bv = column.sortValue!(b)
      if (typeof av === 'number' && typeof bv === 'number')
        return sort.dir === 'asc' ? av - bv : bv - av
      return sort.dir === 'asc'
        ? String(av).localeCompare(String(bv), 'zh-CN')
        : String(bv).localeCompare(String(av), 'zh-CN')
    })
    return copy
  }, [rows, sort, columns])

  /**
   * 全选判定
   *
   * 旧写法用 `Array.includes` 在「已选中的 id 数组」里逐个查找，
   * 复杂度 O(行数 × 选中数)；翻页/排序时 100 行的表格要跑上万次比较。
   * 这里把选中项转成 Set，判定降为 O(行数 + 选中数)。
   *
   * 没有额外 memo：`getRowId` 通常是内联箭头函数（每次渲染都是新引用），
   * 以它为依赖的 useMemo 反而每次都会失效，不如让这段 O(n) 的循环直接跑。
   */
  const allIds = sortedRows.map(getRowId)
  const selectedSet = useMemo(() => new Set(internalSelected), [internalSelected])
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedSet.has(id))
  const someSelected = internalSelected.length > 0 && !allSelected

  // 固定列：只在存在 pinned 列时计算，未固定时零开销
  const hasPinned = visibleColumns.some((column) => pinnedSide(column))
  const sticky = useMemo(
    () => (hasPinned ? computeSticky(visibleColumns, Boolean(selectable)) : null),
    [hasPinned, visibleColumns, selectable],
  )
  const lastLeftKey = useMemo(() => {
    const lefts = visibleColumns.filter((column) => pinnedSide(column) === 'left')
    return lefts[lefts.length - 1]?.key
  }, [visibleColumns])
  const firstRightKey = useMemo(() => {
    const rights = visibleColumns.filter((column) => pinnedSide(column) === 'right')
    return rights[0]?.key
  }, [visibleColumns])

  /** 单元格的 sticky 附加类名 */
  const pinnedClass = (key: string, head = false) => {
    const entry = sticky?.get(key)
    if (!entry) return ''
    const isEdge =
      (entry.side === 'left' && key === lastLeftKey) ||
      (entry.side === 'right' && key === firstRightKey)
    return stickyCellClass(entry.side, isEdge, head)
  }

  /**
   * 表格最小宽度
   *
   * `table-layout: auto` 下，浏览器会在容器变窄时压缩单元格，
   * 于是表格永远撑满容器、永不横向滚动 —— 固定列也就永远用不上。
   * 这里按列宽之和给出 min-width，让「列宽超出容器」时真正出现横向滚动。
   */
  const minTableWidth = useMemo(() => {
    if (!hasPinned) return undefined
    let total = selectable ? 40 : 0
    for (const column of visibleColumns) total += toPx(column.width)
    return total > 0 ? sx(total) : undefined
  }, [hasPinned, visibleColumns, selectable])
  return (
    <SelectionContext.Provider
      value={{
        selected: internalSelected,
        toggle: (id) =>
          setInternalSelected((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
          ),
        toggleAll: (ids, next) =>
          setInternalSelected(next ? Array.from(new Set([...internalSelected, ...ids])) : []),
      }}
    >
      <div
        className={cn('w-full', maxHeight ? 'overflow-auto' : 'overflow-x-auto', className)}
        style={maxHeight ? { maxHeight: sx(maxHeight) } : undefined}
      >
        <table
          className="n-table w-full"
          data-striped={striped || undefined}
          data-hover={hoverable || undefined}
          data-density={density}
          style={minTableWidth ? { minWidth: minTableWidth } : undefined}
        >
          <thead className={cn(maxHeight && 'sticky top-0 z-10')}>
            <tr>
              {selectable && (
                <th
                  className={cn(
                    'h-10 w-10 border-b border-line pr-0 pl-3 text-left',
                    // 有左固定列时，选择列必须一起固定，否则会与数据列错位
                    lastLeftKey === undefined &&
                      visibleColumns.some((c) => pinnedSide(c) === 'left') &&
                      cn('n-sticky-head', 'border-r'),
                  )}
                  style={
                    visibleColumns.some((c) => pinnedSide(c) === 'left')
                      ? { position: 'sticky', left: 0, zIndex: 2 }
                      : undefined
                  }
                >
                  <input
                    type="checkbox"
                    aria-label="全选"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected
                    }}
                    onChange={(e) => {
                      const ctx = { ids: allIds, next: e.target.checked }
                      if (ctx.next) setInternalSelected(allIds)
                      else setInternalSelected([])
                    }}
                    className="size-3.5 cursor-pointer accent-primary"
                  />
                </th>
              )}
              {visibleColumns.map((column) => (
                <Th
                  key={column.key}
                  width={column.width}
                  align={column.align}
                  sort={sort?.key === column.key ? sort.dir : null}
                  style={sticky?.get(column.key)?.style}
                  className={pinnedClass(column.key, true)}
                  onSort={
                    column.sortValue
                      ? () =>
                          setSort((prev) =>
                            prev?.key === column.key
                              ? prev.dir === 'asc'
                                ? { key: column.key, dir: 'desc' }
                                : null
                              : { key: column.key, dir: 'asc' },
                          )
                      : undefined
                  }
                >
                  {column.header}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-subtle">
            {loading
              ? Array.from({ length: minRows }).map((_, r) => (
                  <tr key={`skeleton-${r}`}>
                    {selectable && (
                      <td className="pl-3" style={{ height: 'var(--n-row-h)' }}>
                        <div className="n-skeleton size-3.5 rounded-[0.1875rem]" />
                      </td>
                    )}
                    {visibleColumns.map((column, c) => (
                      <td
                        key={column.key}
                        style={{ ...sticky?.get(column.key)?.style, height: 'var(--n-row-h)' }}
                        className={cn('px-3', pinnedClass(column.key))}
                      >
                        <div
                          className="n-skeleton h-3 rounded-sm"
                          style={{ width: `${45 + ((r * 7 + c * 13) % 45)}%` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : sortedRows.map((row, index) => {
                  const id = getRowId(row)
                  const selected = selectedSet.has(id)
                  return (
                    <tr
                      key={id}
                      data-selected={selected || undefined}
                      onClick={() => onRowClick?.(row)}
                      className={cn(
                        'transition-colors',
                        onRowClick && 'cursor-pointer',
                        rowClassName?.(row),
                      )}
                    >
                      {selectable && (
                        <td
                          className={cn(
                            'pr-0 pl-3',
                            visibleColumns.some((c) => pinnedSide(c) === 'left') &&
                              cn('n-sticky-cell', 'border-r'),
                          )}
                          style={{
                            ...(visibleColumns.some((c) => pinnedSide(c) === 'left')
                              ? { position: 'sticky' as const, left: 0, zIndex: 2 }
                              : {}),
                            height: 'var(--n-row-h)',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            aria-label={`选择第 ${index + 1} 行`}
                            checked={selected}
                            onChange={() => {
                              const ctx = internalSelected.includes(id)
                                ? internalSelected.filter((x) => x !== id)
                                : [...internalSelected, id]
                              setInternalSelected(ctx)
                            }}
                            className="size-3.5 cursor-pointer accent-primary"
                          />
                        </td>
                      )}
                      {visibleColumns.map((column) => (
                        <td
                          key={column.key}
                          style={{
                            ...sticky?.get(column.key)?.style,
                            height: 'var(--n-row-h)',
                          }}
                          className={cn(
                            'px-3 align-middle',
                            column.align === 'center' && 'text-center',
                            column.align === 'right' && 'n-num',
                            column.className,
                            pinnedClass(column.key),
                          )}
                        >
                          {column.cell(row, index)}
                        </td>
                      ))}
                    </tr>
                  )
                })}
            {!loading && sortedRows.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length + (selectable ? 1 : 0)}>
                  {empty ?? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="mb-2 grid size-10 place-items-center rounded-full bg-surface-2 text-fg-4">
                        <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
                          <rect
                            x="4"
                            y="5"
                            width="16"
                            height="14"
                            rx="2"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          />
                          <path d="M4 10h16M9.5 10v9" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      </div>
                      <p className="text-xs text-fg-3">暂无数据</p>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SelectionContext.Provider>
  )
}

/** 表格工具栏：搜索结果数、批量操作、列设置入口 */
export function TableToolbar({
  title,
  description,
  left,
  right,
  selectedCount,
  onClearSelection,
  batchActions,
  className,
}: {
  title?: ReactNode
  description?: ReactNode
  left?: ReactNode
  right?: ReactNode
  selectedCount?: number
  onClearSelection?: () => void
  batchActions?: ReactNode
  className?: string
}) {
  const ctx = useContext(SelectionContext)
  const count = selectedCount ?? ctx?.selected.length ?? 0

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {count > 0 ? (
        <div className="flex w-full flex-wrap items-center gap-2 rounded-md border border-primary/25 bg-primary-weak px-2.5 py-1.5">
          <span className="text-xs text-primary">
            已选择 <span className="font-semibold tabular-nums">{count}</span> 项
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {batchActions}
            <button
              type="button"
              onClick={() => {
                ctx?.toggleAll([], false)
                onClearSelection?.()
              }}
              className="text-xs text-fg-3 hover:text-fg"
            >
              取消选择
            </button>
          </div>
        </div>
      ) : (
        <>
          {title && (
            <div className="min-w-0">
              <h3 className="text-[0.8125rem] font-semibold text-fg">{title}</h3>
              {description && <p className="text-xs text-fg-3">{description}</p>}
            </div>
          )}
          {left}
          <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div>
        </>
      )}
    </div>
  )
}

export interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onChange: (page: number, pageSize: number) => void
  pageSizeOptions?: number[]
  /** 简洁模式：仅显示上一页/下一页 */
  simple?: boolean
  className?: string
}

/** 分页器 */
export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  pageSizeOptions = [10, 20, 50, 100],
  simple,
  className,
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const pages = useMemo(() => {
    const list: Array<number | 'ellipsis'> = []
    const windowSize = 2
    for (let i = 1; i <= pageCount; i += 1) {
      if (i === 1 || i === pageCount || (i >= page - windowSize && i <= page + windowSize)) {
        list.push(i)
      } else if (list[list.length - 1] !== 'ellipsis') {
        list.push('ellipsis')
      }
    }
    return list
  }, [page, pageCount])

  const btn =
    'inline-flex h-7 min-w-7 items-center justify-center rounded-sm px-1.5 text-xs tabular-nums transition-colors'

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <p className="text-xs text-fg-3 tabular-nums">
        共 <span className="font-medium text-fg-2">{total}</span> 条
        {total > 0 && (
          <>
            ，当前 {from}-{to}
          </>
        )}
      </p>
      <div className="ml-auto flex items-center gap-1">
        {!simple && (
          <>
            <button
              type="button"
              aria-label="上一页"
              disabled={page <= 1}
              onClick={() => onChange(page - 1, pageSize)}
              className={cn(
                btn,
                'text-fg-2 hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40',
              )}
            >
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" aria-hidden="true">
                <path
                  d="m14 6-6 6 6 6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {pages.map((p, index) =>
              p === 'ellipsis' ? (
                <span key={`e-${index}`} className="px-1 text-xs text-fg-4">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  aria-current={p === page ? 'page' : undefined}
                  onClick={() => onChange(p, pageSize)}
                  className={cn(
                    btn,
                    p === page ? 'bg-primary text-primary-fg' : 'text-fg-2 hover:bg-surface-2',
                  )}
                >
                  {p}
                </button>
              ),
            )}
            <button
              type="button"
              aria-label="下一页"
              disabled={page >= pageCount}
              onClick={() => onChange(page + 1, pageSize)}
              className={cn(
                btn,
                'text-fg-2 hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40',
              )}
            >
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" aria-hidden="true">
                <path
                  d="m10 6 6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </>
        )}
        <select
          value={pageSize}
          onChange={(e) => onChange(1, Number(e.target.value))}
          aria-label="每页条数"
          className="ml-1 h-7 rounded-sm border border-line bg-surface px-1 text-xs text-fg-2 outline-none"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size} 条/页
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
