import { useMemo, useState } from 'react'
import { ArrowDownUp, Download, Ellipsis, Pencil, Plus, Trash, Zap } from 'lucide-react'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  CellWithSub,
  CodeBlock,
  DataTable,
  Dropdown,
  Meter,
  PageContainer,
  PageHeader,
  Pagination,
  SearchInput,
  SectionCard,
  SegmentedControl,
  Select,
  StatCard,
  TableToolbar,
  VirtualTable,
  formatCurrency,
  formatRelativeTime,
  toast,
} from '@nexus/ui'
import type { Column } from '@nexus/ui'
import { useOrders } from '@/services/queries'
import type { Order } from '@/types/domain'
import { readDefaultPageSize } from '@/core/use-app-settings'

const TOTAL_MOCK = 5000

function makeRows(count: number): Order[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `NO${20261100000 + index}`,
    customer: `客户 ${index + 1}`,
    customerEmail: `customer${index + 1}@example.com`,
    amount: (index % 97) * 128 + 199,
    status: (['pending', 'paid', 'shipped', 'completed', 'refunding', 'closed'] as const)[
      index % 6
    ]!,
    items: [],
    payment: (['wechat', 'alipay', 'bank', 'balance'] as const)[index % 4]!,
    channel: (['web', 'app', 'api', 'offline'] as const)[index % 4]!,
    riskScore: (index * 7) % 100,
    createdAt: new Date(Date.now() - index * 3600_000).toISOString(),
  }))
}

export default function TablesPage() {
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(readDefaultPageSize(10))
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [mode, setMode] = useState<'basic' | 'virtual'>('basic')

  const orders = useOrders({ page, pageSize, keyword })
  const virtualRows = useMemo(() => makeRows(TOTAL_MOCK), [])

  const columns = useMemo<Column<Order>[]>(
    () => [
      {
        key: 'id',
        header: '订单号',
        width: 160,
        sortValue: (row) => row.id,
        cell: (row) => (
          <CellWithSub
            primary={<span className="font-mono text-xs">{row.id}</span>}
            secondary={row.customerEmail}
          />
        ),
      },
      {
        key: 'customer',
        header: '客户',
        width: 150,
        sortValue: (row) => row.customer,
        cell: (row) => (
          <div className="flex items-center gap-2">
            <Avatar name={row.customer} size="xs" />
            <span className="truncate text-[0.8125rem] text-fg">{row.customer}</span>
          </div>
        ),
      },
      {
        key: 'amount',
        header: '金额',
        width: 120,
        align: 'right',
        sortValue: (row) => row.amount,
        cell: (row) => (
          <span className="font-medium text-fg tabular-nums">{formatCurrency(row.amount)}</span>
        ),
      },
      {
        key: 'status',
        header: '状态',
        width: 100,
        cell: (row) => {
          const meta = {
            pending: { label: '待支付', tone: 'warning' as const },
            paid: { label: '已支付', tone: 'primary' as const },
            shipped: { label: '已发货', tone: 'primary' as const },
            completed: { label: '已完成', tone: 'success' as const },
            refunding: { label: '退款中', tone: 'danger' as const },
            closed: { label: '已关闭', tone: 'neutral' as const },
          }[row.status]
          return (
            <Badge tone={meta.tone} dot>
              {meta.label}
            </Badge>
          )
        },
      },
      {
        key: 'riskScore',
        header: '风险',
        width: 120,
        sortValue: (row) => row.riskScore,
        cell: (row) => (
          <Meter value={row.riskScore} showValue thresholds={{ warning: 50, danger: 75 }} />
        ),
      },
      {
        key: 'createdAt',
        header: '创建时间',
        width: 120,
        align: 'right',
        sortValue: (row) => row.createdAt,
        cell: (row) => (
          <span className="text-xs text-fg-3">{formatRelativeTime(row.createdAt)}</span>
        ),
      },
      {
        key: 'actions',
        header: '操作',
        width: 88,
        align: 'right',
        cell: () => (
          <div className="flex items-center justify-end gap-0.5">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="编辑"
              onClick={() => toast.info('编辑')}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Dropdown
              align="end"
              trigger={
                <Button variant="ghost" size="icon-xs" aria-label="更多">
                  <Ellipsis className="size-3.5" />
                </Button>
              }
              items={[
                { key: 'export', label: '导出单条记录', onSelect: () => toast.success('已导出') },
                { key: 'copy', label: '复制订单号', onSelect: () => toast.success('已复制') },
                'divider',
                {
                  key: 'delete',
                  label: '删除记录',
                  danger: true,
                  icon: <Trash className="size-3.5" />,
                  onSelect: () => toast.warning('演示环境：删除需二次确认'),
                },
              ]}
            />
          </div>
        ),
      },
    ],
    [],
  )

  return (
    <PageContainer size="lg">
      <PageHeader
        title="数据表格"
        description="从基础表格到 1 万行虚拟滚动，覆盖后台最高频的数据展示场景"
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<Download className="size-3.5" />}
              onClick={() => toast.success('导出任务已创建')}
            >
              导出
            </Button>
            <Button
              variant="primary"
              leftIcon={<Plus className="size-3.5" />}
              onClick={() => toast.info('演示环境：新建记录')}
            >
              新建记录
            </Button>
          </>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          label="示例数据量"
          value="5,000"
          suffix="行"
          icon={<ArrowDownUp className="size-4" />}
          tone="primary"
        />
        <StatCard
          label="虚拟滚动渲染"
          value="≈60"
          suffix="行/帧"
          icon={<Zap className="size-4" />}
          tone="success"
        />
        <StatCard label="列配置" value="7" suffix="列" tone="warning" />
        <StatCard label="表格高度" value="480" suffix="px" tone="neutral" />
      </div>

      <Alert tone="info" className="mb-3" compact title="虚拟滚动原理">
        容器只渲染可视区 ±8 行，滚动时通过{' '}
        <code className="rounded bg-surface-2 px-1 font-mono text-2xs">transform</code> 复用行节点。
        默认 5,000 行数据，滚动到任意位置均为 60fps。
      </Alert>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SegmentedControl
          options={[
            { label: '服务端分页表格', value: 'basic' },
            { label: '虚拟滚动表格', value: 'virtual' },
          ]}
          value={mode}
          onChange={(value) => setMode(value as typeof mode)}
        />
        <div className="ml-auto flex items-center gap-2">
          <SearchInput
            className="w-[13.75rem]"
            value={keyword}
            onChange={(value) => {
              setKeyword(value)
              setPage(1)
            }}
            placeholder="搜索订单"
            size="sm"
          />
        </div>
      </div>

      {mode === 'basic' ? (
        <SectionCard
          title="服务端分页"
          description="数据来自 Mock 接口，支持排序、选择与批量操作"
          extra={<Badge tone="primary">{orders.data?.total ?? 0} 条</Badge>}
          bodyClassName="px-0"
        >
          <div className="px-3 pb-3">
            <TableToolbar
              selectedCount={selectedIds.length}
              onClearSelection={() => setSelectedIds([])}
              batchActions={
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => toast.success(`已标记 ${selectedIds.length} 条记录`)}
                >
                  批量标记
                </Button>
              }
            />
          </div>
          <DataTable
            columns={columns}
            rows={orders.data?.items ?? []}
            getRowId={(row) => row.id}
            loading={orders.isLoading}
            selectable
            selectedIds={selectedIds}
            onSelectedChange={setSelectedIds}
            defaultSort={{ key: 'createdAt', dir: 'desc' }}
          />
          <div className="border-t border-line p-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={orders.data?.total ?? 0}
              onChange={(nextPage, nextSize) => {
                setPage(nextPage)
                setPageSize(nextSize)
              }}
            />
          </div>
        </SectionCard>
      ) : (
        <SectionCard
          title="虚拟滚动"
          description="固定行高 + 窗口化渲染，适合日志、明细等超长列表"
          extra={<Badge tone="success">5,000 行</Badge>}
          bodyClassName="px-0"
        >
          <VirtualTable
            columns={columns.filter((column) => column.key !== 'actions')}
            rows={virtualRows}
            getRowId={(row) => row.id}
            rowHeight={40}
            height={440}
            selectable
            selectedIds={selectedIds}
            onSelectedChange={setSelectedIds}
            onRowClick={(row) => toast.info(`点击了 ${row.id}`)}
          />
        </SectionCard>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SectionCard title="列配置" description="通过 Column 描述列，渲染与数据解耦">
          <div className="p-3">
            <CodeBlock
              language="tsx"
              filename="列定义"
              maxHeight={300}
              code={`const columns: Column<Order>[] = [
  {
    key: 'id',
    header: '订单号',
    width: 160,
    sortValue: (row) => row.id,        // 提供即开启排序
    cell: (row) => <span>{row.id}</span>,
  },
  {
    key: 'amount',
    header: '金额',
    align: 'right',
    cell: (row) => formatCurrency(row.amount),
  },
]

<DataTable
  columns={columns}
  rows={data}
  getRowId={(row) => row.id}
  selectable
  onSelectedChange={setSelectedIds}
/>`}
            />
          </div>
        </SectionCard>

        <SectionCard title="性能建议" description="大数据量下的三条实践">
          <div className="space-y-2.5 p-3 text-xs leading-5 text-fg-3">
            <p>
              <strong className="text-fg">1. 固定行高。</strong>
              虚拟滚动依赖固定行高计算偏移，动态高度会显著增加复杂度。
            </p>
            <p>
              <strong className="text-fg">2. 避免在单元格里创建新对象。</strong>传给 cell
              的渲染函数应尽量稳定，必要时用
              <code className="rounded bg-surface-2 px-1 font-mono text-2xs">useMemo</code>{' '}
              缓存列定义。
            </p>
            <p>
              <strong className="text-fg">3. 分页优先。</strong>超过 1
              万行建议服务端分页；只有在必须整体浏览时使用虚拟滚动。
            </p>
            <div className="rounded-md border border-line bg-surface-2 p-2.5">
              <Select
                className="w-full"
                options={[
                  { label: '默认排序：创建时间倒序', value: 'created_desc' },
                  { label: '金额从高到低', value: 'amount_desc' },
                  { label: '风险分从高到低', value: 'risk_desc' },
                ]}
                defaultValue="created_desc"
                onChange={() => toast.info('演示：切换排序策略')}
              />
            </div>
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  )
}
