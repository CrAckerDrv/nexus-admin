import { useMemo, useRef, useState } from 'react'
import {
  ChevronRight,
  CloudUpload,
  Download,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  FolderPlus,
  Grid2x2,
  List,
  Search,
  Star,
  Trash,
  Users,
} from 'lucide-react'
import {
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  DataTable,
  Descriptions,
  EmptyState,
  PageContainer,
  PageHeader,
  Progress,
  SearchInput,
  SegmentedControl,
  Tag,
  Tree,
  cn,
  formatBytes,
  formatDateTime,
  toast,
} from '@nexus/ui'
import type { Column, TreeItem } from '@nexus/ui'

/**
 * 文件管理器
 *
 * 关键实现：
 * 1. 拖拽上传区用 dragover/drop + `dragCounter` 计数，避免子元素进出导致闪烁
 * 2. 网格/列表双视图共用同一份数据，切换只改渲染
 * 3. 预览面板显示元信息；图片用占位色块（模板不内嵌二进制资源）
 * 4. 文件夹树与面包屑联动
 */

type FileKind = 'folder' | 'image' | 'doc' | 'sheet' | 'archive' | 'video'

interface FileItem {
  id: string
  name: string
  kind: FileKind
  size: number
  updatedAt: string
  owner: string
  starred: boolean
  shared: boolean
}

const KIND_META: Record<
  FileKind,
  {
    icon: typeof FileText
    tone: 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
    label: string
  }
> = {
  folder: { icon: Folder, tone: 'primary', label: '文件夹' },
  image: { icon: FileImage, tone: 'success', label: '图片' },
  doc: { icon: FileText, tone: 'neutral', label: '文档' },
  sheet: { icon: FileSpreadsheet, tone: 'success', label: '表格' },
  archive: { icon: FileArchive, tone: 'warning', label: '压缩包' },
  video: { icon: FileVideo, tone: 'danger', label: '视频' },
}

const TONE_BG = {
  primary: 'bg-primary-weak text-primary',
  success: 'bg-success-weak text-success',
  warning: 'bg-warning-weak text-warning',
  danger: 'bg-danger-weak text-danger',
  neutral: 'bg-surface-3 text-fg-2',
}

const FILES: FileItem[] = [
  {
    id: 'f1',
    name: '2026 Q4 经营计划',
    kind: 'folder',
    size: 0,
    updatedAt: '2026-11-04T09:20:00',
    owner: '陈彦之',
    starred: true,
    shared: true,
  },
  {
    id: 'f2',
    name: '设计交付物',
    kind: 'folder',
    size: 0,
    updatedAt: '2026-11-03T18:42:00',
    owner: '黄清越',
    starred: false,
    shared: true,
  },
  {
    id: 'f3',
    name: '用户调研原始记录',
    kind: 'folder',
    size: 0,
    updatedAt: '2026-11-02T11:05:00',
    owner: '周予安',
    starred: false,
    shared: false,
  },
  {
    id: 'f4',
    name: '11月经营月报.xlsx',
    kind: 'sheet',
    size: 2_840_000,
    updatedAt: '2026-11-04T08:10:00',
    owner: '陈彦之',
    starred: true,
    shared: true,
  },
  {
    id: 'f5',
    name: '登录页改版稿.png',
    kind: 'image',
    size: 4_820_000,
    updatedAt: '2026-11-03T16:22:00',
    owner: '黄清越',
    starred: false,
    shared: false,
  },
  {
    id: 'f6',
    name: '接口契约 v3.md',
    kind: 'doc',
    size: 42_000,
    updatedAt: '2026-11-03T10:00:00',
    owner: '周予安',
    starred: true,
    shared: true,
  },
  {
    id: 'f7',
    name: '数据库备份_20261101.zip',
    kind: 'archive',
    size: 1_240_000_000,
    updatedAt: '2026-11-01T23:30:00',
    owner: '吴星野',
    starred: false,
    shared: false,
  },
  {
    id: 'f8',
    name: '产品演示录屏.mp4',
    kind: 'video',
    size: 268_000_000,
    updatedAt: '2026-10-30T14:15:00',
    owner: '林知夏',
    starred: false,
    shared: true,
  },
  {
    id: 'f9',
    name: '风控规则说明.docx',
    kind: 'doc',
    size: 186_000,
    updatedAt: '2026-10-29T09:48:00',
    owner: '赵书鸣',
    starred: false,
    shared: true,
  },
  {
    id: 'f10',
    name: '用户导入模板.xlsx',
    kind: 'sheet',
    size: 96_000,
    updatedAt: '2026-10-28T17:02:00',
    owner: '陈彦之',
    starred: false,
    shared: false,
  },
]

const FOLDER_TREE: TreeItem[] = [
  {
    key: 'root',
    title: '我的空间',
    children: [
      {
        key: 'plan',
        title: '2026 Q4 经营计划',
        children: [
          { key: 'plan-q4', title: '第四季度' },
          { key: 'plan-2027', title: '2027 预算' },
        ],
      },
      { key: 'design', title: '设计交付物' },
      { key: 'research', title: '用户调研原始记录' },
    ],
  },
  {
    key: 'shared',
    title: '团队共享',
    children: [
      { key: 'shared-report', title: '经营报表' },
      { key: 'shared-contract', title: '合同与法务' },
    ],
  },
  { key: 'trash', title: '回收站' },
]

export default function FilesPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [keyword, setKeyword] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>('f4')
  const [folderKey, setFolderKey] = useState('root')
  const [files, setFiles] = useState<FileItem[]>(FILES)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState<number | null>(null)
  const dragCount = useRef(0)

  const selected = files.find((file) => file.id === selectedId) ?? null

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    if (!query) return files
    return files.filter((file) => `${file.name}${file.owner}`.toLowerCase().includes(query))
  }, [files, keyword])

  const breadcrumbItems = useMemo(() => {
    const trail = [{ label: '我的空间', onClick: () => setFolderKey('root') }]
    if (folderKey !== 'root') {
      const node = findNode(FOLDER_TREE, folderKey)
      if (node) trail.push({ label: String(node.title), onClick: () => undefined })
    }
    return trail
  }, [folderKey])

  /** 拖入上传：用计数器避免子元素进出导致的闪烁 */
  const onDragEnter = (event: React.DragEvent) => {
    event.preventDefault()
    dragCount.current += 1
    setDragging(true)
  }
  const onDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    dragCount.current -= 1
    if (dragCount.current <= 0) {
      dragCount.current = 0
      setDragging(false)
    }
  }
  const onDrop = (event: React.DragEvent) => {
    event.preventDefault()
    dragCount.current = 0
    setDragging(false)
    const count = event.dataTransfer.files.length || 1
    simulateUpload(count)
  }

  const simulateUpload = (count: number) => {
    setUploading(0)
    let progress = 0
    const timer = setInterval(() => {
      progress += 12
      setUploading(Math.min(progress, 100))
      if (progress >= 100) {
        clearInterval(timer)
        setTimeout(() => {
          setUploading(null)
          setFiles((prev) => [
            {
              id: `f${Date.now()}`,
              name: `上传文件_${prev.length + 1}.png`,
              kind: 'image',
              size: 1_860_000,
              updatedAt: new Date().toISOString(),
              owner: '我',
              starred: false,
              shared: false,
            },
            ...prev,
          ])
          toast.success(`已上传 ${count} 个文件`)
        }, 400)
      }
    }, 120)
  }

  const listColumns: Column<FileItem>[] = useMemo(
    () => [
      {
        key: 'name',
        header: '名称',
        cell: (row) => {
          const meta = KIND_META[row.kind]
          return (
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-md',
                  TONE_BG[meta.tone],
                )}
              >
                <meta.icon className="size-3.5" />
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1 truncate text-[0.8125rem] text-fg">
                  {row.name}
                  {row.starred && <Star className="size-3 shrink-0 fill-warning text-warning" />}
                </p>
                <p className="truncate text-2xs text-fg-3">{meta.label}</p>
              </div>
            </div>
          )
        },
      },
      {
        key: 'owner',
        header: '所有者',
        width: 140,
        cell: (row) => (
          <div className="flex items-center gap-1.5">
            <Avatar name={row.owner} size="xs" />
            <span className="truncate text-xs text-fg-2">{row.owner}</span>
          </div>
        ),
      },
      {
        key: 'size',
        header: '大小',
        width: 100,
        align: 'right',
        cell: (row) => (
          <span className="text-xs text-fg-3 tabular-nums">
            {row.kind === 'folder' ? '—' : formatBytes(row.size)}
          </span>
        ),
      },
      {
        key: 'updatedAt',
        header: '更新时间',
        width: 150,
        align: 'right',
        cell: (row) => (
          <span className="text-2xs text-fg-3">{formatDateTime(row.updatedAt, false)}</span>
        ),
      },
    ],
    [],
  )

  return (
    <PageContainer size="full">
      <PageHeader
        title="文件管理器"
        description="网格 / 列表双视图、拖拽上传、文件夹树与预览面板联动"
        badge={<Badge tone="primary">Files</Badge>}
        actions={
          <>
            <Button size="sm" variant="secondary" leftIcon={<Download className="size-3.5" />}>
              批量下载
            </Button>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<FolderPlus className="size-3.5" />}
              onClick={() => toast.info('演示环境：新建文件夹')}
            >
              新建文件夹
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[200px_minmax(0,1fr)_17rem]">
        {/* 文件夹树 */}
        <Card bare className="h-fit">
          <p className="border-b border-line px-3 py-2 text-2xs font-semibold tracking-wide text-fg-3 uppercase">
            目录
          </p>
          <div className="p-2">
            <Tree
              items={FOLDER_TREE}
              defaultExpandAll
              selectedKey={folderKey}
              onSelect={(key) => setFolderKey(key)}
              showLine={false}
            />
          </div>
          <div className="border-t border-line px-3 py-2">
            <div className="mb-1 flex items-center justify-between text-2xs text-fg-3">
              <span>空间用量</span>
              <span className="tabular-nums">4.2 / 20 GB</span>
            </div>
            <Progress value={21} size="xs" tone="primary" />
          </div>
        </Card>

        {/* 主区域 */}
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Breadcrumb items={breadcrumbItems} />
            <div className="ml-auto flex items-center gap-2">
              <SearchInput
                value={keyword}
                onChange={setKeyword}
                placeholder="搜索文件"
                size="sm"
                className="w-[12.5rem]"
              />
              <SegmentedControl
                size="sm"
                options={[
                  { label: <Grid2x2 className="size-3.5" />, value: 'grid' },
                  { label: <List className="size-3.5" />, value: 'list' },
                ]}
                value={view}
                onChange={(value) => setView(value as 'grid' | 'list')}
              />
            </div>
          </div>

          {/* 拖拽上传区 */}
          <div
            onDragEnter={onDragEnter}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
              'relative rounded-lg border-2 border-dashed transition-colors',
              dragging ? 'border-primary bg-primary-weak/40' : 'border-line bg-surface-2/40',
            )}
          >
            <div className="flex flex-col items-center gap-1.5 px-4 py-4 text-center">
              <CloudUpload className={cn('size-5', dragging ? 'text-primary' : 'text-fg-4')} />
              <p className={cn('text-xs', dragging ? 'text-primary' : 'text-fg-2')}>
                {dragging ? '松开即可上传' : '把文件拖到这里，或点击选择'}
              </p>
              <p className="text-2xs text-fg-4">支持图片、文档、表格、压缩包；单文件上限 2GB</p>
              {uploading !== null && (
                <div className="mt-1 w-full max-w-[20rem]">
                  <Progress value={uploading} size="xs" showLabel label="上传中" />
                </div>
              )}
            </div>
            <input
              type="file"
              multiple
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={() => simulateUpload(1)}
              aria-label="选择要上传的文件"
            />
          </div>

          {filtered.length === 0 ? (
            <Card>
              <EmptyState
                title="没有匹配的文件"
                description="试试清空搜索，或换一个关键词。"
                action={
                  <Button size="sm" variant="secondary" onClick={() => setKeyword('')}>
                    清空搜索
                  </Button>
                }
              />
            </Card>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((file) => {
                const meta = KIND_META[file.kind]
                const isSelected = file.id === selectedId
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => setSelectedId(file.id)}
                    className={cn(
                      'group flex flex-col gap-2 rounded-lg border bg-surface p-2.5 text-left transition-[border-color,box-shadow]',
                      isSelected
                        ? 'ring-primary-ring border-primary shadow-sm ring-2'
                        : 'border-line hover:border-line-strong hover:shadow-sm',
                    )}
                  >
                    {/* 缩略图区：用几何色块代替真实缩略图 */}
                    <div
                      className={cn(
                        'flex h-20 items-center justify-center rounded-md',
                        TONE_BG[meta.tone],
                      )}
                    >
                      <meta.icon className="size-7 opacity-80" />
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 truncate text-xs font-medium text-fg">
                        {file.name}
                        {file.starred && (
                          <Star className="size-3 shrink-0 fill-warning text-warning" />
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-2xs text-fg-3">
                        {file.kind === 'folder' ? '文件夹' : formatBytes(file.size)} · {file.owner}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {file.shared && (
                        <Tag tone="primary" className="h-[1rem] px-1 text-[0.625rem]">
                          共享
                        </Tag>
                      )}
                      <span className="ml-auto text-[0.625rem] text-fg-4">
                        {formatDateTime(file.updatedAt, false)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <Card bare>
              <DataTable
                columns={listColumns}
                rows={filtered}
                getRowId={(row) => row.id}
                selectable
                onRowClick={(row) => setSelectedId(row.id)}
                rowClassName={(row) => (row.id === selectedId ? 'bg-primary-weak/40' : '')}
              />
            </Card>
          )}
        </div>

        {/* 预览面板 */}
        <Card className="h-fit">
          <p className="mb-2 border-b border-line pb-2 text-2xs font-semibold tracking-wide text-fg-3 uppercase">
            预览
          </p>
          {selected ? (
            <div className="space-y-3">
              <div
                className={cn(
                  'flex h-28 items-center justify-center rounded-md',
                  TONE_BG[KIND_META[selected.kind].tone],
                )}
              >
                {(() => {
                  const Icon = KIND_META[selected.kind].icon
                  return <Icon className="size-9 opacity-70" />
                })()}
              </div>
              <div>
                <p className="text-[0.8125rem] font-medium break-all text-fg">{selected.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <Badge size="sm" tone="neutral">
                    {KIND_META[selected.kind].label}
                  </Badge>
                  {selected.shared && (
                    <Badge size="sm" tone="primary" icon={<Users className="size-3" />}>
                      团队共享
                    </Badge>
                  )}
                </div>
              </div>

              <Descriptions
                size="sm"
                columns={1}
                items={[
                  {
                    label: '大小',
                    value: selected.kind === 'folder' ? '—' : formatBytes(selected.size),
                  },
                  { label: '所有者', value: selected.owner },
                  { label: '更新时间', value: formatDateTime(selected.updatedAt, true) },
                  { label: '文件 ID', value: selected.id, copyable: true },
                ]}
              />

              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Download className="size-3.5" />}
                  className="flex-1"
                >
                  下载
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<Trash className="size-3.5" />}
                  onClick={() => {
                    setFiles((prev) => prev.filter((file) => file.id !== selected.id))
                    setSelectedId(null)
                    toast.success('已移入回收站')
                  }}
                >
                  删除
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState size="sm" title="未选择文件" description="点击左侧任意文件查看详情" />
          )}
        </Card>
      </div>
    </PageContainer>
  )
}

function findNode(nodes: TreeItem[], key: string): TreeItem | null {
  for (const node of nodes) {
    if (node.key === key) return node
    if (node.children?.length) {
      const child = findNode(node.children, key)
      if (child) return child
    }
  }
  return null
}

void ChevronRight
void Search
