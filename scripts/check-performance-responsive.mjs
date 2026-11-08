/**
 * 性能监控页响应式探针：多档视口检查横向溢出与控制台错误
 *
 * 用法：node scripts/check-performance-responsive.mjs
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const base = process.env.SHOT_BASE ?? 'http://127.0.0.1:5173'
const outDir = join(root, 'docs/screenshots/tmp')
mkdirSync(outDir, { recursive: true })

const EDGE = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((path) => path && existsSync(path))

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1.5,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
})
const page = await context.newPage()
const errors = []
page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`))

// 先在宽视口登录（登录页的演示账号区域在窄屏会被折叠）
await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 })

/**
 * 登录重试
 *
 * dev server 在并行编辑时会触发 HMR 重编译，页面偶尔会晚一拍才把
 * 「快速切换角色」列表渲染出来；这里给 3 次机会而不是硬等一次。
 */
let loggedIn = false
for (let attempt = 0; attempt < 3 && !loggedIn; attempt += 1) {
  const demo = page.getByRole('button', { name: /超级管理员/ }).first()
  try {
    await demo.waitFor({ state: 'visible', timeout: 15_000 })
    await demo.click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL('**/dashboard/overview', { timeout: 30_000 })
    loggedIn = true
  } catch {
    await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForTimeout(1500)
  }
}
if (!loggedIn) throw new Error('演示账号登录失败（3 次重试）')

const WIDTHS = [1920, 1600, 1440, 1280, 1024, 768, 390]

for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 1000 })
  await page.goto(`${base}/dashboard/performance`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  })
  await page.waitForTimeout(2600)
  const probe = await page.evaluate(() => {
    const main = document.querySelector('#nexus-main')
    return {
      docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      mainOverflow: main ? main.scrollWidth - main.clientWidth : 0,
      canvases: document.querySelectorAll('canvas').length,
      tables: document.querySelectorAll('table').length,
      text: document.body.innerText.length,
    }
  })
  if ([1600, 1024, 390].includes(width)) {
    await page.screenshot({ path: join(outDir, `perf-${width}.png`) })
  }
  const ok = probe.docOverflow <= 0 && probe.mainOverflow <= 0 && probe.canvases > 0
  console.log(
    `${String(width).padStart(4)}px  ${ok ? '✓' : '✗'}  溢出 ${probe.docOverflow}/${probe.mainOverflow}px  图 ${probe.canvases}  表 ${probe.tables}`,
  )
}

await browser.close()
console.log(errors.length ? `控制台错误:\n${errors.slice(0, 6).join('\n')}` : '控制台：无错误')
