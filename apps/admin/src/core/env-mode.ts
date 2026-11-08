/**
 * 运行模式与第三方服务的构建期开关
 *
 * 这些值都来自 `import.meta.env`，必须在**模块顶层**求值一次：
 * Vite 在构建期把它们替换成字面量，生产包里不会残留任何运行期判断。
 *
 * 集中放在这里的原因：`main.tsx`（决定是否启动 Mock）与登录页
 * （决定人机验证是否阻断提交）读的必须是同一个开关，
 * 两处各写一份 `VITE_ENABLE_MOCK === 'true' || ...` 迟早会漂移。
 */

/**
 * 演示数据开关
 *
 * - 开发环境默认开启
 * - 生产环境默认关闭 —— 否则演示账号（含明文口令）与全量假数据会随包发布
 * - 演示站构建时用 `VITE_ENABLE_MOCK=true` 重新打开
 */
export const MOCK_ENABLED =
  import.meta.env.VITE_ENABLE_MOCK === 'true' ||
  (import.meta.env.VITE_ENABLE_MOCK !== 'false' && import.meta.env.DEV)

/**
 * 当前是否处于「没有真实后端」的演示态
 *
 * 演示态下后端校验无从谈起，人机验证只能渲染不能强制 —— 详见 `core/turnstile.ts`。
 */
export const DEMO_MODE = MOCK_ENABLED

/**
 * 真实用户监控（RUM）开关
 *
 * 默认开启：上报走 `POST /api/vitals`，没有该端点时静默失败（见 `core/vitals.ts`）。
 * 私有化 / 离线部署可用 `VITE_ENABLE_VITALS=false` 一键关掉。
 */
export const VITALS_ENABLED = import.meta.env.VITE_ENABLE_VITALS !== 'false'
