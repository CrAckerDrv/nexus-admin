import {
  ArrowUpRight,
  ChartLine,
  CircleCheck,
  Cpu,
  Flame,
  Gauge,
  Server,
  Sparkles,
  Users,
} from 'lucide-react'
import { Button, MotionCard, Progress, toast } from '@nexus/ui'
import type { MotionEffect, MotionTone } from '@nexus/ui'
import type { GalleryCategory } from './types'

/**
 * 动效卡片（Motion）分类
 *
 * 这一类的条目都在回答同一个问题：「卡片怎么动，才既高级又不烦人」。
 * 五种效果共用 `MotionCard` 一个组件，差异只在 `effect` ——
 * 因此橱窗里可以把它们并排放在一起对照，而不是五个各写一套的 demo。
 *
 * 每个 demo 都是**真实可交互**的：指针移上去才会看到效果，
 * 静止的截图看不出倾斜与掠光，这也是把它们放进活组件的理由。
 */

const EFFECTS: Array<{ effect: MotionEffect; label: string; hint: string; tone: MotionTone }> = [
  { effect: 'lift', label: '抬升', hint: '悬停上浮 2px + 阴影加深，最保守', tone: 'primary' },
  { effect: 'spotlight', label: '光斑', hint: '指针坐标写变量，零重渲染', tone: 'violet' },
  { effect: 'tilt', label: '倾斜', hint: '3D 倾斜，最大 6°', tone: 'cyan' },
  { effect: 'sweep', label: '掠光', hint: '7.2s 一次，悬停加速', tone: 'warning' },
  { effect: 'aurora', label: '极光', hint: '14s / 18s 反向漂移', tone: 'rose' },
]

/* ------------------------------ 演示 ------------------------------ */

function EffectsDemo() {
  return (
    <div className="w-full space-y-2.5">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
        {EFFECTS.map((item) => (
          <MotionCard key={item.effect} effect={item.effect} tone={item.tone} className="p-3.5">
            <p className="flex items-center justify-between gap-1 text-2xs text-fg-4">
              {item.label}
              <code className="font-mono text-[0.625rem] text-fg-4">{item.effect}</code>
            </p>
            <p className="mt-1.5 text-lg font-semibold text-fg tabular-nums">128,460</p>
            <p className="mt-0.5 flex items-center gap-1 text-2xs text-success">
              <ArrowUpRight className="size-3" />
              +8.2%
            </p>
            <p className="mt-2 text-[0.625rem] leading-4 text-fg-4">{item.hint}</p>
          </MotionCard>
        ))}
      </div>
      <p className="text-2xs leading-5 text-fg-4">
        五张卡用同一个组件、同一套令牌，只有 <code className="font-mono">effect</code> 不同；
        把指针依次移过去就能感到节奏差异 —— 同一行最多混两种动效，否则会「整页在晃」。
      </p>
    </div>
  )
}

function BoardDemo() {
  return (
    <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-2">
      {[
        {
          icon: <Server className="size-4" />,
          label: '在线节点',
          value: '54',
          suffix: '台',
          effect: 'spotlight' as const,
          tone: 'cyan' as const,
        },
        {
          icon: <Cpu className="size-4" />,
          label: 'GPU 利用率',
          value: '72',
          suffix: '%',
          effect: 'tilt' as const,
          tone: 'violet' as const,
        },
        {
          icon: <Users className="size-4" />,
          label: '活跃用户',
          value: '128,460',
          suffix: '',
          effect: 'aurora' as const,
          tone: 'primary' as const,
        },
        {
          icon: <Flame className="size-4" />,
          label: '告警',
          value: '3',
          suffix: '条',
          effect: 'sweep' as const,
          tone: 'rose' as const,
        },
      ].map((item, index) => (
        <MotionCard
          key={item.label}
          index={index}
          effect={item.effect}
          tone={item.tone}
          className="p-3.5"
        >
          <div className="flex items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[color-mix(in_oklab,var(--mc-accent)_14%,transparent)] text-[var(--mc-accent)]">
              {item.icon}
            </span>
            <span className="truncate text-xs text-fg-3">{item.label}</span>
          </div>
          <p className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-semibold text-fg tabular-nums">{item.value}</span>
            {item.suffix && <span className="text-xs text-fg-3">{item.suffix}</span>}
          </p>
          <p className="mt-1.5 text-2xs text-fg-4">effect=&quot;{item.effect}&quot;</p>
        </MotionCard>
      ))}
    </div>
  )
}

function ClickableDemo() {
  return (
    <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
      <MotionCard
        effect="spotlight"
        tone="primary"
        onClick={() => toast.info('整卡可点击：去经营概览')}
        className="p-4"
      >
        <ChartLine className="size-5 text-primary" />
        <p className="mt-2 text-[0.8125rem] font-medium text-fg">经营概览</p>
        <p className="mt-0.5 text-2xs leading-5 text-fg-3">
          给了 onClick 就整卡可点，键盘 Enter / 空格同样触发。
        </p>
        <span className="mt-3 inline-flex items-center gap-1 text-2xs text-fg-4">
          点击进入 <ArrowUpRight className="size-3" />
        </span>
      </MotionCard>

      <MotionCard effect="lift" tone="success" className="p-4">
        <Gauge className="size-5 text-success" />
        <p className="mt-2 text-[0.8125rem] font-medium text-fg">不带 onClick</p>
        <p className="mt-0.5 text-2xs leading-5 text-fg-3">
          卡片回到普通容器语义，内部可放任意交互（这里是进度条）。
        </p>
        <div className="mt-3">
          <Progress value={86} size="sm" tone="success" showLabel label="存储" />
        </div>
      </MotionCard>
    </div>
  )
}

function IndexStaggerDemo() {
  return (
    <div className="w-full space-y-2.5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <MotionCard key={index} index={index} effect="lift" tone="warning" className="p-3">
            <p className="text-2xs text-fg-4">第 {index + 1} 张</p>
            <p className="mt-1 text-sm font-semibold text-fg">延迟 {index * 60}ms</p>
          </MotionCard>
        ))}
      </div>
      <p className="flex items-start gap-1.5 text-2xs leading-5 text-fg-4">
        <Sparkles className="mt-0.5 size-3 shrink-0 text-primary" />传 index 即有错峰入场（每张
        +60ms）；刷新页面可重看一遍。
      </p>
    </div>
  )
}

function ReducedMotionDemo() {
  return (
    <div className="w-full space-y-2.5">
      <MotionCard effect="aurora" tone="violet" className="p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium text-fg">
          <CircleCheck className="size-3.5 text-success" />
          减少动效时会发生什么
        </p>
        <ul className="mt-2 space-y-1 text-2xs leading-5 text-fg-3">
          <li>· 掠光与极光的循环动画直接停止，不会停在半透明的一帧</li>
          <li>· 倾斜不再随指针旋转，卡片保持正襟危坐</li>
          <li>· 抬升与阴影过渡取消，悬停只剩描边变色</li>
          <li>· 内容、焦点顺序与对比度完全不受影响</li>
        </ul>
      </MotionCard>
      <div className="flex flex-wrap gap-2">
        <Button
          size="xs"
          variant="secondary"
          onClick={() => {
            document.documentElement.dataset.motion = 'reduced'
            toast.info('已切到「减少动效」')
          }}
        >
          切到减少动效
        </Button>
        <Button
          size="xs"
          variant="secondary"
          onClick={() => {
            document.documentElement.dataset.motion = 'full'
            toast.info('已切到「始终开启动效」')
          }}
        >
          切到始终开启
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => {
            delete document.documentElement.dataset.motion
            toast.info('已恢复跟随系统')
          }}
        >
          跟随系统
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------ 清单 ------------------------------ */

export const motionCategory: GalleryCategory = {
  id: 'motion',
  name: 'Motion',
  title: '动效卡片',
  description: '抬升 / 光斑 / 倾斜 / 掠光 / 极光：指针驱动、零依赖、减少动效即全关',
  items: [
    {
      key: 'motion-effects',
      name: 'MotionCard · 五种效果',
      nameZh: '动效卡片',
      version: 'v0.2',
      summary: '五种低干扰动效共用一个组件，切换 effect 即可对比',
      demo: EffectsDemo,
      wide: true,
      previewHeight: 330,
      keywords: ['dongxiao', 'motion', 'card', 'hover', 'spotlight', 'tilt'],
      code: `import { MotionCard } from '@nexus/ui'

<MotionCard effect="spotlight" tone="violet" className="p-4">
  <p>本月活跃</p>
  <p className="text-xl font-semibold">128,460</p>
</MotionCard>`,
      props: [
        {
          name: 'effect',
          type: "'lift' | 'spotlight' | 'tilt' | 'sweep' | 'aurora' | 'none'",
          default: "'lift'",
          desc: '动效类型',
        },
        {
          name: 'tone',
          type: 'MotionTone',
          default: "'primary'",
          desc: '着色（映射 --n-chart-1..6）',
        },
        { name: 'index', type: 'number', default: '0', desc: '入场延迟序号（每张 +60ms）' },
        { name: 'onClick', type: '() => void', desc: '给了就整卡可点击（含键盘）' },
        { name: 'bordered', type: 'boolean', default: 'true', desc: '是否画描边' },
      ],
    },
    {
      key: 'motion-board',
      name: 'MotionCard · 指标流',
      nameZh: '动效指标卡',
      version: 'v0.2',
      summary: '同一个卡片流里混用四种效果，每张卡的节奏都不同',
      demo: BoardDemo,
      wide: true,
      previewHeight: 320,
      keywords: ['zhibiao', 'kpi', 'board'],
      code: `{[...metrics].map((item, index) => (
  <MotionCard key={item.label} index={index} effect={item.effect} tone={item.tone}>
    <MetricBody {...item} />
  </MotionCard>
))}`,
    },
    {
      key: 'motion-clickable',
      name: 'MotionCard · 可点击',
      nameZh: '可点击卡片',
      version: 'v0.2',
      summary: '传 onClick 才获得按钮语义，未传时仍是普通容器',
      demo: ClickableDemo,
      wide: true,
      previewHeight: 300,
      keywords: ['dianji', 'clickable', 'entry'],
      code: `// 可点击：role=button + tabIndex + Enter/空格
<MotionCard effect="spotlight" onClick={() => navigate('/dashboard/overview')}>…</MotionCard>

// 普通容器：内部放自己的交互
<MotionCard effect="lift"><Progress value={86} /></MotionCard>`,
    },
    {
      key: 'motion-stagger',
      name: 'MotionCard · 错峰入场',
      nameZh: '错峰入场',
      version: 'v0.2',
      summary: 'index 决定入场延迟，四张卡依次浮起而不是同时出现',
      demo: IndexStaggerDemo,
      wide: true,
      previewHeight: 220,
      keywords: ['cuofeng', 'stagger', 'index'],
      code: `{items.map((item, index) => (
  <MotionCard index={index} effect="lift">{item}</MotionCard>
))}`,
    },
    {
      key: 'motion-reduced',
      name: 'MotionCard · 减少动效',
      nameZh: '减少动效开关',
      version: 'v0.2',
      summary: '系统偏好与 data-motion 双向生效，关掉后卡片仍完全可用',
      demo: ReducedMotionDemo,
      wide: true,
      previewHeight: 290,
      keywords: ['wuzhangai', 'reduced', 'a11y'],
      code: `// 应用层：写在 <html data-motion="reduced|full">
document.documentElement.dataset.motion = 'reduced'
// 组件层：CSS 同时覆盖 prefers-reduced-motion 与 [data-motion='reduced']`,
    },
  ],
}
