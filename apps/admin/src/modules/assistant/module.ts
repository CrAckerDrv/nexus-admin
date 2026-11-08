import { Bot, MessageSquareText } from 'lucide-react'
import { defineModule } from '@/core/module'

/**
 * AI 运营助手模块
 *
 * 只贡献一个「完整工作台」路由；顶栏那个常驻按钮才是主入口（浮层）。
 * 单独给一个整页的理由：
 * - 需求描述里包含较长的上下文（粘贴接口文档、连续改几版），浮层里施展不开
 * - 便于把「助手能力」当作一个模块讲解给客户看（导航上有入口，文档好指路）
 */
export const assistantModule = defineModule({
  id: 'assistant',
  title: 'AI 助手',
  description: '生成页面、调后端、改配色；支持 SDK 接入与零代码开发',
  icon: Bot,
  order: 25,
  section: 'main',
  nav: [
    {
      key: 'workspace',
      title: 'AI 运营助手',
      path: '/assistant/workspace',
      icon: MessageSquareText,
    },
  ],
  routes: [
    {
      path: '/assistant/workspace',
      title: 'AI 运营助手',
      titleKey: undefined,
      component: () => import('./pages/workspace-page'),
    },
  ],
})
