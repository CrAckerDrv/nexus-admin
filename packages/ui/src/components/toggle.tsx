import { useId, type ReactNode } from 'react'
import { cn } from '../lib/utils'
import { useControllableState } from '../lib/hooks'
import { useFieldContext } from './input'

export interface SwitchProps {
  checked?: boolean
  defaultChecked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md'
  label?: ReactNode
  description?: ReactNode
  className?: string
  id?: string
}

/** 开关 */
export function Switch({
  checked,
  defaultChecked = false,
  onChange,
  disabled,
  size = 'md',
  label,
  description,
  className,
  id,
}: SwitchProps) {
  const reactId = useId()
  const switchId = id ?? reactId
  const [value, setValue] = useControllableState({
    value: checked,
    defaultValue: defaultChecked,
    onChange,
  })

  const control = (
    <button
      id={switchId}
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => setValue(!value)}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-colors duration-200',
        size === 'sm' ? 'h-4 w-7' : 'h-5 w-9',
        value ? 'bg-primary' : 'bg-surface-3 dark:bg-surface-3',
        !value && 'border-line',
        disabled && 'cursor-not-allowed opacity-50',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block rounded-full bg-white shadow-sm transition-transform duration-200',
          size === 'sm' ? 'size-3' : 'size-4',
          size === 'sm'
            ? value
              ? 'translate-x-[0.8125rem]'
              : 'translate-x-[1px]'
            : value
              ? 'translate-x-[1.125rem]'
              : 'translate-x-[0.125rem]',
        )}
      />
    </button>
  )

  if (!label && !description) return <span className={className}>{control}</span>

  return (
    <label
      htmlFor={switchId}
      className={cn(
        'flex cursor-pointer items-center gap-2.5',
        disabled && 'cursor-not-allowed',
        className,
      )}
    >
      {control}
      <span className="min-w-0">
        {label && <span className="block text-[0.8125rem] leading-5 text-fg">{label}</span>}
        {description && <span className="block text-2xs text-fg-3">{description}</span>}
      </span>
    </label>
  )
}

export interface CheckboxProps {
  checked?: boolean
  indeterminate?: boolean
  defaultChecked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  label?: ReactNode
  description?: ReactNode
  className?: string
  id?: string
}

/** 复选框（支持半选态） */
export function Checkbox({
  checked,
  indeterminate,
  defaultChecked = false,
  onChange,
  disabled,
  label,
  description,
  className,
  id,
}: CheckboxProps) {
  const reactId = useId()
  const boxId = id ?? reactId
  const [value, setValue] = useControllableState({
    value: checked,
    defaultValue: defaultChecked,
    onChange,
  })
  const isOn = indeterminate ? false : value

  const control = (
    <button
      id={boxId}
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : value}
      disabled={disabled}
      onClick={() => setValue(!value)}
      className={cn(
        'grid size-[0.9375rem] shrink-0 place-items-center rounded-[0.1875rem] border transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60',
        isOn || indeterminate
          ? 'border-primary bg-primary text-primary-fg'
          : 'border-line-strong bg-surface hover:border-primary',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {indeterminate ? (
        <svg viewBox="0 0 24 24" className="size-2.5" fill="none" aria-hidden="true">
          <path d="M5 12h14" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
        </svg>
      ) : (
        isOn && (
          <svg viewBox="0 0 24 24" className="size-2.5" fill="none" aria-hidden="true">
            <path
              d="m5 12.5 4.5 4.5L19 7"
              stroke="currentColor"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )
      )}
    </button>
  )

  if (!label && !description) return <span className={className}>{control}</span>

  return (
    <label
      htmlFor={boxId}
      className={cn(
        'flex cursor-pointer items-start gap-2',
        disabled && 'cursor-not-allowed',
        className,
      )}
    >
      <span className="pt-0.5">{control}</span>
      <span className="min-w-0">
        {label && <span className="block text-[0.8125rem] leading-5 text-fg">{label}</span>}
        {description && <span className="block text-2xs leading-4 text-fg-3">{description}</span>}
      </span>
    </label>
  )
}

export interface RadioGroupProps<T extends string> {
  options: Array<{ label: ReactNode; value: T; description?: string; disabled?: boolean }>
  value?: T
  defaultValue?: T
  onChange?: (value: T) => void
  name?: string
  className?: string
  direction?: 'horizontal' | 'vertical'
  /** 卡片式单选 */
  card?: boolean
}

/** 单选组 */
export function RadioGroup<T extends string>({
  options,
  value,
  defaultValue,
  onChange,
  name,
  className,
  direction = 'vertical',
  card,
}: RadioGroupProps<T>) {
  const fallback = (defaultValue ?? options[0]?.value) as T
  const [current, setCurrent] = useControllableState<T>({
    value,
    defaultValue: fallback,
    onChange,
  })
  const groupName = useId()
  const finalName = name ?? groupName
  const field = useFieldContext()

  return (
    <div
      role="radiogroup"
      aria-labelledby={field?.labelledBy}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      className={cn(
        'flex gap-2',
        direction === 'horizontal' ? 'flex-row flex-wrap items-center' : 'flex-col',
        className,
      )}
    >
      {options.map((opt) => {
        const selected = opt.value === current
        return (
          <label
            key={opt.value}
            className={cn(
              'group flex cursor-pointer items-start gap-2',
              card &&
                'rounded-md border p-2.5 transition-colors ' +
                  (selected
                    ? 'border-primary bg-primary-weak/50'
                    : 'border-line hover:border-line-strong'),
              opt.disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            <input
              type="radio"
              name={finalName}
              value={opt.value}
              checked={selected}
              disabled={opt.disabled}
              onChange={() => setCurrent(opt.value)}
              className="peer sr-only"
            />
            <span
              className={cn(
                'mt-0.5 grid size-[0.9375rem] shrink-0 place-items-center rounded-full border transition-colors',
                selected ? 'border-primary' : 'border-line-strong group-hover:border-primary',
                'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary/60',
              )}
            >
              {selected && <span className="size-[0.4375rem] rounded-full bg-primary" />}
            </span>
            <span className="min-w-0">
              <span
                className={cn('block text-[0.8125rem] leading-5', selected ? 'text-fg' : 'text-fg-2')}
              >
                {opt.label}
              </span>
              {opt.description && (
                <span className="block text-2xs leading-4 text-fg-3">{opt.description}</span>
              )}
            </span>
          </label>
        )
      })}
    </div>
  )
}
