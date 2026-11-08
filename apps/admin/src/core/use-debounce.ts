import { useEffect, useState } from 'react'

/**
 * 防抖 Hook
 *
 * 后台列表页的高频痛点：搜索框每敲一个字符就发一次请求。
 * 演示环境的 Mock 有 50~180ms 假延迟把它掩盖了，换成真实后端就是 QPS 放大。
 *
 * 用法：输入框仍用「即时值」保持打字跟手，把防抖值交给请求层：
 *
 * ```tsx
 * const [keyword, setKeyword] = useState('')
 * const debounced = useDebouncedValue(keyword, 300)
 * const query = useUsers({ keyword: debounced })   // 只有停手 300ms 才请求
 * ```
 *
 * @param value 需要防抖的值
 * @param delayMs 静止多久后才提交（默认 300ms）
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    // 值没变时不重复计时（避免翻页等无关更新重置计时器）
    if (Object.is(value, debounced)) return
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs, debounced])

  return debounced
}
