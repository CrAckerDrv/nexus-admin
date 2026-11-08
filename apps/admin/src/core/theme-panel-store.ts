import { create } from 'zustand'

/**
 * 主题设置面板的开关状态
 *
 * 单独抽一个 store：
 * - 面板可以从顶栏、命令面板、系统设置页、快捷键多处打开，用 store 避免层层传 props
 * - 面板本身挂在 AppShell 上（而非 Dropdown 里），因此可以做得更大、分组更完整
 * - 带一个 `tab`：从系统设置页「按区域自定义配色」跳进来时直接落到调色盘，
 *   而不是让用户自己去点第四个页签
 */
export type ThemePanelTab = 'basic' | 'skin' | 'palette' | 'layout' | 'detail'

interface ThemePanelState {
  open: boolean
  tab: ThemePanelTab
  setOpen: (open: boolean) => void
  /** 打开面板并直接切到指定页签 */
  openAt: (tab: ThemePanelTab) => void
  setTab: (tab: ThemePanelTab) => void
  toggle: () => void
}

export const useThemePanelStore = create<ThemePanelState>((set) => ({
  open: false,
  tab: 'basic',
  setOpen: (open) => set({ open }),
  openAt: (tab) => set({ open: true, tab }),
  setTab: (tab) => set({ tab }),
  toggle: () => set((state) => ({ open: !state.open })),
}))
