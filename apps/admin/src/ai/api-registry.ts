import { useSyncExternalStore } from 'react'
import { listAssistantApi, onAssistantApiChange, type AssistantApiOperation } from '@nexus/ai-sdk'

/**
 * 注册表订阅
 *
 * 单独抽出来，避免界面组件去 import `ai/index`（那一层会把执行器、页面库、
 * 传输层全部拉进来）。这里只依赖 SDK 的注册表本身。
 */

function subscribe(listener: () => void) {
  return onAssistantApiChange(listener)
}

let cached: AssistantApiOperation[] = listAssistantApi()
let cachedKey = serialize(cached)

function getSnapshot(): AssistantApiOperation[] {
  const next = listAssistantApi()
  const key = serialize(next)
  if (key !== cachedKey) {
    cached = next
    cachedKey = key
  }
  return cached
}

function serialize(operations: AssistantApiOperation[]) {
  return operations.map((op) => `${op.id}:${op.method}:${op.path}`).join('|')
}

export function useRegisteredOperations(): AssistantApiOperation[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function isOperationRegistered(id: string): boolean {
  return listAssistantApi().some((op) => op.id === id)
}
