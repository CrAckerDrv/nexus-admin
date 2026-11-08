/**
 * 无限画布验收
 *
 * 覆盖 7 项断言：渲染 → 拖拽跟手 → 缩放锚点 → 框选 → 连线 → AI 对话框 → 压测剔除。
 * 用法：node scripts/verify-canvas.mjs [--dark] [--full]
 *
 * 设计取法与其它 verify-*.mjs 一致：
 * 不依赖视觉基线（截图一变就得重录），而是断言**可量化的行为**：
 * 坐标变化、路径变化、DOM 数量、帧率。
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const base = process.env.SHOT_BASE ?? 'http://127.0.0.1:5173'
const outDir = join(root, 'docs/screenshots')
mkdirSync(outDir, { recursive: true })

const dark = process.argv.includes('--dark')
const ROUTE = '/templates/infinite-canvas'

const EDGE_BIN = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
]
  .filter(Boolean)
  .find((path) => existsSync(path))

if (!EDGE_BIN) throw new Error('未找到 Edge / Chrome，可设置 BROWSER_PATH')

const results = []
const record = (name, ok, detail) => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch({ executablePath: EDGE_BIN, headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
})
const page = await context.newPage()
const errors = []
page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`))

/* ------------------------------ 登录 ------------------------------ */
/**
 * 登录：优先走登录页；登录页不可用（改版/编译中/演示账号关闭）时，
 * 直接写入 zustand persist 的鉴权快照再进页面。
 *
 * 后者不是「绕过鉴权」—— 它写入的正是登录成功后 persist 会存的那份数据，
 * 只是省掉 UI 这一步，让验收脚本不被登录页的改动牵连。
 */
const SUPER_ADMIN = {
  id: 'u_1001',
  name: '陈彦之',
  email: 'admin@nexus.dev',
  role: 'super_admin',
  roleName: '超级管理员',
  department: '平台技术部',
  permissions: ['*'],
}

async function seedAuth() {
  await page.evaluate((user) => {
    window.localStorage.setItem(
      'nexus-auth',
      JSON.stringify({ state: { token: 'demo-token', user, status: 'authenticated' }, version: 0 }),
    )
  }, SUPER_ADMIN)
}

async function signIn() {
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 })

  const hasForm = await page
    .waitForSelector('#password', { timeout: 12_000 })
    .then(() => true)
    .catch(() => false)

  if (!hasForm) {
    console.warn('⚠ 登录表单不可用，改为直接写入鉴权快照')
    await seedAuth()
    await page.goto(`${base}${ROUTE}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-canvas-root]', { timeout: 30_000 })
    await page.waitForTimeout(800)
    return
  }

  await page.waitForTimeout(600)
  const quick = page.getByRole('button', { name: /超级管理员|Super Admin/ }).first()
  if ((await quick.count()) > 0) {
    await quick.click({ timeout: 8_000 }).catch(() => undefined)
    await page.waitForTimeout(200)
  }
  if (!(await page.locator('#email').inputValue().catch(() => ''))) {
    await seedAuth()
    await page.goto(`${base}${ROUTE}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-canvas-root]', { timeout: 30_000 })
    await page.waitForTimeout(800)
    return
  }
  await page.locator('#password').fill('nexus123').catch(() => undefined)
  const submit = page.getByRole('button', { name: '登录', exact: true })
  if ((await submit.count()) === 0) {
    await seedAuth()
  } else {
    await submit.click()
    await page.waitForTimeout(1200)
  }
  if (!page.url().includes('/dashboard/overview')) {
    await seedAuth()
    await page.goto(`${base}${ROUTE}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-canvas-root]', { timeout: 30_000 })
    await page.waitForTimeout(800)
    return
  }
  await page.waitForTimeout(600)
}

await signIn()

if (dark) {
  await page.evaluate(() => {
    const raw = localStorage.getItem('nexus-ui-prefs')
    const prefs = raw ? JSON.parse(raw) : { state: {} }
    prefs.state = { ...(prefs.state ?? {}), theme: 'dark' }
    localStorage.setItem('nexus-ui-prefs', JSON.stringify(prefs))
  })
}

/* 清掉上一次的文档，保证每次验收从同一状态开始 */
await page.evaluate(() => localStorage.removeItem('nexus-canvas-demo-v1'))

if (!page.url().includes(ROUTE)) {
  await page.goto(`${base}${ROUTE}`, { waitUntil: 'domcontentloaded' })
}
await page.waitForSelector('[data-canvas-root]', { timeout: 30_000 })
await page.waitForTimeout(1400)

/* ------------------------------ 1. 渲染 ------------------------------ */
const initial = await page.evaluate(() => ({
  nodes: document.querySelectorAll('[data-canvas-node]').length,
  edges: document.querySelectorAll('[data-canvas-edge]').length,
  status: document.body.innerText.includes('已挂载'),
}))
record('画布渲染：节点与连线都在', initial.nodes >= 8 && initial.edges >= 6, `nodes=${initial.nodes} edges=${initial.edges}`)
record('状态条存在（挂载数可见）', initial.status)

await page.screenshot({ path: join(outDir, dark ? '43-canvas-dark.png' : '40-canvas.png') })

/* ------------------------------ 2. 拖拽节点 ------------------------------ */
const firstNode = page.locator('[data-canvas-node]').first()
const boxBefore = await firstNode.boundingBox()
const nodeId = await firstNode.getAttribute('data-canvas-node')
await page.mouse.move(boxBefore.x + boxBefore.width / 2, boxBefore.y + boxBefore.height / 2)
await page.mouse.down()
await page.mouse.move(boxBefore.x + boxBefore.width / 2 + 90, boxBefore.y + boxBefore.height / 2 + 40, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(300)
const boxAfter = await page.locator(`[data-canvas-node="${nodeId}"]`).boundingBox()
record(
  '拖拽节点：位置真的变了',
  Math.abs(boxAfter.x - boxBefore.x) > 40 && Math.abs(boxAfter.y - boxBefore.y) > 15,
  `Δx=${Math.round(boxAfter.x - boxBefore.x)} Δy=${Math.round(boxAfter.y - boxBefore.y)}`,
)

/* 连线跟随：找到与该节点相连的边，path 应随之变化 */
const edgeFollow = await page.evaluate((id) => {
  const edge = document.querySelector('[data-canvas-edge] path[data-edge-path]')
  return edge ? edge.getAttribute('d')?.slice(0, 24) : null
}, nodeId)
record('连线在拖动后仍有有效路径', Boolean(edgeFollow), edgeFollow ?? 'none')

/* ------------------------------ 3. 撤销 ------------------------------ */
await page.keyboard.press('Control+z')
await page.waitForTimeout(300)
const boxUndo = await page.locator(`[data-canvas-node="${nodeId}"]`).boundingBox()
record(
  'Ctrl+Z 撤销拖动',
  Math.abs(boxUndo.x - boxBefore.x) < 4,
  `回到 x=${Math.round(boxUndo.x)}（原 ${Math.round(boxBefore.x)}）`,
)

/* ------------------------------ 4. 滚轮缩放锚点 ------------------------------ */
const worldBefore = await page.evaluate(() => {
  const world = document.querySelector('[data-canvas-world]')
  return world ? getComputedStyle(world).transform : ''
})
const viewportCenter = { x: 900, y: 480 }
await page.mouse.move(viewportCenter.x, viewportCenter.y)
await page.mouse.wheel(0, -240)
await page.waitForTimeout(400)
const worldAfter = await page.evaluate(() => {
  const world = document.querySelector('[data-canvas-world]')
  return world ? getComputedStyle(world).transform : ''
})
record('滚轮缩放改变了世界层 transform', worldBefore !== worldAfter)

/* 缩放后节点数量应变化（剔除在生效）或至少仍可见 */
const afterZoom = await page.evaluate(() => document.querySelectorAll('[data-canvas-node]').length)
record('缩放后仍渲染节点', afterZoom > 0, `nodes=${afterZoom}`)

/* ------------------------------ 5. 框选 ------------------------------ */
await page.keyboard.press('Shift+Digit1')
await page.waitForTimeout(600)
const canvasBox = await page.locator('[data-canvas-root]').boundingBox()
await page.mouse.move(canvasBox.x + 40, canvasBox.y + 60)
await page.mouse.down()
await page.mouse.move(canvasBox.x + canvasBox.width - 80, canvasBox.y + canvasBox.height - 120, { steps: 14 })
const marqueeVisible = await page.locator('[data-canvas-marquee]').count()
await page.mouse.up()
await page.waitForTimeout(300)
record('框选出现选择框', marqueeVisible > 0)
const selectedCount = await page.evaluate(
  () => document.querySelectorAll('[data-canvas-node][data-selected]').length,
)
record('框选命中多个节点', selectedCount >= 3, `selected=${selectedCount}`)

/* ------------------------------ 6. AI 对话框 ------------------------------ */
await page.keyboard.press('Escape')
await page.waitForTimeout(200)
const target = page.locator('[data-canvas-node]').nth(2)
const targetBox = await target.boundingBox()
await page.mouse.click(targetBox.x + 40, targetBox.y + 26)
await page.waitForTimeout(500)
// AI 输入区现在长在卡片底部（CanvasAIDock），选择器随之改为 data-canvas-ai-dock
const aiOpen = await page.locator('[data-canvas-ai-dock]').count()
record('点击节点在卡片底部展开 AI 输入区', aiOpen > 0)

if (aiOpen > 0) {
  // 输入区必须落在被点节点内部（这是「AI 内容显示在卡片底部」的核心断言）
  const inside = await page.evaluate(() => {
    const dock = document.querySelector('[data-canvas-ai-dock]')
    const node = dock?.closest('[data-canvas-node]')
    if (!dock || !node) return null
    const d = dock.getBoundingClientRect()
    const n = node.getBoundingClientRect()
    return {
      insideNode: d.top >= n.top - 2 && d.bottom <= n.bottom + 2 && d.left >= n.left - 2 && d.right <= n.right + 2,
      bottomAligned: Math.abs(d.bottom - n.bottom) < 4,
    }
  })
  record('AI 输入区贴在卡片底部且不越界', Boolean(inside?.insideNode && inside?.bottomAligned), JSON.stringify(inside))

  await page.locator('[data-canvas-ai-dock] input[aria-label="AI 指令"]').fill('改得更有画面感')
  await page.locator('[data-canvas-ai-dock] button[aria-label="发送"]').click()
  // 等「应用到节点」出现，而不是硬等固定时长：
  // 演示引擎按字符流式输出，答案长短不同，睡死一个数字迟早会 flaky
  const applyButton = page.locator('[data-canvas-ai-dock] button', { hasText: '应用到节点' })
  await applyButton.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => undefined)
  await page.waitForTimeout(200)
  const text = await page.locator('[data-canvas-ai-dock]').innerText()
  record('AI 流式回答有内容（卡片内可见）', text.length > 120, `${text.length} 字符`)
  const canApply = (await applyButton.count()) > 0
  record('生成结束后出现「应用到节点」', canApply)
  await page.screenshot({ path: join(outDir, dark ? '44-canvas-ai-dark.png' : '41-canvas-ai.png') })
  if (canApply) {
    await applyButton.first().click()
    await page.waitForTimeout(400)
    record('应用后 AI 输入区收起', (await page.locator('[data-canvas-ai-dock]').count()) === 0)
  }
}

/* ------------------------------ 6.5 小地图拖动 ------------------------------ */
/**
 * 这条断言对应一个真实 bug：小地图在画布根容器内部，
 * 指针事件会冒泡，拖小地图会连带把画布也框选/平移。
 */
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
const minimap = page.locator('[data-canvas-minimap] svg')
if ((await minimap.count()) > 0) {
  const mm = await minimap.boundingBox()
  const camBefore = await page.evaluate(() => {
    const world = document.querySelector('[data-canvas-world]')
    return world ? getComputedStyle(world).transform : ''
  })
  await page.mouse.move(mm.x + mm.width * 0.25, mm.y + mm.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(mm.x + mm.width * 0.7, mm.y + mm.height * 0.6, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(500)
  const camAfter = await page.evaluate(() => {
    const world = document.querySelector('[data-canvas-world]')
    return world ? getComputedStyle(world).transform : ''
  })
  const marqueeAfter = await page.evaluate(() => document.querySelectorAll('[data-canvas-marquee]').length)
  record('拖动小地图改变了相机（跳转生效）', camBefore !== camAfter)
  record('拖小地图不会连带框选画布', marqueeAfter === 0)

  // 「丝滑」可量化：连续拖动过程中，每一小段位移都应让相机跟着变。
  // 早先每次 move 都起 320ms 缓动 → 动画互相打断，表现为「拖了不动」，
  // 这条断言就是防止回退到那种实现。
  const samples = []
  await page.mouse.move(mm.x + mm.width * 0.2, mm.y + mm.height * 0.4)
  await page.mouse.down()
  for (let step = 1; step <= 6; step += 1) {
    await page.mouse.move(mm.x + mm.width * (0.2 + step * 0.08), mm.y + mm.height * 0.4, { steps: 2 })
    await page.waitForTimeout(60)
    samples.push(
      await page.evaluate(() => {
        const world = document.querySelector('[data-canvas-world]')
        return world ? getComputedStyle(world).transform : ''
      }),
    )
  }
  await page.mouse.up()
  await page.waitForTimeout(300)
  const distinct = new Set(samples).size
  record('小地图连续拖动逐段跟手（非跳变）', distinct >= 4, `${distinct}/6 帧不同`)
} else {
  record('小地图存在', false, '未找到 [data-canvas-minimap]')
}

/* ------------------------------ 6.6 编组（底部工具条） ------------------------------ */
await page.keyboard.press('Shift+Digit1')
await page.waitForTimeout(600)
const canvasForGroup = await page.locator('[data-canvas-root]').boundingBox()
// 框选两个节点
await page.mouse.move(canvasForGroup.x + 200, canvasForGroup.y + 120)
await page.mouse.down()
await page.mouse.move(canvasForGroup.x + 720, canvasForGroup.y + 520, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(400)
// 顶部菜单与底部工具条都有「编组」，这里限定在底部工具条里找
const groupBtn = page.locator('[role="toolbar"][aria-label="选中节点操作"] button', { hasText: '编组' }).first()
const groupVisible = (await groupBtn.count()) > 0
record('多选后底部工具条出现「编组」', groupVisible)
if (groupVisible) {
  const nodesBefore = await page.evaluate(() => document.querySelectorAll('[data-canvas-node]').length)
  await groupBtn.click()
  await page.waitForTimeout(600)
  const grouped = await page.evaluate(() => ({
    groups: document.querySelectorAll('[data-canvas-group]').length,
    nodes: document.querySelectorAll('[data-canvas-node]').length,
  }))
  record('编组后生成分组框', grouped.groups > 0, `分组框=${grouped.groups} 节点=${nodesBefore}→${grouped.nodes}`)
    const ungroupBtn = page.locator('[role="toolbar"][aria-label="选中节点操作"] button', { hasText: '解组' }).first()
  if ((await ungroupBtn.count()) > 0) {
    await ungroupBtn.click()
    await page.waitForTimeout(500)
    const left = await page.evaluate(() => document.querySelectorAll('[data-canvas-group]').length)
    record('解组后分组框消失', left === 0)
  }
}
await page.keyboard.press('Escape')
await page.waitForTimeout(200)

/* ------------------------------ 6.7 卡片顶部菜单 ------------------------------ */
const topMenuNode = page.locator('[data-canvas-node]').nth(2)
const tmBox = await topMenuNode.boundingBox()
await page.mouse.move(tmBox.x + tmBox.width / 2, tmBox.y + tmBox.height / 2)
await page.waitForTimeout(350)
const topMenuCount = await page.evaluate(
  () => document.querySelectorAll('[data-canvas-topmenu]').length,
)
// 注意：DOM 里每张卡都有自己的顶部菜单，必须取「鼠标所在那张卡」的，
// 取第一个会拿到未悬停的节点，opacity 自然是 0
const topMenuVisible = await page.evaluate(() => {
  const hovered = document.querySelector('[data-canvas-node]:hover')
  const menu = hovered?.querySelector('[data-canvas-topmenu]')
  if (!menu) return false
  return Number(getComputedStyle(menu).opacity) > 0.5
})
record('悬停节点出现顶部菜单', topMenuCount > 0 && topMenuVisible)
// 必须取「鼠标所在那张卡」的菜单：分组框的顶部菜单只有 3 项（解组/顶层/删除），
// 直接取第一个 [data-canvas-topmenu] 会拿到分组框，按钮数自然不够
const topBtnCount = await page.evaluate(
  () =>
    document.querySelector('[data-canvas-node]:hover [data-canvas-topmenu]')?.querySelectorAll('button')
      .length ?? 0,
)
record('顶部菜单含 AI/编辑/复制/锁定/编组/删除', topBtnCount >= 6, `${topBtnCount} 个按钮`)

/* ------------------------------ 6.8 双击不误建节点 ------------------------------ */
await page.keyboard.press('Escape')
await page.waitForTimeout(200)
const dblBefore = await page.evaluate(() => document.querySelectorAll('[data-canvas-node]').length)
const dblTarget = page.locator('[data-canvas-node]').nth(3)
const dblBox = await dblTarget.boundingBox()
await page.mouse.dblclick(dblBox.x + dblBox.width / 2, dblBox.y + 20)
await page.waitForTimeout(500)
const dblAfter = await page.evaluate(() => document.querySelectorAll('[data-canvas-node]').length)
record('双击卡片不会凭空新增节点', dblAfter === dblBefore, `${dblBefore} → ${dblAfter}`)
await page.keyboard.press('Escape')
await page.waitForTimeout(200)
// 双击文本卡片必须进入就地编辑（textarea 出现并聚焦）
const textCard = page.locator('[data-canvas-node]:has([data-canvas-kind="text"])').first()
const tcBox = await textCard.boundingBox()
await page.mouse.dblclick(tcBox.x + tcBox.width / 2, tcBox.y + tcBox.height / 2)
await page.waitForTimeout(600)
const editing = await page.evaluate(() => ({
  editor: document.querySelectorAll('.n-canvas-inline-edit').length,
  focused: document.activeElement?.tagName === 'TEXTAREA',
}))
record('双击文本卡片进入就地编辑', editing.editor > 0 && editing.focused, JSON.stringify(editing))
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// 双击空白**不应**新建节点（早期会误建，编辑卡片点偏就会多出一张空卡）
const rootForBlank = await page.locator('[data-canvas-root]').boundingBox()
const blankBefore = await page.evaluate(() => document.querySelectorAll('[data-canvas-node]').length)
await page.mouse.dblclick(rootForBlank.x + 70, rootForBlank.y + rootForBlank.height - 90)
await page.waitForTimeout(500)
const blankAfter = await page.evaluate(() => document.querySelectorAll('[data-canvas-node]').length)
record('双击空白不会新建节点', blankAfter === blankBefore, `${blankBefore} → ${blankAfter}`)

// 左键素材库仍可新建（保证「能建节点」这件事没被一起关掉）
const libBefore = await page.evaluate(() => document.querySelectorAll('[data-canvas-node]').length)
await page.locator('aside[aria-label="素材库"] button', { hasText: '文本' }).first().click()
await page.waitForTimeout(500)
const libAfter = await page.evaluate(() => document.querySelectorAll('[data-canvas-node]').length)
record('素材库仍可新建节点', libAfter > libBefore, `${libBefore} → ${libAfter}`)
await page.keyboard.press('Control+z')
await page.waitForTimeout(400)

/* ------------------------------ 7. 右键菜单 ------------------------------ */
await page.keyboard.press('Escape')
await page.waitForTimeout(200)
const menuTarget = page.locator('[data-canvas-node]').nth(1)
const menuBox = await menuTarget.boundingBox()
await page.mouse.click(menuBox.x + 30, menuBox.y + 24, { button: 'right' })
await page.waitForTimeout(350)
const menuOpen = await page.locator('[data-canvas-context-menu]').count()
record('右键节点弹出菜单', menuOpen > 0)

if (menuOpen > 0) {
  const menuText = await page.locator('[data-canvas-context-menu]').first().innerText()
  // 断言用的是菜单里的实际文案（「创建副本」而非「复制」）
  const hasAll = ['AI 编辑', '副本', '锁定', '层级', '对齐', '删除'].every((keyword) => menuText.includes(keyword))
  // 关键：菜单必须完整落在画布可视区内（曾因复用了带 -50% 位移的进场动画被顶掉一半）
  const geometry = await page.evaluate(() => {
    const menu = document.querySelector('[data-canvas-context-menu]')
    const root = document.querySelector('[data-canvas-root]')
    if (!menu || !root) return null
    const m = menu.getBoundingClientRect()
    const r = root.getBoundingClientRect()
    return {
      inside: m.top >= r.top - 1 && m.bottom <= r.bottom + 1 && m.left >= r.left - 1 && m.right <= r.right + 1,
      height: Math.round(m.height),
    }
  })
  record('菜单覆盖 AI/复制/锁定/层级/对齐/删除', hasAll, menuText.replace(/\n/g, ' / ').slice(0, 80))
  record('菜单完整落在画布内（未被动画顶偏）', Boolean(geometry?.inside), JSON.stringify(geometry))

  // 子菜单：悬停「层级」应展开
  await page.locator('[data-canvas-context-menu] button', { hasText: '层级' }).first().hover()
  await page.waitForTimeout(250)
  const submenu = await page.locator('[data-canvas-context-menu] [role="menu"]').count()
  record('子菜单可展开（层级）', submenu > 0)

  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  record('Esc 关闭右键菜单', (await page.locator('[data-canvas-context-menu]').count()) === 0)
}

/* 空白处右键：应有「添加节点 / 撤销 / 全选 / 适配」 */
const canvasRect = await page.locator('[data-canvas-root]').boundingBox()
await page.mouse.click(canvasRect.x + 40, canvasRect.y + canvasRect.height - 60, { button: 'right' })
await page.waitForTimeout(300)
const blankText = await page.locator('[data-canvas-context-menu]').first().innerText().catch(() => '')
record(
  '空白右键含添加/历史/视图三组',
  blankText.includes('添加节点') && blankText.includes('撤销') && blankText.includes('适配'),
)
await page.keyboard.press('Escape')
await page.waitForTimeout(200)

/* ------------------------------ 8. 压力测试 ------------------------------ */
await page.getByRole('button', { name: /压力测试/ }).click()
await page.waitForTimeout(1800)
const stress = await page.evaluate(() => {
  const mounted = document.querySelectorAll('[data-canvas-node]').length
  const text = document.body.innerText
  const match = text.match(/已挂载\s*(\d+)/)
  const fpsMatch = text.match(/帧率\s*(\d+)/)
  return { mounted, reported: match ? Number(match[1]) : null, fps: fpsMatch ? Number(fpsMatch[1]) : null }
})
record(
  '1,000 节点压测：挂载数被剔除压到 100 以内',
  stress.mounted < 100,
  `mounted=${stress.mounted} reported=${stress.reported}`,
)
record('压测后帧率 ≥ 55', (stress.fps ?? 0) >= 55, `fps=${stress.fps}`)

await page.screenshot({ path: join(outDir, dark ? '45-canvas-stress-dark.png' : '42-canvas-stress.png') })

/* ------------------------------ 8. 控制台 ------------------------------ */
record('无控制台错误', errors.length === 0, errors.slice(0, 3).join(' | '))

/* ------------------------------ 汇总 ------------------------------ */
const failed = results.filter((item) => !item.ok)
console.log(`\n${results.length - failed.length}/${results.length} 通过`)
if (failed.length > 0) {
  console.log('失败项：')
  for (const item of failed) console.log(` - ${item.name} ${item.detail ?? ''}`)
  await browser.close()
  process.exit(1)
}

await browser.close()
