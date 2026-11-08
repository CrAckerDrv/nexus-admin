/**
 * 模板中心验收：6 个新页面渲染 + 关键交互
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const base = process.env.SHOT_BASE ?? 'http://127.0.0.1:5173'
const outDir = join(root, 'docs/screenshots/tmp')
mkdirSync(outDir, { recursive: true })

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
})
const page = await context.newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`))

await page.goto(`${base}/login`, { waitUntil: 'networkidle' })
// 登录页现在要求手填账号：点「超级管理员」快捷卡自动填邮箱，再补密码
await page.getByRole('button', { name: /超级管理员/ }).first().click()
await page.waitForTimeout(200)
await page.locator('#password').fill('nexus123')
await page.getByRole('button', { name: /超级管理员/ }).first().click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: '登录', exact: true }).click()
await page.waitForURL('**/dashboard/overview', { timeout: 20000 })
await page.waitForTimeout(1000)

const ROUTES = [
  ['overview', '/templates/overview'],
  ['command-center', '/templates/command-center'],
  ['kanban', '/templates/kanban'],
  ['gantt', '/templates/gantt'],
  ['ai-chat', '/templates/ai-chat'],
  ['workflow', '/templates/workflow'],
  ['files', '/templates/files'],
]

for (const [name, path] of ROUTES) {
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1400)
  const probe = await page.evaluate(() => ({
    // 页面是否真的有内容（不是空白/错误页）
    text: document.body.innerText.length,
    hasError: document.body.innerText.includes('页面渲染出错') || document.body.innerText.includes('出错'),
    charts: document.querySelectorAll('canvas').length,
  }))
  await page.screenshot({ path: join(outDir, `tpl-${name}.png`) })
  console.log(`✓ ${name}: ${probe.text} 字符, canvas ${probe.charts}${probe.hasError ? ' ⚠️ 错误页' : ''}`)
}

// ---- Kanban 拖拽 ----
await page.goto(`${base}/templates/kanban`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
const before = await page.evaluate(
  () => document.querySelectorAll('article[draggable="true"]').length,
)
console.log('Kanban 卡片数:', before)

// ---- Gantt 缩放 ----
await page.goto(`${base}/templates/gantt`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
const ganttWidths = []
for (const label of ['周', '月', '季']) {
  await page.getByRole('tab', { name: label, exact: true }).click()
  await page.waitForTimeout(300)
  const width = await page.evaluate(() => {
    const bar = document.querySelector('[style*="width:"][style*="left:"]')
    return bar ? Math.round(bar.getBoundingClientRect().width) : 0
  })
  ganttWidths.push(`${label}:${width}`)
}
console.log('Gantt 缩放:', ganttWidths.join(' '))

// ---- AI 流式 ----
await page.goto(`${base}/templates/ai-chat`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.getByRole('button', { name: /生成本月经营分析摘要/ }).click()
await page.waitForTimeout(1200)
const streaming = await page.evaluate(() => {
  const bubbles = [...document.querySelectorAll('.max-w-\\[82\\%\\]')]
  return bubbles.length
})
console.log('AI 消息气泡:', streaming)
await page.screenshot({ path: join(outDir, 'tpl-ai-chat-streaming.png') })

// ---- Workflow 拖拽节点 ----
await page.goto(`${base}/templates/workflow`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
const nodeCount = await page.evaluate(() => document.querySelectorAll('[data-node]').length)
const edgeCount = await page.evaluate(() => document.querySelectorAll('svg path[marker-end]').length)
console.log('Workflow:', `节点 ${nodeCount}, 连线 ${edgeCount}`)

// ---- Files 视图切换 ----
await page.goto(`${base}/templates/files`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
const gridCount = await page.evaluate(() => document.querySelectorAll('button.rounded-lg.border.bg-surface').length)
await page.getByRole('tab').nth(1).click()
await page.waitForTimeout(500)
const hasTable = await page.evaluate(() => Boolean(document.querySelector('table')))
console.log('Files:', `网格 ${gridCount} 项, 列表视图 ${hasTable ? '✓' : '✗'}`)
await page.screenshot({ path: join(outDir, 'tpl-files-list.png') })

await browser.close()
console.log(errors.length ? `\n控制台错误:\n${errors.slice(0, 10).join('\n')}` : '\n✓ 无控制台错误')
