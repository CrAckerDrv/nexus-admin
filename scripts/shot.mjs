/**
 * 单页截图工具（开发时快速验证某一路由）
 *
 * 用法：node scripts/shot.mjs /components/overview [输出名] [--dark] [--login] [--full]
 *
 * 两个和旧版不同的地方：
 * 1. 等待策略从 `networkidle` 改为 `domcontentloaded` + 显式等待：
 *    开发服务器在 HMR 重编译时有长连接，`networkidle` 容易一直不满足而超时。
 * 2. `--login` 走 `_auth.mjs` 注入登录态，而不是点登录按钮：
 *    登录表单挂着 Cloudflare Turnstile，headless 下会停在「等待人机验证」。
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { seedAuth } from './_auth.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const base = process.env.SHOT_BASE ?? 'http://127.0.0.1:5173'
const route = process.argv[2] ?? '/dashboard/overview'
const name = process.argv[3] ?? `shot-${Date.now()}`
const dark = process.argv.includes('--dark')
const fullPage = process.argv.includes('--full')
const login = process.argv.includes('--login')

const EDGE = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
]
  .filter(Boolean)
  .find((path) => existsSync(path))

if (!EDGE) throw new Error('未找到 Microsoft Edge / Chrome，可设置 BROWSER_PATH')

mkdirSync(join(root, 'docs/screenshots'), { recursive: true })

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
})
const page = await context.newPage()
const errors = []
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})
page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`))

if (login) {
  await seedAuth(page, base)
} else {
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForTimeout(1200)
}

if (dark) {
  await page.evaluate(() => {
    const raw = localStorage.getItem('nexus-ui-prefs')
    const prefs = raw ? JSON.parse(raw) : { state: {} }
    prefs.state = { ...(prefs.state ?? {}), theme: 'dark' }
    localStorage.setItem('nexus-ui-prefs', JSON.stringify(prefs))
  })
}

await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForTimeout(2000)
// 滚动回顶部：模板开了 scrollRestoration，直接截图可能停在上一个页面的滚动位置
await page.evaluate(() => {
  window.scrollTo(0, 0)
  document.getElementById('nexus-main')?.scrollTo({ top: 0 })
  document.querySelectorAll('[data-gallery-scroll]').forEach((el) => el.scrollTo({ top: 0 }))
})
await page.waitForTimeout(300)
await page.screenshot({
  path: join(root, 'docs/screenshots', `${name}.png`),
  fullPage,
})
await browser.close()

console.log(
  errors.length ? `控制台错误：\n${errors.slice(0, 10).join('\n')}` : `✓ ${name}（无控制台错误）`,
)
