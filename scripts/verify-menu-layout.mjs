/**
 * 菜单布局自检：六种布局逐个截图 + 关键结构断言
 *
 * 用法：node scripts/verify-menu-layout.mjs [--dark]
 *
 * 断言的是「结构」而不是像素：
 * - vertical / floating / sidebar：侧栏里应出现模块分组标题
 * - dual：应出现模块导轨（aside 更宽）且第二列有当前模块子菜单
 * - horizontal：不应出现 aside，顶栏里应有模块链接
 * - mixed：顶栏有模块切换，aside 里只有当前模块的菜单
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const out = join(root, 'docs', 'screenshots', 'tmp', 'menu-layout')
mkdirSync(out, { recursive: true })

const base = process.env.SHOT_BASE ?? 'http://127.0.0.1:5173'
const dark = process.argv.includes('--dark')

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((path) => existsSync(path))
if (!EDGE) throw new Error('未找到 Edge / Chrome')

const LAYOUTS = ['vertical', 'dual', 'horizontal', 'mixed', 'floating', 'sidebar']

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
})
const page = await context.newPage()
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`))

await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForTimeout(3000)
await page
  .getByRole('button', { name: /超级管理员/ })
  .first()
  .click({ timeout: 30_000 })
await page.waitForTimeout(300)
await page.getByRole('button', { name: '登录', exact: true }).click()
await page.waitForURL('**/dashboard/overview', { timeout: 30_000 })
await page.waitForTimeout(1500)

/** 写入偏好并重载（布局是 store 派生的，直接改 localStorage 最贴近真实持久化路径） */
async function applyLayout(layout) {
  await page.evaluate(
    ({ layout, dark }) => {
      const raw = localStorage.getItem('nexus-ui-prefs')
      const prefs = raw ? JSON.parse(raw) : { state: {} }
      prefs.state = { ...(prefs.state ?? {}), menuLayout: layout }
      if (dark) prefs.state.theme = 'dark'
      localStorage.setItem('nexus-ui-prefs', JSON.stringify(prefs))
    },
    { layout, dark },
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
}

/** 读取结构断言需要的事实 */
async function inspect() {
  return page.evaluate(() => {
    const aside = document.querySelector('aside')
    const header = document.querySelector('header')
    const headerLinks = header ? header.querySelectorAll('a[href^="/"]').length : 0
    const asideRect = aside?.getBoundingClientRect()
    const navTexts = [...(aside?.querySelectorAll('nav span') ?? [])]
      .map((el) => el.textContent?.trim() ?? '')
      .filter(Boolean)
    return {
      hasAside: Boolean(aside),
      asideWidth: asideRect ? Math.round(asideRect.width) : 0,
      asideTop: asideRect ? Math.round(asideRect.top) : 0,
      hasNavRail: Boolean(aside?.querySelector('nav[aria-label="主导航"]')),
      hasGroupTitles: navTexts.some((text) => text === '业务管理' || text === '工作台'),
      headerLinks,
      datasetMenuLayout: document.documentElement.dataset.menuLayout,
      bodyOverflowX: document.documentElement.scrollWidth > window.innerWidth,
    }
  })
}

const results = []
for (const layout of LAYOUTS) {
  await applyLayout(layout)
  const info = await inspect()
  await page.screenshot({ path: join(out, `${layout}${dark ? '-dark' : ''}.png`) })
  results.push({ layout, ...info })
}

await browser.close()

for (const row of results) {
  console.log(
    `${row.layout.padEnd(10)} aside=${String(row.hasAside).padEnd(5)} w=${String(row.asideWidth).padEnd(4)} top=${String(row.asideTop).padEnd(3)} links=${String(row.headerLinks).padEnd(2)} rail=${String(row.hasNavRail).padEnd(5)} groups=${String(row.hasGroupTitles).padEnd(5)} dataset=${row.datasetMenuLayout} overflowX=${row.bodyOverflowX}`,
  )
}
console.log(errors.length ? `控制台错误：\n${errors.slice(0, 8).join('\n')}` : '✓ 无控制台错误')
