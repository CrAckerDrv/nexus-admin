import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../lib/utils'
import { useChromePortal } from '../lib/scale'

export interface TooltipProps {
  content: ReactNode
  children: ReactNode
  /** 首选方向；放不下时自动翻到对面 */
  side?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  className?: string
  /** 禁用提示 */
  disabled?: boolean
  /** 包裹层是否为块级 */
  block?: boolean
}

type Side = NonNullable<TooltipProps['side']>

const GAP = 8
const EDGE = 6

/**
 * 轻提示
 *
 * 关键点（之前踩过的坑）：
 * - 顶栏按钮距离视口顶部只有几个像素，`side="top"` 的气泡会被推到屏幕外，
 *   看起来就是「提示文字看不清/只露一条边」。这里做**自动翻面 + 视口内夹取**。
 * - 用 `fixed` + 实测坐标：祖先有 `overflow:hidden` 时不会被裁切。
 * - 首次测量前先渲染到 `visibility:hidden`，避免出现「先闪到错误位置再跳」。
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  delay = 260,
  className,
  disabled,
  block,
}: TooltipProps) {
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const rootRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const [resolvedSide, setResolvedSide] = useState<Side>(side)
  // 浮层定位补偿：根字号恒 16px，外框与内容同尺度，此处恒为「无补偿」
  const chrome = useChromePortal()

  const show = () => {
    if (disabled) return
    timerRef.current = setTimeout(() => setOpen(true), delay)
  }
  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setOpen(false)
    setCoords(null)
  }

  useLayoutEffect(() => {
    const anchor = rootRef.current
    const tip = tipRef.current
    if (!open || !anchor || !tip) return

    const a = anchor.getBoundingClientRect()
    const t = tip.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    // ① 选一个放得下的方向（首选方向优先，其次对面）
    const fits: Record<Side, boolean> = {
      top: a.top - GAP - t.height >= EDGE,
      bottom: a.bottom + GAP + t.height <= vh - EDGE,
      left: a.left - GAP - t.width >= EDGE,
      right: a.right + GAP + t.width <= vw - EDGE,
    }
    const opposite: Record<Side, Side> = {
      top: 'bottom',
      bottom: 'top',
      left: 'right',
      right: 'left',
    }
    const chosen: Side = fits[side] ? side : fits[opposite[side]] ? opposite[side] : side

    // ② 按方向算坐标（此处按「锚点 + 中心」计算，再由 transform 对齐）
    const gap = GAP
    let top = a.top - gap
    let left = a.left + a.width / 2
    if (chosen === 'bottom') top = a.bottom + gap
    if (chosen === 'left' || chosen === 'right') top = a.top + a.height / 2
    if (chosen === 'left') left = a.left - gap
    if (chosen === 'right') left = a.right + gap

    // ③ 横向/纵向夹到视口内，避免贴边溢出
    const centeredX = ['top', 'bottom'].includes(chosen)
    if (centeredX) {
      left = Math.min(Math.max(left, t.width / 2 + EDGE), vw - t.width / 2 - EDGE)
    } else {
      top = Math.min(Math.max(top, t.height / 2 + EDGE), vh - t.height / 2 - EDGE)
    }

    setResolvedSide(chosen)
    setCoords({ top: chrome.offset(top), left: chrome.offset(left) })
  }, [open, side, chrome])

  useEffect(() => () => void (timerRef.current && clearTimeout(timerRef.current)), [])

  return (
    <span
      ref={rootRef}
      className={cn(block ? 'block' : 'inline-flex', 'relative')}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onPointerDown={hide}
    >
      {children}
      {open && content && (
        <span
          ref={tipRef}
          role="tooltip"
          style={{
            top: coords?.top ?? a11yOffscreen,
            left: coords?.left ?? 0,
            // 测量阶段不可见但仍参与布局
            visibility: coords ? 'visible' : 'hidden',
          }}
          className={cn(
            'pointer-events-none fixed z-[1200] max-w-[17.5rem] rounded-md bg-inverse px-2 py-1 text-2xs leading-4 text-fg-inverse shadow-md',
            resolvedSide === 'top' && '-translate-x-1/2 -translate-y-full',
            resolvedSide === 'bottom' && '-translate-x-1/2',
            resolvedSide === 'left' && '-translate-x-full -translate-y-1/2',
            resolvedSide === 'right' && '-translate-y-1/2',
            className,
          )}
        >
          {content}
        </span>
      )}
    </span>
  )
}

/** 未测量时放到视口外，避免「先闪一下再归位」 */
const a11yOffscreen = -9999
