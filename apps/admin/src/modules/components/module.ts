import { Boxes, ChartLine, Form, ListTree, MessageSquare, Sparkles } from 'lucide-react'
import { defineModule } from '@/core/module'

/**
 * 组件演示模块：模板的「橱窗」，也是文档站的主要来源
 *
 * 注意：「业务模板页」已迁到独立的 `templates` 模块（模板中心）。
 * 原页面与模板中心内容重复，保留两个入口只会让用户在两处相似的页面间混淆。
 */
export const componentsModule = defineModule({
  id: 'components',
  title: '组件与示例',
  description: '50+ 自研组件与典型用法，全部可直接复用',
  icon: Boxes,
  order: 40,
  section: 'demo',
  nav: [
    { key: 'overview', title: '组件总览', path: '/components/overview', icon: Boxes },
    { key: 'tables', title: '数据表格', path: '/components/tables', icon: ListTree },
    { key: 'charts', title: '图表可视化', path: '/components/charts', icon: ChartLine },
    { key: 'forms', title: '表单示例', path: '/components/forms', icon: Form },
    { key: 'feedback', title: '反馈与弹层', path: '/components/feedback', icon: MessageSquare },
    { key: 'premium', title: '高级视觉组件', path: '/components/premium', icon: Sparkles },
  ],
  routes: [
    { path: '/components/overview', title: '组件总览', component: () => import('./pages/gallery-page') },
    { path: '/components/tables', title: '数据表格', component: () => import('./pages/tables-page') },
    { path: '/components/charts', title: '图表可视化', component: () => import('./pages/charts-page') },
    { path: '/components/forms', title: '表单示例', component: () => import('./pages/forms-page') },
    { path: '/components/feedback', title: '反馈与弹层', component: () => import('./pages/feedback-page') },
    { path: '/components/premium', title: '高级视觉组件', component: () => import('./pages/premium-page') },
  ],
})
