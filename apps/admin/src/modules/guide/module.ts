import {
  BookOpenText,
  Boxes,
  GraduationCap,
  Package,
  PlugZap,
  Puzzle,
  ScrollText,
  Sparkles,
  Workflow,
} from 'lucide-react'
import { defineModule } from '@/core/module'

/**
 * 开发指南模块
 *
 * 定位：**这个项目自己的文档**，而不是通用模板说明。
 * 原来的「帮助中心」只是一个弹窗，三句话讲完模块化 / 组件库 / 接后端，
 * 对「我要把这个模板接到我们后端」的人来说信息量远远不够。
 *
 * 现在它成为侧边栏里的一组页面，按「一个新人接手这个项目会遇到的顺序」排列：
 *
 * ① 指南总览   —— 一次请求的完整链路、需要知道的文件、推荐上手顺序
 * ② 接入后端   —— 环境变量 / 关闭 Mock / 鉴权 / 契约 / 数据层 / 权限 / 错误 / 部署 / 自查
 * ③ 新增模块   —— 两个文件加一个模块，含字段速查表
 * ④ 接口契约   —— 后端需要实现的接口清单（可搜索）
 * ⑤ AI 助手 SDK —— @nexus/ai-sdk 的契约、扩展点与坑（本仓库新增的包）
 * ⑥ 组件库     —— @nexus/ui 的构成、设计令牌、双模受控与主题联动
 *
 * 放在 demo 分区而不是主业务区：它是「开发者看的东西」，
 * 和日常运营入口分开，避免新同事把文档当成业务功能。
 */
export const guideModule = defineModule({
  id: 'guide',
  title: '开发指南',
  description: '对接后端、新增模块、接口契约、AI SDK 与组件库：这个项目的完整开发手册',
  icon: BookOpenText,
  order: 45,
  section: 'demo',
  nav: [
    {
      key: 'overview',
      title: '指南总览',
      path: '/guide/overview',
      icon: GraduationCap,
    },
    {
      key: 'backend',
      title: '接入后端',
      path: '/guide/backend',
      icon: PlugZap,
      badge: '必读',
    },
    {
      key: 'module',
      title: '新增模块',
      path: '/guide/module',
      icon: Puzzle,
    },
    {
      key: 'contract',
      title: '接口契约',
      path: '/guide/contract',
      icon: ScrollText,
    },
    {
      key: 'group-sdk',
      title: 'SDK 与组件库',
      icon: Package,
      children: [
        {
          key: 'ai-sdk',
          title: 'AI 助手 SDK',
          path: '/guide/ai-sdk',
          icon: Sparkles,
        },
        {
          key: 'ui-kit',
          title: '组件库 @nexus/ui',
          path: '/guide/ui-kit',
          icon: Boxes,
        },
      ],
    },
    {
      key: 'workflow',
      title: '协作流程',
      path: '/guide/workflow',
      icon: Workflow,
    },
  ],
  routes: [
    {
      path: '/guide/overview',
      title: '指南总览',
      component: () => import('./pages/overview-page'),
    },
    {
      path: '/guide/backend',
      title: '接入后端',
      component: () => import('./pages/backend-page'),
    },
    {
      path: '/guide/module',
      title: '新增模块',
      component: () => import('./pages/module-page'),
    },
    {
      path: '/guide/contract',
      title: '接口契约',
      component: () => import('./pages/contract-page'),
    },
    {
      path: '/guide/ai-sdk',
      title: 'AI 助手 SDK',
      component: () => import('./pages/ai-sdk-page'),
    },
    {
      path: '/guide/ui-kit',
      title: '组件库 @nexus/ui',
      component: () => import('./pages/ui-kit-page'),
    },
    {
      path: '/guide/workflow',
      title: '协作流程',
      component: () => import('./pages/workflow-page'),
    },
  ],
})
