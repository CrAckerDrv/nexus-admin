import { useState } from 'react'
import { Check, Copy, Plus, Terminal } from 'lucide-react'
import { Badge, Button, CodeBlock, SegmentedControl, cn, toast } from '@nexus/ui'
import { useI18n } from '@/i18n'
import { useRegisteredOperations } from '@/ai/api-registry'

/**
 * 「把后端接口交给助手」面板
 *
 * 这是需求里最容易被做成一句文档的工作 —— 这里改成可操作的两半：
 * 1. 左边：项目里已声明的操作清单，逐条显示是否已交给助手
 * 2. 右边：生成对应代码（README 里那段），复制即用
 *
 * 判断依据是 `listAssistantApi()`（运行时注册表），不是写死的文案，
 * 所以客户新增一条操作后会立刻在这里看到「已交给助手」。
 */
export function ApiRegistrationPanel() {
  const { t, isEn } = useI18n()
  const [mode, setMode] = useState<'demo' | 'custom'>('demo')
  const [copied, setCopied] = useState(false)
  const operations = useRegisteredOperations()

  const snippet = isEn ? SNIPPET_EN : SNIPPET_ZH
  const registeredIds = new Set(operations.map((op) => op.id))
  const demo = DEMO_ROWS

  const copy = async () => {
    await navigator.clipboard?.writeText(snippet)
    setCopied(true)
    toast.success(t('common.copied'))
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <section className="rounded-lg border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="min-w-0">
          <h3 className="text-[0.8125rem] font-semibold text-fg">{t('assistant.apiPanelTitle')}</h3>
          <p className="mt-0.5 text-2xs text-fg-3">{t('assistant.apiPanelDesc')}</p>
        </div>
        <SegmentedControl
          size="sm"
          value={mode}
          onChange={(value) => setMode(value as 'demo' | 'custom')}
          options={[
            { value: 'demo', label: t('assistant.apiModeDemo') },
            { value: 'custom', label: t('assistant.apiModeCustom') },
          ]}
        />
      </header>

      {mode === 'demo' ? (
        <div className="divide-y divide-line-subtle">
          {demo.map((row) => {
            const handed = registeredIds.has(row.id)
            return (
              <div key={row.id} className="flex items-start gap-2 px-4 py-2.5">
                <span
                  className={cn(
                    'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md text-[0.625rem] font-semibold',
                    handed ? 'bg-success-weak text-success' : 'bg-surface-3 text-fg-4',
                  )}
                >
                  {handed ? <Check className="size-3" /> : <Plus className="size-3" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[0.8125rem] font-medium text-fg">{row.title}</span>
                    <Badge tone="neutral" size="sm" className="font-mono">
                      {row.method} {row.path}
                    </Badge>
                    <Badge tone={handed ? 'success' : 'neutral'} size="sm">
                      {handed ? t('assistant.apiHanded') : t('assistant.apiPending')}
                    </Badge>
                  </p>
                  <p className="mt-0.5 text-2xs leading-5 text-fg-3">{row.description}</p>
                </div>
                <code className="mt-0.5 shrink-0 font-mono text-2xs text-fg-4">api_{row.id}</code>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2 p-4">
          <p className="flex items-center gap-1.5 text-2xs text-fg-3">
            <Terminal className="size-3" />
            src/ai/api-operations.ts
          </p>
          <CodeBlock code={snippet} language="ts" maxHeight={320} />
          <Button
            size="sm"
            variant="secondary"
            leftIcon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            onClick={() => void copy()}
          >
            {copied ? t('common.copied') : t('common.copy')}
          </Button>
        </div>
      )}
    </section>
  )
}

/** 演示数据里「项目允许助手访问」的接口示意（与 api-operations.ts 对齐） */
const DEMO_ROWS = [
  {
    id: 'user_list',
    title: '用户列表',
    method: 'GET',
    path: '/users',
    description: '分页查询用户，支持关键字、状态与角色过滤 —— 助手可据此回答「最近新增了多少用户」',
  },
  {
    id: 'user_stats',
    title: '用户统计',
    method: 'GET',
    path: '/users/stats',
    description: '总量 / 活跃 / 待邀请 / 停用计数 —— 助手可据此生成 KPI 区块',
  },
  {
    id: 'order_list',
    title: '订单列表',
    method: 'GET',
    path: '/orders',
    description: '订单分页数据，支持状态与关键字',
  },
  {
    id: 'order_stats',
    title: '订单统计',
    method: 'GET',
    path: '/orders/stats',
    description: '各状态数量与总金额',
  },
  {
    id: 'audit_logs',
    title: '审计日志',
    method: 'GET',
    path: '/audit-logs',
    description: '操作审计分页数据',
  },
]

const SNIPPET_ZH = `// src/ai/api-operations.ts —— 客户唯一需要改的文件
import { registerAssistantApi } from '@nexus/ai-sdk'

registerAssistantApi([
  {
    id: 'user_list',                 // 工具名会变成 api_user_list
    title: '用户列表',
    description: '分页查询用户，支持关键字搜索',
    method: 'GET',
    path: '/users',
    params: { page: '页码', pageSize: '每页条数', keyword: '姓名/邮箱' },
  },
  {
    id: 'order_create',
    title: '创建订单',
    description: '新建一笔订单（写操作）',
    method: 'POST',
    path: '/orders',
    body: { customer: '客户名', amount: 0 },
    mutating: true,                  // 界面标红，模型需二次确认
  },
])`

const SNIPPET_EN = `// src/ai/api-operations.ts — the only file customers need to edit
import { registerAssistantApi } from '@nexus/ai-sdk'

registerAssistantApi([
  {
    id: 'user_list',                 // exposed as tool api_user_list
    title: 'Users',
    description: 'Paged user search',
    method: 'GET',
    path: '/users',
    params: { page: 'page number', keyword: 'name or email' },
  },
])`
