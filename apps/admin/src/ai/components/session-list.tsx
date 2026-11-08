import { useEffect, useRef, useState } from 'react'
import {
  Check,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import type { AssistantSessionSummary } from '@nexus/ai-sdk'
import { ConfirmDialog, Input, Tooltip, cn } from '@nexus/ui'
import { getAssistant, useAssistantSnapshot } from '@/ai'
import { useI18n } from '@/i18n'

/**
 * 会话列表
 *
 * 抽屉内左侧一栏（桌面端常驻可展开、移动端覆盖整层）。
 * 交互取舍：
 * - 切换会话**不打断正在生成的这一轮**：内核会 abort 当前请求，
 *   这是有意的 —— 两个会话共享一条传输链路，串流会让两边都收到半截文本
 * - 删除需要二次确认，但删除的是「对话」，不碰已生成的页面
 * - 重命名就地编辑，回车保存、Esc 取消
 */
export function SessionList({
  onPick,
  onClose,
  className,
}: {
  onPick?: () => void
  onClose?: () => void
  className?: string
}) {
  const { t } = useI18n()
  const snapshot = useAssistantSnapshot()
  const assistant = getAssistant()
  const [keyword, setKeyword] = useState('')
  const [pendingDelete, setPendingDelete] = useState<AssistantSessionSummary | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renamingId) renameRef.current?.select()
  }, [renamingId])

  const sessions = snapshot.sessions.filter((session) =>
    keyword.trim()
      ? `${session.title} ${session.preview}`.toLowerCase().includes(keyword.trim().toLowerCase())
      : true,
  )

  const commitRename = () => {
    if (!renamingId) return
    assistant.renameSession(renamingId, renameValue)
    setRenamingId(null)
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-bg-subtle/60', className)}>
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <span className="text-2xs font-medium tracking-wide text-fg-3 uppercase">
          {t('assistant.sessions')}
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="ml-auto grid size-6 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg md:hidden"
          >
            <X className="size-3.5" />
          </button>
        )}
        <Tooltip content={t('assistant.newSession')}>
          <button
            type="button"
            aria-label={t('assistant.newSession')}
            onClick={() => {
              assistant.createSession()
              setKeyword('')
            }}
            className={cn(
              'grid size-6 place-items-center rounded-md text-fg-3 transition-colors',
              'hover:bg-surface-2 hover:text-fg',
              onClose ? '' : 'ml-auto',
            )}
          >
            <Plus className="size-3.5" />
          </button>
        </Tooltip>
      </div>

      <div className="px-2.5 pb-2">
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t('assistant.sessionSearch')}
          aria-label={t('assistant.sessionSearch')}
          size="sm"
          leftIcon={<Search className="size-3 text-fg-4" />}
          className="text-xs"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {sessions.length === 0 ? (
          <div className="px-2 py-6 text-center">
            <MessageSquareText className="mx-auto mb-2 size-4 text-fg-4" />
            <p className="text-xs text-fg-3">{t('assistant.sessionEmpty')}</p>
            <p className="mt-1 text-2xs leading-4 text-fg-4">{t('assistant.sessionEmptyDesc')}</p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {sessions.map((session) => {
              const active = session.id === snapshot.activeSessionId
              const renaming = session.id === renamingId
              return (
                <li key={session.id} className="group/session relative">
                  {renaming ? (
                    <div className="flex items-center gap-1 rounded-md border border-primary/40 bg-surface px-1.5 py-1">
                      <input
                        ref={renameRef}
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') commitRename()
                          if (event.key === 'Escape') setRenamingId(null)
                        }}
                        onBlur={commitRename}
                        aria-label={t('assistant.sessionRename')}
                        className="min-w-0 flex-1 bg-transparent text-xs text-fg outline-none"
                      />
                      <button
                        type="button"
                        aria-label={t('common.save')}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={commitRename}
                        className="grid size-5 place-items-center rounded text-success hover:bg-surface-2"
                      >
                        <Check className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        assistant.switchSession(session.id)
                        onPick?.()
                      }}
                      aria-current={active ? 'true' : undefined}
                      className={cn(
                        'flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 pr-7 text-left transition-colors',
                        active
                          ? 'bg-surface text-fg shadow-xs ring-1 ring-line'
                          : 'text-fg-2 hover:bg-surface/70',
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        {session.pinned && (
                          <Pin className="size-2.5 shrink-0 text-primary" aria-hidden="true" />
                        )}
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate text-xs',
                            active ? 'font-medium text-fg' : 'text-fg-2',
                          )}
                        >
                          {session.title || t('assistant.sessionUntitled')}
                        </span>
                      </span>
                      <span className="truncate text-2xs text-fg-4">
                        {session.preview ||
                          t('assistant.sessionCount', { n: session.messageCount })}
                      </span>
                    </button>
                  )}

                  {/* 行内操作：默认隐藏，hover / 聚焦当前行才出现，避免列表变成按钮墙 */}
                  {!renaming && (
                    <SessionActions
                      session={session}
                      open={active}
                      onRename={() => {
                        setRenamingId(session.id)
                        setRenameValue(session.title)
                      }}
                      onTogglePin={() => assistant.pinSession(session.id, !session.pinned)}
                      onDelete={() => setPendingDelete(session)}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t('assistant.sessionDeleteTitle')}
        description={t('assistant.sessionDeleteDesc', {
          title: pendingDelete?.title || t('assistant.sessionUntitled'),
        })}
        danger
        confirmText={t('common.delete')}
        onConfirm={() => {
          if (pendingDelete) assistant.deleteSession(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </div>
  )
}

function SessionActions({
  session,
  open,
  onRename,
  onTogglePin,
  onDelete,
}: {
  session: AssistantSessionSummary
  open: boolean
  onRename: () => void
  onTogglePin: () => void
  onDelete: () => void
}) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={cn(
        'absolute top-1 right-1 flex items-center',
        // 当前行与 hover 时不抢版面：按钮底色与条目底色同深，看起来像行内控件
        expanded || open ? 'opacity-100' : 'opacity-0 group-hover/session:opacity-100',
        'transition-opacity',
      )}
    >
      {expanded ? (
        <div className="flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5 shadow-sm">
          <IconAction
            label={session.pinned ? t('assistant.sessionUnpin') : t('assistant.sessionPin')}
            onClick={() => {
              onTogglePin()
              setExpanded(false)
            }}
          >
            {session.pinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
          </IconAction>
          <IconAction
            label={t('assistant.sessionRename')}
            onClick={() => {
              onRename()
              setExpanded(false)
            }}
          >
            <Pencil className="size-3" />
          </IconAction>
          <IconAction
            label={t('assistant.sessionDelete')}
            danger
            onClick={() => {
              onDelete()
              setExpanded(false)
            }}
          >
            <Trash2 className="size-3" />
          </IconAction>
        </div>
      ) : (
        <button
          type="button"
          aria-label={t('assistant.moreActions')}
          aria-expanded={false}
          onClick={(event) => {
            event.stopPropagation()
            setExpanded(true)
          }}
          className="grid size-5 place-items-center rounded text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg"
        >
          <MoreHorizontal className="size-3" />
        </button>
      )}
    </div>
  )
}

function IconAction({
  label,
  danger,
  onClick,
  children,
}: {
  label: string
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation()
          onClick()
        }}
        className={cn(
          'grid size-5 place-items-center rounded transition-colors',
          danger
            ? 'text-danger hover:bg-danger-weak'
            : 'text-fg-3 hover:bg-surface-2 hover:text-fg',
        )}
      >
        {children}
      </button>
    </Tooltip>
  )
}
