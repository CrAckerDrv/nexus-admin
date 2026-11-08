import { chromium } from 'playwright-core'

const exe =
  process.env.BROWSER_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const base = process.argv[2] ?? 'http://127.0.0.1:5183'
const browser = await chromium.launch({ executablePath: exe, headless: true })
const errors = []

const widths = [320, 360, 390, 414, 640, 768, 1024, 1280, 1440, 1920]

for (const width of widths) {
  const context = await browser.newContext({
    viewport: { width, height: width < 640 ? 780 : 900 },
    deviceScaleFactor: 1,
    locale: 'zh-CN',
  })
  const page = await context.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${width}] ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`[${width}] [pageerror] ${e.message}`))

  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(600)
  await page
    .getByRole('button', { name: /超级管理员/ })
    .first()
    .click()
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await page.waitForURL('**/dashboard/overview', { timeout: 20000 })
  await page.waitForTimeout(900)

  // 顶栏是否横向溢出
  const overflow = await page.evaluate(() => {
    const header = document.querySelector('header')
    if (!header) return { ok: false, reason: 'no header' }
    return {
      ok: header.scrollWidth <= header.clientWidth + 1,
      scrollWidth: header.scrollWidth,
      clientWidth: header.clientWidth,
    }
  })

  // 打开助手浮层
  await page.getByRole('button', { name: 'AI 运营助手' }).first().click()
  await page.waitForTimeout(500)
  const panel = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]')
    if (!dialog) return { visible: false }
    const rect = dialog.getBoundingClientRect()
    return {
      visible: true,
      inViewport:
        rect.left >= -1 &&
        rect.top >= -1 &&
        rect.right <= window.innerWidth + 1 &&
        rect.bottom <= window.innerHeight + 1,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    }
  })

  await page.screenshot({ path: `docs/screenshots/tmp/asst-${width}.png` })
  console.log(
    `${width}px  header-overflow=${overflow.ok ? 'ok' : 'OVERFLOW'}  panel=${panel.visible ? `${panel.width}x${panel.height} inViewport=${panel.inViewport}` : 'MISSING'}`,
  )
  await context.close()
}

await browser.close()
if (errors.length) {
  console.error('控制台错误：')
  errors.slice(0, 15).forEach((e) => console.error('  -', e))
  process.exit(1)
}
console.log('无控制台错误')
