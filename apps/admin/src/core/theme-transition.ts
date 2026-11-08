/**
 * 主题切换过渡动画（圆形扩散）
 *
 * 参考效果：浅色 ↔ 深色时，新主题以「圆形」从触发按钮位置向外扩散铺满视口。
 *
 * 实现分两条路径，保证任何浏览器都能看到效果：
 *
 * 1. **View Transitions（首选）**
 *    浏览器原生快照旧/新两帧，用 `clip-path: circle()` 让新帧从圆心展开。
 *    优点：扩散的是「真实的新主题内容」，文字、图表一起变化，最接近原生观感。
 *
 * 2. **遮罩回落（兜底）**
 *    不支持 View Transitions、或用户开启「减少动效」时使用：
 *    先在旧主题上盖一层「新主题底色」的圆形遮罩，扩散到约 55% 时切换主题，
 *    再淡出遮罩。视觉上同样是「从圆心铺开」，只是内容在遮罩下变化。
 *
 * 关键细节：状态变更必须在 View Transition 的回调中同步完成（`flushSync`），
 * 否则 React 提交 DOM 的时机晚于快照，会拍到「旧内容 + 新配色」的错帧。
 */
import { flushSync } from 'react-dom'

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => {
    ready: Promise<void>
    updateCallbackDone: Promise<void>
    finished: Promise<void>
    skipTransition: () => void
  }
}

export interface ThemeTransitionOrigin {
  x: number
  y: number
}

/** 动画总时长（毫秒）：偏慢一点更丝滑，接近原生 App 的揭幕感 */
const DURATION = 720
/** 遮罩路径中「切换主题」的时间点（比例） */
const SWITCH_AT = 0.55

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** 从元素中心取圆形扩散的圆心 */
export function originFromElement(element: HTMLElement | null): ThemeTransitionOrigin {
  if (!element) return { x: window.innerWidth / 2, y: 0 }
  const rect = element.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

/** 圆心到最远角的距离，保证圆形能覆盖整个视口 */
function coverageRadius(origin: ThemeTransitionOrigin): number {
  return Math.hypot(
    Math.max(origin.x, window.innerWidth - origin.x),
    Math.max(origin.y, window.innerHeight - origin.y),
  )
}

/** 读取新主题的背景色，用于遮罩回落路径 */
function targetSurfaceColor(applyWillBeDark: boolean): string {
  const styles = getComputedStyle(document.documentElement)
  // 目标主题的底色：深色用 --n-bg（更暗的一档），浅色用 --n-bg
  const lightBg = styles.getPropertyValue('--n-bg').trim() || '#f2f3f5'
  return applyWillBeDark ? '#0a0d13' : lightBg
}

/**
 * 执行带圆形扩散动画的主题切换
 *
 * 说明：主题切换是**用户显式点击**触发的，因此即使系统开启了「减少动效」，
 * 我们仍然播放扩散动画，只把时长压到 200ms —— 这样不会因为系统设置
 * （Windows 的「在 Windows 中显示动画」关闭会让 Chromium 报告 reduce）
 * 导致用户完全看不到效果，又不会给敏感人群造成不适。
 *
 * @param apply           同步应用主题的函数
 * @param origin          扩散圆心
 * @param willBeDark      切换后是否为深色（遮罩路径用于选底色）
 */
export function runThemeTransition(
  apply: () => void,
  origin?: ThemeTransitionOrigin,
  willBeDark?: boolean,
): void {
  const point = origin ?? { x: window.innerWidth / 2, y: 0 }
  // 减少动效时压缩到 340ms：仍然看得见，但不至于造成不适
  const duration = prefersReducedMotion() ? 420 : DURATION
  const doc = document as ViewTransitionDocument

  if (typeof doc.startViewTransition === 'function') {
    try {
      const radius = coverageRadius(point)
      const transition = doc.startViewTransition(() => {
        flushSync(apply)
      })

      transition.ready
        .then(() => {
          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${point.x}px ${point.y}px)`,
                `circle(${radius}px at ${point.x}px ${point.y}px)`,
              ],
            },
            {
              duration,
              // 前段快速铺开，尾段收缓，接近视频里的「泉水涌出」感
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
              pseudoElement: '::view-transition-new(root)',
            },
          )
        })
        .catch(() => {
          /* 动画被新一次切换打断：忽略 */
        })
      return
    } catch {
      /* 落到遮罩路径 */
    }
  }

  overlayTransition(apply, point, willBeDark ?? false, duration)
}

/** 遮罩回落：新主题底色圆形扩散 → 切换主题 → 淡出 */
function overlayTransition(
  apply: () => void,
  point: ThemeTransitionOrigin,
  willBeDark: boolean,
  duration: number,
) {
  const radius = coverageRadius(point)
  const color = targetSurfaceColor(willBeDark)
  const growMs = Math.round(duration * 0.72)

  const overlay = document.createElement('div')
  overlay.setAttribute('aria-hidden', 'true')
  overlay.dataset.nexusThemeOverlay = 'true'
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483000',
    pointerEvents: 'none',
    backgroundColor: color,
    clipPath: `circle(0px at ${point.x}px ${point.y}px)`,
    willChange: 'clip-path, opacity',
    transition: `clip-path ${growMs}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms ease-out`,
  })
  document.body.appendChild(overlay)

  // 下一帧开始扩散（确保初始 clip 被浏览器采纳）
  requestAnimationFrame(() => {
    overlay.style.clipPath = `circle(${radius}px at ${point.x}px ${point.y}px)`
  })

  // 扩散过半时切换真实主题
  window.setTimeout(
    () => {
      apply()
    },
    Math.round(growMs * SWITCH_AT),
  )

  // 扩散完成后淡出遮罩，露出新主题内容
  window.setTimeout(() => {
    overlay.style.opacity = '0'
  }, growMs + 40)

  window.setTimeout(() => {
    overlay.remove()
  }, duration + 320)
}
