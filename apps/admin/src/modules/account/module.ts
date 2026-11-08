import { UserRound } from 'lucide-react'
import { defineModule } from '@/core/module'

/**
 * 账号模块
 *
 * 只放「与当前登录人相关」的页面，与「系统管理」（全局配置）区分开：
 * - 个人资料：顶栏头像菜单进入，因此**不出现在侧边栏**
 * - 后续可扩展：通知偏好、API 令牌、登录审计（个人视角）
 */
export const accountModule = defineModule({
  id: 'account',
  title: '账号',
  description: '个人资料与账号安全',
  icon: UserRound,
  order: 90,
  nav: [],
  routes: [
    {
      path: '/account/profile',
      title: '个人资料',
      component: () => import('./pages/profile-page'),
    },
  ],
})
