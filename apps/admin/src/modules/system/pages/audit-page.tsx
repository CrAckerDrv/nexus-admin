import { useMemo, useState } from 'react'
import { Download, FileText, ListFilter, ShieldAlert, ShieldCheck } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  PageContainer,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  SegmentedControl,
  StatCard,
  Timeline,
  cn,
  formatDateTime,
  formatRelativeTime,
  toast,
} from '@nexus/ui'
import type { Column } from '@nexus/ui'
import { useAuditLogs, useAuditStats } from '@/services/queries'
import type { AuditAction, AuditLog } from '@/types/domain'
import { useDebouncedValue } from '@/core/use-debounce'
import { readDefaultPageSize } from '@/core/use-app-settings'

const ACTION_META: Record<
  AuditAction,
  { label: string; tone: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  create: { label: '创建', tone: 'success' },
  update: { label: '更新', tone: 'primary' },
  delete: { label: '删除', tone: 'danger' },
  login: { label: '登录', tone: 'neutral' },
  export: { label: '导出', tone: 'warning' },
  approve: { label: '审批', tone: 'success' },
}

export default function AuditPage() {
  const [keyword, setKeyword] = useState('')
  const [action, setAction] = useState('all')
  const [result, setResult] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(readDefaultPageSize(15))
  const [view, setView] = useState<'table' | 'timeline'>('table')

  // 输入框即时响应，请求按 300ms 静止后再发
  const debouncedKeyword = useDebouncedValue(keyword, 300)

  const params = useMemo(
    () => ({ page, pageSize, keyword: debouncedKeyword, action, result }),
    [page, pageSize, debouncedKeyword, action, result],
  )
  const logs = useAuditLogs(params)
  const stats = useAuditStats()

  const columns = useMemo<Column<AuditLog>[]>(
    () => [
      {
        key: 'actor',
        header: '操作人',
        width: 170,
        cell: (row) => (
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={row.actor} size="xs" />
            <div className="min-w-0">
              <p className="truncate text-[0.8125rem] text-fg">{row.actor}</p>
              <p className="truncate text-2xs text-fg-3">{row.actorRole}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'action',
        header: '动作',
        width: 88,
        cell: (row) => (
          <Badge tone={ACTION_META[row.action].tone} size="sm">
            {ACTION_META[row.action].label}
          </Badge>
        ),
      },
      {
        key: 'target',
        header: '操作对象',
        width: 220,
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-[0.8125rem] text-fg-2">{row.target}</p>
            <p className="truncate text-2xs text-fg-4">{row.detail}</p>
          </div>
        ),
      },
      {
        key: 'result',
        header: '结果',
        width: 84,
        cell: (row) =>
          row.result === 'success' ? (
            <span className="inline-flex items-center gap-1 text-2xs text-success">
              <ShieldCheck className="size-3" /> 成功
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-2xs text-danger">
              <ShieldAlert className="size-3" /> 失败
            </span>
          ),
      },
      {
        key: 'ip',
        header: 'IP / 终端',
        width: 150,
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-mono text-2xs text-fg-2">{row.ip}</p>
            <p className="truncate text-2xs text-fg-4">{row.ua}</p>
          </div>
        ),
      },
      {
        key: 'time',
        header: '时间',
        width: 128,
        align: 'right',
        cell: (row) => (
          <span className="text-xs text-fg-3 tabular-nums" title={formatDateTime(row.time, true)}>
            {formatRelativeTime(row.time)}
          </span>
        ),
        sortValue: (row) => row.time,
      },
    ],
    [],
  )

  return (
    <PageContainer size="lg">
      <PageHeader
        title="审计日志"
        description="记录所有敏感操作，支持按操作人、动作与结果检索"
        badge={<Badge tone="success">合规</Badge>}
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<FileText className="size-3.5" />}
              onClick={() => toast.info('演示环境：查看合规报告')}
            >
              合规报告
            </Button>
            <Button
              variant="primary"
              leftIcon={<Download className="size-3.5" />}
              onClick={() => toast.success('导出任务已创建（演示）')}
            >
              导出日志
            </Button>
          </>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          label="日志总数"
          value={stats.data?.total ?? '—'}
          icon={<ListFilter className="size-4" />}
          tone="primary"
        />
        <StatCard
          label="今日操作"
          value={stats.data?.today ?? '—'}
          icon={<ShieldCheck className="size-4" />}
          tone="success"
        />
        <StatCard
          label="失败操作"
          value={stats.data?.failure ?? '—'}
          icon={<ShieldAlert className="size-4" />}
          tone="danger"
        />
        <StatCard label="活跃操作人" value={stats.data?.actors ?? '—'} tone="warning" />
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <SearchInput
            className="w-full max-w-[16.25rem]"
            value={keyword}
            onChange={(value) => {
              setKeyword(value)
              setPage(1)
            }}
            placeholder="搜索操作人、对象或详情"
          />
          <Select
            className="w-[7.5rem]"
            options={[
              { label: '全部动作', value: 'all' },
              ...Object.entries(ACTION_META).map(([value, meta]) => ({ label: meta.label, value })),
            ]}
            value={action}
            onChange={(value) => {
              setAction(value)
              setPage(1)
            }}
          />
          <Select
            className="w-[7.5rem]"
            options={[
              { label: '全部结果', value: 'all' },
              { label: '成功', value: 'success' },
              { label: '失败', value: 'failure' },
            ]}
            value={result}
            onChange={(value) => {
              setResult(value)
              setPage(1)
            }}
          />
          <SegmentedControl
            className="ml-auto"
            size="sm"
            options={[
              { label: '表格', value: 'table' },
              { label: '时间线', value: 'timeline' },
            ]}
            value={view}
            onChange={(value) => setView(value as typeof view)}
          />
        </div>

        {view === 'table' ? (
          <DataTable
            columns={columns}
            rows={logs.data?.items ?? []}
            getRowId={(row) => row.id}
            loading={logs.isLoading}
            empty={<EmptyState size="sm" title="没有匹配的日志" />}
          />
        ) : (
          <div className="p-4">
            <Timeline
              items={(logs.data?.items ?? []).slice(0, 12).map((log, index) => ({
                key: `${log.id}-${index}`,
                title: (
                  <span>
                    <span className="font-medium text-fg">{log.actor}</span>
                    <span className="text-fg-3"> 在 {log.target} 执行了 </span>
                    <span className={cn(log.result === 'failure' ? 'text-danger' : 'text-success')}>
                      {ACTION_META[log.action].label}
                    </span>
                    <span className="text-fg-3"> 操作</span>
                  </span>
                ),
                description: log.detail,
                time: formatDateTime(log.time, true),
                tone:
                  log.result === 'failure'
                    ? 'danger'
                    : log.action === 'delete'
                      ? 'warning'
                      : 'success',
                meta: (
                  <div className="flex flex-wrap gap-1.5 text-2xs">
                    <span className="rounded-sm bg-surface-2 px-1.5 py-0.5 font-mono text-fg-3">
                      {log.ip}
                    </span>
                    <span className="rounded-sm bg-surface-2 px-1.5 py-0.5 text-fg-3">
                      {log.ua}
                    </span>
                  </div>
                ),
              }))}
            />
          </div>
        )}

        <div className="border-t border-line p-3">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={logs.data?.total ?? 0}
            pageSizeOptions={[15, 30, 50]}
            onChange={(nextPage, nextSize) => {
              setPage(nextPage)
              setPageSize(nextSize)
            }}
          />
        </div>
      </div>

      <Card className="mt-3">
        <h3 className="text-xs font-semibold text-fg">关于审计日志</h3>
        <p className="mt-1 text-xs leading-5 text-fg-3">
          审计日志默认保留 180 天，支持按操作人、动作类型、结果与时间范围组合检索。
          真实接入时建议将日志写入只读存储，并对导出行为本身也进行审计。
        </p>
      </Card>
    </PageContainer>
  )
}
