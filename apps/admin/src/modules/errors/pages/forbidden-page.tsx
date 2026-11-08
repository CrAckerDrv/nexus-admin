import { useAppNavigate } from '@/components/app-link'
import { Button, PageContainer } from '@nexus/ui'
import { ShieldAlert } from 'lucide-react'
import { useRouterState } from '@tanstack/react-router'
import { BANNER_IMAGES } from '@/assets/banners'
import { useAuthStore } from '@/core/auth-store'
import { useI18n } from '@/i18n'
import { ROLE_KEY_BY_ID } from '@/i18n/locales/keys'

/** 403 无权限 */
export default function ForbiddenPage() {
  const navigate = useAppNavigate()
  const user = useAuthStore((state) => state.user)
  const { t } = useI18n()
  // 路由守卫跳转时会带上来源路径与所需权限码
  const search = useRouterState({ select: (state) => state.location.search }) as {
    from?: string
    need?: string
  }
  const permissions = user?.permissions ?? []
  const granted = permissions.includes('*')
    ? [t('errors.allPermissions')]
    : permissions.length > 0
      ? permissions
      : [t('errors.noPermissions')]
  const needed = search?.need
  const from = search?.from

  return (
    <PageContainer size="md">
      <div className="grid min-h-[70vh] place-items-center">
        <div className="w-full max-w-[27.5rem] text-center">
          {/* 3D 插画替代纯色图标块：错误页是全屏的，一张插画比一个线框图标更「有人味」 */}
          <img
            src={BANNER_IMAGES.lockShield}
            alt=""
            aria-hidden="true"
            width={128}
            height={128}
            className="mx-auto mb-4 size-28 object-contain drop-shadow-[0_12px_28px_rgb(16_24_40/0.14)] sm:size-32"
          />
          <p className="font-mono text-5xl font-bold tracking-tighter text-fg">403</p>
          <h1 className="mt-3 text-base font-semibold text-fg">{t('errors.forbiddenTitle')}</h1>
          <p className="mx-auto mt-1.5 max-w-[22.5rem] text-xs leading-5 text-fg-3">
            {from ? (
              <>
                {t('errors.forbiddenFrom')}{' '}
                <code className="rounded bg-surface-2 px-1 font-mono">{from}</code>{' '}
                {t('errors.forbiddenNeeds')}{' '}
                <code className="rounded bg-surface-2 px-1 font-mono">{needed}</code>{' '}
                {t('errors.forbiddenTail')}
              </>
            ) : (
              t('errors.forbiddenDesc')
            )}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/dashboard/overview')}>
              {t('errors.backToDashboard')}
            </Button>
            <Button variant="primary" onClick={() => navigate('/organization/roles')}>
              {t('errors.requestPermission')}
            </Button>
          </div>
          <div className="mt-6 rounded-lg border border-line bg-surface p-3 text-left">
            <p className="mb-1.5 flex items-center gap-1.5 text-2xs font-medium text-fg-2">
              <ShieldAlert className="size-3.5 text-warning" />
              {t('errors.permissionHelp')}
            </p>
            <p className="text-2xs leading-5 text-fg-3">
              {t('errors.requiredPermission')}
              <code className="rounded bg-surface-2 px-1 font-mono">{needed ?? 'role:read'}</code>
              <br />
              {t('errors.currentAccount')}
              <span className="font-medium text-fg-2">
                {user ? t(ROLE_KEY_BY_ID[user.role] ?? 'role.viewer') : t('errors.notLoggedIn')}
              </span>
              <br />
              {t('errors.currentPermissions')}
              <code className="rounded bg-surface-2 px-1 font-mono">
                {granted.slice(0, 4).join(' · ')}
              </code>
              {granted.length > 4 && (
                <span className="text-fg-4">{t('errors.moreItems', { n: granted.length })}</span>
              )}
            </p>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
