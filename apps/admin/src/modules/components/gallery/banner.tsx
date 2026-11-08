import { useState } from 'react'
import { ArrowRight, Bell, Download, RefreshCw, ShieldCheck } from 'lucide-react'
import { Badge, BannerCard, Button, Grid, HeroBanner, Tabs, toast } from '@nexus/ui'
import { BANNER_IMAGES } from '@/assets/banners'
import type { BannerTone, BannerVariant } from '@nexus/ui'
import type { GalleryCategory } from './types'

/**
 * 横幅（Banner）分类
 *
 * 这里放的是「单个能力的用法」：色调矩阵、模式矩阵、插画与 slot、卡片形态。
 * 成套的业务样例（带真实文案与落地位置）在模板中心的 `/templates/banner`，
 * 两边共用同一份插画素材，Props 表与源码保持单一事实来源。
 *
 * 之所以单独成类而不是塞进「反馈组件」：
 * alert.tsx 的 Banner 是**轻提示条**（一行文字 + 关闭），
 * 而 HeroBanner / BannerCard 是**区块级版式**（标题、说明、插画、按钮、slot），
 * 两者解决的问题不同，放在一起会让人以为只是换了个皮。
 */

const TONES: BannerTone[] = ['primary', 'success', 'warning', 'violet', 'rose', 'cyan']

const TONE_LABEL: Record<BannerTone, string> = {
  primary: '主色',
  success: '成功',
  warning: '警示',
  violet: '紫',
  rose: '玫红',
  cyan: '青',
}

/* ------------------------------ 演示 ------------------------------ */

function HeroTonesDemo() {
  return (
    <Grid cols={3} gap="sm">
      {TONES.map((tone) => (
        <HeroBanner
          key={tone}
          size="sm"
          imageSize="sm"
          tone={tone}
          title={TONE_LABEL[tone]}
          description="同一结构，只改 tone"
          actions={
            <Button size="xs" variant="primary" onClick={() => toast.info(`tone=${tone}`)}>
              查看
            </Button>
          }
        />
      ))}
    </Grid>
  )
}

const VARIANT_TABS = [
  { key: 'soft', label: 'soft' },
  { key: 'glass', label: 'glass' },
  { key: 'solid', label: 'solid' },
]

function HeroVariantsDemo() {
  const [variant, setVariant] = useState<BannerVariant>('soft')
  return (
    <div className="w-full space-y-2.5">
      <Tabs
        size="sm"
        variant="pill"
        value={variant}
        onChange={(key) => setVariant(key as BannerVariant)}
        items={VARIANT_TABS}
      />
      <HeroBanner
        tone="primary"
        variant={variant}
        title="本周经营简报已生成"
        description="三种模式只换底色与前景色，标题、说明与间距完全一致。"
        actions={
          <Button size="xs" variant={variant === 'solid' ? 'secondary' : 'primary'}>
            立即查看
          </Button>
        }
      />
    </div>
  )
}

function HeroImageDemo() {
  return (
    <div className="w-full space-y-2.5">
      <HeroBanner
        tone="rose"
        title="探索星空计划"
        description="传 image 即出现右侧插画，窄屏自动隐藏而不是压扁。"
        image={BANNER_IMAGES.donut}
        imageAlt="插画：甜甜圈"
        imageBleed
        actions={
          <Button size="xs" variant="primary">
            立即参与
          </Button>
        }
      />
      <HeroBanner
        tone="violet"
        title="智能组件系统"
        description="children 会渲染在描述与按钮之间，可放表单、标签、迷你图表。"
        image={BANNER_IMAGES.toolbox}
        imageSize="lg"
        actions={
          <Button size="xs" variant="primary">
            查看文档
          </Button>
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {['预设模式', '插画', 'slot', '响应式'].map((tag) => (
            <Badge key={tag} size="sm" tone="neutral">
              {tag}
            </Badge>
          ))}
        </div>
      </HeroBanner>
    </div>
  )
}

function BannerCardDemo() {
  return (
    <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
      <BannerCard
        tone="warning"
        image={BANNER_IMAGES.drone}
        title="系统运行正常"
        description="所有核心服务运行稳定，响应时间在正常范围内。"
        actions={
          <Button size="xs" variant="primary" onClick={() => toast.info('查看详情')}>
            查看详情
          </Button>
        }
      />
      <BannerCard
        tone="rose"
        icon={<Bell className="size-4" />}
        title="重要消息通知"
        description="不传 image 时用 icon 兜底，占位尺寸与插画区一致。"
        actions={
          <>
            <Button size="xs" variant="secondary">
              稍后提醒
            </Button>
            <Button size="xs" variant="primary">
              立即查看
            </Button>
          </>
        }
      />
    </div>
  )
}

function BannerSlotDemo() {
  const [loading, setLoading] = useState(false)
  return (
    <HeroBanner
      tone="success"
      variant="glass"
      eyebrow="自定义内容"
      title="插槽里可以放任意交互"
      description="按钮、标签、进度条都能塞进来；组件只负责底色、前景色与间距。"
      actions={
        <>
          <Button
            size="xs"
            variant="primary"
            loading={loading}
            leftIcon={<RefreshCw className="size-3" />}
            onClick={() => {
              setLoading(true)
              setTimeout(() => {
                setLoading(false)
                toast.success('已同步')
              }, 900)
            }}
          >
            同步数据
          </Button>
          <Button size="xs" variant="ghost" rightIcon={<ArrowRight className="size-3" />}>
            查看日志
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-2xs text-fg-2">
        <span className="inline-flex items-center gap-1 rounded-sm bg-success/10 px-1.5 py-0.5 text-success">
          <ShieldCheck className="size-3" />
          权限校验通过
        </span>
        <span className="inline-flex items-center gap-1 rounded-sm bg-surface-2 px-1.5 py-0.5">
          <Download className="size-3" />
          导出 1,284 条
        </span>
        <span className="text-fg-4">·</span>
        <span>这些都是 children，不是组件的固定结构</span>
      </div>
    </HeroBanner>
  )
}

/* ------------------------------ 清单 ------------------------------ */

export const bannerCategory: GalleryCategory = {
  id: 'banner',
  name: 'Banner',
  title: '横幅组件',
  description: '页面顶部与卡片流里的「标题 + 说明 + 插画 + 按钮」区块，六种色调三种模式',
  items: [
    {
      key: 'hero-banner-tones',
      name: 'HeroBanner · 色调',
      nameZh: '主横幅 · 六色调',
      version: 'v0.2',
      summary: '六档色调取自主题图表色板，跟随皮肤与深浅色自动变化',
      demo: HeroTonesDemo,
      wide: true,
      previewHeight: 330,
      keywords: ['hengfu', 'banner', 'hero', 'tone', 'sesdiao'],
      code: `import { HeroBanner, Button } from '@nexus/ui'

<HeroBanner
  tone="primary"        // primary | success | warning | violet | rose | cyan
  title="本周经营简报已生成"
  description="交易额环比 +12.4%，新增用户 1,284 人。"
  actions={<Button size="sm">立即查看</Button>}
/>`,
      props: [
        { name: 'title', type: 'ReactNode', desc: '主标题（必填）' },
        { name: 'description', type: 'ReactNode', desc: '说明文字，长文案自动换行' },
        { name: 'eyebrow / extra', type: 'ReactNode', desc: '标题上方的小标签 / 右侧徽标' },
        {
          name: 'tone',
          type: "'primary' | 'success' | 'warning' | 'violet' | 'rose' | 'cyan'",
          default: "'primary'",
          desc: '色调（映射 --n-chart-1..6）',
        },
        { name: 'actions', type: 'ReactNode', desc: '按钮区，组件不绑定路由' },
      ],
    },
    {
      key: 'hero-banner-variants',
      name: 'HeroBanner · 模式',
      nameZh: '主横幅 · 三种模式',
      version: 'v0.2',
      summary: 'soft / glass / solid：同一色调三档底色，前景色自动跟着走',
      demo: HeroVariantsDemo,
      wide: true,
      previewHeight: 250,
      keywords: ['mochi', 'variant', 'soft', 'glass', 'solid'],
      code: `<HeroBanner variant="soft"  title="…" />  // 15–17% 混色，默认
<HeroBanner variant="glass" title="…" />  // 6–20% 混色，压在深色区不抢眼
<HeroBanner variant="solid" title="…" />  // 实色底，前景自动转白`,
      props: [
        {
          name: 'variant',
          type: "'soft' | 'glass' | 'solid'",
          default: "'soft'",
          desc: '底色强度',
        },
        { name: 'size', type: "'sm' | 'md' | 'lg'", default: "'md'", desc: '内边距档位' },
      ],
    },
    {
      key: 'hero-banner-image',
      name: 'HeroBanner · 插画',
      nameZh: '主横幅 · 自定义插画 / slot',
      version: 'v0.2',
      summary: 'image 传地址即出现右侧插画，children 承载任意自定义内容',
      demo: HeroImageDemo,
      wide: true,
      previewHeight: 340,
      keywords: ['chahua', 'image', 'slot', 'chacao'],
      code: `<HeroBanner
  tone="rose"
  title="探索星空计划"
  image={donut}            // 透明底 PNG / WebP
  imageBleed               // 插画下沉贴边
  imageSize="md"           // sm | md | lg
  actions={<Button size="sm">立即参与</Button>}
>
  <p>children 渲染在描述与按钮之间</p>
</HeroBanner>`,
      props: [
        { name: 'image / imageAlt', type: 'string', desc: '插画地址与替代文本' },
        { name: 'imageSize', type: "'sm' | 'md' | 'lg'", default: "'md'", desc: '插画尺寸' },
        { name: 'imageBleed', type: 'boolean', default: 'false', desc: '插画下沉贴边' },
        { name: 'children', type: 'ReactNode', desc: '自定义内容（slot）' },
      ],
    },
    {
      key: 'banner-card',
      name: 'BannerCard',
      nameZh: '卡片横幅',
      version: 'v0.2',
      summary: '图在上、文在下的功能入口，四列并排时用两行说明对齐高度',
      demo: BannerCardDemo,
      wide: true,
      previewHeight: 330,
      keywords: ['kapian', 'card', 'banner', 'entry'],
      code: `<BannerCard
  tone="warning"
  image={drone}
  title="系统运行正常"
  description="所有核心服务运行稳定，响应时间在正常范围内。"
  actions={<Button size="xs">查看详情</Button>}
/>

// 没有插画时用 icon 兜底，占位尺寸一致
<BannerCard icon={<Bell className="size-4" />} title="重要消息通知" description="…" />`,
      props: [
        { name: 'title / description', type: 'ReactNode', desc: '标题与两行说明' },
        { name: 'image / icon', type: 'string / ReactNode', desc: '二选一，尺寸对齐' },
        { name: 'tone', type: 'BannerTone', default: "'primary'", desc: '色调' },
        { name: 'onClick', type: '() => void', desc: '给了就整卡可点击（含键盘）' },
        { name: 'extra', type: 'ReactNode', desc: '右上角角标' },
      ],
    },
    {
      key: 'banner-slot',
      name: 'HeroBanner · 组合',
      nameZh: '主横幅 · 插槽组合',
      version: 'v0.2',
      summary: '把状态标签、加载态按钮与说明塞进同一条，验证组件不抢内容',
      demo: BannerSlotDemo,
      wide: true,
      previewHeight: 240,
      keywords: ['zuhe', 'composition', 'slot'],
      code: `<HeroBanner
  tone="success"
  variant="glass"
  eyebrow="自定义内容"
  title="插槽里可以放任意交互"
  description="按钮、标签、进度条都能塞进来。"
  actions={<Button size="sm" loading={loading}>同步数据</Button>}
>
  <StatusTags />
</HeroBanner>`,
    },
  ],
}
