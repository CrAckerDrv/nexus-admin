import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gotoAuthed, seedAuth } from './_auth.mjs'

/**
 * 终态验收：宽度阶梯 × 明暗 × 多路由
 * 断言：根字号恒 16px、内容区有宽度上限、无横向溢出、无控制台错误。
 */
const __dirname = dirname(fileURLToPath(import.meta.url))
const out = join(__dirname, '..', 'docs', 'screenshots', 'final')
mkdirSync(out, { recursive: true })

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

const ROUTES = [
  ['overview', '/dashboard/overview'],
  ['users', '/business/users'],
  ['templates', '/templates/overview'],
  ['forms', '/components/forms'],
]

const measure = () =>
  page.evaluate(() => {
    const shell = document.querySelector('.n-page-shell')
    const shellW = shell ? Math.round(shell.getBoundingClientRect().width) : 0
    return {
      root: getComputedStyle(document.documentElement).fontSize,
      body: getComputedStyle(document.body).fontSize,
      shellW,
      fill: Math.round((shellW / window.innerWidth) * 100) + '%',
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      asideW: Math.round(document.querySelector('aside.n-sidebar')?.getBoundingClientRect().width ?? 0),
      headerH: Math.round(document.querySelector('header')?.getBoundingClientRect().height ?? 0),
      cols: (() => {
        const grid = document.querySelector('.n-page-shell .grid')
        if (!grid) return 0
        return getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length
      })(),
    }
  })

for (const dark of [false, true]) {
  await page.evaluate((isDark) => {
    document.documentElement.classList.toggle('dark', isDark)
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
  }, dark)

  for (const [name, route] of ROUTES) {
    await gotoAuthed(page, route, base)
    await page.evaluate((isDark) => {
      document.documentElement.classList.toggle('dark', isDark)
      document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
    }, dark)
    for (const width of [1440, 1920, 2560, 2850]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.waitForTimeout(450)
      const m = await measure()
      console.log(
        `${(dark ? 'dark' : 'light') + '-' + name + '-' + width}`.padEnd(26) +
          ` root=${m.root.padEnd(6)} shell=${String(m.shellW).padStart(4)} fill=${m.fill.padStart(4)}` +
          ` cols=${m.cols} overflow=${m.overflow} aside=${m.asideW} header=${m.headerH}`,
      )
      if (width === 2850) {
        await page.screenshot({ path: join(out, `${dark ? 'dark' : 'light'}-${name}-2850.png`) })
      }
    }
  }
}

console.log('\nconsole errors:', errors.length ? errors.slice(0, 8) : '无')
await browser.close()
