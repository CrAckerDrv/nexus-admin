import { describe, expect, it } from 'vitest'
import {
  autoPortSides,
  cameraEquals,
  centerOn,
  fitView,
  MAX_ZOOM,
  MIN_ZOOM,
  portPoint,
  prevZoomStep,
  nextZoomStep,
  rectFromPoints,
  rectIntersects,
  rectUnion,
  screenToWorld,
  sideVector,
  snapRect,
  snapToGrid,
  viewportRect,
  worldToScreen,
  zoomAt,
} from '../canvas/math'
import { edgeGeometry, offsetPort } from '../canvas/edges'
import { SpatialIndex } from '../canvas/spatial'
import { createHistory } from '../canvas/history'

/**
 * 画布内核单测
 *
 * 这些纯函数是画布正确性的地基：坐标换算错一点，缩放就会漂；
 * 吸附差一像素，拖拽手感就废。所以宁可细一点，也不靠肉眼验收。
 */

describe('相机与坐标换算', () => {
  const camera = { x: 120, y: -40, zoom: 2 }

  it('世界 ↔ 屏幕互为逆运算', () => {
    const screen = worldToScreen({ x: 30, y: 12 }, camera)
    expect(screen).toEqual({ x: 180, y: -16 })
    expect(screenToWorld(screen, camera)).toEqual({ x: 30, y: 12 })
  })

  it('zoomAt 让锚点下的世界坐标保持不变', () => {
    const anchor = { x: 400, y: 260 }
    const before = screenToWorld(anchor, camera)
    const next = zoomAt(camera, anchor, 3.5)
    const after = screenToWorld(anchor, next)
    expect(after.x).toBeCloseTo(before.x, 6)
    expect(after.y).toBeCloseTo(before.y, 6)
    expect(next.zoom).toBe(3.5)
  })

  it('缩放夹在 [MIN, MAX] 之间', () => {
    expect(zoomAt(camera, { x: 0, y: 0 }, 999).zoom).toBe(MAX_ZOOM)
    expect(zoomAt(camera, { x: 0, y: 0 }, 0.0001).zoom).toBe(MIN_ZOOM)
  })

  it('放大/缩小按档位跳，且不会越界', () => {
    expect(nextZoomStep(1)).toBeGreaterThan(1)
    expect(prevZoomStep(1)).toBeLessThan(1)
    expect(nextZoomStep(MAX_ZOOM)).toBe(MAX_ZOOM)
    expect(prevZoomStep(MIN_ZOOM)).toBe(MIN_ZOOM)
  })

  it('cameraEquals 容忍浮点误差', () => {
    expect(cameraEquals({ x: 1, y: 2, zoom: 1 }, { x: 1.0000001, y: 2, zoom: 1 })).toBe(true)
    expect(cameraEquals({ x: 1, y: 2, zoom: 1 }, { x: 1.5, y: 2, zoom: 1 })).toBe(false)
  })
})

describe('矩形与视口', () => {
  it('两点构造矩形自动归一', () => {
    expect(rectFromPoints({ x: 100, y: 60 }, { x: 20, y: 10 })).toEqual({
      x: 20,
      y: 10,
      width: 80,
      height: 50,
    })
  })

  it('反推出可见世界区域', () => {
    const rect = viewportRect({ width: 800, height: 600 }, { x: -100, y: -50, zoom: 2 })
    expect(rect).toEqual({ x: 50, y: 25, width: 400, height: 300 })
  })

  it('fitView 让内容居中且不超出容器', () => {
    const camera = fitView({ x: 0, y: 0, width: 1000, height: 500 }, { width: 800, height: 600 }, { padding: 0 })
    // 受限的是宽度：800 / 1000 = 0.8
    expect(camera.zoom).toBeCloseTo(0.8, 6)
    // 内容中心落在视口中心
    const center = worldToScreen({ x: 500, y: 250 }, camera)
    expect(center.x).toBeCloseTo(400, 6)
    expect(center.y).toBeCloseTo(300, 6)
  })

  it('fitView 对未测量的容器返回安全值', () => {
    expect(fitView({ x: 0, y: 0, width: 100, height: 100 }, { width: 0, height: 0 })).toEqual({
      x: 0,
      y: 0,
      zoom: 1,
    })
  })

  it('centerOn 把世界点放到视口中心', () => {
    const camera = centerOn({ x: 500, y: 300 }, { width: 1000, height: 600 }, 2)
    const screen = worldToScreen({ x: 500, y: 300 }, camera)
    expect(screen.x).toBeCloseTo(500, 6)
    expect(screen.y).toBeCloseTo(300, 6)
  })

  it('相交与并集', () => {
    const a = { x: 0, y: 0, width: 100, height: 100 }
    expect(rectIntersects(a, { x: 50, y: 50, width: 100, height: 100 })).toBe(true)
    expect(rectIntersects(a, { x: 200, y: 0, width: 10, height: 10 })).toBe(false)
    expect(rectUnion(a, { x: 50, y: 50, width: 100, height: 100 })).toEqual({
      x: 0,
      y: 0,
      width: 150,
      height: 150,
    })
  })
})

describe('端口与自动锚点', () => {
  const source = { x: 0, y: 0, width: 200, height: 100 }

  it('四边中点位置正确', () => {
    expect(portPoint(source, 'left')).toEqual({ x: 0, y: 50 })
    expect(portPoint(source, 'right')).toEqual({ x: 200, y: 50 })
    expect(portPoint(source, 'top')).toEqual({ x: 100, y: 0 })
    expect(portPoint(source, 'bottom')).toEqual({ x: 100, y: 100 })
  })

  it('右侧的节点走左右连，下方的节点走上下连', () => {
    expect(autoPortSides(source, { x: 400, y: 0, width: 200, height: 100 })).toEqual(['right', 'left'])
    expect(autoPortSides(source, { x: -400, y: 0, width: 200, height: 100 })).toEqual(['left', 'right'])
    expect(autoPortSides(source, { x: 0, y: 300, width: 200, height: 100 })).toEqual(['bottom', 'top'])
    expect(autoPortSides(source, { x: 0, y: -300, width: 200, height: 100 })).toEqual(['top', 'bottom'])
  })

  it('法向量与方位一致', () => {
    expect(sideVector('right')).toEqual({ x: 1, y: 0 })
    expect(sideVector('top')).toEqual({ x: 0, y: -1 })
  })
})

describe('吸附', () => {
  const others = [{ x: 0, y: 0, width: 100, height: 100 }]

  it('靠近左边缘时对齐并给出参考线', () => {
    const result = snapRect({ x: 5, y: 300, width: 50, height: 50 }, others, { threshold: 8 })
    expect(result.dx).toBeCloseTo(-5, 6)
    expect(result.guides.some((guide) => guide.axis === 'x')).toBe(true)
  })

  it('超出阈值不吸附', () => {
    const result = snapRect({ x: 40, y: 300, width: 50, height: 50 }, others, { threshold: 8 })
    expect(result.dx).toBe(0)
    expect(result.guides.length).toBe(0)
  })

  it('没有对齐参考线时退化为网格吸附', () => {
    const result = snapRect({ x: 43, y: 297, width: 50, height: 50 }, [], { grid: 10, threshold: 8 })
    expect(result.dx).toBeCloseTo(-3, 6)
    expect(result.dy).toBeCloseTo(3, 6)
    expect(snapToGrid(43, 10)).toBe(40)
  })
})

describe('连线几何', () => {
  const source = { x: 0, y: 0, width: 200, height: 100 }
  const target = { x: 400, y: 0, width: 200, height: 100 }

  it('贝塞尔路径从右边中点出发、到左边中点结束', () => {
    const geometry = edgeGeometry({ source, target, sourceSide: 'right', targetSide: 'left' })
    expect(geometry.path.startsWith('M 200 50')).toBe(true)
    expect(geometry.path.endsWith('400 50')).toBe(true)
    expect(geometry.start).toEqual({ x: 200, y: 50 })
    expect(geometry.end).toEqual({ x: 400, y: 50 })
    // 中点落在两节点之间
    expect(geometry.mid.x).toBeGreaterThan(200)
    expect(geometry.mid.x).toBeLessThan(400)
  })

  it('正交折线含圆角(Q)且只有水平/垂直线段', () => {
    const geometry = edgeGeometry({ source, target, sourceSide: 'right', targetSide: 'left', shape: 'orthogonal' })
    expect(geometry.path).toContain('Q')
    expect(geometry.path).toContain('L')
  })

  it('直线形态末端角度指向目标', () => {
    const geometry = edgeGeometry({ source, target, sourceSide: 'right', targetSide: 'left', shape: 'straight' })
    expect(geometry.endAngle).toBeCloseTo(0, 6)
  })

  it('没有目标节点时使用挂起落点', () => {
    const geometry = edgeGeometry({
      source,
      sourceSide: 'right',
      targetSide: 'left',
      targetPoint: { x: 600, y: 100 },
    })
    expect(geometry.end).toEqual({ x: 600, y: 100 })
  })

  it('同侧多端口按索引错位', () => {
    expect(offsetPort({ x: 0, y: 50 }, 'right', 0, 3, 10)).toEqual({ x: 0, y: 40 })
    expect(offsetPort({ x: 0, y: 50 }, 'right', 2, 3, 10)).toEqual({ x: 0, y: 60 })
    expect(offsetPort({ x: 50, y: 0 }, 'top', 0, 3, 10)).toEqual({ x: 40, y: 0 })
    // 单条边不偏移
    expect(offsetPort({ x: 0, y: 50 }, 'right', 0, 1)).toEqual({ x: 0, y: 50 })
  })
})

describe('空间索引', () => {
  it('插入后可按区域与点查询', () => {
    const index = new SpatialIndex(100)
    index.set('a', { x: 0, y: 0, width: 50, height: 50 })
    index.set('b', { x: 500, y: 500, width: 50, height: 50 })

    expect(index.query({ x: 0, y: 0, width: 100, height: 100 })).toEqual(['a'])
    expect(index.query({ x: 0, y: 0, width: 600, height: 600 }).sort()).toEqual(['a', 'b'])
    expect(index.queryPoint(10, 10)).toBe('a')
    expect(index.queryPoint(1000, 1000)).toBeNull()
  })

  it('移动节点后旧格子不再命中', () => {
    const index = new SpatialIndex(100)
    index.set('a', { x: 0, y: 0, width: 50, height: 50 })
    index.set('a', { x: 900, y: 900, width: 50, height: 50 })
    expect(index.query({ x: 0, y: 0, width: 100, height: 100 })).toEqual([])
    expect(index.query({ x: 850, y: 850, width: 100, height: 100 })).toEqual(['a'])
  })

  it('删除后不再返回', () => {
    const index = new SpatialIndex()
    index.set('a', { x: 0, y: 0, width: 10, height: 10 })
    index.delete('a')
    expect(index.size()).toBe(0)
    expect(index.query({ x: 0, y: 0, width: 100, height: 100 })).toEqual([])
  })

  it('跨多格的节点只返回一次', () => {
    const index = new SpatialIndex(100)
    index.set('wide', { x: 0, y: 0, width: 500, height: 500 })
    const hits = index.query({ x: 0, y: 0, width: 500, height: 500 })
    expect(hits).toEqual(['wide'])
  })

  it('sync 会移除已经不存在的节点', () => {
    const index = new SpatialIndex()
    index.sync([
      { id: 'a', x: 0, y: 0, width: 10, height: 10 },
      { id: 'b', x: 20, y: 20, width: 10, height: 10 },
    ])
    index.sync([{ id: 'a', x: 0, y: 0, width: 10, height: 10 }])
    expect(index.size()).toBe(1)
  })

  it('contain 模式只返回完全包含的节点', () => {
    const index = new SpatialIndex(100)
    index.set('inside', { x: 10, y: 10, width: 20, height: 20 })
    index.set('crossing', { x: 90, y: 90, width: 100, height: 100 })
    const hits = index.query({ x: 0, y: 0, width: 100, height: 100 }, 'contain')
    expect(hits).toEqual(['inside'])
  })
})

describe('撤销栈', () => {
  it('撤销与重做在快照间移动', () => {
    const history = createHistory({ value: 0 })
    history.push({ value: 1 }, '加一')
    history.push({ value: 2 }, '加二')
    expect(history.canUndo()).toBe(true)

    expect(history.undo()?.snapshot).toEqual({ value: 1 })
    expect(history.undo()?.snapshot).toEqual({ value: 0 })
    expect(history.canUndo()).toBe(false)
    expect(history.redo()?.snapshot).toEqual({ value: 1 })
  })

  it('同一 mergeKey 在窗口内合并为一步', () => {
    const history = createHistory({ value: 0 }, { mergeWindow: 10_000 })
    history.push({ value: 1 }, '拖动', 'drag-node-a')
    history.push({ value: 2 }, '拖动', 'drag-node-a')
    history.push({ value: 3 }, '拖动', 'drag-node-a')
    expect(history.depth().undo).toBe(1)
    expect(history.undo()?.snapshot).toEqual({ value: 0 })
  })

  it('新的操作会丢弃 redo 分支', () => {
    const history = createHistory(0)
    history.push(1, 'a')
    history.push(2, 'b')
    history.undo()
    history.push(9, 'c')
    expect(history.canRedo()).toBe(false)
    expect(history.undo()?.snapshot).toBe(1)
  })

  it('超过上限时丢弃最早的记录', () => {
    const history = createHistory(0, { limit: 3 })
    for (let index = 1; index <= 10; index += 1) history.push(index, `step-${index}`)
    expect(history.depth().undo).toBe(2)
  })

  it('reset 清空历史并保留当前快照', () => {
    const history = createHistory(0)
    history.push(1, 'a')
    history.reset(42)
    expect(history.canUndo()).toBe(false)
    expect(history.canRedo()).toBe(false)
  })
})
