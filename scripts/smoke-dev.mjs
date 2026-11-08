import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'
import { seedAuth } from './_auth.mjs'

/**
 * 演示站冒烟：确认 dev server 真的能渲染，而不只是返回 HTML 外壳
 *
 * 与 `screenshot.mjs` 的区别：只跑 4 条代表性路由，2 分钟内出结论，
 * 用于「刚启动 dev server，先确认它活着」这种场景。
 *
 * 用法：node scripts/smoke-dev.mjs [base]
 */
const base = process.argv[2] ?? process.env.SHOT_BASE ?? 'http://127.0.0.1:5173'
const EDGE = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((path) => path && existsSync(path))
if (!EDGE) throw new Error('未找到 Edge / Chrome')

const ROUTES = [
  ['/dashboard/overview', '经营概览', false],
  ['/business/users', '用户管理', false],
  // 大屏是 standalone 页面：没有外壳，也就没有 #nexus-main，溢出要量文档本身
  ['/templates/command-center', '运营大屏', true],
  ['/components/overview', '组件橱窗', false],
]

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'zh-CN',
})
const page = await context.newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)))
page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message.slice(0, 160)}`))

// 登录页先确认外壳能跑
await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForTimeout(1500)
const loginOk = await page.evaluate(() => Boolean(document.querySelector('#email')))
console.log(`${loginOk ? '✓' : '✗'} 登录页渲染（表单存在）`)

await seedAuth(page, base)

let failed = 0
for (const [path, name, standalone] of ROUTES) {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForTimeout(1800)
  const probe = await page.evaluate(() => {
    const main = document.getElementById('nexus-main')
    const target = main ?? document.documentElement
    return {
      h1: document.querySelector('h1')?.textContent?.trim() ?? '',
      nodes: document.getElementsByTagName('*').length,
      canvases: document.querySelectorAll('canvas').length,
      // 有外壳时量内容区；独立页量整个文档
      overflow: target.scrollWidth - target.clientWidth,
    }
  })
  const ok = Boolean(probe.h1) && probe.nodes > 200 && probe.overflow <= 0
  if (!ok) failed += 1
  console.log(
    `${ok ? '✓' : '✗'} ${name.padEnd(6)}${standalone ? ' (独立页)' : ''} h1=${probe.h1
      .slice(0, 14)
      .padEnd(14)} DOM=${probe.nodes} canvas=${probe.canvases} 溢出=${probe.overflow}px`,
  )
}

await browser.close()

if (errors.length) {
  console.error(`\n控制台错误 ${errors.length} 条：`)
  errors.slice(0, 8).forEach((line) => console.error(' -', line))
}
const ok = !failed && errors.length === 0
console.log(`\n${ok ? '演示站正常 ✅' : '存在问题 ❌'} · ${base}`)
if (!ok) process.exitCode = 1
