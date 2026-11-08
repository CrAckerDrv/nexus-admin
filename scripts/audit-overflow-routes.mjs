import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'
import { seedAuth, gotoAuthed } from './_auth.mjs'

/**
 * 多路由 × 拖拽缩放 的横向溢出回归
 *
 * 单路由通过不代表全站通过：fr 轨道、固定宽侧栏、大屏页都可能各有一套问题。
 * 这里对每个路由都做「从宽拖到窄」的小步遍历。
 */
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
if (!EDGE) throw new Error('Edge not found')

const base = 'http://127.0.0.1:5173'
const ROUTES = [
  '/dashboard/overview',
  '/dashboard/analytics',
  '/dashboard/performance',
  '/business/users',
  '/business/orders',
  '/business/content',
  '/system/settings',
  '/organization/roles',
  '/templates/overview',
  '/templates/kanban',
  '/templates/gantt',
  '/templates/media-workbench',
  '/components/forms',
  '/components/tables',
  '/components/charts',
  '/components/overview',
  '/account/profile',
  '/assistant/workspace',
]

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const context = await browser.newContext({ viewport: { width: 2850, height: 1200 }, locale: 'zh-CN' })
const page = await context.newPage()
await seedAuth(page, base)
await gotoAuthed(page, '/dashboard/overview', base)

const probe = () =>
  page.evaluate(() => {
    const main = document.querySelector('#nexus-main')
    if (!main) return null
    const mainRight = main.getBoundingClientRect().right
    const wide = [...main.querySelectorAll('*')]
      .filter((el) => {
        const cs = getComputedStyle(el)
        if (cs.position === 'absolute' || cs.position === 'fixed') return false
        const r = el.getBoundingClientRect()
        return r.right > mainRight + 1 && r.width > 30
      })
      .map((el) => ({
        text: (el.textContent || '').trim().slice(0, 22),
        w: Math.round(el.getBoundingClientRect().width),
        cls: (el.getAttribute('class') || '').slice(0, 56),
      }))
      .slice(0, 2)
    return { over: main.scrollWidth - main.clientWidth, wide }
  })

let total = 0
let failedRoutes = []
for (const route of ROUTES) {
  await gotoAuthed(page, route, base)
  await page.setViewportSize({ width: 2850, height: 1200 })
  await page.waitForTimeout(700)
  const badWidths = []
  for (let width = 2850; width >= 1100; width -= 70) {
    await page.setViewportSize({ width, height: 1000 })
    await page.waitForTimeout(180)
    const p = await probe()
    if (p && p.over > 1) {
      badWidths.push({ width, over: p.over, wide: p.wide })
      total += 1
    }
  }
  if (badWidths.length) {
    failedRoutes.push(route)
    console.log(`❌ ${route}  ${badWidths.length} 处溢宽，最早 ${badWidths[0].width}px over=${badWidths[0].over}`)
    console.log(`   ${JSON.stringify(badWidths[0].wide)}`)
  } else {
    console.log(`✅ ${route}`)
  }
}

console.log(`\n合计：${ROUTES.length} 路由，${failedRoutes.length} 个有问题，${total} 处溢宽`)
await browser.close()
