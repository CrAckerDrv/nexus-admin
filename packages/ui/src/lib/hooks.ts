import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'

const IS_BROWSER = typeof window !== 'undefined'

/**
 * 关于 `xxxRef.current = 最新回调` 的写法
 *
 * 这些 hook 都是「事件回调免依赖」模式：把最新回调同步写进 ref，
 * 事件监听器只注册一次却总能调用到最新的 handler。
 * React Compiler 的 `react-hooks/refs` 规则会警告「渲染期间写 ref」，
 * 但这是该模式的必要代价（官方文档 useEvent / useEffectEvent 的替代写法）。
 * 已在 eslint 配置中将其降级为 warn，并在此处集中说明。
 */

/** 同构 useLayoutEffect，避免 SSR 警告 */
export const useIsomorphicLayoutEffect = IS_BROWSER ? useLayoutEffect : useEffect

/**
 * 受控/非受控状态合一的 Hook
 * 组件同时支持 `value` 与 `defaultValue`
 */
export function useControllableState<T>(options: {
  value?: T
  defaultValue: T
  onChange?: (value: T) => void
}): [T, (next: T | ((prev: T) => T)) => void] {
  const { value, defaultValue, onChange } = options
  const [internal, setInternal] = useState<T>(defaultValue)
  const isControlled = value !== undefined
  const current = isControlled ? value : internal
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const setValue = (next: T | ((prev: T) => T)) => {
    const resolved =
      typeof next === 'function' ? (next as (prev: T) => T)(current as T) : (next as T)
    if (!isControlled) setInternal(resolved)
    onChangeRef.current?.(resolved)
  }

  return [current as T, setValue]
}

/** 监听媒体查询 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    IS_BROWSER ? window.matchMedia(query).matches : false,
  )

  useEffect(() => {
    if (!IS_BROWSER) return
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** 窗口尺寸断点 */
export function useBreakpoint() {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const isTablet = useMediaQuery('(max-width: 1023px)')
  const isDesktop = useMediaQuery('(min-width: 1280px)')
  return { isMobile, isTablet, isDesktop }
}

/** 点击外部关闭 */
export function useClickOutside<T extends HTMLElement>(
  handler: (event: PointerEvent | Event) => void,
  enabled = true,
) {
  const ref = useRef<T>(null)
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled) return
    const listener = (event: Event) => {
      const el = ref.current
      if (!el || el.contains(event.target as Node)) return
      handlerRef.current(event)
    }
    document.addEventListener('pointerdown', listener, true)
    return () => document.removeEventListener('pointerdown', listener, true)
  }, [enabled])

  return ref
}

/** 尺寸观察 */
export function useResizeObserver<T extends HTMLElement>(
  onResize: (entry: ResizeObserverEntry) => void,
) {
  const ref = useRef<T>(null)
  const callback = useRef(onResize)
  callback.current = onResize

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) callback.current(entry)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return ref
}

/** 元素尺寸 */
export function useElementSize<T extends HTMLElement>() {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const ref = useResizeObserver<T>((entry) => {
    const rect = entry.contentRect
    setSize((prev) =>
      prev.width === rect.width && prev.height === rect.height
        ? prev
        : { width: rect.width, height: rect.height },
    )
  })
  return [ref, size] as const
}

/** 本地存储状态（带 JSON 序列化） */
export function useLocalStorageState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(() => {
    if (!IS_BROWSER) return initialValue
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    if (!IS_BROWSER) return
    try {
      window.localStorage.setItem(key, JSON.stringify(state))
    } catch {
      /* 忽略配额错误 */
    }
  }, [key, state])

  return [state, setState] as const
}

/** 倒计时（毫秒） */
export function useCountdown(durationMs: number) {
  const [remaining, setRemaining] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const start = () => {
    setRemaining(durationMs)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1000) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return prev - 1000
      })
    }, 1000)
  }

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setRemaining(0)
  }

  useEffect(() => () => void (timerRef.current && clearInterval(timerRef.current)), [])

  return { remaining, start, stop }
}

/* ------------------------------------------------------------------ *
 * 动效开关（与 CSS 的 `[data-motion]` 同一套语义）
 *
 * 为什么需要它：CSS 侧早就有三层约定 —— `prefers-reduced-motion` 媒体查询、
 * `<html data-motion="full|reduced">` 显式覆盖，两者优先级是「显式覆盖 > 系统偏好」。
 * 但 JS 驱动的动画（数字滚动、环形进度）过去只读了媒体查询，
 * 于是「主题面板里打开动效」只对 CSS 动画生效，数字仍然瞬间跳到终值 ——
 * 一处开关两种行为。这个 hook 把判定收到唯一一处，JS 与 CSS 才不会漂移：
 *
 *   data-motion="full"    → 开（即使系统要求减少动效）
 *   data-motion="reduced" → 关
 *   无 data-motion        → 跟随 prefers-reduced-motion
 * ------------------------------------------------------------------ */

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function subscribeMotion(listener: () => void): () => void {
  if (!IS_BROWSER) return () => {}
  const media = window.matchMedia(REDUCED_MOTION_QUERY)
  media.addEventListener('change', listener)
  /**
   * 应用内开关写的是 `documentElement.dataset.motion`，
   * 监听属性变化即可，不需要额外的全局 store（组件库不反向依赖应用状态）。
   */
  const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(listener)
  observer?.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-motion'],
  })
  return () => {
    media.removeEventListener('change', listener)
    observer?.disconnect()
  }
}

function readMotionEnabled(): boolean {
  if (!IS_BROWSER) return false
  const override = document.documentElement.dataset.motion
  if (override === 'reduced') return false
  if (override === 'full') return true
  return !window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/**
 * 命令式读取「当前是否允许动效」
 *
 * 给事件回调 / useState 初始化器这类**不能调 hook** 的地方用；
 * 组件体里一律用 `useMotionEnabled()`（会订阅开关变化）。
 * 两者共用同一个判定函数，避免「CSS 关了、JS 还在动」这类漂移。
 */
export function isMotionEnabled(): boolean {
  return readMotionEnabled()
}

/**
 * 当前是否应该播放动效
 *
 * 与 tokens.css 的 `[data-motion]` / `@media (prefers-reduced-motion)` 完全同源。
 * 切换开关会触发重渲染（订阅了 `<html data-motion>` 的属性变化）。
 */
export function useMotionEnabled(): boolean {
  return useSyncExternalStore(subscribeMotion, readMotionEnabled, () => false)
}

/** 键盘快捷键（组合键注册） */
export function useHotkey(
  combo: string,
  handler: (event: KeyboardEvent) => void,
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled || !IS_BROWSER) return
    const parts = combo.toLowerCase().split('+')
    const key = parts.pop() ?? ''
    const needCtrl = parts.includes('ctrl') || parts.includes('mod')
    const needShift = parts.includes('shift')
    const needAlt = parts.includes('alt')

    const listener = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey
      if (needCtrl !== mod) return
      if (needShift !== event.shiftKey) return
      if (needAlt !== event.altKey) return
      if (event.key.toLowerCase() !== key) return
      event.preventDefault()
      handlerRef.current(event)
    }

    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [combo, enabled])
}

/* ------------------------------------------------------------------ *
 * 组件文案（轻量可配置，不必让 UI 库反向依赖应用层的 i18n）
 *
 * 组件内置的中文只是「缺省值」：应用启动时按当前语言调用
 * `configureUILabels({...})` 覆盖一次，之后所有组件通过
 * `useUILabels()` 订阅同一份快照，切换语言即时生效且无需 Provider。
 * ------------------------------------------------------------------ */

export interface UILabels {
  copy: string
  copied: string
  copiedToClipboard: string
  copyFailed: string
  clear: string
  clearSearch: string
  search: string
  searchOptions: string
  selectPlaceholder: string
  selectedCount: (n: number) => string
  empty: string
  confirm: string
  cancel: string
  loading: string
  deltaLabel: string
}

export const DEFAULT_UI_LABELS: UILabels = {
  copy: '复制',
  copied: '已复制',
  copiedToClipboard: '已复制到剪贴板',
  copyFailed: '复制失败，请手动选择文本',
  clear: '清空',
  clearSearch: '清空搜索',
  search: '搜索',
  searchOptions: '搜索…',
  selectPlaceholder: '请选择',
  selectedCount: (n) => `已选 ${n} 项`,
  empty: '暂无数据',
  confirm: '确认',
  cancel: '取消',
  loading: '加载中…',
  deltaLabel: '较上周期',
}

let currentLabels: UILabels = DEFAULT_UI_LABELS
const labelListeners = new Set<() => void>()

/** 覆盖组件文案；传 `DEFAULT_UI_LABELS` 可恢复中文缺省值 */
export function configureUILabels(next: Partial<UILabels>) {
  currentLabels = { ...currentLabels, ...next }
  labelListeners.forEach((listener) => listener())
}

function subscribeUILabels(listener: () => void) {
  labelListeners.add(listener)
  return () => labelListeners.delete(listener)
}

/** 读取当前组件文案（订阅式，语言切换会触发重渲染） */
export function useUILabels(): UILabels {
  return useSyncExternalStore(
    subscribeUILabels,
    () => currentLabels,
    () => currentLabels,
  )
}
