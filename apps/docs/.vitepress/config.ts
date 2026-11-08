import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Nexus Admin',
  description: '模块化、高性能、零依赖组件库的通用管理后台模板',
  base: process.env.DOCS_BASE ?? '/',
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#111318' }],
  ],
  themeConfig: {
    logo: { light: '/logo.svg', dark: '/logo-white.svg' },
    nav: [
      { text: '指南', link: '/guide/introduction', activeMatch: '/guide/' },
      { text: '架构', link: '/architecture/module', activeMatch: '/architecture/' },
      { text: '组件', link: '/components/overview', activeMatch: '/components/' },
      { text: '仓库', link: 'https://github.com/CrAckerDrv/nexus-admin' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: '开始',
          items: [
            { text: '项目介绍', link: '/guide/introduction' },
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '目录结构', link: '/guide/structure' },
            { text: '演示账号与权限', link: '/guide/accounts' },
          ],
        },
        {
          text: '进阶',
          items: [
            { text: 'AI 运营助手', link: '/guide/assistant' },
            { text: '主题与设计令牌', link: '/guide/theming' },
            { text: '多语言（i18n）', link: '/guide/i18n' },
            { text: '动效与过渡', link: '/guide/motion' },
            { text: '接入真实后端', link: '/guide/backend' },
            { text: '常见问题', link: '/guide/faq' },
          ],
        },
      ],
      '/architecture/': [
        {
          text: '架构',
          items: [
            { text: '模块协议', link: '/architecture/module' },
            { text: '路由与懒加载', link: '/architecture/routing' },
            { text: '权限模型', link: '/architecture/permission' },
            { text: '数据流', link: '/architecture/data-flow' },
            { text: '性能设计', link: '/architecture/performance' },
          ],
        },
      ],
      '/components/': [
        {
          text: '组件',
          items: [
            { text: '组件总览', link: '/components/overview' },
            { text: '基础组件', link: '/components/basic' },
            { text: '表单组件', link: '/components/form' },
            { text: '数据展示', link: '/components/data' },
            { text: '反馈组件', link: '/components/feedback' },
            { text: '资源与编辑器', link: '/components/media' },
            { text: '图表封装', link: '/components/charts' },
            { text: '无限画布', link: '/components/canvas' },
          ],
        },
        {
          text: '模板中心',
          items: [
            { text: '模板总览', link: '/templates/overview' },
            { text: '运营大屏', link: '/templates/command-center' },
            { text: '城市运行大屏', link: '/templates/city' },
            { text: '生产制造大屏', link: '/templates/manufacturing' },
            { text: '大促战报大屏', link: '/templates/campaign' },
            { text: '智算中心大屏', link: '/templates/compute' },
            { text: '项目看板', link: '/templates/kanban' },
            { text: '甘特图排期', link: '/templates/gantt' },
            { text: 'AI 助手对话', link: '/templates/ai-chat' },
            { text: '工作流设计器', link: '/templates/workflow' },
            { text: '无限画布', link: '/templates/infinite-canvas' },
            { text: '文件管理器', link: '/templates/files' },
            { text: '资源与编辑器', link: '/templates/media-workbench' },
          ],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/CrAckerDrv/nexus-admin' }],
    footer: {
      message: '基于 MIT 协议开源',
      copyright: 'Copyright © 2026 Nexus Admin Contributors',
    },
    outline: { label: '本页目录', level: [2, 3] },
    docFooter: { prev: '上一篇', next: '下一篇' },
    search: { provider: 'local' },
  },
})
