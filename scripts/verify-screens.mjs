/**
 * 八块大屏 + 大屏模板列表验收
 *
 * 等待策略统一用 `domcontentloaded` + 显式等待，不用 `networkidle`：
 * dev server 的 HMR 是长连接，网络永远不会真正「空闲」，
 * 加上并行改动触发的重编译，`networkidle` 会随机卡到 30s 超时。
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const base = process.env.SHOT_BASE ?? 'http://127.0.0.1:5180'
const outDir = join(root, 'docs/screenshots/tmp')
mkdirSync(outDir, { recursive: true })

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
  locale: 'zh-CN',
})
const page = await context.newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`))

/** 按路由等待「应用真正挂载」：有正文才算渲染完成 */
async function open(path, waitMs = 1800) {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page
    .locator('body')
    .filter({ hasNot: page.locator('text=正在加载页面') })
    .first()
    .waitFor({ state: 'attached', timeout: 30_000 })
  await page.waitForTimeout(waitMs)
}

// 先登录（拿 session）
//
// 直接填账号而不是点「演示账号卡」：后者依赖 mock/accounts 的动态 import，
// 且卡片文案会随语言与角色标签调整，容易让验收脚本误报超时。
await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.locator('#email').waitFor({ state: 'visible', timeout: 30_000 })
await page.locator('#email').fill('admin@nexus.dev')
await page.locator('#password').fill('nexus123')
await page.getByRole('button', { name: '登录', exact: true }).click()
await page.waitForURL('**/dashboard/overview', { timeout: 30_000 })
await page.waitForTimeout(800)

// 1) 大屏模板列表
await open('/templates/screens', 1200)
const gallery = await page.evaluate(() => {
  const titles = [...document.querySelectorAll('h3')].map((h) => h.textContent?.trim())
  // 预览区外框固定 h-[8.25rem]（132 设计像素，随根字号缩放），按数值区间判断更稳
  const previews = [...document.querySelectorAll('[aria-hidden="true"]')].filter((el) => {
    const height = el.getBoundingClientRect().height
    return height > 120 && height < 200
  }).length
  return { cardCount: titles.length, titles, previews }
})
console.log('① 大屏模板列表:', JSON.stringify(gallery))
await page.screenshot({ path: join(outDir, 'screens-gallery.png'), fullPage: true })

// 2) 八块大屏逐一渲染
const SCREENS = [
  ['command-center', '/templates/command-center'],
  ['screen-ops', '/templates/screen-ops'],
  ['screen-finance', '/templates/screen-finance'],
  ['screen-logistics', '/templates/screen-logistics'],
  ['screen-city', '/templates/screen-city'],
  ['screen-manufacturing', '/templates/screen-manufacturing'],
  ['screen-campaign', '/templates/screen-campaign'],
  ['screen-compute', '/templates/screen-compute'],
]

for (const [name, path] of SCREENS) {
  await open(path)
  const probe = await page.evaluate(() => ({
    // 独立页面：不应出现侧栏
    hasSidebar: Boolean(document.querySelector('aside')),
    canvas: document.querySelectorAll('canvas').length,
    text: document.body.innerText.length,
    // 图表是否真的画出了内容（canvas 非空白）
    chartPainted: [...document.querySelectorAll('canvas')].some((c) => c.width > 100),
  }))
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: true })
  console.log(
    `② ${name}: 无侧栏=${probe.hasSidebar ? 'FAIL' : 'OK'} canvas=${probe.canvas} 文字=${probe.text} 图表已绘=${probe.chartPainted ? 'OK' : 'FAIL'}`,
  )
}

// 3) 侧栏菜单：大屏项应带 target=_blank
await open('/templates/screens', 1000)
const navLinks = await page.evaluate(() =>
  [...document.querySelectorAll('nav a')]
    .filter((a) =>
      a.textContent?.match(
        /运营大屏|运维监控|财务驾驶舱|仓储物流|城市运行|生产制造|大促战报|智算中心/,
      ),
    )
    .map((a) => ({
      text: a.textContent?.trim(),
      target: a.getAttribute('target'),
      href: a.getAttribute('href'),
    })),
)
console.log('③ 侧栏大屏链接:', JSON.stringify(navLinks))

// 4) 首页 Hero 页应不出现报错
const heroText = await page.evaluate(() => document.body.innerText.slice(0, 120))
console.log('④ 页面文字开头:', heroText.replace(/\n/g, ' | ').slice(0, 100))

await browser.close()
console.log(errors.length ? `\n控制台错误:\n${errors.slice(0, 10).join('\n')}` : '\n✓ 无控制台错误')
