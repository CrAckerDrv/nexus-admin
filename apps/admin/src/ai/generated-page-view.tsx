import { ArrowUpRight, Sparkles, Trash2, WandSparkles } from 'lucide-react'
import type { PageSpec } from '@nexus/ai-sdk'
import { Badge, Button, EmptyState, PageContainer, PageHeader, cn, toast } from '@nexus/ui'
import { getAssistant } from '@/ai'
import { useAssistantPanelStore } from '@/ai/panel-store'
import { useGeneratedPages } from '@/ai/page-store'
import { useAppNavigate } from '@/components/app-link'
import { useI18n } from '@/i18n'
import { PageRenderer } from './components/page-renderer'

/**
 * 生成页正式视图
 *
 * 这是「应用到侧边栏」之后用户真正看到的页面。
 * 与预览共用同一个 `PageRenderer`，只有外壳不同：
 * - 预览：卡片 + 操作条 + 可调色
 * - 正式页：标准 PageHeader + 全宽内容 + 「继续调整」入口
 *
 * 找不到规格（用户清空过页面库）时给出明确的恢复路径，
 * 而不是白屏或 404 —— 这个页面是「曾经存在」的事实，值得一句解释。
 */
export function GeneratedPageView({ page, path }: { page?: PageSpec; path: string }) {
  const { t } = useI18n()
  const navigate = useAppNavigate()
  const remove = useGeneratedPages((state) => state.remove)
  const openPanel = useAssistantPanelStore((state) => state.setOpen)

  if (!page) {
    return (
      <PageContainer>
        <EmptyState
          title={t('assistant.missingTitle')}
          description={t('assistant.missingDesc', { path })}
          action={
            <Button
              variant="primary"
              leftIcon={<Sparkles className="size-3.5" />}
              onClick={() => {
                navigate('/assistant/workspace')
                openPanel(true)
              }}
            >
              {t('assistant.openWorkspace')}
            </Button>
          }
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer size="lg">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {page.title}
            <Badge tone="primary" size="sm">
              AI
            </Badge>
          </span>
        }
        description={page.description || page.dataSource}
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<WandSparkles className="size-3.5" />}
              onClick={() => {
                getAssistant().patchLastPage(page)
                openPanel(true)
              }}
            >
              {t('assistant.continueAdjust')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<ArrowUpRight className="size-3.5" />}
              onClick={() => navigate('/assistant/workspace')}
            >
              {t('assistant.openWorkspace')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Trash2 className="size-3.5" />}
              onClick={() => {
                remove(page.id)
                toast.success(t('assistant.removed'))
                navigate('/dashboard/overview')
              }}
            >
              {t('common.delete')}
            </Button>
          </>
        }
      />

      <div
        className={cn(
          'rounded-lg',
          page.theme.surface === 'gradient' &&
            'bg-gradient-to-br from-primary/[0.05] via-transparent to-transparent',
        )}
      >
        <PageRenderer page={page} />
      </div>
    </PageContainer>
  )
}
