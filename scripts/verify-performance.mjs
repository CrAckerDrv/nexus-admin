/**
 * 性能监控页验收：断言关键区块、验证四类交互、检查控制台
 *
 * 用法：node scripts/verify-performance.mjs [--dark] [base]
 *
 * 说明：登录态用注入方式写入（与 shot-performance.mjs 一致），
 * 因为这个脚本验收的是监控页本身，不该被登录页的重构牵连。
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const base = process.argv.find((arg) => arg.startsWith('http')) ?? 'http://127.0.0.1:5173'
const dark = process.argv.includes('--dark')
const outDir = join(root, 'docs/screenshots/tmp')
mkdirSync(outDir, { recursive: true })

const EDGE = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
]
  .filter(Boolean)
  .find((path) => existsSync(path))

if (!EDGE) throw new Error('未找到 Microsoft Edge / Chrome，可设置 BROWSER_PATH')

const ADMIN = {
  id: 'u_1001',
  name: '陈彦之',
  email: 'admin@nexus.dev',
  role: 'super_admin',
  roleName: '超级管理员',
  department: '平台技术部',
  permissions: ['*'],
}

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
})

await context.addInitScript(
  ({ admin, darkMode }) => {
    localStorage.setItem(
      'nexus-auth',
      JSON.stringify({
        state: { token: 'demo_token_u_1001', user: admin, status: 'authenticated' },
        version: 0,
      }),
    )
    if (darkMode) {
      const raw = localStorage.getItem('nexus-ui-prefs')
      const prefs = raw ? JSON.parse(raw) : { state: {}, version: 4 }
      prefs.state = { ...(prefs.state ?? {}), theme: 'dark' }
      localStorage.setItem('nexus-ui-prefs', JSON.stringify(prefs))
    }
  },
  { admin: ADMIN, darkMode: dark },
)

const page = await context.newPage()
const errors = []
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})
page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`))

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` · ${detail}` : ''}`)
}

await page.goto(`${base}/dashboard/performance`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.locator('h1', { hasText: '性能监控' }).waitFor({ timeout: 30_000 })
await page.waitForTimeout(3000)

/* ---------------------- ① 版面与数据 ---------------------- */

const layout = await page.evaluate(() => {
  const text = document.body.innerText
  const main = document.querySelector('#nexus-main')
  return {
    canvases: document.querySelectorAll('canvas').length,
    painted: [...document.querySelectorAll('canvas')].filter((c) => c.width > 100).length,
    tables: document.querySelectorAll('table').length,
    hostCells: document.querySelectorAll(
      'button[aria-label*="健康"], button[aria-label*="异常"], button[aria-label*="降级"], button[aria-label*="离线"]',
    ).length,
    hasKpi: [
      '在线节点',
      '集群平均 CPU',
      '内存水位',
      '磁盘最高水位',
      '集群 QPS',
      'P95 延迟',
      '请求错误率',
      '未处理告警',
    ].every((label) => text.includes(label)),
    hasSlo: text.includes('SLO 与错误预算') && text.includes('剩余预算'),
    hasMatrix: text.includes('节点健康矩阵'),
    hasService: text.includes('服务健康') && text.includes('search-svc'),
    hasAlerts: text.includes('告警中心') && text.includes('search-svc 熔断触发'),
    hasLogs: text.includes('实时日志') && text.includes('ERROR'),
    hasStorage: text.includes('存储卷水位') && text.includes('inode'),
    hasHeatmap: text.includes('负载热力图') && text.includes('工作日均值'),
    hasProcess:
      text.includes('进程占用 TOP') && text.includes('zombie') === false && text.includes('PID'),
    hasCluster: text.includes('na-prod-01') && text.includes('prom-na-prod'),
    overflow: main ? main.scrollWidth - main.clientWidth : -1,
  }
})

check('2 张图表已绘制', layout.painted >= 2 && layout.canvases >= 2, `canvas=${layout.canvases}`)
check('4 张表格已渲染', layout.tables >= 4, `tables=${layout.tables}`)
check('节点矩阵 54 个格子', layout.hostCells >= 50, `cells=${layout.hostCells}`)
check('8 张核心指标齐全', layout.hasKpi)
check('SLO / 错误预算区块', layout.hasSlo)
check('节点矩阵区块', layout.hasMatrix)
check('服务健康表', layout.hasService)
check('告警中心（含 P0 熔断告警）', layout.hasAlerts)
check('实时日志（含 ERROR 级）', layout.hasLogs)
check('存储卷水位（含 inode）', layout.hasStorage)
check('负载热力图（含工作日/周末对比）', layout.hasHeatmap)
check('进程占用 TOP', layout.hasProcess)
check('采集链与值班信息', layout.hasCluster)
check('无横向溢出', layout.overflow === 0, `overflow=${layout.overflow}px`)

/* ---------------------- ② 时间区间切换 ---------------------- */

/** 区间按钮是 role=tab；点完要等 aria-selected 真的切过去，再读描述 */
const switchRange = async (label, expect) => {
  await page.getByRole('tab', { name: label }).click()
  await page
    .locator(`[role="tab"][aria-selected="true"]`, { hasText: label })
    .waitFor({ timeout: 5000 })
  await page.waitForTimeout(600)
  const desc = await page.evaluate(() => {
    const el = [...document.querySelectorAll('p')].find((node) =>
      node.textContent?.includes('聚合，虚线为告警阈值'),
    )
    return el?.textContent?.trim() ?? ''
  })
  check(`区间切到「${expect}」后描述同步`, desc.includes(expect), desc.slice(0, 40))
}

await switchRange('7 天', '7 天')
await switchRange('1 小时', '1 小时')
await switchRange('24 小时', '24 小时')

/* ---------------------- ③ 图表形态切换 ---------------------- */

for (const label of ['吞吐与延迟', '网络吞吐', '错误率', '资源水位']) {
  await page.getByRole('tab', { name: label }).click()
  await page
    .locator(`[role="tab"][aria-selected="true"]`, { hasText: label })
    .waitFor({ timeout: 5000 })
}
check('四张趋势图形态可切换且无报错', errors.length === 0)

/* ---------------------- ④ 节点筛选 + 下钻 ---------------------- */

/**
 * 筛选器是自研 Select：外层 `role=combobox`（不是 button），
 * 选项是 `role=option` 的 div，因此按组合键语义操作而不是按按钮点。
 */
await page.locator('[role="combobox"]').first().click()
await page.locator('[role="option"]', { hasText: '异常' }).first().click()
await page.waitForTimeout(700)
const filteredCount = await page.evaluate(() => {
  const el = [...document.querySelectorAll('p,span')].find((node) =>
    /筛选后 \d+ 台/.test(node.textContent ?? ''),
  )
  return el?.textContent?.trim() ?? ''
})
check('状态筛选只留异常节点', /筛选后 [1-9]\d? 台/.test(filteredCount), filteredCount)

await page.locator('button[aria-label*="异常"]').first().click()
await page.locator('[role="dialog"][aria-modal="true"]').waitFor({ timeout: 8000 })
const drawerText = await page.evaluate(() => {
  const panel = document.querySelector('[role="dialog"][aria-modal="true"]')
  return panel?.innerText ?? ''
})
check(
  '节点详情抽屉（含 CPU/内存/磁盘 + 进程 TOP）',
  drawerText.includes('CPU') && drawerText.includes('进程占用 TOP'),
  drawerText.split('\n')[0],
)
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
// 还原筛选，后面的用例还要看到完整列表
await page.locator('[role="combobox"]').first().click()
await page.locator('[role="option"]', { hasText: '全部状态' }).first().click()
await page.waitForTimeout(500)

/* ---------------------- ⑤ 告警处置 ---------------------- */

await page.evaluate(() => {
  const button = [...document.querySelectorAll('button')].find(
    (node) => node.textContent?.trim() === '去处置',
  )
  button?.click()
})
await page.waitForTimeout(900)

const ackBefore = await page.evaluate(() => {
  const unhandled = [...document.querySelectorAll('button')].filter(
    (node) => node.textContent?.trim() === '确认',
  ).length
  return unhandled
})
await page
  .locator('button', { hasText: /^确认$/ })
  .first()
  .click({ timeout: 8000 })
await page.waitForTimeout(1200)
const ackAfter = await page.evaluate(() => {
  const text = document.body.innerText
  return {
    unhandled: [...document.querySelectorAll('button')].filter(
      (node) => node.textContent?.trim() === '确认',
    ).length,
    acked: (text.match(/已确认/g) ?? []).length,
  }
})
check(
  '告警确认后进入已处置',
  ackAfter.unhandled < ackBefore,
  `未处理 ${ackBefore} → ${ackAfter.unhandled}`,
)
void page

/* ---------------------- ⑥ 服务下钻 ---------------------- */

await page.evaluate(() => {
  const row = [...document.querySelectorAll('tbody tr')].find((node) =>
    node.textContent?.includes('search-svc'),
  )
  row?.click()
})
await page.locator('[role="dialog"][aria-modal="true"]').waitFor({ timeout: 8000 })
const serviceText = await page.evaluate(
  () => document.querySelector('[role="dialog"][aria-modal="true"]')?.innerText ?? '',
)
check(
  '服务详情抽屉（含 SLO / 诊断建议）',
  serviceText.includes('SLO') && serviceText.includes('诊断建议'),
  serviceText.split('\n')[0],
)

/* ---------------------- ⑦ 暂停实时 ---------------------- */

await page.keyboard.press('Escape')
await page.waitForTimeout(400)
await page.getByRole('button', { name: '暂停实时' }).click()
await page.waitForTimeout(600)
const paused = await page.evaluate(() => document.body.innerText.includes('已暂停刷新'))
check('暂停实时切换状态徽标', paused)

await page.screenshot({ path: join(outDir, `verify-performance${dark ? '-dark' : ''}.png`) })
await browser.close()

const failed = results.filter((item) => !item.ok)
console.log('')
console.log(`共 ${results.length} 项断言，通过 ${results.length - failed.length} 项`)
console.log(errors.length ? `控制台错误:\n${errors.slice(0, 8).join('\n')}` : '控制台：无错误')
if (failed.length || errors.length) process.exitCode = 1
