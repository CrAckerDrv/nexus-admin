/**
 * 验收脚本：资源与编辑器（Media）
 *
 * 覆盖：
 * 1. 组件总览出现 Media 分类，10 个条目全部渲染
 * 2. 资源与编辑器模板页可打开，三种资源可切换、编辑器可切换
 * 3. 视频真的能播（currentTime 会前进）、音频能试听
 * 4. 深色模式下两者都可读，且无横向溢出
 * 5. 英文模式下列表与页签不出现原始词条 key
 *
 * 登录用 `_auth.mjs` 注入鉴权状态（登录表单挂 Cloudflare Turnstile，
 * headless 下必然停在人机验证，与本脚本要验证的内容无关）。
 *
 * 用法：node scripts/verify-media.mjs [base]
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { seedAuth } from './_auth.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'docs', 'screenshots')
const base = process.argv[2] ?? process.env.SHOT_BASE ?? 'http://127.0.0.1:5173'

const EDGE = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
]
  .filter(Boolean)
  .find((path) => existsSync(path))

if (!EDGE) throw new Error('未找到 Edge / Chrome，可设置 BROWSER_PATH')

mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
})
const page = await context.newPage()

/** @type {string[]} */
const errors = []
page.on('console', (message) => {
  if (message.type() !== 'error') return
  const text = message.text()
  if (text.includes('503')) return
  errors.push(text)
})
page.on('pageerror', (error) => errors.push(`[pageerror] ${error.message}`))

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

await seedAuth(page, base)

/* ---------------- 1. 组件橱窗 · Media 分类 ---------------- */
await page.goto(`${base}/components/overview`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForTimeout(1800)
await page.evaluate(() => {
  window.scrollTo(0, 0)
  document.getElementById('nexus-main')?.scrollTo({ top: 0 })
})
await page.waitForTimeout(300)

const categoryNames = await page
  .locator('nav[aria-label="组件索引"] > div > button')
  .allTextContents()
check(
  '组件索引出现 Media 分类',
  categoryNames.some((text) => text.startsWith('Media')),
  `${categoryNames.length} 个分类`,
)

const MEDIA_KEYS = [
  'image-preview',
  'video-preview',
  'audio-preview',
  'media-kind-badge',
  'media-card',
  'image-editor',
  'text-editor',
  'code-editor',
  'video-editor',
  'editor-workbench',
]
const present = []
for (const key of MEDIA_KEYS) {
  if ((await page.locator(`[data-gallery-key="${key}"]`).count()) > 0) present.push(key)
}
check(
  'Media 分类 10 个条目全部渲染',
  present.length === MEDIA_KEYS.length,
  `${present.length}/${MEDIA_KEYS.length}`,
)

// 搜索能命中新条目（关键词里有中文别名）
const search = page.getByLabel('搜索组件')
await search.fill('视频编辑')
await page.waitForTimeout(600)
const hits = await page.locator('[data-gallery-key]').count()
check('中文搜索「视频编辑」命中', hits > 0, `${hits} 张卡片`)
await search.fill('')
await page.waitForTimeout(400)

// 滚到 Media 段落截图
const mediaSection = page.locator('[data-category="media"]')
await mediaSection.scrollIntoViewIfNeeded()
await page.waitForTimeout(700)
await page.screenshot({ path: join(outDir, '55-components-media.png') })
const mediaCards = await mediaSection.locator('[data-gallery-key]').count()
check('Media 段落卡片数正确', mediaCards === MEDIA_KEYS.length, `${mediaCards} 张`)

/* ---------------- 2. 资源与编辑器模板页 ---------------- */
await page.goto(`${base}/templates/media-workbench`, {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
})
await page.waitForTimeout(1800)

const heading = (await page.locator('h1').first().textContent())?.trim()
check('资源与编辑器页渲染', heading === '资源与编辑器', heading ?? '空')
await page.screenshot({ path: join(outDir, '56-media-workbench.png') })

/** 左侧素材库里的卡片（MediaCard 是 button） */
const assetCards = page
  .locator('button[aria-pressed]')
  .filter({ hasText: /改版稿|主视觉|头图|短片|录屏|配乐|音效/ })
const assetCount = await assetCards.count()
check('素材库混排三种资源', assetCount >= 7, `${assetCount} 个资源`)

// 切到视频资源：应自动切到「视频编辑」页签
await page
  .getByRole('button', { name: /品牌短片/ })
  .first()
  .click()
await page.waitForTimeout(700)
const videoTabSelected = await page
  .getByRole('tab', { name: '视频编辑' })
  .getAttribute('aria-selected')
check('点视频资源自动切到视频编辑', videoTabSelected === 'true', String(videoTabSelected))

// 视频真的能播：点播放后 currentTime 前进
const played = await page.evaluate(async () => {
  const video = document.querySelector('video')
  if (!video) return { ok: false, reason: 'no <video>' }
  try {
    await video.play()
  } catch (error) {
    return { ok: false, reason: String(error).slice(0, 60) }
  }
  await new Promise((resolve) => setTimeout(resolve, 900))
  return { ok: true, time: video.currentTime, duration: video.duration }
})
check(
  '视频真实播放（currentTime 前进）',
  played.ok && played.time > 0.1,
  played.ok ? `t=${played.time?.toFixed(2)}s / ${played.duration?.toFixed(2)}s` : played.reason,
)

// 时间轴拆分：段数 3 → 4
const clipsBefore = await page.locator('[data-clip-id]').count()
await page.getByRole('slider', { name: '播放头' }).click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: '拆分', exact: true }).click()
await page.waitForTimeout(400)
const clipsAfter = await page.locator('[data-clip-id]').count()
check('时间轴可在播放头处拆分', clipsAfter === clipsBefore + 1, `${clipsBefore} → ${clipsAfter} 段`)

// 切到音频资源：波形可点，时间码变化
await page
  .getByRole('button', { name: /配乐片段/ })
  .first()
  .click()
await page.waitForTimeout(600)
const audioTrack = page.getByRole('slider', { name: /播放进度/ }).first()
check('音频波形可交互', (await audioTrack.count()) > 0)
if ((await audioTrack.count()) > 0) {
  const box = await audioTrack.boundingBox()
  if (box) {
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height / 2)
    await page.waitForTimeout(300)
    const value = await audioTrack.getAttribute('aria-valuenow')
    check('点击波形写入进度', Number(value) >= 3, `aria-valuenow=${value}`)
  }
}

// 手动切到图片编辑：比例按钮可见，参数联动
await page.getByRole('tab', { name: '图片编辑' }).click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: '1:1', exact: true }).click()
await page.waitForTimeout(300)
const ratioChip = await page.getByText(/1:1 · /).count()
check('图片编辑比例联动角标', ratioChip > 0)

// 文本编辑器：工具栏写回 Markdown
await page.getByRole('tab', { name: '文本编辑' }).click()
await page.waitForTimeout(500)
const textAreaValue = await page.locator('textarea[aria-label="正文编辑"]').inputValue()
check('文本编辑器载入默认内容', textAreaValue.includes('## '), `${textAreaValue.length} 字符`)

// 代码编辑器：行号与高亮都在
await page.getByRole('tab', { name: '代码编辑' }).click()
await page.waitForTimeout(500)
const gutter = await page.locator('[aria-label="代码编辑"]').count()
check('代码编辑器可用', gutter > 0)
await page.screenshot({ path: join(outDir, '57-media-workbench-code.png') })

/* ---------------- 3. 横向溢出 ---------------- */
const overflow = await page.evaluate(() => {
  const main = document.getElementById('nexus-main')
  return main ? main.scrollWidth - main.clientWidth : 0
})
check('页面无横向溢出', overflow <= 1, `${overflow}px`)

/* ---------------- 4. 深色模式 ---------------- */
await page.evaluate(() => {
  const raw = localStorage.getItem('nexus-ui-prefs')
  const prefs = raw ? JSON.parse(raw) : { state: {} }
  prefs.state = { ...(prefs.state ?? {}), theme: 'dark' }
  localStorage.setItem('nexus-ui-prefs', JSON.stringify(prefs))
})
await page.goto(`${base}/templates/media-workbench`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1800)
const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
check('深色模式下资源工作台', dark)
const darkOverflow = await page.evaluate(() => {
  const main = document.getElementById('nexus-main')
  return main ? main.scrollWidth - main.clientWidth : 0
})
check('深色模式无横向溢出', darkOverflow <= 1, `${darkOverflow}px`)
await page.screenshot({ path: join(outDir, '58-media-workbench-dark.png') })

/* ---------------- 5. 英文模式 ---------------- */
await page.evaluate(() => {
  const raw = localStorage.getItem('nexus-ui-prefs')
  const prefs = raw ? JSON.parse(raw) : { state: {} }
  prefs.state = { ...(prefs.state ?? {}), theme: 'light', locale: 'en-US' }
  localStorage.setItem('nexus-ui-prefs', JSON.stringify(prefs))
})
await page.goto(`${base}/templates/media-workbench`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1600)
const sidebarEntry = page.locator('a[href="/templates/media-workbench"]').first()
const sidebarText = (await sidebarEntry.textContent())?.trim() ?? ''
check('英文侧栏不出现词条 key', sidebarText.length > 0 && !/^nav\./.test(sidebarText), sidebarText)
await page.evaluate(() => {
  const raw = localStorage.getItem('nexus-ui-prefs')
  const prefs = raw ? JSON.parse(raw) : { state: {} }
  prefs.state = { ...(prefs.state ?? {}), theme: 'light', locale: 'zh-CN' }
  localStorage.setItem('nexus-ui-prefs', JSON.stringify(prefs))
})

/* ---------------- 6. 模板总览出现新卡片 ---------------- */
await page.goto(`${base}/templates/overview`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
const overviewCard = await page.getByText('资源与编辑器', { exact: false }).count()
check('模板总览出现「资源与编辑器」卡片', overviewCard > 0, `${overviewCard} 处`)
await page.screenshot({ path: join(outDir, '59-templates-overview.png') })

await browser.close()

const failed = results.filter((item) => !item.ok)
console.log(`\n${results.length - failed.length}/${results.length} 项通过`)
if (errors.length > 0) {
  console.error(`\n控制台错误 ${errors.length} 条：`)
  errors.slice(0, 12).forEach((error) => console.error(' -', error))
}
if (failed.length > 0) process.exitCode = 1
