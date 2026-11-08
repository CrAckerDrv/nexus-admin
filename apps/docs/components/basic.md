# 基础组件

## Button

```tsx
<Button variant="primary">主要</Button>
<Button variant="secondary">次要</Button>
<Button variant="outline">描边</Button>
<Button variant="ghost">幽灵</Button>
<Button variant="danger">危险</Button>
<Button variant="text">文字</Button>
<Button variant="link">链接</Button>
```

尺寸：`xs` / `sm` / `md` / `lg` / `icon` / `icon-sm` / `icon-xs`

```tsx
<Button size="lg" leftIcon={<Plus className="size-4" />}>新建</Button>
<Button size="icon-sm" aria-label="更多"><Ellipsis className="size-4" /></Button>
<Button loading>提交中</Button>
```

`loading` 会自动 `disabled` 并设置 `aria-busy`。

## Card / SectionCard

```tsx
// 简单卡片
<Card hoverable>
  <CardHeader title="标题" description="说明" extra={<Badge>New</Badge>} />
  <p>内容</p>
  <CardFooter>
    <Button size="sm" variant="ghost">取消</Button>
    <Button size="sm" variant="primary">确认</Button>
  </CardFooter>
</Card>

// 页面区块（推荐）
<SectionCard title="实例信息" description="只读属性" extra={<Button size="sm">编辑</Button>}>
  <Descriptions items={items} />
</SectionCard>
```

## Badge / StatusDot

```tsx
<Badge tone="success" dot>运行中</Badge>
<Badge tone="danger" variant="solid">已过期</Badge>
<Badge variant="dot" tone="warning">降级</Badge>

<span className="flex items-center gap-1.5">
  <StatusDot tone="success" pulse /> 实时同步中
</span>
```

`tone`：`neutral` / `primary` / `success` / `warning` / `danger` / `info`
`variant`：`soft` / `solid` / `outline` / `dot`

## Avatar

```tsx
<Avatar name="陈彦之" size="sm" status="online" />
<AvatarGroup users={[{name:'林知夏'},{name:'周予安'},{name:'吴星野'}]} max={2} />
```

无图片时用姓名首字生成，背景色由名字哈希决定（同名恒定）。

## Tag / Kbd

```tsx
<Tag tone="primary" onClose={() => remove()}>可关闭</Tag>
<Kbd>⌘</Kbd> <Kbd>K</Kbd>
```

## StatCard

```tsx
<StatCard
  label="本月交易额"
  value="¥ 8,642,300"
  delta={12.4}
  deltaLabel="较上月"
  trend={[42, 48, 45, 61, 58, 72]}
  tone="primary"
  icon={<CircleDollarSign className="size-4" />}
  onLive
/>
```

`trend` 会渲染一个 88×26 的 sparkline；`delta` 的正负会自适应用颜色箭头。

## PageHeader / PageContainer

```tsx
<PageContainer size="lg">
  <PageHeader
    title="用户管理"
    description="管理组织成员与角色分配"
    badge={<Badge tone="success">在线</Badge>}
    breadcrumb={<Breadcrumb items={[{ label: '业务管理' }, { label: '用户管理' }]} />}
    actions={<Button variant="primary">新建</Button>}
  />
  {/* 内容 */}
</PageContainer>
```

`size`：`sm`（880px）/ `md`（1180px）/ `lg`（1500px）/ `full`

## Grid / Stack / Inline

```tsx
<Grid cols={4} gap="md">…</Grid>        {/* 响应式栅格 */}
<Stack gap="sm">…</Stack>                {/* 纵向堆叠 */}
<Inline gap="xs">…</Inline>              {/* 横向排列，自动换行 */}
```
