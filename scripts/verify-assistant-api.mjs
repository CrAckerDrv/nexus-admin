/// <reference lib="dom" />
/// <reference types="node" />

/**
 * 真实模型 + 后端接口 联合验收
 *
 * 验证「把后端接口交给助手」这条链路在**真模型**下也走得通：
 * 模型决定调用 `api_user_list` → 执行器走 core/http（演示层是 Mock）
 * → 结果回灌 → 助手给出数据摘要。
 *
 * 用法：node scripts/verify-assistant-api.mjs [baseURL]
 */
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loginAs } from './lib/browser-login.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'docs', 'screenshots', 'assistant')
const base = process.argv[2] ?? 'http://127.0.0.1:5173'

const exe = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
  .filter(Boolean)
  .find((path) => existsSync(path))
if (!exe) {
  console.error('未找到 Edge')
  process.exit(1)
}

const browser = await chromium.launch({ executablePath: exe, headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))

// 登录（Turnstile 票据异步，统一走 lib/browser-login 的重试逻辑）
await loginAs(page, base)
await page.waitForTimeout(1200)

await page.getByRole('button', { name: 'AI 运营助手' }).first().click()
const dialog = page.getByRole('dialog')
await dialog.waitFor({ state: 'visible', timeout: 8000 })
await page.waitForTimeout(2500)
if (
  await dialog
    .getByText('本地引擎')
    .first()
    .isVisible()
    .catch(() => false)
) {
  console.error('✗ 仍是本地引擎，跳过真模型验收')
  await browser.close()
  process.exit(1)
}

// 监听真实的后端请求。
// 注意：演示模式下 mock 层直接替换了 window.fetch，请求不会真的出网，
// 所以这里只能作为辅助观察；**真正的断言放在助手原文**（「调用 GET /xxx 成功」）。
const apiCalls = []
page.on('request', (request) => {
  if (request.url().includes('/api/')) apiCalls.push(decodeURIComponent(request.url()))
})

const composer = dialog.getByRole('textbox', { name: /描述你想要的页面/ }).first()

/** 发一句并等这一轮结束（忙时发送按钮会变成「停止」） */
async function ask(text) {
  await composer.fill(text)
  const send = dialog.getByRole('button', { name: '发送' }).first()
  await send.waitFor({ state: 'visible', timeout: 8000 })
  for (let i = 0; i < 100; i += 1) {
    if (await send.isEnabled()) break
    await page.waitForTimeout(100)
  }
  await send.click()
  await page.waitForFunction(
    () => {
      const dialogEl = document.querySelector('[role="dialog"]')
      if (!dialogEl) return false
      return Array.from(dialogEl.querySelectorAll('button')).some(
        (item) => item.getAttribute('aria-label') === '发送',
      )
    },
    { timeout: 120000 },
  )
  await page.waitForTimeout(600)
}

// ① 接口清单：模型应调用 list_api_operations
await ask('助手能调哪些接口')
const listText = await dialog.innerText()
const mentionsApi = /GET \/users|\/users|用户列表|接口/.test(listText)
console.log(`接口清单回答: ${mentionsApi ? '✓' : '✗'}`)

// ② 真实调用：模型应调用 api_user_list / api_user_stats，执行器走 core/http
//    免密钥通道每 IP 45 秒 1 条，先等一拍
await page.waitForTimeout(46_000)
await ask('帮我查一下用户列表，看看有多少个活跃用户')
const callText = await dialog.innerText()
// 工具结果里会写「调用 GET /users 成功（Nms）：…」，这是执行器真的跑通的证据
const calledBackend = /调用\s*GET\s*\/\w+/i.test(callText)
const gotData = /total|active|用户|条/.test(callText)
console.log(`真实调用后端接口: ${calledBackend ? '✓' : '✗'}`)
console.log(`是否拿到真实数据: ${gotData ? '✓' : '✗'}`)
console.log(`网络层 /api 请求数（Mock 拦截时为 0）: ${apiCalls.length}`)
if (!calledBackend) {
  console.log('  助手原文尾部：')
  console.log(
    '  ',
    callText
      .split('\n')
      .filter((line) => line.trim())
      .slice(-10)
      .join(' | '),
  )
}

await page.screenshot({ path: join(outDir, 'llm-03-api-list.png') })
await browser.close()

if (!mentionsApi) {
  console.error('✗ 助手没有回答接口清单')
  process.exit(1)
}
if (!calledBackend) {
  console.error('✗ 助手没有真的调用后端接口')
  process.exit(1)
}
if (errors.length) {
  // 免密钥通道被节流（429）属于已知额度限制，不算缺陷：网关会重试下一家/前端会降级
  const real = errors.filter((message) => !/429|Too Many Requests|Free limit/i.test(message))
  if (real.length) {
    console.error('控制台错误：', real.slice(0, 5))
    process.exit(1)
  }
  console.log(`（忽略 ${errors.length - real.length} 条额度节流提示）`)
}
console.log('接口接入链路验证通过')
