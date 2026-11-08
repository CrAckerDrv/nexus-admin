/// <reference lib="dom" />
/// <reference types="node" />

/**
 * 移动端 Slow-4G 下的资源瀑布（诊断 FCP 被什么拖住）
 *
 * 打开发送顺序、每条的下载耗时与主线程长任务，用来判断
 * 「是包太大」还是「是小 chunk 太多、RTT 把队列拖长」。
 *
 * 用法：node scripts/perf-waterfall.mjs [route=/dashboard/overview] [--dir=dist-lab]
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
// 可指定端口：同一台机器上并行对比两套产物时不会撞端口
const PORT = Number(process.argv.find((arg) => arg.startsWith('--port='))?.slice(7) ?? 4181)

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

const EDGE = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((path) => path && existsSync(path))

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const context = await browser.newContext({ viewport: { width: 412, height: 892 }, locale: 'zh-CN' })
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
  window.__tasks = []
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries())
      window.__tasks.push({ start: Math.round(entry.startTime), dur: Math.round(entry.duration) })
  }).observe({ type: 'longtask', buffered: true })
})
const page = await context.newPage()
const cdp = await context.newCDPSession(page)
await cdp.send('Network.enable')
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
await cdp.send('Network.emulateNetworkConditions', {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
})
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })

await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: 'load', timeout: 120_000 })
await page.waitForTimeout(4000)

const data = await page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0]
  const resources = performance.getEntriesByType('resource')
  const paints = performance.getEntriesByType('paint').map((p) => ({
    name: p.name,
    t: Math.round(p.startTime),
  }))
  const rows = resources
    .map((r) => ({
      name: new URL(r.name).pathname.split('/').pop(),
      start: Math.round(r.startTime),
      done: Math.round(r.responseEnd),
      size: r.transferSize ? Math.round(r.transferSize / 1024) : 0,
      type: r.initiatorType,
    }))
    .sort((a, b) => a.start - b.start)
  return {
    paints,
    tasks: window.__tasks,
    domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
    rows,
  }
})

console.log('paint:', data.paints, 'DCL:', data.domContentLoaded)
console.log('长任务:', data.tasks)
console.log(`\n共 ${data.rows.length} 个请求，按开始时间排序（前 40）：`)
for (const row of data.rows.slice(0, 40)) {
  console.log(
    `${String(row.start).padStart(5)} → ${String(row.done).padStart(5)}  ${String(row.size).padStart(4)}kB  ${row.type.padEnd(8)} ${row.name}`,
  )
}
const js = data.rows.filter((r) => r.name?.endsWith('.js'))
console.log(
  `\nJS 请求 ${js.length} 个，合计 ${js.reduce((a, b) => a + b.size, 0)} kB；` +
    `首个 JS 开始 ${js[0]?.start}ms，最后一个 JS 结束 ${Math.max(...js.map((r) => r.done))}ms`,
)

await browser.close()
server.close()
