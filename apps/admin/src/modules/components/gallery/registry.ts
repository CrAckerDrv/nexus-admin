import { bannerCategory } from './banner'
import { basicCategory } from './basic'
import { canvasCategory } from './canvas'
import { chartsCategory } from './charts'
import { dataCategory } from './data'
import { feedbackCategory } from './feedback'
import { formCategory } from './form'
import { layoutCategory, navigationCategory, premiumCategory, toolCategory } from './more'
import { mediaCategory } from './media'
import { motionCategory } from './motion'
import { runtimeCategory } from './runtime'
import type { GalleryCategory, GalleryItem } from './types'

/**
 * 组件橱窗清单：分类顺序即左侧导航顺序
 *
 * 与 Element Plus 官方的区别：这里每个条目**都是活的**——
 * 上面是真实渲染的组件，下面是可直接复制的用法与 Props 表。
 *
 * 顺序按「用得到的概率」排：
 * 基础 → 表单 → 数据 → 图表 → 资源 → 反馈 → 横幅 → 导航 → 布局 → 画布 → Hooks → 工具 → 动效 → 高级视觉。
 *
 * - 图表紧跟数据：它和表格一样，属于「把后端数据变成可读信息」的一步
 * - 资源（Media）紧跟图表：图片 / 视频 / 音频的显示与编辑，同为「内容呈现」层，
 *   且是资源型后台（素材库、剪辑台、内容中心）最先要用到的一组
 * - 横幅紧跟反馈：都是「页面主动说一句话」，但横幅是区块级版式，比提示条更重
 * - 画布是内容创作类页面的一等公民，但比表格/表单更专用，放在布局之后
 * - Hooks 与工具是「用组件时一定会碰到的底层」，放在画布与视觉糖之间
 * - 动效卡片紧邻「高级视觉」：两者都是手感层，先把结构件讲完再讲手感
 */
export const GALLERY_CATEGORIES: GalleryCategory[] = [
  basicCategory,
  formCategory,
  dataCategory,
  chartsCategory,
  mediaCategory,
  feedbackCategory,
  bannerCategory,
  navigationCategory,
  layoutCategory,
  canvasCategory,
  runtimeCategory,
  toolCategory,
  motionCategory,
  premiumCategory,
]

/** 全部条目（搜索与统计用） */
export const GALLERY_ITEMS: Array<GalleryItem & { categoryId: string; categoryTitle: string }> =
  GALLERY_CATEGORIES.flatMap((category) =>
    category.items.map((item) => ({
      ...item,
      categoryId: category.id,
      categoryTitle: category.title,
    })),
  )

/** 组件总数（用于页头统计与「共 N 个」徽标） */
export const GALLERY_TOTAL = GALLERY_ITEMS.length

/** 分类 → 条目数 */
export const GALLERY_COUNT_BY_CATEGORY: Record<string, number> = Object.fromEntries(
  GALLERY_CATEGORIES.map((category) => [category.id, category.items.length]),
)

export type { GalleryCategory, GalleryItem, GalleryPropRow } from './types'
