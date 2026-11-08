import { useEffect, type ReactNode } from 'react'
import { Button, EmptyState, cn } from '@nexus/ui'
import { useI18n } from '@/i18n'

/** 路由级错误边界 */
export function RouteError({ error, reset }: { error: unknown; reset?: () => void }) {
  const { t } = useI18n()
  const message =
    error instanceof Error ? error.message : String(error ?? t('errors.unknown'))
  useEffect(() => {
    console.error('[RouteError]', error)
  }, [error])

  return (
    <div className="p-5">
      <div className="mx-auto max-w-xl rounded-lg border border-danger/25 bg-danger-weak/50 p-5">
        <h2 className="text-sm font-semibold text-danger">{t('errors.loadFailed')}</h2>
        <p className="mt-1 text-xs text-fg-3">{t('errors.loadFailedDesc')}</p>
        <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-surface p-2.5 font-mono text-xs break-all whitespace-pre-wrap text-fg-2">
          {message}
        </pre>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => reset?.()}>
            {t('errors.retry')}
          </Button>
          <Button variant="ghost" onClick={() => window.location.reload()}>
            {t('errors.reload')}
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * 路由级加载骨架
 *
 * 刻意做成「和真实页面同构」的形状：标题 + 描述 + KPI 行 + 主图卡片。
 * 页面加载完成后骨架被真实内容替换，位置对得上就不会有跳动感，
 * 这比一堆等宽灰条更接近「秒开」的观感。
 */
export function RoutePending({ compact = false }: { compact?: boolean }) {
  return (
    <div className="n-page-enter p-4 sm:p-5" aria-busy="true" aria-live="polite">
      {/* 标题区 */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="n-skeleton h-5 w-32 rounded-sm" />
          <div className="n-skeleton h-3 w-56 rounded-sm" />
        </div>
        <div className="hidden gap-2 sm:flex">
          <div className="n-skeleton h-8 w-20 rounded-md" />
          <div className="n-skeleton h-8 w-24 rounded-md" />
        </div>
      </div>

      {!compact && (
        <>
          {/* KPI 行 */}
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-lg border border-line bg-surface p-3">
                <div className="flex items-center gap-2">
                  <div className="n-skeleton size-7 rounded-md" />
                  <div className="n-skeleton h-3 w-16 rounded-sm" />
                </div>
                <div className="n-skeleton mt-3 h-6 w-28 rounded-sm" />
                <div className="n-skeleton mt-2 h-2.5 w-20 rounded-sm" />
              </div>
            ))}
          </div>

          {/* 主内容：图表 + 侧栏 */}
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
            <div className="rounded-lg border border-line bg-surface p-3">
              <div className="n-skeleton h-3.5 w-24 rounded-sm" />
              <div className="n-skeleton mt-1.5 h-2.5 w-40 rounded-sm" />
              <div className="mt-4 flex h-[15rem] items-end gap-1.5">
                {[42, 68, 55, 80, 62, 90, 48, 72, 58, 84, 64, 76].map((height, index) => (
                  <div
                    key={index}
                    className="n-skeleton flex-1 rounded-t-sm"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-line bg-surface p-3">
              <div className="n-skeleton h-3.5 w-20 rounded-sm" />
              <div className="n-skeleton mt-1.5 h-2.5 w-28 rounded-sm" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="n-skeleton size-2 rounded-full" />
                    <div className="n-skeleton h-2.5 flex-1 rounded-sm" />
                    <div className="n-skeleton h-2.5 w-8 rounded-sm" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** 表格类页面的骨架：列宽稳定，避免表格在数据到达时横向抖动 */
export function RouteTablePending({ columns = 6, rows = 8 }: { columns?: number; rows?: number }) {
  return (
    <div className="n-page-enter p-4 sm:p-5" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="n-skeleton h-5 w-32 rounded-sm" />
        <div className="n-skeleton h-3 w-56 rounded-sm" />
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-line bg-surface">
        <div className="flex items-center gap-3 border-b border-line bg-surface-2 px-3 py-2.5">
          {Array.from({ length: columns }).map((_, index) => (
            <div key={index} className="n-skeleton h-2.5 flex-1 rounded-sm" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className={cn(
              'flex items-center gap-3 px-3 py-3',
              rowIndex !== rows - 1 && 'border-b border-line/60',
            )}
          >
            {Array.from({ length: columns }).map((_, index) => (
              <div key={index} className="n-skeleton h-3 flex-1 rounded-sm" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function RouteEmpty({
  title,
  description,
}: {
  title?: string
  description?: ReactNode
}) {
  const { t } = useI18n()
  return (
    <EmptyState
      title={title ?? t('errors.emptyTitle')}
      description={description ?? t('errors.emptyDesc')}
      size="lg"
    />
  )
}
