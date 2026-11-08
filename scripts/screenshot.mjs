/// <reference lib="dom" />
/// <reference types="node" />

/**
 * 截图与冒烟检查脚本：遍历所有路由，收集控制台错误并产出 README 截图
 *
 * 用法：
 *   node scripts/screenshot.mjs                 # 默认 http://127.0.0.1:5173
 *   node scripts/screenshot.mjs http://127.0.0.1:5173
 *
 * 依赖：playwright-core（已加入 devDependencies）+ 本机 Edge / Chrome
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

const CANDIDATES = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)

const executablePath = CANDIDATES.find((path) => existsSync(path))
if (!executablePath) {
  console.error('未找到 Edge / Chrome，可设置 BROWSER_PATH 环境变量指定浏览器路径')
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })

const ROUTES = [
  { name: '02-overview', path: '/dashboard/overview' },
  { name: '03-analytics', path: '/dashboard/analytics' },
  { name: '04-users', path: '/business/users' },
  { name: '05-orders', path: '/business/orders' },
  { name: '06-content', path: '/business/content' },
  { name: '07-roles', path: '/organization/roles' },
  { name: '08-structure', path: '/organization/structure' },
  { name: '09-tables', path: '/components/tables' },
  { name: '10-charts', path: '/components/charts' },
  { name: '11-forms', path: '/components/forms' },
  { name: '12-overview-components', path: '/components/overview' },
  { name: '13-audit', path: '/system/audit' },
  { name: '14-settings', path: '/system/settings' },
  { name: '16-templates', path: '/templates/overview' },
  { name: '17-feedback', path: '/components/feedback' },
  { name: '18-forbidden', path: '/errors/403' },
  { name: '19-server-error', path: '/errors/500' },
  { name: '20-premium', path: '/components/premium' },
  { name: '21-command-center', path: '/templates/command-center' },
  { name: '22-kanban', path: '/templates/kanban' },
  { name: '23-gantt', path: '/templates/gantt' },
  { name: '24-ai-chat', path: '/templates/ai-chat' },
  { name: '25-workflow', path: '/templates/workflow' },
  { name: '26-files', path: '/templates/files' },
  { name: '60-media-workbench', path: '/templates/media-workbench' },
  { name: '27-profile', path: '/account/profile' },
  { name: '28-screens-gallery', path: '/templates/screens' },
  { name: '29-screen-ops', path: '/templates/screen-ops' },
  { name: '30-screen-finance', path: '/templates/screen-finance' },
  { name: '31-screen-logistics', path: '/templates/screen-logistics' },
  { name: '36-screen-city', path: '/templates/screen-city' },
  { name: '37-screen-manufacturing', path: '/templates/screen-manufacturing' },
  { name: '38-screen-campaign', path: '/templates/screen-campaign' },
  { name: '39-screen-compute', path: '/templates/screen-compute' },
  // 开发指南（7 页）与组件橱窗
  { name: '32-guide-overview', path: '/guide/overview' },
  { name: '33-guide-backend', path: '/guide/backend' },
  { name: '34-guide-module', path: '/guide/module' },
  { name: '35-guide-contract', path: '/guide/contract' },
  { name: '47-guide-ai-sdk', path: '/guide/ai-sdk' },
  { name: '48-guide-ui-kit', path: '/guide/ui-kit' },
  { name: '49-guide-workflow', path: '/guide/workflow' },
]

const browser = await chromium.launch({ executablePath, headless: true })
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
  if (message.type() === 'error') errors.push(message.text())
})
page.on('pageerror', (error) => errors.push(`[pageerror] ${error.message}`))

await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForTimeout(900)
await page.screenshot({ path: join(outDir, '01-login.png') })
console.log('✓ 01-login')

// 登录态注入：登录表单挂 Turnstile，headless 下无法自动通过（详见 _auth.mjs）
await seedAuth(page, base)
await page.goto(`${base}/dashboard/overview`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForTimeout(1500)

for (const route of ROUTES) {
  await page.goto(`${base}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForTimeout(1400)
  // 内容区是内层滚动容器，且开了 scrollRestoration：
  // 不显式回顶时，同一会话里的下一页会沿用上一页的滚动位置（截图看起来像"从中间开始"）
  await page.evaluate(() => {
    window.scrollTo(0, 0)
    document.getElementById('nexus-main')?.scrollTo({ top: 0 })
  })
  await page.waitForTimeout(250)
  await page.screenshot({ path: join(outDir, `${route.name}.png`) })
  console.log(`✓ ${route.name}`)
}

// 深色模式
await page.goto(`${base}/dashboard/overview`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForTimeout(800)
await page.evaluate(() => {
  const raw = localStorage.getItem('nexus-ui-prefs')
  const prefs = raw ? JSON.parse(raw) : { state: {} }
  prefs.state = { ...(prefs.state ?? {}), theme: 'dark' }
  localStorage.setItem('nexus-ui-prefs', JSON.stringify(prefs))
})
await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(1600)
await page.screenshot({ path: join(outDir, '15-dark.png') })
console.log('✓ 15-dark')

await browser.close()

if (errors.length > 0) {
  console.error(`\n发现 ${errors.length} 个控制台错误：`)
  errors.slice(0, 20).forEach((error) => console.error(' -', error))
  process.exitCode = 1
} else {
  console.log('\n全部路由渲染正常，无控制台错误 ✅')
}
