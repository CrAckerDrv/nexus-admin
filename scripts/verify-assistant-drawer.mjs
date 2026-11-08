/// <reference lib="dom" />
/// <reference types="node" />

/**
 * 助手抽屉专项验收（多会话 / 思考链 / 几何 / 宽度记忆）
 *
 * `verify-assistant.mjs` 验的是「功能链路走得通」，这个脚本验的是**这一版的外观与交互承诺**：
 * 1. 抽屉贴右缘、占满视口高度（退化成浮层会直接失败）
 * 2. 生成一轮之后，思考链与工具调用都在，且可展开
 * 3. 多会话：新建 / 切换 / 会话列 / 消息不串台
 * 4. 拖拽宽度后刷新仍然记得
 *
 * 截图输出到 docs/screenshots/assistant/（10- 起编号，不和主脚本冲突）。
 * 用法：node scripts/verify-assistant-drawer.mjs [baseURL]
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'docs', 'screenshots', 'assistant')
const base = process.argv[2] ?? 'http://127.0.0.1:5173'

const executablePath = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
]
  .filter(Boolean)
  .find((path) => existsSync(path))

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

await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' })
// 登录页会异步加载人机验证，`networkidle` 在有长连接时不稳；直接等快捷卡出现
const demoCard = page.getByRole('button', { name: /超级管理员/ }).first()
await demoCard.waitFor({ state: 'visible', timeout: 30000 })
await demoCard.click()
await page.getByRole('button', { name: '登录', exact: true }).click()
await page.waitForURL('**/dashboard/overview', { timeout: 30000 })
await page.waitForTimeout(900)

// 从空会话开始，避免上次运行的历史干扰断言
await page.evaluate(() => localStorage.removeItem('nexus-ai-sessions'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(900)

const dialog = page.getByRole('dialog', { name: 'AI 运营助手' })

await step('抽屉贴右缘、全高', async () => {
  await page.getByRole('button', { name: 'AI 运营助手' }).first().click()
  await dialog.waitFor({ state: 'visible', timeout: 8000 })
  await page.waitForTimeout(500)
  const box = await dialog.boundingBox()
  const viewport = page.viewportSize()
  console.log('  抽屉:', JSON.stringify(box), '视口:', JSON.stringify(viewport))
  if (!box || !viewport) throw new Error('拿不到抽屉尺寸')
  if (Math.abs(box.height - viewport.height) > 2) throw new Error(`不是全高：${box.height}`)
  if (Math.abs(box.y) > 1) throw new Error(`没有贴顶：y=${box.y}`)
  if (Math.abs(box.x + box.width - viewport.width) > 2) throw new Error('没有贴右')
  await page.screenshot({ path: join(outDir, '10-drawer-empty.png') })
})

await step('一轮对话产出思考链与工具调用', async () => {
  const composer = dialog.getByRole('textbox').first()
  await composer.fill('帮我实现一个用户数据统计页面')
  await composer.press('Enter')
  await dialog
    .getByRole('button', { name: /应用到侧边栏|已应用/ })
    .first()
    .waitFor({ timeout: 90000 })
  await page.waitForTimeout(800)

  const reasoning = dialog.getByRole('button', { name: /思考过程/ }).first()
  await reasoning.waitFor({ timeout: 8000 })
  const aiText = await reasoning.textContent()
  if (!/思考过程/.test(aiText ?? '')) throw new Error('思考链标签缺失')

  const tool = dialog.getByRole('button', { name: /生成页面/ }).first()
  await tool.waitFor({ timeout: 8000 })
  await page.screenshot({ path: join(outDir, '11-drawer-generated.png') })
})

await step('思考链可展开', async () => {
  const reasoning = dialog.getByRole('button', { name: /思考过程/ }).first()
  await reasoning.click()
  await page.waitForTimeout(350)
  const expanded = await reasoning.getAttribute('aria-expanded')
  if (expanded !== 'true') throw new Error('思考链没有展开')
  await page.screenshot({ path: join(outDir, '12-drawer-reasoning.png') })
})

await step('工具调用详情可展开且不与标题行重叠', async () => {
  const tool = dialog.getByRole('button', { name: /生成页面/ }).first()
  await tool.click()
  await page.waitForTimeout(350)
  // 展开后应能看到「参数 / 结果」两栏
  await dialog.getByText('参数').first().waitFor({ timeout: 5000 })

  // 回归断言：展开面板必须**排在标题行下面**。
  // 曾经这里套了 `.n-fade-in`（关键帧里带 -50% 居中位移），
  // 结果整块被上移半个自身高度，直接压住标题行与上一段文字。
  const geometry = await tool.evaluate((node) => {
    const panel = node.parentElement?.children[1]
    return {
      headerBottom: Math.round(node.getBoundingClientRect().bottom),
      panelTop: panel ? Math.round(panel.getBoundingClientRect().top) : null,
      panelTransform: panel ? getComputedStyle(panel).transform : null,
    }
  })
  console.log('  几何:', JSON.stringify(geometry))
  if (geometry.panelTop === null) throw new Error('没有找到展开面板')
  if (geometry.panelTop < geometry.headerBottom - 1) {
    throw new Error(
      `展开面板压住了标题行：panelTop=${geometry.panelTop} < headerBottom=${geometry.headerBottom}`,
    )
  }
  if (geometry.panelTransform && geometry.panelTransform !== 'none') {
    throw new Error(`展开面板不该带位移：transform=${geometry.panelTransform}`)
  }
  await page.screenshot({ path: join(outDir, '13-drawer-tool.png') })
})

await step('新建会话不丢旧会话', async () => {
  await page.getByRole('button', { name: '新建会话' }).first().click()
  await page.waitForTimeout(600)
  // 新会话应当回到问候语，而不是沿用上一段对话
  await dialog.getByText('有什么可以帮你的？').first().waitFor({ timeout: 5000 })
  await page.screenshot({ path: join(outDir, '14-drawer-new-session.png') })
})

await step('会话列可展开并列出两条会话', async () => {
  await page.getByRole('button', { name: '会话', exact: true }).first().click()
  await page.waitForTimeout(600)
  const items = dialog.locator('ul li')
  const count = await items.count()
  if (count < 2) throw new Error(`会话列只有 ${count} 条`)
  await page.screenshot({ path: join(outDir, '15-drawer-sessions.png') })
  await page.getByRole('button', { name: '会话', exact: true }).first().click()
  await page.waitForTimeout(400)
})

await step('切回旧会话，消息还在', async () => {
  await page.getByRole('button', { name: '会话', exact: true }).first().click()
  await page.waitForTimeout(500)
  await dialog
    .getByRole('button', { name: /^帮我实现一个用户数据统计页面/ })
    .first()
    .click()
  await page.waitForTimeout(700)
  await dialog.getByText('用户数据统计').first().waitFor({ timeout: 8000 })
  await page.getByRole('button', { name: '会话', exact: true }).first().click()
  await page.waitForTimeout(400)
})

await step('深色态', async () => {
  await page.evaluate(() => {
    const raw = localStorage.getItem('nexus-ui-prefs')
    const prefs = raw ? JSON.parse(raw) : { state: {} }
    prefs.state = { ...(prefs.state ?? {}), theme: 'dark' }
    localStorage.setItem('nexus-ui-prefs', JSON.stringify(prefs))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1100)
  await page.getByRole('button', { name: 'AI 运营助手' }).first().click()
  await page.waitForTimeout(700)
  await page.screenshot({ path: join(outDir, '16-drawer-dark.png') })

  // 回到浅色，后面的宽度记忆截图才是常规形态
  await page.evaluate(() => {
    const raw = localStorage.getItem('nexus-ui-prefs')
    const prefs = raw ? JSON.parse(raw) : { state: {} }
    prefs.state = { ...(prefs.state ?? {}), theme: 'light' }
    localStorage.setItem('nexus-ui-prefs', JSON.stringify(prefs))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: 'AI 运营助手' }).first().click()
  await page.waitForTimeout(600)
})

await step('拖拽宽度并记忆', async () => {
  const handle = dialog.getByRole('separator', { name: '拖动调整宽度' }).first()
  const box = await handle.boundingBox()
  if (!box) throw new Error('拿不到拖拽手柄')
  await page.mouse.move(box.x + box.width / 2, 400)
  await page.mouse.down()
  await page.mouse.move(box.x - 120, 400, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(400)
  const widened = await dialog.boundingBox()

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: 'AI 运营助手' }).first().click()
  await page.waitForTimeout(600)
  const reopened = await page.getByRole('dialog', { name: 'AI 运营助手' }).boundingBox()
  console.log('  拖后:', widened?.width, '重开后:', reopened?.width)
  if (!widened || !reopened || Math.abs(widened.width - reopened.width) > 2) {
    throw new Error('宽度没有被记忆')
  }
  await page.screenshot({ path: join(outDir, '17-drawer-resized.png') })
})

await browser.close()

if (errors.length) {
  console.error(`\n发现 ${errors.length} 个控制台错误：`)
  errors.slice(0, 20).forEach((message) => console.error('  -', message))
  process.exit(1)
}
console.log('\n抽屉专项验收通过，截图见 docs/screenshots/assistant/')
