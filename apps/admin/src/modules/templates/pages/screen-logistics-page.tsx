import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Boxes, PackageCheck, Truck, Warehouse } from 'lucide-react'
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
 * 仓储物流大屏
 *
 * 适用：仓储 / 供应链 / 配送调度。
 *
 * 与前两个大屏的差异：
 * - 主视图是「仓网」而不是「趋势」：先把地理与干线关系摆出来，再谈数字
 * - 深墨绿而不是蓝：物流场景的心理色是「畅通」，绿色在这里是语义词不是装饰
 * - 高密度：出入库、时效、运力、爆仓预警同屏，调度员不用翻页
 */

const T: ScreenTokens = {
  bg: '#04120f',
  bgSoft: '#08201a',
  line: 'rgba(110,231,183,0.12)',
  lineSoft: 'rgba(110,231,183,0.06)',
  fg: '#e6f7ef',
  fg2: '#93b9a9',
  fg3: '#688a7c',
  fg4: '#456054',
  accent: '#34d399',
  accent2: '#a3e635',
  up: '#34d399',
  down: '#fb7185',
  warn: '#fbbf24',
}

/* ------------------------------ 数据 ------------------------------ */

const WAREHOUSES = [
  { name: '华东仓', city: '上海', x: 76, y: 46, stock: 86, status: 'ok' as const },
  { name: '华南仓', city: '广州', x: 70, y: 74, stock: 92, status: 'warn' as const },
  { name: '华北仓', city: '北京', x: 66, y: 26, stock: 74, status: 'ok' as const },
  { name: '华中仓', city: '武汉', x: 62, y: 52, stock: 68, status: 'ok' as const },
  { name: '西南仓', city: '成都', x: 40, y: 58, stock: 58, status: 'ok' as const },
  { name: '西北仓', city: '西安', x: 48, y: 38, stock: 34, status: 'ok' as const },
  { name: '东北仓', city: '沈阳', x: 80, y: 16, stock: 97, status: 'crit' as const },
]

/** 干线：从华东仓发往各地 */
const TRUNKS: Array<[number, number]> = [
  [0, 2],
  [0, 1],
  [0, 3],
  [0, 4],
  [3, 6],
  [4, 5],
]

const KPI = [
  { label: '今日入库', value: '186,420', unit: '件', delta: 12.8 },
  { label: '今日出库', value: '204,318', unit: '件', delta: 16.4 },
  { label: '在途订单', value: '32,846', unit: '单', delta: 4.2 },
  { label: '准时率', value: '96.8', unit: '%', delta: 1.4 },
  { label: '平均时长', value: '28.6', unit: 'h', delta: -3.8 },
  { label: '爆仓预警', value: '1', unit: '仓', delta: -50 },
]

const INOUT = Array.from({ length: 12 }, (_, index) => ({
  label: `${String(index + 8).padStart(2, '0')}:00`,
  inbound: Math.round(12000 + Math.sin(index / 2.1) * 4200 + index * 520),
  outbound: Math.round(14000 + Math.cos(index / 2.4) * 4800 + index * 640),
}))

const AGING = [
  { name: '0-6 小时', value: 38.2 },
  { name: '6-12 小时', value: 26.4 },
  { name: '12-24 小时', value: 21.6 },
  { name: '24-48 小时', value: 9.8 },
  { name: '48 小时以上', value: 4.0 },
]

const SKU_RISK = [
  { sku: 'SKU-8842', name: '智能手环 Pro', stock: 12, need: 860, days: 0.4 },
  { sku: 'SKU-2210', name: '无线耳机 X5', stock: 48, need: 1240, days: 0.9 },
  { sku: 'SKU-5197', name: '高端保温杯', stock: 128, need: 980, days: 2.1 },
  { sku: 'SKU-3306', name: '运动跑鞋', stock: 216, need: 1100, days: 3.4 },
]

const ROUTES = [
  { from: '上海', to: '杭州', count: 1284, ontime: 99.2 },
  { from: '上海', to: '南京', count: 986, ontime: 98.6 },
  { from: '广州', to: '深圳', count: 864, ontime: 97.4 },
  { from: '北京', to: '天津', count: 742, ontime: 99.1 },
  { from: '武汉', to: '长沙', count: 528, ontime: 95.8 },
]

const STATUS_COLOR = { ok: T.up, warn: T.warn, crit: T.down }

/** 干线流动画：用 CSS 虚线偏移做「在途」的暗示，不跑 JS 定时器 */
const FLOW_CSS = `
@keyframes n-dash-flow { to { stroke-dashoffset: -24; } }
.n-trunk-flow { stroke-dasharray: 4 8; animation: n-dash-flow 1.6s linear infinite; }
@media (prefers-reduced-motion: reduce) {
  .n-trunk-flow { animation: none; }
}
`

/* ------------------------------ 页面 ------------------------------ */

export default function ScreenLogisticsPage() {
  const clock = useClock()
  const [refreshing, refresh] = useRefresh()
  const [selected, setSelected] = useState<string | null>('华东仓')
  const [mapReady, setMapReady] = useState(false)

  /** 地图按需注册 */
  useEffect(() => {
    let alive = true
    void import('@/components/charts/echart-map').then(({ ensureChinaMap }) => {
      ensureChinaMap()
      if (alive) setMapReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  const tokens = useMemo(
    () => ({
      fg: T.fg,
      fg2: T.fg2,
      fg3: T.fg3,
      fg4: T.fg4,
      grid: T.lineSoft,
      gridSubtle: 'rgba(110,231,183,0.03)',
      surface: T.bgSoft,
      chart: [T.accent, T.accent2, T.warn, T.down, '#22d3ee', '#a78bfa'] as [
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

  const mapOption = useMemo<ChartOption>(
    () => ({
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'map',
          map: 'china',
          roam: false,
          zoom: 1.16,
          top: 4,
          bottom: 4,
          itemStyle: {
            areaColor: '#0a1f19',
            borderColor: 'rgba(110,231,183,0.14)',
            borderWidth: 0.5,
          },
          emphasis: {
            itemStyle: { areaColor: 'rgba(52,211,153,0.35)', borderColor: 'transparent' },
            label: { show: false },
          },
          label: { show: false },
          data: [
            ['上海', 86], ['广东', 92], ['北京', 74], ['湖北', 68],
            ['四川', 58], ['陕西', 34], ['辽宁', 97], ['浙江', 64],
            ['江苏', 78], ['山东', 56], ['福建', 48], ['湖南', 42],
          ].map(([name, value]) => ({ name, value })),
        },
      ],
      visualMap: {
        show: false,
        min: 0,
        max: 100,
        inRange: {
          color: ['#0a1f19', '#0e2a22', '#12483a', '#1a6b55', '#22967a', '#34d399'],
        },
      },
    }),
    [],
  )

  const inoutOption = useMemo<ChartOption>(
    () => ({
      grid: { left: 2, right: 2, top: 20, bottom: 2, containLabel: true },
      legend: {
        right: 0,
        top: 0,
        itemWidth: 6,
        itemHeight: 6,
        itemGap: 12,
        textStyle: { color: T.fg3, fontSize: 10 },
      },
      xAxis: {
        type: 'category',
        data: INOUT.map((item) => item.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: T.fg4, fontSize: 9, interval: 1 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: T.lineSoft } },
        axisLabel: { color: T.fg4, fontSize: 9, formatter: '{value}k' },
      },
      series: [
        {
          name: '入库',
          type: 'bar',
          barWidth: '38%',
          data: INOUT.map((item) => item.inbound),
          itemStyle: { borderRadius: [2, 2, 0, 0], color: 'rgba(52,211,153,0.55)' },
        },
        {
          name: '出库',
          type: 'bar',
          barWidth: '38%',
          data: INOUT.map((item) => item.outbound),
          itemStyle: { borderRadius: [2, 2, 0, 0], color: T.accent2 },
        },
      ],
    }),
    [],
  )

  const agingOption = useMemo<ChartOption>(
    () => ({
      series: [
        {
          type: 'pie',
          radius: ['58%', '84%'],
          center: ['50%', '50%'],
          roseType: 'radius',
          itemStyle: { borderColor: T.bg, borderWidth: 2 },
          label: { show: false },
          labelLine: { show: false },
          data: AGING.map((item, index) => ({
            name: item.name,
            value: item.value,
            itemStyle: { color: [T.accent, '#22d3ee', T.accent2, T.warn, T.down][index] },
          })),
        },
      ],
    }),
    [],
  )

  const totalIn = INOUT.reduce((sum, item) => sum + item.inbound, 0)
  const totalOut = INOUT.reduce((sum, item) => sum + item.outbound, 0)
  const active = WAREHOUSES.find((item) => item.name === selected)

  return (
    <ScreenShell tokens={T}>
      <style>{FLOW_CSS}</style>

      <ScreenHeader
        tokens={T}
        title="仓储物流大屏"
        meta={
          <span className="hidden text-[0.6875rem] tabular-nums sm:inline" style={{ color: T.fg3 }}>
            {clock}
          </span>
        }
        actions={
          <>
            <span className="hidden lg:inline" style={{ color: T.fg3 }}>
              全国 7 仓 · 42 条干线
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-md px-2 py-1"
              style={{ backgroundColor: 'rgba(52,211,153,0.10)', color: T.up }}
            >
              <Truck className="size-3" />
              调度正常
            </span>
            <HeaderAction tokens={T} icon={PackageCheck} label="刷新" onClick={refresh} spinning={refreshing} />
            <FullscreenAction tokens={T} />
          </>
        }
      />

      {/* KPI */}
      <div
        className="grid grid-cols-2 gap-y-3 border-b py-4 sm:grid-cols-3 lg:grid-cols-6"
        style={{ borderColor: T.line }}
      >
        {KPI.map((item, index) => (
          <div
            key={item.label}
            className={index === 0 ? 'min-w-0 px-3' : 'min-w-0 border-l px-3'}
            style={{ borderColor: T.line }}
          >
            <p className="truncate text-[0.625rem] tracking-wide" style={{ color: T.fg4 }}>
              {item.label}
            </p>
            <p
              className="mt-1.5 truncate font-mono text-[1.0625rem] leading-none font-medium tabular-nums"
              style={{ color: item.label.includes('预警') ? T.warn : T.fg }}
            >
              <ScreenNumber value={item.value} duration={1200 + index * 90} />
              <span className="ml-0.5 text-[0.625rem] font-normal" style={{ color: T.fg4 }}>
                {item.unit}
              </span>
            </p>
            <div className="mt-1.5">
              <Delta tokens={T} value={item.delta} />
            </div>
          </div>
        ))}
      </div>

      {/* 主视图：仓网 + 出入库 */}
      <div
        className="grid grid-cols-1 gap-x-6 gap-y-5 border-b py-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]"
        style={{ borderColor: T.line }}
      >
        <Panel
          tokens={T}
          title="仓网与干线"
          extra={
            <span className="flex items-center gap-2 text-[0.625rem]" style={{ color: T.fg4 }}>
              {(['ok', 'warn', 'crit'] as const).map((status) => (
                <span key={status} className="inline-flex items-center gap-1">
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[status] }} />
                  {status === 'ok' ? '正常' : status === 'warn' ? '紧张' : '爆仓'}
                </span>
              ))}
            </span>
          }
        >
          {/* 地图 + 叠加层：仓点与干线用百分比定位，随容器自适应 */}
          <div className="relative">
            {mapReady ? (
              <EChart option={mapOption} height={252} tokens={tokens} />
            ) : (
              <div className="grid h-[15.75rem] place-items-center text-[0.6875rem]" style={{ color: T.fg4 }}>
                地图加载中…
              </div>
            )}

            <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
              {TRUNKS.map(([from, to], index) => {
                const a = WAREHOUSES[from]
                const b = WAREHOUSES[to]
                if (!a || !b) return null
                return (
                  <line
                    key={index}
                    x1={`${a.x}%`}
                    y1={`${a.y}%`}
                    x2={`${b.x}%`}
                    y2={`${b.y}%`}
                    stroke={T.accent}
                    strokeWidth="1"
                    opacity="0.55"
                    className="n-trunk-flow"
                  />
                )
              })}
            </svg>

            {WAREHOUSES.map((warehouse) => {
              const isActive = warehouse.name === selected
              return (
                <button
                  key={warehouse.name}
                  type="button"
                  onClick={() => setSelected(warehouse.name)}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${warehouse.x}%`, top: `${warehouse.y}%` }}
                  aria-label={`${warehouse.name} 库存水位 ${warehouse.stock}%`}
                >
                  <span
                    className="block rounded-full transition-transform hover:scale-125"
                    style={{
                      width: isActive ? 10 : 7,
                      height: isActive ? 10 : 7,
                      backgroundColor: STATUS_COLOR[warehouse.status],
                      boxShadow: `0 0 0 3px ${STATUS_COLOR[warehouse.status]}33`,
                    }}
                  />
                  <span
                    className="mt-1 block whitespace-nowrap text-[0.5625rem]"
                    style={{ color: isActive ? T.fg : T.fg3 }}
                  >
                    {warehouse.city}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
            {WAREHOUSES.slice(0, 4).map((warehouse) => (
              <div key={warehouse.name}>
                <div className="flex items-baseline justify-between gap-1">
                  <span className="truncate text-[0.625rem]" style={{ color: T.fg4 }}>
                    {warehouse.name}
                  </span>
                  <span
                    className="shrink-0 font-mono text-[0.625rem] tabular-nums"
                    style={{ color: STATUS_COLOR[warehouse.status] }}
                  >
                    {warehouse.stock}%
                  </span>
                </div>
                <div className="mt-1">
                  <Bar
                    tokens={T}
                    ratio={warehouse.stock / 100}
                    tone={STATUS_COLOR[warehouse.status]}
                    height={3}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel
            tokens={T}
            title="出入库对比"
            extra={
              <Label tokens={T}>
                净 {totalOut > totalIn ? '+' : ''}
                {((totalOut - totalIn) / 1000).toFixed(1)}k
              </Label>
            }
          >
            <EChart option={inoutOption} height={158} tokens={tokens} />
          </Panel>

          <Panel tokens={T} title="时效分布" extra={<Label tokens={T}>在途 32,846 单</Label>}>
            <div className="flex items-center gap-3">
              <div className="size-[6rem] shrink-0">
                <EChart option={agingOption} height={96} tokens={tokens} />
              </div>
              <ul className="min-w-0 flex-1 space-y-1">
                {AGING.map((item, index) => (
                  <li key={item.name} className="flex items-center gap-1.5 text-[0.625rem]">
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: [T.accent, '#22d3ee', T.accent2, T.warn, T.down][index],
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
      </div>

      {/* 第三行：SKU 风险 / 干线 / 选中仓详情 */}
      <div
        className="grid grid-cols-1 gap-x-6 gap-y-5 border-b py-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1fr)]"
        style={{ borderColor: T.line }}
      >
        <Panel tokens={T} title="库存告警" extra={<Label tokens={T}>按可售天数</Label>}>
          <ul className="space-y-2.5">
            {SKU_RISK.map((item) => (
              <li key={item.sku}>
                <div className="flex items-baseline gap-2">
                  <span className="shrink-0 font-mono text-[0.625rem]" style={{ color: T.fg4 }}>
                    {item.sku}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.6875rem]" style={{ color: T.fg2 }}>
                    {item.name}
                  </span>
                  <span
                    className="shrink-0 font-mono text-[0.625rem] tabular-nums"
                    style={{ color: item.days < 1 ? T.down : item.days < 2.5 ? T.warn : T.fg3 }}
                  >
                    {item.days} 天
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Bar tokens={T} ratio={item.stock / item.need} tone={item.days < 1 ? T.down : T.warn} />
                  <span className="w-16 shrink-0 text-right font-mono text-[0.625rem] tabular-nums" style={{ color: T.fg4 }}>
                    {item.stock}/{item.need}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel tokens={T} title="干线时效" extra={<Label tokens={T}>TOP 5</Label>}>
          <table className="w-full text-[0.6875rem]">
            <thead>
              <tr style={{ color: T.fg4 }}>
                <th className="pb-1.5 text-left font-normal">线路</th>
                <th className="pb-1.5 text-right font-normal">单量</th>
                <th className="pb-1.5 text-right font-normal">准时率</th>
              </tr>
            </thead>
            <tbody>
              {ROUTES.map((route) => (
                <tr key={`${route.from}-${route.to}`} className="border-t" style={{ borderColor: T.lineSoft }}>
                  <td className="py-1.5">
                    <span className="flex items-center gap-1" style={{ color: T.fg2 }}>
                      <span className="truncate">{route.from}</span>
                      <ArrowRight className="size-2.5 shrink-0" style={{ color: T.fg4 }} />
                      <span className="truncate">{route.to}</span>
                    </span>
                  </td>
                  <td className="py-1.5 text-right font-mono tabular-nums" style={{ color: T.fg3 }}>
                    {route.count.toLocaleString()}
                  </td>
                  <td
                    className="py-1.5 text-right font-mono tabular-nums"
                    style={{ color: route.ontime >= 98 ? T.up : route.ontime >= 96 ? T.warn : T.down }}
                  >
                    {route.ontime}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel
          tokens={T}
          title="仓详情"
          extra={<Label tokens={T}>{active ? active.city : '未选择'}</Label>}
        >
          {active ? (
            <div className="space-y-3">
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[0.75rem] font-medium" style={{ color: T.fg }}>
                    {active.name}
                  </span>
                  <span className="font-mono text-[0.6875rem] tabular-nums" style={{ color: STATUS_COLOR[active.status] }}>
                    库存 {active.stock}%
                  </span>
                </div>
                <div className="mt-1.5">
                  <Bar tokens={T} ratio={active.stock / 100} tone={STATUS_COLOR[active.status]} height={4} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '今日入库', value: '18,240', unit: '件' },
                  { label: '今日出库', value: '21,860', unit: '件' },
                  { label: '在途', value: '4,280', unit: '单' },
                  { label: '准时率', value: '98.4', unit: '%' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-sm px-2 py-1.5"
                    style={{ backgroundColor: 'rgba(52,211,153,0.06)', border: `1px solid ${T.line}` }}
                  >
                    <p className="text-[0.625rem]" style={{ color: T.fg4 }}>
                      {item.label}
                    </p>
                    <p className="mt-0.5 font-mono text-[0.8125rem] tabular-nums" style={{ color: T.fg }}>
                      <ScreenNumber value={item.value} duration={1000} />
                      <span className="ml-0.5 text-[0.5625rem]" style={{ color: T.fg4 }}>
                        {item.unit}
                      </span>
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t pt-2" style={{ borderColor: T.lineSoft }}>
                <p className="text-[0.625rem]" style={{ color: T.fg4 }}>
                  容量建议
                </p>
                <p className="mt-1 text-[0.6875rem] leading-5" style={{ color: T.fg2 }}>
                  {active.stock > 90
                    ? '水位偏高，建议向华中仓分拨，并压缩补货批次。'
                    : active.stock > 70
                      ? '水位正常偏高，关注出入库节奏即可。'
                      : '水位健康，可承接周边区域的分拨需求。'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[0.6875rem]" style={{ color: T.fg4 }}>
              点击地图上的仓点查看详情
            </p>
          )}
        </Panel>
      </div>

      <footer className="flex flex-wrap items-center gap-3 pt-1 pb-2 text-[0.625rem]" style={{ color: T.fg4 }}>
        <span className="inline-flex items-center gap-1">
          <Warehouse className="size-3" />7 仓 / 42 干线
        </span>
        <span className="inline-flex items-center gap-1">
          <Boxes className="size-3" />
          SKU 12,846
        </span>
        <span className="inline-flex items-center gap-1">
          <Truck className="size-3" />在途 32,846 单
        </span>
        <span className="ml-auto">演示数据 · 已脱敏</span>
      </footer>
    </ScreenShell>
  )
}
