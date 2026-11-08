/**
 * 性能监控页截图（直接注入登录态，不经过登录表单）
 *
 * 为什么直接注入：工作区可能同时有人在改登录页，登录表单与演示账号列表会在
 * 重构过程中短暂不可用。截图脚本只关心性能监控页本身，因此直接写入
 * `nexus-auth` 的持久化快照（与 `core/auth-store.ts` 的 partialize 一致）。
 *
 * 用法：
 *   node scripts/shot-performance.mjs               # 1440×900 首屏
 *   node scripts/shot-performance.mjs --dark        # 深色
 *   node scripts/shot-performance.mjs --full        # 整页（解开外壳滚动约束）
 *   node scripts/shot-performance.mjs --scroll 2400 # 滚到指定位置
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
/** 演示账号与 `scripts/_auth.mjs` 共用一份，避免两处维护同一个口令快照 */
import { DEMO_ADMIN as ADMIN } from './_auth.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const base = process.env.SHOT_BASE ?? 'http://127.0.0.1:5173'
const dark = process.argv.includes('--dark')
const full = process.argv.includes('--full')
const scrollArg = process.argv.indexOf('--scroll')
const scrollY = scrollArg > -1 ? Number(process.argv[scrollArg + 1]) : 0
const widthArg = process.argv.indexOf('--width')
const width = widthArg > -1 ? Number(process.argv[widthArg + 1]) : 1440
const nameArg = process.argv.indexOf('--name')
const outDir = join(root, 'docs/screenshots')
mkdirSync(outDir, { recursive: true })

const EDGE = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
]
  .filter(Boolean)
  .find((path) => existsSync(path))

if (!EDGE) throw new Error('未找到 Microsoft Edge / Chrome，可设置 BROWSER_PATH')

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const context = await browser.newContext({
  viewport: { width, height: 900 },
  deviceScaleFactor: 2,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
})

await context.addInitScript(
  ({ admin, darkMode }) => {
    localStorage.setItem(
      'nexus-auth',
      JSON.stringify({
        state: { token: 'demo_token_u_1001', user: admin, status: 'authenticated' },
        version: 0,
      }),
    )
    if (darkMode) {
      const raw = localStorage.getItem('nexus-ui-prefs')
      const prefs = raw ? JSON.parse(raw) : { state: {}, version: 4 }
      prefs.state = { ...(prefs.state ?? {}), theme: 'dark' }
      localStorage.setItem('nexus-ui-prefs', JSON.stringify(prefs))
    }
  },
  { admin: ADMIN, darkMode: dark },
)

const page = await context.newPage()
const errors = []
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})
page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`))

await page.goto(`${base}/dashboard/performance`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForTimeout(3400)

// 工作区可能有其它文件在编辑，Vite 的 HMR 错误浮层会盖住整页
for (let attempt = 0; attempt < 3; attempt += 1) {
  if (!(await page.locator('vite-error-overlay').count())) break
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
}

if (scrollY > 0) {
  await page.evaluate((y) => {
    const main = document.querySelector('#nexus-main')
    if (main) main.scrollTo(0, y)
  }, scrollY)
  await page.waitForTimeout(700)
}

const name = nameArg > -1 ? process.argv[nameArg + 1] : '32-performance'

if (full) {
  await page.addStyleTag({
    content: `
      html, body { height: auto !important; overflow: visible !important; }
      #root > div, #root > div > div { height: auto !important; max-height: none !important; }
      #nexus-main { overflow: visible !important; height: auto !important; flex: none !important; }
    `,
  })
  await page.waitForTimeout(600)
  await page.screenshot({
    path: join(outDir, `${name}${dark ? '-dark' : ''}-full.png`),
    fullPage: true,
  })
} else {
  await page.screenshot({ path: join(outDir, `${name}${dark ? '-dark' : ''}.png`) })
}

const probe = await page.evaluate(() => {
  const main = document.querySelector('#nexus-main')
  return {
    title: document.querySelector('h1')?.textContent?.trim(),
    overflow: main ? main.scrollWidth - main.clientWidth : -1,
    canvases: document.querySelectorAll('canvas').length,
    tables: document.querySelectorAll('table').length,
  }
})

await browser.close()
console.log(`✓ ${name}${dark ? '-dark' : ''} ${JSON.stringify(probe)}`)
console.log(errors.length ? `控制台错误:\n${errors.slice(0, 6).join('\n')}` : '控制台：无错误')
