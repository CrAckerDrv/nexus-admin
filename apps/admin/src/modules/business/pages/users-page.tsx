import { useMemo, useState } from 'react'
import {
  CirclePlus,
  Download,
  Ellipsis,
  Mail,
  Pencil,
  RefreshCw,
  Trash,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Descriptions,
  Drawer,
  Dropdown,
  EmptyState,
  FormField,
  Input,
  PageContainer,
  PageHeader,
  Pagination,
  RadioGroup,
  SearchInput,
  SegmentedControl,
  Select,
  StatCard,
  TableToolbar,
  Tooltip,
  cn,
  formatRelativeTime,
  toast,
  useLocalStorageState,
} from '@nexus/ui'
import type { Column } from '@nexus/ui'
import {
  useCreateUser,
  useDeleteUser,
  useUpdateUser,
  useUserStats,
  useUsers,
} from '@/services/queries'
import type { User, UserRole, UserStatus } from '@/types/domain'
import { useAuthStore } from '@/core/auth-store'
import { useDebouncedValue } from '@/core/use-debounce'
import { readDefaultPageSize } from '@/core/use-app-settings'

const STATUS_META: Record<
  UserStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  active: { label: '正常', tone: 'success' },
  invited: { label: '待接受邀请', tone: 'warning' },
  disabled: { label: '已停用', tone: 'neutral' },
  locked: { label: '已锁定', tone: 'danger' },
}

const ROLE_OPTIONS = [
  { label: '超级管理员', value: 'super_admin' },
  { label: '管理员', value: 'admin' },
  { label: '运营专员', value: 'operator' },
  { label: '审计员', value: 'auditor' },
  { label: '只读访客', value: 'viewer' },
]

const STATUS_OPTIONS = [
  { label: '正常', value: 'active' },
  { label: '待接受邀请', value: 'invited' },
  { label: '已停用', value: 'disabled' },
  { label: '已锁定', value: 'locked' },
]

export default function UsersPage() {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('all')
  const [role, setRole] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(readDefaultPageSize(10))
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [detail, setDetail] = useState<User | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [density, setDensity] = useState<'table' | 'grid'>('table')
  /**
   * 列可见性
   *
   * 之前「列设置」是个空按钮 —— 点了没反应。这里落成真实能力：
   * 用 `useLocalStorageState` 持久化，刷新后保持用户上次的选择。
   */
  const [visibleColumns, setVisibleColumns] = useLocalStorageState<string[]>(
    'nexus.users.columns',
    ['name', 'department', 'role', 'status', 'mfa', 'lastActiveAt', 'actions'],
  )

  const hasPermission = useAuthStore((state) => state.hasPermission)
  const canWrite = hasPermission('user:write')

  // 输入框即时响应，请求按 300ms 静止后再发：避免每敲一个字打一次接口
  const debouncedKeyword = useDebouncedValue(keyword, 300)

  const params = useMemo(
    () => ({ page, pageSize, keyword: debouncedKeyword, status, role }),
    [page, pageSize, debouncedKeyword, status, role],
  )

  const users = useUsers(params)
  const stats = useUserStats()
  const deleteUser = useDeleteUser()
  const updateUser = useUpdateUser()
  const createUser = useCreateUser()

  const columns = useMemo<Column<User>[]>(
    () => [
      {
        key: 'name',
        header: '用户',
        width: 240,
        sortValue: (row) => row.name,
        cell: (row) => (
          <div className="flex min-w-0 items-center gap-2">
            <Avatar
              name={row.name}
              size="sm"
              status={row.status === 'active' ? 'online' : 'offline'}
            />
            <div className="min-w-0">
              <p className="truncate text-[0.8125rem] font-medium text-fg">{row.name}</p>
              <p className="truncate text-2xs text-fg-3">{row.email}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'department',
        header: '部门 / 职位',
        width: 190,
        sortValue: (row) => row.department,
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-[0.8125rem] text-fg-2">{row.department}</p>
            <p className="truncate text-2xs text-fg-3">{row.title}</p>
          </div>
        ),
      },
      {
        key: 'role',
        header: '角色',
        width: 130,
        sortValue: (row) => row.role,
        cell: (row) => (
          <Badge
            tone={
              row.role === 'super_admin' ? 'danger' : row.role === 'admin' ? 'primary' : 'neutral'
            }
            variant="soft"
          >
            {row.roleName}
          </Badge>
        ),
      },
      {
        key: 'status',
        header: '状态',
        width: 130,
        sortValue: (row) => row.status,
        cell: (row) => {
          const meta = STATUS_META[row.status]
          return (
            <span className="inline-flex items-center gap-1.5">
              <Badge tone={meta.tone} dot>
                {meta.label}
              </Badge>
            </span>
          )
        },
      },
      {
        key: 'mfa',
        header: '两步验证',
        width: 96,
        align: 'center',
        cell: (row) =>
          row.mfa ? (
            <Badge tone="success" variant="outline">
              已启用
            </Badge>
          ) : (
            <span className="text-2xs text-fg-4">未启用</span>
          ),
      },
      {
        key: 'lastActiveAt',
        header: '最近活跃',
        width: 130,
        sortValue: (row) => row.lastActiveAt,
        cell: (row) => (
          <span className="text-xs text-fg-3">{formatRelativeTime(row.lastActiveAt)}</span>
        ),
      },
      {
        key: 'actions',
        header: '操作',
        width: 92,
        align: 'right',
        // 宽表横向滚动时把操作列钉在右侧
        pinned: 'right',
        cell: (row) => (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            <Tooltip content="查看详情">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="查看"
                onClick={() => setDetail(row)}
              >
                <Users className="size-3.5" />
              </Button>
            </Tooltip>
            <Dropdown
              align="end"
              trigger={
                <Button variant="ghost" size="icon-xs" aria-label="更多操作">
                  <Ellipsis className="size-3.5" />
                </Button>
              }
              items={[
                {
                  key: 'edit',
                  label: '编辑资料',
                  icon: <Pencil className="size-3.5" />,
                  disabled: !canWrite,
                  onSelect: () => toast.info(`演示环境：编辑 ${row.name}`),
                },
                {
                  key: 'enable',
                  label: row.status === 'disabled' ? '启用账号' : '停用账号',
                  icon:
                    row.status === 'disabled' ? (
                      <UserCheck className="size-3.5" />
                    ) : (
                      <UserX className="size-3.5" />
                    ),
                  disabled: !canWrite,
                  onSelect: async () => {
                    await updateUser.mutateAsync({
                      id: row.id,
                      patch: { status: row.status === 'disabled' ? 'active' : 'disabled' },
                    })
                    toast.success(row.status === 'disabled' ? '账号已启用' : '账号已停用')
                  },
                },
                {
                  key: 'mail',
                  label: '发送邮件',
                  icon: <Mail className="size-3.5" />,
                  onSelect: () => toast.success(`已向 ${row.email} 发送邮件（演示）`),
                },
                'divider',
                {
                  key: 'delete',
                  label: '删除用户',
                  icon: <Trash className="size-3.5" />,
                  danger: true,
                  disabled: !canWrite,
                  onSelect: () => setDeleteTarget(row),
                },
              ]}
            />
          </div>
        ),
      },
    ],
    [canWrite, updateUser],
  )

  const rows = users.data?.items ?? []
  const total = users.data?.total ?? 0

  /**
   * 可切换的列清单
   *
   * 「操作」列不允许隐藏 —— 隐藏后用户就没有任何入口修改数据了。
   */
  const COLUMN_TOGGLES = [
    { key: 'department', label: '部门 / 职位', locked: false },
    { key: 'role', label: '角色', locked: false },
    { key: 'status', label: '状态', locked: false },
    { key: 'mfa', label: '两步验证', locked: false },
    { key: 'lastActiveAt', label: '最近活跃', locked: false },
    { key: 'actions', label: '操作', locked: true },
  ] as const

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    )
  }

  /** 按可见性过滤列，同时保持原列顺序 */
  const effectiveColumns = useMemo(
    () => columns.filter((column) => visibleColumns.includes(column.key)),
    [columns, visibleColumns],
  )

  return (
    <PageContainer size="lg">
      <PageHeader
        title="用户管理"
        description="管理组织成员、角色分配与账号安全状态"
        breadcrumb={
          <nav className="flex items-center gap-1 text-xs text-fg-3">
            <span>业务管理</span>
            <span className="text-fg-4">/</span>
            <span className="text-fg">用户管理</span>
          </nav>
        }
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={
                <RefreshCw className={cn('size-3.5', users.isFetching && 'animate-spin')} />
              }
              onClick={() => void users.refetch()}
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
            <Button
              variant="primary"
              leftIcon={<CirclePlus className="size-3.5" />}
              disabled={!canWrite}
              onClick={() => setCreateOpen(true)}
            >
              新建用户
            </Button>
          </>
        }
      />

      {!canWrite && (
        <Alert tone="warning" className="mb-3" compact title="当前角色为只读">
          你以「{useAuthStore.getState().user?.roleName}
          」身份登录，写操作已禁用。切回管理员账号可体验完整功能。
        </Alert>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          label="全部用户"
          value={stats.data?.total ?? '—'}
          icon={<Users className="size-4" />}
          tone="primary"
          trend={[42, 48, 51, 60, 58, 66, 72]}
        />
        <StatCard
          label="活跃账号"
          value={stats.data?.active ?? '—'}
          icon={<UserCheck className="size-4" />}
          tone="success"
          delta={5.4}
        />
        <StatCard
          label="待接受邀请"
          value={stats.data?.invited ?? '—'}
          icon={<Mail className="size-4" />}
          tone="warning"
        />
        <StatCard
          label="启用两步验证"
          value={stats.data?.mfa ?? '—'}
          icon={<UserX className="size-4" />}
          tone="danger"
          suffix="人"
        />
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
            placeholder="搜索姓名、邮箱或手机号"
          />
          <Select
            className="w-[8.25rem]"
            options={[{ label: '全部状态', value: 'all' }, ...STATUS_OPTIONS]}
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
          />
          <Select
            className="w-[8.75rem]"
            options={[{ label: '全部角色', value: 'all' }, ...ROLE_OPTIONS]}
            value={role}
            onChange={(value) => {
              setRole(value)
              setPage(1)
            }}
          />
          <div className="ml-auto flex items-center gap-2">
            <SegmentedControl
              size="sm"
              options={[
                { label: '表格', value: 'table' },
                { label: '详情', value: 'grid' },
              ]}
              value={density}
              onChange={(value) => setDensity(value as typeof density)}
            />
            <Dropdown
              align="end"
              width={196}
              trigger={
                <Button variant="secondary" size="sm">
                  列设置
                </Button>
              }
              items={COLUMN_TOGGLES.map((item) => ({
                key: item.key,
                label: (
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'grid size-3.5 shrink-0 place-items-center rounded-[0.1875rem] border',
                        visibleColumns.includes(item.key)
                          ? 'border-primary bg-primary text-primary-fg'
                          : 'border-line-strong',
                      )}
                    >
                      {visibleColumns.includes(item.key) && (
                        <svg
                          viewBox="0 0 24 24"
                          className="size-2.5"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="m5 12.5 4.5 4.5L19 7"
                            stroke="currentColor"
                            strokeWidth="3.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    <span className={cn(item.locked && 'text-fg-4')}>{item.label}</span>
                  </span>
                ),
                disabled: item.locked,
                onSelect: () => toggleColumn(item.key),
              }))}
            />
          </div>
        </div>

        <div className="p-0">
          {density === 'table' ? (
            <DataTable
              columns={effectiveColumns}
              rows={rows}
              getRowId={(row) => row.id}
              loading={users.isLoading}
              selectable
              selectedIds={selectedIds}
              onSelectedChange={setSelectedIds}
              onRowClick={(row) => setDetail(row)}
              minRows={pageSize > 10 ? 10 : pageSize}
              empty={
                <EmptyState
                  size="sm"
                  title="没有匹配的用户"
                  description="试试调整筛选条件，或新建一个用户。"
                  action={
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => setCreateOpen(true)}
                      disabled={!canWrite}
                    >
                      新建用户
                    </Button>
                  }
                />
              }
            />
          ) : (
            <UserCardGrid rows={rows} loading={users.isLoading} onSelect={setDetail} />
          )}
        </div>

        <div className="border-t border-line px-3 py-2.5">
          <TableToolbar
            selectedCount={selectedIds.length}
            onClearSelection={() => setSelectedIds([])}
            batchActions={
              <>
                <Button
                  size="xs"
                  variant="secondary"
                  disabled={!canWrite}
                  onClick={async () => {
                    await Promise.all(
                      selectedIds.map((id) =>
                        updateUser.mutateAsync({ id, patch: { status: 'active' } }),
                      ),
                    )
                    toast.success(`已启用 ${selectedIds.length} 个账号`)
                    setSelectedIds([])
                  }}
                >
                  批量启用
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={!canWrite}
                  onClick={async () => {
                    await Promise.all(
                      selectedIds.map((id) =>
                        updateUser.mutateAsync({ id, patch: { status: 'disabled' } }),
                      ),
                    )
                    toast.success(`已停用 ${selectedIds.length} 个账号`)
                    setSelectedIds([])
                  }}
                >
                  批量停用
                </Button>
              </>
            }
          />
          {selectedIds.length === 0 && (
            <Pagination
              className="mt-2"
              page={page}
              pageSize={pageSize}
              total={total}
              onChange={(nextPage, nextSize) => {
                setPage(nextPage)
                setPageSize(nextSize)
              }}
            />
          )}
        </div>
      </div>

      <UserDetailDrawer
        user={detail}
        onClose={() => setDetail(null)}
        onDelete={(user) => {
          setDetail(null)
          setDeleteTarget(user)
        }}
        canWrite={canWrite}
      />

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={async (payload) => {
          await createUser.mutateAsync(payload)
          toast.success('用户已创建，邀请邮件已发送（演示）')
          setCreateOpen(false)
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="删除用户"
        description={`确认删除「${deleteTarget?.name}」吗？该操作不可撤销。`}
        danger
        confirmText="删除"
        loading={deleteUser.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return
          await deleteUser.mutateAsync(deleteTarget.id)
          toast.success('用户已删除')
          setDeleteTarget(null)
        }}
      />
    </PageContainer>
  )

  function CreateUserDialog({
    open,
    onOpenChange,
    onSubmit,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSubmit: (payload: Partial<User>) => Promise<void>
  }) {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [department, setDepartment] = useState('平台技术部')
    const [newRole, setNewRole] = useState<UserRole>('viewer')
    const [saving, setSaving] = useState(false)

    return (
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        title="新建用户"
        description="创建后将发送邀请邮件，用户点击链接完成激活。"
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              loading={saving}
              onClick={async () => {
                if (!name.trim() || !email.trim()) {
                  toast.warning('请填写姓名与邮箱')
                  return
                }
                setSaving(true)
                try {
                  await onSubmit({ name, email, department, role: newRole })
                } finally {
                  setSaving(false)
                }
              }}
            >
              创建并邀请
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="姓名" required>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="请输入真实姓名"
            />
          </FormField>
          <FormField label="邮箱" required hint="邀请链接将发送到该邮箱">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
            />
          </FormField>
          <FormField label="部门">
            <Select
              options={[
                { label: '平台技术部', value: '平台技术部' },
                { label: '用户增长组', value: '用户增长组' },
                { label: '内容运营组', value: '内容运营组' },
                { label: '数据智能组', value: '数据智能组' },
                { label: '客户成功部', value: '客户成功部' },
              ]}
              value={department}
              onChange={setDepartment}
            />
          </FormField>
          <FormField label="角色" hint="角色决定该用户可访问的页面与操作">
            <RadioGroup
              card
              options={ROLE_OPTIONS.map((option) => ({
                label: option.label,
                value: option.value,
                description:
                  option.value === 'super_admin'
                    ? '拥有全部权限，谨慎授予'
                    : option.value === 'viewer'
                      ? '仅可查看被授权数据'
                      : '常规业务操作权限',
              }))}
              value={newRole}
              onChange={(value) => setNewRole(value as UserRole)}
            />
          </FormField>
        </div>
      </Drawer>
    )
  }
}

function UserCardGrid({
  rows,
  loading,
  onSelect,
}: {
  rows: User[]
  loading: boolean
  onSelect: (user: User) => void
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="n-skeleton h-[5.75rem] rounded-md" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => {
        const meta = STATUS_META[row.status]
        return (
          <button
            key={row.id}
            type="button"
            onClick={() => onSelect(row)}
            className="flex items-start gap-2.5 rounded-md border border-line p-3 text-left transition-colors hover:border-primary/35 hover:bg-primary-weak/30"
          >
            <Avatar name={row.name} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[0.8125rem] font-medium text-fg">{row.name}</p>
                <Badge tone={meta.tone} size="sm">
                  {meta.label}
                </Badge>
              </div>
              <p className="truncate text-2xs text-fg-3">{row.email}</p>
              <p className="mt-1 flex items-center gap-1 text-2xs text-fg-4">
                <span className="truncate">{row.department}</span>
                <span>·</span>
                <span className="shrink-0">{row.roleName}</span>
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function UserDetailDrawer({
  user,
  onClose,
  onDelete,
  canWrite,
}: {
  user: User | null
  onClose: () => void
  onDelete: (user: User) => void
  canWrite: boolean
}) {
  return (
    <Drawer
      open={Boolean(user)}
      onOpenChange={(open) => !open && onClose()}
      title={user?.name ?? '用户详情'}
      description={user?.email}
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            关闭
          </Button>
          <Button
            variant="danger"
            disabled={!canWrite || !user}
            onClick={() => user && onDelete(user)}
          >
            删除
          </Button>
          <Button
            variant="primary"
            disabled={!canWrite}
            onClick={() => toast.info('演示环境：保存资料')}
          >
            编辑资料
          </Button>
        </>
      }
    >
      {user && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 p-3">
            <Avatar
              name={user.name}
              size={48}
              status={user.status === 'active' ? 'online' : 'offline'}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-fg">{user.name}</p>
                <Badge tone={STATUS_META[user.status].tone} dot>
                  {STATUS_META[user.status].label}
                </Badge>
              </div>
              <p className="truncate text-xs text-fg-3">
                {user.department} · {user.title}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {user.tags.length > 0 ? (
                  user.tags.map((tag) => (
                    <Badge key={tag} tone="primary" size="sm">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <span className="text-2xs text-fg-4">暂无标签</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold text-fg">基本信息</h4>
            <Descriptions
              columns={2}
              size="sm"
              items={[
                { label: '用户 ID', value: user.id, copyable: true },
                { label: '角色', value: user.roleName },
                { label: '邮箱', value: user.email, copyable: true },
                { label: '手机号', value: user.phone },
                { label: '所在城市', value: user.city },
                { label: '两步验证', value: user.mfa ? '已启用' : '未启用' },
                { label: '创建时间', value: formatRelativeTime(user.createdAt) },
                { label: '最近活跃', value: formatRelativeTime(user.lastActiveAt) },
              ]}
            />
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold text-fg">权限范围</h4>
            <div className="rounded-md border border-line">
              {[
                { module: '用户管理', read: true, write: canWrite, del: false },
                { module: '订单管理', read: true, write: user.role !== 'viewer', del: false },
                {
                  module: '内容中心',
                  read: true,
                  write: user.role !== 'viewer',
                  del: user.role === 'super_admin',
                },
                {
                  module: '系统设置',
                  read: user.role === 'super_admin',
                  write: user.role === 'super_admin',
                  del: false,
                },
              ].map((row) => (
                <div
                  key={row.module}
                  className="flex items-center justify-between border-b border-line-subtle px-2.5 py-1.5 text-xs last:border-0"
                >
                  <span className="text-fg-2">{row.module}</span>
                  <div className="flex items-center gap-2">
                    {[
                      { label: '读', ok: row.read },
                      { label: '写', ok: row.write },
                      { label: '删', ok: row.del },
                    ].map((perm) => (
                      <span
                        key={perm.label}
                        className={cn(
                          'grid size-5 place-items-center rounded-sm text-2xs',
                          perm.ok ? 'bg-success-weak text-success' : 'bg-surface-3 text-fg-4',
                        )}
                      >
                        {perm.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Drawer>
  )
}
