import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Code2, Search, Sparkles, X } from 'lucide-react'
import {
  Badge,
  Button,
  CodeBlock,
  Descriptions,
  Dialog,
  EmptyState,
  PageContainer,
  Tabs,
  cn,
  fuzzyMatch,
  toast,
} from '@nexus/ui'
import { GALLERY_CATEGORIES, GALLERY_COUNT_BY_CATEGORY, GALLERY_TOTAL } from '../gallery/registry'
import type { TabItem } from '@nexus/ui'
import type { GalleryCategory, GalleryItem } from '../gallery/types'

/**
 * 组件总览（橱窗模式）
 *
 * 交互对齐 Element Plus / Ant Design 的组件总览：
 * - 左侧是常驻的组件索引，点击滚动到对应卡片，滚动时高亮当前分类
 * - 顶部一个搜索框，命中后即时过滤（分类段落自动收敛为「搜索结果」）
 * - 主体按分类分段，每段是「标题 + 计数徽标 + 两列卡片」
 * - 卡片里是**真实渲染**的组件；点卡片或右下角按钮打开用法与 Props 详情
 *
 * 之所以不用截图代替预览：
 * 截图会随主题、密度、强调色变化而过期，而真实渲染的组件永远和线上一致。
 */

interface SearchHit {
  item: GalleryItem
  category: GalleryCategory
}

export default function ComponentsOverviewPage() {
  const [keyword, setKeyword] = useState('')
  const [activeCategory, setActiveCategory] = useState(GALLERY_CATEGORIES[0]?.id ?? '')
  const [detail, setDetail] = useState<SearchHit | null>(null)
  const sectionRefs = useRef(new Map<string, HTMLElement>())

  /** 搜索命中：分类名、组件英文名、中文名、说明与关键字都参与匹配 */
  const hits = useMemo<SearchHit[]>(() => {
    const query = keyword.trim()
    const flat = GALLERY_CATEGORIES.flatMap((category) =>
      category.items.map((item) => ({ item, category })),
    )
    if (!query) return flat
    return flat.filter(({ item, category }) => {
      const haystack = [
        category.name,
        category.title,
        item.name,
        item.nameZh,
        item.summary,
        ...(item.keywords ?? []),
        ...(item.props ?? []).map((prop) => prop.name),
      ].join(' ')
      return fuzzyMatch(haystack, query) || haystack.toLowerCase().includes(query.toLowerCase())
    })
  }, [keyword])

  const searching = keyword.trim().length > 0

  /** 滚动高亮：以视口交叉比为判据，取最靠上的可见分类 */
  useEffect(() => {
    if (searching) return
    const nodes = Array.from(sectionRefs.current.entries())
    if (nodes.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const first = visible[0]
        if (!first) return
        const id = first.target.getAttribute('data-category')
        if (id) setActiveCategory(id)
      },
      { rootMargin: '-72px 0px -55% 0px', threshold: 0 },
    )

    nodes.forEach(([, node]) => observer.observe(node))
    return () => observer.disconnect()
  }, [searching])

  const scrollToCategory = useCallback((id: string) => {
    const node = sectionRefs.current.get(id)
    if (!node) return
    setActiveCategory(id)
    node.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const scrollToItem = useCallback((item: GalleryItem, categoryId: string) => {
    const node = sectionRefs.current.get(categoryId)
    const card = node?.querySelector<HTMLElement>(`[data-gallery-key="${item.key}"]`)
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  return (
    <PageContainer size="lg">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)]">
        {/* ---------------- 左：组件索引 ---------------- */}
        <aside className="hidden lg:block">
          <div className="sticky top-0 max-h-[calc(100dvh-7.5rem)] overflow-y-auto pr-1">
            <p className="mb-2 px-2 text-2xs font-medium tracking-[0.08em] text-fg-4 uppercase">
              Components
            </p>
            <nav aria-label="组件索引" className="space-y-3">
              {GALLERY_CATEGORIES.map((category) => {
                const active = activeCategory === category.id && !searching
                return (
                  <div key={category.id}>
                    <button
                      type="button"
                      onClick={() => scrollToCategory(category.id)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                        active
                          ? 'bg-primary-weak font-medium text-primary'
                          : 'text-fg-2 hover:bg-surface-2 hover:text-fg',
                      )}
                    >
                      <span className="truncate font-medium">{category.name}</span>
                      <span className="shrink-0 text-2xs text-fg-4 tabular-nums">
                        {GALLERY_COUNT_BY_CATEGORY[category.id]}
                      </span>
                    </button>
                    <ul className="mt-0.5 space-y-px">
                      {category.items.map((item) => (
                        <li key={item.key}>
                          <button
                            type="button"
                            onClick={() => scrollToItem(item, category.id)}
                            className="block w-full truncate rounded-sm py-1 pr-2 pl-2 text-left text-2xs text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg"
                          >
                            {item.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* ---------------- 右：标题 + 搜索 + 卡片 ---------------- */}
        <div className="min-w-0">
          <header className="mb-6">
            <h1 className="text-[2rem] leading-tight font-semibold tracking-tight text-fg sm:text-[2.25rem]">
              组件总览
              {/* 标题右侧的英文位放项目名，而不是「Overview」——
                  同一个词在页内已经出现过四次（搜索、分类标题、徽标），
                  项目名才是这一页真正需要被认出的信息 */}
              <span className="ml-2 align-middle font-normal text-fg-4">Nexus Admin</span>
            </h1>
            <p className="mt-2 max-w-[40rem] text-[0.8125rem] leading-6 text-fg-3">
              以下是 <span className="font-medium text-fg-2">@nexus/ui</span> 提供的全部组件：
              {GALLERY_TOTAL} 个条目，零第三方 UI 依赖，深浅色、键盘操作与设计令牌全部内建。
              每张卡片都是真实渲染的组件，点击可查看源码用法与 Props。
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge tone="primary" size="sm">
                {GALLERY_TOTAL} components
              </Badge>
              <Badge tone="success" size="sm">
                React 19
              </Badge>
              <Badge tone="info" size="sm">
                Tailwind v4
              </Badge>
              <Button
                size="xs"
                variant="ghost"
                rightIcon={<ArrowUpRight className="size-3" />}
                onClick={() => toast.info('组件源码位于 packages/ui/src/components')}
              >
                源码位置
              </Button>
            </div>
          </header>

          {/* 搜索 */}
          <div className="relative mb-6">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-fg-4" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索组件（支持中文、英文、拼音与 Props）"
              aria-label="搜索组件"
              className={cn(
                'h-11 w-full rounded-lg border border-line bg-surface pr-10 pl-10 text-[0.8125rem] text-fg transition-[border-color,box-shadow]',
                'placeholder:text-fg-4 hover:border-line-strong',
                'focus:border-primary/70 focus:ring-2 focus:ring-primary-ring focus:outline-none',
              )}
            />
            {searching && (
              <button
                type="button"
                onClick={() => setKeyword('')}
                aria-label="清空搜索"
                className="absolute top-1/2 right-3 grid size-6 -translate-y-1/2 place-items-center rounded-full text-fg-4 transition-colors hover:bg-surface-2 hover:text-fg-2"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {searching ? (
            <section aria-live="polite">
              <SectionHeading
                name="Search"
                title="搜索结果"
                count={hits.length}
                description={`关键词「${keyword.trim()}」`}
              />
              {hits.length === 0 ? (
                <EmptyState
                  size="md"
                  title="没有匹配的组件"
                  description="试试 Button、表格、弹层、日期，或直接搜索 Props 名（如 variant）"
                  action={
                    <Button size="sm" variant="secondary" onClick={() => setKeyword('')}>
                      清空搜索
                    </Button>
                  }
                />
              ) : (
                <GalleryGrid hits={hits} onOpen={setDetail} />
              )}
            </section>
          ) : (
            GALLERY_CATEGORIES.map((category) => (
              <section
                key={category.id}
                data-category={category.id}
                ref={(node) => {
                  if (node) sectionRefs.current.set(category.id, node)
                  else sectionRefs.current.delete(category.id)
                }}
                className="mb-9 scroll-mt-4"
              >
                <SectionHeading
                  name={category.name}
                  title={category.title}
                  count={category.items.length}
                  description={category.description}
                />
                <GalleryGrid
                  hits={category.items.map((item) => ({ item, category }))}
                  onOpen={setDetail}
                />
              </section>
            ))
          )}

          <footer className="mt-2 mb-4 rounded-lg border border-line bg-surface-2/40 px-4 py-3 text-2xs leading-6 text-fg-3">
            <p className="flex items-start gap-1.5">
              <Sparkles className="mt-1 size-3 shrink-0 text-primary" />
              <span>
                组件的完整 API 以{' '}
                <code className="rounded bg-surface px-1 font-mono">
                  packages/ui/src/components/*.tsx
                </code>{' '}
                的导出类型为准；这里的 Props 表只列最常用的几项，避免和源码出现两套真相。
              </span>
            </p>
          </footer>
        </div>
      </div>

      <GalleryDetail hit={detail} onClose={() => setDetail(null)} />
    </PageContainer>
  )
}

/* ------------------------------------------------------------------ *
 * 分类标题
 * ------------------------------------------------------------------ */

function SectionHeading({
  name,
  title,
  count,
  description,
}: {
  name: string
  title: string
  count: number
  description: string
}) {
  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-fg">
          {name} <span className="font-semibold text-fg">{title}</span>
        </h2>
        <Badge tone="primary" variant="solid">
          {count}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-fg-3">{description}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 卡片网格
 * ------------------------------------------------------------------ */

function GalleryGrid({ hits, onOpen }: { hits: SearchHit[]; onOpen: (hit: SearchHit) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {hits.map((hit) => (
        <GalleryCard key={hit.item.key} hit={hit} onOpen={() => onOpen(hit)} />
      ))}
    </div>
  )
}

function GalleryCard({ hit, onOpen }: { hit: SearchHit; onOpen: () => void }) {
  const { item, category } = hit
  const Demo = item.demo
  /**
   * 预览区「进视口才渲染」
   *
   * 橱窗是 120 张卡片的真实渲染（1300+ 组件实例），domContentLoaded 之后
   * 一次性挂载会让移动端（4× CPU 降频）产生一次 4~5s 的长任务 ——
   * 实测 Slow-4G + 4× CPU 下 TBT 3.9~5.1s、FCP 直接为 0（主线程一直没空画首帧）。
   *
   * 这里用 IntersectionObserver 把首屏之外的 demo 推迟到接近视口时再挂，
   * 占位高度沿用 `previewHeight`，所以不会产生 CLS。
   */
  const previewRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = previewRef.current
    if (visible || !node) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      // 提前 400px 预挂载：滚到卡片时 demo 已经就绪，不会看到占位
      { rootMargin: '400px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [visible])

  return (
    <article
      data-gallery-key={item.key}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface',
        'transition-[border-color,box-shadow] duration-200 hover:border-primary/35 hover:shadow-sm',
        item.wide && 'md:col-span-2',
      )}
    >
      <div className="flex items-center gap-2 border-b border-line-subtle px-3.5 py-2.5">
        <h3 className="min-w-0 truncate text-[0.8125rem] font-medium text-fg">
          {item.name}
          <span className="ml-1.5 font-normal text-fg-3">{item.nameZh}</span>
        </h3>
        {item.version && (
          <Badge tone="info" variant="outline" size="sm">
            {item.version}
          </Badge>
        )}
        <span className="ml-auto hidden shrink-0 text-2xs text-fg-4 sm:inline">
          {category.name}
        </span>
      </div>

      {/* 预览区：真实渲染（进入视口后才挂载） */}
      <div
        ref={previewRef}
        className="relative flex min-w-0 flex-1 items-center justify-center bg-bg-subtle/60 px-4 py-5"
        style={{ minHeight: item.previewHeight ?? 140 }}
      >
        {visible ? (
          <Demo />
        ) : (
          // 占位与真实内容同高：只画一个极淡的骨架，不给主线程添活
          <span
            aria-hidden="true"
            className="h-6 w-24 rounded bg-surface-3/60"
            data-gallery-placeholder={item.key}
          />
        )}
        {/* 悬浮揭示「查看用法」：绝对定位，不参与布局，避免 hover 时撑高卡片 */}
        <button
          type="button"
          onClick={onOpen}
          aria-label={`查看 ${item.name} 的用法与 Props`}
          className={cn(
            'absolute right-2.5 bottom-2.5 flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-2xs text-fg-2 shadow-sm',
            'opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100',
            'hover:border-primary/40 hover:text-primary',
          )}
        >
          <Code2 className="size-3" />
          用法
        </button>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ *
 * 详情弹窗：预览 / 用法 / Props
 * ------------------------------------------------------------------ */

/**
 * 详情弹窗：用法 / Props
 *
 * tab 状态用 `hit` 作 key 的受控组件包一层（见下方 GalleryDetailBody），
 * 这样「每次打开都回到用法页」由 React 的重挂载保证，而不是在 effect 里 setState。
 */
function GalleryDetail({ hit, onClose }: { hit: SearchHit | null; onClose: () => void }) {
  const item = hit?.item

  return (
    <Dialog
      open={Boolean(hit)}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      size="lg"
      title={
        item ? (
          <span className="flex items-center gap-2">
            {item.name}
            <span className="text-xs font-normal text-fg-3">{item.nameZh}</span>
            {item.version && (
              <Badge tone="info" variant="outline" size="sm">
                {item.version}
              </Badge>
            )}
          </span>
        ) : undefined
      }
      description={item?.summary}
      footer={
        <Button variant="primary" onClick={onClose}>
          关闭
        </Button>
      }
    >
      {item && <GalleryDetailBody key={item.key} item={item} />}
    </Dialog>
  )
}

const DETAIL_TABS: TabItem[] = [
  { key: 'usage', label: '用法示例' },
  { key: 'props', label: 'Props' },
]

function GalleryDetailBody({ item }: { item: GalleryItem }) {
  const [tab, setTab] = useState('usage')

  return (
    <div className="space-y-3">
      <Tabs variant="pill" size="sm" value={tab} onChange={setTab} items={DETAIL_TABS} />

      {tab === 'usage' && (
        <CodeBlock filename={`${item.name}.tsx`} language="tsx" maxHeight={420} code={item.code} />
      )}

      {tab === 'props' && (
        <div className="overflow-hidden rounded-md border border-line">
          {item.props && item.props.length > 0 ? (
            <table className="n-table w-full text-left">
              <thead>
                <tr>
                  <th className="h-9 px-3 text-2xs font-medium text-fg-3">属性</th>
                  <th className="h-9 px-3 text-2xs font-medium text-fg-3">类型</th>
                  <th className="h-9 px-3 text-2xs font-medium text-fg-3">默认</th>
                  <th className="h-9 px-3 text-2xs font-medium text-fg-3">说明</th>
                </tr>
              </thead>
              <tbody>
                {item.props.map((prop) => (
                  <tr key={prop.name} className="border-t border-line-subtle align-top">
                    <td className="px-3 py-2 font-mono text-2xs whitespace-nowrap text-primary">
                      {prop.name}
                    </td>
                    <td className="px-3 py-2 font-mono text-2xs leading-5 text-fg-2">
                      {prop.type}
                    </td>
                    <td className="px-3 py-2 font-mono text-2xs whitespace-nowrap text-fg-3">
                      {prop.default ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-xs leading-5 text-fg-2">{prop.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Descriptions
              size="sm"
              columns={1}
              className="p-3"
              items={[
                { label: '说明', value: '该条目由现有组件组合而成，无需额外 Props。' },
                { label: '出处', value: '见「用法示例」中的源码，复制即可复用。' },
              ]}
            />
          )}
        </div>
      )}
    </div>
  )
}
