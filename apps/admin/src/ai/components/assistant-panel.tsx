import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Eraser, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, Plus, X } from 'lucide-react'
import { Badge, ConfirmDialog, Tooltip, cn, useMediaQuery } from '@nexus/ui'
import {
  ASSISTANT_WIDTH_DEFAULT,
  ASSISTANT_WIDTH_MAX,
  ASSISTANT_WIDTH_MIN,
  useAssistantPanelStore,
} from '@/ai/panel-store'
import { getAssistant, useAssistantSnapshot } from '@/ai'
import { useAppNavigate } from '@/components/app-link'
import { useI18n } from '@/i18n'
import { AssistantThread } from './assistant-thread'
import { SessionList } from './session-list'
import { AssistantAvatar } from './message-parts'

/**
 * AI 运营助手 · 右侧抽屉
 *
 * 与旧版的差别（也是这次返工的核心）：
 * 1. **全高度贴边**：从顶到底占满视口，不再是浮在右上角的一张小卡片；
 *    对话区可用高度直接翻倍，长回答与预览卡不再被压成一条缝
 * 2. **宽度可拖拽且记忆**：默认 552px，拖过的宽度写进 localStorage
 * 3. **多会话**：左侧可展开的会话列，新建 / 切换 / 重命名 / 置顶 / 删除
 * 4. **去 AI 味**：没有渐变、没有发光机器人，用品牌字标 + 中性色 + 细描边，
 *    和后台其它面板同一套语言
 *
 * 交互取舍：
 * - 桌面端**不做遮罩**：助手是「边看页面边问」的工具，挡住页面就失去意义；
 *   点页面不关闭抽屉，只有 ESC / 关闭按钮才收起
 * - 移动端退化为覆盖式抽屉（带一层淡遮罩，点遮罩关闭）
 * - ESC 关闭；Ctrl/⌘ + J 全局开关（关着也能唤起）
 */
export function AssistantPanel() {
  const open = useAssistantPanelStore((state) => state.open)
  const setOpen = useAssistantPanelStore((state) => state.setOpen)
  const width = useAssistantPanelStore((state) => state.width)
  const setWidth = useAssistantPanelStore((state) => state.setWidth)
  const sessionsOpen = useAssistantPanelStore((state) => state.sessionsOpen)
  const toggleSessions = useAssistantPanelStore((state) => state.toggleSessions)
  const { t } = useI18n()
  const snapshot = useAssistantSnapshot()
  const navigate = useAppNavigate()
  const assistant = getAssistant()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [mounted, setMounted] = useState(open)
  const [wide, setWide] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // 打开时立即挂载：渲染期同步一次，比在 effect 里 setState 少一轮级联渲染
  if (open && !mounted) setMounted(true)

  // 关闭时延迟卸载：留住 220ms 的滑出动画
  useEffect(() => {
    if (open) return
    const timer = setTimeout(() => setMounted(false), 220)
    return () => clearTimeout(timer)
  }, [open])

  // 快捷键常驻：抽屉关着也要能唤起
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault()
        useAssistantPanelStore.getState().toggle()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // ESC 关闭 + 打开后把焦点放回输入框
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // 让上层弹窗（确认框、命令面板）先处理
      if (document.querySelector('[data-assistant-modal="true"]')) return
      event.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown, true)
    const timer = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('textarea')?.focus()
    })
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      cancelAnimationFrame(timer)
    }
  }, [open, setOpen])

  if (!mounted) return null

  const showSessions = sessionsOpen && !isMobile
  const totalWidth = wide || isMobile ? '100vw' : showSessions ? width + 248 : width

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[900]">
      {/* 移动端遮罩：覆盖式抽屉需要一层可点的退出口 */}
      {isMobile && (
        <div
          className={cn(
            'pointer-events-auto absolute inset-0 bg-black/30 transition-opacity duration-200',
            open ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal={isMobile || undefined}
        aria-label={t('assistant.panelTitle')}
        style={{ width: totalWidth }}
        className={cn(
          'pointer-events-auto absolute inset-y-0 right-0 flex max-w-[100vw] flex-col',
          'border-l border-line bg-surface',
          'shadow-[-12px_0_40px_-24px_rgb(0_0_0_/_0.28)]',
          'transition-transform duration-250 ease-[var(--ease-out-expo)]',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* 拖拽手柄：贴着抽屉左缘，拖动即改变对话区宽度 */}
        {!isMobile && !wide && (
          <ResizeHandle
            width={width}
            onChange={setWidth}
            label={t('assistant.panelResize')}
            active={showSessions}
          />
        )}

        <div className="flex min-h-0 flex-1">
          {/* 会话列：非覆盖式，展开时抽屉整体变宽，页面不被盖住 */}
          {showSessions && (
            <div className="flex w-[248px] shrink-0 flex-col border-r border-line">
              <SessionList onClose={toggleSessions} />
            </div>
          )}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/* 头部 */}
            <header className="flex h-[var(--n-header-h)] shrink-0 items-center gap-2 border-b border-line px-3">
              <AssistantAvatar className="mt-0 size-7" />
              <div className="flex min-w-0 items-center gap-1.5">
                <h2 className="truncate text-[13px] font-semibold text-fg">
                  {t('assistant.panelTitle')}
                </h2>
                <Badge tone={snapshot.engine.available ? 'success' : 'warning'} dot size="sm">
                  {snapshot.engine.available
                    ? (snapshot.engine.model ?? t('assistant.engineLlm'))
                    : t('assistant.engineLocal')}
                </Badge>
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-0.5">
                <Tooltip content={t('assistant.sessions')}>
                  <HeaderButton
                    label={t('assistant.sessions')}
                    active={sessionsOpen}
                    onClick={toggleSessions}
                  >
                    {sessionsOpen ? (
                      <PanelLeftClose className="size-3.5" />
                    ) : (
                      <PanelLeftOpen className="size-3.5" />
                    )}
                  </HeaderButton>
                </Tooltip>
                <Tooltip content={t('assistant.newSession')}>
                  <HeaderButton
                    label={t('assistant.newSession')}
                    onClick={() => assistant.createSession()}
                  >
                    <Plus className="size-3.5" />
                  </HeaderButton>
                </Tooltip>
                <Tooltip content={t('assistant.clear')}>
                  <HeaderButton label={t('assistant.clear')} onClick={() => setConfirmClear(true)}>
                    <Eraser className="size-3.5" />
                  </HeaderButton>
                </Tooltip>
                {!isMobile && (
                  <Tooltip content={wide ? t('assistant.restore') : t('assistant.maximize')}>
                    <HeaderButton
                      label={wide ? t('assistant.restore') : t('assistant.maximize')}
                      onClick={() => setWide((prev) => !prev)}
                    >
                      {wide ? (
                        <Minimize2 className="size-3.5" />
                      ) : (
                        <Maximize2 className="size-3.5" />
                      )}
                    </HeaderButton>
                  </Tooltip>
                )}
                <Tooltip content={t('assistant.panelClose')}>
                  <HeaderButton label={t('assistant.panelClose')} onClick={() => setOpen(false)}>
                    <X className="size-3.5" />
                  </HeaderButton>
                </Tooltip>
              </div>
            </header>

            <AssistantThread variant="panel" />

            {/* 底部：留一个通往整页工作台的出口，不打扰 */}
            <footer className="flex shrink-0 items-center gap-1.5 border-t border-line px-3 py-1.5">
              <span className="truncate text-2xs text-fg-4">{t('assistant.panelFooter')}</span>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  navigate('/assistant/workspace')
                }}
                className="ml-auto shrink-0 text-2xs text-primary transition-colors hover:underline"
              >
                {t('assistant.openWorkspace')}
              </button>
            </footer>
          </div>
        </div>
      </div>

      {confirmClear && (
        <div data-assistant-modal="true">
          <ConfirmDialog
            open
            onOpenChange={(next) => setConfirmClear(next)}
            title={t('assistant.clearConfirmTitle')}
            description={t('assistant.clearConfirmDesc')}
            confirmText={t('assistant.clear')}
            onConfirm={() => {
              assistant.reset()
              setConfirmClear(false)
            }}
          />
        </div>
      )}
    </div>,
    document.body,
  )
}

function HeaderButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'grid size-7 place-items-center rounded-md transition-colors',
        'focus-visible:ring-2 focus-visible:ring-primary-ring focus-visible:outline-none',
        active ? 'bg-surface-2 text-fg' : 'text-fg-3 hover:bg-surface-2 hover:text-fg',
      )}
    >
      {children}
    </button>
  )
}

/**
 * 宽度调节
 *
 * 用 pointer 事件并在按下时锁存起始宽度：拖拽过程只写 store（边界在 store 里夹取），
 * 不额外维护本地状态，避免「松手回弹」。
 */
function ResizeHandle({
  width,
  onChange,
  label,
  active,
}: {
  width: number
  onChange: (width: number) => void
  label: string
  active: boolean
}) {
  const [dragging, setDragging] = useState(false)

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = width
    setDragging(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (moveEvent: PointerEvent) => {
      onChange(startWidth + (startX - moveEvent.clientX))
    }
    const onUp = () => {
      setDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={ASSISTANT_WIDTH_MIN}
      aria-valuemax={ASSISTANT_WIDTH_MAX}
      onPointerDown={onPointerDown}
      onDoubleClick={() => onChange(ASSISTANT_WIDTH_DEFAULT)}
      className="group/resize absolute inset-y-0 -left-1 z-10 hidden w-2 cursor-col-resize md:block"
    >
      <span
        className={cn(
          'absolute inset-y-0 left-1 w-px transition-colors',
          dragging ? 'bg-primary' : active ? 'bg-line' : 'bg-transparent',
          !dragging && 'group-hover/resize:bg-primary/60',
        )}
      />
    </div>
  )
}
