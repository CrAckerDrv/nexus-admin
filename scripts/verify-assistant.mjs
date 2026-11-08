/// <reference lib="dom" />
/// <reference types="node" />

/**
 * AI 运营助手验收脚本
 *
 * 覆盖需求里的四条主链路：
 * 1. 顶栏按钮 → 打开浮层（图 1 → 图 2/3 的入口）
 * 2. 说一句「帮我实现一个用户数据统计页面」→ 生成页面 + 预览
 * 3. 「应用到侧边栏」→ 侧栏出现 AI 生成分组，点进去是正式页
 * 4. 改配色 / 问后端接入 → 都有可读结果
 *
 * 用法：node scripts/verify-assistant.mjs [baseURL]
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loginAs } from './lib/browser-login.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'docs', 'screenshots', 'assistant')
const base = process.argv[2] ?? process.env.SHOT_BASE ?? 'http://127.0.0.1:5173'

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

const step = async (name, fn) => {
  await fn()
  console.log(`✓ ${name}`)
}

/**
 * 输入框定位
 *
 * 抽屉里除了对话输入框还有「会话搜索」等 textbox，
 * 直接取 `.first()` 会命中错误的那一个（发送按钮因此一直是禁用态）。
 * 这里按 aria-label 精确定位到 composer。
 */
const composer = (scope) => scope.getByRole('textbox', { name: /描述你想要的页面/ }).first()

/** 发送：等按钮可用再点，避免打字机/禁用态竞态 */
const send = async (scope) => {
  const button = scope.getByRole('button', { name: '发送' }).first()
  await button.waitFor({ state: 'visible', timeout: 8000 })
  await expectEnabled(button)
  await button.click()
}

const expectEnabled = async (locator, timeout = 8000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeout) {
    if (await locator.isEnabled()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('发送按钮一直处于禁用状态：输入框可能没拿到内容')
}

// 登录（Turnstile 票据是异步的，统一走 lib/browser-login 的重试逻辑）
await loginAs(page, base)

// 1. 顶栏入口
await step('顶栏 AI 按钮', async () => {
  const launcher = page.getByRole('button', { name: 'AI 运营助手' }).first()
  await launcher.waitFor({ state: 'visible', timeout: 8000 })
  await launcher.click()
  await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 8000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(outDir, '01-panel-empty.png') })
})

// 2. 一句话生成页面
await step('生成页面', async () => {
  const box = composer(page)
  await box.fill('帮我实现一个用户数据统计页面')
  await send(page)
  // 本地引擎有打字机效果，等预览卡出现
  await page.getByRole('dialog').getByText('应用到侧边栏').first().waitFor({ timeout: 30000 })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: join(outDir, '02-generated.png') })
})

// 3. 预览并应用
await step('应用到侧边栏', async () => {
  await page.getByRole('dialog').getByRole('button', { name: '应用到侧边栏' }).first().click()
  await page.waitForTimeout(900)
  await page.screenshot({ path: join(outDir, '03-applied.png') })
  // 关闭抽屉：用 ESC 而不是按钮名 —— 按钮文案会随设计调整，ESC 是稳定契约
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  // 侧边栏应出现 AI 生成分组
  const nav = page.getByRole('navigation', { name: /工作台/ }).first()
  await nav.getByText('AI 生成').first().waitFor({ timeout: 8000 })
  await page.screenshot({ path: join(outDir, '04-sidebar.png') })
})

// 4. 打开正式页
await step('打开生成页', async () => {
  await page.goto(`${base}/generated/user-stats`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1600)
  await page.screenshot({ path: join(outDir, '05-generated-page.png'), fullPage: true })
})

// 5. 改配色
await step('改配色', async () => {
  await page.goto(`${base}/assistant/workspace`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await composer(page).fill('把主色改成紫色')
  await send(page)
  await page.waitForTimeout(2600)
  await page.screenshot({ path: join(outDir, '06-restyle.png') })
})

// 6. 后端接入说明
await step('后端接入说明', async () => {
  await composer(page).fill('怎么把后端接口交给助手')
  await send(page)
  await page.waitForTimeout(2600)
  await page.screenshot({ path: join(outDir, '07-backend-guide.png') })
})

// 7. 接口清单页
await step('接口接入面板', async () => {
  await page.getByRole('tab', { name: '接口接入' }).click()
  await page.waitForTimeout(700)
  await page.screenshot({ path: join(outDir, '08-api-panel.png') })
})

// 8. 深色态
await step('深色态', async () => {
  await page.evaluate(() => {
    const raw = localStorage.getItem('nexus-ui-prefs')
    const prefs = raw ? JSON.parse(raw) : { state: {} }
    prefs.state = { ...(prefs.state ?? {}), theme: 'dark' }
    localStorage.setItem('nexus-ui-prefs', JSON.stringify(prefs))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'AI 运营助手' }).first().click()
  await page.waitForTimeout(900)
  await page.screenshot({ path: join(outDir, '09-dark-panel.png') })
})

await browser.close()

if (errors.length) {
  console.error(`\n发现 ${errors.length} 个控制台错误：`)
  errors.slice(0, 20).forEach((message) => console.error('  -', message))
  process.exit(1)
}
console.log('\n全部通过，截图见 docs/screenshots/assistant/')
