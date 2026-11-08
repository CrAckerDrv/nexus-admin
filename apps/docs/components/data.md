# 数据展示

## DataTable

泛型表格，列定义与数据解耦：

```tsx
import { DataTable, type Column } from '@nexus/ui'

const columns: Column<Order>[] = [
  {
    key: 'id',
    header: '订单号',
    width: 160,
    sortValue: (row) => row.id,          // 提供即开启排序
    cell: (row) => <ClipboardText value={row.id} />,
  },
  {
    key: 'amount',
    header: '金额',
    align: 'right',
    sortValue: (row) => row.amount,
    cell: (row) => formatCurrency(row.amount),
  },
]

<DataTable
  columns={columns}
  rows={data}
  getRowId={(row) => row.id}
  loading={isLoading}
  selectable
  selectedIds={selected}
  onSelectedChange={setSelected}
  onRowClick={openDetail}
  defaultSort={{ key: 'createdAt', dir: 'desc' }}
/>
```

`Column` 字段：

| 字段        | 说明                                 |
| ----------- | ------------------------------------ |
| `key`       | 唯一键                               |
| `header`    | 表头内容                             |
| `cell`      | 渲染函数 `(row, index) => ReactNode` |
| `sortValue` | 排序取值器，提供则表头可点击         |
| `align`     | `left` / `center` / `right`          |
| `width`     | 列宽（虚拟表格必需）                 |
| `hidden`    | 默认隐藏                             |
| `pinned`    | 固定列：`'left'` / `'right'` / `true` |

### 固定列（pinned）

宽表横向滚动时，把关键列钉在两侧。固定列**必须给 `width`**，sticky 偏移依赖它：

```tsx
const columns: Column<Order>[] = [
  { key: 'id', header: '订单号', width: 180, pinned: 'left', cell: (r) => r.id },
  { key: 'amount', header: '金额', width: 120, align: 'right', cell: (r) => r.amount },
  { key: 'actions', header: '操作', width: 92, align: 'right', pinned: 'right', cell: (r) => <Actions row={r} /> },
]
```

实现细节：

- 只用 `position: sticky` + 内联 `left` / `right` 偏移，**不复制 DOM**，滚动时不重排
- 固定列是实底（`.n-sticky-cell`），悬停与选中态单独还原，不会透出滚动内容
- 边缘投影用 `inset box-shadow`，不占布局
- 有 `pinned` 列时表格自动按列宽之和设置 `min-width`，保证容器变窄时真的出现横向滚动
- 无固定列时全部逻辑跳过，**零额外开销**

## VirtualTable

固定行高的虚拟滚动表格：

```tsx
<VirtualTable
  columns={columns}
  rows={bigList} // 5,000+ 行
  getRowId={(row) => row.id}
  rowHeight={40}
  height={440}
  overscan={8}
/>
```

要求：**所有列必须提供 `width`**（内部用 `colgroup` 固定列宽）。
行高必须固定，内容超长请用 `truncate`。

## Pagination

```tsx
<Pagination
  page={page}
  pageSize={pageSize}
  total={total}
  onChange={(nextPage, nextSize) => {
    setPage(nextPage)
    setPageSize(nextSize)
  }}
  pageSizeOptions={[10, 20, 50, 100]}
/>
```

自动计算页码窗口（`1 … 4 5 6 … 20`），首末页禁用时按钮为 `disabled`（不是 `pointer-events-none`，保证可聚焦）。

## Descriptions

```tsx
<Descriptions
  columns={3}
  items={[
    { label: '实例 ID', value: 'nexus-8f2a', copyable: true },
    { label: '创建时间', value: formatDateTime(createdAt) },
    { label: '备注', value: '无', span: 2 },
  ]}
/>
```

## Timeline

```tsx
<Timeline
  items={[
    {
      key: '1',
      title: '提交审批',
      description: '陈彦之 提交了申请',
      time: '10:24',
      tone: 'primary',
    },
    { key: '2', title: '审批通过', time: '11:02', tone: 'success' },
    { key: '3', title: '已生效', time: '14:08', tone: 'success' },
  ]}
/>
```

## Tree

```tsx
<Tree items={orgTree} defaultExpandAll selectedKey={key} onSelect={setKey} showLine />
```

节点结构：`{ key, title, icon?, extra?, disabled?, children? }`

键盘完全可达（遵循 WAI-ARIA tree 模式，roving tabindex）：

| 键位            | 行为                                       |
| --------------- | ------------------------------------------ |
| `↑` / `↓`       | 在可见节点间移动焦点（自动跳过 disabled）  |
| `→`             | 展开当前节点；已展开则进入第一个子节点     |
| `←`             | 收起当前节点；已收起则回到父节点           |
| `Home` / `End`  | 跳到第一个 / 最后一个可见节点              |
| `Enter` / `空格`| 选中当前节点                               |

焦点与选中解耦：移动焦点不会改变选中项，必须显式 `Enter` 才选中。

## Steps

```tsx
<Steps
  current={step}
  onChange={setStep}
  items={[
    { title: '填写信息', description: '名称与负责人' },
    { title: '配置数据源' },
    { title: '完成' },
  ]}
/>
```

`status="error"` 可让当前步骤显示为错误态；`direction="vertical"` 为纵向。

## Collapse

```tsx
<Collapse
  defaultValue={['basic']}
  items={[
    { key: 'basic', title: '基础配置', content: '…' },
    { key: 'adv', title: '高级选项', extra: <Badge>3 项</Badge>, content: '…' },
  ]}
/>
```

展开/收起用 `grid-template-rows: 0fr → 1fr` 实现高度过渡，无需测量 DOM。

## Calendar

```tsx
<Calendar markedDates={['2026-11-08', '2026-11-12']} onChange={(date) => …} />
```

## Progress / Meter

```tsx
<Progress value={62} tone="success" showLabel label="任务进度" />
<Progress value={78} variant="ring" ringSize={72} />
<Meter value={86} showValue thresholds={{ warning: 60, danger: 85 }} />
```

`Meter` 会根据阈值自动切换 `primary → warning → danger` 颜色，适合表格内的百分比列。
