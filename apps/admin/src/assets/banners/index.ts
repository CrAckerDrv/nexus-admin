/**
 * 横幅插画素材
 *
 * 全部为 AI 生成的 3D 黏土风格插画（透明底 WebP，384×384，单张 13–26 KB）。
 * 生成脚本见 `scripts/_gen-banners.py`，压缩脚本见 `scripts/_optimize-banners.py`。
 *
 * 为什么用 WebP 而不是 PNG：同一张插画体积只有 PNG 的 1/10，
 * 并且在 2× 屏上仍然清晰；Vite 会把它们作为独立资源产物，不占首屏 JS。
 */
import chartReport from './chart-report.webp'
import donut from './donut.webp'
import drone from './drone.webp'
import emptyBox from './empty-box.webp'
import gift from './gift.webp'
import keyboard from './keyboard.webp'
import lockShield from './lock-shield.webp'
import rocket from './rocket.webp'
import sandwich from './sandwich.webp'
import serverError from './server-error.webp'
import toolbox from './toolbox.webp'
import welcomeDashboard from './welcome-dashboard.webp'

export const BANNER_IMAGES = {
  /** 数据看板 + 盾牌 + 金币：欢迎 / 概览类横幅 */
  welcomeDashboard,
  /** 甜甜圈：轻松、活动、内容类横幅 */
  donut,
  /** 工具箱：组件库、系统能力类横幅 */
  toolbox,
  /** 礼盒：优惠、赠品、活动类横幅 */
  gift,
  /** 火箭：新版本、发布、增长类横幅 */
  rocket,
  /** 无人机：运维、监控、系统状态类横幅 */
  drone,
  /** 三明治：通知、消息、待处理类横幅 */
  sandwich,
  /** 机械键盘：更新日志、输入、效率类横幅 */
  keyboard,
  /** 图表报告：报表、分析、数据下载类横幅 */
  chartReport,
  /** 盾牌 + 锁：无权限、安全、鉴权类页面 */
  lockShield,
  /** 报障服务器：服务异常、错误页 */
  serverError,
  /** 空纸箱：空状态、没有数据 */
  emptyBox,
} as const

export type BannerImageKey = keyof typeof BANNER_IMAGES

/** 按 key 取插画地址（用于配置驱动的场景） */
export function bannerImage(key: BannerImageKey): string {
  return BANNER_IMAGES[key]
}
