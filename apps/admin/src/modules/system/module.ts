import { Settings, ShieldAlert } from 'lucide-react'
import { defineModule } from '@/core/module'

/** 系统模块：审计日志、设置、异常页 */
export const systemModule = defineModule({
  id: 'system',
  title: '系统管理',
  description: '审计、外观设置与异常页示例',
  icon: Settings,
  order: 50,
  section: 'main',
  nav: [
    {
      key: 'audit',
      title: '审计日志',
      path: '/system/audit',
      icon: ShieldAlert,
      permission: 'audit:read',
    },
    {
      key: 'settings',
      title: '系统设置',
      path: '/system/settings',
      icon: Settings,
      // 与 README 的账号矩阵一致：运营专员/只读访客都没有系统设置入口
      permission: 'settings:read',
    },
  ],
  routes: [
    {
      path: '/system/audit',
      title: '审计日志',
      permission: 'audit:read',
      component: () => import('./pages/audit-page'),
    },
    {
      path: '/system/settings',
      title: '系统设置',
      permission: 'settings:read',
      component: () => import('./pages/settings-page'),
    },
  ],
})
