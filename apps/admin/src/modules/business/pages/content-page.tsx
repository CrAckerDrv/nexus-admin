import { useMemo, useState } from 'react'
import {
  CirclePlus,
  Eye,
  FileText,
  MessageSquare,
  Pencil,
  RefreshCw,
  Send,
  Trash,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CodeBlock,
  ConfirmDialog,
  DataTable,
  EmptyState,
  PageContainer,
  PageHeader,
  Pagination,
  SearchInput,
  SegmentedControl,
  Select,
  Skeleton,
  StatCard,
  Tabs,
  cn,
  formatCompact,
  formatRelativeTime,
  toast,
} from '@nexus/ui'
import type { Column, TabItem } from '@nexus/ui'
import { useArticleStats, useArticles } from '@/services/queries'
import type { Article, ArticleStatus } from '@/types/domain'
import { useDebouncedValue } from '@/core/use-debounce'
import { readDefaultPageSize } from '@/core/use-app-settings'

const STATUS_META: Record<
  ArticleStatus,
  { label: string; tone: 'success' | 'warning' | 'neutral' | 'primary' }
> = {
  draft: { label: '草稿', tone: 'neutral' },
  reviewing: { label: '审核中', tone: 'warning' },
  published: { label: '已发布', tone: 'success' },
  archived: { label: '已归档', tone: 'primary' },
}

const CATEGORIES = ['产品动态', '最佳实践', '客户案例', '技术解析', '行业观察']

export default function ContentPage() {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(readDefaultPageSize(10))
  const [view, setView] = useState<'table' | 'card'>('table')
  const [preview, setPreview] = useState<Article | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null)

  // 输入框即时响应，请求按 300ms 静止后再发
  const debouncedKeyword = useDebouncedValue(keyword, 300)

  const params = useMemo(
    () => ({ page, pageSize, keyword: debouncedKeyword, status, category }),
    [page, pageSize, debouncedKeyword, status, category],
  )
  const articles = useArticles(params)
  const stats = useArticleStats()

  const columns = useMemo<Column<Article>[]>(
    () => [
      {
        key: 'title',
        header: '标题',
        cell: (row) => (
          <div className="max-w-[26.25rem] min-w-0">
            <p className="truncate text-[0.8125rem] font-medium text-fg">{row.title}</p>
            <p className="truncate text-2xs text-fg-3">{row.excerpt}</p>
          </div>
        ),
        sortValue: (row) => row.title,
      },
      {
        key: 'category',
        header: '分类',
        width: 110,
        cell: (row) => (
          <Badge tone="primary" variant="outline">
            {row.category}
          </Badge>
        ),
        sortValue: (row) => row.category,
      },
      {
        key: 'status',
        header: '状态',
        width: 100,
        cell: (row) => (
          <Badge tone={STATUS_META[row.status].tone} dot>
            {STATUS_META[row.status].label}
          </Badge>
        ),
        sortValue: (row) => row.status,
      },
      {
        key: 'author',
        header: '作者',
        width: 100,
        cell: (row) => <span className="text-xs text-fg-2">{row.author}</span>,
        sortValue: (row) => row.author,
      },
      {
        key: 'views',
        header: '阅读',
        width: 96,
        align: 'right',
        cell: (row) => (
          <span className="text-xs text-fg-2 tabular-nums">{formatCompact(row.views)}</span>
        ),
        sortValue: (row) => row.views,
      },
      {
        key: 'comments',
        header: '评论',
        width: 84,
        align: 'right',
        cell: (row) => (
          <span className="inline-flex items-center justify-end gap-1 text-xs text-fg-3 tabular-nums">
            <MessageSquare className="size-3" />
            {row.comments}
          </span>
        ),
        sortValue: (row) => row.comments,
      },
      {
        key: 'updatedAt',
        header: '更新时间',
        width: 118,
        cell: (row) => (
          <span className="text-xs text-fg-3">{formatRelativeTime(row.updatedAt)}</span>
        ),
        sortValue: (row) => row.updatedAt,
      },
      {
        key: 'actions',
        header: '操作',
        width: 116,
        align: 'right',
        cell: (row) => (
          <div className="flex items-center justify-end gap-0.5">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="预览"
              onClick={() => setPreview(row)}
            >
              <Eye className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="编辑"
              onClick={() => toast.info('演示环境：打开编辑器')}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="删除"
              onClick={() => setDeleteTarget(row)}
              className="text-fg-3 hover:text-danger"
            >
              <Trash className="size-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  )

  const tabs: TabItem[] = [
    { key: 'all', label: '全部内容', badge: <Badge size="sm">{articles.data?.total ?? 0}</Badge> },
    { key: 'published', label: '已发布' },
    { key: 'reviewing', label: '待审核' },
    { key: 'draft', label: '草稿' },
    { key: 'archived', label: '已归档' },
  ]

  return (
    <PageContainer size="lg">
      <PageHeader
        title="内容中心"
        description="内容生产、审核与发布的一体化管理"
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={
                <RefreshCw className={cn('size-3.5', articles.isFetching && 'animate-spin')} />
              }
              onClick={() => void articles.refetch()}
            >
              刷新
            </Button>
            <Button
              variant="primary"
              leftIcon={<CirclePlus className="size-3.5" />}
              onClick={() => toast.info('演示环境：新建内容')}
            >
              新建内容
            </Button>
          </>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          label="已发布"
          value={stats.data?.published ?? '—'}
          icon={<Send className="size-4" />}
          tone="success"
        />
        <StatCard
          label="待审核"
          value={stats.data?.reviewing ?? '—'}
          icon={<FileText className="size-4" />}
          tone="warning"
        />
        <StatCard label="草稿" value={stats.data?.draft ?? '—'} tone="neutral" />
        <StatCard
          label="累计阅读"
          value={stats.data ? formatCompact(stats.data.views) : '—'}
          icon={<Eye className="size-4" />}
          tone="primary"
          delta={12.6}
        />
      </div>

      <Tabs
        variant="line"
        items={tabs.map((tab) => ({
          ...tab,
          disabled: false,
        }))}
        value={status === 'all' ? 'all' : status}
        onChange={(value) => {
          setStatus(value)
          setPage(1)
        }}
        className="mb-3"
      />

      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <SearchInput
            className="w-full max-w-[16.25rem]"
            value={keyword}
            onChange={(value) => {
              setKeyword(value)
              setPage(1)
            }}
            placeholder="搜索标题或作者"
          />
          <Select
            className="w-[8.5rem]"
            options={[
              { label: '全部分类', value: 'all' },
              ...CATEGORIES.map((item) => ({ label: item, value: item })),
            ]}
            value={category}
            onChange={(value) => {
              setCategory(value)
              setPage(1)
            }}
          />
          <SegmentedControl
            size="sm"
            className="ml-auto"
            options={[
              { label: '列表', value: 'table' },
              { label: '卡片', value: 'card' },
            ]}
            value={view}
            onChange={(value) => setView(value as typeof view)}
          />
        </div>

        {view === 'table' ? (
          <DataTable
            columns={columns}
            rows={articles.data?.items ?? []}
            getRowId={(row) => row.id}
            loading={articles.isLoading}
            onRowClick={setPreview}
            empty={<EmptyState size="sm" title="没有匹配的内容" />}
          />
        ) : articles.isLoading ? (
          <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-[8.25rem] rounded-md" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {articles.data?.items.map((article) => (
              <Card
                key={article.id}
                hoverable
                className="flex cursor-pointer flex-col gap-2 p-3"
                onClick={() => setPreview(article)}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 min-w-0 text-[0.8125rem] leading-5 font-medium text-fg">
                    {article.title}
                  </p>
                  <Badge tone={STATUS_META[article.status].tone} size="sm" className="shrink-0">
                    {STATUS_META[article.status].label}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-2xs leading-4 text-fg-3">{article.excerpt}</p>
                <div className="mt-auto flex items-center justify-between text-2xs text-fg-4">
                  <span className="truncate">{article.author}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="inline-flex items-center gap-0.5">
                      <Eye className="size-3" />
                      {formatCompact(article.views)}
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <MessageSquare className="size-3" />
                      {article.comments}
                    </span>
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="border-t border-line p-3">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={articles.data?.total ?? 0}
            onChange={(nextPage, nextSize) => {
              setPage(nextPage)
              setPageSize(nextSize)
            }}
          />
        </div>
      </div>

      {preview && (
        <Card className="mt-3">
          <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-fg">{preview.title}</h3>
              <p className="mt-1 text-2xs text-fg-3">
                {preview.author} · {preview.category} · 更新于{' '}
                {formatRelativeTime(preview.updatedAt)} · {preview.words} 字
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>
              关闭预览
            </Button>
          </div>
          <p className="mt-3 text-[0.8125rem] leading-6 text-fg-2">
            {preview.excerpt}
            在真实项目中，这里会渲染 Markdown /
            富文本编辑器产出的内容。演示页面用一段说明文字代替，避免引入额外依赖。
          </p>
          <CodeBlock
            className="mt-3"
            language="tsx"
            filename="内容模块的声明式注册"
            maxHeight={180}
            code={`export const businessModule = defineModule({
  id: 'business',
  title: '业务管理',
  order: 20,
  nav: [
    { key: 'content', title: '内容中心', path: '/business/content', icon: FileText },
  ],
  routes: [
    { path: '/business/content', component: () => import('./pages/content-page') },
  ],
})`}
          />
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="删除内容"
        description={`确认删除《${deleteTarget?.title}》吗？删除后无法恢复。`}
        danger
        confirmText="删除"
        onConfirm={() => {
          toast.success('内容已删除（演示）')
          setDeleteTarget(null)
        }}
      />
    </PageContainer>
  )
}
