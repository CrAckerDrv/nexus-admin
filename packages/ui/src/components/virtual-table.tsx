import * as React from 'react'
import { cn } from '../lib/utils'
import { sx, sxSize } from '../lib/scale'
import type { Column, DataTableProps } from './table'

/**
 * VirtualTable · 52 行/帧的高性能表格
 *
 * 为什么自研：后台高频痛点是「1 万行卡死」。这里用一个 60 行的窗口 + 绝对定位
 * 实现（不引入 @tanstack/react-virtual，减少依赖），支持固定列宽 + 行高。
 *
 * @example
 * <VirtualTable rows={logs} rowHeight={40} height={520} columns={columns} getRowId={r => r.id} />
 */

export interface VirtualTableProps<T> extends Omit<DataTableProps<T>, 'maxHeight' | 'minRows'> {
  /** 行高（固定值，虚拟化必需） */
  rowHeight?: number
  /** 可视区高度 */
  height?: number
  /** 额外渲染的缓冲行数 */
  overscan?: number
}

export function VirtualTable<T>({
  columns,
  rows,
  getRowId,
  rowHeight = 40,
  height = 480,
  overscan = 8,
  onRowClick,
  empty,
  className,
  selectable,
  selectedIds,
  onSelectedChange,
}: VirtualTableProps<T>) {
  const [scrollTop, setScrollTop] = React.useState(0)
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const [internalSelected, setInternalSelected] = React.useState<string[]>([])
  const selected = selectedIds ?? internalSelected

  // 虚拟滚动靠 scrollTop / rowHeight 算窗口，必须用「真实像素」。
  // 根字号恒为 16px，设计像素即真实像素（rem 与 px 等价），无需再乘倍率
  const rowPx = rowHeight
  const bodyPx = height

  const visibleColumns = React.useMemo(() => columns.filter((c) => !c.hidden), [columns])
  const total = rows.length
  const startIndex = Math.max(0, Math.floor(scrollTop / rowPx) - overscan)
  const visibleCount = Math.ceil(bodyPx / rowPx) + overscan * 2
  const endIndex = Math.min(total, startIndex + visibleCount)
  const slice = rows.slice(startIndex, endIndex)

  const setSelected = (next: string[]) => {
    if (selectedIds === undefined) setInternalSelected(next)
    onSelectedChange?.(next)
  }

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="overflow-hidden">
        <table className="w-full table-fixed border-collapse text-[0.8125rem]">
          <colgroup>
            {selectable && <col style={{ width: sx(40) }} />}
            {visibleColumns.map((column) => (
              <col key={column.key} style={{ width: sxSize(column.width) }} />
            ))}
          </colgroup>
          <thead className="bg-surface-2 text-xs font-medium text-fg-3">
            <tr>
              {selectable && <th className="h-10 border-b border-line" />}
              {visibleColumns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'h-10 border-b border-line px-3 text-left font-medium whitespace-nowrap',
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      <div
        ref={viewportRef}
        onScroll={handleScroll}
        style={{ height: sx(height) }}
        className="relative overflow-y-auto"
        role="rowgroup"
        aria-rowcount={total}
      >
        {total === 0 ? (
          <div className="grid h-full place-items-center">
            {empty ?? <p className="text-xs text-fg-3">暂无数据</p>}
          </div>
        ) : (
          <div style={{ height: total * rowPx, position: 'relative' }}>
            <table
              className="w-full table-fixed border-collapse text-[0.8125rem]"
              style={{ position: 'absolute', top: startIndex * rowPx, left: 0 }}
            >
              <colgroup>
                {selectable && <col style={{ width: sx(40) }} />}
                {visibleColumns.map((column: Column<T>) => (
                  <col key={column.key} style={{ width: sxSize(column.width) }} />
                ))}
              </colgroup>
              <tbody>
                {slice.map((row, index) => {
                  const id = getRowId(row)
                  const isSelected = selected.includes(id)
                  return (
                    <tr
                      key={id}
                      aria-rowindex={startIndex + index + 1}
                      onClick={() => onRowClick?.(row)}
                      className={cn(
                        'border-b border-line-subtle transition-colors',
                        isSelected ? 'bg-primary-weak/40' : 'hover:bg-surface-2',
                        onRowClick && 'cursor-pointer',
                      )}
                      style={{ height: rowPx }}
                    >
                      {selectable && (
                        <td className="px-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label="选择行"
                            checked={isSelected}
                            onChange={() => {
                              setSelected(
                                isSelected ? selected.filter((x) => x !== id) : [...selected, id],
                              )
                            }}
                            className="size-3.5 cursor-pointer accent-primary"
                          />
                        </td>
                      )}
                      {visibleColumns.map((column) => (
                        <td
                          key={column.key}
                          className={cn(
                            'truncate px-3 text-fg-2',
                            column.align === 'center' && 'text-center',
                            column.align === 'right' && 'text-right',
                            column.className,
                          )}
                        >
                          {column.cell(row, startIndex + index)}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-line-subtle px-3 py-1.5 text-2xs text-fg-4 tabular-nums">
        <span>
          已渲染 {startIndex + 1}-{endIndex} / 共 {total} 行
        </span>
        <span>虚拟滚动 · 行高 {Math.round(rowPx)}px</span>
      </div>
    </div>
  )
}

/**
 * 带筛选的表格组合示例见 apps/admin/src/modules/users。
 * 这里再导出一个「紧凑描述行」，用于表格内主副信息两行展示。
 */
export function CellWithSub({
  primary,
  secondary,
  className,
}: {
  primary: React.ReactNode
  secondary: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="truncate text-[0.8125rem] text-fg">{primary}</div>
      <div className="truncate text-2xs text-fg-3">{secondary}</div>
    </div>
  )
}
