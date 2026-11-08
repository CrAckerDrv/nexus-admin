import type { ComponentType } from 'react'

/**
 * 组件橱窗的数据协议
 *
 * 目标：把「组件长什么样、怎么用、有哪些 API」收敛成一份可直接渲染的清单，
 * 页面只负责布局与筛选，内容全部由下面的声明式数据结构驱动。
 *
 * 约定：
 * - `demo` 必须是**无 props 的组件**（而不是现成 JSX）：需要交互的示例可以在里面写 hooks
 * - `code` 是给人看的用法示例，不是从 demo 里反推的（两者允许不同，示例可以更简洁）
 * - `props` 只列最常用的几项，完整 API 见 `packages/ui/src/components/*.tsx`
 */

export interface GalleryPropRow {
  name: string
  type: string
  default?: string
  desc: string
}

export interface GalleryItem {
  /** 唯一标识，用于锚点、搜索与 React key */
  key: string
  /** 英文名，如 Button（与导出名一致，便于搜索） */
  name: string
  /** 中文名，如 按钮 */
  nameZh: string
  /** 版本徽标（仅新近加入的组件标注） */
  version?: string
  /** 一句话说明：它解决什么问题 */
  summary: string
  /** 实时演示 */
  demo: ComponentType
  /** 用法示例 */
  code: string
  /** 主要 Props */
  props?: GalleryPropRow[]
  /** 额外的搜索关键字（拼音、别名） */
  keywords?: string[]
  /** 演示区占满整行（表格、树这类需要宽度的组件） */
  wide?: boolean
  /** 演示区最小高度，默认 140；复杂示例可调大 */
  previewHeight?: number
}

export interface GalleryCategory {
  /** 分类 id，用于锚点与筛选 */
  id: string
  /** 英文名，如 Basic */
  name: string
  /** 中文名，如 基础组件 */
  title: string
  /** 分类说明 */
  description: string
  items: GalleryItem[]
}
