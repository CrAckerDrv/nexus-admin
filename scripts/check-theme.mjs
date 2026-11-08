/**
 * 主题切换回归验证：切换深浅色后检查图表容器是否仍有 canvas 且尺寸不为 0
 *
 * 用法：node scripts/check-theme.mjs [baseUrl]
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const base = process.argv[2] ?? process.env.SHOT_BASE ?? 'http://127.0.0.1:5173'

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((path) => existsSync(path))

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`))

await page.goto(`${base}/login`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /超级管理员/ }).first().click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: '登录', exact: true }).click()
await page.waitForURL('**/dashboard/overview')
await page.waitForTimeout(1800)

mkdirSync(join(root, 'docs/screenshots/tmp'), { recursive: true })

async function measure(label) {
  const info = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('[role="img"][aria-label="数据图表"]'))
    return nodes.map((el) => {
      const rect = el.getBoundingClientRect()
      const canvas = el.querySelector('canvas')
      const ctx2d = canvas?.getContext('2d')
      let painted = 0
      if (ctx2d && canvas) {
        const { width, height } = canvas
        const data = ctx2d.getImageData(0, 0, Math.min(width, 600), Math.min(height, 400)).data
        for (let i = 3; i < data.length; i += 400) if (data[i] > 0) painted += 1
      }
      return {
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        hasCanvas: Boolean(canvas),
        canvasW: canvas?.width ?? 0,
        painted,
      }
    })
  })
  console.log(label, JSON.stringify(info))
  return info
}

await measure('light  ')
await page.screenshot({ path: join(root, 'docs/screenshots/tmp/before.png') })

// 点击顶栏主题切换按钮
const toggle = page.getByRole('button', { name: '切换主题' })
await toggle.click()
await page.waitForTimeout(2200)
await measure('after  ')
await page.screenshot({ path: join(root, 'docs/screenshots/tmp/after.png') })

await toggle.click()
await page.waitForTimeout(2200)
await measure('back   ')

await browser.close()
console.log(errors.length ? `控制台错误：${errors.slice(0, 5).join(' | ')}` : '无控制台错误')
