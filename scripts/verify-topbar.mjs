/**
 * 顶栏验收：布局 + 交互
 *
 * 覆盖的约定：
 * 1) 侧栏开关永远在搜索入口**左侧**（移动端打开抽屉、桌面端折叠/展开）
 * 2) 移动端搜索入口退化为**无描边**的图标按钮，不显示占位文案与 ⌘K 提示
 * 3) 桌面端搜索入口恢复成带描边的搜索框（含占位文案与 ⌘K）
 * 4) 320 ~ 1280px 各档均无横向溢出
 *
 * 用法：node scripts/verify-topbar.mjs [--dark]
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const base = process.env.SHOT_BASE ?? 'http://127.0.0.1:5173'
const out = join(root, 'docs/screenshots/tmp')
const dark = process.argv.includes('--dark')
const WIDTHS = [320, 360, 390, 414, 640, 768, 1024, 1280]

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
if (!EDGE) throw new Error('未找到 Microsoft Edge')

mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
})
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.goto(`${base}/login`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /管理员/ }).first().click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: '登录', exact: true }).click()
await page.waitForURL('**/dashboard/overview', { timeout: 20000 })
await page.waitForTimeout(900)

if (dark) {
  await page.evaluate(() => {
    const raw = localStorage.getItem('nexus-ui-prefs')
    const prefs = raw ? JSON.parse(raw) : { state: {} }
    prefs.state = { ...(prefs.state ?? {}), theme: 'dark' }
    localStorage.setItem('nexus-ui-prefs', JSON.stringify(prefs))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
}

/** 顶栏几何：谁在左、搜索是否描边、是否显示占位文案、是否横向溢出 */
const probe = () =>
  page.evaluate(() => {
    const header = document.querySelector('header')
    const search = header?.querySelector('button[aria-label*="搜索"], button[aria-label*="Search"]')
    const toggle = header?.querySelector(
      'button[aria-label*="侧边栏"], button[aria-label*="sidebar"]',
    )
    const rect = (el) => (el ? el.getBoundingClientRect() : null)
    const sr = rect(search)
    const tr = rect(toggle)
    return {
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      headerH: Math.round(rect(header)?.height ?? 0),
      toggleLeft: tr ? Math.round(tr.left) : null,
      searchLeft: sr ? Math.round(sr.left) : null,
      searchW: sr ? Math.round(sr.width) : null,
      order: tr && sr ? tr.left < sr.left : null,
      searchBorder: search ? getComputedStyle(search).borderTopWidth : null,
      searchLabelVisible: [...(search?.querySelectorAll('span') ?? [])].some(
        (el) => el.getBoundingClientRect().width > 2,
      ),
    }
  })

const asideLeft = () =>
  page.evaluate(() => Math.round(document.querySelector('aside').getBoundingClientRect().left))
const asideWidth = () =>
  page.evaluate(() => Math.round(document.querySelector('aside').getBoundingClientRect().width))

let failed = 0
const check = (label, ok, detail) => {
  if (!ok) failed += 1
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? `  ${detail}` : ''}`)
}

console.log('① 各宽度布局')
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 844 })
  await page.waitForTimeout(420)
  const info = await probe()
  const mobile = width < 768
  check(
    `${String(width).padStart(4)}px`,
    info.overflowX === 0 &&
      info.order === true &&
      info.headerH === 56 &&
      (mobile
        ? info.searchBorder === '0px' && info.searchW === 32 && !info.searchLabelVisible
        : info.searchBorder === '1px' && info.searchLabelVisible),
    JSON.stringify(info),
  )
  await page.screenshot({
    path: join(out, `topbar-${width}${dark ? '-dark' : ''}.png`),
    clip: { x: 0, y: 0, width, height: 116 },
  })
}

console.log('② 移动端抽屉')
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(500)
check('初始抽屉收起', (await asideLeft()) < 0, `left=${await asideLeft()}`)
await page.locator('header button').first().click()
await page.waitForTimeout(520)
check('顶栏开关打开抽屉', (await asideLeft()) === 0, `left=${await asideLeft()}`)
await page.screenshot({ path: join(out, 'topbar-mobile-drawer.png') })
await page.getByRole('button', { name: '关闭', exact: true }).first().click()
await page.waitForTimeout(520)
check('关闭按钮收起抽屉', (await asideLeft()) < 0, `left=${await asideLeft()}`)

console.log('③ 移动端搜索按钮')
await page.locator('header button[aria-label*="搜索"]').click()
await page.waitForTimeout(400)
const palette = await page.evaluate(() =>
  Boolean(document.querySelector('[role="dialog"][aria-modal="true"]')),
)
check('唤起命令面板', palette)
await page.screenshot({ path: join(out, 'topbar-mobile-search.png') })
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

console.log('④ 桌面端折叠')
await page.setViewportSize({ width: 1280, height: 900 })
await page.waitForTimeout(600)
const before = await asideWidth()
await page.locator('header button').first().click()
await page.waitForTimeout(700)
const after = await asideWidth()
check('折叠按钮生效', before === 236 && after === 64, `${before}px → ${after}px`)
await page.screenshot({ path: join(out, 'topbar-desktop-collapsed.png') })

await browser.close()
console.log(errors.length ? `\n控制台错误: ${errors.slice(0, 5).join(' | ')}` : '\n✓ 无页面错误')
process.exitCode = failed === 0 && errors.length === 0 ? 0 : 1
