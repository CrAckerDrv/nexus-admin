import { useMemo, useState } from 'react'
import {
  CircleCheck,
  CircleX,
  Clock,
  Database,
  FileArchive,
  FolderClosed,
  FolderOpen,
  Server,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  CellWithSub,
  DataTable,
  Descriptions,
  Pagination,
  Progress,
  TableToolbar,
  Timeline,
  Tree,
  UploadList,
  VirtualTable,
  formatCurrency,
  formatDateTime,
  toast,
} from '@nexus/ui'
import type { Column } from '@nexus/ui'
import type { GalleryCategory } from './types'

/* ---------------- 数据 ---------------- */

interface DemoUser {
  id: string
  name: string
  email: string
  department: string
  role: string
  status: 'active' | 'invited' | 'disabled'
  amount: number
}

const TABLE_ROWS: DemoUser[] = [
  {
    id: 'u1',
    name: '陈彦之',
    email: 'admin@nexus.dev',
    department: '平台技术部',
    role: '超级管理员',
    status: 'active',
    amount: 128460,
  },
  {
    id: 'u2',
    name: '林知夏',
    email: 'operator@nexus.dev',
    department: '用户增长组',
    role: '运营专员',
    status: 'active',
    amount: 86420,
  },
  {
    id: 'u3',
    name: '周予安',
    email: 'viewer@nexus.dev',
    department: '数据分析组',
    role: '只读访客',
    status: 'invited',
    amount: 41200,
  },
  {
    id: 'u4',
    name: '吴星野',
    email: 'wuxy@nexus.dev',
    department: '客户成功部',
    role: '运营专员',
    status: 'disabled',
    amount: 9870,
  },
]

const STATUS_META = {
  active: { label: '正常', tone: 'success' as const },
  invited: { label: '待接受邀请', tone: 'warning' as const },
  disabled: { label: '已停用', tone: 'neutral' as const },
}

function DataTableDemo() {
  const [selected, setSelected] = useState<string[]>([])
  const columns = useMemo<Column<DemoUser>[]>(
    () => [
      {
        key: 'name',
        header: '用户',
        width: 180,
        sortValue: (row) => row.name,
        pinned: 'left',
        cell: (row) => (
          <span className="flex items-center gap-2">
            <Avatar name={row.name} size="xs" />
            <span className="min-w-0">
              <span className="block truncate text-xs text-fg">{row.name}</span>
              <span className="block truncate font-mono text-2xs text-fg-4">{row.email}</span>
            </span>
          </span>
        ),
      },
      { key: 'department', header: '部门', width: 140, cell: (row) => row.department },
      { key: 'role', header: '角色', width: 130, cell: (row) => row.role },
      {
        key: 'status',
        header: '状态',
        width: 110,
        cell: (row) => (
          <Badge tone={STATUS_META[row.status].tone}>{STATUS_META[row.status].label}</Badge>
        ),
      },
      {
        key: 'amount',
        header: '累计金额',
        width: 130,
        align: 'right',
        sortValue: (row) => row.amount,
        cell: (row) => <span className="tabular-nums">{formatCurrency(row.amount)}</span>,
      },
    ],
    [],
  )

  return (
    <div className="w-full space-y-2">
      <TableToolbar
        selectedCount={selected.length}
        onClearSelection={() => setSelected([])}
        batchActions={
          <Button size="xs" variant="primary">
            批量停用
          </Button>
        }
        title="成员列表"
        description="支持固定列、排序、行选择与骨架加载"
      />
      <DataTable
        rows={TABLE_ROWS}
        columns={columns}
        getRowId={(row) => row.id}
        selectable
        selectedIds={selected}
        onSelectedChange={setSelected}
        defaultSort={{ key: 'amount', dir: 'desc' }}
        onRowClick={(row) => toast.info(`打开 ${row.name} 的详情`)}
      />
    </div>
  )
}

function PaginationDemo() {
  const [page, setPage] = useState(2)
  const [pageSize, setPageSize] = useState(10)
  return (
    <div className="w-full space-y-3">
      <Pagination
        page={page}
        pageSize={pageSize}
        total={268}
        onChange={(nextPage, nextSize) => {
          setPage(nextPage)
          setPageSize(nextSize)
        }}
      />
      <p className="text-2xs text-fg-4">
        当前第 {page} 页，每页 {pageSize} 条
      </p>
    </div>
  )
}

const VIRTUAL_ROWS = Array.from({ length: 5000 }, (_, index) => ({
  id: `log-${index}`,
  time: formatDateTime(Date.now() - index * 60_000),
  actor: ['陈彦之', '林知夏', '周予安', '吴星野'][index % 4] as string,
  action: ['登录', '更新用户', '导出报表', '删除角色'][index % 4] as string,
  result: index % 7 === 0 ? 'failure' : 'success',
}))

const VIRTUAL_COLUMNS: Column<(typeof VIRTUAL_ROWS)[number]>[] = [
  {
    key: 'time',
    header: '时间',
    width: 170,
    cell: (row) => <span className="font-mono text-2xs">{row.time}</span>,
  },
  { key: 'actor', header: '操作人', width: 120, cell: (row) => row.actor },
  { key: 'action', header: '动作', width: 160, cell: (row) => row.action },
  {
    key: 'result',
    header: '结果',
    width: 110,
    cell: (row) => (
      <span className="flex items-center gap-1 text-xs">
        {row.result === 'success' ? (
          <CircleCheck className="size-3.5 text-success" />
        ) : (
          <CircleX className="size-3.5 text-danger" />
        )}
        {row.result === 'success' ? '成功' : '失败'}
      </span>
    ),
  },
]

function VirtualTableDemo() {
  return (
    <VirtualTable
      rows={VIRTUAL_ROWS}
      columns={VIRTUAL_COLUMNS}
      getRowId={(row) => row.id}
      rowHeight={38}
      height={260}
    />
  )
}

const TREE_ITEMS = [
  {
    key: 'root',
    title: 'Nexus 集团',
    icon: <Server className="size-3.5" />,
    extra: <Badge size="sm">12</Badge>,
    children: [
      {
        key: 'tech',
        title: '平台技术部',
        icon: <FolderOpen className="size-3.5" />,
        children: [
          { key: 'fe', title: '前端组', icon: <UserRound className="size-3.5" /> },
          { key: 'be', title: '后端组', icon: <UserRound className="size-3.5" /> },
        ],
      },
      {
        key: 'ops',
        title: '运维中心',
        icon: <FolderClosed className="size-3.5" />,
        children: [{ key: 'sre', title: 'SRE', icon: <UserRound className="size-3.5" /> }],
      },
    ],
  },
]

function TreeDemo() {
  const [selected, setSelected] = useState('fe')
  return (
    <div className="w-full max-w-[22.5rem] rounded-md border border-line p-2">
      <Tree
        items={TREE_ITEMS}
        selectedKey={selected}
        defaultExpandAll
        onSelect={(key) => setSelected(key)}
      />
      <p className="mt-2 border-t border-line-subtle pt-2 text-2xs text-fg-4">
        当前选中：<span className="font-mono text-fg-3">{selected}</span>
      </p>
    </div>
  )
}

function DescriptionsDemo() {
  return (
    <div className="w-full">
      <Descriptions
        columns={2}
        items={[
          { label: '实例 ID', value: 'nexus-8f2a9c', copyable: true },
          { label: '所属部门', value: '平台技术部' },
          { label: '创建时间', value: formatDateTime(new Date(2026, 10, 5, 9, 30)) },
          { label: '负责人', value: '陈彦之' },
          { label: '访问密钥', value: 'sk_live_4f2a9c8e71b3', copyable: true, span: 2 },
        ]}
      />
    </div>
  )
}

function TimelineDemo() {
  return (
    <div className="w-full max-w-[32.5rem]">
      <Timeline
        items={[
          {
            key: '1',
            title: '提交审批',
            description: '陈彦之 提交了权限变更申请',
            time: '10:24',
            tone: 'primary',
            icon: <Clock className="size-3" />,
          },
          {
            key: '2',
            title: '部门主管通过',
            description: '林知夏 审批通过',
            time: '11:02',
            tone: 'success',
            icon: <CircleCheck className="size-3" />,
          },
          {
            key: '3',
            title: '安全复核中',
            description: '检测到新增高危权限，需要安全团队复核',
            time: '11:30',
            tone: 'warning',
            icon: <ShieldCheck className="size-3" />,
          },
          {
            key: '4',
            title: '已生效',
            description: '权限已同步至 12 名成员',
            time: '14:08',
            tone: 'success',
          },
        ]}
      />
    </div>
  )
}

function ProgressDemo() {
  return (
    <div className="flex w-full flex-col gap-4">
      <Progress value={62} showLabel label="任务完成度" />
      <Progress value={86} tone="warning" showLabel label="存储占用" />
      <Progress
        max={80}
        value={55}
        segments={[{ value: 24 }, { value: 18, tone: 'warning' }, { value: 13, tone: 'success' }]}
        label="分段额度"
      />
      <div className="flex items-center gap-5">
        <Progress value={78} variant="ring" ringSize={72} label="78%" tone="primary" />
        <Progress value={94} variant="ring" ringSize={72} label="94%" tone="success" />
        <Progress value={38} variant="ring" ringSize={72} label="38%" tone="danger" />
      </div>
    </div>
  )
}

function ProgressRingDemo() {
  const [percent, setPercent] = useState(42)
  return (
    <div className="flex items-center gap-4">
      <Progress value={percent} variant="ring" ringSize={88} label={`${percent}%`} />
      <div className="flex flex-col gap-1.5">
        <Button
          size="xs"
          variant="secondary"
          onClick={() => setPercent((prev) => Math.min(100, prev + 10))}
        >
          +10%
        </Button>
        <Button size="xs" variant="ghost" onClick={() => setPercent(42)}>
          重置
        </Button>
      </div>
    </div>
  )
}

const UPLOAD_FILES = [
  { id: '1', name: '2026-Q4-报表.xlsx', size: 1_248_320, progress: 100, status: 'done' as const },
  {
    id: '2',
    name: '用户增长分析.pdf',
    size: 4_194_304,
    progress: 62,
    status: 'uploading' as const,
  },
  { id: '3', name: '品牌素材包.zip', size: 18_874_368, progress: 0, status: 'error' as const },
]

function UploadListDemo() {
  const [files, setFiles] = useState(UPLOAD_FILES)
  return (
    <div className="w-full max-w-[26.25rem]">
      <UploadList
        files={files}
        onRemove={(id) => setFiles(files.filter((file) => file.id !== id))}
        onRetry={(id) => {
          setFiles(
            files.map((file) =>
              file.id === id ? { ...file, status: 'uploading', progress: 12 } : file,
            ),
          )
          toast.info('已重新上传')
        }}
      />
    </div>
  )
}

function CellWithSubDemo() {
  return (
    <div className="w-full space-y-2 rounded-md border border-line p-3">
      <CellWithSub primary="订单 #NO-20261105-8421" secondary="陈彦之 · 2026-11-05 10:24" />
      <CellWithSub primary="订单 #NO-20261105-8422" secondary="林知夏 · 2026-11-05 11:02" />
    </div>
  )
}

function TableToolbarDemo() {
  const [selected, setSelected] = useState(2)
  return (
    <div className="w-full">
      <TableToolbar
        title="批量操作条"
        description="count > 0 时整体替换为选择提示条"
        selectedCount={selected}
        onClearSelection={() => setSelected(0)}
        batchActions={
          <Button size="xs" variant="primary" onClick={() => toast.success('已批量启用')}>
            批量启用
          </Button>
        }
        right={
          <Button size="xs" variant="secondary" onClick={() => setSelected(3)}>
            模拟选中 3 项
          </Button>
        }
      />
    </div>
  )
}

function EmptyStateInlineDemo() {
  return (
    <div className="w-full rounded-md border border-dashed border-line">
      <DataTable
        rows={[]}
        columns={[
          { key: 'name', header: '名称', cell: () => null },
          { key: 'owner', header: '负责人', cell: () => null },
        ]}
        getRowId={() => 'x'}
        empty={
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="grid size-10 place-items-center rounded-full bg-surface-2 text-fg-4">
              <Database className="size-5" />
            </span>
            <p className="text-xs text-fg-2">还没有数据源</p>
            <p className="text-2xs text-fg-4">接上一个数据库，这里会立即显示结构</p>
          </div>
        }
      />
    </div>
  )
}

function FileListDemo() {
  return (
    <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
      {[
        { name: '季度报表.xlsx', size: '1.2 MB', icon: <FileArchive className="size-4" /> },
        { name: '部署手册.pdf', size: '4.0 MB', icon: <FileArchive className="size-4" /> },
        { name: '素材包.zip', size: '18 MB', icon: <FileArchive className="size-4" /> },
      ].map((file) => (
        <div
          key={file.name}
          className="flex items-center gap-2 rounded-md border border-line px-2.5 py-2 transition-colors hover:border-primary/35"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-2 text-fg-3">
            {file.icon}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs text-fg">{file.name}</span>
            <span className="block text-2xs text-fg-4">{file.size}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

export const dataCategory: GalleryCategory = {
  id: 'data',
  name: 'Data',
  title: '数据展示',
  description: '表格、分页、树、时间线与上传：把后端数据变成可读的信息',
  items: [
    {
      key: 'data-table',
      name: 'DataTable',
      nameZh: '数据表格',
      summary: '排序 / 行选择 / 固定列 / 骨架一体，列表页的主力组件',
      demo: DataTableDemo,
      wide: true,
      previewHeight: 330,
      keywords: ['biaoge', 'table'],
      code: `<DataTable
  rows={rows}
  columns={columns}
  getRowId={(row) => row.id}
  selectable
  selectedIds={selected}
  onSelectedChange={setSelected}
  columns={[
    { key: 'name', header: '用户', pinned: 'left', width: 180, cell: (row) => row.name },
    { key: 'status', header: '状态', cell: (row) => <Badge>{row.status}</Badge> },
  ]}
/>`,
      props: [
        { name: 'columns', type: 'Column<T>[]', desc: '列定义（必填），支持 pinned / sortValue' },
        { name: 'rows / getRowId', type: 'T[] / (row: T) => string', desc: '数据与行标识（必填）' },
        { name: 'selectable', type: 'boolean', desc: '启用行选择（左侧复选框列）' },
        { name: 'maxHeight', type: 'number', desc: '超过后纵向滚动并吸顶表头' },
        { name: 'loading / empty', type: 'boolean / ReactNode', desc: '骨架与空态' },
      ],
    },
    {
      key: 'pagination',
      name: 'Pagination',
      nameZh: '分页器',
      summary: '服务端分页的标准件，含页码折叠与每页条数',
      demo: PaginationDemo,
      wide: true,
      keywords: ['fenye', 'pagination'],
      code: `<Pagination
  page={page}
  pageSize={pageSize}
  total={268}
  onChange={(nextPage, nextSize) => { setPage(nextPage); setPageSize(nextSize) }}
/>`,
      props: [
        { name: 'page / pageSize / total', type: 'number', desc: '三项必填' },
        {
          name: 'onChange',
          type: '(page: number, pageSize: number) => void',
          desc: '翻页或改每页条数',
        },
        { name: 'simple', type: 'boolean', desc: '只保留上一页 / 下一页' },
      ],
    },
    {
      key: 'virtual-table',
      name: 'VirtualTable',
      nameZh: '虚拟滚动表格',
      summary: '万行数据只渲染可视区，审计日志这类长列表的首选',
      demo: VirtualTableDemo,
      wide: true,
      previewHeight: 300,
      keywords: ['xuni', 'virtual', 'wanhang'],
      code: `<VirtualTable
  rows={logs}
  columns={columns}
  getRowId={(row) => row.id}
  rowHeight={38}
  height={260}
/>`,
      props: [
        { name: 'rows / columns / getRowId', type: '必填', desc: '与 DataTable 相同签名' },
        { name: 'rowHeight', type: 'number', default: '40', desc: '固定行高（虚拟化的前提）' },
        { name: 'height', type: 'number', default: '480', desc: '可视区高度' },
      ],
    },
    {
      key: 'tree',
      name: 'Tree',
      nameZh: '树形控件',
      summary: '完整 WAI-ARIA 键盘导航，组织架构与权限树的底盘',
      demo: TreeDemo,
      previewHeight: 240,
      keywords: ['shu', 'tree', 'zuzhi'],
      code: `<Tree
  items={treeItems}
  selectedKey={selected}
  defaultExpandAll
  onSelect={(key) => setSelected(key)}
/>`,
      props: [
        {
          name: 'items',
          type: '{ key: string; title: ReactNode; children?: TreeItem[] }[]',
          desc: '节点（必填）',
        },
        {
          name: 'selectedKey / onSelect',
          type: 'string / (key: string, item: TreeItem) => void',
          desc: '选中项',
        },
        { name: 'defaultExpandAll', type: 'boolean', desc: '默认展开全部节点' },
      ],
    },
    {
      key: 'descriptions',
      name: 'Descriptions',
      nameZh: '详情列表',
      summary: '详情页的标签-值网格，长文本可跨列、可复制',
      demo: DescriptionsDemo,
      wide: true,
      keywords: ['xiangqing', 'descriptions'],
      code: `<Descriptions
  columns={2}
  items={[
    { label: '实例 ID', value: 'nexus-8f2a9c', copyable: true },
    { label: '访问密钥', value: 'sk_live_...', span: 2 },
  ]}
/>`,
      props: [
        {
          name: 'items',
          type: '{ label: string; value: ReactNode; span?: 2|3; copyable?: boolean }[]',
          desc: '条目（必填）',
        },
        { name: 'columns', type: '1 | 2 | 3 | 4', default: '3', desc: '列数' },
        { name: 'layout', type: "'horizontal' | 'vertical'", desc: '标签与值是否同行' },
      ],
    },
    {
      key: 'timeline',
      name: 'Timeline',
      nameZh: '时间线',
      summary: '审批流、操作记录与登录历史的通用表达',
      demo: TimelineDemo,
      previewHeight: 250,
      keywords: ['shijianxian', 'timeline'],
      code: `<Timeline
  items={[
    { key: '1', title: '提交审批', time: '10:24', tone: 'primary' },
    { key: '2', title: '已生效', time: '14:08', tone: 'success' },
  ]}
/>`,
      props: [
        { name: 'items', type: 'TimelineItem[]', desc: 'key / title 必填；tone 决定节点色' },
        {
          name: 'tone',
          type: "'default' | 'primary' | 'success' | 'warning' | 'danger'",
          desc: '节点语义色',
        },
      ],
    },
    {
      key: 'progress',
      name: 'Progress',
      nameZh: '进度条',
      summary: '条形 / 环形 / 分段三种形态，阈值与语义色内置',
      demo: ProgressDemo,
      wide: true,
      previewHeight: 280,
      keywords: ['jindu', 'progress'],
      code: `<Progress value={62} showLabel label="任务完成度" />
<Progress value={78} variant="ring" ringSize={72} label="78%" tone="success" />`,
      props: [
        { name: 'value / max', type: 'number', desc: '当前值与上限（value 必填）' },
        { name: 'variant', type: "'bar' | 'ring' | 'steps'", default: "'bar'", desc: '形态' },
        { name: 'segments', type: '{ value: number; tone?: Tone }[]', desc: '分段条数据' },
        {
          name: 'tone / ringSize',
          type: "'primary' | 'success' | 'warning' | 'danger' / number",
          desc: '颜色与环大小',
        },
      ],
    },
    {
      key: 'progress-ring',
      name: 'Progress.ring',
      nameZh: '环形进度',
      summary: '可交互的环形指标，适合容量与 SLA 展示',
      demo: ProgressRingDemo,
      keywords: ['huanxing', 'ring'],
      code: `<Progress value={percent} variant="ring" ringSize={88} label={\`\${percent}%\`} />`,
    },
    {
      key: 'upload-list',
      name: 'UploadList',
      nameZh: '上传列表',
      summary: '断点重试、进度与错误三态，拖拽区之外的必配件',
      demo: UploadListDemo,
      previewHeight: 210,
      keywords: ['shangchuan', 'upload'],
      code: `<UploadList
  files={files}
  onRemove={(id) => drop(id)}
  onRetry={(id) => retry(id)}
/>`,
      props: [
        {
          name: 'files',
          type: "{ id: string; name: string; size: number; progress: number; status: 'uploading' | 'done' | 'error' }[]",
          desc: '文件列表（必填）',
        },
        { name: 'onRemove / onRetry', type: '(id: string) => void', desc: '删除与重试' },
      ],
    },
    {
      key: 'cell-with-sub',
      name: 'CellWithSub',
      nameZh: '双行单元格',
      summary: '主标题 + 次行说明，表格里最常用的信息密度写法',
      demo: CellWithSubDemo,
      wide: true,
      keywords: ['shuanghang', 'cell'],
      code: `<CellWithSub primary="订单 #NO-8421" secondary="陈彦之 · 10:24" />`,
    },
    {
      key: 'table-toolbar',
      name: 'TableToolbar',
      nameZh: '表格工具栏',
      summary: '选择提示条与批量操作的载荷，替代手写条件渲染',
      demo: TableToolbarDemo,
      wide: true,
      keywords: ['gongjulan', 'toolbar'],
      code: `<TableToolbar
  title="成员列表"
  selectedCount={selected.length}
  onClearSelection={() => setSelected([])}
  batchActions={<Button size="xs">批量停用</Button>}
/>`,
      props: [
        {
          name: 'selectedCount',
          type: 'number',
          desc: '需显式传入（工具条读不到 DataTable 内部状态）',
        },
        { name: 'onClearSelection', type: '() => void', desc: '取消选择' },
        { name: 'batchActions', type: 'ReactNode', desc: '批量操作按钮' },
      ],
    },
    {
      key: 'table-empty',
      name: 'Table 空态',
      nameZh: '空数据',
      summary: '空态不是「什么都不显示」，要给出下一步动作',
      demo: EmptyStateInlineDemo,
      wide: true,
      previewHeight: 220,
      keywords: ['kongtai', 'empty'],
      code: `<DataTable
  rows={[]}
  columns={columns}
  getRowId={(row) => row.id}
  empty={<EmptyState title="还没有数据源" action={<Button size="sm">新建</Button>} />}
/>`,
    },
    {
      key: 'file-list',
      name: 'FileList',
      nameZh: '文件列表',
      summary: '文件管理器的网格条目，用组件组合而来',
      demo: FileListDemo,
      wide: true,
      keywords: ['wenjian', 'file'],
      code: `<div className="flex items-center gap-2 rounded-md border border-line px-2.5 py-2">
  <FileArchive className="size-4" />
  <span className="text-xs">季度报表.xlsx</span>
</div>`,
    },
  ],
}
