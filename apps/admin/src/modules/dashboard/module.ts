import { Activity, ChartLine, LayoutDashboard } from 'lucide-react'
import { defineModule } from '@/core/module'

/** 工作台模块：概览 + 数据分析 + 性能监控 */
export const dashboardModule = defineModule({
  id: 'dashboard',
  title: '工作台',
  description: '数据概览、趋势分析与服务器性能监控',
  icon: LayoutDashboard,
  order: 10,
  section: 'main',
  // 只有三个一级入口，且是登录后的默认落点：不折叠，直接平铺在侧栏顶部
  grouped: false,
  nav: [
    {
      key: 'overview',
      title: '经营概览',
      path: '/dashboard/overview',
      icon: LayoutDashboard,
    },
    {
      key: 'analytics',
      title: '数据分析',
      path: '/dashboard/analytics',
      icon: ChartLine,
    },
    {
      key: 'performance',
      title: '性能监控',
      path: '/dashboard/performance',
      icon: Activity,
    },
  ],
  routes: [
    {
      path: '/dashboard/overview',
      title: '经营概览',
      component: () => import('./pages/overview-page'),
    },
    {
      path: '/dashboard/analytics',
      title: '数据分析',
      component: () => import('./pages/analytics-page'),
    },
    {
      path: '/dashboard/performance',
      title: '性能监控',
      component: () => import('./pages/performance-page'),
    },
  ],
})
