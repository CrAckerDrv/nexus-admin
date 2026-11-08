import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 系统级设置（系统设置页签的持久化状态）
 *
 * 为什么单独一个 store：
 * 这些不是「外观偏好」——它们描述的是**这套后台对业务数据的处理约定**
 * （时区、默认分页、数字格式、通知订阅、安全策略）。混进 ui-store 会让
 * 「恢复默认外观」顺手把安全策略一起重置，这是用户绝对不能接受的行为。
 *
 * 全部落 localStorage：演示环境没有后端，但「改完刷新就没了」的开关等于假控件。
 */
export type TimeZoneKey = 'Asia/Shanghai' | 'Europe/London' | 'America/Los_Angeles'
export type NumberFormat = 'comma' | 'space'
export type SessionTimeout = '2h' | '8h' | '24h' | '7d'

export interface NotifyPrefs {
  business: boolean
  security: boolean
  system: boolean
  weekly: boolean
}

export interface SecurityPolicy {
  forceMfa: boolean
  verifyForeignLogin: boolean
  sso: boolean
  minPasswordLength: number
  rotateDays: number
}

interface AppSettingsState {
  timeZone: TimeZoneKey
  defaultPageSize: number
  numberFormat: NumberFormat
  notify: NotifyPrefs
  security: SecurityPolicy
  sessionTimeout: SessionTimeout
  /** 最近一次保存时间（ISO），首页可以拿它显示「上次保存」 */
  savedAt: string | null

  setTimeZone: (timeZone: TimeZoneKey) => void
  setDefaultPageSize: (size: number) => void
  setNumberFormat: (format: NumberFormat) => void
  setNotify: (key: keyof NotifyPrefs, value: boolean) => void
  setSecurity: <K extends keyof SecurityPolicy>(key: K, value: SecurityPolicy[K]) => void
  setSessionTimeout: (value: SessionTimeout) => void
  reset: () => void
}

const DEFAULTS = {
  timeZone: 'Asia/Shanghai' as TimeZoneKey,
  defaultPageSize: 10,
  numberFormat: 'comma' as NumberFormat,
  notify: { business: true, security: true, system: false, weekly: false },
  security: {
    forceMfa: true,
    verifyForeignLogin: true,
    sso: false,
    minPasswordLength: 12,
    rotateDays: 90,
  },
  sessionTimeout: '8h' as SessionTimeout,
}

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      savedAt: null,

      // 每个 setter 都刷新 savedAt：用户在执行「改一下就想知道有没有存住」的动作，
      // 有一个可见的时间戳比任何「已保存」toast 都可靠
      setTimeZone: (timeZone) => set({ timeZone, savedAt: new Date().toISOString() }),
      setDefaultPageSize: (defaultPageSize) =>
        set({ defaultPageSize, savedAt: new Date().toISOString() }),
      setNumberFormat: (numberFormat) => set({ numberFormat, savedAt: new Date().toISOString() }),
      setNotify: (key, value) =>
        set({ notify: { ...get().notify, [key]: value }, savedAt: new Date().toISOString() }),
      setSecurity: (key, value) =>
        set({
          security: { ...get().security, [key]: value },
          savedAt: new Date().toISOString(),
        }),
      setSessionTimeout: (sessionTimeout) =>
        set({ sessionTimeout, savedAt: new Date().toISOString() }),
      reset: () => set({ ...DEFAULTS, savedAt: new Date().toISOString() }),
    }),
    { name: 'nexus-app-settings', version: 1 },
  ),
)

/** 数字格式化的两种约定：1,234.56 / 1 234,56（空格作千分位、逗号作小数点） */
export function formatByPref(value: number, format: NumberFormat, fractionDigits = 2): string {
  const fixed = value.toFixed(fractionDigits)
  if (format === 'comma') {
    const [int = '', frac] = fixed.split('.')
    return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${frac ? `.${frac}` : ''}`
  }
  const [int = '', frac] = fixed.split('.')
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')}${frac ? `,${frac}` : ''}`
}
