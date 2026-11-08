import type { SVGProps } from 'react'

/** GitHub 品牌图标
 *
 * lucide v1 起移除了品牌图标，这里内联一个 24×24 的官方路径，
 * 避免为一个小图标引入额外依赖。
 */
export function GithubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 1.5a10.5 10.5 0 0 0-3.32 20.46c.53.1.72-.23.72-.5l-.01-1.76c-2.92.63-3.54-1.4-3.54-1.4-.48-1.22-1.17-1.55-1.17-1.55-.95-.65.07-.64.07-.64 1.06.08 1.62 1.09 1.62 1.09.94 1.61 2.46 1.14 3.06.87.1-.68.37-1.14.67-1.4-2.33-.27-4.78-1.17-4.78-5.18 0-1.14.41-2.08 1.08-2.81-.11-.27-.47-1.34.1-2.8 0 0 .88-.28 2.88 1.07a10 10 0 0 1 5.24 0c2-1.35 2.88-1.07 2.88-1.07.57 1.46.21 2.53.1 2.8.67.73 1.08 1.67 1.08 2.81 0 4.02-2.46 4.9-4.8 5.16.38.33.72.97.72 1.96l-.01 2.9c0 .28.19.61.73.5A10.5 10.5 0 0 0 12 1.5Z" />
    </svg>
  )
}

/**
 * 品牌字标 —— 就是图标本身
 *
 * 三笔构成一个 N：两段竖笔 + 一条斜笔（「连接」的隐喻），全部圆头端。
 * 无底版、无渐变，颜色一律跟随 `currentColor`，
 * 因此深色模式、按钮、页签里都只需要改文字颜色。
 *
 * 几何与 brand/nexus-mark.svg 完全一致（24 网格：竖笔 5.5/18.5，端点 4.9/19.1，笔宽 2.7/2.5）。
 * viewBox 取墨迹紧边界，避免默认画布留白把字形缩得过小。
 */
export function NexusMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="4.15 3.55 15.7 16.9"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeLinecap="round"
      {...props}
    >
      <path d="M5.5 19.1 L5.5 4.9" strokeWidth={2.7} />
      <path d="M18.5 19.1 L18.5 4.9" strokeWidth={2.7} />
      <path d="M5.5 4.9 L18.5 19.1" strokeWidth={2.5} />
    </svg>
  )
}
