import { useMemo, useState } from 'react'
import { CirclePlus, Lock, Shield, ShieldCheck, Users } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Dialog,
  Drawer,
  PageContainer,
  PageHeader,
  Skeleton,
  Stack,
  Switch,
  Tabs,
  cn,
  toast,
} from '@nexus/ui'
import type { TabItem } from '@nexus/ui'
import { useRoles } from '@/services/queries'
import type { Role } from '@/types/domain'

const PERMISSION_MATRIX = [
  {
    group: '用户管理',
    actions: [
      { key: 'user:read', label: '查看用户' },
      { key: 'user:write', label: '编辑用户' },
      { key: 'user:delete', label: '删除用户' },
      { key: 'user:invite', label: '邀请成员' },
    ],
  },
  {
    group: '订单管理',
    actions: [
      { key: 'order:read', label: '查看订单' },
      { key: 'order:verify', label: '订单审核' },
      { key: 'order:refund', label: '发起退款' },
      { key: 'order:export', label: '导出订单' },
    ],
  },
  {
    group: '内容中心',
    actions: [
      { key: 'content:read', label: '查看内容' },
      { key: 'content:write', label: '编辑内容' },
      { key: 'content:publish', label: '发布内容' },
      { key: 'content:delete', label: '删除内容' },
    ],
  },
  {
    group: '系统管理',
    actions: [
      { key: 'audit:read', label: '查看审计' },
      { key: 'audit:export', label: '导出审计' },
      { key: 'role:read', label: '查看角色' },
      { key: 'role:write', label: '管理角色' },
      { key: 'setting:write', label: '系统设置' },
    ],
  },
]

export default function RolesPage() {
  const roles = useRoles()
  const [tab, setTab] = useState<'roles' | 'matrix'>('roles')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Role | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const selected = roles.data?.find((role) => role.id === selectedId) ?? roles.data?.[0]

  const tabs: TabItem[] = [
    { key: 'roles', label: '角色列表' },
    { key: 'matrix', label: '权限矩阵' },
  ]

  return (
    <PageContainer size="lg">
      <PageHeader
        title="角色权限"
        description="基于 RBAC 的角色模型，支持细粒度权限码与内置角色保护"
        badge={<Badge tone="primary">RBAC</Badge>}
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<Shield className="size-3.5" />}
              onClick={() => setCreateOpen(true)}
            >
              新建角色
            </Button>
            <Button
              variant="primary"
              leftIcon={<CirclePlus className="size-3.5" />}
              onClick={() => setCreateOpen(true)}
            >
              创建自定义角色
            </Button>
          </>
        }
      />

      <Alert tone="info" className="mb-3" compact title="权限模型说明">
        权限码采用 <code className="rounded bg-surface-2 px-1 font-mono text-2xs">资源:动作</code>{' '}
        形式， 模块清单中的{' '}
        <code className="rounded bg-surface-2 px-1 font-mono text-2xs">permission</code> 字段会在
        路由守卫、侧边栏过滤与按钮禁用三处同时生效。
      </Alert>

      <Tabs
        variant="pill"
        items={tabs}
        value={tab}
        onChange={(value) => setTab(value as typeof tab)}
        className="mb-3"
      />

      {tab === 'roles' ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card bare className="flex flex-col">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <h3 className="text-xs font-semibold text-fg">角色 · {roles.data?.length ?? 0}</h3>
              <Badge tone="success" size="sm">
                已同步
              </Badge>
            </div>
            <div className="p-1.5">
              {roles.isLoading ? (
                <Stack gap="sm">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 rounded-md" />
                  ))}
                </Stack>
              ) : (
                roles.data?.map((role) => {
                  const active = selected?.id === role.id
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setSelectedId(role.id)}
                      className={cn(
                        'mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors',
                        active ? 'bg-primary-weak' : 'hover:bg-surface-2',
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-7 shrink-0 place-items-center rounded-md',
                          active ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-fg-3',
                        )}
                      >
                        {role.key === 'super_admin' ? (
                          <ShieldCheck className="size-3.5" />
                        ) : (
                          <Lock className="size-3.5" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'truncate text-xs font-medium',
                              active ? 'text-primary' : 'text-fg',
                            )}
                          >
                            {role.name}
                          </span>
                          {role.builtin && (
                            <Badge size="sm" tone="neutral">
                              内置
                            </Badge>
                          )}
                        </span>
                        <span className="block truncate text-2xs text-fg-3">
                          {role.memberCount} 名成员 · {role.permissions.length} 项权限
                        </span>
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </Card>

          <Card bare className="flex flex-col">
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-3 border-b border-line p-3.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-fg">{selected.name}</h3>
                      <Badge tone={selected.builtin ? 'neutral' : 'primary'} size="sm">
                        {selected.builtin ? '内置角色' : '自定义'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-fg-3">{selected.description}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={selected.builtin}
                      onClick={() => setEditing(selected)}
                    >
                      编辑权限
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toast.success(`已复制角色 ${selected.name}（演示）`)}
                    >
                      复制角色
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 p-3.5">
                  <Descriptions
                    columns={3}
                    size="sm"
                    items={[
                      {
                        label: '角色标识',
                        value: <code className="font-mono text-xs">{selected.key}</code>,
                      },
                      { label: '成员数量', value: `${selected.memberCount} 人` },
                      { label: '权限条数', value: `${selected.permissions.length} 项` },
                    ]}
                  />

                  <div>
                    <h4 className="mb-2 text-xs font-semibold text-fg">权限清单</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.permissions.map((permission) => (
                        <span
                          key={permission}
                          className="inline-flex h-6 items-center rounded-sm border border-line bg-surface-2 px-2 font-mono text-2xs text-fg-2"
                        >
                          {permission}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-2 text-xs font-semibold text-fg">权限矩阵</h4>
                    <PermissionMatrix
                      value={selected.permissions}
                      readOnly={selected.builtin && selected.key === 'super_admin'}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="p-6 text-center text-xs text-fg-3">请选择左侧角色</div>
            )}
          </Card>
        </div>
      ) : (
        <Card bare>
          <div className="border-b border-line px-3.5 py-2.5">
            <h3 className="text-xs font-semibold text-fg">角色 × 权限矩阵</h3>
            <p className="mt-0.5 text-2xs text-fg-3">✓ 表示该角色拥有对应权限码</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[45rem] text-xs">
              <thead className="bg-surface-2 text-fg-3">
                <tr>
                  <th className="sticky left-0 z-10 bg-surface-2 px-3 py-2 text-left font-medium">
                    权限
                  </th>
                  {roles.data?.map((role) => (
                    <th key={role.id} className="px-2 py-2 text-center font-medium">
                      {role.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {PERMISSION_MATRIX.map((group) => (
                  <PermissionRows key={group.group} group={group} roles={roles.data ?? []} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title={`编辑角色 · ${editing?.name ?? ''}`}
        description="勾选需要授予的权限码，保存后立即生效。"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              取消
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                toast.success('角色权限已保存（演示）')
                setEditing(null)
              }}
            >
              保存
            </Button>
          </>
        }
      >
        {editing && <PermissionMatrix value={editing.permissions} />}
      </Dialog>

      <Drawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="创建自定义角色"
        description="用于精细化的岗位授权，避免直接授予管理员权限"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                toast.success('角色已创建（演示）')
                setCreateOpen(false)
              }}
            >
              创建
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-fg-2">角色名称</span>
            <input
              className="h-[var(--n-control-h)] w-full rounded-md border border-line bg-surface px-2.5 text-[0.8125rem] outline-none focus:border-primary"
              placeholder="例如：区域运营经理"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-fg-2">描述</span>
            <textarea
              className="min-h-[4rem] w-full rounded-md border border-line bg-surface px-2.5 py-2 text-[0.8125rem] outline-none focus:border-primary"
              placeholder="说明该角色的职责范围"
            />
          </label>
          <PermissionMatrix value={['user:read', 'order:read']} />
        </div>
      </Drawer>
    </PageContainer>
  )
}

function PermissionRows({
  group,
  roles,
}: {
  group: (typeof PERMISSION_MATRIX)[number]
  roles: Role[]
}) {
  return (
    <>
      <tr className="bg-surface-2/60">
        <td
          colSpan={roles.length + 1}
          className="px-3 py-1.5 text-2xs font-medium tracking-wide text-fg-4 uppercase"
        >
          {group.group}
        </td>
      </tr>
      {group.actions.map((action) => (
        <tr key={action.key} className="hover:bg-surface-2">
          <td className="sticky left-0 z-10 bg-surface px-3 py-1.5">
            <span className="text-fg-2">{action.label}</span>
            <span className="ml-1.5 font-mono text-2xs text-fg-4">{action.key}</span>
          </td>
          {roles.map((role) => {
            const granted = role.permissions.includes('*') || role.permissions.includes(action.key)
            return (
              <td key={role.id} className="px-2 py-1.5 text-center">
                {granted ? (
                  <span className="inline-grid size-4 place-items-center rounded-full bg-success-weak text-success">
                    <svg viewBox="0 0 24 24" className="size-2.5" fill="none" aria-hidden="true">
                      <path
                        d="m5 12.5 4.5 4.5L19 7"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                ) : (
                  <span className="text-fg-4">—</span>
                )}
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}

function PermissionMatrix({ value, readOnly }: { value: string[]; readOnly?: boolean }) {
  const [granted, setGranted] = useState<string[]>(value)
  const all = useMemo(
    () => PERMISSION_MATRIX.flatMap((group) => group.actions.map((action) => action.key)),
    [],
  )
  const isAdmin = granted.includes('*')

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-md border border-line bg-surface-2 px-2.5 py-2">
        <div className="flex items-center gap-2">
          <Users className="size-3.5 text-fg-3" />
          <span className="text-xs text-fg-2">
            已授予{' '}
            <span className="font-semibold text-fg">{isAdmin ? all.length : granted.length}</span> /{' '}
            {all.length} 项权限
          </span>
        </div>
        {!readOnly && (
          <Switch
            size="sm"
            checked={isAdmin}
            onChange={(checked) => setGranted(checked ? ['*'] : [])}
            label={<span className="text-xs">全部权限</span>}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {PERMISSION_MATRIX.map((group) => (
          <div key={group.group} className="rounded-md border border-line">
            <div className="border-b border-line-subtle bg-surface-2/60 px-2.5 py-1.5 text-2xs font-medium tracking-wide text-fg-4 uppercase">
              {group.group}
            </div>
            <div className="space-y-1 p-2">
              {group.actions.map((action) => {
                const checked = isAdmin || granted.includes(action.key)
                return (
                  <Checkbox
                    key={action.key}
                    checked={checked}
                    disabled={readOnly || isAdmin}
                    onChange={(next) =>
                      setGranted((prev) =>
                        next
                          ? [...prev.filter((item) => item !== '*'), action.key]
                          : prev.filter((item) => item !== action.key),
                      )
                    }
                    label={
                      <span className="text-xs">
                        {action.label}
                        <span className="ml-1 font-mono text-2xs text-fg-4">{action.key}</span>
                      </span>
                    }
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
