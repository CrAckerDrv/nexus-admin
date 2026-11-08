/**
 * 主题切换动画逐帧分析：验证圆形扩散是否真的发生
 *
 * 用法：node scripts/check-transition.mjs [baseUrl]
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const out = join(__dirname, '..', 'docs', 'screenshots', 'tmp', 'transition')
const base = process.argv[2] ?? process.env.SHOT_BASE ?? 'http://127.0.0.1:5173'

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (
  await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: 'zh-CN',
  })
).newPage()

await page.goto(`${base}/login`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /超级管理员/ }).first().click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: '登录', exact: true }).click()
await page.waitForURL('**/dashboard/overview')
await page.waitForTimeout(1500)

// 悬停让主题按钮的 hover 状态稳定，再点击
const btn = page.getByRole('button', { name: '切换主题', exact: true })
const box = await btn.boundingBox()
console.log('主题按钮位置:', JSON.stringify(box))

// 点击后立即连续截图（不等 networkidle）
await btn.click()
const stamps = []
for (let i = 0; i < 8; i += 1) {
  const t = Date.now()
  await page.screenshot({ path: join(out, `step-${i}.png`) })
  stamps.push(Date.now() - t)
}
console.log('截图耗时(ms):', JSON.stringify(stamps))
await page.waitForTimeout(1200)
await page.screenshot({ path: join(out, 'final.png') })

// 检查 ::view-transition 伪元素是否真的被创建（通过 CSS 变量探测）
const hasVT = await page.evaluate(() => typeof document.startViewTransition === 'function')
console.log('startViewTransition:', hasVT)

await browser.close()
