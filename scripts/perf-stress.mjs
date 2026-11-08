/// <reference lib="dom" />
/// <reference types="node" />

/**
 * 交互压测：滚动 / 拖动 / 高频刷新下的帧率与长任务
 *
 * 与 `perf-audit.mjs` 的分工：
 * - perf-audit 量「打开一页要多久」（FCP / LCP / TBT）
 * - 这个脚本量「打开之后好不好用」——正是后台模板真正被诟病的地方：
 *   万行表格滚动卡顿、画布拖动掉帧、大屏每 2.4s 刷一次数字时整页抖一下。
 *
 * 帧率口径：注入一个 rAF 计数器（每帧 +1），压测结束时用
 * `帧数 / 时长` 得到实际 fps；同时用 PerformanceObserver 收集 longtask，
 * 记录压测窗口内最长的一次（>50ms 即卡顿，>200ms 即明显掉帧）。
 *
 * 用法：node scripts/perf-stress.mjs [--only=tables,canvas,campaign] [--base=...]
 */
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice(7) ?? ''
const OUT = resolve(root, 'docs/perf/stress-report.json')

/**
 * 默认跑生产构建产物（静态服务 + gzip），而不是 dev server
 *
 * dev server 的源码逐个请求 + HMR 运行时会凭空制造抖动，
 * 拿它测帧率既不公平也不可复现。要用 dev server 时显式传 `--base=...`。
 */
const DIST = join(root, 'apps/admin/dist-demo')
const useDist =
  !process.argv.some((arg) => arg.startsWith('--base=')) && existsSync(join(DIST, 'index.html'))
const PORT = 4183
let base =
  process.argv.find((arg) => arg.startsWith('--base='))?.slice(7) ?? 'http://127.0.0.1:5173'
let server = null

if (useDist) {
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.webmanifest': 'application/manifest+json',
  }
  server = createServer((req, res) => {
    const raw = decodeURIComponent((req.url ?? '/').split('?')[0])
    let file = join(DIST, normalize(raw).replace(/^([/\\])+/, ''))
    if (!file.startsWith(DIST) || !existsSync(file)) file = join(DIST, 'index.html')
    const type = MIME[extname(file)] ?? 'application/octet-stream'
    const body = readFileSync(file)
    const compressible = /^(text\/|application\/(javascript|json|manifest))/.test(type)
    res.writeHead(200, {
      'content-type': type,
      'cache-control': 'no-store',
      ...(compressible ? { 'content-encoding': 'gzip' } : {}),
    })
    res.end(compressible ? gzipSync(body, { level: 9 }) : body)
  })
  await new Promise((done) => server.listen(PORT, '127.0.0.1', done))
  base = `http://127.0.0.1:${PORT}`
  console.log(`静态服务：${base}（dist-demo，gzip）`)
}

const EDGE = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
]
  .filter(Boolean)
  .find((path) => existsSync(path))
if (!EDGE) throw new Error('未找到 Edge / Chrome，可设置 BROWSER_PATH')

const browser = await chromium.launch({ executablePath: EDGE, headless: true })

const results = []
const record = (row) => {
  results.push(row)
  console.log(
    `${row.name.padEnd(18)} fps ${String(row.fps).padStart(5)}  ` +
      `帧 ${String(row.frames).padStart(4)}  ` +
      `最长任务 ${String(row.longestMs).padStart(5)}ms  ` +
      `长任务 ${String(row.longTaskCount).padStart(3)} 次  ` +
      `耗时 ${String(row.durationMs).padStart(5)}ms`,
  )
}

/** 注入帧计数器 + 长任务收集器（在页面脚本执行前） */
const probeScript = () => {
  window.__probe = { frames: 0, tasks: [], running: false }
  const loop = () => {
    if (window.__probe.running) window.__probe.frames += 1
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (window.__probe.running) window.__probe.tasks.push(Math.round(entry.duration))
    }
  }).observe({ type: 'longtask', buffered: false })
}

async function newPage(viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({
    viewport,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  })
  await context.addInitScript(() => {
    localStorage.setItem(
      'nexus-auth',
      JSON.stringify({
        state: {
          token: 'demo_token_u_1001',
          user: {
            id: 'u_1001',
            name: '陈彦之',
            email: 'admin@nexus.dev',
            role: 'super_admin',
            roleName: '超级管理员',
            department: '平台技术部',
            permissions: ['*'],
          },
          status: 'authenticated',
        },
        version: 0,
      }),
    )
  })
  await context.addInitScript(probeScript)
  const page = await context.newPage()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`))
  return { context, page, errors }
}

/** 开始计时：清空计数 */
const start = (page) =>
  page.evaluate(() => {
    window.__probe.frames = 0
    window.__probe.tasks = []
    window.__probe.running = true
  })

/** 结束计时：返回 fps / 帧数 / 长任务 */
const stop = async (page, startedAt) => {
  const data = await page.evaluate(() => {
    window.__probe.running = false
    const tasks = window.__probe.tasks.slice()
    return {
      frames: window.__probe.frames,
      longTaskCount: tasks.length,
      longestMs: tasks.length ? Math.max(...tasks) : 0,
      totalTaskMs: tasks.reduce((acc, item) => acc + item, 0),
    }
  })
  const durationMs = Date.now() - startedAt
  const fps = Math.round((data.frames / durationMs) * 1000)
  return { ...data, durationMs, fps }
}

/* ------------------------------ ① 万行虚拟表格 ------------------------------ */

if (!only || only.includes('tables')) {
  const { context, page, errors } = await newPage()
  await page.goto(`${base}/components/tables`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForTimeout(2200)

  // 切到「虚拟滚动」页签
  await page
    .getByRole('tab', { name: '虚拟滚动' })
    .click()
    .catch(() => {})
  await page.waitForTimeout(900)

  const scroller = page
    .locator('div')
    .filter({ has: page.locator('table') })
    .filter({ has: page.locator('tbody tr') })
    .last()

  const started = Date.now()
  await start(page)
  // 连续下滚 40 次，每次 260px：模拟「一路拖到底找一条日志」
  await page.evaluate(async () => {
    const node = [...document.querySelectorAll('div')].find(
      (el) => el.scrollHeight > el.clientHeight + 200 && el.querySelector('tbody tr'),
    )
    if (!node) return
    for (let index = 0; index < 40; index += 1) {
      node.scrollTop += 260
      await new Promise((done) => requestAnimationFrame(() => done(null)))
    }
  })
  const tableScroll = await stop(page, started)
  record({
    name: '万行表格滚动',
    group: 'table',
    ...tableScroll,
    rows: await page.evaluate(() => document.querySelectorAll('tbody tr').length),
    errors: errors.length,
  })

  // 排序切换（点一次表头，触发全量重排）
  const startedSort = Date.now()
  await start(page)
  await page.evaluate(() => {
    const th = [...document.querySelectorAll('thead th')].find(
      (node) => node.textContent?.trim().length,
    )
    th?.click()
  })
  await page.waitForTimeout(1200)
  const sort = await stop(page, startedSort)
  record({ name: '表格排序重排', group: 'table', ...sort, errors: errors.length })
  void scroller
  await context.close()
}

/* ------------------------------ ② 无限画布拖动 / 缩放 ------------------------------ */

if (!only || only.includes('canvas')) {
  const { context, page, errors } = await newPage({ width: 1600, height: 1000 })
  await page.goto(`${base}/templates/infinite-canvas`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  })
  await page.waitForTimeout(2600)

  const box = await page.evaluate(() => {
    const el =
      document.querySelector('[data-canvas-root]') ??
      document.querySelector('main') ??
      document.body
    const rect = el.getBoundingClientRect()
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  })

  // 拖动：按下后连续移动 90 次
  const started = Date.now()
  await start(page)
  await page.mouse.move(box.x, box.y)
  await page.mouse.down()
  await page.evaluate(async ({ x, y }) => {
    for (let index = 0; index < 90; index += 1) {
      const angle = index / 9
      const node = document.elementFromPoint(x, y)
      node?.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: x + Math.cos(angle) * (index * 1.6),
          clientY: y + Math.sin(angle) * (index * 1.2),
          pointerId: 1,
          pointerType: 'mouse',
          buttons: 1,
        }),
      )
      await new Promise((done) => requestAnimationFrame(() => done(null)))
    }
  }, box)
  await page.mouse.up()
  const drag = await stop(page, started)
  record({ name: '画布拖动 90 帧', group: 'canvas', ...drag, errors: errors.length })

  // 滚轮缩放：25 次
  const startedZoom = Date.now()
  await start(page)
  await page.mouse.move(box.x, box.y)
  for (let index = 0; index < 25; index += 1) {
    await page.mouse.wheel(0, index < 12 ? -120 : 120)
    await page.waitForTimeout(16)
  }
  const zoom = await stop(page, startedZoom)
  record({ name: '画布滚轮缩放', group: 'canvas', ...zoom, errors: errors.length })
  await context.close()
}

/* ------------------------------ ③ 大屏数字高频刷新 ------------------------------ */

if (!only || only.includes('campaign')) {
  const { context, page, errors } = await newPage()
  await page.goto(`${base}/templates/screen-campaign`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  })
  await page.waitForTimeout(2400)

  // GMV 每 2.4s 跳一次，观察 12s 内的帧率与长任务
  const started = Date.now()
  await start(page)
  await page.waitForTimeout(12_000)
  const live = await stop(page, started)
  record({ name: '战报屏 12s（GMV 跳 5 次）', group: 'screen', ...live, errors: errors.length })

  const dom = await page.evaluate(() => ({
    nodes: document.getElementsByTagName('*').length,
    numbers: document.querySelectorAll('[data-motion-number]').length,
    canvases: document.querySelectorAll('canvas').length,
  }))
  record({
    name: '战报屏 DOM 规模',
    group: 'screen',
    fps: 0,
    frames: 0,
    longestMs: 0,
    longTaskCount: 0,
    durationMs: 0,
    ...dom,
    errors: errors.length,
  })
  await context.close()
}

/* ------------------------------ ④ 工作台首屏入场动画（60 帧预算） ------------------------------ */

if (!only || only.includes('overview')) {
  const { context, page, errors } = await newPage()
  const started = Date.now()
  await page.goto(`${base}/dashboard/overview`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.evaluate(() => {
    // 页面脚本已执行完，重新开一轮计数
    window.__probe.frames = 0
    window.__probe.tasks = []
    window.__probe.running = true
  })
  await page.waitForTimeout(2200)
  const boot = await stop(page, started)
  record({ name: '工作台首屏 2.2s', group: 'overview', ...boot, errors: errors.length })
  await context.close()
}

await browser.close()

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(
  OUT,
  JSON.stringify({ generatedAt: new Date().toISOString(), base, results }, null, 2),
  'utf8',
)
console.log(`\n写入 ${OUT}`)

/* ------------------------------ 判定 ------------------------------ */

/**
 * 判据：后台模板的常见问题是「滚动掉到 30fps 以下」与「单次长任务超过 200ms」
 * （React 官方对「可感知卡顿」的经验阈值是 100ms；200ms 即一眼能看出顿）。
 */
console.log('\n口径：fps ≥ 55 流畅 / 45~55 可用 / < 45 卡；最长任务 > 200ms 视为明显掉帧')
for (const row of results) {
  if (row.group === 'screen' && row.fps === 0) continue
  const level = row.fps >= 55 ? '流畅' : row.fps >= 45 ? '可用' : '卡'
  console.log(`${row.name}: ${level}${row.longestMs > 200 ? ' · 有明显长任务' : ''}`)
}
