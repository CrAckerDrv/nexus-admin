import { TriangleAlert } from 'lucide-react'
import { defineModule } from '@/core/module'

/** 异常页模块：403 / 404 / 500 / 维护中 */
export const errorModule = defineModule({
  id: 'errors',
  title: '异常页',
  description: '403 / 404 / 500 与维护中状态页模板',
  icon: TriangleAlert,
  order: 60,
  nav: [
    {
      key: '403',
      title: '403 无权限',
      path: '/errors/403',
      icon: TriangleAlert,
    },
    {
      key: '500',
      title: '500 服务异常',
      path: '/errors/500',
      icon: TriangleAlert,
    },
  ],
  routes: [
    { path: '/errors/403', title: '403', component: () => import('./pages/forbidden-page') },
    { path: '/errors/500', title: '500', component: () => import('./pages/server-error-page') },
  ],
})
