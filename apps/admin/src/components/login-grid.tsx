import { useEffect, useRef } from 'react'

/**
 * 登录页左侧的「流动方块」画布（OpenAI 首页那种可玩的点阵）
 *
 * 观感由四层叠加而成：
 *   1. 全场流动   每个方块都沿两条正弦波缓慢起伏 —— 整片网格像一块被风推着走的绸布
 *   2. 明暗流动   同一组波还调制填充亮度，暗处的方块几乎消失、亮处的方块像被灯扫过
 *   3. 指针聚光   鼠标附近成片点亮、放大并朝指针方向被「吸」过去（带阻尼跟随，
 *                不是硬跟手，所以移动时会拖出一小段余韵）
 *   4. 点击涟漪   按下时从指针处扩散一圈环带，方块依次亮起再回落
 *
 * 为什么用 canvas 而不是 DOM：
 * - 左半区同屏 500+ 方块，DOM 方案每次 hover 都要改几百个节点的内联样式，
 *   主线程会被拖住；canvas 每帧只画一遍，也不会产生合成层爆炸。
 * - 图元只有「圆角矩形填充 + 描边」，2D context 足够，不需要 WebGL。
 *
 * 约定：
 * - 颜色只读设计令牌 `--n-primary`，换皮肤 / 强调色 / 深浅色自动跟随；
 *   主题切换时监听 `nexus:theme-change` 重新取色。
 * - 尺寸走「设计像素 → rem 换算」：与组件里其它数字尺寸同一套单位，改基准只需动 sx()。
 * - 指针坐标只存 ref，不触发 React 渲染。
 * - 「减少动效」时冻结时间轴，只画静态一帧；指针与点击仍然响应。
 * - DPR 上限 2，避免高分屏上画几百万像素。
 */

/** 方块边长 / 间距 / 指针影响半径（设计像素，1440 视口下即 CSS px） */
const TILE_DESIGN = 14
const GAP_DESIGN = 18
const RADIUS_DESIGN = 180
/** 涟漪寿命（ms） */
const RIPPLE_MS = 1200
/** 指针阻尼：越小越「拖」，越大越跟手 */
const POINTER_EASE = 0.14

interface Pointer {
  /** 画布坐标（CSS px） */
  x: number
  y: number
  /** 阻尼跟随后的实际位置：绘制用这个，才有余韵 */
  smoothX: number
  smoothY: number
  /** 指针是否还在画布邻近区域（离开后高光淡出，而不是突然消失） */
  inside: boolean
  /** 高光强度（0~1），用阻尼淡入淡出 */
  strength: number
}

interface Ripple {
  x: number
  y: number
  /** 起点（performance.now） */
  start: number
}

/** `#rgb` / `#rrggbb` → [r,g,b]；解析不出来就退回品牌蓝 */
function parseHex(input: string): [number, number, number] {
  const raw = input.trim().replace('#', '')
  const hex =
    raw.length === 3
      ? raw
          .split('')
          .map((char) => char + char)
          .join('')
      : raw
  if (!/^[0-9a-f]{6}$/i.test(hex)) return [76, 141, 255]
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ]
}

/** 动效偏好：应用内开关优先于系统 */
function motionAllowed(): boolean {
  const override = document.documentElement.dataset.motion
  if (override === 'reduced') return false
  if (override === 'full') return true
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export interface LoginGridProps {
  className?: string
}

/**
 * 画布本体
 *
 * 自行监听 resize / 主题变化 / 指针事件，卸载时全部回收；
 * 父组件只负责把它摆进装饰层（`aria-hidden` + `pointer-events-none`）。
 */
export function LoginGrid({ className }: LoginGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) return

    /** 逻辑尺寸（CSS px）与设计像素倍率 */
    let width = 0
    let height = 0
    let scale = 1
    let color: [number, number, number] = parseHex(
      getComputedStyle(document.documentElement).getPropertyValue('--n-primary'),
    )
    /**
     * 主题系数：浅色下同样的透明度看起来比深色重得多（白底上的蓝方块更扎眼），
     * 所以浅色整体压到六成，靠同一个系数乘到填充与描边上，不另写一套配色。
     */
    let tint = 1

    const pointer: Pointer = {
      x: -9999,
      y: -9999,
      smoothX: -9999,
      smoothY: -9999,
      inside: false,
      strength: 0,
    }
    const ripples: Ripple[] = []
    /** 时间轴（减少动效时不再推进，画面定格但仍可交互） */
    let clock = 0
    let lastFrame = 0
    let frame = 0
    /** 静态模式下由指针 / 主题变化置脏，触发一次重绘 */
    let dirty = true

    const measure = () => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      width = rect.width
      height = rect.height
      const rootFont = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
      scale = Number.isFinite(rootFont) && rootFont > 0 ? rootFont / 16 : 1
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      dirty = true
    }

    const repaintColor = () => {
      color = parseHex(getComputedStyle(document.documentElement).getPropertyValue('--n-primary'))
      // 深色：色块在暗底上本来就弱，保持满亮；浅色：白底会让方块显脏，压到六成
      tint = document.documentElement.classList.contains('dark') ? 1 : 0.62
      dirty = true
    }

    /**
     * 画一帧
     *
     * 每个方块的位置与亮度都由同一组「波」推导：
     *   位移 = 全场起伏 + 指针吸附
     *   亮度 = 光带扫过 + 指针高光 + 涟漪环带
     * 这样整片网格是同一个整体在动，而不是各自为政地闪。
     *
     * @param waveTime 波的时间轴：减少动效时冻结，画面定格
     * @param realTime rAF 时间戳：涟漪用真实时间，保证交互始终有反馈
     */
    const draw = (waveTime: number, realTime: number) => {
      context.clearRect(0, 0, width, height)
      if (width === 0 || height === 0) return

      const [r, g, b] = color
      const tile = TILE_DESIGN * scale
      const pitch = (TILE_DESIGN + GAP_DESIGN) * scale
      const radius = RADIUS_DESIGN * scale
      const cols = Math.ceil(width / pitch) + 1
      const rows = Math.ceil(height / pitch) + 1
      /** 以秒为单位：波形速度按「每秒多少弧度」写，读起来才知道快慢 */
      const ts = waveTime / 1000
      const glow = pointer.strength

      const liveRipples = ripples
        .map((ripple) => {
          const age = (realTime - ripple.start) / RIPPLE_MS
          return age >= 0 && age <= 1 ? { ripple, age } : null
        })
        .filter((item): item is { ripple: Ripple; age: number } => item !== null)

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const baseX = col * pitch + tile / 2
          const baseY = row * pitch + tile / 2
          // 归一到「设计像素」再算波：不同缩放比例下波纹尺度保持一致
          const dx = baseX / scale
          const dy = baseY / scale

          // ---- 1) 全场流动：两条正交的正弦，网格像被风推着整体起伏 ----
          const flowX = Math.sin(dy * 0.011 + ts * 0.75) * 1.6 * scale
          const flowY = Math.cos(dx * 0.012 - ts * 0.62) * 1.6 * scale

          // ---- 2) 明暗流动：一条斜向行进的光带 ----
          // 空间频率必须远低于 1 格，否则相邻方块亮度乱跳，看起来像噪点而不是波；
          // 再取高次幂收窄亮区，画面里就只剩「一道光」而不是「半屏都在亮」。
          const band = Math.sin((dx + dy) * 0.0062 - ts * 0.5)
          const level = Math.max(0, band) ** 5

          let cx = baseX + flowX
          let cy = baseY + flowY

          // ---- 3) 指针：阻尼位置 + 平方软化的径向衰减 ----
          let boost = 0
          if (glow > 0.001) {
            const distance = Math.hypot(cx - pointer.smoothX, cy - pointer.smoothY)
            if (distance < radius) {
              const falloff = 1 - distance / radius
              boost = falloff * falloff * glow
            }
          }

          // ---- 4) 涟漪：一圈从按下点向外扩散的环带 ----
          for (const { ripple, age } of liveRipples) {
            const distance = Math.hypot(cx - ripple.x, cy - ripple.y)
            const ring = easeOutCubic(age) * radius * 1.2
            const spread = 52 * scale
            const delta = Math.abs(distance - ring)
            if (delta < spread) {
              boost = Math.max(boost, (1 - delta / spread) * (1 - age))
            }
          }

          const lit = Math.min(boost, 1)

          // 高光范围内的方块朝指针被「吸」过去，越近吸得越多（上限 7px）
          if (lit > 0.001) {
            const pull = lit * 7 * scale
            cx += ((pointer.smoothX - cx) / radius) * pull
            cy += ((pointer.smoothY - cy) / radius) * pull
          }

          const size = tile * (1 + lit * 0.34)
          const half = size / 2

          /**
           * 亮度分档（关键在「静止时几乎看不见」）：
           * - 静止  描边只有 0.02，几乎与底色同化 —— 不亮时就是一块空地
           * - 光带  缓慢扫过时明显抬亮，才是「流动」
           * - 点亮  指针 / 涟漪把填充做实、方块放大，反馈最强烈
           * 再统一乘 `tint`：浅色主题下同样透明度会更重，需要整体压暗一档。
           */
          const fillAlpha = Math.min(level * 0.26 + lit * 0.78, 0.92) * tint
          const strokeAlpha = Math.min(0.018 + level * 0.34 + lit * 0.72, 0.96) * tint
          const corner = (2.5 + lit * 2) * scale

          context.fillStyle = `rgba(${r}, ${g}, ${b}, ${fillAlpha.toFixed(3)})`
          context.strokeStyle = `rgba(${r}, ${g}, ${b}, ${strokeAlpha.toFixed(3)})`
          context.lineWidth = lit > 0.4 ? 1.25 : 1
          context.beginPath()
          context.roundRect(cx - half, cy - half, size, size, corner)
          context.fill()
          context.stroke()
        }
      }
    }

    const loop = (now: number) => {
      const delta = lastFrame === 0 ? 16 : Math.min(now - lastFrame, 48)
      lastFrame = now

      // 阻尼跟随：静止模式下也推进，指针移动后画面才会「追上来」
      const targetStrength = pointer.inside ? 1 : 0
      pointer.strength += (targetStrength - pointer.strength) * Math.min(delta / 16, 2) * 0.12
      if (pointer.inside) {
        if (pointer.smoothX < -1000) {
          // 首次进入：直接对齐，避免从左上角飞过来
          pointer.smoothX = pointer.x
          pointer.smoothY = pointer.y
        } else {
          const ease = Math.min(Math.max(delta / 16, 0.5), 2) * POINTER_EASE
          pointer.smoothX += (pointer.x - pointer.smoothX) * ease
          pointer.smoothY += (pointer.y - pointer.smoothY) * ease
        }
      }

      if (motionAllowed()) {
        clock += delta
        draw(clock, now)
      } else if (dirty || pointer.strength > 0.001 || ripples.length > 0) {
        // 冻结波形，但指针高光与涟漪仍然动 —— 交互永远是即时的
        draw(clock, now)
        dirty = false
        if (ripples.length > 0) {
          ripples.splice(
            0,
            ripples.length,
            ...ripples.filter((ripple) => now - ripple.start < RIPPLE_MS),
          )
        }
      }
      frame = requestAnimationFrame(loop)
    }

    /** 窗口坐标 → 画布坐标；越界只让高光淡出，不做硬切 */
    const readPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = event.clientX - rect.left
      pointer.y = event.clientY - rect.top
      const margin = RADIUS_DESIGN * scale
      pointer.inside =
        pointer.x > -margin &&
        pointer.y > -margin &&
        pointer.x < rect.width + margin &&
        pointer.y < rect.height + margin
      dirty = true
      return rect
    }

    const onPointerMove = (event: PointerEvent) => {
      // 触屏没有 hover 语义，直接跳过（点击涟漪仍然有效）
      if (event.pointerType === 'touch') return
      readPointer(event)
    }

    const onPointerDown = (event: PointerEvent) => {
      const rect = readPointer(event)
      if (pointer.x < 0 || pointer.y < 0 || pointer.x > rect.width || pointer.y > rect.height)
        return
      ripples.push({ x: pointer.x, y: pointer.y, start: performance.now() })
      // 同时最多保留 4 圈，连点也不会掉帧
      if (ripples.length > 4) ripples.shift()
    }

    const onPointerLeave = () => {
      pointer.inside = false
      dirty = true
    }

    measure()
    // 首帧也要按当前主题定一次系数（页面直接以浅色 / 深色加载时不会触发 theme-change）
    repaintColor()
    const observer = new ResizeObserver(measure)
    observer.observe(canvas)

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    document.addEventListener('pointerleave', onPointerLeave)
    window.addEventListener('resize', measure)
    window.addEventListener('nexus:theme-change', repaintColor)

    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('resize', measure)
      window.removeEventListener('nexus:theme-change', repaintColor)
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />
}
