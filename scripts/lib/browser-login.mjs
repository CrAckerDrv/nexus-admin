/// <reference lib="dom" />

/**
 * 验收脚本的登录辅助
 *
 * 登录页现在带 Cloudflare Turnstile（演示态用「永远通过」的测试 key），
 * 但 token 是**异步**拿到的：点得太快会被前端门禁拦在「请先完成人机验证」。
 * 这里把「等 token → 点登录 → 没跳转就重试」收敛成一处，
 * 免得每个验收脚本各写一遍，也免得 CI 上偶发失败。
 */

const isCaptchaBlocked = async (page) =>
  page
    .locator('body')
    .innerText()
    .then((text) => /人机验证|captcha/i.test(text))
    .catch(() => false)

/**
 * 登录并等到应用外壳就绪
 *
 * @param {import('playwright-core').Page} page
 * @param {string} base
 * @param {{ role?: RegExp; attempts?: number }} [options]
 */
export async function loginAs(page, base, options = {}) {
  const role = options.role ?? /超级管理员/
  const attempts = options.attempts ?? 12

  // 用 domcontentloaded 而不是 networkidle：dev server 在 HMR 期间会持续有连接，
  // networkidle 会一直等不到「500ms 无网络活动」而超时（白等 30s）
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.getByRole('button', { name: role }).first().waitFor({ timeout: 30000 })

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const quickRole = page.getByRole('button', { name: role }).first()
    if (await quickRole.count()) await quickRole.click()
    // Turnstile 通常 0.3~2s 内回填 token；先给它一拍
    await page.waitForTimeout(1200)
    await page.getByRole('button', { name: '登录', exact: true }).click()

    try {
      await page.waitForURL('**/dashboard/overview', { timeout: 8000 })
      await page.waitForTimeout(900)
      return
    } catch {
      // 没跳转：多半是票据还没就绪，等下一轮
      const blocked = await isCaptchaBlocked(page)
      if (!blocked && attempt === attempts - 1) break
      await page.waitForTimeout(1500)
    }
  }

  throw new Error(
    '登录失败：人机验证票据未能及时就绪（可临时设 VITE_TURNSTILE_ENFORCE=false 联调）',
  )
}
