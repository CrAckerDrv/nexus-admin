/**
 * 截图/测量脚本的登录辅助
 *
 * 为什么不点登录按钮：登录表单挂着 Cloudflare Turnstile 人机验证，
 * headless 环境下会一直停在「正在等待人机验证结果…」，无法自动通过。
 * 而鉴权状态本来就持久化在 localStorage 的 `nexus-auth`（zustand persist），
 * 直接写入等价的状态即可，比在测试里绕过验证组件更稳定。
 */
export const DEMO_ADMIN = {
  id: 'u_1001',
  name: '陈彦之',
  email: 'admin@nexus.dev',
  role: 'super_admin',
  roleName: '超级管理员',
  department: '平台技术部',
  permissions: ['*'],
}

/** 在页面首次加载前注入已登录状态 */
export async function seedAuth(page, base = 'http://127.0.0.1:5173') {
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.evaluate((user) => {
    localStorage.setItem(
      'nexus-auth',
      JSON.stringify({
        state: { token: 'demo-token', user, status: 'authenticated' },
        version: 0,
      }),
    )
  }, DEMO_ADMIN)
}

/** 注入并进入指定路由 */
export async function gotoAuthed(page, route, base = 'http://127.0.0.1:5173') {
  await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(1200)
  if (page.url().includes('/login')) {
    await seedAuth(page, base)
    await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(1200)
  }
}
