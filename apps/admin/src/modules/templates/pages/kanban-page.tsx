import { useMemo, useState } from 'react'
import {
  CalendarDays,
  CircleAlert,
  CircleCheck,
  CircleDot,
  Ellipsis,
  Filter,
  Plus,
} from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Dropdown,
  EmptyState,
  PageContainer,
  PageHeader,
  SearchInput,
  SegmentedControl,
  StatCard,
  Tag,
  cn,
  toast,
} from '@nexus/ui'

/**
 * 项目看板
 *
 * 关键实现：
 * 1. **原生 HTML5 拖拽**（dragstart / dragover / drop），零第三方库
 * 2. 拖拽期间用 `dragOverColumn` 记录落点列，给出整列高亮，而不是只高亮卡片
 * 3. WIP 超限给告警色，但**不阻止**拖入 —— 看板的价值是暴露问题，不是阻止动作
 * 4. 顺序保持：同一列内按数组顺序渲染，拖到某张卡片上方就插到它前面
 */

type ColumnId = 'backlog' | 'todo' | 'doing' | 'review' | 'done'

interface Task {
  id: string
  title: string
  assignee: string
  priority: 'high' | 'medium' | 'low'
  tags: string[]
  due: string
  comments: number
  column: ColumnId
}

const COLUMNS: Array<{
  id: ColumnId
  title: string
  tone: 'neutral' | 'primary' | 'warning' | 'success' | 'danger'
  /** WIP 上限，0 表示不限 */
  wip: number
}> = [
  { id: 'backlog', title: '待排期', tone: 'neutral', wip: 0 },
  { id: 'todo', title: '本周待办', tone: 'primary', wip: 0 },
  { id: 'doing', title: '进行中', tone: 'warning', wip: 3 },
  { id: 'review', title: '待评审', tone: 'primary', wip: 2 },
  { id: 'done', title: '已完成', tone: 'success', wip: 0 },
]

const PRIORITY = {
  high: { label: '高', tone: 'danger' as const },
  medium: { label: '中', tone: 'warning' as const },
  low: { label: '低', tone: 'neutral' as const },
}

const INITIAL_TASKS: Task[] = [
  {
    id: 't1',
    title: '统一登录页支持企业微信扫码',
    assignee: '陈彦之',
    priority: 'high',
    tags: ['登录', 'SSO'],
    due: '11-08',
    comments: 12,
    column: 'doing',
  },
  {
    id: 't2',
    title: '订单导出任务队列化，避免同步超时',
    assignee: '林知夏',
    priority: 'high',
    tags: ['性能', '订单'],
    due: '11-06',
    comments: 8,
    column: 'doing',
  },
  {
    id: 't3',
    title: '审计日志支持按 traceId 反查',
    assignee: '周予安',
    priority: 'medium',
    tags: ['可观测'],
    due: '11-12',
    comments: 3,
    column: 'doing',
  },
  {
    id: 't4',
    title: '用户表格支持批量改角色',
    assignee: '吴星野',
    priority: 'medium',
    tags: ['用户'],
    due: '11-09',
    comments: 5,
    column: 'review',
  },
  {
    id: 't5',
    title: '深色模式下图表网格线对比度调优',
    assignee: '黄清越',
    priority: 'low',
    tags: ['视觉'],
    due: '11-10',
    comments: 2,
    column: 'review',
  },
  {
    id: 't6',
    title: '接入对象存储并支持分片续传',
    assignee: '赵书鸣',
    priority: 'high',
    tags: ['存储', '上传'],
    due: '11-15',
    comments: 9,
    column: 'todo',
  },
  {
    id: 't7',
    title: '权限模型补充字段级控制',
    assignee: '陈彦之',
    priority: 'medium',
    tags: ['权限'],
    due: '11-18',
    comments: 4,
    column: 'todo',
  },
  {
    id: 't8',
    title: '命令面板支持最近访问排序',
    assignee: '林知夏',
    priority: 'low',
    tags: ['体验'],
    due: '11-20',
    comments: 1,
    column: 'backlog',
  },
  {
    id: 't9',
    title: '补充组件库无障碍用例',
    assignee: '周予安',
    priority: 'medium',
    tags: ['测试', 'a11y'],
    due: '11-22',
    comments: 6,
    column: 'backlog',
  },
  {
    id: 't10',
    title: '修复 Safari 下 Drawer 滚动锁失效',
    assignee: '吴星野',
    priority: 'high',
    tags: ['缺陷'],
    due: '11-05',
    comments: 11,
    column: 'done',
  },
  {
    id: 't11',
    title: '虚拟表格支持分组行',
    assignee: '黄清越',
    priority: 'medium',
    tags: ['表格'],
    due: '11-03',
    comments: 7,
    column: 'done',
  },
]

export default function KanbanPage() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS)
  const [keyword, setKeyword] = useState('')
  const [priority, setPriority] = useState<'all' | Task['priority']>('all')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    return tasks.filter((task) => {
      if (priority !== 'all' && task.priority !== priority) return false
      if (!query) return true
      return `${task.title}${task.assignee}${task.tags.join('')}`.toLowerCase().includes(query)
    })
  }, [tasks, keyword, priority])

  const byColumn = useMemo(() => {
    const map = new Map<ColumnId, Task[]>()
    for (const column of COLUMNS) map.set(column.id, [])
    for (const task of filtered) map.get(task.column)?.push(task)
    return map
  }, [filtered])

  /** 把任务移动到目标列的指定位置 */
  const moveTask = (taskId: string, targetColumn: ColumnId, targetIndex: number | null) => {
    setTasks((prev) => {
      const source = prev.find((task) => task.id === taskId)
      if (!source) return prev

      // 抽出被拖动的任务
      const rest = prev.filter((task) => task.id !== taskId)
      const moved: Task = { ...source, column: targetColumn }

      // 目标列现有的其他任务（保持相对顺序）
      const targetIds = rest.filter((task) => task.column === targetColumn).map((task) => task.id)
      const insertAt =
        targetIndex === null ? targetIds.length : Math.min(targetIndex, targetIds.length)

      const result: Task[] = []
      let placed = false
      let targetSeen = 0
      for (const task of rest) {
        if (task.column === targetColumn) {
          if (targetSeen === insertAt && !placed) {
            result.push(moved)
            placed = true
          }
          targetSeen += 1
        }
        result.push(task)
      }
      if (!placed) result.push(moved)

      return result
    })
  }

  const handleDrop = (column: ColumnId) => {
    if (!draggingId) return
    const task = tasks.find((item) => item.id === draggingId)
    moveTask(draggingId, column, dropIndex)
    setDraggingId(null)
    setDragOverColumn(null)
    setDropIndex(null)

    if (task && task.column !== column) {
      const target = COLUMNS.find((item) => item.id === column)
      toast.success(`已移动到「${target?.title}」`)
    }
  }

  const counts = {
    total: tasks.length,
    doing: tasks.filter((task) => task.column === 'doing').length,
    overdue: tasks.filter((task) => task.column !== 'done' && task.due <= '11-08').length,
    done: tasks.filter((task) => task.column === 'done').length,
  }

  return (
    <PageContainer size="full">
      <PageHeader
        title="项目看板"
        description="拖拽卡片切换状态；列头显示 WIP 上限，超限会变红提示"
        badge={<Badge tone="success">Kanban</Badge>}
        actions={
          <Button
            variant="primary"
            leftIcon={<Plus className="size-3.5" />}
            onClick={() => toast.info('演示环境：新建任务')}
          >
            新建任务
          </Button>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="任务总数" value={counts.total} tone="primary" />
        <StatCard label="进行中" value={counts.doing} tone="warning" />
        <StatCard label="临近截止" value={counts.overdue} tone="danger" />
        <StatCard label="已完成" value={counts.done} tone="success" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={keyword}
          onChange={setKeyword}
          placeholder="搜索任务、负责人或标签"
          size="sm"
          className="w-[16.25rem]"
        />
        <SegmentedControl
          size="sm"
          options={[
            { label: '全部优先级', value: 'all' },
            { label: '高', value: 'high' },
            { label: '中', value: 'medium' },
            { label: '低', value: 'low' },
          ]}
          value={priority}
          onChange={(value) => setPriority(value as typeof priority)}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="secondary" leftIcon={<Filter className="size-3.5" />}>
            高级筛选
          </Button>
          <span className="text-2xs text-fg-3">
            共 {filtered.length} / {tasks.length} 个任务
          </span>
        </div>
      </div>

      {/* 看板主体：横向滚动，每列固定宽度 */}
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {COLUMNS.map((column) => {
          const items = byColumn.get(column.id) ?? []
          const overWip = column.wip > 0 && items.length > column.wip
          const isDragOver = dragOverColumn === column.id

          return (
            <div
              key={column.id}
              onDragOver={(event) => {
                event.preventDefault()
                setDragOverColumn(column.id)
              }}
              onDragLeave={(event) => {
                // 只在真正离开整列时清除，避免移入子元素时闪一下
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setDragOverColumn(null)
                  setDropIndex(null)
                }
              }}
              onDrop={(event) => {
                event.preventDefault()
                handleDrop(column.id)
              }}
              className={cn(
                'flex w-[17.25rem] shrink-0 flex-col rounded-lg border bg-surface-2/60 transition-colors',
                isDragOver ? 'border-primary bg-primary-weak/40' : 'border-line',
              )}
            >
              {/* 列头 */}
              <div className="flex items-center gap-2 border-b border-line px-2.5 py-2">
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    column.tone === 'success' && 'bg-success',
                    column.tone === 'warning' && 'bg-warning',
                    column.tone === 'danger' && 'bg-danger',
                    column.tone === 'primary' && 'bg-primary',
                    column.tone === 'neutral' && 'bg-fg-4',
                  )}
                />
                <span className="text-xs font-semibold text-fg">{column.title}</span>
                <span
                  className={cn(
                    'text-2xs tabular-nums',
                    overWip ? 'font-semibold text-danger' : 'text-fg-3',
                  )}
                >
                  {items.length}
                  {column.wip > 0 && ` / ${column.wip}`}
                </span>
                {overWip && (
                  <span className="inline-flex items-center gap-0.5 text-2xs text-danger">
                    <CircleAlert className="size-3" />
                    WIP 超限
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`在「${column.title}」新建`}
                  onClick={() => toast.info(`演示环境：在「${column.title}」新建任务`)}
                  className="ml-auto grid size-5 place-items-center rounded text-fg-4 transition-colors hover:bg-surface-3 hover:text-fg"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>

              {/* 卡片列表 */}
              <div className="flex min-h-[7.5rem] flex-1 flex-col gap-2 p-2">
                {items.length === 0 && (
                  <EmptyState
                    size="sm"
                    title="暂无任务"
                    description="把卡片拖到这里即可"
                    className="py-6"
                  />
                )}

                {items.map((task, index) => (
                  <div key={task.id}>
                    {/* 落点指示线 */}
                    {isDragOver && dropIndex === index && (
                      <div className="mb-2 h-0.5 rounded-full bg-primary" />
                    )}
                    <article
                      draggable
                      onDragStart={(event) => {
                        setDraggingId(task.id)
                        event.dataTransfer.effectAllowed = 'move'
                        // Firefox 必须 setData 才会真正触发 drag
                        event.dataTransfer.setData('text/plain', task.id)
                      }}
                      onDragEnd={() => {
                        setDraggingId(null)
                        setDragOverColumn(null)
                        setDropIndex(null)
                      }}
                      onDragOver={(event) => {
                        event.preventDefault()
                        setDropIndex(index)
                      }}
                      className={cn(
                        'group cursor-grab rounded-md border border-line bg-surface p-2.5 transition-[box-shadow,opacity,border-color]',
                        'hover:border-primary/40 hover:shadow-sm active:cursor-grabbing',
                        draggingId === task.id && 'opacity-40',
                      )}
                    >
                      <div className="flex items-start gap-1.5">
                        <p className="min-w-0 flex-1 text-[0.8125rem] leading-5 font-medium text-fg">
                          {task.title}
                        </p>
                        <Dropdown
                          align="end"
                          trigger={
                            <button
                              type="button"
                              aria-label="更多操作"
                              className="grid size-5 shrink-0 place-items-center rounded text-fg-4 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-2 hover:text-fg"
                            >
                              <Ellipsis className="size-3.5" />
                            </button>
                          }
                          items={[
                            {
                              key: 'edit',
                              label: '编辑任务',
                              onSelect: () => toast.info('演示环境：编辑任务'),
                            },
                            {
                              key: 'delete',
                              label: '删除',
                              danger: true,
                              onSelect: () => {
                                setTasks((prev) => prev.filter((item) => item.id !== task.id))
                                toast.success('任务已删除')
                              },
                            },
                          ]}
                        />
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {task.tags.map((tag) => (
                          <Tag key={tag} tone="neutral" className="h-[1.125rem] px-1.5 text-2xs">
                            {tag}
                          </Tag>
                        ))}
                      </div>

                      <div className="mt-2 flex items-center gap-1.5">
                        <Avatar name={task.assignee} size="xs" />
                        <span className="min-w-0 flex-1 truncate text-2xs text-fg-3">
                          {task.assignee}
                        </span>
                        <Badge tone={PRIORITY[task.priority].tone} size="sm" dot>
                          {PRIORITY[task.priority].label}
                        </Badge>
                        <span
                          className={cn(
                            'inline-flex items-center gap-0.5 text-2xs tabular-nums',
                            task.column !== 'done' && task.due <= '11-08'
                              ? 'text-danger'
                              : 'text-fg-4',
                          )}
                        >
                          <CalendarDays className="size-3" />
                          {task.due}
                        </span>
                      </div>
                    </article>
                  </div>
                ))}

                {/* 拖到空列/列尾时的指示线 */}
                {isDragOver && (dropIndex === null || dropIndex >= items.length) && (
                  <div className="h-0.5 rounded-full bg-primary" />
                )}
              </div>

              {column.id === 'done' && items.length > 0 && (
                <div className="flex items-center gap-1 border-t border-line px-2.5 py-1.5 text-2xs text-success">
                  <CircleCheck className="size-3" />
                  本周已交付 {items.length} 项
                </div>
              )}
              {column.id === 'doing' && (
                <div className="flex items-center gap-1 border-t border-line px-2.5 py-1.5 text-2xs text-fg-3">
                  <CircleDot className="size-3" />
                  并行度建议不超过 {column.wip} 个
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-1 text-2xs text-fg-4">
        提示：拖动卡片到其他列即可改状态；拖到卡片之间的细线处可精确排序。
      </p>
    </PageContainer>
  )
}
