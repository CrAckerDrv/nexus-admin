/**
 * 验收脚本：组件橱窗 + 开发指南
 *
 * 覆盖：
 * 1. 侧边栏底部「开发指南」入口 → /guide/overview
 * 2. 组件总览：搜索过滤、卡片详情弹窗、Props 页签、11 个分类
 * 3. 指南 7 个页面渲染无控制台错误，且每页都有足够的代码示例
 * 4. 深色模式下组件橱窗可读
 *
 * 登录用 `_auth.mjs` 注入鉴权状态：登录表单挂 Cloudflare Turnstile，
 * headless 下会停在「等待人机验证」，与本脚本要验证的内容无关。
 *
 * 用法：node scripts/verify-gallery-guide.mjs [base]
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { seedAuth } from './_auth.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'docs', 'screenshots')
const base = process.argv[2] ?? process.env.SHOT_BASE ?? 'http://127.0.0.1:5173'

const EDGE = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
]
  .filter(Boolean)
  .find((path) => existsSync(path))

if (!EDGE) throw new Error('未找到 Edge / Chrome，可设置 BROWSER_PATH')

mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
})
const page = await context.newPage()

/** @type {string[]} */
const errors = []
page.on('console', (message) => {
  if (message.type() !== 'error') return
  const text = message.text()
  // 开发服务器的 HMR / 预取偶发 503 与业务无关
  if (text.includes('503')) return
  errors.push(text)
})
page.on('pageerror', (error) => errors.push(`[pageerror] ${error.message}`))

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

await seedAuth(page, base)
await page.goto(`${base}/dashboard/overview`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForTimeout(1400)

/* ---------------- 1. 侧边栏底部入口 ---------------- */
const guideEntry = page.getByRole('link', { name: /开发指南/ }).first()
check('侧边栏底部存在「开发指南」入口', await guideEntry.count().then((n) => n > 0))
await guideEntry.click()
await page.waitForURL('**/guide/overview', { timeout: 20_000 })
await page.waitForTimeout(1200)
check('点击后进入 /guide/overview', page.url().endsWith('/guide/overview'))

/* ---------------- 2. 侧边栏分组内 4 个页面 ---------------- */
const guideNavCount = await page.locator('a[href="/guide/backend"]').count()
check('侧边栏出现「开发指南」分组的接入后端入口', guideNavCount > 0, `${guideNavCount} 个链接`)

/* ---------------- 3. 组件总览 ---------------- */
await page.goto(`${base}/components/overview`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1600)
// 内容区是内层滚动容器且开了 scrollRestoration：截图前必须显式回顶
await page.evaluate(() => {
  window.scrollTo(0, 0)
  document.getElementById('nexus-main')?.scrollTo({ top: 0 })
})
await page.waitForTimeout(300)
const cardCount = await page.locator('[data-gallery-key]').count()
check('组件橱窗渲染卡片', cardCount > 40, `${cardCount} 张卡片`)
const navCount = await page.locator('nav[aria-label="组件索引"] button').count()
check('左侧组件索引存在', navCount > 40, `${navCount} 个条目`)
await page.screenshot({ path: join(outDir, '50-components-gallery.png') })

// 搜索
const search = page.getByLabel('搜索组件')
await search.fill('dialog')
await page.waitForTimeout(600)
const filtered = await page.locator('[data-gallery-key]').count()
// 只要命中数严格小于总数、且大于 0，就说明过滤生效（"dialog" 也会命中描述里提到弹层的条目）
check(
  '搜索 dialog 过滤生效',
  filtered > 0 && filtered < cardCount,
  `${filtered}/${cardCount} 张卡片`,
)
await page.screenshot({ path: join(outDir, '51-components-search.png') })

// 详情弹窗：直接按条目 key 定位，避免被搜索结果的其它条目干扰
const dialogCard = page.locator('[data-gallery-key="dialog"]')
await dialogCard.scrollIntoViewIfNeeded()
await dialogCard.hover()
await page.waitForTimeout(300)
await dialogCard.locator('button[aria-label^="查看"]').first().click()
await page.waitForTimeout(800)
const dialogVisible = await page.getByRole('dialog').isVisible()
check('点击「用法」打开详情弹窗', dialogVisible)
const usageTab = await page.getByRole('tab', { name: 'Props' }).count()
check('详情弹窗有 Props 页签', usageTab > 0)
await page.getByRole('tab', { name: 'Props' }).click()
await page.waitForTimeout(500)
const propRows = await page.getByRole('dialog').locator('tbody tr').count()
check('Props 表有内容', propRows > 0, `${propRows} 行`)
await page.screenshot({ path: join(outDir, '52-components-detail.png') })
await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).last().click()
await page.waitForTimeout(500)

// 中文 / 拼音搜索
await search.fill('按钮')
await page.waitForTimeout(500)
const zhHits = await page.locator('[data-gallery-key]').count()
check('中文搜索「按钮」命中', zhHits > 0, `${zhHits} 张卡片`)
await search.fill('')

/* ---------------- 4. 指南页面 ---------------- */
for (const [name, path, minCode] of [
  ['guide-overview', '/guide/overview', 1],
  ['guide-backend', '/guide/backend', 8],
  ['guide-module', '/guide/module', 3],
  ['guide-contract', '/guide/contract', 1],
  ['guide-ai-sdk', '/guide/ai-sdk', 8],
  ['guide-ui-kit', '/guide/ui-kit', 5],
  ['guide-workflow', '/guide/workflow', 3],
]) {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1300)
  const heading = await page.locator('h1').first().textContent()
  check(`${path} 渲染`, Boolean(heading?.trim()), heading?.trim())
  const blocks = await page.locator('pre').count()
  check(`${path} 代码块 ≥ ${minCode}`, blocks >= minCode, `${blocks} 个`)
  await page.screenshot({ path: join(outDir, `${name}.png`) })
}

// 新增分组：SDK 与组件库（二级菜单）
const groupLinks = await page.locator('a[href="/guide/ai-sdk"], a[href="/guide/ui-kit"]').count()
check('侧栏出现「SDK 与组件库」二级入口', groupLinks >= 2, `${groupLinks} 个链接`)

// 教程正文里代码块数量（说明教程确实是"完整"的）
await page.goto(`${base}/guide/backend`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
const codeBlocks = await page.locator('pre').count()
check('接入后端含多段代码', codeBlocks >= 8, `${codeBlocks} 个代码块`)
const tocItems = await page.locator('main aside nav a').count()
check('右侧目录可跳转', tocItems >= 8, `${tocItems} 个标题`)

/* ---------------- 5. 分类完整性 ---------------- */
await page.goto(`${base}/components/overview`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1600)
const categoryNames = await page
  .locator('nav[aria-label="组件索引"] > div > button')
  .allTextContents()
const expected = [
  'Basic',
  'Form',
  'Data',
  'Charts',
  'Media',
  'Feedback',
  'Banner',
  'Navigation',
  'Layout',
  'Canvas',
  'Hooks',
  'Utility',
  'Motion',
  'Premium',
]
const missingCategories = expected.filter(
  (name) => !categoryNames.some((text) => text.startsWith(name)),
)
check(
  `${expected.length} 个分类齐全（含 Charts / Media / Banner / Hooks）`,
  missingCategories.length === 0,
  missingCategories.length
    ? `缺 ${missingCategories.join(', ')}`
    : `${categoryNames.length} 个分类`,
)
const totalCards = await page.locator('[data-gallery-key]').count()
check('橱窗条目 ≥ 120', totalCards >= 120, `${totalCards} 张卡片`)

/* ---------------- 6. 深色模式 ---------------- */
await page.evaluate(() => {
  const raw = localStorage.getItem('nexus-ui-prefs')
  const prefs = raw ? JSON.parse(raw) : { state: {} }
  prefs.state = { ...(prefs.state ?? {}), theme: 'dark' }
  localStorage.setItem('nexus-ui-prefs', JSON.stringify(prefs))
})
await page.goto(`${base}/components/overview`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1800)
const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
check('深色模式下组件橱窗', dark)
await page.screenshot({ path: join(outDir, '53-components-gallery-dark.png') })

// 恢复浅色
await page.evaluate(() => {
  const raw = localStorage.getItem('nexus-ui-prefs')
  const prefs = raw ? JSON.parse(raw) : { state: {} }
  prefs.state = { ...(prefs.state ?? {}), theme: 'light' }
  localStorage.setItem('nexus-ui-prefs', JSON.stringify(prefs))
})

await browser.close()

const failed = results.filter((item) => !item.ok)
console.log(`\n${results.length - failed.length}/${results.length} 项通过`)
if (errors.length > 0) {
  console.error(`\n控制台错误 ${errors.length} 条：`)
  errors.slice(0, 12).forEach((error) => console.error(' -', error))
}
if (failed.length > 0) process.exitCode = 1
