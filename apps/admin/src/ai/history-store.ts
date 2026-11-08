import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AssistantHistoryPort,
  AssistantHistorySnapshot,
  AssistantStoredSession,
} from '@nexus/ai-sdk'

/**
 * 助手会话历史
 *
 * 为什么单独一个 store 而不是塞进页面库：
 * - 页面库回答「生成过哪些页面」，会话回答「聊过什么」，两者的生命周期与上限都不同
 * - 打开助手时要先渲染「上次那段对话」，历史必须同步可用（localStorage + persist 同步回填）
 *
 * 写入时机由内核控制（只在消息边界调 `save`）：流式分片每帧都写 localStorage
 * 会把主线程拖垮，这是之前踩过的坑。
 */

interface AssistantHistoryState {
  activeId: string
  sessions: AssistantStoredSession[]
  write: (snapshot: AssistantHistorySnapshot) => void
  clear: () => void
}

export const useAssistantHistory = create<AssistantHistoryState>()(
  persist(
    (set) => ({
      activeId: '',
      sessions: [],
      write: (snapshot) =>
        set({
          activeId: snapshot.activeId,
          sessions: snapshot.sessions.map((session) => ({
            ...session,
            title: session.title ?? '',
          })),
        }),
      clear: () => set({ activeId: '', sessions: [] }),
    }),
    {
      name: 'nexus-ai-sessions',
      version: 1,
      partialize: (state) => ({ activeId: state.activeId, sessions: state.sessions }),
    },
  ),
)

/** 内核用的持久化端口：读写都落到上面的 store（再由 persist 落 localStorage） */
export function createHistoryPort(): AssistantHistoryPort {
  return {
    load: () => {
      const { activeId, sessions } = useAssistantHistory.getState()
      if (!sessions.length) return undefined
      return { activeId, sessions }
    },
    save: (snapshot) => useAssistantHistory.getState().write(snapshot),
  }
}
