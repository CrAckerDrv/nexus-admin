import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { gzipSync } from 'node:zlib'

/**
 * 路由切换成本测量
 *
 * 「点一下菜单要多久才看到新页面」是后台模板最被在意的手感指标，
 * 但它既不属于 CWV 也不属于 TBT —— 必须单独量。
 *
 * 这里对每次切换量三个数：
 * - click→首帧：点击到新页面第一帧（含 chunk 下载，逛 intent 预加载命中时更短）
 * - 长任务：切换期间主线程是否被阻塞（页面入场动画的 filter: blur 就在这里）
 * - 帧数：切换后 600ms 内画了多少帧（越低说明主线程越忙）
 */
const DIST = join(process.cwd(), 'apps/admin/dist-demo')
const PORT = 4188

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
}

const server = createServer((req, res) => {
  const raw = decodeURIComponent((req.url ?? '/').split('?')[0])
  let file = join(DIST, normalize(raw).replace(/^([/\\])+/, ''))
  if (!file.startsWith(DIST) || !existsSync(file)) file = join(DIST, 'index.html')
  const type = MIME[extname(file)] ?? 'application/octet-stream'
  const body = readFileSync(file)
  const compressible = /^(text\/|application\/(javascript|json))/.test(type)
  res.writeHead(200, {
    'content-type': type,
    'cache-control': 'no-store',
    ...(compressible ? { 'content-encoding': 'gzip' } : {}),
  })
  res.end(compressible ? gzipSync(body, { level: 9 }) : body)
})
await new Promise((done) => server.listen(PORT, '127.0.0.1', done))

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) =>
  existsSync(p),
)
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'zh-CN',
})
await context.addInitScript(() => {
  localStorage.setItem(
    'nexus-auth',
    JSON.stringify({
      state: {
        token: 'demo_token_u_1001',
        user: { id: 'u_1001', name: 'A', email: 'a@b.c', role: 'super_admin', permissions: ['*'] },
        status: 'authenticated',
      },
      version: 0,
    }),
  )
  localStorage.setItem('nexus-ui-prefs', JSON.stringify({ state: { motion: 'full' }, version: 6 }))
  window.__rt = { frames: 0, long: [] }
  const loop = () => {
    window.__rt.frames += 1
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries())
      window.__rt.long.push({ start: Math.round(entry.startTime), dur: Math.round(entry.duration) })
  }).observe({ type: 'longtask', buffered: false })
})

const page = await context.newPage()
await page.goto(`http://127.0.0.1:${PORT}/dashboard/overview`, {
  waitUntil: 'load',
  timeout: 60_000,
})
await page.waitForTimeout(2500)

const cases = [
  ['经营概览 → 用户管理', '/business/users'],
  ['用户管理 → 数据分析', '/dashboard/analytics'],
  ['数据分析 → 组件橱窗', '/components/overview'],
  ['组件橱窗 → 系统设置', '/system/settings'],
  ['系统设置 → 经营概览', '/dashboard/overview'],
]

console.log('路由切换（motion=full，含 .n-page-enter 的 filter: blur 入场）\n')
for (const [label, path] of cases) {
  /**
   * 用真实点击而不是合成事件
   *
   * 合成 `link.click()` 会绕过 TanStack Router 的 Link 组件 —— 它自己拦截点击做 SPA 跳转，
   * 绕过之后浏览器会走整页导航（evaluate 上下文直接被销毁，脚本报
   * "Execution context was destroyed"）。这里直接点侧栏/命令面板里的真实链接。
   */
  const link = page.locator(`a[href="${path}"]`).first()
  if ((await link.count()) === 0) {
    console.log(`${label.padEnd(22)} 跳过（页面内无 href="${path}" 的链接）`)
    continue
  }

  await page.evaluate(() => {
    window.__rt.frames = 0
    window.__rt.long = []
    window.__rt.t0 = performance.now()
  })

  await link.click({ noWaitForReply: true })
  await page.waitForURL(`**${path}`, { timeout: 15_000 })
  const result = await page.evaluate(async (target) => {
    const t0 = window.__rt.t0
    const landed = performance.now()
    await new Promise((done) => requestAnimationFrame(() => done(null)))
    await new Promise((done) => requestAnimationFrame(() => done(null)))
    const firstPaint = performance.now()
    await new Promise((done) => setTimeout(done, 600))
    return {
      urlMs: Math.round(landed - t0),
      firstPaintMs: Math.round(firstPaint - t0),
      frames: window.__rt.frames,
      long: window.__rt.long.slice(),
      path: location.pathname,
    }
  }, path)

  const longest = result.long.length ? Math.max(...result.long.map((t) => t.dur)) : 0
  console.log(
    `${label.padEnd(22)} URL ${String(result.urlMs).padStart(4)}ms  首帧 ${String(
      result.firstPaintMs,
    ).padStart(4)}ms  600ms 内 ${String(result.frames).padStart(3)} 帧  最长任务 ${String(
      longest,
    ).padStart(4)}ms  长任务 ${result.long.length} 次  → ${result.path}`,
  )
  await page.waitForTimeout(400)
}

await browser.close()
server.close()
