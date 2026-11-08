/**
 * 无限画布演示 · 场景数据
 *
 * 全部素材由代码生成（程序化 SVG），不引入任何二进制资源：
 * - 离线可跑、零版权风险、仓库不膨胀；
 * - 深浅色主题下都清晰（海报用中性渐变，不写死品牌色）；
 * - 需要真实素材时，演示页支持把本地图片/视频拖进画布替换。
 *
 * 三套场景分别覆盖：内容创作（品牌短片）、视觉探索（情绪板）、AI 生成链路。
 */

export type DemoNodeKind = 'text' | 'image' | 'video' | 'note' | 'prompt' | 'group'

export interface DemoAsset {
  /** 程序化生成的 SVG（data URI）或用户拖入的 object URL */
  src: string
  /** 生成器种子，用于稳定的视觉差异 */
  seed: number
  /** 是否有真实视频源（拖入了本地文件） */
  video?: boolean
  /** 时长（秒），展示用 */
  duration?: number
  /** 画面比例说明 */
  ratio?: string
}

export interface DemoNodeData {
  kind: DemoNodeKind
  /** 生成状态，用于展示流光边框 */
  status?: 'idle' | 'busy' | 'done'
  /** 文本节点正文 */
  text?: string
  /** 图片/视频节点素材 */
  asset?: DemoAsset
  /** 备注/提示词节点的作者与时间 */
  author?: string
  createdAt?: string
  /** 分组框标题 */
  subtitle?: string
  /** 分组框的成员数（渲染用，由页面维护） */
  memberCount?: number
  /** 视频节点的分镜说明 */
  shots?: string[]
  /** 节点色调 */
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
}

export interface DemoNode {
  id: string
  x: number
  y: number
  width: number
  height: number
  title: string
  kind: DemoNodeKind
  z?: number
  locked?: boolean
  /** 所属分组 id（编组后的成员标记） */
  groupId?: string
  data: DemoNodeData
}

export interface DemoEdge {
  id: string
  source: string
  target: string
  sourceSide?: 'left' | 'right' | 'top' | 'bottom'
  targetSide?: 'left' | 'right' | 'top' | 'bottom'
  shape?: 'bezier' | 'orthogonal' | 'straight'
  tone?: 'neutral' | 'primary' | 'ai' | 'success' | 'warning' | 'danger'
  label?: string
  dashed?: boolean
}

export interface DemoScene {
  id: string
  name: string
  description: string
  nodes: DemoNode[]
  edges: DemoEdge[]
  /** 打开场景时的默认相机 */
  camera: { x: number; y: number; zoom: number }
}

/* ------------------------------------------------------------------ *
 * 程序化画面生成
 *
 * 每个画面由「渐变底 + 若干几何层 + 颗粒噪点」组成，
 * 同一 seed 永远产生同一张图 —— 刷新页面不会换脸，便于演示复现。
 * ------------------------------------------------------------------ */

/** 线性同余伪随机：保证同 seed 同结果，不依赖 Math.random */
function rng(seed: number) {
  let state = seed % 2147483647
  if (state <= 0) state += 2147483646
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

const PALETTES: Array<[string, string, string, string]> = [
  ['#0f172a', '#1e3a8a', '#60a5fa', '#f8fafc'],
  ['#1c1917', '#7c2d12', '#fb923c', '#fef3c7'],
  ['#0b1a15', '#065f46', '#34d399', '#ecfdf5'],
  ['#1e1b4b', '#5b21b6', '#c4b5fd', '#f5f3ff'],
  ['#0b1626', '#0e7490', '#67e8f9', '#ecfeff'],
  ['#18181b', '#3f3f46', '#a1a1aa', '#fafafa'],
  ['#2a0a12', '#9f1239', '#fda4af', '#fff1f2'],
]

/**
 * 生成一张构图海报（1600×1000，SVG）
 *
 * 用「大幅渐变 + 圆形/带状光斑 + 细线栅格」的语汇，
 * 这些在缩放到很小时仍能被认出来，比复杂插画更适合画布。
 */
export function posterSvg(seed: number, options: { label?: string; ratio?: number } = {}): string {
  const random = rng(seed)
  const palette = PALETTES[Math.floor(random() * PALETTES.length)]!
  const [bg, mid, accent, light] = palette
  const height = 1000
  const width = Math.round(height * (options.ratio ?? 1.6))

  const blobs = Array.from({ length: 3 + Math.floor(random() * 3) }, () => {
    const cx = random() * width
    const cy = random() * height
    const r = (0.12 + random() * 0.34) * width
    const opacity = 0.18 + random() * 0.32
    return `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="${random() > 0.5 ? accent : light}" opacity="${opacity.toFixed(2)}" filter="url(#soft)"/>`
  }).join('')

  const bands = Array.from({ length: 2 + Math.floor(random() * 3) }, () => {
    const y = random() * height
    const thickness = 2 + random() * 14
    return `<rect x="0" y="${y.toFixed(0)}" width="${width}" height="${thickness.toFixed(1)}" fill="${light}" opacity="${(0.06 + random() * 0.12).toFixed(2)}" transform="rotate(${(random() * 8 - 4).toFixed(2)} ${width / 2} ${height / 2})"/>`
  }).join('')

  const lines = Array.from({ length: 14 }, (_, index) => {
    const x = (width / 14) * index
    return `<line x1="${x.toFixed(0)}" y1="0" x2="${x.toFixed(0)}" y2="${height}" stroke="${light}" stroke-width="1" opacity="0.05"/>`
  }).join('')

  const label = options.label
    ? `<text x="${(width * 0.06).toFixed(0)}" y="${(height * 0.9).toFixed(0)}" fill="${light}" opacity="0.72" font-family="system-ui,-apple-system,'Segoe UI',sans-serif" font-size="${(height * 0.055).toFixed(0)}" font-weight="600" letter-spacing="2">${escapeXml(options.label)}</text>`
    : ''

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="${bg}"/><stop offset="58%" stop-color="${mid}"/><stop offset="100%" stop-color="${bg}"/>
</linearGradient>
<filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(height * 0.09).toFixed(0)}"/></filter>
<linearGradient id="sheen" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stop-color="${light}" stop-opacity="0"/><stop offset="100%" stop-color="${light}" stop-opacity="0.16"/></linearGradient>
</defs>
<rect width="${width}" height="${height}" fill="url(#bg)"/>
${blobs}
${lines}
${bands}
<rect width="${width}" height="${height}" fill="url(#sheen)"/>
${label}
</svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 图片节点素材 */
export function posterAsset(seed: number, label?: string, ratio?: number): DemoAsset {
  return {
    src: posterSvg(seed, { label, ratio }),
    seed,
    ratio: ratio ? `${ratio.toFixed(2)} : 1` : '16 : 10',
  }
}

/* ------------------------------------------------------------------ *
 * 场景 1 · 品牌短片分镜
 * ------------------------------------------------------------------ */

const sceneStoryboard: DemoScene = {
  id: 'storyboard',
  name: '品牌短片分镜',
  description: '文本 Brief → 参考图 → 视频镜头 → 配乐提示 → 片名卡',
  camera: { x: 60, y: 60, zoom: 0.72 },
  nodes: [
    {
      id: 'brief',
      x: 0,
      y: 120,
      width: 300,
      height: 264,
      title: '创意 Brief',
      kind: 'text',
      data: {
        kind: 'text',
        author: '策划 · 陈默',
        createdAt: '10:24',
        text: `一支 30 秒的品牌短片，主题「清晨的第一束光」。

基调：克制、呼吸感、低饱和。
叙事：空镜开场 → 人的动作特写 → 产品落定。
禁忌：不要出现夸张转场与饱和滤镜。`,
      },
    },
    {
      id: 'mood-a',
      x: 392,
      y: -60,
      width: 268,
      height: 186,
      title: '参考 · 窗边光',
      kind: 'image',
      data: { kind: 'image', asset: posterAsset(1207, 'WINDOW'), tone: 'primary' },
    },
    {
      id: 'mood-b',
      x: 392,
      y: 168,
      width: 268,
      height: 186,
      title: '参考 · 织物肌理',
      kind: 'image',
      data: { kind: 'image', asset: posterAsset(3311, 'TEXTURE'), tone: 'warning' },
    },
    {
      id: 'mood-c',
      x: 392,
      y: 396,
      width: 268,
      height: 186,
      title: '参考 · 成品摆台',
      kind: 'image',
      data: { kind: 'image', asset: posterAsset(5820, 'OBJECT'), tone: 'success' },
    },
    {
      id: 'shot-1',
      x: 760,
      y: -20,
      width: 352,
      height: 208,
      title: '镜头 01 · 空镜',
      kind: 'video',
      data: {
        kind: 'video',
        asset: { ...posterAsset(901, 'SHOT 01'), duration: 6.2, video: false },
        shots: ['缓慢横移', '自然光', '无人物'],
        tone: 'info',
      },
    },
    {
      id: 'shot-2',
      x: 760,
      y: 238,
      width: 352,
      height: 208,
      title: '镜头 02 · 动作特写',
      kind: 'video',
      data: {
        kind: 'video',
        asset: { ...posterAsset(1742, 'SHOT 02'), duration: 8.5, video: false },
        shots: ['手部特写', '浅景深', '快门 1/60'],
        tone: 'info',
      },
    },
    {
      id: 'shot-3',
      x: 760,
      y: 496,
      width: 352,
      height: 208,
      title: '镜头 03 · 产品落定',
      kind: 'video',
      data: {
        kind: 'video',
        asset: { ...posterAsset(2266, 'SHOT 03'), duration: 5.4, video: false },
        shots: ['推轨收尾', '定格 2 秒', '背景留白'],
        tone: 'success',
      },
    },
    {
      id: 'sound',
      x: 1200,
      y: 96,
      width: 292,
      height: 176,
      title: '配乐提示',
      kind: 'prompt',
      data: {
        kind: 'prompt',
        tone: 'warning',
        text: 'ambient piano · 62 BPM · 无鼓点\n留一段 1.5 秒的静默，落在镜头 03 的定格上',
        createdAt: '10:31',
      },
    },
    {
      id: 'title-card',
      x: 1200,
      y: 320,
      width: 292,
      height: 152,
      title: '片名卡',
      kind: 'note',
      data: {
        kind: 'note',
        tone: 'primary',
        text: 'FIRST LIGHT\n「清晨的第一束光」\n字体：思源宋体 · 字重 300',
        author: '设计 · 林一',
        createdAt: '10:42',
      },
    },
    {
      id: 'note-review',
      x: 1200,
      y: 520,
      width: 292,
      height: 132,
      title: '评审意见',
      kind: 'note',
      data: {
        kind: 'note',
        tone: 'danger',
        text: '镜头 03 的定格再长 0.5 秒；片名卡留白偏多，可下移 12px。',
        author: '导演 · 周允',
        createdAt: '11:05',
      },
    },
  ],
  edges: [
    { id: 'e-brief-a', source: 'brief', target: 'mood-a', label: '视觉基调' },
    { id: 'e-brief-b', source: 'brief', target: 'mood-b' },
    { id: 'e-brief-c', source: 'brief', target: 'mood-c' },
    { id: 'e-a-1', source: 'mood-a', target: 'shot-1', tone: 'ai', label: '生成' },
    { id: 'e-b-2', source: 'mood-b', target: 'shot-2', tone: 'ai', label: '生成' },
    { id: 'e-c-3', source: 'mood-c', target: 'shot-3', tone: 'ai', label: '生成' },
    { id: 'e-1-next', source: 'shot-1', target: 'shot-2', shape: 'orthogonal' },
    { id: 'e-2-next', source: 'shot-2', target: 'shot-3', shape: 'orthogonal' },
    { id: 'e-1-sound', source: 'shot-1', target: 'sound', shape: 'straight', dashed: true },
    { id: 'e-sound-title', source: 'sound', target: 'title-card', shape: 'bezier' },
    { id: 'e-3-title', source: 'shot-3', target: 'title-card', shape: 'bezier', tone: 'primary' },
    { id: 'e-3-review', source: 'shot-3', target: 'note-review', shape: 'straight', tone: 'warning' },
  ],
}

/* ------------------------------------------------------------------ *
 * 场景 2 · 产品情绪板
 * ------------------------------------------------------------------ */

const sceneMoodboard: DemoScene = {
  id: 'moodboard',
  name: '产品情绪板',
  description: '图片矩阵 + 便签批注 + 提示词链，适合前期视觉探索',
  camera: { x: 40, y: 30, zoom: 0.8 },
  nodes: [
    {
      id: 'group-grid',
      x: -40,
      y: -60,
      width: 1000,
      height: 660,
      title: '方向 A · 极简纸感',
      kind: 'group',
      z: -10,
      locked: true,
      data: { kind: 'group', subtitle: '白底 / 大留白 / 低对比', tone: 'primary' },
    },
    ...Array.from({ length: 6 }, (_, index) => {
      const column = index % 3
      const row = Math.floor(index / 3)
      const seeds = [881, 1442, 2050, 2611, 3024, 4128]
      return {
        id: `tile-${index + 1}`,
        x: column * 312 + 16,
        y: row * 296 + 24,
        width: 280,
        height: 200,
        title: `M0${index + 1} · 参考`,
        kind: 'image' as const,
        data: { kind: 'image' as const, asset: posterAsset(seeds[index]!, `M0${index + 1}`), tone: 'neutral' as const },
      }
    }),
    {
      id: 'prompt-a',
      x: 1030,
      y: 20,
      width: 300,
      height: 190,
      title: '提示词 · 方向 A',
      kind: 'prompt',
      data: {
        kind: 'prompt',
        tone: 'primary',
        text: '主体：亚麻质感的桌面道具\n光线：左侧窗户自然光，柔和阴影\n材质：磨砂 / 纸纤维 / 石英\n构图：3:2，主体占画面 1/3',
        createdAt: '09:18',
      },
    },
    {
      id: 'note-pick',
      x: 1030,
      y: 244,
      width: 300,
      height: 150,
      title: '选定说明',
      kind: 'note',
      data: {
        kind: 'note',
        tone: 'success',
        text: 'M02 与 M05 进入终稿；其余留作风格参照，不参与交付。',
        author: '视觉 · 苏黎',
        createdAt: '09:47',
      },
    },
    {
      id: 'next-step',
      x: 1030,
      y: 428,
      width: 300,
      height: 120,
      title: '下一步',
      kind: 'text',
      data: {
        kind: 'text',
        text: '把 M02 的构图语言拆成 3 张延展稿，并给出包装贴图的落版位置。',
        author: '设计 · 林一',
        createdAt: '10:02',
      },
    },
  ],
  edges: [
    { id: 'm-e1', source: 'prompt-a', target: 'tile-1', tone: 'ai', label: '生成' },
    { id: 'm-e2', source: 'prompt-a', target: 'tile-2', tone: 'ai' },
    { id: 'm-e3', source: 'prompt-a', target: 'tile-4', tone: 'ai' },
    { id: 'm-e4', source: 'tile-2', target: 'note-pick', shape: 'straight' },
    { id: 'm-e5', source: 'note-pick', target: 'next-step', shape: 'orthogonal' },
  ],
}

/* ------------------------------------------------------------------ *
 * 场景 3 · AI 生成工作流
 * ------------------------------------------------------------------ */

const scenePipeline: DemoScene = {
  id: 'pipeline',
  name: 'AI 生成工作流',
  description: 'Prompt → 图片 → 视频，演示连线语义色与流式生成态',
  camera: { x: 70, y: 90, zoom: 0.78 },
  nodes: [
    {
      id: 'p-src',
      x: 0,
      y: 150,
      width: 300,
      height: 200,
      title: '输入素材',
      kind: 'image',
      data: { kind: 'image', asset: posterAsset(6011, 'SOURCE'), tone: 'neutral' },
    },
    {
      id: 'p-prompt',
      x: 0,
      y: 400,
      width: 300,
      height: 176,
      title: '结构化提示词',
      kind: 'prompt',
      data: {
        kind: 'prompt',
        tone: 'primary',
        text: '主体 + 光线 + 材质 + 构图 + 风格\n（五段式，缺一不可）\n示例：陶罐 / 侧逆光 / 粗陶 / 居中 / 极简',
        createdAt: '08:52',
      },
    },
    {
      id: 'p-img',
      x: 404,
      y: 130,
      width: 320,
      height: 232,
      title: '生成 · 静帧',
      kind: 'image',
      data: { kind: 'image', asset: posterAsset(7331, 'STILL'), tone: 'primary', status: 'done' },
    },
    {
      id: 'p-var',
      x: 404,
      y: 410,
      width: 320,
      height: 168,
      title: '变体 · 换光线',
      kind: 'image',
      data: { kind: 'image', asset: posterAsset(8442, 'VARIANT'), tone: 'warning' },
    },
    {
      id: 'p-video',
      x: 812,
      y: 150,
      width: 360,
      height: 220,
      title: '生成 · 动态镜头',
      kind: 'video',
      data: {
        kind: 'video',
        asset: { ...posterAsset(9551, 'MOTION'), duration: 4.0 },
        shots: ['推近 12%', '空气感颗粒', '循环无缝'],
        tone: 'info',
      },
    },
    {
      id: 'p-qa',
      x: 812,
      y: 420,
      width: 360,
      height: 150,
      title: '质检',
      kind: 'note',
      data: {
        kind: 'note',
        tone: 'success',
        text: '一致度 92%，无主体漂移；动态镜头首尾帧可无缝循环。',
        author: '自动质检',
        createdAt: '08:58',
      },
    },
    {
      id: 'p-out',
      x: 1232,
      y: 250,
      width: 280,
      height: 160,
      title: '交付包',
      kind: 'group',
      z: -5,
      locked: true,
      data: { kind: 'group', subtitle: '静帧 ×2 · 动态 ×1 · 说明文档', tone: 'success' },
    },
  ],
  edges: [
    { id: 'p-1', source: 'p-src', target: 'p-img', tone: 'primary' },
    { id: 'p-2', source: 'p-prompt', target: 'p-img', tone: 'ai', label: '生成' },
    { id: 'p-3', source: 'p-img', target: 'p-video', tone: 'ai', label: '图生视频' },
    { id: 'p-4', source: 'p-prompt', target: 'p-var', tone: 'ai' },
    { id: 'p-5', source: 'p-var', target: 'p-video', dashed: true, label: '备选' },
    { id: 'p-6', source: 'p-img', target: 'p-qa', shape: 'orthogonal', tone: 'success' },
    { id: 'p-7', source: 'p-video', target: 'p-qa', shape: 'orthogonal', tone: 'success' },
    { id: 'p-8', source: 'p-qa', target: 'p-out', shape: 'bezier', tone: 'success' },
  ],
}

export const DEMO_SCENES: DemoScene[] = [sceneStoryboard, sceneMoodboard, scenePipeline]

/* ------------------------------------------------------------------ *
 * 素材新增：从工具栏拖入/点击新建
 * ------------------------------------------------------------------ */

export interface NewNodeSpec {
  kind: DemoNodeKind
  title: string
  width: number
  height: number
  data: DemoNodeData
}

let seedCounter = 5000

export function createNodeSpec(kind: DemoNodeKind, position: { x: number; y: number }): (NewNodeSpec & { x: number; y: number }) {
  seedCounter += 137

  switch (kind) {
    case 'text':
      return {
        kind,
        x: position.x,
        y: position.y,
        width: 300,
        height: 180,
        title: '文本节点',
        data: {
          kind,
          text: '双击直接编辑；点 AI 让模型改写这一段的语气。',
          author: '你',
          createdAt: nowLabel(),
        },
      }
    case 'image':
      return {
        kind,
        x: position.x,
        y: position.y,
        width: 300,
        height: 214,
        title: '图片节点',
        data: { kind, asset: posterAsset(seedCounter, 'NEW'), tone: 'primary' },
      }
    case 'video':
      return {
        kind,
        x: position.x,
        y: position.y,
        width: 336,
        height: 216,
        title: '视频节点',
        data: {
          kind,
          asset: { ...posterAsset(seedCounter, 'MOTION'), duration: 4.2 },
          shots: ['新建镜头', '拖入本地视频可替换'],
          tone: 'info',
        },
      }
    case 'note':
      return {
        kind,
        x: position.x,
        y: position.y,
        width: 260,
        height: 140,
        title: '便签',
        data: { kind, text: '记一句待办或反馈。', author: '你', createdAt: nowLabel(), tone: 'warning' },
      }
    case 'prompt':
      return {
        kind,
        x: position.x,
        y: position.y,
        width: 300,
        height: 176,
        title: '提示词',
        data: {
          kind,
          tone: 'primary',
          text: '主体：\n光线：\n材质：\n构图：\n风格：',
          createdAt: nowLabel(),
        },
      }
    case 'group':
      return {
        kind,
        x: position.x,
        y: position.y,
        width: 560,
        height: 380,
        title: '分组',
        data: { kind, subtitle: '把相关节点拖进来，标题可改', tone: 'neutral' },
      }
    default:
      return {
        kind: 'text',
        x: position.x,
        y: position.y,
        width: 300,
        height: 180,
        title: '文本节点',
        data: { kind: 'text', text: '' },
      }
  }
}

/** 由 AI 回答生成一个「子节点」副稿 */
export function createChildSpec(
  parent: DemoNode,
  text: string,
): {
  x: number
  y: number
  width: number
  height: number
  title: string
  /** 副稿永远是文本节点：AI 回答是文字，塞进图片/视频节点会和素材冲突 */
  kind: 'text'
  data: DemoNodeData
} {
  const texty = parent.kind === 'text' || parent.kind === 'prompt' || parent.kind === 'note'
  return {
    x: parent.x + parent.width + 48,
    y: parent.y,
    width: Math.max(280, parent.width),
    height: texty ? 220 : 260,
    title: `${parent.title} · AI 副稿`,
    kind: 'text',
    data: { kind: 'text', text, tone: 'primary', author: 'AI', createdAt: nowLabel() },
  }
}

/** 本地时间 HH:mm（避免渲染期调用 Date.now 导致不纯） */
export function nowLabel(): string {
  const date = new Date()
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** 应用 AI 回答到节点：文本类替换正文，图片/视频类更新描述与状态 */
export function applyAnswer(node: DemoNode, answer: string): DemoNodeData {
  if (node.kind === 'text' || node.kind === 'prompt' || node.kind === 'note') {
    return { ...node.data, text: answer, status: 'done' }
  }
  return {
    ...node.data,
    status: 'done',
    shots: answer.split('\n').filter(Boolean).slice(0, 3),
  }
}

/** 节点内容 → AI 上下文纯文本 */
export function nodeContent(node: DemoNode): string {
  switch (node.kind) {
    case 'image':
      return node.data.asset ? `参考图 ${node.title}（${node.data.asset.ratio ?? ''}）` : node.title
    case 'video':
      return `${node.title}｜分镜：${(node.data.shots ?? []).join(' / ')}｜时长 ${node.data.asset?.duration ?? 0}s`
    case 'group':
      return `${node.title}｜${node.data.subtitle ?? ''}`
    default:
      return node.data.text ?? ''
  }
}

/** 各类型节点的 AI 快捷指令 */
export function aiSuggestions(kind: DemoNodeKind): string[] {
  switch (kind) {
    case 'text':
      return ['改得更有画面感', '压缩到 60 字', '换成克制专业的语气']
    case 'image':
      return ['给三个更具体的画面描述', '换一种光线', '提取配色规则']
    case 'video':
      return ['拆成三拍分镜', '给出运镜建议', '让首尾帧可循环']
    case 'prompt':
      return ['重构成五段式', '补充负面提示词', '换成更稳的风格词']
    case 'note':
      return ['整理成三条结论', '标出风险点', '改写成给设计的需求']
    case 'group':
      return ['重排阅读顺序', '总结这一组的意图']
    default:
      return ['优化这个节点']
  }
}
