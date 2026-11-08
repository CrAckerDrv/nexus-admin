/// <reference lib="dom" />
/// <reference types="node" />

/**
 * 真实模型链路验收
 *
 * 与 `verify-assistant.mjs` 的区别：那个跑的是「本地引擎」全链路（无密钥也能过），
 * 这个专门验证**真的调到了模型**：健康检查 → 引擎角标变为模型 → 发一句话 →
 * 模型返回工具调用 → 页面生成。
 *
 * 用法：node scripts/verify-assistant-llm.mjs [baseURL]
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loginAs } from './lib/browser-login.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'docs', 'screenshots', 'assistant')
const base = process.argv[2] ?? 'http://127.0.0.1:5183'

const CANDIDATES = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean)

const executablePath = CANDIDATES.find((path) => existsSync(path))
if (!executablePath) {
  console.error('未找到 Edge / Chrome，可设置 BROWSER_PATH')
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })

// 0. 先确认网关有活着的供应商
const health = await fetch(`${base}/ai-gateway/health`).then((response) => response.json())
console.log(
  '网关:',
  JSON.stringify({ ok: health.ok, provider: health.provider, model: health.model }),
)
if (!health.ok) {
  console.error('✗ 网关没有可用的供应商，无法验证模型链路')
  process.exit(1)
}
if (health.note) console.log('附注:', health.note)

const browser = await chromium.launch({ executablePath, headless: true })
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
page.on('pageerror', (error) => errors.push(`[pageerror] ${error.message}`))

// 记录真实发往网关的请求，确认走的是模型而不是本地引擎
const gatewayCalls = []
page.on('request', (request) => {
  if (request.url().includes('/ai-gateway/chat/completions')) {
    gatewayCalls.push({ method: request.method(), at: Date.now() })
  }
})

// 登录（Turnstile 票据异步，统一走 lib/browser-login 的重试逻辑）
await loginAs(page, base)
await page.waitForTimeout(1200)

// 1. 打开抽屉，等引擎角标从「本地引擎」变成模型名
await page.getByRole('button', { name: 'AI 运营助手' }).first().click()
await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 8000 })

const dialog = page.getByRole('dialog')
const engineBadge = dialog.getByText('本地引擎').first()
const localVisible = await engineBadge.isVisible().catch(() => false)
if (localVisible) {
  // 探活是异步的，给它一点时间
  await page.waitForTimeout(2500)
}
const stillLocal = await engineBadge.isVisible().catch(() => false)
if (stillLocal) {
  console.error('✗ 界面仍显示「本地引擎」，模型链路没有接上')
  await page.screenshot({ path: join(outDir, 'llm-00-failed.png') })
  await browser.close()
  process.exit(1)
}
console.log('✓ 引擎角标已切换为模型')

// 2. 发一句真实需求
const composer = dialog.getByRole('textbox', { name: /描述你想要的页面/ }).first()
await composer.fill('帮我实现一个用户数据统计页面')
const sendButton = dialog.getByRole('button', { name: '发送' }).first()
await sendButton.waitFor({ state: 'visible', timeout: 8000 })
for (let i = 0; i < 100; i += 1) {
  if (await sendButton.isEnabled()) break
  await page.waitForTimeout(100)
}
const sentAt = Date.now()
await sendButton.click()

// 3. 等页面预览出现（模型返回工具调用 → 工具执行 → 落页面）
await dialog
  .getByRole('button', { name: /应用到侧边栏|已应用/ })
  .first()
  .waitFor({ timeout: 90000 })
const elapsed = Date.now() - sentAt
console.log(`✓ 模型生成页面成功（${Math.round(elapsed / 1000)}s）`)
console.log(`  网关请求数: ${gatewayCalls.length}`)

await page.screenshot({ path: join(outDir, 'llm-01-generated.png') })

// 4. 应用并验证侧边栏
await dialog.getByRole('button', { name: '应用到侧边栏' }).first().click()
await page.waitForTimeout(800)
await page.keyboard.press('Escape')
await page.waitForTimeout(600)
const nav = page.getByRole('navigation', { name: /工作台/ }).first()
await nav.getByText('AI 生成').first().waitFor({ timeout: 8000 })
console.log('✓ 已应用到侧边栏')
await page.screenshot({ path: join(outDir, 'llm-02-sidebar.png') })

await browser.close()

if (gatewayCalls.length === 0) {
  console.error('✗ 没有观察到发往 /ai-gateway/chat/completions 的请求')
  process.exit(1)
}
if (errors.length) {
  console.error(`\n控制台错误 ${errors.length} 条：`)
  errors.slice(0, 10).forEach((message) => console.error('  -', message))
  process.exit(1)
}
console.log('\n真实模型链路验证通过')
