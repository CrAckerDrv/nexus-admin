import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useUiStore, type LocaleKey } from '@/core/ui-store'
import { zh, type ZhDict } from './locales/zh'

/**
 * 轻量 i18n
 *
 * 为什么不用 i18next：
 * - 依赖 40KB+，而模板只需要「词典 + 插值 + 复数」三件事
 * - 类型安全靠 TypeScript 即可（en 的词条定义 zh 的类型）
 *
 * 设计：
 * - 词典是扁平对象，key 用 `域.语义` 结构，便于 IDE 提示
 * - `t('users.count', { n: 268 })` 支持 `{n}` 占位符
 * - 切换语言写进 ui-store 并持久化，无需 Provider
 *
 * 英文词典按需加载
 * ----------------
 * 两份词典各 ~25 kB raw（gzip 后 9.4 + 8.1 kB），过去都静态进包 ——
 * 中文用户永远用不到 `en.ts`。现在 `zh` 静态、`en` 用 `import()`：
 * - 默认（中文）不多发一个请求
 * - 英文用户：首屏先用中文兜底一帧，词典到达后自动重渲染（通常 < 100ms）
 * - 类型层面仍是同一份 `ZhDict`，`en.ts` 漏译会在编译期报错（这个能力没丢）
 *
 * 为什么需要一个「版本号 + 订阅」而不是纯变量：
 * `useI18n` 是同步 hook，词典异步到达时必须触发一次重渲染，
 * 否则英文用户会一直停在中文兜底文案上。
 */

export const LOCALES = {
  'zh-CN': { label: '简体中文', short: '中文' },
  'en-US': { label: 'English', short: 'EN' },
} as const

/**
 * 运行期词典形状
 *
 * zh.ts 用 `as const` 保留字面量类型（供 IDE 提示与漏译检查），
 * 但运行期字典需要允许任意 string 值，否则 en 无法赋值。
 */
export type Dict = Record<keyof ZhDict, string>
export type DictKey = keyof Dict

/* ------------------------------------------------------------------ *
 * 词典装载（zh 静态 / en 异步）
 * ------------------------------------------------------------------ */

let enDict: Dict | null = null
let dictVersion = 0
const dictListeners = new Set<() => void>()
let enLoading: Promise<void> | null = null

function notifyDict() {
  dictVersion += 1
  dictListeners.forEach((listener) => listener())
}

function subscribeDict(listener: () => void): () => void {
  dictListeners.add(listener)
  return () => dictListeners.delete(listener)
}

/** 预取英文词典（切换语言前可以先调，避免切换时闪一帧中文） */
export function preloadLocale(locale: LocaleKey): void {
  if (locale !== 'en-US' || enDict || enLoading) return
  enLoading = import('./locales/en').then((mod) => {
    enDict = mod.en
    notifyDict()
  })
  void enLoading.catch(() => {
    // 加载失败就保持中文兜底，不阻塞任何交互
    enLoading = null
  })
}

/** 取当前词典（英文未就绪时回退中文，并触发加载） */
export function getDict(locale: LocaleKey): Dict {
  if (locale === 'en-US') {
    if (enDict) return enDict
    preloadLocale('en-US')
    return zh
  }
  return zh
}

/* ------------------------------------------------------------------ *
 * Hook
 * ------------------------------------------------------------------ */

export interface I18n {
  locale: LocaleKey
  setLocale: (locale: LocaleKey) => void
  /**
   * 翻译
   *
   * `key` 允许为 `undefined`：调用点常写成 `t(MAP[x] ?? 'fallback')`，
   * 映射表可能查不到，此时直接返回空串比抛错更符合「缺省文案」的语义。
   */
  t: (key: DictKey | undefined, vars?: Record<string, string | number>) => string
  /** 中英切换 */
  toggle: () => void
  isEn: boolean
}

export function useI18n(): I18n {
  const locale = useUiStore((state) => state.locale)
  const setLocale = useUiStore((state) => state.setLocale)
  /**
   * 订阅词典版本：`en.ts` 异步到达后版本号 +1，
   * 所有用到 `t()` 的组件在这里重渲染一次，拿到的是同一份快照。
   */
  useSyncExternalStore(
    subscribeDict,
    () => dictVersion,
    () => dictVersion,
  )
  const dict = getDict(locale)

  const t = useCallback(
    (key: DictKey | undefined, vars?: Record<string, string | number>) => {
      if (!key) return ''
      const raw = (dict[key] ?? zh[key] ?? String(key)) as string
      if (!vars) return raw
      return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in vars ? String(vars[name]) : match,
      )
    },
    [dict],
  )

  return useMemo(
    () => ({
      locale,
      setLocale: (next: LocaleKey) => {
        // 切到英文前先把词典取回来，切换瞬间就已经是英文（不闪中文）
        preloadLocale(next)
        setLocale(next)
      },
      t,
      toggle: () => {
        const next: LocaleKey = locale === 'zh-CN' ? 'en-US' : 'zh-CN'
        preloadLocale(next)
        setLocale(next)
      },
      isEn: locale === 'en-US',
    }),
    [locale, setLocale, t],
  )
}

/** 不依赖 hook 的翻译（图表 option、toast 等场景） */
export function translate(locale: LocaleKey, key: DictKey, vars?: Record<string, string | number>) {
  const raw = (getDict(locale)[key] ?? zh[key] ?? String(key)) as string
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}

/**
 * 非 React 模块里按「当前语言」翻译（传输层、store、工具函数）
 *
 * 这些地方拿不到 hook，但错误提示会出现在 toast / 表单里，
 * 直接写中文会让英文模式下穿帮。读一次 store 快照即可，无需订阅。
 */
export function tStatic(key: DictKey, vars?: Record<string, string | number>) {
  return translate(useUiStore.getState().locale, key, vars)
}

/**
 * 启动时若上一次的语言是英文，立刻预取词典
 *
 * 由 `main.tsx` 在渲染前调用一次：`<html lang>` 已经由内联脚本写好，
 * 这里只需要把词典跟上，避免英文用户看到第一帧中文。
 */
export function bootLocale(locale: LocaleKey): void {
  preloadLocale(locale)
}

/**
 * 订阅语言变化，提前取词典
 *
 * 设置页与主题面板是**直接调 store 的 `setLocale`**（不走 `useI18n`），
 * 所以只靠 hook 里的预取，从那些入口切语言会先闪一帧中文。
 * 这个模块级订阅把「任何来源的语言变化」都接住 ——
 * 模块本身已经 import 了 ui-store，不会引入新的循环依赖。
 */
useUiStore.subscribe((state, prev) => {
  if (state.locale !== prev.locale) preloadLocale(state.locale)
})
