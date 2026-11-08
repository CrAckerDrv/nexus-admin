/**
 * 用户表格列设置验收
 */
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

const headers = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('thead th')].map((th) => th.textContent?.trim()).filter(Boolean),
  )

const ADMIN_CARD = /管理员/

await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: ADMIN_CARD }).first().click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: /超级管理员/ }).first().click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: '登录', exact: true }).click()
await page.waitForURL('**/dashboard/overview', { timeout: 20000 })
await page.goto('http://127.0.0.1:5173/business/users', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

console.log('① 初始列:', JSON.stringify(await headers()))

// 打开列设置，取消「两步验证」
await page.getByRole('button', { name: '列设置' }).first().click()
await page.waitForTimeout(400)
await page.getByRole('menuitem', { name: /两步验证/ }).click()
await page.waitForTimeout(600)
const after = await headers()
console.log('② 隐藏后:', JSON.stringify(after))
console.log('   两步验证已移除:', !after.includes('两步验证') ? 'OK' : 'FAIL')

// 刷新后应保持
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const persisted = await headers()
console.log('③ 刷新后:', JSON.stringify(persisted))
console.log('   持久化生效:', !persisted.includes('两步验证') ? 'OK' : 'FAIL')

// 操作列不可隐藏
await page.getByRole('button', { name: '列设置' }).first().click()
await page.waitForTimeout(400)
const locked = await page.getByRole('menuitem', { name: /操作/ }).isDisabled()
console.log('④ 操作列锁定:', locked ? 'OK' : 'FAIL')

await page.screenshot({ path: 'docs/screenshots/tmp/users-columns.png' })
await browser.close()
console.log(errors.length ? `错误: ${errors.join('; ')}` : '✓ 无页面错误')
