import { useState } from 'react'
import {
  ArrowRight,
  CircleCheck,
  Copy,
  Download,
  House,
  Mail,
  Settings,
  Sparkles,
  Workflow,
} from 'lucide-react'
import {
  AnimatedNumber,
  BorderBeam,
  Breadcrumb,
  Button,
  ClipboardText,
  CodeBlock,
  Collapse,
  CopyButton,
  Descriptions,
  Dropdown,
  GradientText,
  Grid,
  HighlightText,
  Inline,
  Marquee,
  PageHeader,
  Progress,
  RingMetric,
  SearchInput,
  ShortcutHint,
  SideTabs,
  SlidingTabs,
  Sparkline,
  SpotlightCard,
  Stack,
  StatCard,
  Steps,
  Tabs,
  formatCompact,
  formatNumber,
  formatPercent,
  toast,
} from '@nexus/ui'
import type { GalleryCategory } from './types'

/* ================= 导航 ================= */

function TabsDemo() {
  const [tab, setTab] = useState('basic')
  return (
    <Tabs
      variant="line"
      value={tab}
      onChange={setTab}
      items={[
        { key: 'basic', label: '基本信息' },
        { key: 'log', label: '操作日志' },
        { key: 'perm', label: '权限' },
      ]}
      extra={
        <Button size="xs" variant="secondary">
          导出
        </Button>
      }
    />
  )
}

function TabsVariantsDemo() {
  return (
    <div className="w-full space-y-3">
      <Tabs
        variant="pill"
        defaultValue="a"
        items={[
          { key: 'a', label: '全部' },
          { key: 'b', label: '待处理' },
          { key: 'c', label: '已完成' },
        ]}
      />
      <Tabs
        variant="card"
        defaultValue="x"
        items={[
          { key: 'x', label: '日' },
          { key: 'y', label: '周' },
          { key: 'z', label: '月' },
        ]}
      />
    </div>
  )
}

function SideTabsDemo() {
  const [value, setValue] = useState('general')
  return (
    <div className="w-[10rem]">
      <SideTabs
        value={value}
        onChange={setValue}
        items={[
          { key: 'general', label: '通用', icon: <Settings className="size-3.5" /> },
          { key: 'notify', label: '通知', icon: <Mail className="size-3.5" /> },
          { key: 'advanced', label: '高级', icon: <Sparkles className="size-3.5" /> },
        ]}
      />
    </div>
  )
}

function BreadcrumbDemo() {
  return (
    <div className="w-full space-y-2">
      <Breadcrumb
        items={[
          { label: '工作台', icon: <House className="size-3" /> },
          { label: '业务管理' },
          { label: '用户管理' },
          { label: '陈彦之' },
        ]}
      />
      <Breadcrumb
        maxItems={3}
        items={[
          { label: '工作台' },
          { label: '业务管理' },
          { label: '用户管理' },
          { label: '订单' },
          { label: 'NO-8421' },
        ]}
      />
    </div>
  )
}

function StepsDemo() {
  const [current, setCurrent] = useState(1)
  return (
    <div className="w-full space-y-3">
      <Steps
        current={current}
        onChange={setCurrent}
        items={[
          { title: '填写信息', description: '基础资料' },
          { title: '确认配置', description: '核对资源与权限' },
          { title: '完成', description: '等待生效' },
        ]}
      />
      <p className="text-2xs text-fg-4">点击步骤圆圈可切换；current 同时驱动完成态与连线颜色。</p>
    </div>
  )
}

function StepsVerticalDemo() {
  return (
    <Steps
      direction="vertical"
      current={2}
      items={[
        { title: '拉取镜像', description: '已完成', status: 'finish' },
        { title: '健康检查', description: '已完成', status: 'finish' },
        { title: '切换流量', description: '失败：上游超时', status: 'error' },
        { title: '回滚', description: '等待触发' },
      ]}
    />
  )
}

function CollapseDemo() {
  return (
    <div className="w-full">
      <Collapse
        accordion
        defaultValue={['network']}
        items={[
          {
            key: 'network',
            title: '网络配置',
            extra: <span className="text-2xs text-fg-4">3 项</span>,
            content: <p>带宽 100 Mbps，出入方向均不限速；已开启 IPv6。</p>,
          },
          { key: 'storage', title: '存储配置', content: <p>SSD 500 GB，快照保留 7 天。</p> },
          { key: 'security', title: '安全策略', content: <p>开启 MFA、登录地限制与操作审计。</p> },
        ]}
      />
    </div>
  )
}

function DropdownNavDemo() {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        rightIcon={<ArrowRight className="size-3.5" />}
        onClick={() => toast.info('跳转到文档')}
      >
        使用文档
      </Button>
      <Dropdown
        trigger={
          <Button size="sm" variant="ghost">
            语言
          </Button>
        }
        items={[
          { key: 'zh', label: '简体中文', hint: '默认' },
          { key: 'en', label: 'English' },
          'divider',
          { key: 'other', label: '更多语言…', disabled: true },
        ]}
      />
    </div>
  )
}

/** PageHeader 需要页级宽度：这里放在一个模拟容器里，避免撑破卡片 */
function PageHeaderDemo() {
  return (
    <div className="pointer-events-none w-full overflow-hidden rounded-md border border-line">
      <PageHeader
        title="用户管理"
        description="管理组织成员、角色分配与账号安全状态"
        badge={<span className="rounded-sm bg-primary-weak px-1.5 text-2xs text-primary">128</span>}
        breadcrumb={
          <Breadcrumb items={[{ label: '工作台' }, { label: '业务管理' }, { label: '用户管理' }]} />
        }
        actions={
          <>
            <Button size="sm" variant="secondary">
              导出
            </Button>
            <Button size="sm" variant="primary">
              新建用户
            </Button>
          </>
        }
      />
    </div>
  )
}

export const navigationCategory: GalleryCategory = {
  id: 'navigation',
  name: 'Navigation',
  title: '导航组件',
  description: '页签、面包屑、步骤与折叠面板：告诉用户「我在哪、下一步是什么」',
  items: [
    {
      key: 'tabs',
      name: 'Tabs',
      nameZh: '标签页',
      summary: 'line / pill / enclosed / card 四种形态，键盘左右可切换',
      demo: TabsDemo,
      wide: true,
      previewHeight: 120,
      keywords: ['yeqian', 'tabs'],
      code: `<Tabs
  variant="line"
  value={tab}
  onChange={setTab}
  items={[{ key: 'basic', label: '基本信息' }, { key: 'log', label: '操作日志' }]}
/>`,
      props: [
        {
          name: 'items',
          type: '{ key; label: ReactNode; icon?; badge?; disabled?; content? }[]',
          desc: '标签项（必填）',
        },
        {
          name: 'variant',
          type: "'line' | 'pill' | 'enclosed' | 'card'",
          default: "'line'",
          desc: '形态',
        },
        { name: 'value / onChange', type: 'string / (key: string) => void', desc: '受控用法' },
        { name: 'extra', type: 'ReactNode', desc: '右侧操作区' },
      ],
    },
    {
      key: 'tabs-variants',
      name: 'Tabs · 变体',
      nameZh: '胶囊 / 卡片页签',
      summary: 'pill 用于同一数据的视图切换，card 用于弱化的分类筛选',
      demo: TabsVariantsDemo,
      wide: true,
      previewHeight: 130,
      keywords: ['jiaonang', 'pill'],
      code: `<Tabs variant="pill" defaultValue="a" items={[{ key: 'a', label: '全部' }]} />
<Tabs variant="card" defaultValue="x" items={[{ key: 'x', label: '日' }]} />`,
    },
    {
      key: 'side-tabs',
      name: 'SideTabs',
      nameZh: '侧边标签',
      summary: '设置页左栏的垂直导航，只负责高亮与切换',
      demo: SideTabsDemo,
      keywords: ['cedan', 'side tabs'],
      code: `<SideTabs
  value={value}
  onChange={setValue}
  items={[{ key: 'general', label: '通用', icon: <Settings className="size-3.5" /> }]}
/>`,
      props: [
        { name: 'items / value / onChange', type: '必填', desc: '三项均必填' },
        { name: 'items[].icon', type: 'ReactNode', desc: '前缀图标' },
      ],
    },
    {
      key: 'breadcrumb',
      name: 'Breadcrumb',
      nameZh: '面包屑',
      summary: '超过 maxItems 自动折叠中间层级，点「…」展开',
      demo: BreadcrumbDemo,
      wide: true,
      keywords: ['mianbaoxie', 'breadcrumb'],
      code: `<Breadcrumb items={[{ label: '工作台' }, { label: '业务管理' }, { label: '用户管理' }]} />`,
      props: [
        {
          name: 'items',
          type: '{ label: ReactNode; href?; onClick?; icon? }[]',
          desc: '层级（必填）',
        },
        { name: 'maxItems', type: 'number', default: '4', desc: '超出的折叠阈值' },
        { name: 'separator', type: 'ReactNode', desc: '自定义分隔符' },
      ],
    },
    {
      key: 'steps',
      name: 'Steps',
      nameZh: '步骤条',
      summary: '横向流程指引，current 与 status 分别控制进度与异常',
      demo: StepsDemo,
      wide: true,
      keywords: ['buzhou', 'steps'],
      code: `<Steps
  current={current}
  onChange={setCurrent}
  items={[{ title: '填写信息' }, { title: '确认配置' }, { title: '完成' }]}
/>`,
      props: [
        {
          name: 'items',
          type: '{ title; description?; status?; icon? }[]',
          desc: '步骤（必填，用下标做 key）',
        },
        { name: 'current', type: 'number', default: '0', desc: '当前步序号' },
        { name: 'status', type: "'process' | 'error'", desc: '当前步状态' },
        { name: 'direction', type: "'horizontal' | 'vertical'", desc: '排列方向' },
      ],
    },
    {
      key: 'steps-vertical',
      name: 'Steps · 纵向',
      nameZh: '纵向步骤 / 失败态',
      summary: '部署流水线与审批记录常用纵向形态，可单独标 error',
      demo: StepsVerticalDemo,
      previewHeight: 200,
      keywords: ['zongxiang', 'failed'],
      code: `<Steps
  direction="vertical"
  current={2}
  items={[
    { title: '拉取镜像', status: 'finish' },
    { title: '切换流量', status: 'error', description: '失败：上游超时' },
  ]}
/>`,
    },
    {
      key: 'collapse',
      name: 'Collapse',
      nameZh: '折叠面板',
      summary: 'accordion 手风琴模式，适合长表单的分段收纳',
      demo: CollapseDemo,
      wide: true,
      keywords: ['zhedie', 'collapse', 'accordion'],
      code: `<Collapse
  accordion
  defaultValue={['network']}
  items={[{ key: 'network', title: '网络配置', content: <p>…</p> }]}
/>`,
      props: [
        {
          name: 'items',
          type: '{ key; title; content: ReactNode; extra? }[]',
          desc: '面板（必填）',
        },
        { name: 'accordion', type: 'boolean', desc: '同时只展开一个' },
        { name: 'defaultValue / value', type: 'string[]', desc: '默认 / 受控展开项' },
      ],
    },
    {
      key: 'dropdown-nav',
      name: 'Dropdown · 导航',
      nameZh: '下拉导航',
      summary: '语言、主题这类轻量切换，用 hint 承载当前值',
      demo: DropdownNavDemo,
      keywords: ['daohang', 'nav dropdown'],
      code: `<Dropdown
  trigger={<Button size="sm">语言</Button>}
  items={[{ key: 'zh', label: '简体中文', hint: '默认' }, { key: 'en', label: 'English' }]}
/>`,
    },
    {
      key: 'page-header',
      name: 'PageHeader',
      nameZh: '页面头',
      summary: '标题 / 说明 / 面包屑 / 右侧操作四件套，页面骨架的第一行',
      demo: PageHeaderDemo,
      wide: true,
      previewHeight: 160,
      keywords: ['yetou', 'header'],
      code: `<PageHeader
  title="用户管理"
  description="管理组织成员与账号安全状态"
  breadcrumb={<Breadcrumb items={items} />}
  actions={<Button variant="primary">新建用户</Button>}
/>`,
      props: [
        { name: 'title', type: 'ReactNode', desc: '标题（必填）' },
        { name: 'description / badge', type: 'ReactNode', desc: '说明与标题后的徽标' },
        { name: 'actions', type: 'ReactNode', desc: '右侧操作（不是 extra）' },
        { name: 'breadcrumb / footer', type: 'ReactNode', desc: '上方面包屑与下方附属区' },
      ],
    },
  ],
}

/* ================= 布局 ================= */

function LayoutDemo() {
  return (
    <div className="w-full space-y-3">
      <Grid cols={4} gap="sm">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="grid h-14 place-items-center rounded-md border border-dashed border-line text-2xs text-fg-4"
          >
            Grid {index + 1}
          </div>
        ))}
      </Grid>
      <Stack gap="sm">
        <div className="h-6 rounded-sm bg-surface-2" />
        <div className="h-6 rounded-sm bg-surface-2" />
      </Stack>
      <Inline gap="sm">
        <span className="rounded-sm bg-surface-2 px-2 py-1 text-2xs text-fg-3">Inline</span>
        <span className="rounded-sm bg-surface-2 px-2 py-1 text-2xs text-fg-3">自动换行</span>
        <span className="rounded-sm bg-surface-2 px-2 py-1 text-2xs text-fg-3">gap=sm</span>
      </Inline>
    </div>
  )
}

function PageContainerDemo() {
  const [size, setSize] = useState<'sm' | 'md' | 'lg'>('md')
  return (
    <div className="w-full space-y-2">
      <Tabs
        size="sm"
        variant="pill"
        value={size}
        onChange={(key) => setSize(key as 'sm' | 'md' | 'lg')}
        items={[
          { key: 'sm', label: 'sm · 55rem' },
          { key: 'md', label: 'md · 73.75rem' },
          { key: 'lg', label: 'lg · 93.75rem' },
        ]}
      />
      <div className="overflow-hidden rounded-md border border-line bg-surface-2 p-1">
        <div
          className="rounded-sm bg-primary-weak/60 px-2 py-3 text-center text-2xs text-primary"
          style={{
            maxWidth: size === 'sm' ? '60%' : size === 'md' ? '80%' : '100%',
            marginInline: 'auto',
          }}
        >
          PageContainer size=&quot;{size}&quot;
        </div>
      </div>
    </div>
  )
}

function StatCardRowDemo() {
  return (
    <Grid cols={4} gap="sm">
      <StatCard label="营收" value={formatCompact(8642300)} delta={12.4} />
      <StatCard label="用户" value={formatNumber(128460)} delta={8.2} tone="success" />
      <StatCard label="转化" value={formatPercent(4.68)} delta={-1.2} tone="warning" />
      <StatCard label="告警" value="12" delta={0} tone="danger" />
    </Grid>
  )
}

export const layoutCategory: GalleryCategory = {
  id: 'layout',
  name: 'Layout',
  title: '布局组件',
  description: '栅格、堆叠与页面容器：让留白和节奏保持一致',
  items: [
    {
      key: 'grid',
      name: 'Grid / Stack / Inline',
      nameZh: '栅格 / 堆叠 / 水平',
      summary: '三个原子布局，覆盖后台 90% 的排列需求',
      demo: LayoutDemo,
      wide: true,
      previewHeight: 210,
      keywords: ['zhage', 'grid', 'layout'],
      code: `<Grid cols={4} gap="sm">{cells}</Grid>
<Stack gap="sm">{rows}</Stack>
<Inline gap="sm">{chips}</Inline>`,
      props: [
        {
          name: 'Grid cols',
          type: '1 | 2 | 3 | 4 | 5 | 6',
          default: '2',
          desc: '列数（自带响应式断点）',
        },
        { name: 'gap', type: "'sm' | 'md' | 'lg'", desc: '间距档位' },
        { name: 'Inline.wrap', type: 'boolean', default: 'true', desc: '是否允许换行' },
      ],
    },
    {
      key: 'page-container',
      name: 'PageContainer',
      nameZh: '页面容器',
      summary: '统一左右留白与最大宽度，页面内容不必各写一份',
      demo: PageContainerDemo,
      wide: true,
      keywords: ['rongqi', 'container'],
      code: `<PageContainer size="md">{page}</PageContainer>`,
      props: [
        {
          name: 'size',
          type: "'sm' | 'md' | 'lg' | 'full'",
          default: "'lg'",
          desc: '880 / 1180 / 1500 / 无上限',
        },
      ],
    },
    {
      key: 'stat-card-row',
      name: 'StatCard 行',
      nameZh: '指标行',
      summary: 'KPI 区固定写法：Grid cols=4 + StatCard',
      demo: StatCardRowDemo,
      wide: true,
      previewHeight: 180,
      keywords: ['zhibiao hang'],
      code: `<Grid cols={4} gap="sm">
  <StatCard label="营收" value={formatCompact(8642300)} delta={12.4} />
</Grid>`,
    },
  ],
}

/* ================= 工具 ================= */

function CodeBlockDemo() {
  return (
    <CodeBlock
      filename="pages/demo.tsx"
      language="tsx"
      maxHeight={200}
      code={`export function Demo() {
  return (
    <Button variant="primary" onClick={() => save()}>
      保存
    </Button>
  )
}`}
    />
  )
}

function ClipboardDemo() {
  return (
    <div className="w-full space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <ClipboardText value="nexus_prod_sk_4f2a9c8e71b3d6f0a1b2c3d4e5f6" truncate={36} />
        <CopyButton value="pnpm add @nexus/ui" label="复制安装命令" />
        <CopyButton value="https://nexus.dev" iconOnly />
      </div>
      <Descriptions
        size="sm"
        columns={1}
        items={[
          { label: '密钥', value: 'sk_live_4f2a9c8e71b3', copyable: true },
          { label: '实例 ID', value: 'nexus-8f2a9c', copyable: true },
        ]}
      />
    </div>
  )
}

function HighlightDemo() {
  const [keyword, setKeyword] = useState('用户')
  return (
    <div className="w-full space-y-2">
      <SearchInput value={keyword} onChange={setKeyword} placeholder="输入关键字高亮" size="sm" />
      {['用户管理', '用户增长分析', '订单与用户关联', '系统设置'].map((item) => (
        <p key={item} className="rounded-sm bg-surface-2 px-2 py-1.5 text-xs text-fg-2">
          <HighlightText text={item} keyword={keyword} />
        </p>
      ))}
    </div>
  )
}

function FormatDemo() {
  const rows = [
    ['formatNumber', formatNumber(128460)],
    ['formatCompact', formatCompact(128460)],
    ['formatPercent', formatPercent(4.6832)],
    ['formatCurrency', '¥ 8,642,300.50'],
    ['formatBytes', '1.00 GB'],
    ['formatRelativeTime', '3 分钟前'],
  ]
  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3">
      {rows.map(([name, value]) => (
        <div key={name} className="rounded-md border border-line p-2">
          <p className="font-mono text-2xs text-fg-4">{name}</p>
          <p className="mt-0.5 truncate text-[0.8125rem] text-fg tabular-nums">{value}</p>
        </div>
      ))}
    </div>
  )
}

function ShortcutDemo() {
  return (
    <div className="flex flex-col gap-2">
      <ShortcutHint keys={['⌘', 'K']} action="打开命令面板" />
      <ShortcutHint keys={['⌘', 'B']} action="折叠侧边栏" />
      <ShortcutHint keys={['↵']} action="确认当前项" />
    </div>
  )
}

export const toolCategory: GalleryCategory = {
  id: 'tool',
  name: 'Utility',
  title: '工具与函数',
  description: '复制、代码块、高亮与格式化：后台里的「小而常」能力',
  items: [
    {
      key: 'code-block',
      name: 'CodeBlock',
      nameZh: '代码块',
      summary: '内置轻量高亮（TS / JSX / JSON / Bash），不必引 highlight.js',
      demo: CodeBlockDemo,
      wide: true,
      previewHeight: 240,
      keywords: ['daima', 'code'],
      code: `<CodeBlock filename="pages/demo.tsx" language="tsx" code={source} maxHeight={200} />`,
      props: [
        { name: 'code', type: 'string', desc: '源码（必填）' },
        { name: 'language', type: 'string', default: "'tsx'", desc: '决定高亮规则' },
        { name: 'filename', type: 'string', desc: '顶栏文案' },
        { name: 'showLineNumbers', type: 'boolean', default: 'true', desc: '行号' },
      ],
    },
    {
      key: 'clipboard',
      name: 'CopyButton / ClipboardText',
      nameZh: '复制',
      summary: '复制成功自反馈，非安全上下文也能用',
      demo: ClipboardDemo,
      wide: true,
      previewHeight: 200,
      keywords: ['fuzhi', 'clipboard', 'copy'],
      code: `<ClipboardText value={secret} truncate={36} />
<CopyButton value="pnpm add @nexus/ui" label="复制安装命令" />`,
      props: [
        { name: 'value', type: 'string', desc: '复制内容（必填）' },
        { name: 'label', type: 'string', desc: '按钮文案' },
        { name: 'iconOnly', type: 'boolean', desc: '只显示图标' },
        { name: 'truncate', type: 'number', default: '40', desc: 'ClipboardText 截断长度' },
      ],
    },
    {
      key: 'highlight',
      name: 'HighlightText / SearchInput',
      nameZh: '关键词高亮 / 搜索框',
      summary: '搜索结果中把命中词包成 mark，视觉上一眼可见',
      demo: HighlightDemo,
      wide: true,
      previewHeight: 220,
      keywords: ['gaoliang', 'search'],
      code: `<SearchInput value={keyword} onChange={setKeyword} size="sm" />
<HighlightText text="用户管理" keyword={keyword} />`,
      props: [
        { name: 'text / keyword', type: 'string', desc: '两者必填' },
        {
          name: 'SearchInput value / onChange',
          type: '必填（纯受控）',
          desc: 'Esc 清空，回车触发 onSubmit',
        },
      ],
    },
    {
      key: 'format',
      name: 'format*',
      nameZh: '格式化函数',
      summary: '数字、百分比、货币、字节与相对时间的统一口径',
      demo: FormatDemo,
      wide: true,
      previewHeight: 210,
      keywords: ['geshihua', 'format'],
      code: `formatNumber(128460)      // 128,460
formatCompact(128460)     // 12.8万
formatPercent(4.6832)     // 4.68%
formatBytes(1073741824)   // 1.00 GB`,
    },
    {
      key: 'shortcut-hint',
      name: 'ShortcutHint',
      nameZh: '快捷键提示',
      summary: '键位 + 说明的组合，代码块与空态旁的常客',
      demo: ShortcutDemo,
      previewHeight: 150,
      keywords: ['kuaijiejian', 'shortcut'],
      code: `<ShortcutHint keys={['⌘', 'K']} action="打开命令面板" />`,
      props: [
        { name: 'keys', type: 'string[]', desc: '按键序列（必填）' },
        { name: 'action', type: 'ReactNode', desc: '动作说明' },
      ],
    },
  ],
}

/* ================= 高级视觉 ================= */

function AnimatedNumberDemo() {
  /**
   * 演示「递增滚动」本身：每次点按钮把目标值抬高，
   * 数字会从当前读数滚到新值（而不是清零重来）。
   * 关掉动效（主题面板选「减少」）后，两次读数之间直接跳变 —— 这才是开关的证据。
   */
  const [amount, setAmount] = useState(8642300)
  return (
    <div className="flex flex-col items-center gap-2">
      <AnimatedNumber className="text-2xl font-semibold text-fg" value={amount} prefix="¥ " />
      <AnimatedNumber className="text-sm text-fg-3" value={92.4} decimals={1} suffix="%" />
      <Button
        size="xs"
        variant="secondary"
        onClick={() => {
          setAmount((prev) => prev + 128_400)
          toast.success('目标值 +¥128,400，数字从当前值续滚')
        }}
      >
        递增一次
      </Button>
    </div>
  )
}

function SpotlightDemo() {
  return (
    <SpotlightCard className="w-full max-w-[16.25rem] rounded-lg border border-line bg-surface p-4">
      <p className="text-2xs text-fg-4">月活跃用户</p>
      <AnimatedNumber className="mt-1 block text-xl font-semibold text-fg" value={128460} />
      <p className="mt-1 text-2xs text-success">+8.2% 较上周期</p>
    </SpotlightCard>
  )
}

function BorderBeamDemo() {
  return (
    <BorderBeam className="w-full max-w-[16.25rem]" duration={8}>
      <div className="p-4">
        <p className="text-2xs text-fg-4">持续集成</p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-fg">
          <CircleCheck className="size-3.5 text-success" /> 构建 #1284 已通过
        </p>
      </div>
    </BorderBeam>
  )
}

function GradientDemo() {
  return (
    <div className="flex flex-col items-center gap-2">
      <GradientText className="text-xl font-semibold tracking-tight" direction="to-br">
        Modular Admin Template
      </GradientText>
      <GradientText className="text-xs" direction="to-r">
        零依赖 · 模块化 · 高性能
      </GradientText>
    </div>
  )
}

function MarqueeDemo() {
  return (
    <div className="w-full overflow-hidden rounded-md border border-line py-2">
      <Marquee speed={26} gap={24}>
        {['React 19', 'Vite 8', 'TypeScript 6', 'Tailwind v4', 'TanStack Router', 'ECharts 6'].map(
          (item) => (
            <span key={item} className="w-32 shrink-0 text-center text-2xs text-fg-3">
              {item}
            </span>
          ),
        )}
      </Marquee>
    </div>
  )
}

function SlidingTabsDemo() {
  const [value, setValue] = useState<'day' | 'week' | 'month'>('week')
  return (
    <SlidingTabs
      value={value}
      onChange={setValue}
      items={[
        { value: 'day', label: '今日' },
        { value: 'week', label: '本周' },
        { value: 'month', label: '本月' },
      ]}
    />
  )
}

function RingMetricDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <RingMetric value={92.4} label="92.4%" sublabel="SLA 达成" tone="success" size={112} />
      <RingMetric value={68} label="68%" sublabel="容量使用" tone="warning" size={112} />
    </div>
  )
}

function SparklineDemo() {
  return (
    <div className="flex flex-col gap-2.5">
      {[
        { tone: 'primary' as const, data: [3, 5, 4, 7, 6, 9, 8, 11] },
        { tone: 'success' as const, data: [9, 7, 8, 6, 5, 4, 6, 3] },
        { tone: 'danger' as const, data: [4, 6, 5, 9, 8, 12, 11, 14] },
      ].map((item) => (
        <Sparkline key={item.tone} data={item.data} tone={item.tone} width={160} height={40} />
      ))}
    </div>
  )
}

function PremiumMeterDemo() {
  return (
    <div className="w-full space-y-3">
      <Progress value={72} tone="primary" showLabel label="GPU 利用率" />
      <Progress value={91} tone="danger" showLabel label="磁盘占用" />
      <div className="flex items-center gap-4">
        <AnimatedNumber className="text-lg font-semibold text-fg" value={1284} />
        <span className="text-2xs text-fg-4">QPS（数字滚动）</span>
        <Download className="ml-auto size-3.5 text-fg-4" />
      </div>
    </div>
  )
}

function IconWellDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 text-fg-3">
      {[Copy, Workflow, Settings, Mail, Download].map((Icon, index) => (
        <span key={index} className="grid size-9 place-items-center rounded-lg border border-line">
          <Icon className="size-3.5" />
        </span>
      ))}
    </div>
  )
}

export const premiumCategory: GalleryCategory = {
  id: 'premium',
  name: 'Premium',
  title: '高级视觉',
  description: '数字滚动、光斑、流光边框与跑马灯：让关键指标被看见',
  items: [
    {
      key: 'animated-number',
      name: 'AnimatedNumber',
      nameZh: '数字滚动',
      summary: '跟随应用「动效」开关：开启时从 0（或上次的值）递增到目标，减少动效时直接显示终值',
      demo: AnimatedNumberDemo,
      previewHeight: 170,
      keywords: ['shuzi', 'animate', 'countup', 'motion', '递增'],
      code: `// 未配 data-motion 时跟随系统 prefers-reduced-motion；
// 主题面板「动效：始终开启」= <html data-motion="full">，数字才会递增滚动
<AnimatedNumber value={8642300} prefix="¥ " decimals={0} />

// 实时指标（GMV / QPS）每几秒刷新：默认从「当前显示值」继续滚，
// 不会每次归零重爬；要归零重爬传 rollFromPrevious={false}
<AnimatedNumber value={gmv} duration={900} />`,
      props: [
        { name: 'value', type: 'number', desc: '目标值（必填）' },
        { name: 'decimals', type: 'number', default: '0', desc: '小数位' },
        {
          name: 'duration',
          type: 'number',
          default: '1200',
          desc: '动画时长（ms）；小幅跳动会自动压缩到 380ms 起',
        },
        { name: 'separator', type: 'boolean', default: 'true', desc: '千分位' },
        {
          name: 'rollFromPrevious',
          type: 'boolean',
          default: 'true',
          desc: '从上次显示值继续滚（实时指标用），false 则每次从 0 爬',
        },
        { name: 'format', type: '(value: number) => ReactNode', desc: '给了就跳过动画' },
      ],
    },
    {
      key: 'spotlight-card',
      name: 'SpotlightCard',
      nameZh: '光斑卡片',
      summary: '鼠标跟随的径向高光，只写 CSS 变量不触发渲染',
      demo: SpotlightDemo,
      previewHeight: 170,
      keywords: ['guangban', 'spotlight'],
      code: `<SpotlightCard className="rounded-lg border border-line p-4" color="var(--n-primary)">
  内容
</SpotlightCard>`,
      props: [
        { name: 'color', type: 'string', default: "'var(--n-primary)'", desc: '光斑颜色' },
        { name: 'radius', type: 'number', default: '220', desc: '光斑半径' },
        { name: 'glow', type: 'boolean', default: 'true', desc: '是否显示高光' },
      ],
    },
    {
      key: 'border-beam',
      name: 'BorderBeam',
      nameZh: '流光边框',
      summary: '沿边框循环移动的高光，页面里只放一处才不会廉价',
      demo: BorderBeamDemo,
      previewHeight: 160,
      keywords: ['liuguang', 'beam'],
      code: `<BorderBeam duration={8} color="var(--n-chart-2)">
  <div className="p-4">内容</div>
</BorderBeam>`,
      props: [
        { name: 'duration', type: 'number', default: '6', desc: '一圈耗时（秒）' },
        { name: 'width', type: 'number', default: '1.5', desc: '光束宽度' },
        { name: 'radius', type: 'string', default: "'var(--n-radius-lg)'", desc: '圆角' },
      ],
    },
    {
      key: 'gradient-text',
      name: 'GradientText',
      nameZh: '渐变标题',
      summary: '把标题做成品牌渐变，适合登录页与空态插画旁',
      demo: GradientDemo,
      keywords: ['jianbian', 'gradient'],
      code: `<GradientText className="text-xl font-semibold" direction="to-br">
  Modular Admin Template
</GradientText>`,
      props: [
        {
          name: 'direction',
          type: "'to-r' | 'to-br' | 'to-b'",
          default: "'to-r'",
          desc: '渐变方向',
        },
        { name: 'className', type: 'string', desc: '字号需自行指定' },
      ],
    },
    {
      key: 'marquee',
      name: 'Marquee',
      nameZh: '跑马灯',
      summary: '技术栈与合作伙伴的循环展示，悬停自动暂停',
      demo: MarqueeDemo,
      wide: true,
      keywords: ['paomadeng', 'marquee'],
      code: `<Marquee speed={26} gap={24}>
  {items.map((item) => <span key={item} className="w-32 shrink-0">{item}</span>)}
</Marquee>`,
      props: [
        { name: 'children', type: 'ReactNode', desc: '会被渲染两份，子项需定宽（必填）' },
        { name: 'speed', type: 'number', default: '24', desc: '一圈耗时（秒）' },
        { name: 'pauseOnHover', type: 'boolean', default: 'true', desc: '悬停暂停' },
      ],
    },
    {
      key: 'sliding-tabs',
      name: 'SlidingTabs',
      nameZh: '滑动标签',
      summary: '胶囊滑块跟随切换，纯受控且无内容面板',
      demo: SlidingTabsDemo,
      keywords: ['huadong', 'sliding'],
      code: `<SlidingTabs
  value={value}
  onChange={setValue}
  items={[{ value: 'day', label: '今日' }, { value: 'week', label: '本周' }]}
/>`,
      props: [
        { name: 'items / value / onChange', type: '必填', desc: '三项均必填' },
        { name: 'size', type: "'sm' | 'md'", desc: '尺寸' },
      ],
    },
    {
      key: 'ring-metric',
      name: 'RingMetric',
      nameZh: '环形指标',
      summary: '中心大字 + 环形成功率，SLA 与容量的首选表达',
      demo: RingMetricDemo,
      previewHeight: 160,
      keywords: ['huanxing', 'ring'],
      code: `<RingMetric value={92.4} label="92.4%" sublabel="SLA 达成" tone="success" />`,
      props: [
        { name: 'value', type: 'number', desc: '当前值（必填）' },
        { name: 'max', type: 'number', default: '100', desc: '上限' },
        { name: 'label / sublabel', type: 'ReactNode', desc: '中心大字与副标题' },
        { name: 'size / stroke', type: 'number', desc: '直径与线宽' },
      ],
    },
    {
      key: 'sparkline',
      name: 'Sparkline',
      nameZh: '迷你折线',
      summary: '没有坐标轴的纯趋势线，卡片里一眼看出方向',
      demo: SparklineDemo,
      previewHeight: 170,
      keywords: ['mini', 'spark'],
      code: `<Sparkline data={[3, 5, 4, 7, 6, 9]} width={160} height={40} tone="primary" />`,
      props: [
        { name: 'data', type: 'number[]', desc: '至少 2 个点（必填）' },
        { name: 'width / height', type: 'number', desc: '尺寸，默认 120 × 36' },
        { name: 'area', type: 'boolean', default: 'true', desc: '是否填充面积' },
        { name: 'pulse', type: 'boolean', default: 'true', desc: '末端呼吸点' },
      ],
    },
    {
      key: 'premium-meter',
      name: '指标组合',
      nameZh: '进度 + 数字',
      summary: 'Progress 与 AnimatedNumber 组合出的资源看板',
      demo: PremiumMeterDemo,
      wide: true,
      keywords: ['zhibiao', 'meter'],
      code: `<Progress value={72} showLabel label="GPU 利用率" />
<AnimatedNumber value={1284} />`,
    },
    {
      key: 'icon-well',
      name: 'IconWell',
      nameZh: '图标台',
      summary: '图标统一走 lucide-react，尺寸与线宽按语义固定',
      demo: IconWellDemo,
      previewHeight: 130,
      keywords: ['tubiao', 'icon'],
      code: `import { Settings } from 'lucide-react'
<Settings className="size-4" />`,
    },
  ],
}
