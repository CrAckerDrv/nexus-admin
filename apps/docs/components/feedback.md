# 反馈组件

## Toast

命令式调用，无需在组件树里包 Provider（`Toaster` 在应用根部挂载一次即可）。

```ts
import { toast } from '@nexus/ui'

toast.success('保存成功')
toast.error('保存失败', { description: '网络超时，请重试' })
toast.warning('额度即将用尽')
toast.info('这是一条提示')

// 带操作按钮
toast.error('导出失败', {
  action: { label: '重试', onClick: retry },
})

// 加载态 → 完成
const id = toast.loading('正在上传…', { duration: 0 })
upload().then(() => {
  toast.dismiss(id)
  toast.success('上传完成')
})
```

实现细节：

- 使用 `useSyncExternalStore` 订阅一个模块级数组，**零状态库依赖**
- 默认 3.2s 自动消失，鼠标悬停暂停
- 相同 `id` 的提示会原地更新（加载态转成功时不会闪两条）
- `role="status"` + `aria-live="polite"`，不打断屏幕阅读器

## Dialog

```tsx
<Dialog
  open={open}
  onOpenChange={setOpen}
  title="新建看板"
  description="看板用于聚合业务关键指标"
  footer={
    <>
      <Button variant="ghost" onClick={() => setOpen(false)}>
        取消
      </Button>
      <Button variant="primary" onClick={submit}>
        创建
      </Button>
    </>
  }
>
  内容
</Dialog>
```

无障碍能力：

| 能力     | 实现                                               |
| -------- | -------------------------------------------------- |
| 焦点陷阱 | `Tab` / `Shift+Tab` 在弹层内循环                   |
| 焦点归还 | 打开时记录 `activeElement`，关闭后 `.focus()`      |
| ESC 关闭 | 捕获阶段监听 `keydown`                             |
| 滚动锁   | 打开时 `body.overflow = hidden`                    |
| 语义     | `role="dialog"` + `aria-modal` + `aria-labelledby` |

## ConfirmDialog

危险操作的二次确认：

```tsx
<ConfirmDialog
  open={Boolean(target)}
  onOpenChange={(open) => !open && setTarget(null)}
  danger
  title="删除用户"
  description={`确认删除「${target?.name}」吗？该操作不可撤销。`}
  confirmText="删除"
  loading={mutation.isPending}
  onConfirm={async () => {
    await mutation.mutateAsync(target.id)
  }}
/>
```

## Drawer

侧滑面板，适合表单与详情：

```tsx
<Drawer
  open={open}
  onOpenChange={setOpen}
  title="成员详情"
  width={520}
  footer={
    <>
      <Button>关闭</Button>
      <Button variant="primary">保存</Button>
    </>
  }
>
  内容
</Drawer>
```

`side="left"` 可从左侧滑出。

## Dropdown

```tsx
<Dropdown
  align="end"
  trigger={
    <Button size="icon-sm" aria-label="更多">
      <Ellipsis className="size-4" />
    </Button>
  }
  items={[
    { key: 'edit', label: '编辑', icon: <Pencil className="size-3.5" />, onSelect: edit },
    { key: 'copy', label: '复制链接', hint: '⌘C', onSelect: copy },
    'divider',
    { key: 'del', label: '删除', danger: true, onSelect: confirmDelete },
  ]}
/>
```

菜单在视口边缘会自动翻转（`top` → `bottom`），并在滚动时跟随锚点。

## Alert / Banner

```tsx
<Alert tone="warning" title="需要注意" compact closable>
  当前操作将影响 128 名成员。
</Alert>

<Banner
  tone="info"
  title="为什么不用第三方 UI 库？"
  description="…"
  action={<Button size="sm">了解</Button>}
/>
```

`tone`：`info` / `success` / `warning` / `danger`

## EmptyState

```tsx
<EmptyState
  title="还没有任何项目"
  description="创建一个项目，开始沉淀你的数据资产。"
  action={<Button variant="primary">新建项目</Button>}
/>
```

空态的重要性：**每屏只有一个主行动**，不要让用户面对空白发呆。

## Skeleton

```tsx
<Skeleton className="h-4 w-32" />
<SkeletonText lines={3} />
<SkeletonTable rows={6} columns={5} />
```

首屏加载超过 280ms 才显示骨架（由路由 `defaultPendingMs` 控制），避免"闪一下"。
