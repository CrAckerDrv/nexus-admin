import clsx, { type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** 合并 Tailwind 类名，后者覆盖前者的冲突属性 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** 数字格式化：1234567 => 1,234,567 */
export function formatNumber(value: number, opts: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat('zh-CN', opts).format(value)
}

/** 紧凑数字：1234567 => 123.5万 */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

/** 金额（人民币，分隔符 + 2 位小数） */
export function formatCurrency(value: number, currency = 'CNY'): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/** 百分比 */
export function formatPercent(value: number, fractionDigits = 2): string {
  return `${value.toFixed(fractionDigits)}%`
}

/** 相对时间：3 分钟前 */
export function formatRelativeTime(input: string | number | Date): string {
  const date = new Date(input)
  const diff = Date.now() - date.getTime()
  const abs = Math.abs(diff)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * 24 * 3600 * 1000],
    ['month', 30 * 24 * 3600 * 1000],
    ['day', 24 * 3600 * 1000],
    ['hour', 3600 * 1000],
    ['minute', 60 * 1000],
    ['second', 1000],
  ]
  const rtf = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' })
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === 'second') {
      return rtf.format(Math.round((diff / ms) * -1), unit)
    }
  }
  return rtf.format(0, 'second')
}

/** 日期时间格式化 */
export function formatDateTime(input: string | number | Date, withSeconds = false): string {
  const date = new Date(input)
  const pad = (n: number) => String(n).padStart(2, '0')
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}${
    withSeconds ? `:${pad(date.getSeconds())}` : ''
  }`
  return `${datePart} ${timePart}`
}

/** 字节数格式化 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${units[i]}`
}

/** 复制文本到剪贴板（兼容非安全上下文） */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

/** 生成稳定伪随机 ID */
export function randomId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

/** 防抖 */
export function debounce<T extends (...args: never[]) => void>(fn: T, wait = 300) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
}

/** 限制取值区间 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** 拼音/关键字匹配（简版模糊搜索：子序列匹配） */
export function fuzzyMatch(text: string, keyword: string): boolean {
  if (!keyword) return true
  const source = text.toLowerCase()
  const query = keyword.toLowerCase()
  if (source.includes(query)) return true
  let i = 0
  for (const ch of source) {
    if (ch === query[i]) i += 1
    if (i === query.length) return true
  }
  return false
}

/** 首字母头像色：由名字决定 */
const AVATAR_COLORS = [
  'bg-sky-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-teal-500',
]

export function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] as string
}
