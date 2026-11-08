import { create } from 'zustand'

export interface AppNotification {
  id: string
  title: string
  description: string
  tone: 'info' | 'success' | 'warning' | 'danger'
  time: string
  read: boolean
  category: 'system' | 'business' | 'security'
  href?: string
}

interface NotificationState {
  items: AppNotification[]
  markRead: (id: string) => void
  markAllRead: () => void
  remove: (id: string) => void
  unreadCount: () => number
  push: (item: AppNotification) => void
}

const seed: AppNotification[] = [
  {
    id: 'n1',
    title: '账号安全策略已更新',
    description: '自 11 月 1 日起，管理员账号强制启用两步验证。',
    tone: 'warning',
    time: '10 分钟前',
    read: false,
    category: 'security',
    href: '/system/settings',
  },
  {
    id: 'n2',
    title: '本月用户增长达标',
    description: '新增注册用户 12,846 人，环比增长 8.2%。',
    tone: 'success',
    time: '1 小时前',
    read: false,
    category: 'business',
    href: '/dashboard/overview',
  },
  {
    id: 'n3',
    title: '3 笔订单进入人工审核',
    description: '风控模型判定为高风险订单，请及时处理。',
    tone: 'danger',
    time: '2 小时前',
    read: false,
    category: 'business',
    href: '/business/orders',
  },
  {
    id: 'n4',
    title: '系统版本 v2.6 已发布',
    description: '新增虚拟滚动表格与命令面板。',
    tone: 'info',
    time: '昨天',
    read: true,
    category: 'system',
  },
]

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: seed,
  markRead: (id) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, read: true } : item)),
    })),
  markAllRead: () =>
    set((state) => ({ items: state.items.map((item) => ({ ...item, read: true })) })),
  remove: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
  unreadCount: () => get().items.filter((item) => !item.read).length,
  push: (item) => set((state) => ({ items: [item, ...state.items] })),
}))
