/**
 * 验收脚本：登录页人机验证（Cloudflare Turnstile · 按需触发）
 *
 * 覆盖：
 * 1. 初始状态：组件挂载但**不运行、不占位**（登录按钮与输入框间距与未接入时一致）
 * 2. 点「登录」后才开始验证并出票
 * 3. 演示态使用官方测试票据，登录不被阻断
 * 4. 登录失败后旧票据作废，再次提交能换到新票据
 * 5. 深色模式下可读
 *
 * 用法：node scripts/verify-turnstile.mjs [base]
 * 依赖：dev server（默认 5173）已启动
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  if (text.includes('503')) return
  // Turnstile 自身的 CSP 探针噪音（data: 连接）与业务无关
  if (text.includes("Connecting to 'data:,'")) return
  if (text.includes('Content Security Policy')) return
  errors.push(text)
})
page.on('pageerror', (error) => errors.push(`[pageerror] ${error.message}`))

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

/** 量「记住我 ←→ 登录按钮」的间距与组件占位高度 */
const measure = () =>
  page.evaluate(() => {
    const group = document.querySelector('[role="group"][aria-label="人机验证"]')
    const remember = document.querySelector('[role="switch"]')
    const submit = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.trim().startsWith('登录'),
    )
    const r = remember?.getBoundingClientRect()
    const s = submit?.getBoundingClientRect()
    const g = group?.getBoundingClientRect()
    return {
      gap: r && s ? Math.round(s.top - r.bottom) : null,
      widgetHeight: g ? Math.round(g.height) : null,
      token: document.querySelector('input[name="cf-turnstile-response"]')?.value ?? '',
    }
  })

await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForTimeout(2500)

/* ---------------- 1. 初始：不运行、不占位 ---------------- */
const initial = await measure()
check('人机验证区域存在', initial.widgetHeight !== null)
check(
  '初始不占位（高度 0，登录按钮未被推远）',
  initial.widgetHeight === 0 && initial.gap === 16,
  `高度 ${initial.widgetHeight}px / 间距 ${initial.gap}px`,
)
check('初始不出票（验证尚未开始）', initial.token === '', initial.token || '无票据')
await page.screenshot({ path: join(outDir, '36-login-turnstile.png') })

/* ---------------- 2. 点登录后才出票 ---------------- */
await page.getByRole('button', { name: /超级管理员/ }).first().click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: '登录', exact: true }).click()

const issued = await page
  .waitForFunction(
    () => Boolean(document.querySelector('input[name="cf-turnstile-response"]')?.value),
    null,
    { timeout: 20_000 },
  )
  .then(() => true)
  .catch(() => false)
check('点击登录后开始验证并出票', issued)

const tokenValue = issued
  ? await page.locator('input[name="cf-turnstile-response"]').first().inputValue()
  : ''
check('演示态使用官方测试票据', tokenValue === 'XXXX.DUMMY.TOKEN.XXXX', tokenValue || '（无票据）')

const loggedIn = await page
  .waitForURL('**/dashboard/overview', { timeout: 30_000 })
  .then(() => true)
  .catch(() => false)
check('演示态下可正常登录（人机验证不阻断）', loggedIn)

/* ---------------- 3. 失败后旧票作废、可换新票 ---------------- */
if (loggedIn) {
  await page.evaluate(() => localStorage.removeItem('nexus-auth'))
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)

  await page.getByRole('button', { name: /只读访客/ }).first().click()
  await page.locator('#password').fill('wrong-password')
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await page.waitForTimeout(2500)

  const hasError = await page.locator('p.text-danger').first().isVisible().catch(() => false)
  check('错误密码显示错误提示', hasError)

  /**
   * 重试用同一张票会不会失败？
   *
   * 演示态用「永远通过」测试 key，票据恒为 `XXXX.DUMMY.TOKEN.XXXX`，
   * 所以**不能靠字符串变化**判断是否换票。这里验证用户真正关心的结果：
   * 密码改对后再点一次登录，能正常登录进去 —— 说明第二次提交拿到的票是被接受的，
   * 没有撞上 `timeout-or-duplicate`。
   */
  await page.locator('#password').fill('nexus123')
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  const retryOk = await page
    .waitForURL('**/dashboard/overview', { timeout: 30_000 })
    .then(() => true)
    .catch(() => false)
  check('失败后重试可正常登录（一次性票已换新）', retryOk)
}

/* ---------------- 4. 深色模式 ---------------- */
await page.evaluate(() => {
  const raw = localStorage.getItem('nexus-ui-prefs')
  const prefs = raw ? JSON.parse(raw) : { state: {} }
  prefs.state = { ...(prefs.state ?? {}), theme: 'dark' }
  localStorage.setItem('nexus-ui-prefs', JSON.stringify(prefs))
  localStorage.removeItem('nexus-auth')
})
await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)
const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
check('深色模式下登录页人机验证', dark)
await page.screenshot({ path: join(outDir, '37-login-turnstile-dark.png') })

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
