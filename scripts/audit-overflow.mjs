import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'
import { seedAuth, gotoAuthed } from './_auth.mjs'

/**
 * 横向溢出审计
 *
 * 两个容易漏掉的方向：
 * 1. **下行缩放**：ECharts 的 canvas 只有在 ResizeObserver 触发时才 resize，
 *    从大窗口缩小后可能留着旧宽度，把内容顶出去。必须「从宽到窄」走一遍。
 * 2. 内层滚动容器：只看 documentElement 的 scrollWidth 抓不到，
 *    `#nexus-main` 自己的 scrollWidth 才是准的。
 */
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
if (!EDGE) throw new Error('Edge not found')

const base = 'http://127.0.0.1:5173'
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })
const page = await context.newPage()
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`))

await seedAuth(page, base)
await gotoAuthed(page, '/dashboard/overview', base)

const audit = () =>
  page.evaluate(() => {
    const vw = window.innerWidth
    const main = document.querySelector('#nexus-main')
    const docEl = document.documentElement

    /** 是否会被某个祖先的 overflow:hidden/clip 裁掉（裁掉的元素不会产生滚动条） */
    const isClipped = (el) => {
      let node = el.parentElement
      while (node && node !== document.body) {
        const o = getComputedStyle(node)
        if (/hidden|clip|auto|scroll/.test(o.overflowX)) return true
        node = node.parentElement
      }
      return false
    }

    // 找出「真的会把容器顶宽」的元素：排除 fixed / 装饰性绝对定位 / 被裁切的
    const offenders = []
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el)
      if (cs.position === 'fixed' || cs.visibility === 'hidden' || cs.display === 'none') continue
      if (cs.position === 'absolute' && isClipped(el)) continue // 装饰性光斑，已被裁掉
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.right > vw + 1) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.getAttribute('class') || '').slice(0, 70),
          right: Math.round(r.right),
          w: Math.round(r.width),
          over: Math.round(r.right - vw),
        })
      }
    }
    offenders.sort((a, b) => b.w - a.w)

    // canvas 尺寸 vs 容器尺寸：检测「ECharts 没跟着缩」
    const canvases = [...document.querySelectorAll('canvas')].map((c) => {
      const r = c.getBoundingClientRect()
      const parent = c.parentElement?.getBoundingClientRect()
      return {
        canvasW: Math.round(r.width),
        parentW: parent ? Math.round(parent.width) : null,
        stale: parent ? Math.round(r.width - parent.width) : null,
      }
    })

    return {
      vw,
      docOverflow: docEl.scrollWidth - vw,
      mainOverflow: main ? main.scrollWidth - main.clientWidth : null,
      offenders: offenders.slice(0, 5),
      canvases,
    }
  })

console.log('=== 上行（1440 起逐级放大）===')
for (const width of [1024, 1152, 1280, 1366, 1440, 1536, 1680, 1920, 2400, 2560, 2850]) {
  await page.setViewportSize({ width, height: 900 })
  await page.waitForTimeout(600)
  const a = await audit()
  const bad = a.offenders.length > 0 || a.mainOverflow > 1 || a.docOverflow > 1
  const stale = a.canvases.filter((c) => c.stale !== null && Math.abs(c.stale) > 2)
  console.log(
    `${String(a.vw).padStart(5)} main=${String(a.mainOverflow).padStart(4)} doc=${String(a.docOverflow).padStart(4)}` +
      ` canvasStale=${stale.length ? JSON.stringify(stale) : '0'} ${bad ? '❌ ' + JSON.stringify(a.offenders.slice(0, 3)) : '✅'}`,
  )
}

// 关键：从 2850 一路缩回 1280，验证 canvas 是否跟着缩
console.log('\n=== 下行（2850 → 1280，验证 canvas 是否留下旧宽度）===')
await page.setViewportSize({ width: 2850, height: 1200 })
await page.waitForTimeout(900)
for (const width of [2560, 1920, 1600, 1440, 1366, 1280]) {
  await page.setViewportSize({ width, height: 900 })
  await page.waitForTimeout(900)
  const a = await audit()
  const stale = a.canvases.filter((c) => c.stale !== null && Math.abs(c.stale) > 2)
  console.log(
    `${String(a.vw).padStart(5)} main=${String(a.mainOverflow).padStart(4)} doc=${String(a.docOverflow).padStart(4)}` +
      ` stale=${stale.length ? JSON.stringify(stale) : '0'} ${a.mainOverflow > 1 ? '❌' : '✅'}`,
  )
}

console.log('\nerrors:', errors.slice(0, 5))
await browser.close()
