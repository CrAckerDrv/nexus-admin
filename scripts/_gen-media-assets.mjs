/**
 * 重新生成「资源与编辑器」演示素材
 *
 * 素材全部由 ffmpeg 内置滤镜合成，不依赖任何外部下载：
 * - 短片：`gradients` 滤镜（spiral）6 秒，640×360 / H.264 crf30 / faststart，约 34 KB
 * - 静帧：同一滤镜取首帧转 WebP，单张 2–4 KB
 * - 音频：`sine` 220 Hz + 轻回声，6 秒 / 48 kbps MP3，约 36 KB
 *
 * 为什么要脚本而不是把二进制直接放进来：
 * 换配色、换时长都要重跑一次，留脚本才能保证「素材是这个仓库能生成的」，
 * 而不是某台机器上的历史遗留物。
 *
 * 用法（需要 ffmpeg 在 PATH 或在 demo-video/_bin 下）：
 *   node scripts/_gen-media-assets.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'apps', 'admin', 'src', 'assets', 'media')

const FFMPEG_CANDIDATES = [
  process.env.FFMPEG_PATH,
  'ffmpeg',
  join(
    root,
    '..',
    'demo-video',
    '_bin',
    'ffmpeg',
    'ffmpeg-master-latest-win64-gpl',
    'bin',
    'ffmpeg.exe',
  ),
  'C:/ffmpeg/bin/ffmpeg.exe',
].filter(Boolean)

/** 真的跑一次 `-version` 再认：只看路径存在会把 PATH 里的名字当成二进制 */
function usable(bin) {
  try {
    execFileSync(bin, ['-version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const FFMPEG = FFMPEG_CANDIDATES.find((candidate) => usable(candidate))

if (!FFMPEG) {
  console.error('未找到 ffmpeg：设置 FFMPEG_PATH 或把它放进 PATH')
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })

const run = (args) => {
  console.log(`$ ffmpeg ${args.join(' ')}`)
  execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...args], {
    stdio: 'inherit',
  })
}

/**
 * 渐变底色的复用描述：改一处即可换整套演示素材的调性
 *
 * 注意 `type` 的选择：`radial` / `circular` 会把第一档颜色聚成一个圆心色块，
 * 缩略图上看像「画面中间扣了个洞」。静帧统一用 `linear` / `spiral`，
 * 只有短片用 `spiral` 才有缓慢旋转的动势。
 */
const GRADIENTS = {
  studio: 'c0=0x312e81:c1=0x6366f1:c2=0x22d3ee:c3=0xe0f2fe:n=4:speed=0.01:type=linear',
  warm: 'c0=0x7c2d12:c1=0xf59e0b:c2=0xfde68a:c3=0xfff7ed:n=4:speed=0.01:type=linear',
  mint: 'c0=0x065f46:c1=0x10b981:c2=0xa7f3d0:c3=0xf0fdf4:n=4:speed=0.01:type=linear',
  aurora: 'c0=0x0b1a2b:c1=0x1d4ed8:c2=0x06b6d4:c3=0x7c3aed:n=4:speed=0.01:type=spiral',
}

// 1. 短片：6 秒 / 640×360 / 24fps
run([
  '-f',
  'lavfi',
  '-i',
  `gradients=s=640x360:${GRADIENTS.aurora}:d=6:r=24`,
  '-vf',
  'format=yuv420p',
  '-c:v',
  'libx264',
  '-preset',
  'veryslow',
  '-crf',
  '30',
  '-movflags',
  '+faststart',
  '-an',
  join(outDir, 'clip-aurora.mp4'),
])

// 2. 短片封面（取第 1 帧）
run([
  '-f',
  'lavfi',
  '-i',
  `gradients=s=960x600:${GRADIENTS.aurora}:d=1:r=1`,
  '-frames:v',
  '1',
  '-c:v',
  'libwebp',
  '-quality',
  '62',
  join(outDir, 'clip-aurora-poster.webp'),
])

// 3. 三张静帧
for (const [name, gradient] of Object.entries(GRADIENTS)) {
  if (name === 'aurora') continue
  run([
    '-f',
    'lavfi',
    '-i',
    `gradients=s=960x600:${gradient}:d=1:r=1`,
    '-frames:v',
    '1',
    '-c:v',
    'libwebp',
    '-quality',
    '72',
    join(outDir, `still-${name}.webp`),
  ])
}

// 4. 环境音：220 Hz 正弦 + 一次回声
run([
  '-f',
  'lavfi',
  '-i',
  'sine=frequency=220:duration=6:sample_rate=22050',
  '-af',
  'volume=0.18,aecho=0.8:0.7:60:0.25',
  '-c:a',
  'libmp3lame',
  '-b:a',
  '48k',
  join(outDir, 'ambient-pad.mp3'),
])

console.log(`\n✓ 素材已生成到 ${outDir}`)
