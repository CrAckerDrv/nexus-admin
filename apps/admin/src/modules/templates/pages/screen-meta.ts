import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Boxes, Building2, Cpu, Factory, Flame, MonitorPlay, Server, Wallet } from 'lucide-react'

/**
 * 大屏模板清单
 *
 * 单一事实来源：侧边栏、总览页、大屏列表页、命令面板、截图脚本都读这一份。
 * 新增一个风格 = 加一条记录 + 一个页面文件，其余（导航 / 路由 / 列表卡片）自动生效。
 *
 * `load` 用动态 import 而不是静态 import：
 * 每块屏几十 KB 的图表与数据不该进首屏包，只有真正打开时才拉取。
 */

export type ScreenId =
  | 'command-center'
  | 'ops'
  | 'finance'
  | 'logistics'
  | 'city'
  | 'manufacturing'
  | 'campaign'
  | 'compute'

export interface ScreenMeta {
  id: ScreenId
  /** 独立页面路径（standalone，新标签页打开） */
  path: string
  title: string
  subtitle: string
  /** 适用系统：帮使用者快速判断「这块屏是不是给我的」 */
  fitFor: string
  /** 风格标签 */
  style: string
  icon: LucideIcon
  /** 预览用的三色，对应页面的主色 / 辅色 / 强调色 */
  swatches: [string, string, string]
  /** 深色 or 浅色底 */
  scheme: 'dark' | 'light'
  /** 数据密度：一眼看出信息量 */
  density: 'high' | 'medium'
  highlights: string[]
  /** 页面组件（懒加载） */
  load: () => Promise<{ default: ComponentType }>
}

export const SCREENS: ScreenMeta[] = [
  {
    id: 'command-center',
    path: '/templates/command-center',
    title: '运营大屏',
    subtitle: '极简暗色 · 让一个数字撑起整屏',
    fitFor: '电商 / 增长运营',
    style: '极简高端',
    icon: MonitorPlay,
    swatches: ['#07080b', '#5b8cff', '#3ddc97'],
    scheme: 'dark',
    density: 'medium',
    highlights: ['发丝线分隔，不用卡片盒子', 'Hero 数字 + 7 项 KPI', '区域条形 + 漏斗 + 排行'],
    load: () => import('./command-center-page'),
  },
  {
    id: 'ops',
    path: '/templates/screen-ops',
    title: '运维监控墙',
    subtitle: '深夜蓝黑 · 服务健康与告警流',
    fitFor: '运维 / SRE / 值班室',
    style: '终端科技感',
    icon: Server,
    swatches: ['#050a12', '#22d3ee', '#f87171'],
    scheme: 'dark',
    density: 'high',
    highlights: [
      '主机健康矩阵（heatmap 格子）',
      'QPS / P95 双轴 + 阈值线',
      '告警时间线 + 实时日志',
    ],
    load: () => import('./screen-ops-page'),
  },
  {
    id: 'finance',
    path: '/templates/screen-finance',
    title: '财务驾驶舱',
    subtitle: '浅色纸感 · 报表级精确',
    fitFor: '财务 / 经营分析',
    style: '简洁纸感',
    icon: Wallet,
    swatches: ['#f7f8fa', '#2563eb', '#0f172a'],
    scheme: 'light',
    density: 'high',
    highlights: ['白底细边框，可打印可投屏', '预算执行瀑布 + 环形达成率', '分部门收支明细表'],
    load: () => import('./screen-finance-page'),
  },
  {
    id: 'logistics',
    path: '/templates/screen-logistics',
    title: '仓储物流大屏',
    subtitle: '深墨绿 · 仓网与时效',
    fitFor: '仓储 / 供应链 / 配送',
    style: '冷冽地图风',
    icon: Boxes,
    swatches: ['#04120f', '#34d399', '#a3e635'],
    scheme: 'dark',
    density: 'high',
    highlights: ['仓网地图 + 干线流向', '出入库对比 + 时效达成率', '爆仓预警与运力水位'],
    load: () => import('./screen-logistics-page'),
  },
  {
    id: 'city',
    path: '/templates/screen-city',
    title: '城市运行大屏',
    subtitle: '暗夜紫 · 网格治理与工单闭环',
    fitFor: '政务 / 城市治理 / 应急',
    style: '指挥中心风',
    icon: Building2,
    swatches: ['#08060f', '#a78bfa', '#fbbf24'],
    scheme: 'dark',
    density: 'high',
    highlights: [
      '网格热力 + 点位详情联动',
      '事件工单流（悬停暂停）',
      '24h 接单处置双轴 + 单位排行',
    ],
    load: () => import('./screen-city-page'),
  },
  {
    id: 'manufacturing',
    path: '/templates/screen-manufacturing',
    title: '生产制造大屏',
    subtitle: '浅灰车间 · OEE 与产线节拍',
    fitFor: '制造 / MES / 车间',
    style: '工业仪表盘',
    icon: Factory,
    swatches: ['#f4f6f8', '#0f766e', '#d97706'],
    scheme: 'light',
    density: 'high',
    highlights: ['OEE 仪表 + 目标达成', '产线切换联动节拍与良率', '工位状态矩阵 + 安灯呼叫'],
    load: () => import('./screen-manufacturing-page'),
  },
  {
    id: 'campaign',
    path: '/templates/screen-campaign',
    title: '大促战报大屏',
    subtitle: '红金 · 秒级 GMV 冲刺',
    fitFor: '电商 / 市场营销 / 直播',
    style: '战报庆典风',
    icon: Flame,
    swatches: ['#150608', '#f43f5e', '#fbbf24'],
    scheme: 'dark',
    density: 'medium',
    highlights: ['秒级 GMV 跳动 + 波次倒计时', '分时曲线与渠道雷达', '品类 PK 与爆款售罄进度'],
    load: () => import('./screen-campaign-page'),
  },
  {
    id: 'compute',
    path: '/templates/screen-compute',
    title: '智算中心大屏',
    subtitle: '深空紫 · GPU 与 Token 吞吐',
    fitFor: 'AI 平台 / 算力运营',
    style: '算力科技感',
    icon: Cpu,
    swatches: ['#07070f', '#a855f7', '#22d3ee'],
    scheme: 'dark',
    density: 'high',
    highlights: ['GPU 卡阵热力 + 单卡详情', 'Token 吞吐与队列双轴', '模型调用分布 + 节点水位'],
    load: () => import('./screen-compute-page'),
  },
]

/** 取单个大屏元信息 */
export function getScreen(id: ScreenId): ScreenMeta | undefined {
  return SCREENS.find((item) => item.id === id)
}
