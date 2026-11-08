import type { CurrentUser } from '@/core/auth-store'

/**
 * 演示账号
 *
 * 单独放在 mock 目录下，**只能**通过 `main.tsx` 的 `MOCK_ENABLED` 分支被动态 import。
 * 之前它直接写在 `core/auth-store.ts` 里，导致生产包里带着 `admin@nexus.dev / nexus123`
 * —— 相当于把演示口令随包发给了所有人。
 */

export interface DemoAccount {
  email: string
  password: string
  label: string
  tone: 'primary' | 'success' | 'warning'
  user: CurrentUser
}

export const DEMO_PASSWORD = 'nexus123'

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'admin@nexus.dev',
    password: DEMO_PASSWORD,
    label: '超级管理员',
    tone: 'primary',
    user: {
      id: 'u_1001',
      name: '陈彦之',
      email: 'admin@nexus.dev',
      role: 'super_admin',
      roleName: '超级管理员',
      department: '平台技术部',
      permissions: ['*'],
    },
  },
  {
    email: 'operator@nexus.dev',
    password: DEMO_PASSWORD,
    label: '运营专员',
    tone: 'success',
    user: {
      id: 'u_1002',
      name: '林知夏',
      email: 'operator@nexus.dev',
      role: 'operator',
      roleName: '运营专员',
      department: '用户增长组',
      permissions: ['user:read', 'user:write', 'order:read', 'content:read', 'content:write'],
    },
  },
  {
    email: 'viewer@nexus.dev',
    password: DEMO_PASSWORD,
    label: '只读访客',
    tone: 'warning',
    user: {
      id: 'u_1003',
      name: '周予安',
      email: 'viewer@nexus.dev',
      role: 'viewer',
      roleName: '只读访客',
      department: '数据分析组',
      permissions: ['user:read', 'order:read', 'content:read', 'audit:read'],
    },
  },
]

/** 演示环境校验账号密码，命中则返回对应身份 */
export function authenticateDemo(email: string, password: string): CurrentUser | null {
  const normalized = email.trim().toLowerCase()
  const account = DEMO_ACCOUNTS.find((item) => item.email === normalized)
  if (!account || account.password !== password) return null
  return account.user
}
