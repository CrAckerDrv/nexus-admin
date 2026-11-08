import { useMemo, useState } from 'react'
import { CalendarRange, CircleCheck, Flag, Timer, Users } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  PageContainer,
  PageHeader,
  Progress,
  SegmentedControl,
  StatCard,
  Tooltip,
  cn,
  formatDateTime,
  toast,
} from '@nexus/ui'

/**
 * 甘特图排期
 *
 * 实现方式：纯 CSS Grid + 绝对定位的任务条，不用 canvas / SVG 重绘。
 * - 时间轴按「天」生成刻度，列宽随 zoom 变化
 * - 任务条 left/width 用百分比，容器宽度变化时自动跟随，无需 ResizeObserver
 * - 今天指示线由日期计算，不写死位置
 * - 左右两栏同步滚动：左侧任务名 sticky，右侧时间轴横向滚动
 */

type Zoom = 'week' | 'month' | 'quarter'

interface GanttTask {
  id: string
  name: string
  group: string
  owner: string
  start: string
  end: string
  progress: number
  status: 'done' | 'doing' | 'risk' | 'plan'
  milestone?: boolean
  /** 依赖的任务 id，用于画箭头（简化：只标记，不绘制曲线） */
  dependsOn?: string
}

const START = new Date(2026, 10, 1) // 2026-11-01
const TOTAL_DAYS = 60

/** 相对起始日的偏移 */
function dayOffset(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number)
  const target = new Date(year!, (month ?? 1) - 1, day ?? 1)
  return Math.round((target.getTime() - START.getTime()) / 86_400_000)
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next
}

const TASKS: GanttTask[] = [
  {
    id: 'g1',
    name: '需求澄清与范围确认',
    group: '准备阶段',
    owner: '陈彦之',
    start: '2026-11-01',
    end: '2026-11-05',
    progress: 100,
    status: 'done',
  },
  {
    id: 'g2',
    name: '交互稿与设计评审',
    group: '准备阶段',
    owner: '黄清越',
    start: '2026-11-03',
    end: '2026-11-10',
    progress: 100,
    status: 'done',
  },
  {
    id: 'g3',
    name: '接口契约定义',
    group: '准备阶段',
    owner: '周予安',
    start: '2026-11-05',
    end: '2026-11-09',
    progress: 80,
    status: 'doing',
  },
  {
    id: 'g4',
    name: '后端服务开发',
    group: '开发阶段',
    owner: '林知夏',
    start: '2026-11-08',
    end: '2026-11-24',
    progress: 46,
    status: 'doing',
    dependsOn: 'g3',
  },
  {
    id: 'g5',
    name: '前端页面开发',
    group: '开发阶段',
    owner: '吴星野',
    start: '2026-11-10',
    end: '2026-11-26',
    progress: 38,
    status: 'doing',
    dependsOn: 'g3',
  },
  {
    id: 'g6',
    name: '数据迁移脚本',
    group: '开发阶段',
    owner: '赵书鸣',
    start: '2026-11-14',
    end: '2026-11-22',
    progress: 12,
    status: 'risk',
  },
  {
    id: 'g7',
    name: '联调与缺陷修复',
    group: '交付阶段',
    owner: '全员',
    start: '2026-11-26',
    end: '2026-12-06',
    progress: 0,
    status: 'plan',
    dependsOn: 'g4',
  },
  {
    id: 'g8',
    name: '灰度发布',
    group: '交付阶段',
    owner: '陈彦之',
    start: '2026-12-06',
    end: '2026-12-12',
    progress: 0,
    status: 'plan',
  },
  {
    id: 'g9',
    name: '正式上线',
    group: '交付阶段',
    owner: '全员',
    start: '2026-12-12',
    end: '2026-12-12',
    progress: 0,
    status: 'plan',
    milestone: true,
  },
]

const STATUS_STYLE = {
  done: { bar: 'bg-success/85', text: 'text-success', label: '已完成' },
  doing: { bar: 'bg-primary/85', text: 'text-primary', label: '进行中' },
  risk: { bar: 'bg-danger/85', text: 'text-danger', label: '有风险' },
  plan: { bar: 'bg-surface-3', text: 'text-fg-3', label: '未开始' },
}

const ZOOM_CONFIG: Record<Zoom, { label: string; dayWidth: number; tickEvery: number }> = {
  week: { label: '周', dayWidth: 44, tickEvery: 7 },
  month: { label: '月', dayWidth: 22, tickEvery: 7 },
  quarter: { label: '季', dayWidth: 11, tickEvery: 14 },
}

export default function GanttPage() {
  const [zoom, setZoom] = useState<Zoom>('month')
  const [selected, setSelected] = useState<string | null>(null)

  const config = ZOOM_CONFIG[zoom]
  const today = useMemo(() => new Date(), [])
  const todayOffset = dayOffset(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
  )

  /** 时间轴刻度：按 tickEvery 天一个，标签显示 M-D */
  const ticks = useMemo(() => {
    const result: Array<{ offset: number; label: string; isMonthStart: boolean }> = []
    for (let offset = 0; offset < TOTAL_DAYS; offset += config.tickEvery) {
      const date = addDays(START, offset)
      result.push({
        offset,
        label: `${date.getMonth() + 1}-${String(date.getDate()).padStart(2, '0')}`,
        isMonthStart: date.getDate() <= 7,
      })
    }
    return result
  }, [config.tickEvery])

  /** 里程碑：单独拉出来渲染成菱形 */
  const stats = {
    total: TASKS.length,
    done: TASKS.filter((task) => task.progress === 100).length,
    risk: TASKS.filter((task) => task.status === 'risk').length,
    avgProgress: Math.round(TASKS.reduce((sum, task) => sum + task.progress, 0) / TASKS.length),
  }

  const groups = useMemo(() => {
    const map = new Map<string, GanttTask[]>()
    for (const task of TASKS) {
      if (!map.has(task.group)) map.set(task.group, [])
      map.get(task.group)!.push(task)
    }
    return Array.from(map.entries())
  }, [])

  const timelineWidth = TOTAL_DAYS * config.dayWidth

  return (
    <PageContainer size="full">
      <PageHeader
        title="甘特图排期"
        description="跨月任务排期视图；今天线自动定位，支持周 / 月 / 季三种缩放粒度"
        badge={<Badge tone="primary">Gantt</Badge>}
        actions={
          <Button
            variant="secondary"
            leftIcon={<CalendarRange className="size-3.5" />}
            onClick={() => toast.success('已导出为图片（演示）')}
          >
            导出排期
          </Button>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="任务总数"
          value={stats.total}
          tone="primary"
          icon={<Flag className="size-4" />}
        />
        <StatCard
          label="已完成"
          value={stats.done}
          tone="success"
          icon={<CircleCheck className="size-4" />}
        />
        <StatCard
          label="有风险"
          value={stats.risk}
          tone="danger"
          icon={<Timer className="size-4" />}
        />
        <StatCard
          label="平均进度"
          value={`${stats.avgProgress}%`}
          tone="warning"
          icon={<Users className="size-4" />}
        />
      </div>

      <Card bare className="overflow-hidden">
        {/* 工具栏 */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
          <h3 className="text-[0.8125rem] font-semibold text-fg">项目迭代排期</h3>
          <span className="text-2xs text-fg-3">
            {START.getFullYear()} 年 {START.getMonth() + 1} 月 —{' '}
            {addDays(START, TOTAL_DAYS).getMonth() + 1} 月
          </span>
          <div className="ml-auto flex items-center gap-2">
            <SegmentedControl
              size="sm"
              options={[
                { label: '周', value: 'week' },
                { label: '月', value: 'month' },
                { label: '季', value: 'quarter' },
              ]}
              value={zoom}
              onChange={(value) => setZoom(value as Zoom)}
            />
          </div>
        </div>

        <div className="flex">
          {/* 左侧任务名（sticky 列，宽度固定） */}
          <div className="w-[15.5rem] shrink-0 border-r border-line">
            {/* 表头占位，与右侧时间轴等高 */}
            <div className="flex h-9 items-center border-b border-line bg-surface-2 px-3 text-2xs font-medium text-fg-3">
              任务 / 负责人
            </div>
            {groups.map(([group, items]) => (
              <div key={group}>
                <div className="flex h-7 items-center bg-surface-2/60 px-3 text-2xs font-semibold text-fg-2">
                  {group}
                </div>
                {items.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setSelected(task.id === selected ? null : task.id)}
                    className={cn(
                      'flex h-9 w-full items-center gap-1.5 border-b border-line-subtle px-3 text-left transition-colors',
                      selected === task.id ? 'bg-primary-weak/60' : 'hover:bg-surface-2',
                    )}
                  >
                    <span
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        task.status === 'done' && 'bg-success',
                        task.status === 'doing' && 'bg-primary',
                        task.status === 'risk' && 'bg-danger',
                        task.status === 'plan' && 'bg-fg-4',
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs text-fg">{task.name}</span>
                    <span className="shrink-0 text-2xs text-fg-4">{task.owner}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* 右侧时间轴 */}
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div style={{ width: timelineWidth, position: 'relative' }}>
              {/* 刻度头 */}
              <div className="relative h-9 border-b border-line bg-surface-2">
                {ticks.map((tick) => (
                  <span
                    key={tick.offset}
                    className="absolute top-0 flex h-full items-center border-l border-line-subtle pl-1 text-2xs text-fg-3 tabular-nums"
                    style={{ left: tick.offset * config.dayWidth }}
                  >
                    {tick.label}
                  </span>
                ))}
              </div>

              {/* 今天指示线 */}
              {todayOffset >= 0 && todayOffset <= TOTAL_DAYS && (
                <div
                  className="pointer-events-none absolute top-9 bottom-0 z-20 w-px bg-danger/70"
                  style={{ left: todayOffset * config.dayWidth }}
                >
                  <span className="absolute -top-0.5 -left-1 size-2 rounded-full bg-danger" />
                  <span className="absolute top-1 left-1 rounded-sm bg-danger px-1 text-[0.625rem] whitespace-nowrap text-white">
                    今天
                  </span>
                </div>
              )}

              {/* 网格竖线 */}
              <div className="pointer-events-none absolute inset-0 top-9">
                {Array.from({ length: Math.ceil(TOTAL_DAYS / config.tickEvery) }, (_, index) => (
                  <span
                    key={index}
                    className="absolute top-0 bottom-0 border-l border-line-subtle"
                    style={{ left: index * config.tickEvery * config.dayWidth }}
                  />
                ))}
              </div>

              {/* 任务条 */}
              <div className="relative">
                {groups.map(([group, items]) => (
                  <div key={group}>
                    <div className="h-7 bg-surface-2/40" />
                    {items.map((task) => {
                      const startOffset = dayOffset(task.start)
                      const endOffset = dayOffset(task.end)
                      const span = Math.max(1, endOffset - startOffset + 1)
                      const style = STATUS_STYLE[task.status]
                      const isMilestone = task.milestone

                      return (
                        <div
                          key={task.id}
                          className={cn(
                            'relative flex h-9 items-center border-b border-line-subtle',
                            selected === task.id && 'bg-primary-weak/30',
                          )}
                        >
                          <Tooltip
                            side="top"
                            content={
                              <div className="space-y-0.5">
                                <p className="font-medium">{task.name}</p>
                                <p>
                                  {task.start} → {task.end}
                                </p>
                                <p>
                                  {statusLabel(task.status)} · {task.progress}%
                                </p>
                                <p>负责人：{task.owner}</p>
                              </div>
                            }
                          >
                            <button
                              type="button"
                              onClick={() => setSelected(task.id === selected ? null : task.id)}
                              className="absolute top-1/2 -translate-y-1/2 text-left"
                              style={{
                                left: startOffset * config.dayWidth,
                                width: isMilestone ? 16 : Math.max(span * config.dayWidth - 4, 12),
                              }}
                            >
                              {isMilestone ? (
                                <span className="block size-3 rotate-45 rounded-[0.125rem] bg-success shadow-sm" />
                              ) : (
                                <span
                                  className={cn(
                                    'relative flex h-6 items-center overflow-hidden rounded-md',
                                    style.bar,
                                    'shadow-sm transition-[filter] hover:brightness-110',
                                  )}
                                >
                                  {/* 进度填充：用半透明白覆盖在状态色上，深浅色都可读 */}
                                  <span
                                    className="absolute inset-y-0 left-0 bg-white/25"
                                    style={{ width: `${task.progress}%` }}
                                  />
                                  <span className="relative z-10 truncate px-1.5 text-2xs font-medium text-white">
                                    {span > 3 ? `${task.progress}%` : ''}
                                  </span>
                                </span>
                              )}
                            </button>
                          </Tooltip>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 底部图例 */}
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-3 py-2 text-2xs text-fg-3">
          {(['done', 'doing', 'risk', 'plan'] as const).map((status) => (
            <span key={status} className="inline-flex items-center gap-1">
              <span className={cn('size-2 rounded-sm', STATUS_STYLE[status].bar)} />
              {STATUS_STYLE[status].label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rotate-45 rounded-[1px] bg-success" />
            里程碑
          </span>
          <span className="ml-auto inline-flex items-center gap-1">
            <span className="h-3 w-px bg-danger/70" />
            今天
          </span>
        </div>
      </Card>

      {/* 选中任务详情 */}
      {selected && (
        <Card className="mt-3">
          {(() => {
            const task = TASKS.find((item) => item.id === selected)
            if (!task) return null
            return (
              <div className="flex flex-wrap items-center gap-4">
                <Avatar name={task.owner} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.8125rem] font-semibold text-fg">{task.name}</p>
                  <p className="text-2xs text-fg-3">
                    {task.start} → {task.end} · 负责人 {task.owner} · {statusLabel(task.status)}
                  </p>
                </div>
                <div className="w-[11.25rem]">
                  <Progress
                    value={task.progress}
                    tone={task.status === 'risk' ? 'danger' : 'primary'}
                    showLabel
                    label="完成度"
                  />
                </div>
                <Badge tone={task.status === 'risk' ? 'danger' : 'primary'}>
                  第 {Math.ceil((dayOffset(task.start) + 1) / 7)} 周
                </Badge>
                <span className="text-2xs text-fg-4">更新于 {formatDateTime(new Date())}</span>
              </div>
            )
          })()}
        </Card>
      )}
    </PageContainer>
  )
}

function statusLabel(status: GanttTask['status']): string {
  return STATUS_STYLE[status].label
}
