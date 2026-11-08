import { useState } from 'react'
import { ArrowUpRight, BookOpen, Code2, Layers, Sparkles } from 'lucide-react'
import {
  Badge,
  BannerCard,
  Button,
  Card,
  Grid,
  HeroBanner,
  PageContainer,
  PageHeader,
  SegmentedControl,
  SectionCard,
  StatCard,
  Tabs,
  cn,
  toast,
} from '@nexus/ui'
import { BANNER_IMAGES } from '@/assets/banners'
import { useAppNavigate } from '@/components/app-link'
import { CARD_BANNERS, HERO_BANNERS, PRESET_MATRIX } from './banner-presets'
import type { BannerTone, BannerVariant } from '@nexus/ui'

/**
 * 横幅模板
 *
 * 这一页的定位与其它模板不同：它不是「一整页的骨架」，而是**一个区块的完整规格**。
 * 所以版面的第一屏就是横幅本身（而不是先讲一堆设计理念），
 * 往下的每一段再回答「换配色怎么换、放插画怎么放、卡片流里怎么写」。
 *
 * 与组件橱窗的分工：
 * - 这里放**成套的样例**（真实文案 + 真实插画 + 落地位置），可以整段复制；
 * - 组件橱窗里的「横幅」分类放**单个能力的用法与 Props**（一个 tone 一行）。
 * 两处共用 `banner-presets.ts`，不会出现「橱窗里的样例和模板页不一样」。
 */

type ToneFilter = 'all' | BannerTone

const TONE_OPTIONS: Array<{ value: ToneFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'primary', label: '主色' },
  { value: 'success', label: '绿' },
  { value: 'warning', label: '橙' },
  { value: 'violet', label: '紫' },
  { value: 'rose', label: '玫红' },
  { value: 'cyan', label: '青' },
]

const VARIANT_TABS = [
  { key: 'soft', label: 'soft' },
  { key: 'glass', label: 'glass' },
  { key: 'solid', label: 'solid' },
]

export default function BannerTemplatePage() {
  const navigate = useAppNavigate()
  const [tone, setTone] = useState<ToneFilter>('all')
  const [variant, setVariant] = useState<BannerVariant>('soft')

  const heroes = tone === 'all' ? HERO_BANNERS : HERO_BANNERS.filter((item) => item.tone === tone)

  return (
    <PageContainer size="lg">
      <PageHeader
        title="横幅模板"
        description="一句标题 + 一段说明 + 一个按钮 + 一张插画：后台里出现频率最高的「区块级」版式"
        badge={<Badge tone="primary">Banner</Badge>}
        actions={
          <Button
            variant="secondary"
            leftIcon={<Code2 className="size-3.5" />}
            onClick={() => navigate('/components/overview')}
          >
            组件用法与 Props
          </Button>
        }
      />

      <Grid cols={4} gap="md" className="mb-3">
        <StatCard
          label="预设样例"
          value={String(HERO_BANNERS.length + CARD_BANNERS.length)}
          suffix="个"
          tone="primary"
          icon={<Layers className="size-4" />}
        />
        <StatCard label="色调" value="6" suffix="种" tone="success" />
        <StatCard label="配置模式" value="3" suffix="种" tone="warning" />
        <StatCard label="插画体积" value="20" suffix="KB/张" tone="danger" />
      </Grid>

      {/* ------------------------- 1. 主横幅 ------------------------- */}
      <SectionCard
        title="主横幅 · HeroBanner"
        description="页面顶部的一句话区：文字占左、插画靠右，窄屏自动收起插画"
        extra={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl size="sm" value={tone} onChange={setTone} options={TONE_OPTIONS} />
          </div>
        }
        bodyClassName="space-y-3 px-4 pb-4 pt-3"
      >
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {heroes.map((item) => (
            <div key={item.key} className="space-y-1.5">
              <HeroBanner
                tone={item.tone}
                variant={item.variant}
                eyebrow={item.eyebrow}
                title={item.title}
                description={item.slot ? undefined : item.description}
                image={item.image ? BANNER_IMAGES[item.image] : undefined}
                imageAlt={item.image ? item.title : undefined}
                imageBleed
                actions={
                  <>
                    <Button
                      size="sm"
                      variant={item.variant === 'solid' ? 'secondary' : 'primary'}
                      onClick={() => toast.info(`${item.title}：${item.action}`)}
                    >
                      {item.action}
                    </Button>
                    {item.secondaryAction && (
                      <Button size="sm" variant="ghost">
                        {item.secondaryAction}
                      </Button>
                    )}
                  </>
                }
              >
                {item.slot && <p className="text-xs leading-5 text-fg-2">{item.description}</p>}
              </HeroBanner>
              <p className="px-1 text-2xs text-fg-4">
                <code className="font-mono text-fg-3">{item.key}</code> · {item.notes[0]}
              </p>
            </div>
          ))}
        </div>

        {heroes.length === 0 && (
          <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-xs text-fg-3">
            该色调暂无样例，切换「全部」查看六种色调。
          </p>
        )}
      </SectionCard>

      {/* ------------------------- 2. 卡片横幅 ------------------------- */}
      <SectionCard
        className="mt-3"
        title="卡片横幅 · BannerCard"
        description="卡片流里的功能入口：图在上、文在下，四列并排时用两行说明对齐高度"
        extra={
          <Badge tone="info" variant="soft">
            {CARD_BANNERS.length} 个样例
          </Badge>
        }
        bodyClassName="px-4 pb-4 pt-3"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {CARD_BANNERS.map((item) => (
            <BannerCard
              key={item.key}
              tone={item.tone}
              image={item.image ? BANNER_IMAGES[item.image] : undefined}
              imageAlt={item.image ? item.title : undefined}
              title={item.title}
              description={item.description}
              actions={
                <>
                  {item.secondaryAction && (
                    <Button size="xs" variant="secondary">
                      {item.secondaryAction}
                    </Button>
                  )}
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => toast.info(`${item.title}：${item.action}`)}
                  >
                    {item.action}
                  </Button>
                </>
              }
            />
          ))}
        </div>
      </SectionCard>

      {/* ------------------------- 3. 预设模式 ------------------------- */}
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <SectionCard
          title="配置模式（Preset）"
          description="同一个 tonal 语义只换 variant，正文与按钮颜色自动跟着走"
          extra={
            <Tabs
              size="sm"
              variant="pill"
              value={variant}
              onChange={(key) => setVariant(key as BannerVariant)}
              items={VARIANT_TABS}
            />
          }
          bodyClassName="space-y-3 px-4 pb-4 pt-2"
        >
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {PRESET_ROWS.map((item) => (
              <HeroBanner
                key={item.tone}
                size="sm"
                tone={item.tone}
                variant={variant}
                title={item.title}
                description={item.description}
                actions={
                  <Button size="xs" variant={variant === 'solid' ? 'secondary' : 'primary'}>
                    {item.action}
                  </Button>
                }
              />
            ))}
          </div>
          <p className="text-2xs leading-5 text-fg-4">
            按钮的外观由调用方决定：实色底下改用{' '}
            <code className="font-mono">variant=&quot;secondary&quot;</code>{' '}
            才不会和底色撞在一起。组件只负责底色、文字色与间距。
          </p>
        </SectionCard>

        <SectionCard title="三种模式的区别" bodyClassName="px-4 pb-4 pt-2">
          <ul className="space-y-3">
            {PRESET_MATRIX.map((item) => (
              <li key={item.variant} className="rounded-md border border-line bg-surface-2/50 p-3">
                <p className="flex items-center gap-2 text-xs font-medium text-fg">
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      item.variant === 'soft' && 'bg-primary/60',
                      item.variant === 'glass' && 'bg-chart-4/60',
                      item.variant === 'solid' && 'bg-danger/60',
                    )}
                  />
                  <code className="font-mono">{item.label}</code>
                </p>
                <p className="mt-1 text-2xs leading-5 text-fg-3">{item.description}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {/* ------------------------- 4. 插画素材 ------------------------- */}
      <SectionCard
        className="mt-3"
        title="插画素材"
        description="透明底 3D 黏土插画，单张 13–26 KB；换成自己的图片只要把 image 换成地址"
        extra={
          <Button
            size="xs"
            variant="ghost"
            rightIcon={<ArrowUpRight className="size-3" />}
            onClick={() => toast.info('素材位于 apps/admin/src/assets/banners')}
          >
            素材位置
          </Button>
        }
        bodyClassName="px-4 pb-4 pt-3"
      >
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 xl:grid-cols-9">
          {Object.entries(BANNER_IMAGES).map(([key, src]) => (
            <figure
              key={key}
              className="group flex flex-col items-center gap-1 rounded-md border border-line bg-surface-2/50 p-2 transition-colors hover:border-primary/35"
            >
              <img
                src={src}
                alt={key}
                loading="lazy"
                className="size-12 object-contain transition-transform duration-300 group-hover:scale-110"
              />
              <figcaption className="w-full truncate text-center font-mono text-[0.5625rem] text-fg-4">
                {key}
              </figcaption>
            </figure>
          ))}
        </div>
      </SectionCard>

      {/* ------------------------- 5. 落地与复制 ------------------------- */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-start gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[0.8125rem] font-semibold text-fg">已经落地在哪里</h3>
              <p className="mt-0.5 text-xs leading-5 text-fg-3">
                「经营概览」页顶部的欢迎横幅就是一个 HeroBanner，
                带用户名、日期与今天的待办数，数据来自真实 store 与查询。
              </p>
            </div>
          </div>
          <div className="mt-auto flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={() => navigate('/dashboard/overview')}>
              去经营概览看效果
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/components/overview')}>
              组件橱窗
            </Button>
          </div>
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-start gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-success/10 text-success">
              <BookOpen className="size-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[0.8125rem] font-semibold text-fg">复制走要改什么</h3>
              <p className="mt-0.5 text-xs leading-5 text-fg-3">
                横幅是<strong className="font-semibold text-fg-2">组件</strong>而不是整页源码： 直接
                import 就能用，不需要把这个页面复制到自己的模块目录。
              </p>
            </div>
          </div>
          <ul className="space-y-1 text-2xs text-fg-2">
            <li>
              <span className="mr-1.5 font-semibold text-fg">1.</span>
              <code className="rounded bg-surface-2 px-1 font-mono">
                import {'{'} HeroBanner {'}'} from &apos;@nexus/ui&apos;
              </code>
            </li>
            <li>
              <span className="mr-1.5 font-semibold text-fg">2.</span>
              选一个 tone，需要插画就传 image，其余交给默认值
            </li>
            <li>
              <span className="mr-1.5 font-semibold text-fg">3.</span>
              actions 里放自己的按钮与跳转，组件不绑定路由
            </li>
          </ul>
        </Card>
      </div>
    </PageContainer>
  )
}

/** 预设模式下四张小横幅的文案：同一组结构配不同内容，才能看出模式本身的差别 */
const PRESET_ROWS: Array<{
  tone: BannerTone
  title: string
  description: string
  action: string
}> = [
  {
    tone: 'primary',
    title: '本周经营简报已生成',
    description: '交易额环比 +12.4%，新增用户 1,284 人。',
    action: '立即查看',
  },
  {
    tone: 'success',
    title: '数据同步已完成',
    description: '12 张报表全部更新，用时 42 秒。',
    action: '查看明细',
  },
  {
    tone: 'warning',
    title: '存储配额已用 86%',
    description: '按当前增速，预计 7 天后触顶。',
    action: '扩容配额',
  },
  {
    tone: 'rose',
    title: '检测到 3 笔风险订单',
    description: '自动结算已暂停，请人工复核。',
    action: '处理风险',
  },
]
