import { useState } from 'react'
import { ChartLine, CircleDollarSign, Sparkles, Star, TrendingUp, Users, Zap } from 'lucide-react'
import {
  Alert,
  AnimatedNumber,
  Badge,
  BorderBeam,
  Button,
  Card,
  CodeBlock,
  GradientText,
  Grid,
  Marquee,
  PageContainer,
  PageHeader,
  RingMetric,
  SectionCard,
  ShortcutHint,
  SlidingTabs,
  Sparkline,
  SpotlightCard,
  toast,
} from '@nexus/ui'

const TREND_A = [12, 18, 15, 24, 21, 30, 27, 36, 33, 42, 48, 44]
const TREND_B = [40, 36, 38, 31, 34, 28, 30, 25, 27, 22, 24, 19]
const TREND_C = [8, 12, 10, 16, 20, 18, 24, 22, 28, 32, 30, 38]

export default function PremiumPage() {
  const [tab, setTab] = useState<'week' | 'month' | 'quarter'>('month')
  const [demoKey, setDemoKey] = useState(0)

  return (
    <PageContainer size="lg">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            高级视觉组件
            <Badge tone="primary" size="sm">
              Premium
            </Badge>
          </span>
        }
        description="9 个纯 CSS 实现的高级感组件：数字滚动、光斑跟随、流光边框、渐变标题、跑马灯、滑动标签、环形指标、迷你趋势、键位提示"
        actions={
          <Button
            variant="secondary"
            leftIcon={<Sparkles className="size-3.5" />}
            onClick={() => {
              setDemoKey((key) => key + 1)
              toast.success('动画已重新播放')
            }}
          >
            重播动画
          </Button>
        }
      />

      <Alert tone="info" compact className="mb-3" title="设计原则">
        这些效果全部用 CSS 变量 +{' '}
        <code className="rounded bg-surface-2 px-1 font-mono text-2xs">requestAnimationFrame</code>{' '}
        实现，没有引入 motion / framer-motion 之类的动画库；动效开关与 CSS 同源 ——
        <code className="rounded bg-surface-2 px-1 font-mono text-2xs">
          data-motion=&quot;full&quot;
        </code>
        开、<code className="rounded bg-surface-2 px-1 font-mono text-2xs">reduced</code>
        关，未设置时跟随
        <code className="rounded bg-surface-2 px-1 font-mono text-2xs">prefers-reduced-motion</code>
        。关掉后数字直接显示终值，不会停在滚动中途。
      </Alert>

      {/* 1. 数字滚动 + 迷你趋势 */}
      <SectionCard
        className="mb-3"
        title="AnimatedNumber · Sparkline"
        description="指标入场动画与趋势缩略图，数字用 easeOutExpo 插值"
      >
        <Grid cols={4} gap="md" className="p-3" key={demoKey}>
          {[
            {
              label: '本月交易额',
              value: 8642300,
              prefix: '¥ ',
              trend: TREND_A,
              tone: 'primary' as const,
              icon: <CircleDollarSign className="size-4" />,
            },
            {
              label: '活跃用户',
              value: 128460,
              trend: TREND_A,
              tone: 'success' as const,
              icon: <Users className="size-4" />,
            },
            {
              label: '转化率',
              value: 4.68,
              decimals: 2,
              suffix: '%',
              trend: TREND_C,
              tone: 'warning' as const,
              icon: <TrendingUp className="size-4" />,
            },
            {
              label: '流失率',
              value: 1.24,
              decimals: 2,
              suffix: '%',
              trend: TREND_B,
              tone: 'danger' as const,
              icon: <ChartLine className="size-4" />,
            },
          ].map((item, index) => (
            <SpotlightCard
              key={item.label}
              className="n-rise p-3.5"
              style={{ animationDelay: `${index * 70}ms` }}
              color={`var(--n-chart-${index + 1})`}
            >
              <div className="flex items-center gap-2 text-xs text-fg-3">
                <span className="text-fg-3">{item.icon}</span>
                {item.label}
              </div>
              <div className="mt-2.5">
                <AnimatedNumber
                  value={item.value}
                  decimals={item.decimals}
                  prefix={item.prefix}
                  suffix={item.suffix}
                  duration={1300 + index * 100}
                  className="text-[1.5rem] font-semibold tracking-tight text-fg"
                />
              </div>
              <Sparkline
                data={item.trend}
                tone={item.tone}
                width={110}
                height={32}
                className="mt-2"
              />
            </SpotlightCard>
          ))}
        </Grid>
      </SectionCard>

      {/* 2. 流光边框 */}
      <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <BorderBeam>
          <div className="p-4">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <Zap className="size-4" />
              </span>
              <div>
                <p className="text-[0.8125rem] font-semibold text-fg">BorderBeam</p>
                <p className="text-2xs text-fg-3">流光边框</p>
              </div>
            </div>
            <p className="mt-2.5 text-xs leading-5 text-fg-3">
              用{' '}
              <code className="rounded bg-surface-2 px-1 font-mono text-2xs">conic-gradient</code> +{' '}
              <code className="rounded bg-surface-2 px-1 font-mono text-2xs">@property</code>{' '}
              让光束绕行， 适合「推荐套餐」「当前方案」这类需要聚焦的卡片。
            </p>
          </div>
        </BorderBeam>

        <BorderBeam duration={9} color="var(--n-chart-4)">
          <div className="p-4">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-[#7c3aed]/10 text-[#7c3aed]">
                <Star className="size-4" />
              </span>
              <div>
                <p className="text-[0.8125rem] font-semibold text-fg">可配色</p>
                <p className="text-2xs text-fg-3">color / duration</p>
              </div>
            </div>
            <p className="mt-2.5 text-xs leading-5 text-fg-3">
              传一个 CSS 变量即可换色，动画周期也可调；深色模式下光晕会自动更明显。
            </p>
          </div>
        </BorderBeam>

        <BorderBeam duration={12} color="var(--n-chart-2)">
          <div className="p-4">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-success/10 text-success">
                <Sparkles className="size-4" />
              </span>
              <div>
                <p className="text-[0.8125rem] font-semibold text-fg">性能友好</p>
                <p className="text-2xs text-fg-3">仅合成层动画</p>
              </div>
            </div>
            <p className="mt-2.5 text-xs leading-5 text-fg-3">
              只动{' '}
              <code className="rounded bg-surface-2 px-1 font-mono text-2xs">--beam-angle</code>，
              不触发 layout / paint，长列表里也能放心用。
            </p>
          </div>
        </BorderBeam>
      </div>

      {/* 3. 环形指标 + 渐变标题 */}
      <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <SectionCard title="RingMetric" description="环形指标：带渐变描边与入场动画">
          <div className="flex flex-wrap items-center justify-around gap-4 p-4">
            <RingMetric value={92.4} label="92.4%" sublabel="SLA 达成" tone="success" />
            <RingMetric value={68} label="68%" sublabel="配额使用" tone="primary" />
            <RingMetric value={34} label="34%" sublabel="风险敞口" tone="danger" size={112} />
          </div>
        </SectionCard>

        <SectionCard title="GradientText · ShortcutHint" description="渐变标题与键位提示">
          <div className="space-y-4 p-4">
            <div>
              <GradientText className="text-2xl font-semibold tracking-tight">
                用一套内核撑起整个后台
              </GradientText>
              <p className="mt-1 text-xs text-fg-3">
                渐变裁切自{' '}
                <code className="rounded bg-surface-2 px-1 font-mono text-2xs">bg-clip-text</code>，
                跟随强调色变化。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <ShortcutHint keys={['⌘', 'K']} action="打开命令面板" />
              <ShortcutHint keys={['Esc']} action="关闭弹层" />
              <ShortcutHint keys={['⌘', 'B']} action="折叠侧栏" />
            </div>
            <div className="rounded-lg border border-dashed border-line p-3">
              <GradientText direction="to-br" className="text-lg font-semibold">
                垂直渐变（to-br）
              </GradientText>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* 4. 跑马灯 */}
      <SectionCard className="mb-3" title="Marquee" description="跑马灯：hover 暂停，两侧自动渐隐">
        <div className="space-y-3 py-3">
          <Marquee speed={26}>
            {['实时告警', '订单风控', '权限审计', '数据看板', '内容审核', '组织同步'].map(
              (item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs whitespace-nowrap text-fg-2"
                >
                  <span className="size-1.5 rounded-full bg-primary" />
                  {item}
                </span>
              ),
            )}
          </Marquee>
          <Marquee speed={20} reverse>
            {['Nexus', 'Modular', 'Zero-dep', 'Type-safe', 'Fast', 'Open source'].map((item) => (
              <span key={item} className="text-sm font-semibold whitespace-nowrap text-fg-4">
                {item}
              </span>
            ))}
          </Marquee>
        </div>
      </SectionCard>

      {/* 5. 滑动标签 */}
      <SectionCard
        className="mb-3"
        title="SlidingTabs"
        description="滑动胶囊标签：指示器跟随选中项平移，比 SegmentedControl 更有质感"
        extra={
          <Badge tone="primary" size="sm">
            CSS 变量驱动
          </Badge>
        }
      >
        <div className="flex flex-wrap items-center gap-3 p-4">
          <SlidingTabs
            items={[
              { value: 'week', label: '本周' },
              { value: 'month', label: '本月' },
              { value: 'quarter', label: '本季度' },
            ]}
            value={tab}
            onChange={setTab}
          />
          <SlidingTabs
            size="sm"
            items={[
              { value: 'week', label: '7 天' },
              { value: 'month', label: '30 天' },
              { value: 'quarter', label: '90 天' },
            ]}
            value={tab}
            onChange={setTab}
          />
          <span className="text-xs text-fg-3">当前选择：{tab}</span>
        </div>
      </SectionCard>

      {/* 6. 代码 */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SectionCard title="用法示例" description="全部从 @nexus/ui 导入">
          <div className="p-3">
            <CodeBlock
              language="tsx"
              filename="任意页面"
              maxHeight={280}
              code={`import {
  AnimatedNumber, SpotlightCard, BorderBeam,
  GradientText, Marquee, SlidingTabs,
  RingMetric, Sparkline, ShortcutHint,
} from '@nexus/ui'

<SpotlightCard color="var(--n-chart-3)">
  <AnimatedNumber value={8642300} prefix="¥ " />
  <Sparkline data={trend} tone="success" />
</SpotlightCard>

<BorderBeam duration={8}>
  <div className="p-4">推荐方案</div>
</BorderBeam>

<RingMetric value={92.4} label="92.4%" sublabel="SLA" tone="success" />`}
            />
          </div>
        </SectionCard>

        <SectionCard title="实现要点" description="为什么不用动画库">
          <div className="space-y-2.5 p-3 text-xs leading-5 text-fg-3">
            <p>
              <strong className="text-fg">1. 零依赖。</strong>
              动画库通常 30–60 kB，而这里每个效果不到 1 kB，且可被 tree-shaking。
            </p>
            <p>
              <strong className="text-fg">2. 不在渲染期读时间。</strong>
              数字滚动用{' '}
              <code className="rounded bg-surface-2 px-1 font-mono text-2xs">
                requestAnimationFrame
              </code>{' '}
              在 effect 中驱动，避免 React Compiler 的 purity 检查告警。
            </p>
            <p>
              <strong className="text-fg">3. 可关停，且与 CSS 同步。</strong>
              所有动画都读同一个开关：
              <code className="rounded bg-surface-2 px-1 font-mono text-2xs">
                data-motion=&quot;full|reduced&quot;
              </code>{' '}
              优先，未设置时跟随{' '}
              <code className="rounded bg-surface-2 px-1 font-mono text-2xs">
                prefers-reduced-motion
              </code>
              。关掉后数字直接落在终值、环形指标一步到位，不会停在滚动中途。
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="secondary" onClick={() => setDemoKey((k) => k + 1)}>
                重播入场
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const root = document.documentElement
                  root.dataset.motion = root.dataset.motion === 'full' ? 'reduced' : 'full'
                  toast.info(
                    root.dataset.motion === 'full'
                      ? '已切换 data-motion=full：数字会递增滚动'
                      : '已切换 data-motion=reduced：数字直接落终值',
                  )
                }}
              >
                切换动效开关
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  document.documentElement.classList.toggle('dark')
                  toast.info('已切换主题，观察配色联动')
                }}
              >
                切换主题验证
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>

      <Card className="mt-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-fg-3">
          <Badge tone="success">提示</Badge>
          这些组件在「经营概览」顶部 KPI 区已经实际使用（
          <code className="rounded bg-surface-2 px-1 font-mono">
            AnimatedNumber + SpotlightCard + Sparkline
          </code>
          ），可作为真实业务的落地参考。
        </div>
      </Card>
    </PageContainer>
  )
}
