import {
  ArrowUpRight,
  Bot,
  FolderOpen,
  GanttChartSquare,
  Images,
  Infinity as InfinityIcon,
  KanbanSquare,
  LayoutDashboard,
  MonitorPlay,
  RectangleHorizontal,
  Sparkles,
  Workflow,
} from 'lucide-react'
import {
  Badge,
  Button,
  Grid,
  MotionCard,
  PageContainer,
  PageHeader,
  SectionCard,
  StatCard,
  cn,
} from '@nexus/ui'
import { BANNER_IMAGES } from '@/assets/banners'
import { useAppNavigate } from '@/components/app-link'
import type { MotionEffect, MotionTone } from '@nexus/ui'

/**
 * 模板中心总览
 *
 * 设计意图：一屏之内说清「有什么、解决什么问题、用了哪些能力」，
 * 点卡片直接进对应页面，避免在侧边栏里逐个试。
 *
 * 本轮改造：卡片从静止的 `Card` 换成 `MotionCard`，
 * 每张卡按位置轮流分配一种低干扰动效（抬升 / 光斑 / 倾斜 / 掠光 / 极光），
 * 既让列表有「活着」的手感，又不会五张卡同时晃 —— 同一行最多两种动效。
 */

interface TemplateMeta {
  path: string
  title: string
  subtitle: string
  icon: typeof MonitorPlay
  tone: MotionTone
  tags: string[]
  /** 页面里解决了哪些「不好做」的部分 */
  highlights: string[]
  /** 依赖的组件库能力，用来说明「这些能力已经内建」 */
  uses: string[]
  /** 卡片动效（缺省按索引轮转） */
  effect?: MotionEffect
  /** 卡片顶部插画（有则替代图标） */
  image?: keyof typeof BANNER_IMAGES
}

const TEMPLATES: TemplateMeta[] = [
  {
    path: '/templates/banner',
    title: '横幅模板（6 种色调 × 3 种模式）',
    subtitle: '一句标题 + 一段说明 + 一个按钮 + 一张插画，页面顶部的区块级版式',
    icon: RectangleHorizontal,
    tone: 'primary',
    tags: ['区块级', '6 色调', '3 模式', '插画'],
    highlights: [
      'soft / glass / solid 三种模式，换模式不用改任何样式',
      '色调全部取自主题图表色板，自动跟随皮肤与深浅色',
      '透明底 3D 插画，窄屏自动收起而不是压扁',
    ],
    uses: ['HeroBanner', 'BannerCard', 'SegmentedControl', 'Button'],
    effect: 'aurora',
    image: 'rocket',
  },
  {
    path: '/templates/screens',
    title: '数据大屏（8 种风格）',
    subtitle: '运营 / 运维 / 财务 / 仓储 / 城市 / 制造 / 大促 / 算力，每块屏适配不同业务系统',
    icon: MonitorPlay,
    tone: 'rose',
    tags: ['全屏', '新标签页', '8 种风格'],
    highlights: [
      '极简暗色、运维终端、财务纸感、物流墨绿、城市网格、车间仪表、战报红金、算力卡阵',
      '每块屏有独立的配色与图表语言，不是换皮',
      '点击即在新标签页打开，不占用工作页签',
    ],
    uses: ['EChart', '中国地图', 'Gauge', 'Radar', 'ScreenShell'],
    effect: 'spotlight',
    image: 'welcomeDashboard',
  },
  {
    path: '/templates/gantt',
    title: '甘特图排期',
    subtitle: '多任务跨月排期，拖拽调整时间窗',
    icon: GanttChartSquare,
    tone: 'primary',
    tags: ['时间轴', '拖拽', '依赖'],
    highlights: ['今天指示线自动定位', '任务条按状态着色', '周/月切换与横向滚动同步'],
    uses: ['Tooltip', 'SegmentedControl', 'Badge', 'Progress'],
    effect: 'tilt',
  },
  {
    path: '/templates/kanban',
    title: '项目看板',
    subtitle: '看板式任务流转，拖拽改状态',
    icon: KanbanSquare,
    tone: 'success',
    tags: ['拖拽', '状态机', 'WIP 限制'],
    highlights: ['原生 HTML5 拖拽，零依赖', '列内 WIP 超限自动告警', '拖拽时的落点高亮'],
    uses: ['Avatar', 'Badge', 'Tag', 'Dropdown', 'SpotlightCard'],
    effect: 'lift',
  },
  {
    path: '/templates/workflow',
    title: '工作流设计器',
    subtitle: '节点编排、连线与属性面板',
    icon: Workflow,
    tone: 'warning',
    tags: ['画布', '连线', '属性面板'],
    highlights: ['SVG 贝塞尔连线自动避让', '节点拖拽与选中态', '右侧属性面板联动编辑'],
    uses: ['Drawer', 'FormField', 'Select', 'Switch', 'Descriptions'],
    effect: 'sweep',
  },
  {
    path: '/templates/infinite-canvas',
    title: '无限画布',
    subtitle: '文本 / 图片 / 视频节点 + 节点级 AI 对话 + 自研相机内核',
    icon: InfinityIcon,
    tone: 'violet',
    tags: ['无限画布', '视口剔除', 'AI 节点'],
    highlights: [
      '相机、剔除、连线、吸附全部自研，零第三方画布依赖',
      '手势期间只写 transform，1,000 节点仍可满帧平移',
      '点节点就地唤起 AI 对话，回答可写回或另存为子节点',
    ],
    uses: ['InfiniteCanvas', 'CanvasNodeFrame', 'CanvasAIPopover', 'CanvasMinimap'],
    effect: 'aurora',
    image: 'toolbox',
  },
  {
    path: '/templates/ai-chat',
    title: 'AI 助手对话',
    subtitle: '流式输出、引用来源与指令面板',
    icon: Bot,
    tone: 'cyan',
    tags: ['流式', 'Markdown', '会话'],
    highlights: ['逐字流式渲染，含停止生成', '消息引用来源可展开', '指令模板一键填充'],
    uses: ['CodeBlock', 'HighlightText', 'Kbd', 'Drawer', 'Textarea'],
    effect: 'spotlight',
  },
  {
    path: '/templates/files',
    title: '文件管理器',
    subtitle: '网格/列表切换、拖入上传、预览面板',
    icon: FolderOpen,
    tone: 'primary',
    tags: ['拖拽上传', '预览', '面包屑'],
    highlights: ['拖拽区实时反馈', '网格/列表双视图', '侧栏预览与元信息'],
    uses: ['UploadList', 'Breadcrumb', 'Tree', 'EmptyState', 'DataTable'],
    effect: 'lift',
    image: 'chartReport',
  },
  {
    path: '/templates/media-workbench',
    title: '资源与编辑器',
    subtitle: '图片 / 视频 / 音频显示类型 + 图片、文本、代码、视频四种编辑器',
    icon: Images,
    tone: 'violet',
    tags: ['资源显示', '四种编辑器', '工作台'],
    highlights: [
      '三种资源共用一张卡片，混排时基线不歪',
      '点资源即切到对应编辑器，真正可调的参数',
      '视频时间轴可拆分镜头，音频点击波形试听',
    ],
    uses: ['MediaCard', 'ImageEditor', 'TextEditor', 'CodeEditor', 'VideoEditor'],
    effect: 'sweep',
  },
]

export default function TemplatesOverviewPage() {
  const navigate = useAppNavigate()

  return (
    <PageContainer size="lg">
      <PageHeader
        title="模板中心"
        description="8 块风格各异的大屏 + 8 个业务页面骨架，全部可直接复制走用"
        badge={<Badge tone="primary">Templates</Badge>}
        actions={
          <Button
            variant="primary"
            rightIcon={<ArrowUpRight className="size-3.5" />}
            onClick={() => navigate('/templates/screens')}
          >
            从大屏开始看
          </Button>
        }
      />

      <Grid cols={4} gap="md" className="mb-3">
        <StatCard
          label="业务模板"
          value="8"
          suffix="种"
          tone="primary"
          icon={<LayoutDashboard className="size-4" />}
        />
        <StatCard label="数据大屏" value="8" suffix="块" tone="success" />
        <StatCard label="复用组件" value="60" suffix="+" tone="warning" />
        <StatCard label="第三方 UI 依赖" value="0" suffix="个" tone="danger" />
      </Grid>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {TEMPLATES.map((item, index) => (
          <MotionCard
            key={item.path}
            index={index}
            effect={item.effect ?? 'lift'}
            tone={item.tone}
            onClick={() => navigate(item.path)}
            className="p-4"
          >
            <div className="flex items-start gap-3">
              {item.image ? (
                <img
                  src={BANNER_IMAGES[item.image]}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  width={48}
                  height={48}
                  className="size-12 shrink-0 object-contain transition-transform duration-500 group-hover:scale-[1.08] group-hover:-rotate-3"
                />
              ) : (
                <span
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-lg',
                    'bg-[color-mix(in_oklab,var(--mc-accent)_14%,transparent)] text-[var(--mc-accent)]',
                  )}
                >
                  <item.icon className="size-4.5" strokeWidth={1.9} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-[0.8125rem] font-semibold text-fg">{item.title}</h3>
                  <ArrowUpRight className="size-3.5 shrink-0 text-fg-4 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <p className="mt-0.5 text-xs text-fg-3">{item.subtitle}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-sm bg-surface-2 px-1.5 py-0.5 text-2xs text-fg-3"
                >
                  {tag}
                </span>
              ))}
            </div>

            <ul className="space-y-1 text-xs text-fg-2">
              {item.highlights.map((line) => (
                <li key={line} className="flex items-start gap-1.5">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--mc-accent)] opacity-70" />
                  <span className="min-w-0">{line}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto border-t border-line-subtle pt-2">
              <p className="text-2xs text-fg-4">
                使用：
                <span className="text-fg-3">{item.uses.join(' · ')}</span>
              </p>
            </div>
          </MotionCard>
        ))}
      </div>

      {/* --------------------- 动效说明 --------------------- */}
      <SectionCard
        className="mt-3"
        title="这些卡片用到的动效"
        description="全部由 @nexus/ui 的 MotionCard 提供，指针驱动、零依赖、减少动效即全关"
        extra={
          <Button
            size="xs"
            variant="ghost"
            rightIcon={<ArrowUpRight className="size-3" />}
            onClick={() => navigate('/components/overview')}
          >
            组件橱窗
          </Button>
        }
        bodyClassName="px-4 pb-4 pt-3"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { effect: 'aurora' as const, label: '极光', hint: '两层同色调光团 14s / 18s 反向漂移' },
            {
              effect: 'spotlight' as const,
              label: '光斑',
              hint: '指针坐标只写 CSS 变量，不重渲染',
            },
            { effect: 'tilt' as const, label: '倾斜', hint: '最大 6°，超过就会有「在晃」的观感' },
            { effect: 'sweep' as const, label: '掠光', hint: '7.2s 一次，悬停加速到 2.6s' },
          ].map((item, index) => (
            <div
              key={item.effect}
              className="rounded-md border border-line bg-surface-2/40 px-3 py-2.5"
            >
              <p className="flex items-center gap-1.5 text-xs font-medium text-fg">
                <Sparkles className="size-3 text-primary" />
                {item.label}
                <code className="ml-auto font-mono text-2xs text-fg-4">{item.effect}</code>
              </p>
              <p className="mt-1 text-2xs leading-5 text-fg-3">{item.hint}</p>
              <p className="mt-1 text-[0.625rem] text-fg-4">第 {index + 1} 张卡在用</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard className="mt-3" title="怎么用这些模板" description="模板是源码，不是配置项">
        <ol className="space-y-2 p-4 text-[0.8125rem] leading-6 text-fg-2">
          <li>
            <span className="mr-1.5 font-semibold text-fg">1.</span>
            打开任意模板页，源码位于{' '}
            <code className="rounded bg-surface-2 px-1 font-mono text-xs">
              src/modules/templates/pages/
            </code>
          </li>
          <li>
            <span className="mr-1.5 font-semibold text-fg">2.</span>
            把整个文件复制到你的模块目录，改一下{' '}
            <code className="rounded bg-surface-2 px-1 font-mono text-xs">module.ts</code> 里的路由
          </li>
          <li>
            <span className="mr-1.5 font-semibold text-fg">3.</span>
            数据层用{' '}
            <code className="rounded bg-surface-2 px-1 font-mono text-xs">
              services/queries.ts
            </code>{' '}
            的 hook 替换常量即可
          </li>
        </ol>
      </SectionCard>
    </PageContainer>
  )
}
