/**
 * 表单校验（零依赖）
 *
 * 为什么不用 zod 校验登录表单：
 * zod 压缩后约 84 kB，而登录页是应用入口 —— 为了校验两个字段
 * 把它放进关键路径不划算。响应契约那类「开发期才有价值」的校验
 * 走 `services/schemas.ts` 的 zod（动态加载、生产构建里整块消失）。
 *
 * 这里保留与 zod 一致的 `errors` 形状，页面代码不感知实现差异。
 */

export interface Validated<T> {
  ok: boolean
  values: T
  errors: Partial<Record<keyof T, string>>
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface LoginFormValues {
  email: string
  password: string
}

export type ValidationKey =
  | 'validation.emailRequired'
  | 'validation.emailInvalid'
  | 'validation.passwordRequired'
  | 'validation.passwordTooShort'

/** 无翻译函数时的中文兜底（纯函数场景，如单测） */
const FALLBACK: Record<ValidationKey, string> = {
  'validation.emailRequired': '请输入邮箱',
  'validation.emailInvalid': '邮箱格式不正确',
  'validation.passwordRequired': '请输入密码',
  'validation.passwordTooShort': '密码至少 6 位',
}

/** 调用方可传入 `t`，让错误提示跟随界面语言；不传则保持零依赖纯函数 */
export function validateLoginForm(
  input: LoginFormValues,
  tr: (key: ValidationKey) => string = (key) => FALLBACK[key],
): Validated<LoginFormValues> {
  const errors: Partial<Record<keyof LoginFormValues, string>> = {}
  const email = input.email.trim()

  if (!email) errors.email = tr('validation.emailRequired')
  else if (!EMAIL_RE.test(email)) errors.email = tr('validation.emailInvalid')

  if (!input.password) errors.password = tr('validation.passwordRequired')
  else if (input.password.length < 6) errors.password = tr('validation.passwordTooShort')

  return {
    ok: Object.keys(errors).length === 0,
    values: { email, password: input.password },
    errors,
  }
}
