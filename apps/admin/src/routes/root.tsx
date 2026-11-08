import { Suspense, useEffect } from 'react'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Button, Skeleton, configureUILabels, DEFAULT_UI_LABELS } from '@nexus/ui'
import { CommandPalette } from '@/layout/command-palette'
import { initThemeListener } from '@/core/ui-store'
import { useHttpBootstrap } from '@/core/use-http'
import { useI18n } from '@/i18n'

function RootLayout() {
  initThemeListener()
  useHttpBootstrap()
  const { t, locale } = useI18n()

  // 组件库内置文案只做中文缺省值；按当前语言注入一次，切语言即时生效
  useEffect(() => {
    configureUILabels(
      locale === 'zh-CN'
        ? DEFAULT_UI_LABELS
        : {
            copy: t('common.copy'),
            copied: t('common.copied'),
            copiedToClipboard: t('ui.copiedToClipboard'),
            copyFailed: t('ui.copyFailed'),
            clear: t('ui.clear'),
            clearSearch: t('ui.clearSearch'),
            search: t('common.search'),
            searchOptions: t('ui.searchOptions'),
            selectPlaceholder: t('ui.selectPlaceholder'),
            selectedCount: (n) => t('common.selected', { n }),
            empty: t('common.empty'),
            confirm: t('common.confirm'),
            cancel: t('common.cancel'),
            loading: t('common.loading'),
            deltaLabel: t('dashboard.vsLastMonth'),
          },
    )
  }, [locale, t])

  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <Outlet />
      </Suspense>
      <CommandPalette />
    </>
  )
}

function RootNotFound() {
  const { t } = useI18n()
  return (
    <div className="grid min-h-dvh place-items-center bg-bg p-6">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-8 text-center shadow-sm">
        <p className="font-mono text-5xl font-bold tracking-tighter text-primary">404</p>
        <h1 className="mt-3 text-base font-semibold text-fg">{t('errors.notFoundTitle')}</h1>
        <p className="mt-1 text-xs leading-5 text-fg-3">{t('errors.notFoundDesc')}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => window.history.back()}>
            {t('errors.goBack')}
          </Button>
          <Button variant="primary" onClick={() => window.location.assign('/dashboard/overview')}>
            {t('errors.backToDashboard')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function RootBootError({ error }: { error: unknown }) {
  const { t } = useI18n()
  return (
    <div className="grid min-h-dvh place-items-center bg-bg p-6">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6">
        <h1 className="text-sm font-semibold text-fg">{t('errors.bootFailed')}</h1>
        <p className="mt-2 rounded-md bg-danger-weak p-2.5 font-mono text-xs break-all text-danger">
          {(error as Error)?.message ?? t('errors.unknown')}
        </p>
        <Button className="mt-4" variant="primary" onClick={() => window.location.reload()}>
          {t('errors.reload')}
        </Button>
      </div>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="p-5">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mt-2 h-3 w-64" />
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="mt-3 h-72 rounded-lg" />
    </div>
  )
}

export const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: RootNotFound,
  errorComponent: ({ error }) => <RootBootError error={error} />,
})
