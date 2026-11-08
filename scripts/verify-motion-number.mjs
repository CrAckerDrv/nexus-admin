/**
 * 数字递增滚动验收
 *
 * 锁的是这条需求：「启用动效后数字显示也需要递增的滚动效果」。
 * 判断依据不是看代码，而是在浏览器里**两次采样同一个节点的文本**：
 *
 * - reduced：节点文本第一帧就应该是终值（不滚）
 * - full   ：第一帧数值 < 终值，且随时间单调递增，最后一帧等于终值
 *
 * 覆盖四处：工作台 KPI（AnimatedNumber）、性能监控 KPI、运营大屏 Hero（ScreenNumber）、
 * 财务大屏 Hero；以及「主题面板切换开关后立即生效」。
 *
 * 用法：node scripts/verify-motion-number.mjs [base]
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'docs/screenshots/tmp')
mkdirSync(outDir, { recursive: true })
const base = process.argv.find((arg) => arg.startsWith('http')) ?? 'http://127.0.0.1:5173'

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
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

/**
 * 在指定 motion 档位下打开一个路由，对该页所有「数字滚动节点」连续采样
 *
 * 用 `[data-motion-number]` 定位（AnimatedNumber 自己打的标记）而不是 `.tabular-nums`：
 * 后者会把侧栏徽标、日期、百分比等所有等宽数字都算进来，首帧读数恒为 `12`。
 *
 * 采样时刻：首帧（动画刚起步）→ 120ms → 900ms → 2100ms（应已收尾）。
 */
async function sample(route, motion) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  })
  await context.addInitScript(
    ({ motionMode }) => {
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
      // 动效偏好走 ui-store 的 persist 结构：system / full / reduced
      localStorage.setItem(
        'nexus-ui-prefs',
        JSON.stringify({ state: { motion: motionMode }, version: 6 }),
      )
    },
    { motionMode: motion },
  )

  const page = await context.newPage()
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`))

  await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForSelector('[data-motion-number]', { timeout: 30_000 })

  const data = await page.evaluate(async () => {
    const nodes = [...document.querySelectorAll('[data-motion-number]')]
    const read = () => nodes.map((node) => Number((node.textContent ?? '').replace(/[^\d.-]/g, '')))
    const timeline = []
    const snap = async (label) => {
      timeline.push({ label, values: read() })
    }
    await snap('t0')
    await new Promise((done) => requestAnimationFrame(() => done(null)))
    await snap('t1')
    await new Promise((done) => setTimeout(done, 120))
    await snap('t2')
    await new Promise((done) => setTimeout(done, 1500))
    await snap('t3')
    await new Promise((done) => setTimeout(done, 1400))
    await snap('t4')
    return {
      timeline,
      motion: document.documentElement.dataset.motion ?? 'system',
      mode: nodes[0]?.getAttribute('data-motion-number') ?? '',
    }
  })

  await context.close()
  return { ...data, errors }
}

/** 从时间线里挑「滚得最明显」的那个指标作为断言样本 */
function pickRising(timeline) {
  const first = timeline[1]?.values ?? []
  const last = timeline[4]?.values ?? []
  let best = { index: -1, from: 0, to: 0, ratio: 0 }
  for (let index = 0; index < Math.min(first.length, last.length); index += 1) {
    const from = first[index] ?? 0
    const to = last[index] ?? 0
    if (!Number.isFinite(from) || !Number.isFinite(to) || to === 0) continue
    const ratio = (to - from) / Math.abs(to)
    if (ratio > best.ratio) best = { index, from, to, ratio }
  }
  return best
}

/* ---------------------- ① 工作台 KPI ---------------------- */

const overviewFull = await sample('/dashboard/overview', 'full')
const overviewReduced = await sample('/dashboard/overview', 'reduced')
const rising = pickRising(overviewFull.timeline)

check(
  'full：data-motion 生效',
  overviewFull.motion === 'full',
  `data-motion=${overviewFull.motion}`,
)
check(
  'full：存在首帧小于终值的指标（真的在递增）',
  rising.index >= 0 && rising.from < rising.to,
  `${rising.from} → ${rising.to}`,
)
check(
  'full：各指标读数随时间单调不减',
  overviewFull.timeline.every((frame, index, list) =>
    frame.values.every((value, i) => index === 0 || value >= (list[index - 1].values[i] ?? 0)),
  ),
  overviewFull.timeline.map((frame) => frame.values.slice(0, 4).join(',')).join(' | '),
)
check(
  'full：最后落在终值（t3 与 t4 一致）',
  JSON.stringify(overviewFull.timeline[3].values) ===
    JSON.stringify(overviewFull.timeline[4].values),
  `${overviewFull.timeline[4].values.slice(0, 4).join(',')}`,
)
check(
  'reduced：第一帧就是终值（不滚）',
  JSON.stringify(overviewReduced.timeline[0].values) ===
    JSON.stringify(overviewReduced.timeline[4].values),
  `${overviewReduced.timeline[0].values.slice(0, 4).join(',')}`,
)
check(
  'reduced：与 full 的终值一致（开关只改过程不改结果）',
  JSON.stringify(overviewReduced.timeline[4].values) ===
    JSON.stringify(overviewFull.timeline[4].values),
  `${overviewReduced.timeline[4].values.slice(0, 4).join(',')}`,
)
check(
  'full 节点带 rolling 标记、reduced 带 static',
  overviewFull.mode === 'rolling' && overviewReduced.mode === 'static',
  `${overviewFull.mode} / ${overviewReduced.mode}`,
)

/* ---------------------- ② 性能监控 KPI ---------------------- */

const perfFull = await sample('/dashboard/performance', 'full')
const perfRising = pickRising(perfFull.timeline)
check(
  '性能监控页数字同样递增',
  perfRising.index >= 0 && perfRising.from < perfRising.to,
  `${perfRising.from} → ${perfRising.to}`,
)

/* ---------------------- ③ 运营大屏 Hero（ScreenNumber） ---------------------- */

const commandFull = await sample('/templates/command-center', 'full')
const commandRising = pickRising(commandFull.timeline)
const heroNode = await (async () => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
  })
  // 未注入登录态会 302 到 /login，下面等 Hero 选择器必然超时
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
            permissions: ['*'],
          },
          status: 'authenticated',
        },
        version: 0,
      }),
    )
  })
  const page = await context.newPage()
  await page.goto(`${base}/templates/command-center`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  })
  await page.waitForSelector('span.font-mono.text-\\[2\\.125rem\\]', { timeout: 30_000 })
  await page.waitForTimeout(2600)
  const text = await page.evaluate(
    () => document.querySelector('span.font-mono.text-\\[2\\.125rem\\]')?.textContent ?? '',
  )
  await context.close()
  return text
})()
check(
  '大屏 Hero 数字递增（字符串型指标也能滚）',
  commandRising.index >= 0 && commandRising.from < commandRising.to,
  `${commandRising.from} → ${commandRising.to}`,
)
check('大屏 Hero 终值仍是原数值（千分位保留）', heroNode.includes(','), heroNode)

/* ---------------------- ④ 财务大屏 Hero ---------------------- */

const financeFull = await sample('/templates/screen-finance', 'full')
const financeRising = pickRising(financeFull.timeline)
check(
  '财务大屏 Hero 数字递增',
  financeRising.index >= 0 && financeRising.from < financeRising.to,
  `${financeRising.from} → ${financeRising.to}`,
)

/* ---------------------- ⑤ 主题面板切换即时生效 ---------------------- */

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
        user: {
          id: 'u_1001',
          name: '陈彦之',
          email: 'admin@nexus.dev',
          role: 'super_admin',
          permissions: ['*'],
        },
        status: 'authenticated',
      },
      version: 0,
    }),
  )
})
const page = await context.newPage()
await page.goto(`${base}/dashboard/overview`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForSelector('[data-motion-number]', { timeout: 30_000 })
await page.waitForTimeout(1500)

const toggled = await page.evaluate(async () => {
  const before = document.documentElement.dataset.motion ?? 'system'
  document.documentElement.dataset.motion = before === 'full' ? 'reduced' : 'full'
  await new Promise((done) => setTimeout(done, 160))
  const node = document.querySelector('[data-motion-number]')
  return {
    before,
    after: document.documentElement.dataset.motion ?? 'system',
    // 节点上的标记是 rolling / static，与 data-motion 的 full / reduced 一一对应
    mode: node?.getAttribute('data-motion-number') ?? '',
  }
})
const expectedMode = toggled.after === 'reduced' ? 'static' : 'rolling'
check(
  '切换 data-motion 后已挂载的组件立即跟随',
  toggled.after !== toggled.before && toggled.mode === expectedMode,
  `${toggled.before} → ${toggled.after}（节点=${toggled.mode}，应为 ${expectedMode}）`,
)

await page.screenshot({ path: join(outDir, 'verify-motion-number.png') })
await context.close()

await browser.close()

const failed = results.filter((item) => !item.ok)
const consoleErrors = [
  ...overviewFull.errors,
  ...perfFull.errors,
  ...commandFull.errors,
  ...financeFull.errors,
]
console.log('')
console.log(`${results.length - failed.length}/${results.length} 项通过`)
if (consoleErrors.length) {
  console.error(`控制台错误 ${consoleErrors.length} 条：`)
  consoleErrors.slice(0, 8).forEach((error) => console.error(' -', error))
}
if (failed.length || consoleErrors.length) process.exitCode = 1
