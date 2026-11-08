/**
 * 英文模式冒烟：确认「开发指南 7 页 / 组件总览」在 en-US 下不出现缺词条或崩溃
 *
 * 登录用 `_auth.mjs` 注入鉴权状态：登录表单挂 Cloudflare Turnstile，
 * headless 下会停在「等待人机验证」，与本脚本要验证的内容无关。
 *
 * 用法：node scripts/verify-i18n-smoke.mjs [base]
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

if (!EDGE) throw new Error('未找到 Edge / Chrome')

mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: 'en-US',
  timezoneId: 'Asia/Shanghai',
})
const page = await context.newPage()
const errors = []
page.on('console', (message) => {
  if (message.type() !== 'error') return
  if (message.text().includes('503')) return
  errors.push(message.text())
})
page.on('pageerror', (error) => errors.push(`[pageerror] ${error.message}`))

await seedAuth(page, base)
await page.goto(`${base}/dashboard/overview`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForTimeout(1200)

// 切到英文
await page.evaluate(() => {
  const raw = localStorage.getItem('nexus-ui-prefs')
  const prefs = raw ? JSON.parse(raw) : { state: {} }
  prefs.state = { ...(prefs.state ?? {}), locale: 'en-US' }
  localStorage.setItem('nexus-ui-prefs', JSON.stringify(prefs))
})

let failed = 0
for (const path of [
  '/guide/overview',
  '/guide/backend',
  '/guide/module',
  '/guide/contract',
  '/guide/ai-sdk',
  '/guide/ui-kit',
  '/guide/workflow',
  '/components/overview',
]) {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForTimeout(1500)
  const heading = (await page.locator('h1').first().textContent())?.trim() ?? ''
  // 缺词条时 i18n 会直接回显 key（形如 nav.xxx），这里据此判定
  const missingKey = /\b[a-z]+\.[a-zA-Z]+\b/.test(heading) && !heading.includes(' ')
  const ok = Boolean(heading) && !missingKey
  if (!ok) failed += 1
  console.log(`${ok ? '✓' : '✗'} ${path} → ${heading}`)
  if (path === '/guide/backend') {
    await page.screenshot({ path: join(outDir, '54-guide-backend-en.png') })
  }
}

// 侧边栏底部入口在英文下应显示 Developer guide（注意：分组内还有同名的 Overview 导航项，这里按文案筛选）
await page.goto(`${base}/dashboard/overview`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)
const footerEntry = page
  .locator('aside a[href="/guide/overview"]')
  .filter({ hasText: 'Developer guide' })
const footerCount = await footerEntry.count()
console.log(
  `${footerCount > 0 ? '✓' : '✗'} 侧栏底部英文入口 → ${footerCount > 0 ? 'Developer guide' : '未找到'}`,
)
if (footerCount === 0) failed += 1

await browser.close()

if (errors.length > 0) {
  console.error(`\n控制台错误 ${errors.length} 条：`)
  errors.slice(0, 10).forEach((error) => console.error(' -', error))
}
if (failed > 0 || errors.length > 0) process.exitCode = 1
else console.log('\n英文模式检查通过 ✅')
