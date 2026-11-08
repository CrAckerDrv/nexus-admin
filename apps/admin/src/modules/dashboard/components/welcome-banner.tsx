import { useMemo } from 'react'
import { ArrowUpRight, CalendarDays, CircleCheck, Plus, Sparkles, Target } from 'lucide-react'
import { Badge, Button, HeroBanner, Progress, formatCompact } from '@nexus/ui'
import { BANNER_IMAGES } from '@/assets/banners'
import { useAppNavigate } from '@/components/app-link'
import { useAuthStore } from '@/core/auth-store'
import { useOverviewMetrics, useTodos } from '@/services/queries'
import { MONTHLY_GOALS, goalPercent, goalTone } from './goal-meta'

/**
 * 经营概览 · 用户欢迎横幅
 *
 * 放在 PageHeader 之下、KPI 之上：第一眼先「认人 + 报今天」，
 * 再往下才是数字。不额外加分割线，靠 KPI 区自己的间距接住它。
 *
 * 三条设计约定：
 * 1. **不读渲染期的当前时间**：日期与问候语用模块作用域的 `NOW` 快照，
 *    避免每次重渲染算出不同的问候语（React 纯度 + 「静止时必须绝对静止」的约定）。
 * 2. **没有用户时不渲染**：守卫跳转中的那一帧不该出现「你好，undefined」。
 * 3. **数据跟着真实查询走**：待办数、交易额、目标达成率都来自已有 hook，
 *    加载中显示占位文案而不是 0，避免「先看到 0 再跳到 12」。
 */

/**
 * 页面打开时的「现在」
 *
 * 放模块作用域而不是组件里：渲染期调用 `Date.now()` 会让组件变成非纯函数，
 * 每次重渲染都可能算出不同的问候语与日期文案。
 */
const NOW = new Date()

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

/** 按小时给问候语：5–11 上午好、11–13 中午好、13–18 下午好、其余晚上好 */
function greetingOf(hour: number): string {
  if (hour >= 5 && hour < 11) return '上午好'
  if (hour >= 11 && hour < 13) return '中午好'
  if (hour >= 13 && hour < 18) return '下午好'
  return '晚上好'
}

function dateLabelOf(date: Date): string {
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 · ${WEEKDAYS[date.getDay()] ?? ''}`
}

export function WelcomeBanner() {
  const user = useAuthStore((state) => state.user)
  const navigate = useAppNavigate()
  const metrics = useOverviewMetrics()
  const todos = useTodos()

  const pending = useMemo(() => todos.data?.filter((item) => !item.done).length ?? 0, [todos.data])
  const revenue = useMemo(
    () => metrics.data?.find((item) => item.key === 'revenue')?.value ?? 0,
    [metrics.data],
  )
  const delta = useMemo(
    () => metrics.data?.find((item) => item.key === 'revenue')?.delta ?? 0,
    [metrics.data],
  )
  const goal = useMemo(() => {
    const target = MONTHLY_GOALS[0]
    return goalPercent(revenue, target?.target ?? 0)
  }, [revenue])

  if (!user) return null

  const firstName = user.name || user.email.split('@')[0] || '朋友'
  const loading = metrics.isLoading || todos.isLoading

  return (
    <HeroBanner
      className="mb-3"
      tone="primary"
      variant="soft"
      image={BANNER_IMAGES.welcomeDashboard}
      imageAlt=""
      imageSize="lg"
      imageBleed
      eyebrow={
        <span className="inline-flex items-center gap-1">
          <Sparkles className="size-3" />
          {greetingOf(NOW.getHours())}
        </span>
      }
      title={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {firstName}，欢迎回来
          <Badge tone="primary" variant="soft" size="sm">
            {user.department || user.roleName}
          </Badge>
        </span>
      }
      description={
        loading
          ? '正在汇总今日数据…'
          : pending > 0
            ? `今天有 ${pending} 项待办等你处理，本月交易额已达 ¥${formatCompact(revenue)}。`
            : `今天没有待办积压，本月交易额已达 ¥${formatCompact(revenue)}。`
      }
      actions={
        <>
          <Button
            size="sm"
            variant="primary"
            leftIcon={<Target className="size-3.5" />}
            onClick={() => navigate('/dashboard/performance')}
          >
            查看本月目标
          </Button>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Plus className="size-3.5" />}
            onClick={() => navigate('/business/users')}
          >
            新建用户
          </Button>
        </>
      }
      extra={
        <span className="flex flex-wrap items-center gap-3 text-2xs text-fg-3">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3" />
            {dateLabelOf(NOW)}
          </span>
          <span className="inline-flex items-center gap-1">
            <CircleCheck className="size-3 text-success" />
            环比 {delta >= 0 ? '+' : ''}
            {delta.toFixed(1)}%
          </span>
          <span className="inline-flex items-center gap-1">
            <ArrowUpRight className="size-3" />
            {user.roleName}
          </span>
        </span>
      }
    >
      {!loading && (
        <div className="max-w-[26rem]">
          <div className="mb-1 flex items-center justify-between gap-2 text-2xs">
            <span className="text-fg-3">本月目标达成</span>
            <span className="font-medium text-fg-2 tabular-nums">{goal.toFixed(1)}%</span>
          </div>
          <Progress value={goal} size="xs" tone={goalTone(goal)} />
        </div>
      )}
    </HeroBanner>
  )
}
