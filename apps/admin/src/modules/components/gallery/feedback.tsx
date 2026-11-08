import { useState } from 'react'
import {
  ArrowRight,
  Bell,
  CircleAlert,
  CircleCheck,
  Ellipsis,
  Mail,
  Pencil,
  Settings,
  Trash,
  Upload,
} from 'lucide-react'
import {
  Alert,
  Banner,
  Button,
  ConfirmDialog,
  Dialog,
  Drawer,
  Dropdown,
  EmptyState,
  FormField,
  Input,
  LoadingOverlay,
  Skeleton,
  SkeletonTable,
  SkeletonText,
  Spinner,
  Switch,
  Tooltip,
  toast,
} from '@nexus/ui'
import type { GalleryCategory } from './types'

function AlertDemo() {
  return (
    <div className="w-full space-y-2">
      <Alert tone="info" title="信息提示" compact>
        这是一条普通信息提示，适合说明性文字。
      </Alert>
      <Alert tone="success" title="操作成功" compact>
        数据已成功保存并同步到所有节点。
      </Alert>
      <Alert tone="warning" title="需要注意" compact>
        当前操作将影响 128 名成员，请确认后继续。
      </Alert>
      <Alert
        tone="danger"
        title="存在风险"
        action={
          <Button size="xs" variant="secondary">
            立即处理
          </Button>
        }
      >
        检测到 3 笔高风险订单，系统已暂停自动结算。
      </Alert>
    </div>
  )
}

function BannerDemo() {
  const [visible, setVisible] = useState(true)
  return (
    <div className="w-full space-y-2">
      {visible ? (
        <Banner
          tone="warning"
          title="维护窗口"
          description="本周日 02:00 - 04:00 暂停写入操作，请提前安排。"
          action={
            <Button size="xs" variant="secondary" onClick={() => setVisible(false)}>
              我知道了
            </Button>
          }
        />
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setVisible(true)}>
          恢复横幅
        </Button>
      )}
      <Banner
        tone="info"
        icon={<CircleAlert className="size-4" />}
        title="数据来自内置 Mock 层"
        description="接入真实后端后无需改动页面代码，只改数据层。"
      />
    </div>
  )
}

function DialogDemo() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        打开对话框
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="新建用户"
        description="创建后会发送一封邀请邮件"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setOpen(false)
                toast.success('邀请已发送')
              }}
            >
              保存
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="邮箱" required>
            <Input placeholder="name@company.com" leftIcon={<Mail className="size-3.5" />} />
          </FormField>
          <FormField label="角色">
            <Input placeholder="运营专员" />
          </FormField>
          <Switch defaultChecked label="发送邀请邮件" />
        </div>
      </Dialog>
    </>
  )
}

function ConfirmDemo() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        删除实例
      </Button>
      <ConfirmDialog
        danger
        open={open}
        onOpenChange={setOpen}
        title="确认删除该实例？"
        description="实例上的全部数据会被清理，且无法恢复。"
        confirmText="删除"
        onConfirm={() => {
          setOpen(false)
          toast.success('已删除')
        }}
      />
    </>
  )
}

function DrawerDemo() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        打开抽屉
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title="节点属性"
        description="工作流右侧属性面板的常见形态"
        footer={
          <Button variant="primary" onClick={() => setOpen(false)}>
            应用
          </Button>
        }
      >
        <div className="space-y-3">
          <FormField label="节点名称">
            <Input defaultValue="审批节点" />
          </FormField>
          <FormField label="超时策略" hint="超时后自动升级到上级审批人">
            <Input defaultValue="24 小时" />
          </FormField>
          <Switch defaultChecked label="允许转交" />
        </div>
      </Drawer>
    </>
  )
}

function DropdownDemo() {
  return (
    <div className="flex items-center gap-2">
      <Dropdown
        trigger={
          <Button variant="secondary" size="sm" rightIcon={<Ellipsis className="size-3.5" />}>
            更多操作
          </Button>
        }
        items={[
          {
            key: 'edit',
            label: '编辑',
            icon: <Pencil className="size-3.5" />,
            onSelect: () => toast.info('编辑'),
          },
          { key: 'settings', label: '设置', icon: <Settings className="size-3.5" />, hint: '⌘,' },
          'divider',
          {
            key: 'delete',
            label: '删除',
            icon: <Trash className="size-3.5" />,
            danger: true,
            onSelect: () => toast.error('已删除'),
          },
        ]}
      />
      <Dropdown
        align="end"
        width={220}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label="通知">
            <Bell className="size-4" />
          </Button>
        }
        items={[
          {
            key: 'head',
            label: <span className="text-xs font-semibold text-fg">最近通知</span>,
            disabled: true,
          },
          'divider',
          { key: 'n1', label: '订单 #8421 已支付', hint: '2 分钟前' },
          { key: 'n2', label: '用户批量导入完成', hint: '1 小时前' },
        ]}
      />
    </div>
  )
}

function TooltipDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Tooltip content="上方提示">
        <Button size="sm" variant="secondary">
          Top
        </Button>
      </Tooltip>
      <Tooltip content="右侧提示" side="right">
        <Button size="sm" variant="secondary">
          Right
        </Button>
      </Tooltip>
      <Tooltip content="下方提示，文字更长一些也不会溢出" side="bottom">
        <Button size="sm" variant="secondary">
          Bottom
        </Button>
      </Tooltip>
      <Tooltip content="左侧提示" side="left">
        <Button size="sm" variant="secondary">
          Left
        </Button>
      </Tooltip>
    </div>
  )
}

function ToastDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button size="sm" variant="secondary" onClick={() => toast.success('保存成功')}>
        success
      </Button>
      <Button size="sm" variant="secondary" onClick={() => toast.error('保存失败，请重试')}>
        error
      </Button>
      <Button size="sm" variant="secondary" onClick={() => toast.warning('额度即将用尽')}>
        warning
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => toast.loading('正在发送邮件…', { id: 'mail-demo' })}
      >
        loading
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          toast.success('已复制链接', {
            description: '可以粘贴到任意聊天窗口',
            action: { label: '撤销', onClick: () => toast.info('已撤销') },
          })
        }
      >
        带描述与操作
      </Button>
    </div>
  )
}

function SkeletonDemo() {
  const [loading, setLoading] = useState(true)
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2">
        <Button size="xs" variant="secondary" onClick={() => setLoading((prev) => !prev)}>
          {loading ? '停止加载' : '重新加载'}
        </Button>
        <span className="text-2xs text-fg-4">骨架屏：避免内容出现时的高度抖动</span>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <SkeletonText lines={3} />
            <div className="flex items-center gap-2">
              <Spinner tone="primary" />
              <span className="text-xs text-fg-3">加载中…</span>
            </div>
          </div>
          <div className="rounded-md border border-line p-2">
            <SkeletonTable rows={3} columns={3} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 text-xs text-fg-2 sm:grid-cols-2">
          <p>内容已就绪：两个区块使用完全相同的占位结构，切换时不产生跳动。</p>
          <p className="text-fg-3">
            Skeleton / SkeletonText / SkeletonTable 三件套覆盖常见加载场景。
          </p>
        </div>
      )}
    </div>
  )
}

function LoadingOverlayDemo() {
  const [visible, setVisible] = useState(true)
  return (
    <div className="w-full space-y-2">
      <div className="relative h-32 overflow-hidden rounded-md border border-line bg-surface-2">
        <div className="p-3 text-xs text-fg-3">容器内容（被遮罩层覆盖）</div>
        <LoadingOverlay visible={visible} label="正在同步数据…" />
      </div>
      <Button size="xs" variant="secondary" onClick={() => setVisible((prev) => !prev)}>
        {visible ? '移除遮罩' : '显示遮罩'}
      </Button>
    </div>
  )
}

function EmptyDemo() {
  const [empty, setEmpty] = useState(true)
  return (
    <div className="w-full rounded-md border border-line">
      {empty ? (
        <EmptyState
          size="sm"
          title="还没有数据源"
          description="接入一个数据库后，这里会显示表结构"
          action={
            <Button
              size="sm"
              variant="primary"
              leftIcon={<ArrowRight className="size-3.5" />}
              onClick={() => setEmpty(false)}
            >
              新建数据源
            </Button>
          }
        />
      ) : (
        <div className="grid place-items-center gap-2 py-8 text-xs text-fg-3">
          <CircleCheck className="size-5 text-success" />
          数据源已创建
          <Button size="xs" variant="ghost" onClick={() => setEmpty(true)}>
            重置为空态
          </Button>
        </div>
      )}
    </div>
  )
}

function UploadDemo() {
  const [uploading, setUploading] = useState(false)
  return (
    <div className="w-full">
      <div
        className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-primary-weak/20"
        onClick={() => {
          if (uploading) return
          setUploading(true)
          setTimeout(() => {
            setUploading(false)
            toast.success('文件已上传')
          }, 1200)
        }}
      >
        <span className="grid size-9 place-items-center rounded-full bg-surface-2 text-fg-3">
          <Upload className="size-4" />
        </span>
        <p className="text-xs text-fg-2">点击或拖拽文件到此处上传</p>
        <p className="text-2xs text-fg-4">支持 .xlsx / .pdf / .zip，单个不超过 20 MB</p>
        {uploading && <Spinner tone="primary" />}
      </div>
    </div>
  )
}

export const feedbackCategory: GalleryCategory = {
  id: 'feedback',
  name: 'Feedback',
  title: '反馈组件',
  description: '提示、弹层与加载：让系统的每一次响应都被看见',
  items: [
    {
      key: 'alert',
      name: 'Alert',
      nameZh: '提示条',
      summary: '四级语义提示，可关闭、可带右侧操作',
      demo: AlertDemo,
      wide: true,
      previewHeight: 260,
      keywords: ['tishi', 'alert'],
      code: `<Alert tone="warning" title="需要注意" action={<Button size="xs">继续</Button>}>
  当前操作将影响 128 名成员。
</Alert>`,
      props: [
        {
          name: 'tone',
          type: "'info' | 'success' | 'warning' | 'danger'",
          default: "'info'",
          desc: '语义色',
        },
        { name: 'title / children', type: 'ReactNode', desc: '标题与正文' },
        { name: 'action', type: 'ReactNode', desc: '右侧操作' },
        { name: 'closable', type: 'boolean', desc: '显示关闭按钮（显隐需自己控制）' },
      ],
    },
    {
      key: 'banner',
      name: 'Banner',
      nameZh: '横幅',
      summary: '页面级公告，比 Alert 更醒目且不可关闭',
      demo: BannerDemo,
      wide: true,
      previewHeight: 210,
      keywords: ['hengfu', 'banner'],
      code: `<Banner
  tone="warning"
  title="维护窗口"
  description="本周日 02:00 - 04:00 暂停写入操作。"
  action={<Button size="xs">查看</Button>}
/>`,
      props: [
        { name: 'tone', type: 'AlertTone', desc: '语义色' },
        { name: 'title', type: 'ReactNode', desc: '标题' },
        { name: 'description', type: 'ReactNode', desc: '说明（注意不是 children）' },
        { name: 'action', type: 'ReactNode', desc: '右侧操作' },
      ],
    },
    {
      key: 'dialog',
      name: 'Dialog',
      nameZh: '对话框',
      summary: '焦点陷阱 + ESC 关闭 + 滚动锁定，5 档宽度',
      demo: DialogDemo,
      keywords: ['duihuakuang', 'modal'],
      code: `<Dialog
  open={open}
  onOpenChange={setOpen}
  title="新建用户"
  description="创建后会发送一封邀请邮件"
  footer={<Button variant="primary" onClick={save}>保存</Button>}
>
  <FormField label="邮箱"><Input /></FormField>
</Dialog>`,
      props: [
        {
          name: 'open / onOpenChange',
          type: 'boolean / (open: boolean) => void',
          desc: '受控开关',
        },
        {
          name: 'size',
          type: "'sm' | 'md' | 'lg' | 'xl' | 'full'",
          default: "'md'",
          desc: '宽度档位',
        },
        { name: 'footer / footerLeft', type: 'ReactNode', desc: '底部右侧 / 左侧区域' },
        { name: 'closeOnOverlayClick', type: 'boolean', default: 'true', desc: '点遮罩关闭' },
      ],
    },
    {
      key: 'confirm-dialog',
      name: 'ConfirmDialog',
      nameZh: '确认对话框',
      summary: '危险操作的标准二次确认，danger 切换红色主按钮',
      demo: ConfirmDemo,
      keywords: ['queren', 'confirm'],
      code: `<ConfirmDialog
  danger
  open={open}
  onOpenChange={setOpen}
  title="确认删除该实例？"
  description="实例上的全部数据会被清理，且无法恢复。"
  confirmText="删除"
  onConfirm={remove}
/>`,
      props: [
        { name: 'open / onOpenChange / title / onConfirm', type: '必填', desc: '四个必填参数' },
        { name: 'danger', type: 'boolean', desc: '危险操作样式' },
        { name: 'loading', type: 'boolean', desc: '确认按钮加载态' },
      ],
    },
    {
      key: 'drawer',
      name: 'Drawer',
      nameZh: '抽屉',
      summary: '侧滑面板，表单与详情都能塞下',
      demo: DrawerDemo,
      keywords: ['chouti', 'drawer'],
      code: `<Drawer open={open} onOpenChange={setOpen} title="节点属性" width={460}>
  <FormField label="节点名称"><Input /></FormField>
</Drawer>`,
      props: [
        { name: 'side', type: "'right' | 'left'", default: "'right'", desc: '弹出方向' },
        { name: 'width', type: 'number | string', default: '460', desc: '宽度' },
        { name: 'footer', type: 'ReactNode', desc: '底部操作区' },
      ],
    },
    {
      key: 'dropdown',
      name: 'Dropdown',
      nameZh: '下拉菜单',
      summary: '操作菜单与通知面板，分隔线写字符串 "divider"',
      demo: DropdownDemo,
      previewHeight: 160,
      keywords: ['xiala', 'dropdown', 'menu'],
      code: `<Dropdown
  trigger={<Button size="sm">更多操作</Button>}
  items={[
    { key: 'edit', label: '编辑', onSelect: edit },
    'divider',
    { key: 'del', label: '删除', danger: true, onSelect: remove },
  ]}
/>`,
      props: [
        { name: 'trigger', type: 'ReactNode', desc: '触发器（必填）' },
        { name: 'items', type: "(DropdownItem | 'divider')[]", desc: '菜单项（必填）' },
        { name: 'align', type: "'start' | 'end'", default: "'start'", desc: '对齐方向' },
        { name: 'width', type: 'number', desc: '菜单宽度' },
      ],
    },
    {
      key: 'tooltip',
      name: 'Tooltip',
      nameZh: '文字提示',
      summary: '放不下自动翻面并夹取到视口内，不会贴边被裁',
      demo: TooltipDemo,
      keywords: ['tishiqi', 'tooltip'],
      code: `<Tooltip content="复制到剪贴板" side="bottom">
  <Button size="icon-sm" aria-label="复制"><Copy className="size-4" /></Button>
</Tooltip>`,
      props: [
        { name: 'content', type: 'ReactNode', desc: '提示内容（必填）' },
        {
          name: 'side',
          type: "'top' | 'bottom' | 'left' | 'right'",
          default: "'top'",
          desc: '首选方向',
        },
        { name: 'delay', type: 'number', default: '260', desc: '延迟出现' },
        { name: 'disabled', type: 'boolean', desc: '禁用提示' },
      ],
    },
    {
      key: 'toast',
      name: 'Toast',
      nameZh: '全局提示',
      summary: '命令式调用，并发失败会自动去重排队',
      demo: ToastDemo,
      wide: true,
      previewHeight: 130,
      keywords: ['tishi', 'toast'],
      code: `toast.success('保存成功')
toast.loading('正在发送邮件…', { id: 'mail' })
toast.success('已复制链接', { description: '可以粘贴到任意窗口' })`,
      props: [
        {
          name: 'toast.success(title, opts?)',
          type: '方法',
          desc: '成功提示；同理 error / warning / info / loading',
        },
        { name: 'description', type: 'string', desc: '第二行说明' },
        { name: 'id', type: 'string', desc: '同一 id 会复用同一条提示' },
        { name: 'action', type: '{ label; onClick }', desc: '右侧操作按钮' },
      ],
    },
    {
      key: 'skeleton',
      name: 'Skeleton',
      nameZh: '骨架屏',
      summary: '结构占位，让加载态与真实内容同构',
      demo: SkeletonDemo,
      wide: true,
      previewHeight: 210,
      keywords: ['gujia', 'skeleton', 'loading'],
      code: `<Skeleton className="h-4 w-28" />
<SkeletonText lines={3} />
<SkeletonTable rows={3} columns={3} />`,
      props: [
        { name: 'shimmer', type: 'boolean', default: 'true', desc: '流光动画' },
        { name: 'lines', type: 'number', default: '3', desc: 'SkeletonText 行数' },
        { name: 'rows / columns', type: 'number', desc: 'SkeletonTable 行数与列数' },
      ],
    },
    {
      key: 'loading-overlay',
      name: 'LoadingOverlay',
      nameZh: '加载遮罩',
      summary: '绝对定位于父容器，父级需要 relative',
      demo: LoadingOverlayDemo,
      wide: true,
      keywords: ['zhezhao', 'loading'],
      code: `<div className="relative h-32">
  <LoadingOverlay visible={loading} label="正在同步数据…" />
</div>`,
      props: [
        { name: 'visible', type: 'boolean', default: 'true', desc: '是否显示' },
        { name: 'label', type: 'string', default: "'加载中…'", desc: '提示文案' },
      ],
    },
    {
      key: 'empty-state',
      name: 'EmptyState',
      nameZh: '空状态',
      summary: '空态必须给出下一步动作，否则用户会卡住',
      demo: EmptyDemo,
      wide: true,
      previewHeight: 200,
      keywords: ['kongtai', 'empty'],
      code: `<EmptyState
  size="sm"
  title="还没有数据源"
  description="接入一个数据库后，这里会显示表结构"
  action={<Button size="sm" variant="primary">新建数据源</Button>}
/>`,
      props: [
        { name: 'title', type: 'ReactNode', default: "'暂无数据'", desc: '标题' },
        { name: 'description', type: 'ReactNode', desc: '说明' },
        { name: 'action', type: 'ReactNode', desc: '下一步动作' },
        { name: 'size', type: "'sm' | 'md' | 'lg'", desc: '内边距档位' },
      ],
    },
    {
      key: 'upload-zone',
      name: 'UploadZone',
      nameZh: '上传区',
      summary: '由描边、图标与提示文案组合出的拖拽区',
      demo: UploadDemo,
      wide: true,
      keywords: ['shangchuan', 'upload', 'drag'],
      code: `<div
  className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center
    transition-colors hover:border-primary/50 hover:bg-primary-weak/20"
  onDrop={handleDrop}
  onDragOver={(e) => e.preventDefault()}
>
  <Upload className="mx-auto size-4 text-fg-3" />
  <p className="mt-2 text-xs text-fg-2">点击或拖拽文件到此处上传</p>
</div>`,
    },
  ],
}
