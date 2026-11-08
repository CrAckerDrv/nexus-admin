import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { cn, clamp } from '../../lib/utils'
import { Badge, type Tone } from '../badge'
import { MEDIA_KIND_META, clampRatio, formatDuration, seedWaveform, type MediaKind } from './types'

/* ------------------------------------------------------------------ *
 * 资源显示类型
 *
 * 三个预览器共享同一套「外壳语言」：
 * - 固定比例的画布（ratio），缩放时不变形；
 * - 左上角类型角标、右下角元信息，压在画面上的半透明胶囊；
 * - 加载中用 n-skeleton 流光，失败时给一句人话而不是碎图图标。
 *
 * 之所以不用 <img> 直接铺满：
 * 资源列表里图片高矮不一，卡片会参差不齐；
 * 固定比例 + object-cover 才能让一屏卡片对齐基线。
 * ------------------------------------------------------------------ */

/** 资源类型角标：IMAGE / VIDEO / AUDIO */
export function MediaKindBadge({
  kind,
  size = 'sm',
  className,
}: {
  kind: MediaKind
  size?: 'sm' | 'md'
  className?: string
}) {
  const meta = MEDIA_KIND_META[kind]
  return (
    <Badge
      tone={meta.tone}
      variant="outline"
      size={size}
      className={cn('bg-surface/85 font-mono tracking-wide backdrop-blur-sm', className)}
    >
      {meta.en}
    </Badge>
  )
}

/** 画面上的半透明胶囊（时长、比例、状态） */
function GlassPill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[0.625rem] leading-4 text-white/90 backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** 把 ratio 字符串转成 CSS aspect-ratio；非法值退回 16/9 */
function ratioValue(ratio: string | undefined): string {
  if (!ratio) return '16 / 9'
  const match = ratio.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/)
  if (!match) return '16 / 9'
  return `${match[1]} / ${match[2]}`
}

/* ------------------------------ 图片 ------------------------------ */

export interface ImagePreviewProps {
  src?: string
  alt: string
  /** 画面比例，如 '16:9' / '4:3' / '1:1' */
  ratio?: string
  /** 角标里显示的尺寸说明，如 '1536 × 1024' */
  sizeLabel?: string
  /** 图片裁切方式 */
  fit?: 'cover' | 'contain'
  /** 覆盖在画面上的角标与元信息（默认显示类型角标） */
  overlay?: ReactNode
  tone?: Tone
  /** 选中态：外圈描边 */
  selected?: boolean
  className?: string
}

/**
 * 图片预览
 *
 * @example
 * <ImagePreview src={cover} alt="登录页改版稿" ratio="16:9" sizeLabel="1536 × 1024" />
 */
export function ImagePreview({
  src,
  alt,
  ratio,
  sizeLabel,
  fit = 'cover',
  overlay,
  tone = 'primary',
  selected,
  className,
}: ImagePreviewProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-line bg-surface-2',
        selected && 'border-primary/60 ring-2 ring-primary-ring',
        className,
      )}
      style={{ aspectRatio: ratioValue(ratio) }}
    >
      {status === 'loading' && <div className="n-skeleton absolute inset-0" aria-hidden="true" />}

      {status !== 'failed' && src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setStatus('ready')}
          onError={() => setStatus('failed')}
          className={cn(
            'size-full transition-opacity duration-300',
            fit === 'cover' ? 'object-cover' : 'object-contain',
            status === 'ready' ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : null}

      {status === 'failed' && (
        <div className="absolute inset-0 grid place-items-center px-3 text-center">
          <p className="text-2xs text-fg-3">图片加载失败 · {alt}</p>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-1.5 top-1.5 flex items-start justify-between gap-1">
        {overlay ?? <MediaKindBadge kind="image" />}
      </div>

      {sizeLabel && (
        <span className="pointer-events-none absolute bottom-1.5 left-1.5">
          <GlassPill className="tabular-nums">{sizeLabel}</GlassPill>
        </span>
      )}

      {/* 色调描边：让「同一张图、不同用途」在列表里可区分，不额外占位 */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 opacity-70"
        style={{ background: `var(--n-${tone})` }}
      />
    </div>
  )
}

/* ------------------------------ 视频 ------------------------------ */

export interface VideoPreviewProps {
  /** 封面（没有真实视频时以封面 + 状态表达） */
  poster?: string
  /** 真实视频地址；提供后可点击播放 */
  src?: string
  title: string
  /** 时长（秒） */
  duration?: number
  /** 分镜说明，压缩成一行显示 */
  shots?: string[]
  ratio?: string
  tone?: Tone
  /**
   * 是否渲染自带播放按钮（默认 true）
   *
   * 放进 `MediaCard` 这类「整卡可点」的容器时必须传 false：
   * 卡片根节点是 role="button"，再嵌一个真 `<button>` 会触发
   * 「button cannot contain a nested button」的 HTML 校验错误，
   * 交互也会互相抢事件。此时改成静态播放图标。
   */
  interactive?: boolean
  /** 播放状态变化（外部工具栏联动用） */
  onPlayStateChange?: (playing: boolean) => void
  className?: string
}

/** 稳健的播放调用：jsdom / 自动播放策略都会抛，静默忽略即可 */
function safePlay(element: HTMLMediaElement | null) {
  if (!element) return
  try {
    const result = element.play() as Promise<void> | undefined
    void result?.catch(() => undefined)
  } catch {
    /* 环境不支持播放，保留 UI 状态即可 */
  }
}

/**
 * 视频预览
 *
 * 没有真实视频时显示封面 + 「静帧预览」，**不假装在播**：
 * 早期的假播放条会让人误以为解码成功，排查时反而更费时。
 */
export function VideoPreview({
  poster,
  src,
  title,
  duration = 0,
  shots = [],
  ratio = '16:9',
  tone = 'info',
  interactive = true,
  onPlayStateChange,
  className,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0) // 0~1
  const [broken, setBroken] = useState(false)

  /** 单一入口改播放态：内部 state 与外部回调永远一致 */
  const commitPlaying = (next: boolean) => {
    setPlaying(next)
    onPlayStateChange?.(next)
  }

  const toggle = () => {
    const element = videoRef.current
    if (!src || !element) {
      // 无真实视频：只切换状态标记，进度条不推进
      commitPlaying(!playing)
      return
    }
    if (playing) {
      element.pause()
      commitPlaying(false)
    } else {
      safePlay(element)
      commitPlaying(true)
    }
  }

  const canPlay = Boolean(src) && !broken

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-line bg-black/85',
        className,
      )}
      style={{ aspectRatio: ratioValue(ratio) }}
    >
      {poster && (
        <img
          src={poster}
          alt={title}
          loading="lazy"
          draggable={false}
          className="absolute inset-0 size-full object-cover"
        />
      )}

      {canPlay && (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          playsInline
          preload="metadata"
          aria-label={title}
          onError={() => setBroken(true)}
          onTimeUpdate={(event) => {
            const el = event.currentTarget
            const total = el.duration || duration
            if (!total) return
            setProgress(clampRatio(el.currentTime / total))
          }}
          onEnded={() => {
            commitPlaying(false)
            setProgress(0)
          }}
          className="absolute inset-0 size-full object-cover"
        />
      )}

      <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/60 via-transparent to-black/25 p-2">
        <div className="flex items-center gap-1.5">
          <MediaKindBadge kind="video" />
          <GlassPill className="tabular-nums">{formatDuration(duration)}</GlassPill>
          <GlassPill>
            <span className={cn('size-1.5 rounded-full', playing ? 'bg-success' : 'bg-white/60')} />
            {playing ? '播放中' : canPlay ? '就绪' : '静帧预览'}
          </GlassPill>
        </div>

        <div className="flex items-end justify-between gap-2">
          <p className="line-clamp-2 flex-1 text-[0.6875rem] leading-4 text-white/85">
            {shots.length > 0 ? shots.join(' · ') : title}
          </p>
          {interactive ? (
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? '暂停预览' : '播放预览'}
              aria-pressed={playing}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-white/92 text-black shadow-sm transition-transform duration-150 hover:scale-105 active:scale-95"
            >
              {playing ? (
                <svg viewBox="0 0 24 24" className="size-3" aria-hidden="true">
                  <rect x="7" y="5.5" width="3.6" height="13" rx="1" fill="currentColor" />
                  <rect x="13.4" y="5.5" width="3.6" height="13" rx="1" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="ml-0.5 size-3" aria-hidden="true">
                  <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" />
                </svg>
              )}
            </button>
          ) : (
            // 外层已是可点击容器：只画一个静态播放标识，避免嵌套 button
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-white/92 text-black shadow-sm"
            >
              <svg viewBox="0 0 24 24" className="ml-0.5 size-3">
                <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" />
              </svg>
            </span>
          )}
        </div>
      </div>

      {/* 进度条：只有真实播放才推进（onTimeUpdate 驱动） */}
      <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white/20" aria-hidden="true">
        <span
          className="block h-full bg-[var(--n-chart-6)] transition-[width] duration-150 ease-linear"
          style={{ width: `${(playing ? progress : 0) * 100}%` }}
        />
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-0.5 opacity-0"
        style={{ background: `var(--n-${tone})` }}
      />
    </div>
  )
}

/* ------------------------------ 音频 ------------------------------ */

export interface AudioPreviewProps {
  src?: string
  title: string
  /** 副标题：作者 / 场景 */
  subtitle?: string
  /** 时长（秒） */
  duration?: number
  /** 波形种子，缺省用 src + title，保证同一资源形状稳定 */
  seed?: string
  tone?: Tone
  /** 进度回调（0~1），外部时间码 / 字幕联动用 */
  onProgress?: (ratio: number) => void
  className?: string
  /** 波形柱数量 */
  bars?: number
}

/**
 * 音频预览
 *
 * 波形不是 FFT 出来的：按种子生成确定性包络即可。
 * 真要分析音频得读 ArrayBuffer 并做时频变换 —— 演示里得不偿失，
 * 而且列表里 40 根柱子本来就分辨不出真实频谱。
 *
 * 点击波形任意位置 = 跳转试听（有 src 时真的 seek）。
 */
export function AudioPreview({
  src,
  title,
  subtitle,
  duration = 0,
  seed,
  tone = 'success',
  onProgress,
  className,
  bars = 44,
}: AudioPreviewProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  /** 进度单一入口：内部 state 与外部回调同源，避免两条真值 */
  const commitProgress = (ratio: number) => {
    setProgress(clampRatio(ratio))
    onProgress?.(clampRatio(ratio))
  }

  const waveform = useMemo(
    () => seedWaveform(seed ?? `${title}:${src ?? ''}`, bars),
    [bars, seed, src, title],
  )

  const seek = (clientX: number) => {
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    if (!rect.width) return
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
    commitProgress(ratio)
    const element = audioRef.current
    if (element && Number.isFinite(element.duration)) {
      element.currentTime = ratio * element.duration
    }
  }

  const toggle = () => {
    const element = audioRef.current
    if (!src || !element) {
      setPlaying((value) => !value)
      return
    }
    if (playing) {
      element.pause()
      setPlaying(false)
    } else {
      safePlay(element)
      setPlaying(true)
    }
  }

  const played = Math.round(progress * duration * 10) / 10

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5',
        className,
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? '暂停试听' : '播放试听'}
        aria-pressed={playing}
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full transition-transform duration-150',
          'bg-[color-mix(in_oklab,var(--n-success)_16%,transparent)] text-success hover:scale-105 active:scale-95',
        )}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true">
            <rect x="7" y="5.5" width="3.6" height="13" rx="1" fill="currentColor" />
            <rect x="13.4" y="5.5" width="3.6" height="13" rx="1" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="ml-0.5 size-3.5" aria-hidden="true">
            <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline gap-2">
          <p className="min-w-0 truncate text-xs font-medium text-fg">{title}</p>
          {subtitle && <span className="shrink-0 truncate text-2xs text-fg-4">{subtitle}</span>}
          <span className="ml-auto shrink-0 font-mono text-2xs text-fg-3 tabular-nums">
            {formatDuration(played)} / {formatDuration(duration)}
          </span>
        </div>

        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label={`${title} 播放进度`}
          aria-valuemin={0}
          aria-valuemax={Math.max(1, Math.round(duration))}
          aria-valuenow={Math.round(played)}
          aria-valuetext={`${formatDuration(played)} / ${formatDuration(duration)}`}
          onPointerDown={(event) => seek(event.clientX)}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            event.preventDefault()
            const step = 0.05 * (event.key === 'ArrowRight' ? 1 : -1)
            setProgress((value) => clampRatio(value + step))
          }}
          className="group relative flex h-8 cursor-pointer items-center gap-[2px] outline-none focus-visible:ring-2 focus-visible:ring-primary-ring"
        >
          {waveform.map((value, index) => {
            const ratio = index / waveform.length
            const active = ratio <= progress
            return (
              <span
                key={index}
                className={cn(
                  'flex-1 rounded-full transition-colors duration-150',
                  active ? 'bg-success' : 'bg-surface-3 group-hover:bg-success/40',
                )}
                style={{ height: `${Math.round(value * 100)}%` } as CSSProperties}
              />
            )
          })}

          {/* 播放头 */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-px bg-fg/60"
            style={{ left: `${progress * 100}%` }}
          />
        </div>
      </div>

      {src && (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onTimeUpdate={(event) => {
            const el = event.currentTarget
            if (el.duration) commitProgress(el.currentTime / el.duration)
          }}
          onEnded={() => {
            setPlaying(false)
            commitProgress(0)
          }}
        />
      )}

      <span
        aria-hidden="true"
        className="h-8 w-0.5 shrink-0 rounded-full"
        style={{ background: `var(--n-${tone})` }}
      />
    </div>
  )
}

/* ------------------------------ 资源卡片 ------------------------------ */

export interface MediaCardProps {
  kind: MediaKind
  title: string
  /** 图片 / 视频封面 */
  src?: string
  /** 视频源（提供后卡片即可播放） */
  videoSrc?: string
  /** 元信息：大小 · 分辨率 · 时长 */
  meta?: string
  duration?: number
  /** 音频卡片需要 */
  subtitle?: string
  selected?: boolean
  onClick?: () => void
  /** 播放状态变化（卡片内的视频被点开播放时上报） */
  onPlayStateChange?: (playing: boolean) => void
  className?: string
}

/**
 * 资源卡片：资源列表里的最小单元
 *
 * 三种类型共用一张卡，只换画面区域：
 * 列表里混排图片/视频/音频是常态，统一外框才不会一行高一行低。
 */
export function MediaCard({
  kind,
  title,
  src,
  videoSrc,
  meta,
  duration,
  subtitle,
  selected,
  onClick,
  onPlayStateChange,
  className,
}: MediaCardProps) {
  const tone = MEDIA_KIND_META[kind].tone
  const Root = onClick ? 'button' : 'div'

  return (
    <Root
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      aria-pressed={onClick ? selected : undefined}
      className={cn(
        'group flex w-full flex-col gap-2 rounded-lg border bg-surface p-2 text-left transition-[border-color,box-shadow] duration-150',
        selected
          ? 'border-primary/60 shadow-sm ring-2 ring-primary-ring'
          : 'border-line hover:border-line-strong hover:shadow-sm',
        className,
      )}
    >
      {kind === 'image' && <ImagePreview src={src} alt={title} ratio="4:3" />}

      {kind === 'video' && (
        <VideoPreview
          src={videoSrc}
          poster={src}
          title={title}
          duration={duration}
          ratio="4:3"
          // 整卡可点时不能再嵌一个播放按钮：既不合 HTML 规范，也会互相抢事件
          interactive={!onClick}
          onPlayStateChange={onPlayStateChange}
        />
      )}

      {kind === 'audio' && (
        <div
          className="flex flex-col justify-center gap-1.5 rounded-md px-2 py-3"
          style={{
            background: `linear-gradient(135deg, color-mix(in oklab, var(--n-${tone}) 12%, var(--n-surface-2)), var(--n-surface-2))`,
          }}
        >
          <MediaKindBadge kind="audio" className="self-start" />
          <div className="flex h-7 items-end gap-[2px]" aria-hidden="true">
            {seedWaveform(`${title}:${src ?? ''}`, 26).map((value, index) => (
              <span
                key={index}
                className="flex-1 rounded-full bg-success/55"
                style={{ height: `${Math.round(value * 100)}%` }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="min-w-0 px-0.5">
        <p className="truncate text-xs font-medium text-fg">{title}</p>
        <p className="mt-0.5 truncate text-2xs text-fg-3">
          {subtitle ?? (duration ? formatDuration(duration) : (meta ?? MEDIA_KIND_META[kind].hint))}
        </p>
      </div>
    </Root>
  )
}

/* 供列表页复用的尺寸快捷值 */
export const MEDIA_RATIO_LABEL: Record<string, string> = {
  '16:9': '16 : 9',
  '4:3': '4 : 3',
  '1:1': '1 : 1',
  '9:16': '9 : 16',
}
