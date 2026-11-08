import { useEffect } from 'react'
import { MessageSquareText } from 'lucide-react'
import { Tooltip, cn } from '@nexus/ui'
import { useAssistantPanelStore } from '@/ai/panel-store'
import { useAssistantBusy } from '@/ai/status-store'
import { loadAssistant } from '@/ai/lazy'
import { useI18n } from '@/i18n'

/**
 * 顶栏 AI 助手入口
 *
 * 这个文件**不 import `@nexus/ai`**（那会把 ai-sdk 拉进外壳 chunk）。
 * 它只做三件事：
 * 1. 订阅 `status-store` 的一个布尔值来显示脉冲点
 * 2. 用 `panel-store` 开关抽屉
 * 3. 常驻注册 Ctrl/⌘ + J —— 抽屉没挂载时也能唤起（快捷键原本写在面板里，
 *    面板改成懒加载后就失效了，必须挪到这里）
 *
 * 悬停即预取抽屉 chunk：用户从「移过去」到「点下去」通常有 150ms 以上，
 * 足够把 20 kB 的 chunk 取回来，点开时不再有等待。
 */
export function AssistantLauncher() {
  const open = useAssistantPanelStore((state) => state.open)
  const toggle = useAssistantPanelStore((state) => state.toggle)
  const busy = useAssistantBusy()
  const { t } = useI18n()

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

  return (
    <Tooltip content={t('assistant.launcherTip')}>
      <button
        type="button"
        onClick={() => {
          // 首次点击时确保装配已完成（未加载则会先 await 本次 import）
          void loadAssistant()
          toggle()
        }}
        onPointerEnter={() => void import('@/ai/components/assistant-panel')}
        aria-label={t('assistant.launcherTip')}
        aria-expanded={open}
        className={cn(
          'group relative grid size-8 shrink-0 place-items-center rounded-lg transition-colors',
          'text-fg-3 hover:bg-surface-2 hover:text-fg',
          'focus-visible:ring-2 focus-visible:ring-primary-ring focus-visible:outline-none',
          open && 'bg-surface-2 text-fg',
        )}
      >
        <MessageSquareText className="size-4" strokeWidth={1.9} />
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-1 right-1 size-1.5 rounded-full ring-2 ring-surface',
            busy ? 'animate-pulse bg-warning' : 'bg-success',
          )}
        />
      </button>
    </Tooltip>
  )
}
