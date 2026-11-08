import { useAppSettingsStore } from './app-settings-store'
import { formatByPref } from './app-settings-store'

/**
 * 列表页的默认分页条数
 *
 * 系统设置里的「默认页码大小」如果只是存一个数字、页面却各自写死 `useState(10)`，
 * 那它就是一个假控件。这里把读取收拢成一次调用：
 * - 初始值取自系统设置（用户改过就按用户来）
 * - 用户在页面上手动切过条数后只影响当前页，不回写全局偏好
 */
export function readDefaultPageSize(fallback = 10): number {
  return Number(useAppSettingsStore.getState().defaultPageSize) || fallback
}

/** 按系统设置里的「数字格式」格式化数字（1,234.56 / 1 234,56） */
export function useNumberFormatter() {
  const format = useAppSettingsStore((state) => state.numberFormat)
  return (value: number, fractionDigits = 2) => formatByPref(value, format, fractionDigits)
}
