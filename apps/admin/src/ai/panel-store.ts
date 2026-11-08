import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 助手抽屉的界面状态
 *
 * 与主题面板一致，独立成 store：顶栏按钮、快捷键（Ctrl/⌘ + J）、命令面板、
 * 「生成成功 → 自动打开」都改同一份状态，用 props 逐层传会污染整条外壳链路。
 *
 * `width` 单独持久化：用户拖过一次宽度之后，下次打开应当还是那个宽度 ——
 * 这是「侧边抽屉」相对「浮层」最实用的差别（能自己决定给对话留多少地方）。
 */
export const ASSISTANT_WIDTH_MIN = 380
export const ASSISTANT_WIDTH_MAX = 880
export const ASSISTANT_WIDTH_DEFAULT = 552

interface AssistantPanelState {
  open: boolean
  /**
   * 是否「打开过」（一旦为 true 就不再回落）
   *
   * 外壳用它决定要不要挂载懒加载的抽屉：挂载过一次之后保持挂载，
   * 这样反复开关不会丢掉草稿与滚动位置，也不需要在外壳里写
   * `useEffect(() => setState(true))`（那条写法会触发级联渲染告警）。
   */
  everOpened: boolean
  /** 会话列表是否展开（抽屉内的左侧列表） */
  sessionsOpen: boolean
  /** 抽屉宽度（px，仅桌面端生效） */
  width: number
  setOpen: (open: boolean) => void
  toggle: () => void
  setSessionsOpen: (open: boolean) => void
  toggleSessions: () => void
  setWidth: (width: number) => void
}

export const useAssistantPanelStore = create<AssistantPanelState>()(
  persist(
    (set) => ({
      open: false,
      everOpened: false,
      sessionsOpen: false,
      width: ASSISTANT_WIDTH_DEFAULT,
      setOpen: (open) =>
        set((state) => ({
          open,
          everOpened: state.everOpened || open,
          sessionsOpen: open ? state.sessionsOpen : false,
        })),
      toggle: () =>
        set((state) => ({
          open: !state.open,
          everOpened: state.everOpened || !state.open,
          sessionsOpen: !state.open ? state.sessionsOpen : false,
        })),
      setSessionsOpen: (sessionsOpen) => set({ sessionsOpen }),
      toggleSessions: () => set((state) => ({ sessionsOpen: !state.sessionsOpen })),
      setWidth: (width) =>
        set({
          width: Math.min(ASSISTANT_WIDTH_MAX, Math.max(ASSISTANT_WIDTH_MIN, Math.round(width))),
        }),
    }),
    {
      name: 'nexus-ai-panel',
      version: 1,
      // everOpened 不落盘：每次刷新都从「没打开过」开始，首屏不为 AI 付任何代价
      partialize: (state) => ({ width: state.width }),
    },
  ),
)
