/**
 * 侧边栏图标态（收起）验收：应平铺所有叶子项，含二级子项
 */
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2,
  locale: 'zh-CN',
})
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto('http://127.0.0.1:5180/login', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /管理员/ }).first().click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: '登录', exact: true }).click()
await page.waitForURL('**/dashboard/overview', { timeout: 20000 })

// 切成图标态
await page.evaluate(() => {
  const raw = localStorage.getItem('nexus-ui-prefs')
  const prefs = raw ? JSON.parse(raw) : { state: {} }
  prefs.state = { ...(prefs.state ?? {}), sidebarCollapsed: true }
  localStorage.setItem('nexus-ui-prefs', JSON.stringify(prefs))
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

const probe = await page.evaluate(() => {
  const nav = document.querySelector('nav')
  const icons = [...nav.querySelectorAll('a svg')].filter(
    (s) => s.getBoundingClientRect().width > 0,
  )
  const groups = [...nav.querySelectorAll('button[aria-expanded]')]
  const widths = [...nav.querySelectorAll('a')]
    .slice(0, 3)
    .map((a) => Math.round(a.getBoundingClientRect().width))
  return {
    visibleLeafIcons: icons.length,
    groupButtons: groups.length,
    itemWidths: widths,
    sidebarWidth: Math.round(document.querySelector('aside').getBoundingClientRect().width),
  }
})
console.log('图标态:', JSON.stringify(probe))
console.log('  分组按钮已隐藏:', probe.groupButtons === 0 ? 'OK' : 'FAIL')
console.log('  叶子图标数量充足:', probe.visibleLeafIcons >= 20 ? 'OK' : `FAIL(${probe.visibleLeafIcons})`)

// hover 提示
await page.locator('nav a').nth(3).hover()
await page.waitForTimeout(500)
const tip = await page.evaluate(() => {
  const el = document.querySelector('[role="tooltip"]')
  if (!el) return { found: false }
  const r = el.getBoundingClientRect()
  return {
    found: true,
    text: el.textContent?.trim(),
    visible: r.left >= 0 && r.right <= window.innerWidth && r.height > 0,
  }
})
console.log('  悬浮提示:', JSON.stringify(tip))

// 移动端：应强制展开
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(800)
const mobile = await page.evaluate(() => {
  const aside = document.querySelector('aside')
  const labels = [...document.querySelectorAll('nav a')]
    .map((a) => a.textContent?.trim())
    .filter(Boolean)
  return {
    sidebarWidth: Math.round(aside.getBoundingClientRect().width),
    hasTextLabels: labels.some((l) => l.length > 4),
    labelCount: labels.length,
  }
})
console.log('移动端:', JSON.stringify(mobile))

await browser.close()
console.log(errors.length ? `错误: ${errors.join('; ')}` : '✓ 无页面错误')
