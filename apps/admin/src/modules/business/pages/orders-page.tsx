import { useMemo, useState } from 'react'
import {
  CircleCheck,
  CircleX,
  CreditCard,
  Download,
  Ellipsis,
  Package,
  Receipt,
  RefreshCw,
  ShieldAlert,
  Truck,
  Wallet,
} from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  ClipboardText,
  DataTable,
  Descriptions,
  Drawer,
  Dropdown,
  EmptyState,
  Meter,
  PageContainer,
  PageHeader,
  Pagination,
  SearchInput,
  SegmentedControl,
  Select,
  StatCard,
  Timeline,
  cn,
  formatCurrency,
  formatDateTime,
  formatRelativeTime,
  toast,
} from '@nexus/ui'
import type { Column } from '@nexus/ui'
import { useOrderStats, useOrders } from '@/services/queries'
import type { Order, OrderStatus } from '@/types/domain'
import { useDebouncedValue } from '@/core/use-debounce'
import { readDefaultPageSize } from '@/core/use-app-settings'

const STATUS_META: Record<
  OrderStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'primary' }
> = {
  pending: { label: '待支付', tone: 'warning' },
  paid: { label: '已支付', tone: 'primary' },
  shipped: { label: '已发货', tone: 'primary' },
  completed: { label: '已完成', tone: 'success' },
  refunding: { label: '退款中', tone: 'danger' },
  closed: { label: '已关闭', tone: 'neutral' },
}

const CHANNEL_LABEL: Record<Order['channel'], string> = {
  web: '官网',
  app: 'App',
  api: '开放接口',
  offline: '线下',
}

const PAYMENT_LABEL: Record<Order['payment'], string> = {
  wechat: '微信支付',
  alipay: '支付宝',
  bank: '银行转账',
  balance: '余额支付',
}

export default function OrdersPage() {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('all')
  const [channel, setChannel] = useState('all')
  const [riskOnly, setRiskOnly] = useState<'all' | 'high'>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(readDefaultPageSize(10))
  const [detail, setDetail] = useState<Order | null>(null)

  // 输入框即时响应，请求按 300ms 静止后再发
  const debouncedKeyword = useDebouncedValue(keyword, 300)

  const params = useMemo(
    () => ({
      page,
      pageSize,
      keyword: debouncedKeyword,
      status,
      channel,
      risk: riskOnly === 'high' ? 'high' : undefined,
    }),
    [page, pageSize, debouncedKeyword, status, channel, riskOnly],
  )

  const orders = useOrders(params)
  const stats = useOrderStats()

  const columns = useMemo<Column<Order>[]>(
    () => [
      {
        key: 'id',
        header: '订单号',
        width: 170,
        sortValue: (row) => row.id,
        cell: (row) => (
          <div className="min-w-0">
            <ClipboardText value={row.id} truncate={16} />
            <p className="mt-0.5 text-2xs text-fg-4">
              {CHANNEL_LABEL[row.channel]} · {PAYMENT_LABEL[row.payment]}
            </p>
          </div>
        ),
      },
      {
        key: 'customer',
        header: '客户',
        width: 180,
        sortValue: (row) => row.customer,
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-[0.8125rem] text-fg">{row.customer}</p>
            <p className="truncate text-2xs text-fg-3">{row.customerEmail}</p>
          </div>
        ),
      },
      {
        key: 'amount',
        header: '金额',
        width: 130,
        align: 'right',
        sortValue: (row) => row.amount,
        cell: (row) => (
          <span className="font-medium text-fg tabular-nums">{formatCurrency(row.amount)}</span>
        ),
      },
      {
        key: 'status',
        header: '状态',
        width: 110,
        sortValue: (row) => row.status,
        cell: (row) => {
          const meta = STATUS_META[row.status]
          return (
            <Badge tone={meta.tone} dot>
              {meta.label}
            </Badge>
          )
        },
      },
      {
        key: 'riskScore',
        header: '风险分',
        width: 130,
        sortValue: (row) => row.riskScore,
        cell: (row) => (
          <div className="flex items-center gap-2">
            <Meter
              value={row.riskScore}
              className="w-16"
              thresholds={{ warning: 50, danger: 75 }}
            />
            <span
              className={cn(
                'shrink-0 text-xs tabular-nums',
                row.riskScore >= 75
                  ? 'text-danger'
                  : row.riskScore >= 50
                    ? 'text-warning'
                    : 'text-fg-3',
              )}
            >
              {row.riskScore}
            </span>
          </div>
        ),
      },
      {
        key: 'createdAt',
        header: '下单时间',
        width: 120,
        sortValue: (row) => row.createdAt,
        cell: (row) => (
          <span className="text-xs text-fg-3">{formatRelativeTime(row.createdAt)}</span>
        ),
      },
      {
        key: 'actions',
        header: '操作',
        width: 76,
        align: 'right',
        // 订单表列多，操作列固定在右侧
        pinned: 'right',
        cell: (row) => (
          <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
            <Dropdown
              align="end"
              trigger={
                <Button variant="ghost" size="icon-xs" aria-label="更多操作">
                  <Ellipsis className="size-3.5" />
                </Button>
              }
              items={[
                {
                  key: 'detail',
                  label: '查看详情',
                  icon: <Receipt className="size-3.5" />,
                  onSelect: () => setDetail(row),
                },
                {
                  key: 'ship',
                  label: '标记发货',
                  icon: <Truck className="size-3.5" />,
                  onSelect: () => toast.success(`订单 ${row.id} 已标记发货（演示）`),
                },
                {
                  key: 'refund',
                  label: '发起退款',
                  icon: <Wallet className="size-3.5" />,
                  danger: true,
                  onSelect: () => toast.warning('退款需要二次审批（演示）'),
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
        title="订单管理"
        description="订单全生命周期与风控评分，支持批量审核与退款处理"
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={
                <RefreshCw className={cn('size-3.5', orders.isFetching && 'animate-spin')} />
              }
              onClick={() => void orders.refetch()}
            >
              刷新
            </Button>
            <Button
              variant="secondary"
              leftIcon={<Download className="size-3.5" />}
              onClick={() => toast.success('导出任务已创建（演示）')}
            >
              导出
            </Button>
          </>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          label="待支付订单"
          value={stats.data?.pending ?? '—'}
          icon={<CreditCard className="size-4" />}
          tone="warning"
          trend={[12, 18, 15, 22, 19, 26, 24]}
        />
        <StatCard
          label="已支付"
          value={stats.data?.paid ?? '—'}
          icon={<CircleCheck className="size-4" />}
          tone="success"
          delta={3.8}
        />
        <StatCard
          label="退款处理中"
          value={stats.data?.refunding ?? '—'}
          icon={<CircleX className="size-4" />}
          tone="danger"
        />
        <StatCard
          label="累计交易额"
          value={stats.data ? formatCurrency(stats.data.amount).replace('¥', '¥ ') : '—'}
          icon={<Package className="size-4" />}
          tone="primary"
          onLive
        />
      </div>

      {(stats.data?.risky ?? 0) > 0 && (
        <Alert
          tone="danger"
          className="mb-3"
          compact
          title={`检测到 ${stats.data?.risky} 笔高风险订单`}
          action={
            <Button
              size="xs"
              variant="secondary"
              onClick={() => {
                setRiskOnly('high')
                setPage(1)
              }}
            >
              只看高风险
            </Button>
          }
        >
          风险评分 ≥ 70 的订单建议人工复核，系统已自动冻结资金结算。
        </Alert>
      )}

      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <SearchInput
            className="w-full max-w-[16.25rem]"
            value={keyword}
            onChange={(value) => {
              setKeyword(value)
              setPage(1)
            }}
            placeholder="搜索订单号、客户"
          />
          <Select
            className="w-[8.125rem]"
            options={[
              { label: '全部状态', value: 'all' },
              ...Object.entries(STATUS_META).map(([value, meta]) => ({ label: meta.label, value })),
            ]}
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
          />
          <Select
            className="w-[7.75rem]"
            options={[
              { label: '全部渠道', value: 'all' },
              ...Object.entries(CHANNEL_LABEL).map(([value, label]) => ({ label, value })),
            ]}
            value={channel}
            onChange={(value) => {
              setChannel(value)
              setPage(1)
            }}
          />
          <SegmentedControl
            size="sm"
            className="ml-auto"
            options={[
              { label: '全部', value: 'all' },
              { label: '高风险', value: 'high' },
            ]}
            value={riskOnly}
            onChange={(value) => {
              setRiskOnly(value as typeof riskOnly)
              setPage(1)
            }}
          />
        </div>

        <DataTable
          columns={columns}
          rows={orders.data?.items ?? []}
          getRowId={(row) => row.id}
          loading={orders.isLoading}
          onRowClick={setDetail}
          empty={
            <EmptyState size="sm" title="没有匹配的订单" description="调整筛选条件后再试一次。" />
          }
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
      </div>

      <Drawer
        open={Boolean(detail)}
        onOpenChange={(open) => !open && setDetail(null)}
        title="订单详情"
        description={detail?.id}
        width={560}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDetail(null)}>
              关闭
            </Button>
            <Button variant="secondary" onClick={() => toast.success('已生成对账单（演示）')}>
              生成对账单
            </Button>
            <Button variant="primary" onClick={() => toast.success('已标记发货（演示）')}>
              标记发货
            </Button>
          </>
        }
      >
        {detail && (
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-lg border border-line bg-surface-2 p-3">
              <div>
                <p className="text-2xs text-fg-3">订单金额</p>
                <p className="mt-0.5 text-xl font-semibold text-fg tabular-nums">
                  {formatCurrency(detail.amount)}
                </p>
              </div>
              <div className="text-right">
                <Badge tone={STATUS_META[detail.status].tone} dot>
                  {STATUS_META[detail.status].label}
                </Badge>
                <p className="mt-1 text-2xs text-fg-3">{formatDateTime(detail.createdAt)}</p>
              </div>
            </div>

            {detail.riskScore >= 70 && (
              <Alert tone="warning" compact title="风控提示">
                该订单风险评分为 {detail.riskScore}，建议人工核验账号与支付来源。
              </Alert>
            )}

            <Descriptions
              columns={2}
              size="sm"
              items={[
                { label: '订单号', value: detail.id, copyable: true },
                { label: '客户', value: detail.customer },
                { label: '客户邮箱', value: detail.customerEmail },
                { label: '下单渠道', value: CHANNEL_LABEL[detail.channel] },
                { label: '支付方式', value: PAYMENT_LABEL[detail.payment] },
                { label: '风险评分', value: <ShieldAlert className="size-3.5 text-danger" /> },
                { label: '备注', value: detail.remark ?? '—', span: 2 },
              ]}
            />

            <div>
              <h4 className="mb-2 text-xs font-semibold text-fg">商品明细</h4>
              <div className="overflow-hidden rounded-md border border-line">
                <table className="w-full text-xs">
                  <thead className="bg-surface-2 text-fg-3">
                    <tr>
                      <th className="px-2.5 py-1.5 text-left font-medium">商品</th>
                      <th className="px-2.5 py-1.5 text-right font-medium">单价</th>
                      <th className="px-2.5 py-1.5 text-right font-medium">数量</th>
                      <th className="px-2.5 py-1.5 text-right font-medium">小计</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-subtle">
                    {detail.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-2.5 py-1.5">
                          <p className="text-fg">{item.name}</p>
                          <p className="font-mono text-2xs text-fg-4">{item.sku}</p>
                        </td>
                        <td className="px-2.5 py-1.5 text-right text-fg-2 tabular-nums">
                          {formatCurrency(item.price)}
                        </td>
                        <td className="px-2.5 py-1.5 text-right text-fg-2 tabular-nums">
                          ×{item.quantity}
                        </td>
                        <td className="px-2.5 py-1.5 text-right text-fg tabular-nums">
                          {formatCurrency(item.price * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-xs font-semibold text-fg">订单轨迹</h4>
              <Timeline
                items={[
                  {
                    key: 'created',
                    title: '创建订单',
                    description: `${detail.customer} 通过 ${CHANNEL_LABEL[detail.channel]} 下单`,
                    time: formatDateTime(detail.createdAt),
                    tone: 'primary',
                  },
                  {
                    key: 'paid',
                    title: '支付成功',
                    description: `通过${PAYMENT_LABEL[detail.payment]}完成支付`,
                    time: formatDateTime(detail.createdAt),
                    tone: 'success',
                  },
                  {
                    key: 'risk',
                    title: '风控校验',
                    description: `风险评分 ${detail.riskScore}，${detail.riskScore >= 70 ? '需人工复核' : '自动通过'}`,
                    time: formatDateTime(detail.createdAt),
                    tone: detail.riskScore >= 70 ? 'warning' : 'success',
                  },
                ]}
              />
            </div>
          </div>
        )}
      </Drawer>
    </PageContainer>
  )
}
