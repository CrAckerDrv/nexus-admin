import { useState } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  CirclePlus,
  Download,
  Ellipsis,
  Settings,
  Star,
  Trash,
  Users,
} from 'lucide-react'
import {
  Avatar,
  AvatarGroup,
  Badge,
  Button,
  ButtonGroup,
  Card,
  CardFooter,
  CardHeader,
  CountTag,
  Kbd,
  SectionCard,
  StatCard,
  StatusDot,
  Tag,
  Tooltip,
  formatCompact,
  formatCurrency,
  formatPercent,
  toast,
} from '@nexus/ui'
import type { GalleryCategory } from './types'

/* ------------------------------------------------------------------ *
 * 演示组件：每个都是一个无 props 的普通组件
 * ------------------------------------------------------------------ */

function ButtonDemo() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="primary">主要按钮</Button>
        <Button variant="secondary">次要按钮</Button>
        <Button variant="outline">描边按钮</Button>
        <Button variant="ghost">幽灵按钮</Button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button size="xs" variant="primary">
          超小
        </Button>
        <Button size="sm" variant="secondary">
          小号
        </Button>
        <Button size="lg" variant="primary">
          大号
        </Button>
        <Button variant="primary" loading>
          提交中
        </Button>
        <Button variant="secondary" disabled>
          禁用
        </Button>
      </div>
    </div>
  )
}

function ButtonGroupDemo() {
  const [mode, setMode] = useState('week')
  return (
    <ButtonGroup>
      {[
        { key: 'day', label: '日' },
        { key: 'week', label: '周' },
        { key: 'month', label: '月' },
      ].map((item) => (
        <Button
          key={item.key}
          size="sm"
          variant={mode === item.key ? 'primary' : 'secondary'}
          onClick={() => setMode(item.key)}
        >
          {item.label}
        </Button>
      ))}
    </ButtonGroup>
  )
}

function IconButtonDemo() {
  return (
    <div className="flex items-center gap-2">
      <Tooltip content="新建">
        <Button variant="primary" size="icon" aria-label="新建">
          <CirclePlus className="size-4" />
        </Button>
      </Tooltip>
      <Tooltip content="设置">
        <Button variant="secondary" size="icon" aria-label="设置">
          <Settings className="size-4" />
        </Button>
      </Tooltip>
      <Tooltip content="更多">
        <Button variant="ghost" size="icon-sm" aria-label="更多">
          <Ellipsis className="size-4" />
        </Button>
      </Tooltip>
      <Tooltip content="删除">
        <Button variant="ghost" size="icon-sm" aria-label="删除">
          <Trash className="size-4 text-danger" />
        </Button>
      </Tooltip>
      <Button variant="primary" rightIcon={<ArrowRight className="size-3.5" />}>
        下一步
      </Button>
    </div>
  )
}

function BadgeDemo() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Badge>默认</Badge>
        <Badge tone="primary">主要</Badge>
        <Badge tone="success">成功</Badge>
        <Badge tone="warning">警告</Badge>
        <Badge tone="danger">错误</Badge>
        <Badge tone="info">信息</Badge>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Badge tone="primary" variant="solid">
          实心
        </Badge>
        <Badge tone="success" variant="outline">
          描边
        </Badge>
        <Badge tone="success" dot>
          圆点
        </Badge>
        <Badge tone="danger" variant="dot">
          故障
        </Badge>
      </div>
    </div>
  )
}

function StatusDotDemo() {
  const rows = [
    { label: '运行中', tone: 'success' as const, pulse: true },
    { label: '降级', tone: 'warning' as const },
    { label: '故障', tone: 'danger' as const, pulse: true },
    { label: '已停止', tone: 'neutral' as const },
  ]
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5">
      {rows.map((row) => (
        <span key={row.label} className="flex items-center gap-1.5 text-xs text-fg-2">
          <StatusDot tone={row.tone} pulse={row.pulse} label={row.label} />
          {row.label}
        </span>
      ))}
    </div>
  )
}

function TagDemo() {
  const [tags, setTags] = useState(['华东-1', '华东-2', '华北-3'])
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {tags.map((tag) => (
          <Tag key={tag} tone="primary" onClose={() => setTags(tags.filter((t) => t !== tag))}>
            {tag}
          </Tag>
        ))}
        {tags.length === 0 && (
          <Button size="xs" variant="text" onClick={() => setTags(['华东-1'])}>
            恢复标签
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Tag>默认标签</Tag>
        <Tag tone="success">已通过</Tag>
        <Tag tone="warning">待复核</Tag>
        <Tag tone="danger">高危</Tag>
      </div>
    </div>
  )
}

function CountTagDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-fg-2">
      <span className="flex items-center gap-1.5">
        待处理
        <CountTag count={3} tone="danger" />
      </span>
      <span className="flex items-center gap-1.5">
        待审核
        <CountTag count={12} tone="warning" />
      </span>
      <span className="flex items-center gap-1.5">
        已完成
        <CountTag count={128} tone="success" />
      </span>
      <span className="flex items-center gap-1.5">
        超上限
        <CountTag count={1420} tone="primary" />
      </span>
    </div>
  )
}

function AvatarDemo() {
  return (
    <div className="flex flex-col items-center gap-3.5">
      <div className="flex items-center gap-3">
        <Avatar name="陈彦之" size="xs" />
        <Avatar name="林知夏" size="sm" />
        <Avatar name="周予安" size="md" status="online" />
        <Avatar name="吴星野" size="lg" status="busy" />
        <Avatar name="黄清越" size={48} shape="square" />
      </div>
      <AvatarGroup
        users={[{ name: '陈彦之' }, { name: '林知夏' }, { name: '周予安' }, { name: '韩亦然' }]}
        max={3}
      />
    </div>
  )
}

function CardDemo() {
  return (
    <Card hoverable className="w-full max-w-[17.5rem]">
      <CardHeader
        title="季度目标"
        description="签单额已完成 78%"
        icon={<Star className="size-3.5" />}
        extra={<Badge tone="primary">Q4</Badge>}
      />
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-xl font-semibold text-fg tabular-nums">
          {formatCurrency(8642300)}
        </span>
      </div>
      <CardFooter>
        <Button size="sm" variant="ghost">
          详情
        </Button>
        <Button size="sm" variant="primary">
          去处理
        </Button>
      </CardFooter>
    </Card>
  )
}

function SectionCardDemo() {
  return (
    <SectionCard
      title="实例信息"
      description="SectionCard = 标题栏 + 分割线 + 主体（主体无内边距）"
      extra={
        <Button size="xs" variant="secondary">
          编辑
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 text-xs">
        <span className="text-fg-3">实例 ID</span>
        <span className="font-mono text-fg">nexus-8f2a9c</span>
        <span className="text-fg-3">规格</span>
        <span className="text-fg">4 核 16 GB</span>
        <span className="text-fg-3">状态</span>
        <span className="flex items-center gap-1.5 text-fg">
          <StatusDot tone="success" pulse /> 运行中
        </span>
      </div>
    </SectionCard>
  )
}

function StatCardDemo() {
  return (
    <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
      <StatCard
        label="本月营收"
        value={formatCurrency(8642300)}
        delta={12.4}
        trend={[3, 8, 6, 12, 9, 15, 18]}
      />
      <StatCard
        label="活跃用户"
        value={formatCompact(128460)}
        delta={-2.1}
        deltaTone="down-good"
        tone="success"
        icon={<Users className="size-4" />}
        onLive
      />
      <StatCard label="转化率" value={formatPercent(4.68)} delta={1.2} tone="warning" />
      <StatCard
        label="存储占用"
        value="1.0"
        suffix="TB"
        tone="danger"
        footer={<span className="text-2xs text-fg-4">较上周期 +3.2%</span>}
      />
    </div>
  )
}

function KbdDemo() {
  return (
    <div className="flex flex-col items-center gap-3 text-xs text-fg-3">
      <span className="flex items-center gap-1.5">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
        打开命令面板
      </span>
      <span className="flex items-center gap-1.5">
        <Kbd>Esc</Kbd>
        关闭弹层
        <span className="mx-1.5 h-3 w-px bg-line" />
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd>
        切换选项
      </span>
    </div>
  )
}

function ToastDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button size="sm" variant="secondary" onClick={() => toast.success('保存成功')}>
        成功
      </Button>
      <Button size="sm" variant="secondary" onClick={() => toast.error('保存失败，请重试')}>
        错误
      </Button>
      <Button size="sm" variant="secondary" onClick={() => toast.warning('额度即将用尽')}>
        警告
      </Button>
      <Button size="sm" variant="secondary" onClick={() => toast.info('这是一条信息提示')}>
        信息
      </Button>
      <Button
        size="sm"
        variant="outline"
        leftIcon={<BadgeCheck className="size-3.5" />}
        onClick={() =>
          toast.success('已发布', {
            description: '你可以前往内容中心查看',
            action: { label: '撤销', onClick: () => toast.info('已撤销') },
          })
        }
      >
        带操作
      </Button>
    </div>
  )
}

function BtnLoadingDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button variant="primary" onClick={() => toast.info('这是按钮的点击反馈')}>
        <Bell className="size-3.5" /> 点击我
      </Button>
      <Button variant="danger" leftIcon={<Trash className="size-3.5" />}>
        删除
      </Button>
      <Button variant="outline" leftIcon={<Download className="size-3.5" />}>
        导出
      </Button>
      <Button variant="link" rightIcon={<ArrowRight className="size-3" />}>
        查看文档
      </Button>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 分类清单
 * ------------------------------------------------------------------ */

export const basicCategory: GalleryCategory = {
  id: 'basic',
  name: 'Basic',
  title: '基础组件',
  description: '按钮、徽标、标签、头像与卡片：构成后台页面的一切原子件',
  items: [
    {
      key: 'button',
      name: 'Button',
      nameZh: '按钮',
      summary: '7 种变体 × 7 种尺寸，内置 loading、图标与块级布局',
      demo: ButtonDemo,
      previewHeight: 150,
      keywords: ['anniu', 'btn', 'button'],
      code: `<Button variant="primary">主要按钮</Button>
<Button variant="secondary" onClick={save}>次要按钮</Button>
<Button variant="primary" loading>提交中</Button>
<Button variant="danger" leftIcon={<Trash className="size-3.5" />}>删除</Button>`,
      props: [
        {
          name: 'variant',
          type: "'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'text' | 'link'",
          default: "'secondary'",
          desc: '视觉变体',
        },
        {
          name: 'size',
          type: "'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm' | 'icon-xs'",
          default: "'md'",
          desc: '尺寸；icon-* 为方形图标按钮',
        },
        { name: 'loading', type: 'boolean', desc: '加载态：禁用交互并替换左侧图标' },
        { name: 'leftIcon / rightIcon', type: 'ReactNode', desc: '两侧图标' },
        { name: 'block', type: 'boolean', desc: '占满父容器宽度' },
      ],
    },
    {
      key: 'button-group',
      name: 'ButtonGroup',
      nameZh: '按钮组',
      summary: '相邻按钮共享边框，用状态色表达「当前选中」',
      demo: ButtonGroupDemo,
      keywords: ['anniu zu', 'group'],
      code: `<ButtonGroup>
  <Button size="sm" variant={mode === 'day' ? 'primary' : 'secondary'}>日</Button>
  <Button size="sm" variant={mode === 'week' ? 'primary' : 'secondary'}>周</Button>
</ButtonGroup>`,
      props: [
        { name: 'children', type: 'ReactNode', desc: '一组 Button（必填）' },
        { name: 'vertical', type: 'boolean', desc: '纵向排列' },
      ],
    },
    {
      key: 'icon-button',
      name: 'IconButton',
      nameZh: '图标按钮',
      summary: 'Button 的 icon 尺寸 + Tooltip，顶栏与表格行尾的通用写法',
      demo: IconButtonDemo,
      keywords: ['tubiao anniu'],
      code: `<Tooltip content="新建">
  <Button variant="primary" size="icon" aria-label="新建">
    <CirclePlus className="size-4" />
  </Button>
</Tooltip>`,
    },
    {
      key: 'badge',
      name: 'Badge',
      nameZh: '徽标',
      summary: '6 种语义色 × 4 种样式（柔和 / 实心 / 描边 / 圆点）',
      demo: BadgeDemo,
      previewHeight: 130,
      keywords: ['huibiao', 'biaoqian'],
      code: `<Badge tone="success">成功</Badge>
<Badge tone="primary" variant="solid">实心</Badge>
<Badge tone="danger" variant="dot">故障</Badge>`,
      props: [
        {
          name: 'tone',
          type: "'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'",
          default: "'neutral'",
          desc: '语义色',
        },
        {
          name: 'variant',
          type: "'soft' | 'solid' | 'outline' | 'dot'",
          default: "'soft'",
          desc: '视觉样式',
        },
        { name: 'dot', type: 'boolean', desc: '文字前的状态圆点' },
        { name: 'size', type: "'sm' | 'md'", desc: '尺寸' },
      ],
    },
    {
      key: 'status-dot',
      name: 'StatusDot',
      nameZh: '状态点',
      summary: '只有圆点，可开启呼吸动画表达「实时 / 活跃」',
      demo: StatusDotDemo,
      keywords: ['zhuangtai dian'],
      code: `<span className="flex items-center gap-1.5">
  <StatusDot tone="success" pulse /> 运行中
</span>`,
      props: [
        { name: 'tone', type: 'Tone', desc: '语义色；与 Badge 共用 Tone 类型' },
        { name: 'pulse', type: 'boolean', desc: '呼吸扩散动画' },
        { name: 'label', type: 'string', desc: '无障碍标签（aria-label）' },
      ],
    },
    {
      key: 'tag',
      name: 'Tag',
      nameZh: '标签',
      summary: '可关闭的轻量标签，适合筛选条件与多选结果',
      demo: TagDemo,
      previewHeight: 130,
      keywords: ['biaoqian', 'closable'],
      code: `<Tag tone="primary" onClose={() => remove(id)}>华东-1</Tag>`,
      props: [
        {
          name: 'tone',
          type: "'neutral' | 'primary' | 'success' | 'warning' | 'danger'",
          desc: '语义色（没有 info）',
        },
        { name: 'onClose', type: '() => void', desc: '传了才显示关闭按钮' },
      ],
    },
    {
      key: 'count-tag',
      name: 'CountTag',
      nameZh: '计数标签',
      summary: '红点式计数，超过 max 自动显示 99+，count 为 0 时不渲染',
      demo: CountTagDemo,
      keywords: ['jishu', 'count'],
      code: `<CountTag count={12} tone="danger" />
<CountTag count={1420} tone="primary" max={99} />`,
      props: [
        { name: 'count', type: 'number', desc: '计数（必填，0 时返回 null）' },
        { name: 'tone', type: 'Tone', desc: '语义色' },
        { name: 'max', type: 'number', default: '99', desc: '超出后显示 max+ ' },
      ],
    },
    {
      key: 'avatar',
      name: 'Avatar',
      nameZh: '头像',
      summary: '无图时按姓名生成首字头像，右下角可挂在线状态',
      demo: AvatarDemo,
      previewHeight: 140,
      keywords: ['touxiang'],
      code: `<Avatar name="陈彦之" size="md" status="online" />
<AvatarGroup users={users} max={3} />`,
      props: [
        { name: 'name', type: 'string', desc: '用于生成首字与配色' },
        { name: 'src', type: 'string', desc: '图片地址，缺失时回退首字' },
        { name: 'size', type: "number | 'xs' | 'sm' | 'md' | 'lg'", default: "'md'", desc: '尺寸' },
        { name: 'status', type: "'online' | 'offline' | 'busy'", desc: '状态点' },
        { name: 'shape', type: "'circle' | 'square'", desc: '形状' },
      ],
    },
    {
      key: 'card',
      name: 'Card',
      nameZh: '卡片',
      summary: '最基础的区块容器，Header / Footer 可自由组合',
      demo: CardDemo,
      previewHeight: 170,
      keywords: ['kapian'],
      code: `<Card hoverable>
  <CardHeader title="季度目标" description="已完成 78%" extra={<Badge>Q4</Badge>} />
  <CardFooter>
    <Button size="sm" variant="primary">去处理</Button>
  </CardFooter>
</Card>`,
      props: [
        { name: 'bare', type: 'boolean', desc: '去掉默认 1rem 内边距' },
        { name: 'hoverable', type: 'boolean', desc: '悬浮时抬升阴影' },
        { name: 'bordered', type: 'boolean', default: 'true', desc: '是否显示描边' },
      ],
    },
    {
      key: 'section-card',
      name: 'SectionCard',
      nameZh: '区块卡片',
      summary: '标题栏 + 分割线 + 主体，后台页面最常用的容器',
      demo: SectionCardDemo,
      wide: true,
      previewHeight: 170,
      keywords: ['qukuai kapian'],
      code: `<SectionCard title="实例信息" extra={<Button size="xs">编辑</Button>}>
  <Descriptions items={items} />
</SectionCard>`,
      props: [
        { name: 'title', type: 'ReactNode', desc: '标题（必填）' },
        { name: 'description', type: 'ReactNode', desc: '副标题' },
        { name: 'extra', type: 'ReactNode', desc: '标题右侧操作（不是 actions）' },
        { name: 'divided', type: 'boolean', default: 'true', desc: '标题下分割线' },
        { name: 'bodyClassName', type: 'string', desc: '主体类名；主体默认无内边距' },
      ],
    },
    {
      key: 'stat-card',
      name: 'StatCard',
      nameZh: '指标卡',
      summary: '数字 + 环比 + 迷你趋势线，工作台 KPI 区的标准件',
      demo: StatCardDemo,
      wide: true,
      previewHeight: 200,
      keywords: ['zhibiao', 'kpi'],
      code: `<StatCard
  label="本月营收"
  value={formatCurrency(8642300)}
  delta={12.4}
  trend={[3, 8, 6, 12, 9, 15, 18]}
/>`,
      props: [
        { name: 'label', type: 'string', desc: '指标名（必填）' },
        { name: 'value', type: 'ReactNode', desc: '主数值（必填）' },
        { name: 'delta', type: 'number', desc: '环比变化，正负决定方向与颜色' },
        {
          name: 'deltaTone',
          type: "'up-good' | 'down-good' | 'neutral'",
          default: "'up-good'",
          desc: '涨跌的语义（下降也可能是好事）',
        },
        { name: 'trend', type: 'number[]', desc: '迷你趋势数据（≥2 点）' },
        { name: 'onLive', type: 'boolean', desc: '显示「实时」呼吸点' },
      ],
    },
    {
      key: 'kbd',
      name: 'Kbd',
      nameZh: '键位提示',
      summary: '键盘按键样式，命令面板与快捷操作必备',
      demo: KbdDemo,
      keywords: ['jianwei', 'keyboard'],
      code: `<span className="flex items-center gap-1.5">
  <Kbd>⌘</Kbd><Kbd>K</Kbd> 打开命令面板
</span>`,
    },
    {
      key: 'toast-call',
      name: 'toast',
      nameZh: '全局提示',
      summary: '命令式调用，无需 Provider；支持描述、操作按钮与去重 id',
      demo: ToastDemo,
      previewHeight: 130,
      keywords: ['tishi', 'notification'],
      code: `toast.success('保存成功')
toast.error('保存失败，请重试')
toast.success('已发布', {
  description: '你可以前往内容中心查看',
  action: { label: '撤销', onClick: undo },
})`,
      props: [
        {
          name: 'title',
          type: 'string',
          desc: '文案；快捷方法为 toast.success / error / warning / info / loading',
        },
        { name: 'description', type: 'string', desc: '第二行说明' },
        { name: 'action', type: '{ label: string; onClick: () => void }', desc: '右侧操作按钮' },
        { name: 'duration', type: 'number', default: '3200', desc: '毫秒；loading 默认不自动消失' },
      ],
    },
    {
      key: 'button-variants',
      name: 'Button 更多变体',
      nameZh: '危险 / 描边 / 链接',
      summary: 'danger 用于不可逆操作，link 用于就地跳转，两者语义不能混用',
      demo: BtnLoadingDemo,
      keywords: ['weixian', 'link'],
      code: `<Button variant="danger" leftIcon={<Trash />}>删除</Button>
<Button variant="outline" leftIcon={<Download />}>导出</Button>
<Button variant="link">查看文档</Button>`,
    },
  ],
}
