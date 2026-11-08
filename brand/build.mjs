/**
 * Nexus Admin — 品牌图标生成器
 *
 * 设计说明：图标就是一个 N 字形本身。没有底版、没有渐变、没有描边框，
 * 两段竖笔 + 一条斜笔，全部圆头端。它靠字形本身在不同尺寸与深浅背景上成立。
 *
 * 输出：
 *   nexus-mark.svg          墨迹紧贴的 viewBox，currentColor（内联进 UI 用）
 *   nexus-mark-black.svg    固定 #111318（浅色背景）
 *   nexus-mark-white.svg    固定 #ffffff（深色背景）
 *   nexus-icon.svg          24 方形画布 + 小尺寸加强，作为 favicon / 应用图标
 *   nexus-favicon.svg       透明底 + prefers-color-scheme 自动反转
 *   nexus-avatar.svg        深色方块反白（GitHub 组织头像 / iOS，必须不透明的场景）
 *   png/                    16→512 透明 PNG、白色版、头像、apple-touch-icon、favicon.ico
 *   preview/                尺寸阶梯 · 锁定 · 深色 · 场景 · 社交图
 *
 * 运行：node brand/build.mjs
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/* ------------------------------------------------------------------ *
 * 1. 母版几何（24 × 24 网格）
 *
 *   竖笔中心线  x = 5.5 / 18.5      字宽 13.0
 *   竖笔端点    y = 4.9 / 19.1      字高 14.2
 *   竖笔 2.7，斜笔 2.5（斜向视觉偏粗，光学减重）
 * ------------------------------------------------------------------ */

const GRID = 24
const CORE = { xL: 5.5, xR: 18.5, yT: 4.9, yB: 19.1, sw: 2.7, swDiag: 2.5 }

/** 常规：占比 ~87%；小尺寸：加粗并再放大一点，补偿抗锯齿的吃边 */
const LARGE = { scale: 1.24, sw: 2.7, swDiag: 2.5 }
const SMALL = { scale: 1.28, sw: 3.02, swDiag: 2.8 }

const INK = {
  x: CORE.xL - CORE.sw / 2,
  y: CORE.yT - CORE.sw / 2,
  w: CORE.xR - CORE.xL + CORE.sw,
  h: CORE.yB - CORE.yT + CORE.sw,
}

const f = (v) => Number(v.toFixed(3))

/** 按画布缩放后的三段路径；color 为 null 时继承父级（用于 <style> 控制颜色） */
function strokes({ scale, sw, swDiag }, color = 'currentColor') {
  const t = (v) => f(GRID / 2 + (v - GRID / 2) * scale)
  const s = f(sw * scale)
  const d = f(swDiag * scale)
  const paint = color === null ? '' : ` stroke="${color}"`
  return [
    `    <path d="M${t(CORE.xL)} ${t(CORE.yB)} L${t(CORE.xL)} ${t(CORE.yT)}"${paint} stroke-width="${s}" stroke-linecap="round"/>`,
    `    <path d="M${t(CORE.xR)} ${t(CORE.yB)} L${t(CORE.xR)} ${t(CORE.yT)}"${paint} stroke-width="${s}" stroke-linecap="round"/>`,
    `    <path d="M${t(CORE.xL)} ${t(CORE.yT)} L${t(CORE.xR)} ${t(CORE.yB)}"${paint} stroke-width="${d}" stroke-linecap="round"/>`,
  ].join('\n')
}

/** 未缩放的原始墨迹（用于紧凑 viewBox） */
function rawStrokes(color = 'currentColor') {
  const { xL, xR, yT, yB, sw, swDiag } = CORE
  return [
    `    <path d="M${xL} ${yB} L${xL} ${yT}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`,
    `    <path d="M${xR} ${yB} L${xR} ${yT}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`,
    `    <path d="M${xL} ${yT} L${xR} ${yB}" stroke="${color}" stroke-width="${swDiag}" stroke-linecap="round"/>`,
  ].join('\n')
}

const wrap = (viewBox, body, attrs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg"${attrs} viewBox="${viewBox}" fill="none">\n${body}\n</svg>\n`

const tight = () =>
  wrap(`${f(INK.x)} ${f(INK.y)} ${f(INK.w)} ${f(INK.h)}`, `  <g>\n${rawStrokes()}\n  </g>`)
const square = (variant, color, attrs = '') =>
  wrap(
    `${GRID === 24 ? '0 0 24 24' : ''}`.trim() || '0 0 24 24',
    `  <g>\n${strokes(variant, color)}\n  </g>`,
    attrs,
  )

const avatars = () =>
  wrap(
    '0 0 24 24',
    `  <rect width="24" height="24" rx="5.4" fill="#0b0d12"/>\n  <g>\n${strokes(LARGE, '#ffffff')}\n  </g>`,
    ' role="img" aria-label="Nexus Admin"',
  )

const favicon = () =>
  wrap(
    '0 0 24 24',
    `  <style>
    .ink { stroke: #111318; }
    @media (prefers-color-scheme: dark) { .ink { stroke: #ffffff; } }
  </style>
  <g class="ink">
${strokes(SMALL, null)}
  </g>`,
  )

/* ------------------------------------------------------------------ *
 * 2. 写出 SVG
 * ------------------------------------------------------------------ */

const pngDir = join(__dirname, 'png')
const previewDir = join(__dirname, 'preview')
mkdirSync(pngDir, { recursive: true })
mkdirSync(previewDir, { recursive: true })

writeFileSync(join(__dirname, 'nexus-mark.svg'), tight())
writeFileSync(join(__dirname, 'nexus-mark-black.svg'), tight().replace(/currentColor/g, '#111318'))
writeFileSync(join(__dirname, 'nexus-mark-white.svg'), tight().replace(/currentColor/g, '#ffffff'))
writeFileSync(
  join(__dirname, 'nexus-icon.svg'),
  square(LARGE, 'currentColor', ' role="img" aria-label="Nexus Admin"'),
)
writeFileSync(join(__dirname, 'nexus-favicon.svg'), favicon())
writeFileSync(join(__dirname, 'nexus-avatar.svg'), avatars())

// favicon 与文档站 logo 是同一套字形：顺手同步到两个 public/ 目录，避免手动复制后失同步
const APP_PUBLIC = join(__dirname, '..', 'apps', 'admin', 'public')
const DOCS_PUBLIC = join(__dirname, '..', 'apps', 'docs', 'public')
writeFileSync(join(APP_PUBLIC, 'favicon.svg'), favicon())
writeFileSync(join(DOCS_PUBLIC, 'favicon.svg'), favicon())
writeFileSync(join(DOCS_PUBLIC, 'logo.svg'), tight())
writeFileSync(join(DOCS_PUBLIC, 'logo-white.svg'), tight().replace(/currentColor/g, '#ffffff'))
console.log('✓ svg')

/* ------------------------------------------------------------------ *
 * 3. 光栅化
 * ------------------------------------------------------------------ */

const CANDIDATES = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
].filter(Boolean)
const executablePath = CANDIDATES.find((p) => existsSync(p))
if (!executablePath) throw new Error('未找到 Edge / Chrome，可设置 BROWSER_PATH')

const browser = await chromium.launch({ executablePath, headless: true })

async function rasterize(svg, size) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  })
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:transparent;overflow:hidden;line-height:0}
    svg{display:block;width:${size}px;height:${size}px}
  </style></head><body>${svg}</body></html>`
  await page.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  await page.waitForTimeout(60)
  const buffer = await page.screenshot({ omitBackground: true, type: 'png' })
  await page.close()
  return buffer
}

// ≤32px 用加粗版，避免缩到 favicon 尺寸后笔画发虚
const variantFor = (size) => (size <= 32 ? SMALL : LARGE)

for (const size of [512, 256, 192, 128, 64, 48, 32, 24, 16]) {
  const svg = wrap('0 0 24 24', `  <g>\n${strokes(variantFor(size), '#111318')}\n  </g>`)
  writeFileSync(join(pngDir, `nexus-icon-${size}.png`), await rasterize(svg, size))
}

for (const size of [512, 256]) {
  writeFileSync(join(pngDir, `nexus-avatar-${size}.png`), await rasterize(avatars(), size))
  writeFileSync(
    join(pngDir, `nexus-icon-white-${size}.png`),
    await rasterize(wrap('0 0 24 24', `  <g>\n${strokes(LARGE, '#ffffff')}\n  </g>`), size),
  )
}

// iOS 主屏：不透明、直角铺满
writeFileSync(
  join(pngDir, 'apple-touch-icon-180.png'),
  await rasterize(
    wrap(
      '0 0 24 24',
      `  <rect width="24" height="24" fill="#0b0d12"/>\n  <g>\n${strokes(LARGE, '#ffffff')}\n  </g>`,
    ),
    180,
  ),
)

// favicon.ico：内嵌 48×48 PNG。
// 用「透明底 + 墨色字形」，与 SVG 版保持一致；现代浏览器优先取 SVG（会跟随深浅色自动反转），
// .ico 只服务不支持 SVG 图标的旧浏览器。
{
  const png = await rasterize(wrap('0 0 24 24', `  <g>\n${strokes(SMALL, '#111318')}\n  </g>`), 48)
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  const entry = Buffer.alloc(16)
  entry.writeUInt8(48, 0)
  entry.writeUInt8(48, 1)
  entry.writeUInt8(0, 2)
  entry.writeUInt8(0, 3)
  entry.writeUInt16LE(1, 4)
  entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(22, 12)
  writeFileSync(join(pngDir, 'favicon.ico'), Buffer.concat([header, entry, png]))
}
console.log('✓ png')

// 浏览器页签 / PWA / iOS 用的是同一份字形：直接同步进 admin 的 public/，避免复制后失同步
const APP_ICONS = [
  ['favicon.ico', 'favicon.ico'],
  ['apple-touch-icon-180.png', 'apple-touch-icon.png'],
  ['nexus-icon-192.png', 'icon-192.png'],
  ['nexus-icon-512.png', 'icon-512.png'],
]
for (const [from, to] of APP_ICONS) {
  writeFileSync(join(APP_PUBLIC, to), readFileSync(join(pngDir, from)))
}
console.log('✓ app icons')

/* ------------------------------------------------------------------ *
 * 4. 预览
 * ------------------------------------------------------------------ */

const sq = (size, color = '#111318', variant = variantFor(size)) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">${strokes(variant, color)}</svg>`

const raw = (height, color = '#111318') => {
  const width = (INK.w / INK.h) * height
  return `<svg width="${width}" height="${height}" viewBox="${f(INK.x)} ${f(INK.y)} ${f(INK.w)} ${f(INK.h)}" fill="none">${rawStrokes(color)}</svg>`
}

const previewHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{width:1300px;padding:42px;background:#fff;color:#111318;
       font:13px/1.5 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
  h2{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
     color:#9aa1ab;margin:0 0 16px}
  section{margin-bottom:32px}
  .row{display:flex;align-items:flex-end;gap:40px}
  .cell{text-align:center}
  .cell em{display:block;font-style:normal;font-size:9px;letter-spacing:.06em;color:#c1c6ce;margin-top:12px}
  .dark{background:#0b0d12;border-radius:18px;padding:32px 36px;display:flex;align-items:flex-end;gap:40px}
  .dark .cell em{color:#5b6472}
  .lock{display:flex;align-items:center;gap:15px}
  .lock b{font-size:31px;font-weight:700;letter-spacing:-.038em}
  .dark .lock b{color:#fff}
  .lock span{display:block;font-size:11px;color:#9aa1ab;letter-spacing:.05em;margin-top:3px}
  .dark .lock span{color:#6f7889}
  .side{display:flex;align-items:center;gap:11px;border:1px solid #e8eaee;border-radius:10px;padding:11px 13px}
  .side b{font-size:13px;font-weight:600;letter-spacing:-.01em}
  .side small{display:block;font-size:9.5px;color:#9aa1ab}
  .ctx{display:flex;align-items:center;gap:18px;flex-wrap:wrap}
  .chrome{display:flex;align-items:center;gap:6px;background:#dfe1e5;border-radius:9px 9px 0 0;padding:8px 8px 0}
  .chrome.d{background:#202124}
  .ctab{display:flex;align-items:center;gap:6px;background:#fff;border-radius:7px 7px 0 0;
        padding:6px 10px;font-size:11px;color:#3c4043;width:134px}
  .ctab.d{background:#35363a;color:#e8eaed}
  .btn{display:inline-flex;align-items:center;gap:7px;background:#111318;color:#fff;
       border-radius:8px;padding:8px 14px;font-size:12.5px}
  .nav{display:flex;align-items:center;gap:9px;font-size:12.5px;color:#25292f}
</style></head><body>
  <section>
    <h2>尺寸阶梯 · size ladder</h2>
    <div class="row">
      ${[256, 128, 64, 48, 32, 24, 16].map((s) => `<div class="cell">${sq(s)}<em>${s}px</em></div>`).join('')}
    </div>
  </section>

  <section>
    <h2>品牌锁定 · lockup</h2>
    <div class="row" style="align-items:center;gap:72px">
      <div class="lock">${sq(54)}<div><b>Nexus Admin</b><span>模块化高性能管理后台模板</span></div></div>
      <div class="side">${sq(24)}<div><b>Nexus Admin</b><small>模块化 · 高性能 · 开源</small></div></div>
    </div>
  </section>

  <section>
    <h2>深色 · on dark</h2>
    <div class="dark">
      ${[128, 64, 32, 24, 16].map((s) => `<div class="cell">${sq(s, '#ffffff')}<em>${s}px</em></div>`).join('')}
      <div class="lock">${sq(34, '#ffffff')}<div><b>Nexus Admin</b><span>模块化高性能管理后台模板</span></div></div>
    </div>
  </section>

  <section>
    <h2>使用场景 · in context</h2>
    <div class="ctx">
      <div class="chrome">
        <div class="ctab">${sq(12)}Nexus Admin</div>
        <div class="ctab">${sq(12)}文档</div>
      </div>
      <div class="chrome d">
        <div class="ctab d">${sq(12, '#ffffff')}Nexus Admin</div>
        <div class="ctab d">${sq(12, '#ffffff')}文档</div>
      </div>
      <div class="nav">${sq(15)}Nexus Admin</div>
      <div class="btn">${sq(13, '#ffffff')}新建用户</div>
    </div>
  </section>

  <section>
    <h2>原始字形 · raw mark（不随画布缩放）</h2>
    <div class="row" style="align-items:center;gap:46px">
      ${raw(112)}${raw(56)}${raw(28)}${raw(14)}
    </div>
  </section>
</body></html>`

{
  const page = await browser.newPage({
    viewport: { width: 1300, height: 900 },
    deviceScaleFactor: 2,
  })
  await page.goto(`data:text/html;charset=utf-8,${encodeURIComponent(previewHtml)}`)
  await page.waitForTimeout(250)
  await page.screenshot({ path: join(previewDir, 'icon-preview.png'), fullPage: true })
  await page.close()
}
console.log('✓ preview')

/* ------------------------------------------------------------------ *
 * 5. 仓库社交预览（1280 × 640）
 * ------------------------------------------------------------------ */

const ogHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:1280px;height:640px;overflow:hidden}
  body{background:#080a0e;color:#fff;position:relative;padding:0 96px;
       display:flex;flex-direction:column;justify-content:center;
       font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
  .grid{position:absolute;inset:0;opacity:.13;
        background-image:linear-gradient(#ffffff12 1px,transparent 1px),linear-gradient(90deg,#ffffff12 1px,transparent 1px);
        background-size:64px 64px;
        mask-image:radial-gradient(ellipse at 50% 50%,#000,transparent 76%)}
  .inner{position:relative;display:flex;align-items:center;gap:56px}
  h1{font-size:68px;letter-spacing:-.04em;line-height:1;font-weight:700}
  p{margin-top:20px;font-size:22px;color:#98a2b1;letter-spacing:.02em}
  .tags{margin-top:36px;display:flex;gap:10px;flex-wrap:wrap}
  .tags i{font-style:normal;font-size:13px;color:#c4ccd8;border:1px solid #ffffff21;
          border-radius:999px;padding:6px 15px;background:#ffffff08;letter-spacing:.02em}
  .foot{position:absolute;left:96px;bottom:54px;font-size:15px;color:#5d6675;letter-spacing:.1em}
</style></head><body>
  <div class="grid"></div>
  <div class="inner">${sq(178, '#ffffff')}
    <div>
      <h1>Nexus Admin</h1>
      <p>模块化 · 零依赖组件库 · 高性能后台模板</p>
      <div class="tags"><i>React 19</i><i>Vite 8</i><i>TypeScript</i><i>Tailwind v4</i><i>MIT</i></div>
    </div>
  </div>
  <div class="foot">开箱即用的通用管理后台 · OPEN SOURCE</div>
</body></html>`

{
  const page = await browser.newPage({
    viewport: { width: 1280, height: 640 },
    deviceScaleFactor: 2,
  })
  await page.goto(`data:text/html;charset=utf-8,${encodeURIComponent(ogHtml)}`)
  await page.waitForTimeout(250)
  await page.screenshot({ path: join(previewDir, 'og-image.png') })
  await page.close()
}
console.log('✓ og')

await browser.close()
console.log(`\n产物：${__dirname}`)
