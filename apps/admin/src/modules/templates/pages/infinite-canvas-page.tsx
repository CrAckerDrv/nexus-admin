import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { InfiniteCanvas, PageContainer, SparkIcon, toast } from '@nexus/ui'
import type {
  CanvasCamera,
  CanvasContextTarget,
  CanvasMenuSection,
  CanvasNodeRenderContext,
  InfiniteCanvasHandle,
  InfiniteCanvasProps,
} from '@nexus/ui'
import { useCanvasHistory } from '@nexus/ui'
import { DemoNodeView } from '../canvas-demo/node-content'
import {
  DEMO_SCENES,
  applyAnswer,
  createChildSpec,
  createNodeSpec,
  type DemoEdge,
  type DemoNode,
  type DemoNodeKind,
} from '../canvas-demo/scene-data'
import { CanvasLibrary } from './parts/library'
import { CanvasToolbar } from './parts/toolbar'
import { CanvasStatusBar } from './parts/status-bar'
import { CanvasSelectionBar } from './parts/selection-bar'
import { CanvasHelpDialog } from './parts/help-dialog'

/**
 * 无限画布 · 演示页
 *
 * 这一页刻意保持「薄」：
 * 相机、手势、剔除、连线、吸附全在 `@nexus/ui` 的 InfiniteCanvas 里，
 * 页面只做四件事——
 *   1. 持有文档（节点 + 连线）与撤销栈；
 *   2. 决定节点内容长什么样（DemoNodeView）；
 *   3. 把「点节点」翻译成「打开该节点的 AI 对话框」；
 *   4. 演示可控的性能观测与持久化。
 *
 * 这样做的好处：任何人想复用时，复制 scene-data + node-content 就能起飞，
 * 而画布本身是稳定组件，不会因为业务改动而回退。
 */

const STORAGE_KEY = 'nexus-canvas-demo-v1'

interface PersistedDoc {
  version: 1
  sceneId: string
  nodes: DemoNode[]
  edges: DemoEdge[]
  camera: CanvasCamera
}

/** 关闭 AI 跟随点击时，只有点节点上的 AI 药丸才开对话框 */
const AI_FOLLOW_DEFAULT = true

export default function InfiniteCanvasPage() {
  const canvasRef = useRef<InfiniteCanvasHandle>(null)

  const [sceneId, setSceneId] = useState(DEMO_SCENES[0]!.id)
  const [initial] = useState<PersistedDoc>(loadInitialDoc)

  const [nodes, setNodes] = useState<DemoNode[]>(initial.nodes)
  const [edges, setEdges] = useState<DemoEdge[]>(initial.edges)
  const [camera, setCamera] = useState<CanvasCamera>(initial.camera)
  const [selection, setSelection] = useState<string[]>([])

  /**
   * AI 输入区：哪个节点正在展开
   *
   * 输入区现在长在卡片底部（CanvasAIDock），同一时刻只允许一个节点展开 ——
   * 同时开多张会让画布变成一片输入框。「正在生成」的流光态由 Dock 内部维护，
   * 页面层不再需要第二份状态。
   */
  const [aiNodeId, setAiNodeId] = useState<string | null>(null)
  const [aiFollow, setAiFollow] = useState(AI_FOLLOW_DEFAULT)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [minimapOn, setMinimapOn] = useState(true)
  const [gridOn, setGridOn] = useState(true)

  /** 性能观测 */
  const [visibleCount, setVisibleCount] = useState(0)
  const [fps, setFps] = useState(60)
  const fpsRef = useRef({ frames: 0, last: 0 })

  /** 撤销栈：文档快照 + 合并窗口 */
  const { history, historyState, syncHistory } = useCanvasHistory(
    { nodes: initial.nodes, edges: initial.edges },
    { limit: 80, mergeWindow: 700 },
  )

  /* ------------------------------ 持久化 ------------------------------ */

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const doc: PersistedDoc = { version: 1, sceneId, nodes, edges, camera }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc))
      } catch {
        /* 配额/隐私模式：忽略，不影响交互 */
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [sceneId, nodes, edges, camera])

  /* ------------------------------ FPS 观测 ------------------------------ */

  useEffect(() => {
    let frame = 0
    const tick = (now: number) => {
      const state = fpsRef.current
      if (state.last === 0) state.last = now
      state.frames += 1
      if (now - state.last >= 500) {
        setFps(Math.round((state.frames * 1000) / (now - state.last)))
        state.frames = 0
        state.last = now
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  /* ------------------------------ 文档操作 ------------------------------ */

  /** 提交一次可撤销的变更 */
  const commit = useCallback(
    (next: { nodes: DemoNode[]; edges: DemoEdge[] }, label: string, mergeKey?: string) => {
      setNodes(next.nodes)
      setEdges(next.edges)
      history.push({ nodes: next.nodes, edges: next.edges }, label, mergeKey)
      syncHistory()
    },
    [history, syncHistory],
  )

  const commitNodes = useCallback(
    (nextNodes: DemoNode[], label: string, mergeKey?: string) => {
      commit({ nodes: nextNodes, edges }, label, mergeKey)
    },
    [commit, edges],
  )

  const undo = useCallback(() => {
    const entry = history.undo()
    syncHistory()
    if (!entry) return
    setNodes(entry.snapshot.nodes)
    setEdges(entry.snapshot.edges)
    toast.success(`已撤销「${entry.label}」`)
  }, [history, syncHistory])

  const redo = useCallback(() => {
    const entry = history.redo()
    syncHistory()
    if (!entry) return
    setNodes(entry.snapshot.nodes)
    setEdges(entry.snapshot.edges)
    toast.success(`已重做「${entry.label}」`)
  }, [history, syncHistory])

  /* ------------------------------ 快捷键（文档级） ------------------------------ */

  /**
   * 快捷键统一走 ref 分发
   *
   * 原因：动作定义顺序在 effect 之后，闭包直接引用会命中
   * 「变量在声明前使用」；而且这些动作每次渲染都是新函数，
   * 挂进 effect 依赖会让监听器反复解绑重绑。用 ref 转发是标准做法。
   */
  const actionsRef = useRef<{
    undo: () => void
    redo: () => void
    duplicate: () => void
    openAI: (id: string) => void
    group: () => void
    ungroup: () => void
  } | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement
      const typing =
        active instanceof HTMLElement &&
        (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)
      if (typing) return
      const mod = event.ctrlKey || event.metaKey
      const actions = actionsRef.current
      if (!actions) return

      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) actions.redo()
        else actions.undo()
        return
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        actions.redo()
        return
      }
      if (mod && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        actions.duplicate()
        return
      }
      // ⌘G 编组 / ⇧⌘G 解组（与 Figma、Sketch 一致）
      if (mod && event.key.toLowerCase() === 'g') {
        event.preventDefault()
        if (event.shiftKey) actions.ungroup()
        else actions.group()
        return
      }
      if (event.key === 'a' && !mod && selection.length === 1) {
        actions.openAI(selection[0]!)
        return
      }
      if (event.key === '?' || (event.shiftKey && event.code === 'Slash')) {
        event.preventDefault()
        setHelpOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selection])

  /* ------------------------------ 文档动作 ------------------------------ */

  const addNode = useCallback(
    (kind: DemoNodeKind, world: { x: number; y: number }) => {
      const spec = createNodeSpec(kind, world)
      const node: DemoNode = {
        id: `n-${kind}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
        x: spec.x,
        y: spec.y,
        width: spec.width,
        height: spec.height,
        title: spec.title,
        kind: spec.kind,
        z: kind === 'group' ? -10 : undefined,
        locked: kind === 'group',
        data: spec.data,
      }
      commitNodes([...nodes, node], `新增${node.title}`)
      setSelection([node.id])
      toast.success(`已添加「${node.title}」`)
    },
    [commitNodes, nodes],
  )

  /** 从素材库拖入：落在视口中心附近并随机错开，避免完全重叠 */
  const addNodeAtViewportCenter = useCallback(
    (kind: DemoNodeKind) => {
      const current = canvasRef.current?.getCamera() ?? camera
      const centerWorld = {
        x: -current.x / current.zoom + 260 + Math.random() * 120,
        y: -current.y / current.zoom + 180 + Math.random() * 120,
      }
      addNode(kind, centerWorld)
    },
    [addNode, camera],
  )

  const deleteSelection = useCallback(() => {
    if (selection.length === 0) return
    const removed = new Set(selection)
    const nextNodes = nodes.filter((node) => !removed.has(node.id))
    const nextEdges = edges.filter((edge) => !removed.has(edge.source) && !removed.has(edge.target))
    commit({ nodes: recountGroups(nextNodes), edges: nextEdges }, `删除 ${selection.length} 个节点`)
    setSelection([])
    setAiNodeId(null)
    toast.success(`已删除 ${selection.length} 个节点`)
  }, [commit, edges, nodes, selection])

  /* ------------------------------ 编组 / 解组 ------------------------------ */

  /**
   * 编组
   *
   * 语义：选中的节点全部打上 `groupId`，并在它们的外接矩形外包一个 `group` 节点。
   * 分组节点本身是 `locked` 且 `z` 最低的「容器」—— 它不抢命中、不挡内容，
   * 只表达「这些节点是一伙的」。点分组标题即整组选中，拖动分组即整体移动。
   */
  const groupSelection = useCallback(() => {
    const members = nodes.filter((node) => selection.includes(node.id) && node.kind !== 'group')
    if (members.length === 0) {
      toast.info('先选中要编组的节点（可多选）')
      return
    }
    const minX = Math.min(...members.map((node) => node.x))
    const minY = Math.min(...members.map((node) => node.y))
    const maxX = Math.max(...members.map((node) => node.x + node.width))
    const maxY = Math.max(...members.map((node) => node.y + node.height))
    const pad = 28
    const headPad = 44

    const groupId = `group-${Math.random().toString(36).slice(2, 8)}`
    const groupNode: DemoNode = {
      id: groupId,
      x: minX - pad,
      y: minY - headPad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + headPad + pad,
      title: `分组 · ${members.length} 个节点`,
      kind: 'group',
      z: Math.min(...nodes.map((node) => node.z ?? 0)) - 1,
      locked: true,
      data: { kind: 'group', subtitle: '拖动标题整组移动', tone: 'primary', memberCount: members.length },
    }

    const memberIds = new Set(members.map((node) => node.id))
    const nextNodes = [
      ...nodes.map((node) => (memberIds.has(node.id) ? { ...node, groupId } : node)),
      groupNode,
    ]
    commit({ nodes: nextNodes, edges }, `编组 ${members.length} 个节点`)
    setSelection([groupId])
    toast.success(`已编组 ${members.length} 个节点`)
  }, [commit, edges, nodes, selection])

  /** 解组：删掉分组框，成员去掉标记（成员位置保持不变） */
  const ungroupBy = useCallback(
    (groupId: string) => {
      const nextNodes = nodes
        .filter((node) => node.id !== groupId)
        .map((node) => (node.groupId === groupId ? { ...node, groupId: undefined } : node))
      commit({ nodes: nextNodes, edges }, '解组')
      setSelection([])
      toast.success('已解组')
    },
    [commit, edges, nodes],
  )

  /** 解组当前选中：选中分组框本身，或选中组内成员都能解 */
  const ungroupSelection = useCallback(() => {
    const selected = nodes.filter((node) => selection.includes(node.id))
    const groupIds = new Set<string>()
    for (const node of selected) {
      if (node.kind === 'group') groupIds.add(node.id)
      else if (node.groupId) groupIds.add(node.groupId)
    }
    if (groupIds.size === 0) {
      toast.info('选中的节点不在任何分组里')
      return
    }
    const nextNodes = nodes
      .filter((node) => !groupIds.has(node.id))
      .map((node) => (node.groupId && groupIds.has(node.groupId) ? { ...node, groupId: undefined } : node))
    commit({ nodes: nextNodes, edges }, '解组')
    setSelection([])
    toast.success(`已解散 ${groupIds.size} 个分组`)
  }, [commit, edges, nodes, selection])

  /** 选中某个分组及其全部成员（点分组标题时用） */
  const selectGroup = useCallback(
    (groupId: string) => {
      const ids = nodes.filter((node) => node.id === groupId || node.groupId === groupId).map((node) => node.id)
      setSelection(ids)
      toast.info(`已选中 ${ids.length} 个节点（分组 + 成员）`)
    },
    [nodes],
  )

  const duplicateSelection = useCallback(() => {
    if (selection.length === 0) return
    const map = new Map<string, string>()
    const copies = nodes
      .filter((node) => selection.includes(node.id))
      .map((node) => {
        const id = `${node.id}-copy-${Math.random().toString(36).slice(2, 7)}`
        map.set(node.id, id)
        return { ...node, id, x: node.x + 32, y: node.y + 32, locked: false, title: `${node.title} 副本` }
      })
    const copiedEdges = edges
      .filter((edge) => map.has(edge.source) && map.has(edge.target))
      .map((edge) => ({
        ...edge,
        id: `${edge.id}-copy-${Math.random().toString(36).slice(2, 7)}`,
        source: map.get(edge.source)!,
        target: map.get(edge.target)!,
      }))
    commit({ nodes: [...nodes, ...copies], edges: [...edges, ...copiedEdges] }, '复制节点')
    setSelection(copies.map((node) => node.id))
  }, [commit, edges, nodes, selection])

  const toggleLock = useCallback(
    (id: string) => {
      commitNodes(
        nodes.map((node) => (node.id === id ? { ...node, locked: !node.locked } : node)),
        '切换锁定',
      )
    },
    [commitNodes, nodes],
  )

  const bringToFront = useCallback(
    (id: string) => {
      const maxZ = Math.max(...nodes.map((node) => node.z ?? 0))
      commitNodes(
        nodes.map((node) => (node.id === id ? { ...node, z: maxZ + 1 } : node)),
        '调整层级',
      )
    },
    [commitNodes, nodes],
  )

  const sendToBack = useCallback(
    (id: string) => {
      const minZ = Math.min(...nodes.map((node) => node.z ?? 0))
      commitNodes(
        nodes.map((node) => (node.id === id ? { ...node, z: minZ - 1 } : node)),
        '调整层级',
      )
    },
    [commitNodes, nodes],
  )

  /** 改连线形态（右键菜单用） */
  const setEdgeShape = useCallback(
    (id: string, shape: 'bezier' | 'orthogonal' | 'straight') => {
      commit({ nodes, edges: edges.map((edge) => (edge.id === id ? { ...edge, shape } : edge)) }, '修改连线形态')
    },
    [commit, edges, nodes],
  )

  const alignSelection = useCallback(
    (mode: 'left' | 'top' | 'hcenter' | 'vcenter' | 'distribute-x') => {
      const selected = nodes.filter((node) => selection.includes(node.id))
      if (selected.length < 2) {
        toast.info('至少选中两个节点才能对齐')
        return
      }
      const left = Math.min(...selected.map((node) => node.x))
      const top = Math.min(...selected.map((node) => node.y))
      const right = Math.max(...selected.map((node) => node.x + node.width))
      const bottom = Math.max(...selected.map((node) => node.y + node.height))

      const next = nodes.map((node) => {
        if (!selection.includes(node.id)) return node
        switch (mode) {
          case 'left':
            return { ...node, x: left }
          case 'top':
            return { ...node, y: top }
          case 'hcenter':
            return { ...node, x: Math.round((left + right) / 2 - node.width / 2) }
          case 'vcenter':
            return { ...node, y: Math.round((top + bottom) / 2 - node.height / 2) }
          case 'distribute-x': {
            const ordered = [...selected].sort((a, b) => a.x - b.x)
            const index = ordered.findIndex((item) => item.id === node.id)
            const gap = (right - left - ordered.reduce((total, item) => total + item.width, 0)) /
              Math.max(ordered.length - 1, 1)
            const before = ordered.slice(0, index).reduce((total, item) => total + item.width + gap, 0)
            return { ...node, x: Math.round(left + before) }
          }
          default:
            return node
        }
      })
      commitNodes(next, '对齐节点')
    },
    [commitNodes, nodes, selection],
  )

  const resetScene = useCallback(() => {
    const scene = DEMO_SCENES.find((item) => item.id === sceneId) ?? DEMO_SCENES[0]!
    commit({ nodes: scene.nodes, edges: scene.edges }, '重置场景')
    setCamera(scene.camera)
    setSelection([])
    setAiNodeId(null)
    canvasRef.current?.setCamera(scene.camera, false)
    toast.success(`已恢复「${scene.name}」初始状态`)
  }, [commit, sceneId])

  const switchScene = useCallback(
    (id: string) => {
      const scene = DEMO_SCENES.find((item) => item.id === id)
      if (!scene) return
      setSceneId(id)
      setNodes(scene.nodes)
      setEdges(scene.edges)
      setSelection([])
      setAiNodeId(null)
      history.reset({ nodes: scene.nodes, edges: scene.edges })
      syncHistory()
      requestAnimationFrame(() => canvasRef.current?.setCamera(scene.camera, true))
      toast.success(`已切换到「${scene.name}」`)
    },
    [history, syncHistory],
  )

  /** 压力测试：生成 1000 个节点的网格，验证剔除与帧率 */
  const stressTest = useCallback(() => {
    const count = 1000
    const columns = 40
    const generated: DemoNode[] = Array.from({ length: count }, (_, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      const kind: DemoNodeKind = index % 7 === 0 ? 'note' : index % 5 === 0 ? 'prompt' : 'text'
      return {
        id: `stress-${index}`,
        x: column * 220,
        y: row * 140,
        width: 196,
        height: 112,
        title: `节点 ${index + 1}`,
        kind,
        data: {
          kind,
          text: `压力测试节点 #${index + 1}\n用于验证视口剔除与渲染节流。`,
          tone: 'neutral',
        },
      }
    })
    commit({ nodes: generated, edges: [] }, `压测 ${count} 节点`)
    setSelection([])
    requestAnimationFrame(() => canvasRef.current?.fitView())
    toast.success(`已生成 ${count} 个节点，观察右下角的挂载数与帧率`)
  }, [commit])

  /* ------------------------------ AI 输入区 ------------------------------ */

  const aiNode = useMemo(() => nodes.find((node) => node.id === aiNodeId) ?? null, [nodes, aiNodeId])

  /**
   * 打开某节点的 AI 输入区
   *
   * 输入区长在卡片底部，同一时刻只让一个节点展开 ——
   * 同时开多张会让画布变成一片输入框，反而看不清内容。
   * 再点一次同一个节点即收起（与「点开、点收」的直觉一致）。
   */
  const openAI = useCallback((id: string) => {
    setAiNodeId((current) => (current === id ? null : id))
  }, [])

  const closeAI = useCallback(() => setAiNodeId(null), [])

  // 把最新动作写进 ref，供上面的键盘监听转发（避免声明顺序问题与反复重绑）
  useEffect(() => {
    actionsRef.current = {
      undo,
      redo,
      duplicate: duplicateSelection,
      openAI,
      group: groupSelection,
      ungroup: ungroupSelection,
    }
  }, [undo, redo, duplicateSelection, openAI, groupSelection, ungroupSelection])

  /** 把 AI 回答写回指定节点（输入区在卡片内，回调需要显式带 nodeId） */
  const applyAIFor = useCallback(
    (nodeId: string, text: string) => {
      const target = nodes.find((node) => node.id === nodeId)
      if (!target) return
      commitNodes(
        nodes.map((node) => (node.id === nodeId ? { ...node, data: applyAnswer(node, text) } : node)),
        'AI 改写节点',
      )
      // 应用即收尾：输入区收起，避免用户以为「还没保存」
      setAiNodeId(null)
      toast.success('已把 AI 结果写回节点')
    },
    [commitNodes, nodes],
  )

  /** 以 AI 回答为基础创建子节点（带一条 ai 语义的连线） */
  const createChildFor = useCallback(
    (nodeId: string, text: string) => {
      const parent = nodes.find((node) => node.id === nodeId)
      if (!parent) return
      const spec = createChildSpec(parent, text)
      const id = `ai-child-${Math.random().toString(36).slice(2, 8)}`
      const node: DemoNode = {
        id,
        x: spec.x,
        y: spec.y,
        width: spec.width,
        height: spec.height,
        title: spec.title,
        kind: spec.kind,
        data: spec.data,
      }
      const edge: DemoEdge = {
        id: `e-${parent.id}-${id}`,
        source: parent.id,
        target: id,
        tone: 'ai',
        label: 'AI',
      }
      commit({ nodes: [...nodes, node], edges: [...edges, edge] }, 'AI 生成子节点')
      setSelection([id])
      canvasRef.current?.fitNode(id)
      toast.success('已生成 AI 副稿节点')
    },
    [commit, edges, nodes],
  )


  /* ------------------------------ 节点交互 ------------------------------ */

  const onNodeClick = useCallback(
    (id: string) => {
      const node = nodes.find((item) => item.id === id)
      if (!node) return
      // 点分组标题 = 整组选中；点普通节点 = 打开该卡片的底部 AI 输入区
      if (node.kind === 'group') {
        selectGroup(node.id)
        return
      }
      if (!aiFollow) return
      openAI(id)
    },
    [aiFollow, nodes, openAI, selectGroup],
  )

  /* ------------------------------ 右键菜单 ------------------------------ */

  /**
   * 右键菜单：节点 / 连线 / 空白三套
   *
   * 设计原则（与专业绘图工具对齐）：
   * - 频率越高越靠上（AI 编辑、编辑内容、复制、删除）；
   * - 破坏性操作（删除）永远在最底部，并且用 danger 色隔开；
   * - 有子菜单的条目用 `children`（对齐、添加节点），避免主菜单过长；
   * - 空白处的菜单保留「粘贴/全选/适配」，与桌面软件手感一致。
   */
  const contextMenuFor = useCallback(
    (target: CanvasContextTarget<DemoNode>): CanvasMenuSection[] => {
      const node = target.node
      const multi = target.selectedIds.length > 1

      /* ---- 连线右键 ---- */
      if (target.edgeId) {
        const edge = edges.find((item) => item.id === target.edgeId)
        if (!edge) return []
        return [
          {
            key: 'edge-style',
            title: '连线形态',
            items: [
              { key: 'bezier', label: '贝塞尔曲线', onSelect: () => setEdgeShape(edge.id, 'bezier') },
              { key: 'orthogonal', label: '正交折线', onSelect: () => setEdgeShape(edge.id, 'orthogonal') },
              { key: 'straight', label: '直线', onSelect: () => setEdgeShape(edge.id, 'straight') },
            ],
          },
          {
            key: 'edge-label',
            items: [
              {
                key: 'label-on',
                label: edge.label ? '清除标签' : '添加标签',
                onSelect: () =>
                  commit(
                    {
                      nodes,
                      edges: edges.map((item) =>
                        item.id === edge.id ? { ...item, label: item.label ? undefined : '关联' } : item,
                      ),
                    },
                    '修改连线标签',
                  ),
              },
              {
                key: 'dashed',
                label: edge.dashed ? '改为实线' : '改为虚线',
                onSelect: () =>
                  commit(
                    {
                      nodes,
                      edges: edges.map((item) => (item.id === edge.id ? { ...item, dashed: !item.dashed } : item)),
                    },
                    '修改连线样式',
                  ),
              },
            ],
          },
          {
            key: 'edge-delete',
            items: [
              {
                key: 'remove',
                label: '删除连线',
                danger: true,
                shortcut: 'Del',
                onSelect: () => {
                  commit({ nodes, edges: edges.filter((item) => item.id !== edge.id) }, '删除连线')
                  toast.success('已删除连线')
                },
              },
            ],
          },
        ]
      }

      /* ---- 节点右键 ---- */
      if (node) {
        const ids = target.selectedIds.length > 0 ? target.selectedIds : [node.id]
        return [
          {
            key: 'node-ai',
            items: [
              {
                key: 'ai',
                label: 'AI 编辑此节点',
                icon: <SparkIcon size={11} />,
                shortcut: 'A',
                onSelect: () => openAI(node.id),
              },
              {
                key: 'edit',
                label: '编辑内容',
                disabled: node.kind === 'image' || node.kind === 'video' || node.kind === 'group',
                shortcut: '双击',
                onSelect: () => setEditingNodeId(node.id),
              },
            ],
          },
          {
            key: 'node-edit',
            items: [
              {
                key: 'duplicate',
                label: '创建副本',
                shortcut: '⌘D',
                onSelect: () => {
                  setSelection([node.id])
                  requestAnimationFrame(duplicateSelection)
                },
              },
              {
                key: 'lock',
                label: node.locked ? '解除锁定' : '锁定位置',
                onSelect: () => toggleLock(node.id),
              },
              {
                key: 'layer',
                label: '层级',
                children: [
                  { key: 'front', label: '置于顶层', onSelect: () => bringToFront(node.id) },
                  { key: 'back', label: '置于底层', onSelect: () => sendToBack(node.id) },
                ],
              },
              {
                key: 'align',
                label: multi ? `对齐（${ids.length} 个）` : '对齐',
                disabled: ids.length < 2,
                children: [
                  { key: 'align-left', label: '左对齐', onSelect: () => alignSelection('left') },
                  { key: 'align-hcenter', label: '水平居中', onSelect: () => alignSelection('hcenter') },
                  { key: 'align-top', label: '顶对齐', onSelect: () => alignSelection('top') },
                  { key: 'align-vcenter', label: '垂直居中', onSelect: () => alignSelection('vcenter') },
                  { key: 'align-dist', label: '水平等距分布', onSelect: () => alignSelection('distribute-x') },
                ],
              },
              {
                key: 'group',
                label: node.groupId ? '解组' : multi ? `编组 ${ids.length} 个` : '编组',
                shortcut: '⌘G',
                disabled: !multi && !node.groupId,
                onSelect: () => {
                  setSelection(ids)
                  requestAnimationFrame(node.groupId ? ungroupSelection : groupSelection)
                },
              },
            ],
          },
          {
            key: 'node-add',
            items: [
              {
                key: 'add-child',
                label: '在此处添加节点',
                children: [
                  { key: 'add-text', label: '文本', onSelect: () => addNode('text', { x: node.x + node.width + 32, y: node.y }) },
                  { key: 'add-image', label: '图片', onSelect: () => addNode('image', { x: node.x + node.width + 32, y: node.y }) },
                  { key: 'add-video', label: '视频', onSelect: () => addNode('video', { x: node.x + node.width + 32, y: node.y }) },
                  { key: 'add-note', label: '便签', onSelect: () => addNode('note', { x: node.x + node.width + 32, y: node.y }) },
                  { key: 'add-prompt', label: '提示词', onSelect: () => addNode('prompt', { x: node.x + node.width + 32, y: node.y }) },
                ],
              },
              {
                key: 'focus',
                label: '聚焦到此节点',
                shortcut: 'Shift+2',
                onSelect: () => canvasRef.current?.fitNode(node.id),
              },
            ],
          },
          {
            key: 'node-danger',
            items: [
              {
                key: 'delete',
                label: ids.length > 1 ? `删除 ${ids.length} 个节点` : '删除节点',
                danger: true,
                shortcut: 'Del',
                onSelect: () => {
                  setSelection(ids)
                  requestAnimationFrame(deleteSelection)
                },
              },
            ],
          },
        ]
      }

      /* ---- 空白右键 ---- */
      return [
        {
          key: 'canvas-add',
          title: '添加节点',
          items: [
            { key: 'add-text', label: '文本节点', onSelect: () => addNode('text', target.world) },
            { key: 'add-image', label: '图片节点', onSelect: () => addNode('image', target.world) },
            { key: 'add-video', label: '视频节点', onSelect: () => addNode('video', target.world) },
            { key: 'add-note', label: '便签', onSelect: () => addNode('note', target.world) },
            { key: 'add-prompt', label: '提示词', onSelect: () => addNode('prompt', target.world) },
            { key: 'add-group', label: '分组框', onSelect: () => addNode('group', target.world) },
          ],
        },
        {
          key: 'canvas-history',
          items: [
            { key: 'undo', label: '撤销', shortcut: '⌘Z', disabled: historyState.undo === 0, onSelect: undo },
            { key: 'redo', label: '重做', shortcut: '⇧⌘Z', disabled: historyState.redo === 0, onSelect: redo },
          ],
        },
        {
          key: 'canvas-view',
          items: [
            {
              key: 'select-all',
              label: '全选',
              shortcut: '⌘A',
              onSelect: () => setSelection(nodes.map((item) => item.id)),
            },
            { key: 'fit', label: '适配全部', shortcut: '⇧1', onSelect: () => canvasRef.current?.fitView() },
            { key: 'reset-zoom', label: '重置为 100%', shortcut: '0', onSelect: () => canvasRef.current?.resetZoom() },
            { key: 'toggle-grid', label: gridOn ? '关闭网格吸附' : '开启网格吸附', onSelect: () => setGridOn((value) => !value) },
            { key: 'stress', label: '压力测试 1,000 节点', onSelect: stressTest },
            { key: 'help', label: '快捷键说明', shortcut: '?', onSelect: () => setHelpOpen(true) },
          ],
        },
      ]
    },
    [
      addNode,
      alignSelection,
      bringToFront,
      commit,
      deleteSelection,
      duplicateSelection,
      edges,
      gridOn,
      historyState.redo,
      historyState.undo,
      nodes,
      openAI,
      redo,
      sendToBack,
      setEdgeShape,
      stressTest,
      toggleLock,
      undo,
    ],
  )

  const renderNode = useCallback(
    (node: DemoNode, context: CanvasNodeRenderContext) => {
      const isGroup = node.kind === 'group'
      // 分组框被选中/其成员被选中时，分组框高亮（提示「这一伙属于同一组」）
      const grouped = Boolean(node.groupId && selection.includes(node.id))
      return (
        <DemoNodeView
          node={node}
          context={context}
          editing={editingNodeId === node.id}
          aiOpen={aiNodeId === node.id && !isGroup}
          grouped={grouped}
          onRequestAI={() => openAI(node.id)}
          onCloseAI={closeAI}
          onAIApply={(text) => applyAIFor(node.id, text)}
          onAICreateChild={(text) => createChildFor(node.id, text)}
          onStartEdit={() => setEditingNodeId(node.id)}
          onCommitEdit={(value) => {
            commitNodes(
              nodes.map((item) =>
                item.id === node.id ? { ...item, data: { ...item.data, text: value } } : item,
              ),
              '编辑节点内容',
            )
            setEditingNodeId(null)
          }}
          onCancelEdit={() => setEditingNodeId(null)}
          onDuplicate={() => {
            setSelection([node.id])
            requestAnimationFrame(duplicateSelection)
          }}
          onToggleLock={() => toggleLock(node.id)}
          onBringToFront={() => bringToFront(node.id)}
          onGroup={() => {
            setSelection([node.id])
            requestAnimationFrame(groupSelection)
          }}
          onUngroup={() => ungroupSelection()}
          onDelete={() => {
            setSelection([node.id])
            requestAnimationFrame(deleteSelection)
          }}
        />
      )
    },
    [
      aiNodeId,
      applyAIFor,
      bringToFront,
      closeAI,
      commitNodes,
      createChildFor,
      deleteSelection,
      duplicateSelection,
      editingNodeId,
      groupSelection,
      nodes,
      openAI,
      selection,
      toggleLock,
      ungroupSelection,
    ],
  )

  /* ------------------------------ 渲染 ------------------------------ */

  const totalEdges = edges.length
  const boundsWidth = useMemo(() => {
    if (nodes.length === 0) return 0
    const minX = Math.min(...nodes.map((node) => node.x))
    const maxX = Math.max(...nodes.map((node) => node.x + node.width))
    return Math.round(maxX - minX)
  }, [nodes])

  return (
    <PageContainer size="full" className="flex h-[calc(100dvh-6.5rem)] flex-col gap-2 pb-2">
      <CanvasToolbar
        sceneId={sceneId}
        scenes={DEMO_SCENES}
        onSceneChange={switchScene}
        onReset={resetScene}
        onUndo={undo}
        onRedo={redo}
        canUndo={historyState.undo > 0}
        canRedo={historyState.redo > 0}
        aiFollow={aiFollow}
        onToggleAiFollow={() => setAiFollow((value) => !value)}
        minimap={minimapOn}
        onToggleMinimap={() => setMinimapOn((value) => !value)}
        grid={gridOn}
        onToggleGrid={() => setGridOn((value) => !value)}
        onStressTest={stressTest}
        onHelp={() => setHelpOpen(true)}
        onFit={() => canvasRef.current?.fitView()}
      />

      <div className="flex min-h-0 flex-1 gap-2">
        <CanvasLibrary onAdd={addNodeAtViewportCenter} />

        <section className="relative min-w-0 flex-1 overflow-hidden rounded-lg border border-line bg-surface">
          <CanvasSurface
            ref={canvasRef}
            nodes={nodes}
            edges={edges}
            camera={camera}
            onCameraChange={(next, meta) => {
              if (meta.settled) setCamera(next)
            }}
            selectedIds={selection}
            onSelectionChange={setSelection}
            onNodesMove={(changes) => {
              const map = new Map(changes.map((change) => [change.id, change]))
              // 编组联动：拖动分组框时，成员跟着一起走（成员自身坐标同步更新）
              const groupShift = new Map<string, { dx: number; dy: number }>()
              for (const change of changes) {
                const origin = nodes.find((node) => node.id === change.id)
                if (origin?.kind === 'group') {
                  groupShift.set(change.id, { dx: change.x - origin.x, dy: change.y - origin.y })
                }
              }
              commitNodes(
                nodes.map((node) => {
                  const change = map.get(node.id)
                  if (change) return { ...node, x: change.x, y: change.y }
                  if (node.groupId) {
                    const shift = groupShift.get(node.groupId)
                    if (shift) {
                      return { ...node, x: Math.round(node.x + shift.dx), y: Math.round(node.y + shift.dy) }
                    }
                  }
                  return node
                }),
                '移动节点',
                'move',
              )
            }}
            onNodesResize={(changes) => {
              const map = new Map(changes.map((change) => [change.id, change]))
              commitNodes(
                nodes.map((node) => {
                  const change = map.get(node.id)
                  return change
                    ? { ...node, x: change.x, y: change.y, width: change.width, height: change.height }
                    : node
                }),
                '缩放节点',
              )
            }}
            onConnect={({ source, sourceSide, target }) => {
              const exists = edges.some((edge) => edge.source === source && edge.target === target)
              if (exists) {
                toast.info('这两个节点已有连线')
                return
              }
              commit(
                {
                  nodes,
                  edges: [
                    ...edges,
                    { id: `e-${source}-${target}-${Math.random().toString(36).slice(2, 6)}`, source, sourceSide, target },
                  ],
                },
                '新建连线',
              )
              toast.success('已建立连线')
            }}
            onNodesDelete={deleteSelection}
            onEdgesDelete={(ids) => {
              commit({ nodes, edges: edges.filter((edge) => !ids.includes(edge.id)) }, '删除连线')
              toast.success('已删除连线')
            }}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={(id) => {
              const node = nodes.find((item) => item.id === id)
              if (!node) return
              if (node.kind === 'group') {
                selectGroup(node.id)
                return
              }
              // 图片 / 视频没有「正文」，双击聚焦到它
              if (node.kind === 'image' || node.kind === 'video') {
                canvasRef.current?.fitNode(node.id)
                return
              }
              // 文本类：先收起底部 AI 输入区再进入编辑 ——
              // 输入区会盖住卡片下半部分，不收起来的话用户会以为「双击没反应」
              setAiNodeId(null)
              setEditingNodeId(id)
            }}
            onBackgroundClick={() => {
              setEditingNodeId(null)
              setAiNodeId(null)
            }}
            onViewportChange={(viewport) => setVisibleCount(viewport.renderedCount)}
            renderNode={renderNode}
            contextMenu={contextMenuFor}
            lod={{ zoom: 0.3, cell: 64 }}
            snap={{ grid: gridOn ? 8 : 0, guides: true, threshold: 7 }}
            minimap={minimapOn}
            background={gridOn ? 'dots' : 'none'}
            ariaLabel="无限画布演示：文本、图片、视频与 AI 节点"
          />

          <CanvasSelectionBar
            selection={selection}
            onDelete={deleteSelection}
            onDuplicate={duplicateSelection}
            onAlign={alignSelection}
            onToggleLock={() => selection[0] && toggleLock(selection[0])}
            onGroup={groupSelection}
            onUngroup={ungroupSelection}
            grouped={selection.some((id) => {
              const node = nodes.find((item) => item.id === id)
              return Boolean(node?.groupId || node?.kind === 'group')
            })}
          />
        </section>
      </div>

      <CanvasStatusBar
        contentWidth={boundsWidth}
        nodes={nodes.length}
        edges={totalEdges}
        visible={visibleCount}
        fps={fps}
        selection={selection.length}
        onFit={() => canvasRef.current?.fitView()}
      />

      <CanvasHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </PageContainer>
  )
}


/* ------------------------------------------------------------------ *
 * 持久化读取
 * ------------------------------------------------------------------ */

function loadInitialDoc(): PersistedDoc {
  const restored = readPersistedDoc()
  if (restored) return restored
  const scene = DEMO_SCENES[0]!
  return {
    version: 1,
    sceneId: scene.id,
    nodes: recountGroups(scene.nodes),
    edges: scene.edges,
    camera: scene.camera,
  }
}

/**
 * 重算每个分组框的成员数与位置
 *
 * 分组框是「派生视图」：成员被拖走、删掉、新增之后，框的大小要跟着变。
 * 每次文档变更后统一重算一次，比在每个动作里各写一遍可靠得多。
 * 位置只扩不缩（`min` 取小），避免成员被拖出去时框跟着「缩回去」闪动。
 */
function recountGroups(list: DemoNode[]): DemoNode[] {
  const membersByGroup = new Map<string, DemoNode[]>()
  for (const node of list) {
    if (!node.groupId) continue
    const bucket = membersByGroup.get(node.groupId)
    if (bucket) bucket.push(node)
    else membersByGroup.set(node.groupId, [node])
  }
  return list.map((node) => {
    if (node.kind !== 'group') return node
    const members = membersByGroup.get(node.id) ?? []
    if (members.length === 0) return node
    const pad = 28
    const headPad = 44
    const minX = Math.min(...members.map((item) => item.x)) - pad
    const minY = Math.min(...members.map((item) => item.y)) - headPad
    const maxX = Math.max(...members.map((item) => item.x + item.width)) + pad
    const maxY = Math.max(...members.map((item) => item.y + item.height)) + pad
    return {
      ...node,
      x: Math.min(node.x, minX),
      y: Math.min(node.y, minY),
      width: Math.max(node.width, maxX - Math.min(node.x, minX)),
      height: Math.max(node.height, maxY - Math.min(node.y, minY)),
      title: `分组 · ${members.length} 个节点`,
      data: { ...node.data, memberCount: members.length },
    }
  })
}

function readPersistedDoc(): PersistedDoc | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedDoc>
    if (parsed.version !== 1 || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null
    return parsed as PersistedDoc
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ *
 * 画布组件包装（保持 ref 类型推导）
 * ------------------------------------------------------------------ */

const CanvasSurface = (<TNode extends DemoNode>(
  props: InfiniteCanvasProps<TNode> & { ref?: React.Ref<InfiniteCanvasHandle> },
) => <InfiniteCanvas {...props} />) as <TNode extends DemoNode>(
  props: InfiniteCanvasProps<TNode> & { ref?: React.Ref<InfiniteCanvasHandle> },
) => React.ReactElement
