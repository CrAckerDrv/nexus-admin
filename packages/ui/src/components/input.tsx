import {
  createContext,
  forwardRef,
  useContext,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '../lib/utils'
import { useUILabels } from '../lib/hooks'

export type FieldStatus = 'default' | 'error' | 'success' | 'warning'

/**
 * 字段上下文：FormField 把 id / 描述 / 错误态下发给控件，
 * 控件无需调用方手工接 aria-describedby 就能被屏幕阅读器正确朗读。
 */
interface FieldContextValue {
  id?: string
  describedBy?: string
  invalid?: boolean
  required?: boolean
  /** label 元素的 id：非原生表单元素（Select / RadioGroup 等）用它做 aria-labelledby */
  labelledBy?: string
}

const FieldContext = createContext<FieldContextValue | null>(null)

/** 读取外层 FormField 提供的无障碍属性 */
export function useFieldContext() {
  return useContext(FieldContext)
}

/**
 * 聚焦态：1px 边框（品牌色 70%）+ 2px 极淡外环
 *
 * 早期是 1px 实线 + 3px 外环，叠起来接近 4px，在密集表单里像一圈粗蓝框。
 * 这里把外环压到 2px 并同步降低边框饱和度，焦点依然清晰可辨，但不再抢内容。
 * 键盘可达性由外环承担，内部 input 已禁用浏览器默认 outline（见 tokens.css）。
 */
const STATUS_RING: Record<FieldStatus, string> = {
  default:
    'border-line focus-within:border-primary/70 focus-within:ring-2 focus-within:ring-primary-ring',
  error: 'border-danger focus-within:ring-2 focus-within:ring-danger/20',
  success: 'border-success focus-within:ring-2 focus-within:ring-success/20',
  warning: 'border-warning focus-within:ring-2 focus-within:ring-warning/20',
}

const INPUT_BASE =
  'w-full min-w-0 bg-transparent text-[0.8125rem] text-fg placeholder:text-fg-4 outline-none disabled:cursor-not-allowed disabled:opacity-60'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  size?: 'sm' | 'md' | 'lg'
  status?: FieldStatus
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  /** 右侧附加说明（如单位） */
  addonAfter?: ReactNode
  /** 左侧标签前缀 */
  prefix?: ReactNode
  /** 是否可清除 */
  clearable?: boolean
  onClear?: () => void
}

/**
 * 输入框
 *
 * @example
 * <Input placeholder="请输入名称" leftIcon={<Search size={14} />} />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    size = 'md',
    status,
    leftIcon,
    rightIcon,
    addonAfter,
    prefix,
    clearable,
    onClear,
    className,
    disabled,
    value,
    readOnly,
    id,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    ...props
  },
  ref,
) {
  const field = useFieldContext()
  const L = useUILabels()
  const [focused, setFocused] = useState(false)
  const resolvedStatus = status ?? (field?.invalid ? 'error' : 'default')
  const resolvedId = id ?? field?.id
  const resolvedDescribedBy = ariaDescribedBy ?? field?.describedBy
  const resolvedInvalid = ariaInvalid ?? (field?.invalid || undefined)
  const showClear = clearable && !disabled && !readOnly && value !== undefined && value !== ''

  return (
    <div
      className={cn(
        'group flex w-full items-center gap-1.5 rounded-md border bg-surface px-2.5 transition-[border-color,box-shadow] duration-150',
        /**
         * `--n-field-bg` 只服务「浏览器自动填充」：
         * Chromium 会强行给 input 刷底色（UA 重要声明，作者样式压不住），
         * 而本组件把表面色画在外层、input 本身透明，于是只被涂到 input 自己的盒子上，
         * 形成「内嵌一块、与边框错位」的色块。tokens.css 用 inset 阴影盖掉它，
         * 颜色取这里下发的变量 —— 禁用态换底色时自动跟随，边缘无缝。
         */
        '[--n-field-bg:var(--n-surface)]',
        size === 'sm' && 'h-[var(--n-control-h-sm)]',
        size === 'md' && 'h-[var(--n-control-h)]',
        size === 'lg' && 'h-[var(--n-control-h-lg)] px-3',
        STATUS_RING[resolvedStatus],
        disabled && 'cursor-not-allowed bg-surface-2 opacity-70 [--n-field-bg:var(--n-surface-2)]',
        className,
      )}
      data-focused={focused || undefined}
    >
      {prefix && <span className="shrink-0 text-xs text-fg-3">{prefix}</span>}
      {leftIcon && (
        <span className="shrink-0 text-fg-3 transition-colors group-focus-within:text-primary">
          {leftIcon}
        </span>
      )}
      <input
        ref={ref}
        id={resolvedId}
        aria-describedby={resolvedDescribedBy}
        aria-invalid={resolvedInvalid}
        aria-required={field?.required || undefined}
        value={value}
        readOnly={readOnly}
        disabled={disabled}
        className={cn(INPUT_BASE, 'h-full flex-1 py-0')}
        onFocus={(e) => {
          setFocused(true)
          props.onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          props.onBlur?.(e)
        }}
        {...props}
      />
      {showClear && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={L.clear}
          onClick={() => onClear?.()}
          className="shrink-0 rounded-full p-0.5 text-fg-4 transition-colors hover:bg-surface-3 hover:text-fg-2"
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
      {rightIcon && <span className="shrink-0 text-fg-3">{rightIcon}</span>}
      {addonAfter && (
        <span className="shrink-0 border-l border-line pl-2 text-xs text-fg-3">{addonAfter}</span>
      )}
    </div>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  status?: FieldStatus
  /** 显示字数统计 */
  showCount?: boolean
  maxLength?: number
  autoResize?: boolean
}

/** 多行文本域 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    status,
    showCount,
    maxLength,
    autoResize,
    className,
    value,
    id,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    ...props
  },
  ref,
) {
  const field = useFieldContext()
  const resolvedStatus = status ?? (field?.invalid ? 'error' : 'default')
  const length = typeof value === 'string' ? value.length : 0
  return (
    <div
      className={cn(
        'relative flex flex-col rounded-md border bg-surface transition-[border-color,box-shadow] duration-150 focus-within:ring-2 focus-within:ring-primary-ring',
        resolvedStatus === 'default' ? 'border-line focus-within:border-primary/70' : '',
        resolvedStatus === 'error' && 'border-danger focus-within:ring-danger/20',
        className,
      )}
    >
      <textarea
        ref={ref}
        id={id ?? field?.id}
        aria-describedby={ariaDescribedBy ?? field?.describedBy}
        aria-invalid={ariaInvalid ?? (field?.invalid || undefined)}
        aria-required={field?.required || undefined}
        value={value}
        maxLength={maxLength}
        className={cn(
          INPUT_BASE,
          'min-h-[4.75rem] resize-y px-2.5 py-2 leading-5',
          autoResize && 'field-sizing-content resize-none',
          showCount && 'pb-6',
        )}
        {...props}
      />
      {showCount && (
        <span className="pointer-events-none absolute right-2.5 bottom-1.5 text-2xs text-fg-4 tabular-nums">
          {length}
          {maxLength ? ` / ${maxLength}` : ''}
        </span>
      )}
    </div>
  )
})

export interface FormFieldProps {
  label?: ReactNode
  htmlFor?: string
  required?: boolean
  hint?: ReactNode
  error?: ReactNode
  extra?: ReactNode
  className?: string
  children: ReactNode
  /** 行内布局：label 在左，控件在右 */
  inline?: boolean
}

/**
 * 表单字段包装：标签 / 提示 / 错误
 *
 * 无障碍约定：调用方把同一个 `htmlFor` 同时传给控件 `id`，
 * 并把 `error` / `hint` 的 id 通过 `aria-describedby` 关联到控件。
 * `FieldContext` 让内部的 Input / Textarea / Select 自动接住这些 id。
 */
export function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  extra,
  className,
  children,
  inline,
}: FormFieldProps) {
  const reactId = useId()
  const id = htmlFor ?? reactId
  const labelId = `${id}-label`
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div className={cn(inline ? 'flex items-start gap-3' : 'space-y-1.5', className)}>
      {label && (
        <label
          id={labelId}
          htmlFor={id}
          className={cn(
            'flex shrink-0 items-center gap-1 text-xs font-medium text-fg-2',
            inline ? 'h-[var(--n-control-h)] w-24' : '',
          )}
        >
          {required && (
            <span className="-ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          )}
          {label}
          {extra && <span className="ml-auto text-2xs font-normal text-fg-3">{extra}</span>}
        </label>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <FieldContext.Provider
          value={{
            id,
            labelledBy: label ? labelId : undefined,
            describedBy,
            invalid: Boolean(error),
            required,
          }}
        >
          {children}
        </FieldContext.Provider>
        {error ? (
          <p id={errorId} className="flex items-center gap-1 text-2xs text-danger" role="alert">
            <svg viewBox="0 0 24 24" className="size-3 shrink-0" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 8v4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1" fill="currentColor" />
            </svg>
            {error}
          </p>
        ) : (
          hint && (
            <p id={hintId} className="text-2xs leading-4 text-fg-3">
              {hint}
            </p>
          )
        )}
      </div>
    </div>
  )
}

/** 只读展示字段（详情页） */
export function ReadonlyValue({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('text-[0.8125rem] text-fg', className)}>{children}</div>
}
