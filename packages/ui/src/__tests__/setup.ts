import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

/**
 * jsdom 补丁
 *
 * jsdom 没有实现 `Element.prototype.scrollIntoView`，
 * 而 Select 的键盘导航依赖它把高亮项滚进视口。
 * 这里补一个空实现，让「键盘导航」这类行为可以在测试里被验证。
 */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

/**
 * jsdom 补丁：`window.matchMedia`
 *
 * jsdom 没有实现 matchMedia，任何读媒体查询的组件（`useMotionEnabled`、
 * `useMediaQuery`、premium 里的动效开关）在测试里都会抛
 * `TypeError: window.matchMedia is not a function`。
 * 这里给一个恒返回 `matches: false` 的实现 —— 等价于「系统没要求减少动效」，
 * 具体用例需要别的取值时自行覆盖 `window.matchMedia`。
 */
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  delete document.documentElement.dataset.motion
})
