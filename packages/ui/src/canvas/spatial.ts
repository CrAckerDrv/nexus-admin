import type { CanvasRect } from './types'

/**
 * 空间索引（均匀网格）
 *
 * 为什么不引四叉树：画布节点尺寸差异大但数量集中在百到千级，
 * 均匀网格的查询常数更小、实现更短、没有递归，插入/移动都是 O(k)（k = 覆盖格子数）。
 *
 * 关键点：
 * - 节点 id → 覆盖的所有格子 key，更新时先删旧再插新（避免脏格子）
 * - 查询去重：一个节点可能横跨多格，用 Set 保证只返回一次
 * - 剔除阈值：格子越大，多格节点越少；512 对画布类应用是合适值
 */

const DEFAULT_CELL = 512

interface Entry {
  id: string
  rect: CanvasRect
  cells: string[]
}

export class SpatialIndex {
  private readonly cell: number
  private readonly entries = new Map<string, Entry>()
  private readonly buckets = new Map<string, Set<string>>()

  constructor(cellSize: number = DEFAULT_CELL) {
    this.cell = Math.max(32, cellSize)
  }

  /** 格子坐标 → key（用整数拼接，比字符串模板更快且稳定） */
  private key(cx: number, cy: number): string {
    return `${cx}:${cy}`
  }

  private range(rect: CanvasRect): { x0: number; y0: number; x1: number; y1: number } {
    return {
      x0: Math.floor(rect.x / this.cell),
      y0: Math.floor(rect.y / this.cell),
      x1: Math.floor((rect.x + rect.width) / this.cell),
      y1: Math.floor((rect.y + rect.height) / this.cell),
    }
  }

  size(): number {
    return this.entries.size
  }

  /** 插入或更新（同一 id 覆盖写） */
  set(id: string, rect: CanvasRect): void {
    const previous = this.entries.get(id)
    if (previous) this.unlink(id, previous.cells)

    const { x0, y0, x1, y1 } = this.range(rect)
    const cells: string[] = []
    for (let cx = x0; cx <= x1; cx += 1) {
      for (let cy = y0; cy <= y1; cy += 1) {
        const key = this.key(cx, cy)
        cells.push(key)
        let bucket = this.buckets.get(key)
        if (!bucket) {
          bucket = new Set()
          this.buckets.set(key, bucket)
        }
        bucket.add(id)
      }
    }
    this.entries.set(id, { id, rect, cells })
  }

  delete(id: string): void {
    const entry = this.entries.get(id)
    if (!entry) return
    this.unlink(id, entry.cells)
    this.entries.delete(id)
  }

  private unlink(id: string, cells: string[]): void {
    for (const key of cells) {
      const bucket = this.buckets.get(key)
      if (!bucket) continue
      bucket.delete(id)
      if (bucket.size === 0) this.buckets.delete(key)
    }
  }

  has(id: string): boolean {
    return this.entries.has(id)
  }

  get(id: string): CanvasRect | undefined {
    return this.entries.get(id)?.rect
  }

  /** 区域查询：返回与 rect 相交（或包含）的 id */
  query(rect: CanvasRect, mode: 'intersect' | 'contain' = 'intersect'): string[] {
    const { x0, y0, x1, y1 } = this.range(rect)
    const hit = new Set<string>()
    for (let cx = x0; cx <= x1; cx += 1) {
      for (let cy = y0; cy <= y1; cy += 1) {
        const bucket = this.buckets.get(this.key(cx, cy))
        if (!bucket) continue
        for (const id of bucket) hit.add(id)
      }
    }
    const result: string[] = []
    for (const id of hit) {
      const entry = this.entries.get(id)
      if (!entry) continue
      const inside =
        mode === 'contain'
          ? entry.rect.x >= rect.x &&
            entry.rect.y >= rect.y &&
            entry.rect.x + entry.rect.width <= rect.x + rect.width &&
            entry.rect.y + entry.rect.height <= rect.y + rect.height
          : entry.rect.x < rect.x + rect.width &&
            entry.rect.x + entry.rect.width > rect.x &&
            entry.rect.y < rect.y + rect.height &&
            entry.rect.y + entry.rect.height > rect.y
      if (inside) result.push(id)
    }
    return result
  }

  /** 点查询（连线落点判定 / 命中测试） */
  queryPoint(x: number, y: number): string | null {
    const bucket = this.buckets.get(this.key(Math.floor(x / this.cell), Math.floor(y / this.cell)))
    if (!bucket) return null
    for (const id of bucket) {
      const entry = this.entries.get(id)
      if (!entry) continue
      const { rect } = entry
      if (
        x >= rect.x &&
        x <= rect.x + rect.width &&
        y >= rect.y &&
        y <= rect.y + rect.height
      ) {
        return id
      }
    }
    return null
  }

  /** 全量重建（文档整体替换时比逐个 diff 更快） */
  rebuild(nodes: Array<{ id: string; x: number; y: number; width: number; height: number }>): void {
    this.entries.clear()
    this.buckets.clear()
    for (const node of nodes) {
      this.set(node.id, { x: node.x, y: node.y, width: node.width, height: node.height })
    }
  }

  /** 同步：只做增量（新增/移动/删除），避免节点多的场景整表重建 */
  sync(
    nodes: Array<{ id: string; x: number; y: number; width: number; height: number }>,
  ): void {
    const seen = new Set<string>()
    for (const node of nodes) {
      seen.add(node.id)
      this.set(node.id, { x: node.x, y: node.y, width: node.width, height: node.height })
    }
    for (const id of this.entries.keys()) {
      if (!seen.has(id)) this.delete(id)
    }
  }

  clear(): void {
    this.entries.clear()
    this.buckets.clear()
  }
}
