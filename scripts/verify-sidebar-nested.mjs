/**
 * 侧边栏二级展开验收
 *
 * 注意：折叠用的是 grid-rows-[0fr]，节点仍在 DOM 中，
 * 因此必须按「可见高度」判断，不能用 querySelectorAll 计数。
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const base = process.env.SHOT_BASE ?? 'http://127.0.0.1:5180'
const outDir = join(root, 'docs/screenshots/tmp')
mkdirSync(outDir, { recursive: true })

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: 'zh-CN',
})
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(`${base}/login`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /管理员/ }).first().click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: '登录', exact: true }).click()
await page.waitForURL('**/dashboard/overview', { timeout: 20000 })
await page.goto(`${base}/templates/overview`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

/**
 * 只统计「真正看得见」的导航链接
 *
 * 注意：折叠用 `grid-rows-[0fr]` + `overflow-hidden`，子节点仍在 DOM 里，
 * `getBoundingClientRect()` 返回的是未裁剪的布局尺寸，不能用它判断可见性。
 * 这里改为读取外层可折叠容器的实际高度。
 */
const visibleLinks = () =>
  page.evaluate(() => {
    const nav = document.querySelector('nav')
    const result = []
    for (const a of nav.querySelectorAll('a')) {
      // 沿祖先链找可折叠容器：高度为 0 说明被折叠掉了
      let clipped = false
      let node = a.parentElement
      while (node && node !== nav) {
        const style = getComputedStyle(node)
        if (style.overflow === 'hidden' && node.getBoundingClientRect().height < 2) {
          clipped = true
          break
        }
        node = node.parentElement
      }
      if (!clipped) result.push(a.textContent?.trim())
    }
    return result.filter(Boolean)
  })

const before = await visibleLinks()
console.log(`① 默认可见 ${before.length} 项:`, JSON.stringify(before))

// 分组图标与高度
const groups = await page.evaluate(() =>
  [...document.querySelectorAll('nav button[aria-expanded]')].map((b) => ({
    text: b.textContent?.trim().slice(0, 8),
    hasIcon: Boolean(b.querySelector('svg')),
    h: Math.round(b.getBoundingClientRect().height),
  })),
)
console.log('② 分组按钮:', JSON.stringify(groups))

// 折叠 / 展开「数据可视化」
const sub = page.getByRole('button', { name: '数据可视化' })
await sub.click()
await page.waitForTimeout(450)
const collapsed = await visibleLinks()
await sub.click()
await page.waitForTimeout(450)
const expanded = await visibleLinks()
console.log(
  `③ 折叠后 ${collapsed.length} 项（运营大屏${collapsed.includes('运营大屏') ? '仍在' : '已隐藏'}）`,
)
console.log(
  `   展开后 ${expanded.length} 项（运营大屏${expanded.includes('运营大屏') ? '可见' : '缺失'}）`,
)
console.log('   收起生效:', !collapsed.includes('运营大屏') ? 'OK' : 'FAIL')
console.log('   展开生效:', expanded.includes('运营大屏') ? 'OK' : 'FAIL')

// 二级项缩进
const indent = await page.evaluate(() => {
  const group = [...document.querySelectorAll('nav button')].find((b) =>
    b.textContent?.trim().startsWith('模板中心'),
  )
  const leaf = [...document.querySelectorAll('nav a')].find((a) =>
    a.textContent?.includes('运营大屏'),
  )
  return {
    groupIconLeft: group ? Math.round(group.querySelector('svg').getBoundingClientRect().left) : null,
    leafIconLeft: leaf?.querySelector('svg')
      ? Math.round(leaf.querySelector('svg').getBoundingClientRect().left)
      : null,
  }
})
console.log('④ 缩进:', JSON.stringify(indent))

await page.screenshot({ path: join(outDir, 'sidebar-nested.png') })
await browser.close()
console.log(errors.length ? `错误: ${errors.join('; ')}` : '✓ 无页面错误')
