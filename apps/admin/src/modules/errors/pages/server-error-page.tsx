import { useAppNavigate } from '@/components/app-link'
import { Button, CodeBlock, PageContainer } from '@nexus/ui'
import { RotateCcw } from 'lucide-react'
import { BANNER_IMAGES } from '@/assets/banners'
import { useI18n } from '@/i18n'

/**
 * 500 服务异常
 *
 * 顶部放一张 3D 报障服务器插画：错误页是用户最紧张的时刻，
 * 柔和的插画能把「系统崩了」的观感降下来，比红底感叹号更耐看、也更少惊吓。
 */
export default function ServerErrorPage() {
  const navigate = useAppNavigate()
  const { t } = useI18n()
  return (
    <PageContainer size="md">
      <div className="grid min-h-[70vh] place-items-center">
        <div className="w-full max-w-[32.5rem]">
          <div className="text-center">
            <img
              src={BANNER_IMAGES.serverError}
              alt=""
              aria-hidden="true"
              width={128}
              height={128}
              className="mx-auto mb-4 size-28 object-contain drop-shadow-[0_12px_28px_rgb(16_24_40/0.14)] sm:size-32"
            />
            <p className="font-mono text-5xl font-bold tracking-tighter text-fg">500</p>
            <h1 className="mt-3 text-base font-semibold text-fg">{t('errors.serverTitle')}</h1>
            <p className="mx-auto mt-1.5 max-w-[23.75rem] text-xs leading-5 text-fg-3">
              {t('errors.serverDesc')}
            </p>
          </div>

          <div className="mt-5 rounded-lg border border-line bg-surface p-3">
            <p className="mb-1.5 text-2xs font-medium text-fg-2">{t('errors.detailDev')}</p>
            <CodeBlock
              language="json"
              filename="trace"
              maxHeight={160}
              showLineNumbers={false}
              code={`{
  "traceId": "trace_9f2ac81b3e",
  "status": 500,
  "message": "Upstream service timeout: billing-core (5s)",
  "service": "api-gateway",
  "timestamp": "${new Date().toISOString()}"
}`}
            />
          </div>

          <div className="mt-5 flex justify-center gap-2">
            <Button
              variant="secondary"
              leftIcon={<RotateCcw className="size-3.5" />}
              onClick={() => window.location.reload()}
            >
              {t('errors.reloadPage')}
            </Button>
            <Button variant="primary" onClick={() => navigate('/dashboard/overview')}>
              {t('errors.backToDashboard')}
            </Button>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
