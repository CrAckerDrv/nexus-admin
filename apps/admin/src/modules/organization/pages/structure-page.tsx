import { useMemo, useState } from 'react'
import { Building, ChevronRight, CirclePlus, Search, UserRound, UsersRound } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  PageContainer,
  PageHeader,
  SearchInput,
  Skeleton,
  Stack,
  StatCard,
  cn,
  toast,
} from '@nexus/ui'
import { useOrgTree } from '@/services/queries'
import type { OrgNode } from '@/types/domain'

/** 组织架构：树 + 详情面板 */
export default function StructurePage() {
  const org = useOrgTree()
  const [selectedId, setSelectedId] = useState<string>('org_root')
  const [keyword, setKeyword] = useState('')

  const flat = useMemo(() => flatten(org.data), [org.data])
  const selected = flat.find((node) => node.id === selectedId) ?? flat[0]

  const filtered = useMemo(() => {
    if (!keyword.trim()) return org.data
    return prune(org.data, keyword.trim())
  }, [org.data, keyword])

  return (
    <PageContainer size="lg">
      <PageHeader
        title="组织架构"
        description="维护公司、部门与团队的层级关系及负责人"
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<CirclePlus className="size-3.5" />}
              onClick={() => toast.info('演示环境：新建部门')}
            >
              新建部门
            </Button>
            <Button
              variant="primary"
              leftIcon={<UsersRound className="size-3.5" />}
              onClick={() => toast.info('演示环境：批量调整成员')}
            >
              调整成员
            </Button>
          </>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          label="组织总人数"
          value={486}
          icon={<UsersRound className="size-4" />}
          tone="primary"
        />
        <StatCard label="部门数" value={11} icon={<Building className="size-4" />} tone="success" />
        <StatCard label="团队数" value={6} tone="warning" />
        <StatCard label="待确认归属" value={4} tone="danger" suffix="人" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card bare className="flex flex-col">
          <div className="border-b border-line p-2.5">
            <SearchInput
              value={keyword}
              onChange={setKeyword}
              placeholder="搜索部门或负责人"
              size="sm"
            />
          </div>
          <div className="min-h-[26.25rem] overflow-y-auto p-1.5">
            {org.isLoading ? (
              <Stack gap="sm">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-7 rounded-md" />
                ))}
              </Stack>
            ) : filtered ? (
              <OrgTree node={filtered} selectedId={selected?.id ?? ''} onSelect={setSelectedId} />
            ) : (
              <EmptyState size="sm" title="没有匹配的部门" />
            )}
          </div>
        </Card>

        <Card bare className="flex flex-col">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-line p-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-lg bg-primary-weak text-primary">
                    <Building className="size-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-fg">{selected.name}</h3>
                      <Badge
                        tone={
                          selected.type === 'company'
                            ? 'primary'
                            : selected.type === 'department'
                              ? 'success'
                              : 'neutral'
                        }
                      >
                        {selected.type === 'company'
                          ? '公司'
                          : selected.type === 'department'
                            ? '部门'
                            : '团队'}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-2xs text-fg-3">
                      负责人 {selected.leader ?? '未设置'} · {selected.memberCount} 名成员
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => toast.info('演示环境：编辑部门')}
                  >
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toast.info('演示环境：邀请成员')}
                  >
                    邀请成员
                  </Button>
                </div>
              </div>

              <div className="p-3.5">
                <h4 className="mb-2 text-xs font-semibold text-fg">下级组织</h4>
                {selected.children && selected.children.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {selected.children.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => setSelectedId(child.id)}
                        className="flex items-center gap-2 rounded-md border border-line p-2.5 text-left transition-colors hover:border-primary/35 hover:bg-primary-weak/30"
                      >
                        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-2 text-fg-3">
                          <UsersRound className="size-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-fg">
                            {child.name}
                          </span>
                          <span className="block truncate text-2xs text-fg-3">
                            {child.leader ?? '未设置负责人'} · {child.memberCount} 人
                          </span>
                        </span>
                        <ChevronRight className="size-3.5 shrink-0 text-fg-4" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState size="sm" title="没有下级组织" description="这是最末级团队。" />
                )}

                <h4 className="mt-4 mb-2 text-xs font-semibold text-fg">成员预览</h4>
                <div className="overflow-hidden rounded-md border border-line">
                  {[
                    { name: '林知夏', role: '前端工程师', tag: '在职' },
                    { name: '周予安', role: '产品经理', tag: '在职' },
                    { name: '吴星野', role: '后端工程师', tag: '在职' },
                    { name: '黄清越', role: 'SRE', tag: '试用期' },
                  ].map((member) => (
                    <div
                      key={member.name}
                      className="flex items-center gap-2.5 border-b border-line-subtle px-3 py-2 last:border-0"
                    >
                      <Avatar name={member.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-fg">{member.name}</p>
                        <p className="truncate text-2xs text-fg-3">{member.role}</p>
                      </div>
                      <Badge tone={member.tag === '在职' ? 'success' : 'warning'} size="sm">
                        {member.tag}
                      </Badge>
                    </div>
                  ))}
                  <div className="flex items-center justify-center gap-1 px-3 py-2 text-2xs text-fg-4 hover:text-primary">
                    <Search className="size-3" />
                    查看全部 {selected.memberCount} 名成员
                  </div>
                </div>
              </div>
            </>
          ) : (
            <EmptyState title="请选择一个组织节点" />
          )}
        </Card>
      </div>
    </PageContainer>
  )
}

function OrgTree({
  node,
  selectedId,
  onSelect,
  depth = 0,
}: {
  node: OrgNode
  selectedId: string
  onSelect: (id: string) => void
  depth?: number
}) {
  const [open, setOpen] = useState(true)
  const hasChildren = Boolean(node.children?.length)
  const selected = node.id === selectedId

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 rounded-md pr-1 transition-colors',
          selected ? 'bg-primary-weak text-primary' : 'hover:bg-surface-2',
        )}
        style={{ paddingLeft: depth * 12 }}
      >
        <button
          type="button"
          aria-label={open ? '折叠' : '展开'}
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            'grid size-4 shrink-0 place-items-center text-fg-4',
            !hasChildren && 'invisible',
          )}
        >
          <ChevronRight className={cn('size-3 transition-transform', open && 'rotate-90')} />
        </button>
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex h-7 min-w-0 flex-1 items-center gap-1.5 text-left text-xs"
        >
          {node.type === 'company' ? (
            <Building className="size-3.5 shrink-0" />
          ) : node.type === 'department' ? (
            <UsersRound className="size-3.5 shrink-0" />
          ) : (
            <UserRound className="size-3.5 shrink-0" />
          )}
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
          <span className="shrink-0 text-2xs text-fg-4">{node.memberCount}</span>
        </button>
      </div>
      {open && hasChildren && (
        <div>
          {node.children?.map((child) => (
            <OrgTree
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function flatten(
  node: OrgNode | undefined,
  depth = 0,
  acc: Array<OrgNode & { depth: number }> = [],
) {
  if (!node) return acc
  acc.push({ ...node, depth })
  node.children?.forEach((child) => flatten(child, depth + 1, acc))
  return acc
}

function prune(node: OrgNode | undefined, keyword: string): OrgNode | undefined {
  if (!node) return undefined
  const selfMatch = node.name.includes(keyword) || (node.leader?.includes(keyword) ?? false)
  const children = node.children?.map((child) => prune(child, keyword)).filter(Boolean) as
    OrgNode[] | undefined
  if (selfMatch || (children && children.length > 0)) {
    return { ...node, children: selfMatch ? node.children : children }
  }
  return undefined
}
