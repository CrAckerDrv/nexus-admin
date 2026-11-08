/**
 * 资源素材索引
 *
 * 全部为**演示素材**，随仓库一起走，不依赖外部 CDN：
 * - 三张静帧与一段 6 秒短片、一条 6 秒环境音，均由 ffmpeg 的
 *   `gradients` / `sine` 滤镜生成（脚本见 `scripts/_gen-media-assets.mjs`），
 *   没有版权问题，也不会有「离线打开一片空白」的尴尬；
 * - 体积刻意压到最小：短片 34 KB（640×360 / H.264 crf30）、
 *   静帧 2–4 KB（WebP）、音频 36 KB（48 kbps MP3）。
 *
 * 换成真实素材时，把文件替换掉、保持文件名即可 ——
 * 页面与组件都只认这里的导出，不认路径。
 */
import stillStudio from './still-studio.webp'
import stillWarm from './still-warm.webp'
import stillMint from './still-mint.webp'
import auroraPoster from './clip-aurora-poster.webp'
import auroraClip from './clip-aurora.mp4'
import ambientPad from './ambient-pad.mp3'

/**
 * 静帧素材：用作图片显示与封面
 *
 * 命名按「画面气质」而不是用途：同一张图在详情、列表、封面里都会用到，
 * 一旦按用途命名（如 `list-thumb`），第二个场景就会开始复制文件。
 */
export const MEDIA_IMAGES = {
  /** 冷蓝紫：产品截图、登录页改版稿这类「数字产品」画面 */
  studio: stillStudio,
  /** 暖橙：营销素材、活动图 */
  warm: stillWarm,
  /** 森绿：数据 / 自然主题 */
  mint: stillMint,
  /** 短片封面（与 clip-aurora 首帧一致） */
  aurora: auroraPoster,
} as const

/** 媒体资源：视频与音频 */
export const MEDIA_SOURCES = {
  /** 6 秒渐变短片（640×360，H.264，faststart） */
  video: auroraClip,
  /** 6 秒环境音（220 Hz + 轻回声，48 kbps） */
  audio: ambientPad,
} as const

export type MediaImageKey = keyof typeof MEDIA_IMAGES
export type MediaSourceKey = keyof typeof MEDIA_SOURCES
