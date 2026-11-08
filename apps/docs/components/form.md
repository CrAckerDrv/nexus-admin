# 表单组件

## FormField

统一标签、必填星号、提示与错误信息的布局：

```tsx
<FormField label="邮箱" required hint="邀请链接将发送到该邮箱" error={errors.email}>
  <Input value={email} onChange={(e) => setEmail(e.target.value)} />
</FormField>
```

### 无障碍：自动关联，无需手工接线

`FormField` 会通过内部的 `FieldContext` 把下列属性下发给任意子控件：

| 自动下发 | 说明 |
| --- | --- |
| `id` | 与 `<label for>` 一致，点击标签即聚焦控件 |
| `aria-describedby` | 有 `error` 时指向错误节点，否则指向 `hint` |
| `aria-invalid` | 有 `error` 时自动为 `true`，控件边框同步变红 |
| `aria-required` | `required` 为真时下发 |
| `aria-labelledby` | 非原生控件（Select / RadioGroup / 自定义输入）用 label 的 id 取可访问名 |

已内置接管的组件：`Input`、`Textarea`、`Select`、`RadioGroup`。
自定义控件用 `useFieldContext()` 取得同样属性：

```tsx
function TagInput({ value, onChange }) {
  const field = useFieldContext()
  return (
    <input
      aria-labelledby={field?.labelledBy}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
    />
  )
}
```

`inline` 模式下标签在左侧固定宽度，适合设置页：

```tsx
<FormField label="圆角风格" inline>
  <SegmentedControl options={radiusOptions} />
</FormField>
```

## Input

```tsx
<Input placeholder="请输入" />
<Input status="error" defaultValue="taken@nexus.dev" />
<Input leftIcon={<Search className="size-3.5" />} clearable value={value} onClear={() => setValue('')} />
<Input prefix="/api/" addonAfter="MB" />
```

`status`：`default` / `error` / `success` / `warning`（边框与聚焦环同步变色）

## Select

```tsx
// 单选
<Select options={regions} value={region} onChange={setRegion} searchable />

// 多选
<Select multiple options={tags} values={selected} onValuesChange={setSelected} />

// 分组
<Select
  options={[
    { label: '平台技术部', value: 'tech', group: '研发' },
    { label: '用户增长组', value: 'growth', group: '业务' },
  ]}
/>
```

键盘：`↑` `↓` 移动、`Enter` 选中、`Esc` 关闭、输入自动过滤。

## Switch / Checkbox / RadioGroup

```tsx
<Switch checked={on} onChange={setOn} label="启用通知" description="变更时发送邮件" />
<Switch size="sm" defaultChecked />

<Checkbox checked={checked} label="我已阅读协议" />
<Checkbox indeterminate label="半选状态" />

<RadioGroup
  card
  options={[
    { label: '按月计费', value: 'month', description: '可随时取消' },
    { label: '按年计费', value: 'year', description: '节省 20%' },
  ]}
  value={plan}
  onChange={setPlan}
/>
```

## Slider

```tsx
<Slider
  value={quota}
  onChange={setQuota}
  min={10}
  max={500}
  step={10}
  showValue
  formatValue={(v) => `${v} GB`}
/>
```

键盘：方向键步进、`PageUp/PageDown` 十倍步进、`Home/End` 到端点。

## SegmentedControl

```tsx
<SegmentedControl
  options={[
    { label: '7 天', value: '7d' },
    { label: '30 天', value: '30d' },
  ]}
  value={range}
  onChange={setRange}
/>
```

## Transfer

```tsx
<Transfer
  dataSource={members}
  targetKeys={selected}
  onChange={setSelected}
  titles={['可选成员', '已加入']}
  height={280}
/>
```

## 校验模式

模板不绑定表单库，示例采用**集中式校验函数**：

```ts
const validate = () => {
  const next: Record<string, string> = {}
  if (!form.name.trim()) next.name = '请填写项目名称'
  if (!/^[a-z][a-z0-9-]{2,30}$/.test(form.slug)) next.slug = '仅支持小写字母、数字与中划线'
  setErrors(next)
  return Object.keys(next).length === 0
}
```

若需要更强的能力，可以接入 `react-hook-form` + `zod`（`zod` 已在依赖中）：

```ts
const schema = z.object({
  name: z.string().min(1, '请填写名称').max(32),
  email: z.email('邮箱格式不正确'),
})
```

表单组件均为受控组件，`Controller` 可直接包裹使用。
