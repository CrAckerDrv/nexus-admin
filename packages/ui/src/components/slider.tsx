import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { cn, clamp } from '../lib/utils'

export interface SliderProps {
  value?: number
  defaultValue?: number
  onChange?: (value: number) => void
  onChangeEnd?: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  showValue?: boolean
  /** 刻度点 */
  marks?: number[]
  formatValue?: (value: number) => string
  className?: string
  ariaLabel?: string
}

/** 滑块 */
export function Slider({
  value,
  defaultValue = 0,
  onChange,
  onChangeEnd,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  showValue,
  marks = [],
  formatValue = (v) => String(v),
  className,
  ariaLabel,
}: SliderProps) {
  const [internal, setInternal] = useState(defaultValue)
  const current = clamp(value ?? internal, min, max)
  const percent = max === min ? 0 : ((current - min) / (max - min)) * 100
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const id = useId()

  const resolve = useCallback(
    (clientX: number) => {
      const el = trackRef.current
      if (!el) return current
      const rect = el.getBoundingClientRect()
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
      const raw = min + ratio * (max - min)
      const snapped = Math.round(raw / step) * step
      return clamp(Number(snapped.toFixed(10)), min, max)
    },
    [current, max, min, step],
  )

  const update = useCallback(
    (next: number, final = false) => {
      if (value === undefined) setInternal(next)
      onChange?.(next)
      if (final) onChangeEnd?.(next)
    },
    [onChange, onChangeEnd, value],
  )

  useEffect(() => {
    if (disabled) return
    const onMove = (event: PointerEvent) => {
      if (!draggingRef.current) return
      update(resolve(event.clientX))
    }
    const onUp = (event: PointerEvent) => {
      if (!draggingRef.current) return
      draggingRef.current = false
      update(resolve(event.clientX), true)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [disabled, resolve, update])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    let next: number | null = null
    const bigStep = step * 10
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp')
      next = clamp(current + step, min, max)
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown')
      next = clamp(current - step, min, max)
    if (event.key === 'PageUp') next = clamp(current + bigStep, min, max)
    if (event.key === 'PageDown') next = clamp(current - bigStep, min, max)
    if (event.key === 'Home') next = min
    if (event.key === 'End') next = max
    if (next !== null) {
      event.preventDefault()
      update(next, true)
    }
  }

  return (
    <div className={cn('w-full', disabled && 'opacity-50', className)}>
      <div
        ref={trackRef}
        role="slider"
        id={id}
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={current}
        aria-valuetext={formatValue(current)}
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          if (disabled) return
          draggingRef.current = true
          update(resolve(event.clientX))
        }}
        className="group relative flex h-4 cursor-pointer items-center"
      >
        <div className="h-1.5 w-full rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-75"
            style={{ width: `${percent}%` }}
          />
        </div>
        {marks.map((mark) => (
          <span
            key={mark}
            className="absolute top-1/2 size-1 -translate-y-1/2 rounded-full bg-line-strong"
            style={{ left: `${((mark - min) / (max - min)) * 100}%` }}
          />
        ))}
        <span
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-surface shadow-sm transition-transform group-hover:scale-110"
          style={{ left: `${percent}%` }}
        />
      </div>
      {showValue && (
        <div className="mt-1 flex justify-between text-2xs text-fg-3 tabular-nums">
          <span>{formatValue(min)}</span>
          <span className="font-medium text-fg">{formatValue(current)}</span>
          <span>{formatValue(max)}</span>
        </div>
      )}
    </div>
  )
}

export interface SegmentedControlProps<T extends string> {
  options: Array<{ label: React.ReactNode; value: T; icon?: React.ReactNode }>
  value?: T
  defaultValue?: T
  onChange?: (value: T) => void
  size?: 'sm' | 'md'
  className?: string
  block?: boolean
}

/** 分段控制器（等价于 Tabs 的紧凑形态） */
export function SegmentedControl<T extends string>({
  options,
  value,
  defaultValue,
  onChange,
  size = 'md',
  className,
  block,
}: SegmentedControlProps<T>) {
  const fallback = (defaultValue ?? options[0]?.value) as T
  const [internal, setInternal] = useState<T>(fallback)
  const current = value ?? internal

  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md bg-surface-3 p-0.5',
        block && 'flex w-full',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === current
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => {
              if (value === undefined) setInternal(opt.value)
              onChange?.(opt.value)
            }}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1 rounded-[calc(var(--n-radius)-0.125rem)] font-medium whitespace-nowrap transition-all duration-150',
              size === 'sm' ? 'h-6 px-2 text-2xs' : 'h-7 px-2.5 text-xs',
              active ? 'bg-surface text-fg shadow-xs' : 'text-fg-3 hover:text-fg-2',
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
