/**
 * 侧边栏折叠 / 顶栏 / 深色模式视觉巡检
 *
 * 用法：node scripts/check-layout.mjs [baseUrl]
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const out = join(root, 'docs/screenshots/tmp')
const base = process.argv[2] ?? process.env.SHOT_BASE ?? 'http://127.0.0.1:5173'

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
if (!EDGE) throw new Error('未找到 Edge')

mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'zh-CN' })
).newPage()
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`))

await page.goto(`${base}/login`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /超级管理员/ }).first().click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: '登录', exact: true }).click()
await page.waitForURL('**/dashboard/overview')
await page.waitForTimeout(1600)

// 展开态宽屏截图
await page.screenshot({ path: join(out, 'layout-expanded-light.png') })

// 折叠侧边栏
const collapseBtn = page.getByRole('button', { name: '收起侧边栏' })
await collapseBtn.click({ force: true })
await page.waitForTimeout(600)
await page.screenshot({ path: join(out, 'layout-collapsed-light.png') })

// 量一下折叠态图标水平中心是否与侧栏中线对齐
const align = await page.evaluate(() => {
  const aside = document.querySelector('aside')
  const icons = Array.from(aside?.querySelectorAll('li svg') ?? []).slice(0, 6)
  const asideRect = aside?.getBoundingClientRect()
  if (!asideRect) return null
  const center = asideRect.left + asideRect.width / 2
  return icons.map((svg) => {
    const rect = svg.getBoundingClientRect()
    return Math.round(rect.left + rect.width / 2 - center)
  })
})
console.log('折叠态图标水平偏移（px，0 表示居中）：', JSON.stringify(align))

// 切深色
await page.getByRole('button', { name: '切换主题' }).click()
await page.waitForTimeout(900)
await page.screenshot({ path: join(out, 'layout-collapsed-dark.png') })

// 展开 + 深色全宽
await page.getByRole('button', { name: '展开侧边栏' }).click({ force: true })
await page.waitForTimeout(600)
await page.screenshot({ path: join(out, 'layout-expanded-dark.png') })

// 深色下其他页面
for (const [name, route] of [
  ['dark-users', '/business/users'],
  ['dark-tables', '/components/tables'],
  ['dark-templates', '/templates/overview'],
]) {
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: join(out, `${name}.png`) })
}

await browser.close()
console.log(errors.length ? `控制台错误：${errors.slice(0, 5).join(' | ')}` : '无控制台错误')
