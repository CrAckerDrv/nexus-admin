import { useMemo } from 'react'
import { Banknote, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { EChart, type ChartOption } from '@/components/charts/echart'
import {
  Bar,
  Delta,
  FullscreenAction,
  HeaderAction,
  Label,
  Panel,
  ScreenHeader,
  ScreenNumber,
  ScreenShell,
  useClock,
  useRefresh,
  type ScreenTokens,
} from './screen-primitives'

/**
 * 财务驾驶舱（浅色）
 *
 * 适用：财务 / 经营分析 / 董事会汇报。
 *
 * 为什么做浅色：
 * 「大屏」不等于「深色」。财务场景常在会议室投屏、也常被截图进 PPT，
 * 浅底 + 细边框的报表观感比霓虹暗色更专业，也更接近打印稿。
 *
 * 视觉纪律：
 * - 白底 + 1px 冷灰边框，不用阴影（投影会糊）
 * - 数字用等宽体，金额右对齐，千分位统一
 * - 只有一个强调蓝，其余全部中性灰，让「异常项」自然跳出来
 */

const T: ScreenTokens = {
  bg: '#f7f8fa',
  bgSoft: '#ffffff',
  line: 'rgba(15,23,42,0.10)',
  lineSoft: 'rgba(15,23,42,0.06)',
  fg: '#0f172a',
  fg2: '#475569',
  fg3: '#64748b',
  fg4: '#94a3b8',
  accent: '#2563eb',
  accent2: '#7c3aed',
  up: '#059669',
  down: '#dc2626',
  warn: '#d97706',
}

/* ------------------------------ 数据 ------------------------------ */

const HERO = { label: '本月营业收入', value: 12846000, unit: '元', delta: 12.4 }

const KPIS = [
  { label: '营业成本', value: '8,942,300', unit: '元', delta: 8.6, invert: true },
  { label: '毛利润', value: '3,903,700', unit: '元', delta: 21.4, invert: false },
  { label: '毛利率', value: '30.39', unit: '%', delta: 2.1, invert: false },
  { label: '净利率', value: '14.28', unit: '%', delta: 0.9, invert: false },
  { label: '应收账款', value: '2,148,600', unit: '元', delta: -4.2, invert: true },
  { label: '现金流', value: '5,326,900', unit: '元', delta: 18.7, invert: false },
]

const DEPARTMENTS = [
  { name: '电商事业部', revenue: 6420000, cost: 4180000, budget: 6000000 },
  { name: '线下零售', revenue: 3180000, cost: 2340000, budget: 3400000 },
  { name: '企业服务', revenue: 2140000, cost: 1280000, budget: 2600000 },
  { name: '海外业务', revenue: 1106000, cost: 1142300, budget: 1800000 },
]

const BUDGET = [
  { label: 'Q1', plan: 900, actual: 880 },
  { label: 'Q2', plan: 1080, actual: 1140 },
  { label: 'Q3', plan: 1200, actual: 1180 },
  { label: 'Q4', plan: 1260, actual: 1268 },
]

const EXPENSES = [
  { name: '人力成本', value: 42.6 },
  { name: '市场投放', value: 24.1 },
  { name: '研发设备', value: 14.8 },
  { name: '仓储物流', value: 11.3 },
  { name: '其他支出', value: 7.2 },
]

const MONTHLY = Array.from({ length: 12 }, (_, index) => ({
  label: `${index + 1}月`,
  revenue: Math.round(860 + Math.sin(index / 1.9) * 120 + index * 32),
  cost: Math.round(620 + Math.cos(index / 2.3) * 90 + index * 22),
}))

/* ------------------------------ 页面 ------------------------------ */

export default function ScreenFinancePage() {
  const clock = useClock()
  const [refreshing, refresh] = useRefresh()

  const tokens = useMemo(
    () => ({
      fg: T.fg,
      fg2: T.fg2,
      fg3: T.fg3,
      fg4: T.fg4,
      grid: T.lineSoft,
      gridSubtle: 'rgba(15,23,42,0.03)',
      surface: T.bgSoft,
      chart: [T.accent, T.accent2, T.up, T.warn, T.down, '#0ea5e9'] as [
        string,
        string,
        string,
        string,
        string,
        string,
      ],
      version: 0,
    }),
    [],
  )

  const revenueOption = useMemo<ChartOption>(
    () => ({
      grid: { left: 2, right: 4, top: 22, bottom: 2, containLabel: true },
      legend: {
        right: 0,
        top: 0,
        itemWidth: 7,
        itemHeight: 7,
        itemGap: 14,
        textStyle: { color: T.fg3, fontSize: 10 },
      },
      xAxis: {
        type: 'category',
        data: MONTHLY.map((item) => item.label),
        axisLine: { lineStyle: { color: T.line } },
        axisTick: { show: false },
        axisLabel: { color: T.fg4, fontSize: 10 },
      },
      yAxis: [
        {
          type: 'value',
          splitLine: { lineStyle: { color: T.lineSoft } },
          axisLabel: { color: T.fg4, fontSize: 10, formatter: '{value}w' },
        },
        {
          // 毛利率用右侧独立轴：和「万元」同轴会被压成一条贴底的直线
          type: 'value',
          min: 20,
          max: 40,
          splitLine: { show: false },
          axisLabel: { color: T.fg4, fontSize: 10, formatter: '{value}%' },
        },
      ],
      series: [
        {
          name: '收入',
          type: 'bar',
          barWidth: '34%',
          data: MONTHLY.map((item) => item.revenue),
          itemStyle: { borderRadius: [2, 2, 0, 0], color: T.accent },
        },
        {
          name: '成本',
          type: 'bar',
          barWidth: '34%',
          data: MONTHLY.map((item) => item.cost),
          itemStyle: { borderRadius: [2, 2, 0, 0], color: 'rgba(15,23,42,0.16)' },
        },
        {
          name: '毛利率',
          type: 'line',
          yAxisIndex: 1,
          smooth: 0.3,
          symbol: 'circle',
          symbolSize: 4,
          data: MONTHLY.map((item) =>
            Number((((item.revenue - item.cost) / item.revenue) * 100).toFixed(1)),
          ),
          lineStyle: { width: 1.5, color: T.accent2 },
          itemStyle: { color: T.accent2 },
        },
      ],
    }),
    [],
  )

  const budgetOption = useMemo<ChartOption>(
    () => ({
      grid: { left: 2, right: 4, top: 20, bottom: 2, containLabel: true },
      xAxis: {
        type: 'category',
        data: BUDGET.map((item) => item.label),
        axisLine: { lineStyle: { color: T.line } },
        axisTick: { show: false },
        axisLabel: { color: T.fg4, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: T.lineSoft } },
        axisLabel: { color: T.fg4, fontSize: 10 },
      },
      series: [
        {
          name: '预算',
          type: 'bar',
          barWidth: '46%',
          data: BUDGET.map((item) => item.plan),
          itemStyle: { borderRadius: [2, 2, 0, 0], color: 'rgba(15,23,42,0.12)' },
        },
        {
          name: '实际',
          type: 'bar',
          barWidth: '46%',
          data: BUDGET.map((item) => item.actual),
          itemStyle: {
            borderRadius: [2, 2, 0, 0],
            color: (params: { dataIndex: number }) => {
              const row = BUDGET[params.dataIndex]
              return row && row.actual <= row.plan ? T.accent : T.warn
            },
          },
        },
      ],
    }),
    [],
  )

  const expenseOption = useMemo<ChartOption>(
    () => ({
      tooltip: { trigger: 'item', formatter: '{b}<br/>{c}%' },
      series: [
        {
          type: 'pie',
          radius: ['64%', '88%'],
          center: ['50%', '50%'],
          itemStyle: { borderColor: T.bgSoft, borderWidth: 2 },
          label: { show: false },
          labelLine: { show: false },
          data: EXPENSES.map((item, index) => ({
            name: item.name,
            value: item.value,
            itemStyle: {
              color: [T.accent, T.accent2, '#0ea5e9', T.warn, 'rgba(15,23,42,0.22)'][index],
            },
          })),
        },
      ],
    }),
    [],
  )

  const totalPlan = BUDGET.reduce((sum, item) => sum + item.plan, 0)
  const totalActual = BUDGET.reduce((sum, item) => sum + item.actual, 0)

  return (
    <ScreenShell tokens={T} glow="rgba(37,99,235,0.06)">
      <ScreenHeader
        tokens={T}
        title="财务驾驶舱"
        pulse={false}
        meta={
          <span className="hidden text-[0.6875rem] tabular-nums sm:inline" style={{ color: T.fg3 }}>
            {clock}
          </span>
        }
        actions={
          <>
            <span className="hidden lg:inline" style={{ color: T.fg3 }}>
              会计期间 2026-11 · 已结账
            </span>
            <HeaderAction tokens={T} icon={Wallet} label="刷新" onClick={refresh} spinning={refreshing} />
            <FullscreenAction tokens={T} />
          </>
        }
      />

      {/* Hero */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 border-b py-5 lg:grid-cols-[minmax(16.25rem,18.75rem)_minmax(0,1fr)]" style={{ borderColor: T.line }}>
        <div className="min-w-0">
          <Label tokens={T}>{HERO.label}</Label>
          <div className="mt-1.5 flex items-end gap-2">
            <span className="font-mono text-[2.125rem] leading-none font-semibold tracking-tight tabular-nums sm:text-[2.5rem]" style={{ color: T.fg }}>
              <ScreenNumber value={HERO.value} duration={1600} />
            </span>
            <span className="pb-1 text-[0.75rem]" style={{ color: T.fg4 }}>
              {HERO.unit}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Delta tokens={T} value={HERO.delta} />
            <span className="text-[0.6875rem]" style={{ color: T.fg4 }}>
              环比上月
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-y-3 sm:grid-cols-3 xl:grid-cols-6">
          {KPIS.map((item, index) => (
            <div
              key={item.label}
              className={index === 0 ? 'min-w-0 px-3' : 'min-w-0 border-l px-3'}
              style={{ borderColor: T.line }}
            >
              <p className="truncate text-[0.625rem] tracking-wide" style={{ color: T.fg4 }}>
                {item.label}
              </p>
              <p
                className="mt-1.5 truncate font-mono text-[1rem] leading-none font-medium tabular-nums"
                style={{ color: T.fg }}
              >
                <ScreenNumber value={item.value} duration={1200 + index * 90} />
                <span className="ml-0.5 text-[0.625rem] font-normal" style={{ color: T.fg4 }}>
                  {item.unit}
                </span>
              </p>
              <div className="mt-1.5 flex items-center gap-1">
                <Delta tokens={T} value={item.invert ? -item.delta : item.delta} />
                <span className="truncate text-[0.625rem]" style={{ color: T.fg4 }}>
                  {item.invert ? '成本项' : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 第二行 */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 border-b py-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" style={{ borderColor: T.line }}>
        <Panel
          tokens={T}
          title="收入与成本"
          extra={<Label tokens={T}>单位：万元</Label>}
        >
          <EChart option={revenueOption} height={196} tokens={tokens} />
        </Panel>

        <Panel tokens={T} title="费用结构" extra={<Label tokens={T}>占营业成本</Label>}>
          <div className="flex items-center gap-4">
            <div className="relative size-[8rem] shrink-0">
              <EChart option={expenseOption} height={128} tokens={tokens} />
              <span className="pointer-events-none absolute inset-0 grid place-items-center">
                <span className="text-center">
                  <span className="block text-[0.5625rem]" style={{ color: T.fg4 }}>
                    人力占比
                  </span>
                  <span className="block font-mono text-[0.8125rem] font-semibold tabular-nums" style={{ color: T.fg }}>
                    42.6%
                  </span>
                </span>
              </span>
            </div>
            <ul className="min-w-0 flex-1 space-y-[0.4375rem]">
              {EXPENSES.map((item, index) => (
                <li key={item.name} className="flex items-center gap-1.5 text-[0.6875rem]">
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: [T.accent, T.accent2, '#0ea5e9', T.warn, 'rgba(15,23,42,0.22)'][index],
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate" style={{ color: T.fg2 }}>
                    {item.name}
                  </span>
                  <span className="shrink-0 tabular-nums" style={{ color: T.fg3 }}>
                    {item.value.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>

      {/* 第三行 */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 border-b py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]" style={{ borderColor: T.line }}>
        <Panel
          tokens={T}
          title="预算执行"
          extra={
            <Label tokens={T}>
              {((totalActual / totalPlan) * 100).toFixed(1)}% 执行率
            </Label>
          }
        >
          <EChart option={budgetOption} height={172} tokens={tokens} />
        </Panel>

        <Panel
          tokens={T}
          title="分部门收支"
          extra={
            <span className="flex items-center gap-2 text-[0.625rem]" style={{ color: T.fg4 }}>
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="size-3" style={{ color: T.up }} />
                超预算
              </span>
              <span className="inline-flex items-center gap-1">
                <TrendingDown className="size-3" style={{ color: T.down }} />
                未达标
              </span>
            </span>
          }
        >
          <table className="w-full text-[0.6875rem]">
            <thead>
              <tr style={{ color: T.fg4 }}>
                <th className="pb-1.5 text-left font-normal">部门</th>
                <th className="pb-1.5 text-right font-normal">收入</th>
                <th className="pb-1.5 text-right font-normal">成本</th>
                <th className="pb-1.5 text-right font-normal">毛利率</th>
                <th className="w-16 pb-1.5 text-right font-normal">预算达成</th>
              </tr>
            </thead>
            <tbody>
              {DEPARTMENTS.map((item) => {
                const margin = ((item.revenue - item.cost) / item.revenue) * 100
                const rate = item.revenue / item.budget
                return (
                  <tr key={item.name} className="border-t" style={{ borderColor: T.lineSoft }}>
                    <td className="py-2 text-left" style={{ color: T.fg2 }}>
                      {item.name}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums" style={{ color: T.fg }}>
                      {(item.revenue / 10000).toFixed(0)}w
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums" style={{ color: T.fg3 }}>
                      {(item.cost / 10000).toFixed(0)}w
                    </td>
                    <td
                      className="py-2 text-right font-mono tabular-nums"
                      style={{ color: margin < 20 ? T.warn : T.up }}
                    >
                      {margin.toFixed(1)}%
                    </td>
                    <td className="py-2 text-right">
                      <span
                        className="font-mono text-[0.625rem] tabular-nums"
                        style={{ color: rate >= 1 ? T.up : T.down }}
                      >
                        {(rate * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* 分部门达成率：用进度条而不是第二张表，避免页面出现两块同构表格 */}
          <div className="mt-3 space-y-2.5">
            {DEPARTMENTS.map((item) => {
              const rate = Math.min(item.revenue / item.budget, 1.2)
              return (
                <div key={item.name}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[0.625rem]" style={{ color: T.fg4 }}>
                      {item.name}
                    </span>
                    <span className="shrink-0 font-mono text-[0.625rem] tabular-nums" style={{ color: T.fg3 }}>
                      {(item.revenue / 10000).toFixed(0)}w / {(item.budget / 10000).toFixed(0)}w
                    </span>
                  </div>
                  <div className="mt-1">
                    <Bar
                      tokens={T}
                      ratio={rate / 1.2}
                      tone={rate >= 1 ? T.up : rate >= 0.8 ? T.warn : T.down}
                      height={3}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>

      {/* 底部：关键比率 */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 py-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: '费用率', value: 69.6, hint: '较上月 -1.2pt', icon: Banknote },
          { label: '应收周转天数', value: 42, hint: '较上月 -3 天', icon: TrendingDown },
          { label: '预算执行率', value: (totalActual / totalPlan) * 100, hint: '年度累计', icon: TrendingUp },
          { label: '经营现金覆盖', value: 1.62, hint: '倍数', icon: Wallet },
        ].map((item, index) => (
          <div
            key={item.label}
            className="flex items-center gap-3 border-t pt-2.5"
            style={{ borderColor: T.lineSoft }}
          >
            <span
              className="grid size-7 shrink-0 place-items-center rounded-md"
              style={{ backgroundColor: 'rgba(37,99,235,0.08)', color: T.accent }}
            >
              <item.icon className="size-3.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[0.625rem]" style={{ color: T.fg4 }}>
                {item.label}
              </p>
              <p className="flex items-baseline gap-1">
                <span className="font-mono text-[0.9375rem] font-medium tabular-nums" style={{ color: T.fg }}>
                  <ScreenNumber value={`${item.value.toFixed(item.value < 10 ? 2 : 1)}${item.label.includes('率') ? '%' : ''}`}
                    duration={1200 + index * 90}
                  />
                </span>
                <span className="text-[0.625rem]" style={{ color: T.fg4 }}>
                  {item.hint}
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>

      <footer
        className="flex flex-wrap items-center gap-3 pt-1 pb-2 text-[0.625rem]"
        style={{ color: T.fg4 }}
      >
        <span>数据来源：财务系统 2026-11 结账快照</span>
        <span className="ml-auto">演示数据 · 已脱敏</span>
      </footer>
    </ScreenShell>
  )
}
