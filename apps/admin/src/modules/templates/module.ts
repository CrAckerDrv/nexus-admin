import {
  Bot,
  FolderOpen,
  GanttChartSquare,
  Images,
  Infinity as InfinityIcon,
  KanbanSquare,
  LayoutTemplate,
  MonitorPlay,
  RectangleHorizontal,
  Workflow,
} from 'lucide-react'
import { defineModule } from '@/core/module'
import { SCREENS } from './pages/screen-meta'

/**
 * 模板中心
 *
 * 定位：从「能跑」到「好看好用」的那一层。
 * 这里不是组件清单，而是一组可以直接复制的**完整页面骨架**——
 * 每个页面都用了真实的数据形状与交互，不是静态截图。
 *
 * 分组方式：按「解决什么问题」而不是「用了什么组件」分类，
 * 便于使用者在几十秒内找到「我现在要做的那个页面」。
 *
 * 大屏单独成组：入口页只做「选型」（看清每块屏适合什么系统），
 * 真正的屏是独立路由，点进去才在新标签页打开 —— 不占用工作区页签。
 */
export const templatesModule = defineModule({
  id: 'templates',
  title: '模板中心',
  description:
    '8 块风格各异的大屏 + 8 个业务页面骨架：横幅、看板、甘特、工作流、无限画布、AI 对话、文件管理、资源与编辑器',
  icon: LayoutTemplate,
  order: 35,
  section: 'demo',
  nav: [
    {
      key: 'overview',
      title: '模板总览',
      path: '/templates/overview',
      icon: LayoutTemplate,
    },
    // 横幅是「区块级」模板：不像大屏那样整页独占，也不像看板那样是一整套交互，
    // 所以与总览并列，而不是塞进某个分组里
    {
      key: 'banner',
      title: '横幅模板',
      path: '/templates/banner',
      icon: RectangleHorizontal,
    },
    {
      key: 'group-screens',
      title: '数据大屏',
      icon: MonitorPlay,
      children: [
        // 入口页：在应用内打开，用来看「有哪些屏、适合什么系统」
        {
          key: 'screen-gallery',
          title: '大屏模板',
          path: '/templates/screens',
          icon: LayoutTemplate,
        },
        // 八种具体大屏：独立路由 + 新标签页
        ...SCREENS.map((screen) => ({
          key: screen.id,
          title: screen.title,
          path: screen.path,
          icon: screen.icon,
          openInNewTab: true,
        })),
      ],
    },
    {
      key: 'group-workflow',
      title: '协作与流程',
      icon: KanbanSquare,
      children: [
        {
          key: 'kanban',
          title: '项目看板',
          path: '/templates/kanban',
          icon: KanbanSquare,
        },
        {
          key: 'gantt',
          title: '甘特图排期',
          path: '/templates/gantt',
          icon: GanttChartSquare,
        },
        {
          key: 'workflow',
          title: '工作流设计器',
          path: '/templates/workflow',
          icon: Workflow,
        },
        // 紧挨着工作流设计器：两者都是「画布 + 连线」，但这一页是内容创作向的无限画布
        {
          key: 'infinite-canvas',
          title: '无限画布',
          path: '/templates/infinite-canvas',
          icon: InfinityIcon,
        },
      ],
    },
    {
      key: 'group-content',
      title: '智能与内容',
      icon: Bot,
      children: [
        {
          key: 'ai-chat',
          title: 'AI 助手对话',
          path: '/templates/ai-chat',
          icon: Bot,
        },
        {
          key: 'files',
          title: '文件管理器',
          path: '/templates/files',
          icon: FolderOpen,
        },
        // 资源工作台紧挨文件管理器：两者都是「资源」主题，
        // 区别在于一个管存取、一个管显示与编辑（图片 / 视频 / 音频 → 四种编辑器）
        {
          key: 'media-workbench',
          title: '资源与编辑器',
          path: '/templates/media-workbench',
          icon: Images,
        },
      ],
    },
  ],
  routes: [
    {
      path: '/templates/overview',
      title: '模板总览',
      component: () => import('./pages/overview-page'),
    },
    {
      path: '/templates/banner',
      title: '横幅模板',
      component: () => import('./pages/banner-page'),
    },
    {
      path: '/templates/screens',
      title: '大屏模板',
      component: () => import('./pages/screen-gallery-page'),
    },
    // 八块大屏：独立页面，不套侧栏/顶栏/页签
    ...SCREENS.map((screen) => ({
      path: screen.path,
      title: screen.title,
      component: screen.load,
      standalone: true,
    })),
    {
      path: '/templates/gantt',
      title: '甘特图排期',
      component: () => import('./pages/gantt-page'),
    },
    {
      path: '/templates/kanban',
      title: '项目看板',
      component: () => import('./pages/kanban-page'),
    },
    {
      path: '/templates/workflow',
      title: '工作流设计器',
      component: () => import('./pages/workflow-page'),
    },
    {
      path: '/templates/infinite-canvas',
      title: '无限画布',
      component: () => import('./pages/infinite-canvas-page'),
    },
    {
      path: '/templates/ai-chat',
      title: 'AI 助手对话',
      component: () => import('./pages/ai-chat-page'),
    },
    {
      path: '/templates/files',
      title: '文件管理器',
      component: () => import('./pages/files-page'),
    },
    {
      path: '/templates/media-workbench',
      title: '资源与编辑器',
      component: () => import('./pages/media-workbench-page'),
    },
  ],
})
