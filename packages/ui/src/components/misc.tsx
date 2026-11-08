import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import { cn, copyText } from '../lib/utils'
import { useUILabels } from '../lib/hooks'
import { sx } from '../lib/scale'
import { toast } from './toast'

export interface CopyButtonProps {
  /** 复制内容 */
  value: string
  /** 提示文案 */
  label?: string
  size?: 'xs' | 'sm'
  className?: string
  /** 成功后提示 */
  successMessage?: string
  /** 仅显示图标 */
  iconOnly?: boolean
}

/** 一键复制，成功态自反馈 */
export function CopyButton({
  value,
  label,
  size = 'xs',
  className,
  successMessage,
  iconOnly,
}: CopyButtonProps) {
  const L = useUILabels()
  const copyLabel = label ?? L.copy
  const okMessage = successMessage ?? L.copiedToClipboard
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const onCopy = async (event: React.MouseEvent) => {
    event.stopPropagation()
    const ok = await copyText(value)
    if (ok) {
      setCopied(true)
      toast.success(okMessage, { duration: 1800 })
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1600)
    } else {
      toast.error(L.copyFailed)
    }
  }

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? L.copied : copyLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-sm text-fg-3 transition-colors hover:bg-surface-2 hover:text-primary',
        size === 'xs' ? 'h-5 px-1 text-2xs' : 'h-6 px-1.5 text-xs',
        copied && 'text-success hover:text-success',
        className,
      )}
    >
      {copied ? (
        <svg viewBox="0 0 24 24" className="size-3" fill="none" aria-hidden="true">
          <path
            d="m5 12.5 4.5 4.5L19 7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-3" fill="none" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M15 6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      )}
      {!iconOnly && <span>{copied ? L.copied : copyLabel}</span>}
    </button>
  )
}

export interface ClipboardTextProps {
  value: string
  className?: string
  /** 超长截断字符数 */
  truncate?: number
  mono?: boolean
}

/** 可复制文本（ID / 密钥 / 链接） */
export function ClipboardText({
  value,
  className,
  truncate = 40,
  mono = true,
}: ClipboardTextProps) {
  const text = value.length > truncate ? `${value.slice(0, truncate)}…` : value
  return (
    <span className={cn('group inline-flex max-w-full items-center gap-1', className)}>
      <span className={cn('truncate', mono && 'font-mono text-xs')} title={value}>
        {text}
      </span>
      <CopyButton
        value={value}
        iconOnly
        className="opacity-0 transition-opacity group-hover:opacity-100"
      />
    </span>
  )
}

export interface DescriptionsProps {
  items: Array<{ label: string; value: React.ReactNode; span?: number; copyable?: boolean }>
  columns?: 1 | 2 | 3 | 4
  className?: string
  labelWidth?: number
  /** 垂直排列标签 */
  layout?: 'horizontal' | 'vertical'
  size?: 'sm' | 'md'
}

/**
 * 详情描述列表
 *
 * @example
 * <Descriptions columns={3} items={[{label:'实例 ID', value:'i-xxxx', copyable:true}]} />
 */
export function Descriptions({
  items,
  columns = 3,
  className,
  layout = 'horizontal',
  size = 'md',
}: DescriptionsProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  }
  return (
    <dl
      className={cn(
        'grid grid-cols-1 gap-x-6',
        size === 'sm' ? 'gap-y-2.5 text-xs' : 'gap-y-3.5 text-[0.8125rem]',
        gridCols[columns],
        className,
      )}
    >
      {items.map((item, index) => (
        <div
          key={index}
          className={cn(
            'min-w-0',
            item.span === 2 && 'sm:col-span-2',
            item.span === 3 && 'sm:col-span-2 lg:col-span-3',
            layout === 'horizontal' ? 'flex items-baseline gap-2' : 'space-y-1',
          )}
        >
          <dt className={cn('shrink-0 text-fg-3', layout === 'horizontal' && 'min-w-[4.5rem]')}>
            {item.label}
          </dt>
          <dd className="min-w-0 flex-1 break-words text-fg">
            {item.value ?? <span className="text-fg-4">—</span>}
            {item.copyable && typeof item.value === 'string' && (
              <CopyButton value={item.value} iconOnly className="ml-1 align-middle" />
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export interface CodeBlockProps {
  code: string
  language?: string
  filename?: string
  className?: string
  /** 最大高度 */
  maxHeight?: number
  showLineNumbers?: boolean
}

/**
 * 代码块（演示代码用）
 *
 * 说明：内置轻量高亮（HTML/CSS/JS/TS/JSON/Bash 关键字），避免引入 highlight.js 体积
 */
export function CodeBlock({
  code,
  language = 'tsx',
  filename,
  className,
  maxHeight = 360,
  showLineNumbers = true,
}: CodeBlockProps) {
  const lines = code.replace(/\n$/, '').split('\n')
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-md border border-line bg-[#0d1117] dark:bg-[#0a0c10]',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-white/8 px-3 py-1.5">
        <span className="font-mono text-2xs text-white/45">{filename ?? language}</span>
        <CopyButton value={code} className="text-white/50 hover:bg-white/10 hover:text-white" />
      </div>
      <pre
        className="overflow-auto p-3 font-mono text-[0.7188rem] leading-[1.65] text-[#c9d1d9]"
        style={{ maxHeight: sx(maxHeight) }}
      >
        <code>
          {lines.map((line, index) => (
            <span key={index} className="flex">
              {showLineNumbers && (
                <span className="mr-3 inline-block w-6 shrink-0 text-right text-white/20 select-none">
                  {index + 1}
                </span>
              )}
              <span className="whitespace-pre">{highlight(line, language)}</span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}

const TOKEN_REGEX =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`|\b(?:import|from|export|default|const|let|var|function|return|interface|type|extends|implements|async|await|if|else|for|while|new|class|public|private|readonly|as|of|in|void|null|undefined|true|false|this|try|catch|finally|throw|switch|case|break|continue)\b|\b\d+(?:\.\d+)?\b)/g

function highlight(line: string, language: string): React.ReactNode {
  if (language === 'bash' || language === 'sh') {
    const parts = line.split(/(\s-{1,2}[\w-]+|#.*$)/g)
    return parts.map((part, i) =>
      part.startsWith('#') ? (
        <span key={i} className="text-[#8b949e]">
          {part}
        </span>
      ) : part.startsWith(' -') || part.startsWith('\t-') ? (
        <span key={i} className="text-[#79c0ff]">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      ),
    )
  }

  const tokens = line.split(TOKEN_REGEX)
  return tokens.map((token, i) => {
    if (!token) return null
    if (/^(\/\/|\/\*|#)/.test(token)) {
      return (
        <span key={i} className="text-[#8b949e]">
          {token}
        </span>
      )
    }
    if (/^['"`]/.test(token)) {
      return (
        <span key={i} className="text-[#a5d6ff]">
          {token}
        </span>
      )
    }
    if (
      /^(import|from|export|default|const|let|var|function|return|interface|type|extends|implements|async|await|if|else|for|while|new|class|public|private|readonly|as|of|in|void|null|undefined|true|false|this|try|catch|finally|throw|switch|case|break|continue)$/.test(
        token,
      )
    ) {
      return (
        <span key={i} className="text-[#ff7b72]">
          {token}
        </span>
      )
    }
    if (/^\d/.test(token)) {
      return (
        <span key={i} className="text-[#79c0ff]">
          {token}
        </span>
      )
    }
    return <span key={i}>{token}</span>
  })
}

export interface HighlightTextProps {
  text: string
  keyword: string
  className?: string
}

/** 搜索结果关键词高亮 */
export function HighlightText({ text, keyword, className }: HighlightTextProps) {
  if (!keyword.trim()) return <span className={className}>{text}</span>
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.toLowerCase() === keyword.toLowerCase() ? (
          <mark key={index} className="rounded-[0.125rem] bg-warning/25 px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </span>
  )
}

export interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  /** 提交 （回车） */
  onSubmit?: () => void
  autoFocus?: boolean
  size?: 'sm' | 'md'
}

/** 带搜索图标的输入框 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onChange, placeholder, className, onSubmit, autoFocus, size = 'md' },
  ref,
) {
  const L = useUILabels()
  const [focused, setFocused] = useState(false)
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') onSubmit?.()
      if (event.key === 'Escape') onChange('')
    },
    [onChange, onSubmit],
  )
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-md border bg-surface px-2.5 transition-[border-color,box-shadow]',
        focused
          ? 'ring-primary-ring border-primary/70 ring-2'
          : 'border-line hover:border-line-strong',
        size === 'sm' ? 'h-[var(--n-control-h-sm)]' : 'h-[var(--n-control-h)]',
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className={cn('size-3.5 shrink-0', focused ? 'text-primary' : 'text-fg-3')}
        fill="none"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <input
        ref={ref}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder ?? L.search}
        className="h-full w-full min-w-0 flex-1 bg-transparent text-[0.8125rem] text-fg outline-none placeholder:text-fg-4"
      />
      {value && (
        <button
          type="button"
          aria-label={L.clearSearch}
          onClick={() => onChange('')}
          className="shrink-0 rounded-full p-0.5 text-fg-4 hover:bg-surface-2 hover:text-fg-2"
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
  )
})
