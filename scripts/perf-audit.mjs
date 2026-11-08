/// <reference lib="dom" />
/// <reference types="node" />

/**
 * 生产构建性能审计
 *
 * 与 `screenshot.mjs` / `verify-*.mjs` 的区别：
 * 那些脚本跑的是 dev server（Vite 未打包、源码逐个请求、含 HMR 运行时），
 * 拿它们的耗时去和开源项目比是**没有意义**的。这里跑 `vite build` 的产物，
 * 用静态服务器 + CDP 采集 Core Web Vitals，才是可对外的数字。
 *
 * 用法：
 *   node scripts/perf-audit.mjs                 # 默认 dist-demo（含 Mock，可完整渲染）
 *   node scripts/perf-audit.mjs --dir=dist      # 纯生产包（无 Mock，需真实后端）
 *   node scripts/perf-audit.mjs --only=desktop  # 只跑桌面档
 *
 * 两个档位对齐 Lighthouse 的预设：
 * - desktop：无网络限速、无 CPU 降频（rtt 40ms / 10Mbps 视作本地）
 * - mobile ：Slow 4G（1.6Mbps / 750kbps / 150ms RTT）+ 4× CPU 降频
 *
 * 采集口径：
 * - FCP / LCP 取 PerformanceObserver 的最终值（LCP 取最后一个候选）
 * - CLS 只累计 `hadRecentInput === false` 的布局偏移
 * - TBT = Σ(longtask.duration − 50)，只统 FCP 之后的长任务（与 Lighthouse 口径一致）
 * - 传输体积取 PerformanceResourceTiming 的 transferSize（压缩后 = 线上真实流量）
 */
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { extname, join, normalize, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const arg = (name, fallback) => {
  const hit = process.argv.find((item) => item.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const DIST = resolve(root, 'apps/admin', arg('dir', 'dist-demo'))
const PORT = Number(arg('port', '4179'))
const ONLY = arg('only', '')
const OUT = resolve(root, arg('out', 'docs/perf/perf-report.json'))
const CACHE_PROFILE = arg('cache', 'cold')
const ROUTE_FILTER = arg('routes', '')

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`找不到构建产物：${DIST}\n先运行： cd apps/admin && pnpm build`)
  process.exit(1)
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

/* ------------------------------ 静态服务器 ------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

/**
 * 真实 gzip 体积
 *
 * 前面的 transferSize 走的是 Node 静态服务器（没开压缩），只能当"解码后"看；
 * 与开源项目对比必须用 gzip 后的数字（antd/vben 的公开数字都是 gzip）。
 * 这里在服务和 measure 之间做一次：按需 gzip 并缓存，同时把体积表打进报告。
 */
const gzipCache = new Map()
function gzipKB(filePath) {
  if (!gzipCache.has(filePath)) {
    const raw = readFileSync(filePath)
    gzipCache.set(filePath, { raw: raw.length, gz: gzipSync(raw, { level: 9 }).length })
  }
  const { raw, gz } = gzipCache.get(filePath)
  return { rawKB: Number((raw / 1024).toFixed(1)), gzipKB: Number((gz / 1024).toFixed(1)) }
}

/** 构建产物逐文件体积表（gzip）：供报告与页面内查表使用 */
const SIZE_TABLE = {}
let TOTAL_ASSETS_KB = { raw: 0, gzip: 0 }
{
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else {
        const size = gzipKB(full)
        SIZE_TABLE[entry.name] = size
        TOTAL_ASSETS_KB = {
          raw: TOTAL_ASSETS_KB.raw + size.rawKB,
          gzip: TOTAL_ASSETS_KB.gzip + size.gzipKB,
        }
      }
    }
  }
  walk(join(DIST, 'assets'))
  const indexSize = gzipKB(join(DIST, 'index.html'))
  SIZE_TABLE['index.html'] = indexSize
}

const server = createServer((req, res) => {
  const raw = decodeURIComponent((req.url ?? '/').split('?')[0])
  let filePath = join(DIST, normalize(raw).replace(/^([/\\])+/, ''))
  if (!filePath.startsWith(DIST) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(DIST, 'index.html') // SPA 回退
  }
  const type = MIME[extname(filePath)] ?? 'application/octet-stream'
  // 冷缓存档：显式 no-store，保证每次都真的重新下载
  const cache = CACHE_PROFILE === 'cold' ? 'no-store' : 'public, max-age=31536000, immutable'
  const compressible = /^(text\/|application\/(javascript|json|manifest))/.test(type)
  const body = readFileSync(filePath)
  if (compressible) {
    res.writeHead(200, {
      'content-type': type,
      'cache-control': cache,
      'content-encoding': 'gzip',
      vary: 'accept-encoding',
    })
    res.end(gzipSync(body, { level: 9 }))
    return
  }
  res.writeHead(200, {
    'content-type': type,
    'cache-control': cache,
    'content-length': body.length,
  })
  res.end(body)
})

await new Promise((done) => server.listen(PORT, '127.0.0.1', done))
const BASE = `http://127.0.0.1:${PORT}`

/* ------------------------------ 采集注入 ------------------------------ */

const ADMIN = {
  id: 'u_1001',
  name: '陈彦之',
  email: 'admin@nexus.dev',
  role: 'super_admin',
  roleName: '超级管理员',
  department: '平台技术部',
  permissions: ['*'],
}

function initScript() {
  const perf = {
    lcp: 0,
    lcpEl: '',
    cls: 0,
    fcp: 0,
    longTasks: [],
    shifts: 0,
  }
  window.__perf = perf

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const t = entry.renderTime || entry.loadTime || entry.startTime
        if (t > perf.lcp) {
          perf.lcp = t
          const el = entry.element
          perf.lcpEl = el
            ? `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${
                typeof el.className === 'string' && el.className
                  ? `.${el.className.split(/\s+/).slice(0, 2).join('.')}`
                  : ''
              }`
            : ''
        }
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  } catch {
    /* 老内核忽略 */
  }

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          perf.cls += entry.value
          perf.shifts += 1
        }
      }
    }).observe({ type: 'layout-shift', buffered: true })
  } catch {
    /* ignore */
  }

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        perf.longTasks.push({
          start: Math.round(entry.startTime),
          duration: Math.round(entry.duration),
        })
      }
    }).observe({ type: 'longtask', buffered: true })
  } catch {
    /* ignore */
  }

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') perf.fcp = entry.startTime
      }
    }).observe({ type: 'paint', buffered: true })
  } catch {
    /* ignore */
  }
}

function seed() {
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
}

/* ------------------------------ 档位 ------------------------------ */

const PROFILES = {
  desktop: {
    label: '桌面（本地、无 CPU 降频）',
    cpu: 1,
    network: { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 },
  },
  mobile: {
    label: '移动（Slow 4G + 4× CPU）',
    cpu: 4,
    network: {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    },
  },
}

const ROUTES = [
  { id: 'login', path: '/login', name: '登录页', note: '首屏（未登录）', anonymous: true },
  { id: 'overview', path: '/dashboard/overview', name: '经营概览', note: 'KPI + 图表' },
  { id: 'analytics', path: '/dashboard/analytics', name: '数据分析', note: '多图表' },
  { id: 'users', path: '/business/users', name: '用户管理', note: '虚拟表格' },
  { id: 'performance', path: '/dashboard/performance', name: '性能监控', note: '重页面 52.9 kB' },
  { id: 'gallery', path: '/components/overview', name: '组件橱窗', note: '最重页面 170 kB' },
  { id: 'command', path: '/templates/command-center', name: '运营大屏', note: '动效 + 图表' },
  { id: 'canvas', path: '/templates/infinite-canvas', name: '无限画布', note: '自研画布' },
]

const browser = await chromium.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--force-device-scale-factor=1', '--disable-lcd-text'],
})

async function measure(route, profileKey) {
  const profile = PROFILES[profileKey]
  const context = await browser.newContext({
    viewport: profileKey === 'mobile' ? { width: 412, height: 892 } : { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    isMobile: false,
  })
  await context.addInitScript(initScript)
  // gzip 体积表：由 Node 侧预先算好，注入后页面里按文件名查（跨口径可比）
  await context.addInitScript(
    ({ table }) => {
      window.__sizeTable = table
    },
    { table: SIZE_TABLE },
  )
  if (!route.anonymous) await context.addInitScript(seed)

  const page = await context.newPage()
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`))

  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.clearBrowserCache')
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu })
  if (profile.network.latency > 0) {
    await cdp.send('Network.emulateNetworkConditions', profile.network)
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  }

  const started = Date.now()
  const sentBytes = { js: 0, css: 0, total: 0 }
  page.on('response', async (response) => {
    try {
      const headers = response.headers()
      const length = Number(headers['content-length'] ?? 0)
      const type = headers['content-type'] ?? ''
      const url = response.url()
      sentBytes.total += length
      if (/javascript/.test(type) || url.endsWith('.js')) sentBytes.js += length
      if (/text\/css/.test(type)) sentBytes.css += length
    } catch {
      /* 忽略已销毁的响应 */
    }
  })
  await page.goto(`${BASE}${route.path}`, { waitUntil: 'load', timeout: 120_000 })
  // 等 LCP 稳定：CWV 采样窗口取 5s（Lighthouse 的 TTI 窗口类似量级）
  await page.waitForTimeout(5000)

  const data = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const resources = performance.getEntriesByType('resource')
    const js = resources.filter((r) => r.name.endsWith('.js') || r.initiatorType === 'script')
    const css = resources.filter((r) => r.name.endsWith('.css'))
    const sum = (list, key) => list.reduce((acc, item) => acc + (item[key] || 0), 0)
    const perf = window.__perf ?? { lcp: 0, cls: 0, fcp: 0, longTasks: [] }
    const fcp = perf.fcp || 0
    const afterFcp = perf.longTasks.filter((t) => t.start + t.duration > fcp)
    const tbt = afterFcp.reduce((acc, t) => acc + Math.max(0, t.duration - 50), 0)
    const memory = performance.memory
    return {
      fcp: Math.round(fcp),
      lcp: Math.round(perf.lcp),
      lcpEl: perf.lcpEl,
      cls: Number(perf.cls.toFixed(4)),
      shifts: perf.shifts,
      tbt: Math.round(tbt),
      longTaskCount: afterFcp.length,
      longestTask: afterFcp.length ? Math.max(...afterFcp.map((t) => t.duration)) : 0,
      domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : 0,
      loadEvent: nav ? Math.round(nav.loadEventEnd) : 0,
      responseEnd: nav ? Math.round(nav.responseEnd) : 0,
      transferKB: Math.round((sum(resources, 'transferSize') + (nav?.transferSize ?? 0)) / 1024),
      decodedKB: Math.round(
        (sum(resources, 'decodedBodySize') + (nav?.decodedBodySize ?? 0)) / 1024,
      ),
      jsTransferKB: Math.round(sum(js, 'transferSize') / 1024),
      jsDecodedKB: Math.round(sum(js, 'decodedBodySize') / 1024),
      jsCount: js.length,
      cssTransferKB: Math.round(sum(css, 'transferSize') / 1024),
      // gzip 后体积（与开源项目公开数字同口径）：按资源真实文件大小重算
      jsGzipKB: Math.round(
        js.reduce((acc, item) => {
          const name = new URL(item.name).pathname.split('/').pop() ?? ''
          const size = window.__sizeTable?.[name]?.gzipKB
          return acc + (size ?? 0)
        }, 0),
      ),
      cssGzipKB: Math.round(
        css.reduce((acc, item) => {
          const name = new URL(item.name).pathname.split('/').pop() ?? ''
          const size = window.__sizeTable?.[name]?.gzipKB
          return acc + (size ?? 0)
        }, 0),
      ),
      nodes: document.getElementsByTagName('*').length,
      canvases: document.querySelectorAll('canvas').length,
      heapMB: memory ? Number((memory.usedJSHeapSize / 1048576).toFixed(1)) : null,
      motion: document.documentElement.dataset.motion ?? 'system',
      riseNodes: document.querySelectorAll('.n-rise').length,
      // 数字滚动是否在跑：采样一次「当前显示的文本快照」
      numbers: [...document.querySelectorAll('span.tabular-nums')]
        .map((el) => el.textContent?.trim() ?? '')
        .filter((text) => /\d/.test(text))
        .slice(0, 12),
    }
  })

  // 交互延迟：一次点击到 DOM 变化（INP 的近似）
  const inp = await page.evaluate(async () => {
    const target = [...document.querySelectorAll('button,[role="tab"]')].find(
      (el) => el.offsetParent !== null && el.textContent?.trim().length,
    )
    if (!target) return null
    const t0 = performance.now()
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    const start = performance.now()
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
    return {
      handler: Number((start - t0).toFixed(2)),
      nextFrames: Number((performance.now() - start).toFixed(2)),
      label: target.textContent?.trim().slice(0, 16) ?? '',
    }
  })

  await context.close()
  return {
    route: route.id,
    path: route.path,
    name: route.name,
    note: route.note,
    profile: profileKey,
    wallMs: Date.now() - started,
    ...data,
    inp,
    errors,
  }
}

/* ------------------------------ 主循环 ------------------------------ */

const selectedProfiles = ONLY
  ? Object.keys(PROFILES).filter((key) => ONLY.split(',').includes(key))
  : Object.keys(PROFILES)
const selectedRoutes = ROUTE_FILTER
  ? ROUTES.filter((route) => ROUTE_FILTER.split(',').includes(route.id))
  : ROUTES

const results = []
for (const profileKey of selectedProfiles) {
  for (const route of selectedRoutes) {
    const row = await measure(route, profileKey)
    results.push(row)
    console.log(
      `${profileKey.padEnd(7)} ${route.name.padEnd(6)} FCP ${String(row.fcp).padStart(5)}  ` +
        `LCP ${String(row.lcp).padStart(5)}  TBT ${String(row.tbt).padStart(5)}  ` +
        `CLS ${row.cls.toFixed(3)}  JS ${String(row.jsTransferKB).padStart(4)}kB  ` +
        `DOM ${String(row.nodes).padStart(5)}  堆 ${row.heapMB}MB` +
        (row.errors.length ? `  ✗${row.errors.length}` : ''),
    )
  }
}

await browser.close()
server.close()

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      dist: DIST,
      cache: CACHE_PROFILE,
      assets: {
        totalRawKB: Number(TOTAL_ASSETS_KB.raw.toFixed(1)),
        totalGzipKB: Number(TOTAL_ASSETS_KB.gzip.toFixed(1)),
        table: SIZE_TABLE,
      },
      results,
    },
    null,
    2,
  ),
  'utf8',
)
console.log(`\n写入 ${OUT}`)
console.log(
  `构建产物合计：原始 ${TOTAL_ASSETS_KB.raw.toFixed(0)} kB / gzip ${TOTAL_ASSETS_KB.gzip.toFixed(0)} kB（${
    Object.keys(SIZE_TABLE).length
  } 个文件）`,
)

/* ------------------------------ 判定 ------------------------------ */

const limits = { fcp: [1800, 3000], lcp: [2500, 4000], tbt: [200, 600], cls: [0.1, 0.25] }
const grade = (value, [good, bad]) => (value <= good ? '优' : value <= bad ? '良' : '差')
console.log('')
console.log(
  '口径：优/良/差按 web.dev 的 Core Web Vitals 阈值（LCP 2.5s / INP·TBT 200ms / CLS 0.1）',
)
for (const row of results) {
  console.log(
    `${row.profile}/${row.route}: FCP ${grade(row.fcp, limits.fcp)} · LCP ${grade(row.lcp, limits.lcp)} · ` +
      `TBT ${grade(row.tbt, limits.tbt)} · CLS ${grade(row.cls, limits.cls)}`,
  )
}
