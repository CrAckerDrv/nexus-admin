import { Building, ShieldCheck } from 'lucide-react'
import { defineModule } from '@/core/module'

/** 组织与权限模块 */
export const organizationModule = defineModule({
  id: 'organization',
  title: '组织与权限',
  description: '组织架构、角色与权限策略',
  icon: Building,
  order: 30,
  section: 'main',
  nav: [
    {
      key: 'structure',
      title: '组织架构',
      path: '/organization/structure',
      icon: Building,
    },
    {
      key: 'roles',
      title: '角色权限',
      path: '/organization/roles',
      icon: ShieldCheck,
      permission: 'role:read',
    },
  ],
  routes: [
    {
      path: '/organization/structure',
      title: '组织架构',
      component: () => import('./pages/structure-page'),
    },
    {
      path: '/organization/roles',
      title: '角色权限',
      permission: 'role:read',
      component: () => import('./pages/roles-page'),
    },
  ],
})
