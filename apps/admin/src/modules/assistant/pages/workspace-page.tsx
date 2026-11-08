import { useState } from 'react'
import { ArrowUpRight, CircleAlert, Info, Plug, Sparkles } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  PageContainer,
  PageHeader,
  SegmentedControl,
  SectionCard,
  cn,
  toast,
} from '@nexus/ui'
import { getAssistant, getGatewayNote, useAssistantSnapshot } from '@/ai'
import { listAssistantApi as sdkListAssistantApi } from '@nexus/ai-sdk'
import { useGeneratedPages } from '@/ai/page-store'
import { AssistantThread } from '@/ai/components/assistant-thread'
import { SessionList } from '@/ai/components/session-list'
import { ApiRegistrationPanel } from '@/ai/components/api-registration-panel'
import { PagePreviewCard } from '@/ai/components/page-preview'
import { useI18n } from '@/i18n'

type TabKey = 'chat' | 'preview' | 'api' | 'guide'

/**
 * AI 运营助手工作台
 *
 * 与顶栏浮层共用同一个 `AssistantCore` 单例：
 * 在浮层里说的第一句，切到整页后仍然在；反过来也一样。
 * 两处只共享「会话」，「布局」各自独立（浮层窄、整页宽）。
 */
export default function AssistantWorkspacePage() {
  const { t } = useI18n()
  const [tab, setTab] = useState<TabKey>('chat')
  const snapshot = useAssistantSnapshot()
  const pages = useGeneratedPages((state) => state.pages)
  const appliedIds = useGeneratedPages((state) => state.appliedIds)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const assistant = getAssistant()
  const selected =
    pages.find((page) => page.id === (selectedId ?? snapshot.lastPage?.id)) ?? snapshot.lastPage

  return (
    <PageContainer size="lg">
      <PageHeader
        title={t('assistant.workspaceTitle')}
        description={t('assistant.workspaceDesc')}
        badge={
          <Badge tone={snapshot.engine.available ? 'success' : 'warning'} dot size="sm">
            {snapshot.engine.available
              ? (snapshot.engine.model ?? t('assistant.engineLlm'))
              : t('assistant.engineLocal')}
          </Badge>
        }
        actions={
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<ArrowUpRight className="size-3.5" />}
            onClick={() => assistant.openPage('/assistant/workspace')}
          >
            {t('assistant.openPage')}
          </Button>
        }
      />

      {snapshot.fallbackReason && (
        <Alert
          tone="warning"
          className="mb-3"
          title={t('assistant.fallbackTitle')}
          action={
            <Button
              size="xs"
              variant="secondary"
              onClick={() => toast.info(snapshot.fallbackReason ?? '', { duration: 6000 })}
            >
              {t('assistant.fallbackDetail')}
            </Button>
          }
        >
          {snapshot.fallbackReason}
        </Alert>
      )}

      {/* 免密钥通道有节流：提前说清楚，避免用户以为「怎么这么慢」 */}
      {snapshot.engine.available && getGatewayNote() && (
        <Alert tone="info" compact className="mb-3">
          {getGatewayNote()}
        </Alert>
      )}

      <div className="mb-3">
        <SegmentedControl
          value={tab}
          onChange={(value) => setTab(value as TabKey)}
          options={[
            { value: 'chat', label: t('assistant.tabChat') },
            { value: 'preview', label: t('assistant.tabPreview') },
            { value: 'api', label: t('assistant.tabApi') },
            { value: 'guide', label: t('assistant.tabGuide') },
          ]}
        />
      </div>

      {tab === 'chat' && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[15rem_minmax(0,1fr)_20rem]">
          {/* 会话列自带自己的头部（含新建 / 搜索），这里只提供卡片外壳，
              不再套一层 SectionCard，否则会出现两条标题 */}
          <div className="flex h-[calc(100dvh-20rem)] min-h-[26.25rem] flex-col overflow-hidden rounded-lg border border-line bg-surface">
            <SessionList />
          </div>

          <SectionCard
            title={t('assistant.workspaceChatTitle')}
            description={t('assistant.workspaceChatDesc')}
            icon={<Sparkles className="size-4" />}
            bodyClassName="h-[calc(100dvh-20rem)] min-h-[26.25rem]"
          >
            <AssistantThread variant="page" />
          </SectionCard>

          <div className="space-y-3">
            <SectionCard
              title={t('assistant.pagesTitle')}
              icon={<CircleAlert className="size-4" />}
            >
              <div className="divide-y divide-line-subtle">
                {pages.length === 0 && (
                  <p className="px-4 py-6 text-center text-xs text-fg-3">
                    {t('assistant.pagesEmpty')}
                  </p>
                )}
                {pages.map((page) => {
                  const applied = appliedIds.includes(page.id)
                  return (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(page.id)
                        setTab('preview')
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-surface-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[0.8125rem] font-medium text-fg">
                            {page.title}
                          </span>
                          {applied && (
                            <Badge tone="success" size="sm">
                              {t('assistant.applied')}
                            </Badge>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-2xs text-fg-4">
                          {page.path}
                        </span>
                      </span>
                      <ArrowUpRight className="size-3.5 shrink-0 text-fg-4" />
                    </button>
                  )
                })}
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {tab === 'preview' && (
        <div className="space-y-3">
          {selected ? (
            <PagePreviewCard
              key={selected.id}
              page={selected}
              applied={appliedIds.includes(selected.id)}
              onApply={() => {
                assistant.applyPage(selected)
                toast.success(t('assistant.applyDone'))
              }}
              onOpen={() => assistant.openPage(selected.path)}
              onAdjust={(patch) => {
                const updated = { ...selected, ...patch }
                assistant.patchLastPage(updated)
              }}
            />
          ) : (
            <SectionCard title={t('assistant.pagesTitle')}>
              <p className="px-4 py-10 text-center text-xs text-fg-3">
                {t('assistant.pagesEmpty')}
              </p>
            </SectionCard>
          )}
        </div>
      )}

      {tab === 'api' && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_26.25rem]">
          <ApiRegistrationPanel />
          <SectionCard
            title={t('assistant.bridgeTitle')}
            description={t('assistant.bridgeDesc')}
            icon={<Plug className="size-4" />}
          >
            <div className="space-y-3 p-4 text-[0.8125rem] leading-6 text-fg-2">
              <p>{t('assistant.bridgeIntro')}</p>
              <pre className="overflow-x-auto rounded-md bg-surface-2 p-3 font-mono text-2xs leading-5 text-fg-2">
                {BRIDGE_SNIPPET}
              </pre>
              <ul className="space-y-1.5 text-xs text-fg-3">
                {t('assistant.bridgeNotes')
                  .split('\n')
                  .filter(Boolean)
                  .map((line) => (
                    <li key={line} className="flex gap-1.5">
                      <Info className="mt-1 size-3 shrink-0 text-primary" />
                      <span>{line.replace(/^-\s*/, '')}</span>
                    </li>
                  ))}
              </ul>
              <p className="rounded-md bg-surface-2 px-2.5 py-2 font-mono text-2xs text-fg-3">
                {sdkListAssistantApi().length} operations ·{' '}
                {getAssistant().describeApiBridge().hasExecutor
                  ? 'executor ready'
                  : 'executor missing'}
              </p>
            </div>
          </SectionCard>
        </div>
      )}

      {tab === 'guide' && (
        <div className={cn('grid grid-cols-1 gap-3 lg:grid-cols-2')}>
          <SectionCard title={t('assistant.guideArchTitle')} icon={<Sparkles className="size-4" />}>
            <div className="space-y-3 p-4 text-[0.8125rem] leading-6 text-fg-2">
              {t('assistant.guideArchBody')
                .split('\n')
                .filter(Boolean)
                .map((line) => (
                  <p key={line}>{line}</p>
                ))}
            </div>
          </SectionCard>
          <SectionCard title={t('assistant.guideZeroTitle')} icon={<Sparkles className="size-4" />}>
            <div className="space-y-3 p-4 text-[0.8125rem] leading-6 text-fg-2">
              {t('assistant.guideZeroBody')
                .split('\n')
                .filter(Boolean)
                .map((line) => (
                  <p key={line}>{line}</p>
                ))}
            </div>
          </SectionCard>
        </div>
      )}
    </PageContainer>
  )
}

const BRIDGE_SNIPPET = `// src/ai/api-operations.ts
import { registerAssistantApi } from '@nexus/ai-sdk'

registerAssistantApi([
  {
    id: 'user_list',
    title: '用户列表',
    description: '分页查询用户，支持关键字搜索',
    method: 'GET',
    path: '/users',
    params: { page: '页码', pageSize: '每页条数', keyword: '姓名/邮箱' },
  },
])`
