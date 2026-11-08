import { useSyncExternalStore } from 'react'

/**
 * 助手「正在思考」状态 · 极轻量订阅
 *
 * 为什么单独做一个 store：
 * 顶栏那枚入口按钮（`AssistantLauncher`）要显示「忙碌脉冲点」，
 * 过去它用 `useAssistantSnapshot()` —— 那会静态引入 `@nexus/ai-sdk` 与整条消息渲染链，
 * 于是**每个页面**（哪怕只是打开一张表格）都要为 AI 付 ~11 kB gzip + 2 个请求。
 *
 * 现在入口按钮只订阅这一个布尔值：SDK 没加载时恒为 false，
 * 加载后由 `bootstrapAssistant` 把 `phase` 折算进来（同一 phase 不会重复通知，
 * 所以流式输出期间不会有额外重渲染）。
 */

let busy = false
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 由助手装配层调用；同值写入不触发通知 */
export function setAssistantBusy(next: boolean): void {
  if (next === busy) return
  busy = next
  listeners.forEach((listener) => listener())
}

/** 入口按钮用：只关心「是否正在跑」，不关心消息内容 */
export function useAssistantBusy(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => busy,
    () => false,
  )
}
