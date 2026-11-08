import { useCallback, useRef, useState } from 'react'

/**
 * 撤销 / 重做栈
 *
 * 只存「文档快照」，不存指令流：
 * 画布文档是小的（节点 + 连线，KB 级），快照最直观、最不容易出错；
 * 若将来文档大到 MB 级，再换成 patch 流即可 —— 接口不变。
 *
 * 合并策略：
 * 同一窗口内（默认 600ms）的同类操作（拖拽、缩放、连续输入）合并为一步，
 * 否则拖一次节点会塞进上百个历史记录，用户按 Ctrl+Z 要按一百下。
 */

export interface HistoryOptions {
  /** 历史上限（超出后丢最早的一条） */
  limit?: number
  /** 合并窗口（ms） */
  mergeWindow?: number
}

interface HistoryEntry<T> {
  snapshot: T
  /** 操作标签，用于「撤销 xxx」提示 */
  label: string
  /** 最后写入时间，用于合并判断 */
  time: number
}

export interface HistoryController<T> {
  /** 提交一个新快照 */
  push: (snapshot: T, label: string, mergeKey?: string) => void
  /** 撤销，返回上一个快照 */
  undo: () => { snapshot: T; label: string } | null
  /** 重做 */
  redo: () => { snapshot: T; label: string } | null
  canUndo: () => boolean
  canRedo: () => boolean
  /** 清空（换文档时用） */
  reset: (snapshot: T) => void
  /** 当前栈深（调试/展示用） */
  depth: () => { undo: number; redo: number }
}

/**
 * 创建历史控制器（非 Hook，方便在事件回调里直接用）
 *
 * 为什么不做成 hook：撤销/重做本质是「命令式调用 + 快照回放」，
 * 用 hook 包一层反而会让宿主每次 push 都触发重渲染。
 */
export function createHistory<T>(initial: T, options: HistoryOptions = {}): HistoryController<T> {
  const limit = options.limit ?? 60
  const mergeWindow = options.mergeWindow ?? 600
  const stack: HistoryEntry<T>[] = [{ snapshot: initial, label: '初始状态', time: 0 }]
  let cursor = 0
  let lastMergeKey: string | null = null
  let lastMergeTime = 0

  return {
    push(snapshot, label, mergeKey) {
      const now =
        typeof performance !== 'undefined' ? performance.now() : Date.parse(new Date().toISOString())

      // 合并：同一 mergeKey 且间隔小于窗口 → 直接替换栈顶快照
      const canMerge =
        mergeKey !== undefined &&
        mergeKey === lastMergeKey &&
        cursor === stack.length - 1 &&
        now - lastMergeTime < mergeWindow &&
        cursor > 0

      // 先丢弃 redo 分支
      if (cursor < stack.length - 1) stack.splice(cursor + 1)

      if (canMerge) {
        stack[cursor] = { snapshot, label, time: now }
      } else {
        stack.push({ snapshot, label, time: now })
        cursor = stack.length - 1
        while (stack.length > limit) {
          stack.shift()
          cursor -= 1
        }
      }

      if (mergeKey === undefined) lastMergeKey = null
      else lastMergeKey = mergeKey
      lastMergeTime = now
    },

    undo() {
      if (cursor <= 0) return null
      cursor -= 1
      lastMergeKey = null
      const entry = stack[cursor]!
      return { snapshot: entry.snapshot, label: stack[cursor + 1]?.label ?? entry.label }
    },

    redo() {
      if (cursor >= stack.length - 1) return null
      cursor += 1
      lastMergeKey = null
      const entry = stack[cursor]!
      return { snapshot: entry.snapshot, label: entry.label }
    },

    canUndo() {
      return cursor > 0
    },

    canRedo() {
      return cursor < stack.length - 1
    },

    reset(snapshot) {
      stack.length = 0
      stack.push({ snapshot, label: '初始状态', time: 0 })
      cursor = 0
      lastMergeKey = null
      lastMergeTime = 0
    },

    depth() {
      return { undo: cursor, redo: stack.length - 1 - cursor }
    },
  }
}

/**
 * React 绑定：把历史栈的可撤销/可重做状态暴露给按钮
 *
 * 返回的 `history` 是稳定引用，事件回调里可以直接用；
 * `state` 只在栈深变化时更新（不会因为快照内容变化而重渲染）。
 */
export function useCanvasHistory<T>(initial: T, options?: HistoryOptions) {
  const historyRef = useRef<HistoryController<T> | null>(null)
  if (!historyRef.current) historyRef.current = createHistory(initial, options)
  const history = historyRef.current

  const [state, setState] = useState(() => history.depth())

  const sync = useCallback(() => {
    const next = history.depth()
    setState((prev) =>
      prev.undo === next.undo && prev.redo === next.redo ? prev : next,
    )
  }, [history])

  return { history, historyState: state, syncHistory: sync }
}
