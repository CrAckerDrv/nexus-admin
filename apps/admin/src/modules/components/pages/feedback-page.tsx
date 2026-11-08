import { useState } from 'react'
import { CircleAlert, CircleCheck, MessageSquare, PanelLeft, Send, Trash } from 'lucide-react'
import {
  Alert,
  Button,
  CodeBlock,
  ConfirmDialog,
  Dialog,
  Drawer,
  Dropdown,
  Input,
  PageContainer,
  PageHeader,
  SectionCard,
  Select,
  Textarea,
  Timeline,
  toast,
} from '@nexus/ui'
import type { TimelineItem } from '@nexus/ui'

export default function FeedbackPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [criticalOpen, setCriticalOpen] = useState(false)
  const [message, setMessage] = useState('')

  return (
    <PageContainer size="lg">
      <PageHeader
        title="反馈与弹层"
        description="Dialog / Drawer / ConfirmDialog / Dropdown / Toast 的完整用法与无障碍细节"
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SectionCard title="Dialog 对话框" description="焦点陷阱 + ESC 关闭 + 滚动锁定">
          <div className="flex flex-wrap gap-2 p-3">
            <Button variant="primary" onClick={() => setDialogOpen(true)}>
              打开对话框
            </Button>
            <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
              二次确认
            </Button>
            <Button variant="danger" onClick={() => setCriticalOpen(true)}>
              危险操作确认
            </Button>
          </div>
          <div className="border-t border-line px-3 py-2.5">
            <p className="text-2xs leading-4 text-fg-3">
              键盘：<kbd className="rounded border border-line bg-surface-2 px-1">Tab</kbd>{' '}
              在弹层内循环，
              <kbd className="rounded border border-line bg-surface-2 px-1">Esc</kbd>{' '}
              关闭并归还焦点。
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Drawer 抽屉" description="适合表单与详情侧滑">
          <div className="flex flex-wrap gap-2 p-3">
            <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
              从右侧滑出
            </Button>
          </div>
          <div className="border-t border-line px-3 py-2.5">
            <p className="text-2xs leading-4 text-fg-3">
              抽屉宽度可配置，支持页脚固定操作区与内部滚动。
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Dropdown 下拉菜单" description="自动翻转定位 + 键盘导航">
          <div className="flex flex-wrap items-center gap-2 p-3">
            <Dropdown
              trigger={<Button variant="secondary">默认菜单</Button>}
              items={[
                { key: 'edit', label: '编辑', hint: '⌘E', onSelect: () => toast.info('编辑') },
                {
                  key: 'copy',
                  label: '复制链接',
                  hint: '⌘C',
                  onSelect: () => toast.success('已复制'),
                },
                'divider',
                { key: 'archive', label: '归档', onSelect: () => toast.info('已归档') },
                {
                  key: 'delete',
                  label: '删除',
                  danger: true,
                  onSelect: () => toast.warning('危险操作'),
                },
              ]}
            />
            <Dropdown
              align="end"
              side="top"
              trigger={<Button variant="ghost">向上弹出</Button>}
              items={[
                { key: '1', label: '选项一', onSelect: () => undefined },
                { key: '2', label: '选项二', disabled: true },
                { key: '3', label: '选项三', onSelect: () => undefined },
              ]}
            />
            <Button variant="ghost" leftIcon={<PanelLeft className="size-3.5" />}>
              普通按钮对比
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Toast 提示" description="4 种语义 + 加载态 + 操作按钮">
          <div className="flex flex-wrap gap-2 p-3">
            <Button size="sm" variant="secondary" onClick={() => toast.show('默认提示')}>
              默认
            </Button>
            <Button size="sm" variant="secondary" onClick={() => toast.success('操作成功')}>
              成功
            </Button>
            <Button size="sm" variant="secondary" onClick={() => toast.error('操作失败')}>
              失败
            </Button>
            <Button size="sm" variant="secondary" onClick={() => toast.warning('请注意风险')}>
              警告
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const id = toast.loading('正在上传…', { duration: 0 })
                setTimeout(() => {
                  toast.dismiss(id)
                  toast.success('上传完成')
                }, 1600)
              }}
            >
              加载→完成
            </Button>
          </div>
        </SectionCard>
      </div>

      <SectionCard className="mt-3" title="消息通知面板" description="仿 IM 的消息流，可用于站内信">
        <div className="max-h-[20rem] space-y-2 overflow-y-auto p-3">
          {[
            {
              name: '林知夏',
              text: '权限变更已经生效，麻烦确认下 12 名成员的访问是否正常。',
              time: '10:24',
              me: false,
            },
            { name: '我', text: '收到，我先看下运营组。', time: '10:26', me: true },
            {
              name: '周予安',
              text: '运营组这边正常，已经能看到新的看板了。',
              time: '10:31',
              me: false,
            },
            { name: '我', text: '好的，那我这边关闭工单。', time: '10:33', me: true },
          ].map((item, index) => (
            <div key={index} className={item.me ? 'flex justify-end' : 'flex'}>
              <div className="max-w-[78%]">
                <div
                  className={
                    item.me
                      ? 'rounded-lg rounded-tr-sm bg-primary px-3 py-2 text-xs leading-5 text-primary-fg'
                      : 'rounded-lg rounded-tl-sm border border-line bg-surface-2 px-3 py-2 text-xs leading-5 text-fg-2'
                  }
                >
                  {item.text}
                </div>
                <p
                  className={
                    item.me ? 'mt-1 text-right text-2xs text-fg-4' : 'mt-1 text-2xs text-fg-4'
                  }
                >
                  {item.name} · {item.time}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-end gap-2 border-t border-line p-3">
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="输入消息，Enter 发送"
            className="flex-1"
            autoResize
          />
          <Button
            variant="primary"
            leftIcon={<Send className="size-3.5" />}
            onClick={() => {
              if (!message.trim()) {
                toast.warning('消息不能为空')
                return
              }
              toast.success('消息已发送（演示）')
              setMessage('')
            }}
          >
            发送
          </Button>
        </div>
      </SectionCard>

      {/* 弹层示例 */}
      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="新建看板"
        description="看板用于聚合业务关键指标，创建后可邀请成员协作。"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setDialogOpen(false)
                toast.success('看板已创建')
              }}
            >
              创建
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-fg-2">看板名称</span>
            <Input placeholder="例如：用户增长周报" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-fg-2">数据源</span>
            <Select
              options={[
                { label: '交易数据库（PostgreSQL）', value: 'pg' },
                { label: '埋点数据仓库（ClickHouse）', value: 'ck' },
                { label: 'CRM 系统', value: 'crm' },
              ]}
              defaultValue="pg"
            />
          </label>
          <Alert tone="info" compact>
            创建后可在「数据分析」中查看默认模板。
          </Alert>
        </div>
      </Dialog>

      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="成员详情"
        description="从右侧滑出的详情面板"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDrawerOpen(false)}>
              关闭
            </Button>
            <Button variant="primary" onClick={() => toast.success('已保存')}>
              保存
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Timeline
            items={
              [
                {
                  key: '1',
                  title: '加入项目',
                  description: '由陈彦之邀请加入',
                  time: '2026-09-12',
                  tone: 'success',
                },
                {
                  key: '2',
                  title: '角色变更',
                  description: '从只读访客升级为运营专员',
                  time: '2026-10-08',
                  tone: 'primary',
                },
                {
                  key: '3',
                  title: '权限复核',
                  description: '季度权限复核通过',
                  time: '2026-11-01',
                  tone: 'success',
                },
              ] as TimelineItem[]
            }
          />
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="确认发布"
        description="发布后所有成员都会收到通知，且不能再修改内容结构。"
        confirmText="发布"
        onConfirm={() => {
          setConfirmOpen(false)
          toast.success('内容已发布')
        }}
      />

      <ConfirmDialog
        open={criticalOpen}
        onOpenChange={setCriticalOpen}
        danger
        title="删除整个项目"
        description="该操作将删除项目下全部数据，且无法恢复。请输入确认后再继续。"
        confirmText="永久删除"
        onConfirm={() => {
          setCriticalOpen(false)
          toast.error('项目已删除（演示）')
        }}
      >
        <div className="space-y-2">
          <Input placeholder="输入项目名称以确认" status="error" />
          <p className="flex items-center gap-1 text-2xs text-danger">
            <CircleAlert className="size-3" />
            此操作不可撤销，请谨慎执行。
          </p>
        </div>
      </ConfirmDialog>

      <SectionCard className="mt-3" title="实现要点" description="无障碍与交互细节">
        <div className="space-y-2 p-3 text-xs leading-5 text-fg-3">
          <p className="flex items-start gap-2">
            <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
            弹层通过 Portal 挂载到 body，避免被父级{' '}
            <code className="rounded bg-surface-2 px-1 font-mono text-2xs">
              overflow: hidden
            </code>{' '}
            裁剪。
          </p>
          <p className="flex items-start gap-2">
            <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
            打开时记录{' '}
            <code className="rounded bg-surface-2 px-1 font-mono text-2xs">
              document.activeElement
            </code>
            ，关闭后自动归还焦点。
          </p>
          <p className="flex items-start gap-2">
            <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
            下拉菜单在视口边缘自动翻转，并通过{' '}
            <code className="rounded bg-surface-2 px-1 font-mono text-2xs">scroll</code>{' '}
            监听保持跟随。
          </p>
          <p className="flex items-start gap-2">
            <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-primary" />
            Toast 使用{' '}
            <code className="rounded bg-surface-2 px-1 font-mono text-2xs">
              aria-live=&quot;polite&quot;
            </code>
            ，不会打断屏幕阅读器朗读。
          </p>
          <div className="rounded-md border border-dashed border-line p-2">
            <CodeBlock
              language="tsx"
              filename="命令式调用"
              maxHeight={200}
              code={`import { toast } from '@nexus/ui'

// 成功
toast.success('保存成功')

// 带描述与操作
toast.error('导出失败', {
  description: '任务超时，请重试',
  action: { label: '重试', onClick: retry },
})`}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Trash className="size-3.5" />}
            onClick={() => toast.clear()}
          >
            清空所有 Toast
          </Button>
        </div>
      </SectionCard>
    </PageContainer>
  )
}
