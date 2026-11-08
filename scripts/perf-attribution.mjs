/// <reference lib="dom" />
/// <reference types="node" />

/**
 * 归因实验：移动端慢，到底是「网络 RTT」还是「CPU 求值」的锅
 *
 * 四种组合跑同一页（默认 /dashboard/overview）：
 *   A 网络限速 + 4× CPU  → 当前线上复现档
 *   B 网络限速 + 1× CPU  → 只保留网络瓶颈
 *   C 无网络限速 + 4× CPU → 只保留 CPU 瓶颈
 *   D 无网络限速 + 1× CPU → 理想下限
 *
 * 判读：如果 C 的 FCP 与 A 接近，说明主线程是瓶颈（要减模块/减渲染）；
 * 如果 B 的 FCP 与 A 接近，说明是 RTT/请求数（要合并 chunk / 上 HTTP/2）。
 *
 * 用法：node scripts/perf-attribution.mjs [route] [--dir=dist-demo]
 */
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { gzipSync } from 'node:zlib'

const dirArg = process.argv.find((arg) => arg.startsWith('--dir='))?.slice(6) ?? 'dist-demo'
const DIST = join(process.cwd(), 'apps/admin', dirArg)
if (!existsSync(join(DIST, 'index.html'))) throw new Error(`先构建 ${dirArg}`)
const route = process.argv.find((arg) => arg.startsWith('/')) ?? '/dashboard/overview'
const PORT = Number(process.argv.find((arg) => arg.startsWith('--port='))?.slice(7) ?? 4184)

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

const server = createServer((req, res) => {
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

const EDGE = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((path) => path && existsSync(path))

const browser = await chromium.launch({ executablePath: EDGE, headless: true })

const CASES = [
  { id: 'A', label: '网络限速 + 4×CPU', net: true, cpu: 4 },
  { id: 'B', label: '网络限速 + 1×CPU', net: true, cpu: 1 },
  { id: 'C', label: '无限速 + 4×CPU', net: false, cpu: 4 },
  { id: 'D', label: '无限速 + 1×CPU', net: false, cpu: 1 },
]

const rows = []
for (const item of CASES) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 892 },
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
            name: 'A',
            email: 'a@b.c',
            role: 'super_admin',
            permissions: ['*'],
          },
          status: 'authenticated',
        },
        version: 0,
      }),
    )
    window.__marks = { lcp: 0, long: [] }
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const t = entry.renderTime || entry.loadTime || entry.startTime
          if (t > window.__marks.lcp) window.__marks.lcp = t
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true })
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          window.__marks.long.push({
            start: Math.round(entry.startTime),
            dur: Math.round(entry.duration),
          })
      }).observe({ type: 'longtask', buffered: true })
    } catch {
      /* ignore */
    }
  })

  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.clearBrowserCache')
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: item.cpu })
  if (item.net) {
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    })
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  }

  await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: 'load', timeout: 120_000 })
  await page.waitForTimeout(4000)

  const data = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const paints = Object.fromEntries(
      performance.getEntriesByType('paint').map((p) => [p.name, Math.round(p.startTime)]),
    )
    const resources = performance.getEntriesByType('resource')
    const js = resources.filter((r) => r.name.endsWith('.js'))
    const sum = (list, key) => list.reduce((acc, r) => acc + (r[key] || 0), 0)
    return {
      fp: paints['first-paint'] ?? 0,
      fcp: paints['first-contentful-paint'] ?? 0,
      lcp: Math.round(window.__marks.lcp),
      dcl: Math.round(nav.domContentLoadedEventEnd),
      long: window.__marks.long,
      jsCount: js.length,
      jsKB: Math.round(sum(js, 'transferSize') / 1024),
      totalKB: Math.round(sum(resources, 'transferSize') / 1024),
      nodes: document.getElementsByTagName('*').length,
    }
  })

  const totalLong = data.long.reduce((acc, t) => acc + Math.max(0, t.dur - 50), 0)
  rows.push({ ...item, ...data, tbt: totalLong })
  console.log(
    `${item.id} ${item.label.padEnd(18)} FP ${String(data.fp).padStart(5)}  FCP ${String(
      data.fcp,
    ).padStart(5)}  LCP ${String(data.lcp).padStart(5)}  DCL ${String(data.dcl).padStart(
      5,
    )}  TBT ${String(totalLong).padStart(5)}  JS ${data.jsCount} 个 / ${data.jsKB} kB`,
  )
  await context.close()
}

await browser.close()
server.close()

console.log('\n判读（以 D「无限速 + 1×CPU」为理想下限）：')
const [A, B, C, D] = rows
/**
 * 三个偏差分别来自哪里：
 * - CPU 单独（C−D）：只降 CPU 频 4 倍、网络不限速时的 FCP 增量
 * - 网络单独（B−D）：只限速网络、CPU 不降频时的 FCP 增量
 * - 交互项（A−B−C+D）：两者叠加时额外劣化（渲染被 CPU 拖慢 → 请求发得更晚 → 更久）
 *
 * 注意：不能用「A−B 与 A−C 谁大」来判断主因 —— 那样比较的是两种「另一项被拿掉」的世界，
 * 与「谁贡献了多少增量」不是同一个问题（第一版脚本正是这样写反的）。
 */
const cpuOnly = C.fcp - D.fcp
const netOnly = B.fcp - D.fcp
const interaction = A.fcp - B.fcp - C.fcp + D.fcp
const total = A.fcp - D.fcp
const pct = (value) => `${Math.round((value / total) * 100)}%`
console.log(
  `  CPU 单独   ${String(cpuOnly).padStart(5)}ms（${pct(cpuOnly)}）  网络单独 ${String(
    netOnly,
  ).padStart(
    5,
  )}ms（${pct(netOnly)}）  交互 ${String(interaction).padStart(5)}ms（${pct(interaction)}）  合计 ${total}ms`,
)
console.log(
  netOnly > cpuOnly
    ? `  → FCP 主因是网络 / 请求数（${pct(netOnly)}）；CPU 只占 ${pct(cpuOnly)}`
    : `  → FCP 主因是 CPU / 模块求值（${pct(cpuOnly)}）；网络只占 ${pct(netOnly)}`,
)
const tbtCpu = C.tbt - D.tbt
const tbtNet = B.tbt - D.tbt
console.log(
  `  TBT：CPU 单独 ${tbtCpu}ms，网络单独 ${tbtNet}ms → ${
    tbtCpu > tbtNet ? '主线程求值主导卡顿' : '网络主导卡顿'
  }`,
)
