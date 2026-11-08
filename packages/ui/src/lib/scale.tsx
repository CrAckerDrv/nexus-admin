import { createContext, useContext, useMemo, type ReactNode } from 'react'

/**
 * 设计像素 ↔ rem
 *
 * 全站尺寸都建立在一个「设计基准」上：**1440px 视口、根字号 16px**。
 * 根字号恒为 16px（见 tokens.css），所以 `1rem = 16px` 是稳定关系 ——
 * `sx()` 的作用只是把组件以数字传入的设计像素统一写成 rem，
 * 让「数字尺寸」和 Tailwind 的间距/字号走同一套单位，方便日后调节。
 *
 * 为什么不再有 `useDesignScale()`
 * --------------------------------
 * 早期版本让根字号随视口等比放大（1.1111vw），并用 `useDesignScale()` 在 JS 里
 * 把设计像素乘回真实倍率。那套方案已废弃，原因是：
 *
 * 1. **媒体查询里的 rem 恒按 16px 折算**，与根字号无关。所以放大 1.98 倍时，
 *    Tailwind 断点并没有跟着移动 —— 2850px 屏上的栅格仍停在 1280px 档的 4 列，
 *    屏幕多出一倍空间却不再加列，只能把卡片吹大。
 * 2. 面板/画布/图表里写死的 px 不会跟着长，放大后「字变大、图标没变」，越看越失衡。
 *
 * 现在的自适应路线与主流后台（Ant Design Pro / shadcn / GitHub / Linear）一致：
 * 字号固定，靠断点、内容区最大宽度、容器查询去适配宽屏。
 *
 * @example
 * <div style={{ height: sx(340) }} />        // 340px
 */

/** 设计基准根字号 */
export const DESIGN_ROOT_FONT = 16

/** 设计像素 → rem 字符串 */
export function sx(designPx: number): string {
  return `${Number((designPx / DESIGN_ROOT_FONT).toFixed(4))}rem`
}

/** 数字或字符串尺寸归一：数字按设计像素转 rem，字符串（含 % 与 rem）原样返回 */
export function sxSize(size: number | string | undefined): string | undefined {
  if (size === undefined) return undefined
  return typeof size === 'number' ? sx(size) : size
}

/**
 * 是否处于「外框」（侧栏 / 顶栏 / 页签栏）
 *
 * 保留这个上下文是为了让浮层代码表达清楚意图：
 * 从外框弹出的提示 / 下拉与内容同尺度，无需任何补偿。
 */
const ChromeContext = createContext(false)

export function ChromeScope({ children }: { children: ReactNode }) {
  return <ChromeContext.Provider value={true}>{children}</ChromeContext.Provider>
}

export function useInChrome(): boolean {
  return useContext(ChromeContext)
}

/**
 * 浮层定位补偿
 *
 * 现在恒为「无补偿」：`zoom` 已移除，外框与内容同尺度，
 * 浮层直接使用 `getBoundingClientRect()` 量到的坐标即可。
 * 保留返回结构，是为了让 Tooltip / Dropdown 的调用点不必随方案来回改。
 */
export function useChromePortal(): {
  inChrome: boolean
  zoom: string | undefined
  offset: (value: number) => number
} {
  const inChrome = useInChrome()
  return useMemo(
    () => ({ inChrome, zoom: undefined, offset: (value: number) => value }),
    [inChrome],
  )
}
