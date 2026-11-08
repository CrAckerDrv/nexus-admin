import { FileText, ShoppingCart, Users } from 'lucide-react'
import { defineModule } from '@/core/module'

/** 业务管理模块：用户 / 订单 / 内容 */
export const businessModule = defineModule({
  id: 'business',
  title: '业务管理',
  description: '用户、订单与内容运营的日常管理',
  icon: Users,
  order: 20,
  section: 'main',
  nav: [
    {
      key: 'users',
      title: '用户管理',
      path: '/business/users',
      icon: Users,
      permission: 'user:read',
    },
    {
      key: 'orders',
      title: '订单管理',
      path: '/business/orders',
      icon: ShoppingCart,
      permission: 'order:read',
      badge: 12,
    },
    {
      key: 'content',
      title: '内容中心',
      path: '/business/content',
      icon: FileText,
      permission: 'content:read',
    },
  ],
  routes: [
    {
      path: '/business/users',
      title: '用户管理',
      permission: 'user:read',
      component: () => import('./pages/users-page'),
    },
    {
      path: '/business/orders',
      title: '订单管理',
      permission: 'order:read',
      component: () => import('./pages/orders-page'),
    },
    {
      path: '/business/content',
      title: '内容中心',
      permission: 'content:read',
      component: () => import('./pages/content-page'),
    },
  ],
})
