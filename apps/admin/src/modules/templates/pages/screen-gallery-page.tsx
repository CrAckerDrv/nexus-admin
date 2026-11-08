import { useState, type ReactNode } from 'react'
import { ArrowUpRight, ExternalLink, LayoutGrid, MonitorPlay } from 'lucide-react'
import { Badge, Button, Card, PageContainer, PageHeader, SegmentedControl, cn, sx } from '@nexus/ui'
import { useAppNavigate } from '@/components/app-link'
import { SCREENS, type ScreenId, type ScreenMeta } from './screen-meta'

/**
 * 数据大屏 · 模板列表
 *
 * 定位：大屏是「一次性投屏资产」，不该占用工作区的页签。
 * 所以入口页只做两件事 —— 让你看清每块屏适合什么系统，然后在新标签页打开它。
 *
 * 卡片左侧的「屏幕预览」用纯 CSS 画出该屏的版式骨架（不是截图）：
 * 颜色取自该模板真实的配色令牌，版式取自它真实的分栏结构，
 * 这样列表页本身不会因为放缩略图而多几张几百 KB 的图片。
 * 八块屏的骨架各不相同（矩阵 / 仪表 / 战报 / 卡阵），扫一眼就能分辨。
 */

type SchemeFilter = 'all' | 'dark' | 'light'

const SCHEME_OPTIONS = [
  { value: 'all' as const, label: '全部' },
  { value: 'dark' as const, label: '深色' },
  { value: 'light' as const, label: '浅色' },
]

export default function ScreenGalleryPage() {
  const navigate = useAppNavigate()
  const [filter, setFilter] = useState<SchemeFilter>('all')

  const visible = filter === 'all' ? SCREENS : SCREENS.filter((screen) => screen.scheme === filter)

  return (
    <PageContainer size="lg">
      <PageHeader
        title="数据大屏"
        description="8 种风格的大屏模板，覆盖运营、运维、财务、仓储、城市、制造、大促、算力；点击卡片在新标签页打开，不打断当前工作"
        badge={<Badge tone="primary">{SCREENS.length} 个模板</Badge>}
        actions={
          <Button
            variant="secondary"
            leftIcon={<LayoutGrid className="size-3.5" />}
            onClick={() => navigate('/templates/overview')}
          >
            返回模板总览
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2/60 px-3 py-2">
        <MonitorPlay className="size-3.5 shrink-0 text-primary" />
        <p className="text-xs text-fg-2">
          大屏页面是独立路由（不套侧栏与顶栏），适合投屏与值班室；关闭标签页即退出。
        </p>
        <div className="ml-auto flex items-center gap-2">
          <SegmentedControl
            size="sm"
            value={filter}
            onChange={setFilter}
            options={SCHEME_OPTIONS}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((screen) => (
          <ScreenCard key={screen.id} screen={screen} />
        ))}
      </div>
    </PageContainer>
  )
}

/** 筛选状态（避免为一个本地小开关引入额外依赖） */
function ScreenCard({ screen }: { screen: ScreenMeta }) {
  return (
    <Card
      hoverable
      className="group flex flex-col gap-0 overflow-hidden p-0"
      onClick={() => window.open(screen.path, '_blank', 'noopener,noreferrer')}
    >
      {/* 版式预览：用 CSS 画该屏的骨架，颜色来自它自己的配色 */}
      <ScreenPreview screen={screen} />

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-start gap-2.5">
          <span
            className="grid size-8 shrink-0 place-items-center rounded-md"
            style={{
              backgroundColor: `${screen.swatches[1]}1f`,
              color: screen.swatches[1],
            }}
          >
            <screen.icon className="size-4" strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-[0.8125rem] font-semibold text-fg">{screen.title}</h3>
              <ExternalLink className="size-3 shrink-0 text-fg-4 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-0.5 truncate text-xs text-fg-3">{screen.subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <Badge size="sm" tone="neutral">
            {screen.style}
          </Badge>
          <Badge size="sm" tone={screen.scheme === 'dark' ? 'primary' : 'warning'}>
            {screen.scheme === 'dark' ? '深色' : '浅色'}
          </Badge>
          <Badge size="sm" tone={screen.density === 'high' ? 'danger' : 'success'}>
            {screen.density === 'high' ? '高密度' : '中等密度'}
          </Badge>
          <span className="ml-1 text-2xs text-fg-3">适用：{screen.fitFor}</span>
        </div>

        <ul className="space-y-1 text-xs text-fg-2">
          {screen.highlights.map((line) => (
            <li key={line} className="flex items-start gap-1.5">
              <span
                className="mt-1.5 size-1 shrink-0 rounded-full"
                style={{ backgroundColor: screen.swatches[1] }}
              />
              <span className="min-w-0">{line}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto flex items-center gap-1.5 border-t border-line-subtle pt-2.5">
          <code className="min-w-0 flex-1 truncate font-mono text-2xs text-fg-4">
            {screen.path}
          </code>
          <Button
            size="xs"
            variant="ghost"
            rightIcon={<ArrowUpRight className="size-3" />}
            onClick={(event) => {
              event.stopPropagation()
              window.open(screen.path, '_blank', 'noopener,noreferrer')
            }}
          >
            打开
          </Button>
        </div>
      </div>
    </Card>
  )
}

/* ------------------------------ 版式预览 ------------------------------ */

/**
 * 版式预览
 *
 * 只用 div + 该屏的配色画出「三栏 / 矩阵 / 仪表 / 战报」这类结构差异，
 * 让人不看文字也能分辨八种风格。每种骨架单独一个函数，
 * 新增一块屏时只需要补一个分支。
 */
function ScreenPreview({ screen }: { screen: ScreenMeta }) {
  const [bg, accent, accent2] = screen.swatches
  const line = screen.scheme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'
  const soft = screen.scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'

  const block = (height: number, color = soft, radius = 4) => (
    <span
      className="block w-full"
      style={{ height: sx(height), backgroundColor: color, borderRadius: sx(radius) }}
    />
  )

  const skeleton: Record<ScreenId, () => ReactNode> = {
    'command-center': () => (
      <>
        <div className="flex items-end gap-1">
          <span
            className="h-3 w-12 shrink-0 rounded-[0.125rem]"
            style={{ backgroundColor: accent, opacity: 0.9 }}
          />
          <span className="h-2 w-6 rounded-[0.125rem]" style={{ backgroundColor: soft }} />
        </div>
        <div className="flex flex-1 gap-1.5">
          <div className="flex w-1/4 flex-col gap-1">
            {block(20)} {block(20)}
          </div>
          <div
            className="flex-1 rounded-[0.1875rem]"
            style={{
              background: `linear-gradient(180deg, ${accent}33, transparent)`,
              borderBottom: `1px solid ${accent}`,
            }}
          />
          <div className="flex w-1/4 flex-col gap-1">
            {block(20)} {block(20)}
          </div>
        </div>
      </>
    ),

    ops: () => (
      <>
        <div className="grid grid-cols-6 gap-1">
          {Array.from({ length: 12 }).map((_, index) => (
            <span
              key={index}
              className="h-2 rounded-[0.125rem]"
              style={{
                backgroundColor: index % 5 === 3 ? accent2 : index % 3 === 0 ? accent : soft,
                opacity: index % 5 === 3 ? 0.9 : index % 3 === 0 ? 0.55 : 1,
              }}
            />
          ))}
        </div>
        <div className="flex flex-1 gap-1.5">
          <div className="flex flex-1 flex-col justify-end gap-0.5">
            <div className="flex items-end gap-0.5">
              {[8, 14, 10, 18, 13, 20, 16].map((height, index) => (
                <span
                  key={index}
                  className="flex-1 rounded-t-[1px]"
                  style={{ height: sx(height), backgroundColor: accent, opacity: 0.75 }}
                />
              ))}
            </div>
          </div>
          <div className="flex w-1/3 flex-col gap-1">
            {block(6, `${accent2}cc`, 2)}
            {block(6)}
            {block(6)}
            {block(6, `${accent2}cc`, 2)}
          </div>
        </div>
      </>
    ),

    finance: () => (
      <>
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className="h-6 flex-1 rounded-[0.1875rem]"
              style={{ backgroundColor: '#fff', border: `1px solid ${line}` }}
            />
          ))}
        </div>
        <div className="flex flex-1 gap-1.5">
          <div
            className="flex flex-1 items-end gap-0.5 rounded-[0.1875rem] p-1"
            style={{ backgroundColor: '#fff', border: `1px solid ${line}` }}
          >
            {[10, 18, 13, 22, 17].map((height, index) => (
              <span
                key={index}
                className="flex-1 rounded-t-[1px]"
                style={{
                  height: sx(height),
                  backgroundColor: index === 3 ? accent : `${accent}55`,
                }}
              />
            ))}
          </div>
          <div className="flex w-1/3 flex-col gap-1">
            <span
              className="flex h-6 items-center justify-center rounded-[0.1875rem]"
              style={{ backgroundColor: '#fff', border: `1px solid ${line}` }}
            >
              <span
                className="size-3.5 rounded-full border-2"
                style={{ borderColor: accent, borderTopColor: 'transparent' }}
              />
            </span>
            {block(6)}
            {block(6)}
          </div>
        </div>
      </>
    ),

    logistics: () => (
      <>
        <div className="grid grid-cols-4 gap-1">
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className="h-4 rounded-[0.125rem]"
              style={{ backgroundColor: index === 0 ? `${accent}55` : soft }}
            />
          ))}
        </div>
        <div className="flex flex-1 gap-1.5">
          <div
            className="relative flex-1 overflow-hidden rounded-[0.1875rem]"
            style={{ backgroundColor: soft }}
          >
            {/* 仓网连线示意 */}
            <svg className="absolute inset-0 size-full" aria-hidden="true">
              <path
                d="M10 26 L34 14 L58 22 L78 10"
                fill="none"
                stroke={accent}
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              {[
                [10, 26],
                [34, 14],
                [58, 22],
                [78, 10],
              ].map(([x, y], index) => (
                <circle key={index} cx={x} cy={y} r="2" fill={index === 2 ? accent2 : accent} />
              ))}
            </svg>
          </div>
          <div className="flex w-1/4 flex-col gap-1">
            {block(6, `${accent}44`, 2)}
            {block(6)}
            {block(6, `${accent2}44`, 2)}
          </div>
        </div>
      </>
    ),

    // 城市：整屏是「格子」，所以预览也画格子
    city: () => (
      <>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <span
              key={index}
              className="h-2.5 flex-1 rounded-[0.125rem]"
              style={{ backgroundColor: soft }}
            />
          ))}
        </div>
        <div className="grid flex-1 grid-cols-12 gap-0.5">
          {Array.from({ length: 72 }).map((_, index) => (
            <span
              key={index}
              className="rounded-[0.0625rem]"
              style={{
                backgroundColor:
                  index === 22 || index === 47
                    ? accent2
                    : `rgba(167,139,250,${0.16 + ((index * 13) % 70) / 100})`,
              }}
            />
          ))}
        </div>
      </>
    ),

    // 制造：浅色车间 + 产线进度条 + 仪表
    manufacturing: () => (
      <>
        <div className="flex items-center gap-1.5">
          <span
            className="size-2.5 shrink-0 rounded-full border-2"
            style={{ borderColor: accent, borderTopColor: 'transparent' }}
          />
          {block(5)}
          <span
            className="h-2 w-8 shrink-0 rounded-[0.125rem]"
            style={{ backgroundColor: accent2 }}
          />
        </div>
        <div className="flex flex-1 gap-1.5">
          <div className="flex flex-1 flex-col justify-center gap-1">
            {[0.72, 0.94, 0.61, 0.38].map((ratio, index) => (
              <span
                key={index}
                className="block h-1.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: 'rgba(15,23,42,0.07)' }}
              >
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${ratio * 100}%`,
                    backgroundColor: index === 3 ? accent2 : accent,
                    opacity: index === 3 ? 0.9 : 0.7,
                  }}
                />
              </span>
            ))}
          </div>
          <div className="grid w-[42%] shrink-0 grid-cols-6 content-start gap-0.5">
            {Array.from({ length: 24 }).map((_, index) => (
              <span
                key={index}
                className="aspect-square rounded-[0.0625rem]"
                style={{
                  backgroundColor:
                    index === 9 ? accent2 : index % 7 === 3 ? 'rgba(15,23,42,0.12)' : `${accent}66`,
                }}
              />
            ))}
          </div>
        </div>
      </>
    ),

    // 大促：Hero 数字 + 售罄进度，红金配色
    campaign: () => (
      <>
        <div className="flex items-end gap-1.5">
          <span
            className="h-4 w-16 shrink-0 rounded-[0.125rem]"
            style={{ backgroundColor: accent2, opacity: 0.9 }}
          />
          <span
            className="h-2 w-8 rounded-[0.125rem]"
            style={{ backgroundColor: accent, opacity: 0.7 }}
          />
          <span className="ml-auto flex gap-0.5">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className="h-3 w-3 rounded-[0.125rem]"
                style={{ backgroundColor: `${accent2}44` }}
              />
            ))}
          </span>
        </div>
        <div className="flex flex-1 gap-1.5">
          <div
            className="flex flex-1 items-end rounded-[0.1875rem] px-1.5 pb-1"
            style={{
              background: `linear-gradient(180deg, ${accent2}26, transparent 78%)`,
              borderBottom: `1px solid ${accent2}66`,
            }}
          >
            <div className="flex w-full items-end gap-0.5">
              {[9, 14, 11, 19, 16, 24, 21, 28].map((height, index) => (
                <span
                  key={index}
                  className="flex-1 rounded-t-[1px]"
                  style={{ height: sx(height), backgroundColor: accent, opacity: 0.8 }}
                />
              ))}
            </div>
          </div>
          <div className="flex w-[38%] flex-col gap-1">
            {[0.92, 0.78, 0.61, 0.48].map((ratio, index) => (
              <span
                key={index}
                className="block h-1.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
              >
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${ratio * 100}%`, backgroundColor: accent2, opacity: 0.85 }}
                />
              </span>
            ))}
          </div>
        </div>
      </>
    ),

    // 算力：节点 × 卡阵
    compute: () => (
      <>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <span
              key={index}
              className="h-2.5 flex-1 rounded-[0.125rem]"
              style={{ backgroundColor: index === 2 ? `${accent}77` : soft }}
            />
          ))}
        </div>
        <div className="flex flex-1 flex-col justify-center gap-1">
          {Array.from({ length: 4 }).map((_, row) => (
            <div key={row} className="flex items-center gap-1">
              <span
                className="w-3 shrink-0 rounded-[0.0625rem]"
                style={{ height: 4, backgroundColor: soft }}
              />
              <div className="grid flex-1 grid-cols-8 gap-0.5">
                {Array.from({ length: 8 }).map((_, cell) => {
                  const full = (row * 8 + cell) % 7 === 3
                  return (
                    <span
                      key={cell}
                      className="relative block overflow-hidden rounded-[0.0625rem]"
                      style={{ height: sx(9), backgroundColor: `${accent}22` }}
                    >
                      <span
                        className="absolute inset-x-0 bottom-0"
                        style={{
                          height: `${40 + ((row * 8 + cell) % 6) * 10}%`,
                          backgroundColor: full ? accent2 : accent,
                          opacity: full ? 0.85 : 0.6,
                        }}
                      />
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </>
    ),
  }

  const Body = skeleton[screen.id]

  return (
    <div
      className={cn('relative h-[8.25rem] w-full overflow-hidden')}
      style={{ backgroundColor: bg, borderBottom: `1px solid ${line}` }}
      aria-hidden="true"
    >
      <div className="absolute inset-2.5 flex flex-col gap-1.5">
        {/* 顶栏 */}
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: accent }} />
          {block(5, soft)}
          <span className="w-6 shrink-0" />
        </div>

        {/* 主体：按模板 id 给不同版式 */}
        <Body />
      </div>

      {/* 右下角的「新标签页」提示 */}
      <span
        className="absolute right-1.5 bottom-1.5 inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[0.5625rem] opacity-70 transition-opacity group-hover:opacity-100"
        style={{
          backgroundColor: screen.scheme === 'dark' ? 'rgba(255,255,255,.1)' : 'rgba(15,23,42,.06)',
          color: screen.scheme === 'dark' ? '#fff' : '#0f172a',
        }}
      >
        <ExternalLink className="size-2.5" />
        新标签页
      </span>
    </div>
  )
}
