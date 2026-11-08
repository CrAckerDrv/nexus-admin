import { useState } from 'react'
import { Calendar as CalendarIcon, CircleCheck, Download, Mail, Search } from 'lucide-react'
import {
  Button,
  Calendar,
  Checkbox,
  FormField,
  Input,
  RadioGroup,
  ReadonlyValue,
  SegmentedControl,
  Select,
  Slider,
  Switch,
  Textarea,
  Transfer,
  toast,
} from '@nexus/ui'
import type { GalleryCategory } from './types'

function InputDemo() {
  const [keyword, setKeyword] = useState('可清除的文本')
  return (
    <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
      <FormField label="默认输入" hint="支持 placeholder 与清除按钮">
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          clearable
          onClear={() => setKeyword('')}
          leftIcon={<Search className="size-3.5" />}
          placeholder="搜索关键字"
        />
      </FormField>
      <FormField label="邮箱" error="该邮箱已被占用">
        <Input
          status="error"
          defaultValue="taken@nexus.dev"
          leftIcon={<Mail className="size-3.5" />}
        />
      </FormField>
      <FormField label="成功状态">
        <Input
          status="success"
          defaultValue="可用"
          rightIcon={<CircleCheck className="size-3.5 text-success" />}
        />
      </FormField>
      <FormField label="带单位">
        <Input defaultValue="2048" addonAfter="MB" leftIcon={<Download className="size-3.5" />} />
      </FormField>
    </div>
  )
}

function FormFieldDemo() {
  return (
    <div className="w-full max-w-[26.25rem] space-y-3">
      <FormField label="项目名称" required hint="建议用业务域名称，例如 order-service">
        <Input placeholder="请输入项目名称" />
      </FormField>
      <FormField label="描述" error="描述至少 10 个字">
        <Textarea placeholder="一句话说明这个项目解决什么问题" maxLength={120} showCount />
      </FormField>
      <FormField label="只读值">
        <ReadonlyValue>
          <span className="font-mono text-xs">nexus-8f2a9c</span>
        </ReadonlyValue>
      </FormField>
    </div>
  )
}

const DEPARTMENT_OPTIONS = [
  { label: '平台技术部', value: 'tech', group: '研发' },
  { label: '数据智能组', value: 'data', group: '研发' },
  { label: '用户增长组', value: 'growth', group: '业务' },
  { label: '客户成功部', value: 'cs', group: '业务' },
]

function SelectDemo() {
  const [department, setDepartment] = useState('tech')
  const [tags, setTags] = useState<string[]>(['vip', 'beta'])
  return (
    <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
      <FormField label="单选（可搜索、分组）">
        <Select
          searchable
          options={DEPARTMENT_OPTIONS}
          value={department}
          onChange={setDepartment}
          placeholder="请选择部门"
        />
      </FormField>
      <FormField label="多选">
        <Select
          multiple
          values={tags}
          onValuesChange={setTags}
          options={[
            { label: '核心客户', value: 'vip' },
            { label: '内测用户', value: 'beta' },
            { label: '风险关注', value: 'risk' },
          ]}
          placeholder="选择标签"
        />
      </FormField>
      <FormField label="错误态">
        <Select status="error" options={DEPARTMENT_OPTIONS} placeholder="未选择部门" />
      </FormField>
      <FormField label="禁用">
        <Select disabled options={DEPARTMENT_OPTIONS} defaultValue="tech" />
      </FormField>
    </div>
  )
}

function SwitchDemo() {
  const [notify, setNotify] = useState(true)
  const [beta, setBeta] = useState(false)
  return (
    <div className="flex flex-col items-center gap-3">
      <Switch
        checked={notify}
        onChange={setNotify}
        label="启用通知"
        description="变更时通过邮件与企业微信提醒"
      />
      <Switch size="sm" checked={beta} onChange={setBeta} label="小尺寸" />
      <Switch disabled label="禁用状态" />
    </div>
  )
}

function CheckboxDemo() {
  const [all, setAll] = useState(true)
  const [partial, setPartial] = useState(true)
  return (
    <div className="flex flex-col items-start gap-2.5">
      <Checkbox checked={all} onChange={setAll} label="全选当前页" />
      <Checkbox
        indeterminate={partial}
        checked={false}
        onChange={setPartial}
        label="半选状态（部分选中）"
      />
      <Checkbox label="未选中" />
      <Checkbox disabled label="禁用" />
    </div>
  )
}

function RadioDemo() {
  const [billing, setBilling] = useState<'day' | 'month' | 'year'>('month')
  return (
    <div className="w-full max-w-[26.25rem]">
      <RadioGroup
        card
        value={billing}
        onChange={setBilling}
        options={[
          { label: '按天计费', value: 'day', description: '适合短期项目' },
          { label: '按月计费', value: 'month', description: '最常用，可随时取消' },
          { label: '按年计费', value: 'year', description: '节省 20% 成本' },
        ]}
      />
    </div>
  )
}

function SliderDemo() {
  const [quota, setQuota] = useState(60)
  return (
    <div className="w-full max-w-[26.25rem] space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-fg-3">CPU 限额</span>
          <span className="text-fg tabular-nums">{quota}%</span>
        </div>
        <Slider value={quota} onChange={setQuota} showValue />
      </div>
      <div>
        <div className="mb-2 text-xs text-fg-3">带宽</div>
        <Slider
          defaultValue={40}
          max={200}
          step={10}
          marks={[0, 50, 100, 150, 200]}
          formatValue={(value) => `${value} Mbps`}
          showValue
        />
      </div>
    </div>
  )
}

function SegmentedDemo() {
  const [mode, setMode] = useState<'day' | 'week' | 'month'>('week')
  return (
    <div className="flex flex-col items-center gap-3">
      <SegmentedControl
        value={mode}
        onChange={setMode}
        options={[
          { label: '今日', value: 'day' },
          { label: '本周', value: 'week' },
          { label: '本月', value: 'month' },
        ]}
      />
      <SegmentedControl
        size="sm"
        defaultValue="asc"
        options={[
          { label: '升序', value: 'asc' },
          { label: '降序', value: 'desc' },
        ]}
      />
      <p className="text-2xs text-fg-4">当前维度：{mode}</p>
    </div>
  )
}

const TRANSFER_DATA = [
  { key: 'read', title: '用户查看', description: 'user:read' },
  { key: 'write', title: '用户编辑', description: 'user:write' },
  { key: 'delete', title: '用户删除', description: 'user:delete' },
  { key: 'export', title: '数据导出', description: 'user:export' },
]

function TransferDemo() {
  const [targets, setTargets] = useState<string[]>(['read'])
  return (
    <Transfer
      dataSource={TRANSFER_DATA}
      targetKeys={targets}
      onChange={setTargets}
      titles={['可选权限', '已授予']}
      height={220}
    />
  )
}

const MARKED_DATES = ['2026-11-03', '2026-11-12', '2026-11-21']

function CalendarDemo() {
  const [value, setValue] = useState(new Date(2026, 10, 5))
  return (
    <div className="w-full max-w-[18.75rem]">
      <Calendar
        value={value}
        markedDates={MARKED_DATES}
        onChange={(date) => {
          setValue(date)
          toast.info(`已选择 ${date.getMonth() + 1} 月 ${date.getDate()} 日`)
        }}
      />
    </div>
  )
}

function DateInputDemo() {
  return (
    <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
      <FormField label="开始时间">
        <Input type="date" leftIcon={<CalendarIcon className="size-3.5" />} />
      </FormField>
      <FormField label="结束时间" hint="当前脚手架只提供样式，日期选择请接入业务组件">
        <Input type="datetime-local" />
      </FormField>
      <FormField label="提交">
        <Button variant="primary" onClick={() => toast.success('筛选条件已应用')}>
          应用筛选
        </Button>
      </FormField>
    </div>
  )
}

export const formCategory: GalleryCategory = {
  id: 'form',
  name: 'Form',
  title: '表单组件',
  description: '输入、选择、开关与日期：表单页的全部输入面控件',
  items: [
    {
      key: 'input',
      name: 'Input',
      nameZh: '输入框',
      summary: '尺寸 / 状态 / 前后缀 / 可清除，一站式覆盖表单输入',
      demo: InputDemo,
      wide: true,
      previewHeight: 220,
      keywords: ['shuru', 'input'],
      code: `<Input
  value={keyword}
  onChange={(e) => setKeyword(e.target.value)}
  clearable
  onClear={() => setKeyword('')}
  leftIcon={<Search className="size-3.5" />}
/>`,
      props: [
        { name: 'size', type: "'sm' | 'md' | 'lg'", default: "'md'", desc: '尺寸' },
        {
          name: 'status',
          type: "'default' | 'error' | 'success' | 'warning'",
          desc: '校验状态；FormField 有 error 时自动覆盖',
        },
        { name: 'leftIcon / rightIcon', type: 'ReactNode', desc: '两侧图标' },
        { name: 'addonAfter', type: 'ReactNode', desc: '右侧单位（如 MB）' },
        { name: 'clearable', type: 'boolean', desc: '仅在 value 受控且非空时出现清除按钮' },
      ],
    },
    {
      key: 'form-field',
      name: 'FormField',
      nameZh: '表单行',
      summary: '自动下发 id / aria-describedby / aria-invalid，无需手工接线',
      demo: FormFieldDemo,
      wide: true,
      previewHeight: 240,
      keywords: ['biaodan hang', 'label'],
      code: `<FormField label="项目名称" required hint="建议用业务域名称" error={errors.name}>
  <Input value={name} onChange={(e) => setName(e.target.value)} />
</FormField>`,
      props: [
        { name: 'label', type: 'ReactNode', desc: '标签' },
        { name: 'required', type: 'boolean', desc: '显示必填红星并下发 aria-required' },
        { name: 'hint', type: 'ReactNode', desc: '辅助说明（有 error 时被顶替）' },
        { name: 'error', type: 'ReactNode', desc: '错误信息，同时让内部控件变红' },
        { name: 'inline', type: 'boolean', desc: '标签在左、控件在右' },
      ],
    },
    {
      key: 'select',
      name: 'Select',
      nameZh: '选择器',
      summary: '单选 / 多选 / 搜索 / 分组，一个组件覆盖四种形态',
      demo: SelectDemo,
      wide: true,
      previewHeight: 200,
      keywords: ['xuanze', 'dropdown'],
      code: `<Select searchable options={DEPARTMENT_OPTIONS} value={department} onChange={setDepartment} />
<Select multiple values={tags} onValuesChange={setTags} options={TAG_OPTIONS} />`,
      props: [
        {
          name: 'options',
          type: '{ label: ReactNode; value: string; group?: string; disabled?: boolean }[]',
          desc: '选项（必填）',
        },
        { name: 'multiple', type: 'boolean', desc: '多选；此时用 values / onValuesChange' },
        { name: 'searchable', type: 'boolean', desc: '下拉内搜索' },
        { name: 'clearable', type: 'boolean', desc: '可清空' },
        { name: 'status', type: "'default' | 'error'", desc: '校验状态（只有两档）' },
      ],
    },
    {
      key: 'switch',
      name: 'Switch',
      nameZh: '开关',
      summary: '点击即生效的布尔开关，支持标签与说明文案',
      demo: SwitchDemo,
      keywords: ['kaiguan', 'toggle'],
      code: `<Switch checked={notify} onChange={setNotify} label="启用通知" description="变更时邮件提醒" />`,
      props: [
        {
          name: 'checked / onChange',
          type: 'boolean / (checked: boolean) => void',
          desc: '受控用法',
        },
        { name: 'size', type: "'sm' | 'md'", default: "'md'", desc: '尺寸' },
        { name: 'label / description', type: 'ReactNode', desc: '标签与说明（右侧排列）' },
      ],
    },
    {
      key: 'checkbox',
      name: 'Checkbox',
      nameZh: '多选框',
      summary: '支持半选状态，常用于表格批量操作',
      demo: CheckboxDemo,
      keywords: ['duoxuan', 'checkbox'],
      code: `<Checkbox checked={all} onChange={setAll} label="全选当前页" />
<Checkbox indeterminate={partial} checked={false} onChange={setPartial} label="半选" />`,
      props: [
        { name: 'checked / defaultChecked', type: 'boolean', desc: '受控 / 非受控' },
        { name: 'indeterminate', type: 'boolean', desc: '半选视觉（点击仍会切换 checked）' },
        { name: 'label', type: 'ReactNode', desc: '标签文案' },
      ],
    },
    {
      key: 'radio-group',
      name: 'RadioGroup',
      nameZh: '单选组',
      summary: 'card 形态可直接当套餐选择卡使用',
      demo: RadioDemo,
      wide: true,
      keywords: ['danxuan', 'radio'],
      code: `<RadioGroup
  card
  value={billing}
  onChange={setBilling}
  options={[{ label: '按月计费', value: 'month', description: '最常用' }]}
/>`,
      props: [
        {
          name: 'options',
          type: '{ label: ReactNode; value: T; description?: string }[]',
          desc: '选项（必填）',
        },
        { name: 'card', type: 'boolean', desc: '卡片式单选' },
        {
          name: 'direction',
          type: "'horizontal' | 'vertical'",
          default: "'vertical'",
          desc: '排列方向',
        },
      ],
    },
    {
      key: 'slider',
      name: 'Slider',
      nameZh: '滑块',
      summary: '支持键盘方向键微调、刻度点与自定义格式',
      demo: SliderDemo,
      wide: true,
      keywords: ['huakuai', 'range'],
      code: `<Slider
  value={quota}
  onChange={setQuota}
  marks={[0, 50, 100]}
  formatValue={(v) => \`\${v} Mbps\`}
  showValue
/>`,
      props: [
        { name: 'value / onChange', type: 'number / (n: number) => void', desc: '受控用法' },
        { name: 'min / max / step', type: 'number', desc: '取值区间与步长' },
        { name: 'marks', type: 'number[]', desc: '刻度圆点（无文字标签）' },
        {
          name: 'formatValue',
          type: '(n: number) => string',
          desc: '当前值与 aria-valuetext 的格式',
        },
      ],
    },
    {
      key: 'segmented-control',
      name: 'SegmentedControl',
      nameZh: '分段控制器',
      summary: '紧凑的二三选一，比 Tabs 更轻、比 Radio 更省空间',
      demo: SegmentedDemo,
      keywords: ['fenduan', 'segmented'],
      code: `<SegmentedControl
  value={mode}
  onChange={setMode}
  options={[{ label: '今日', value: 'day' }, { label: '本周', value: 'week' }]}
/>`,
      props: [
        { name: 'options', type: '{ label: ReactNode; value: T }[]', desc: '选项（必填）' },
        { name: 'value / onChange', type: 'T / (value: T) => void', desc: '受控用法' },
        { name: 'size', type: "'sm' | 'md'", desc: '尺寸' },
        { name: 'block', type: 'boolean', desc: '撑满宽度（等分）' },
      ],
    },
    {
      key: 'transfer',
      name: 'Transfer',
      nameZh: '穿梭框',
      summary: '权限授予、成员分组的经典交互，完全受控',
      demo: TransferDemo,
      wide: true,
      previewHeight: 280,
      keywords: ['chuansuo', 'transfer'],
      code: `<Transfer
  dataSource={PERMISSIONS}
  targetKeys={targets}
  onChange={setTargets}
  titles={['可选权限', '已授予']}
/>`,
      props: [
        {
          name: 'dataSource',
          type: '{ key: string; title: ReactNode; description?: ReactNode }[]',
          desc: '全量数据（必填）',
        },
        { name: 'targetKeys', type: 'string[]', desc: '右侧已选项（必填）' },
        { name: 'onChange', type: '(keys: string[]) => void', desc: '变更回调（必填）' },
        { name: 'titles', type: '[ReactNode, ReactNode]', desc: '两侧标题' },
      ],
    },
    {
      key: 'calendar',
      name: 'Calendar',
      nameZh: '日历',
      summary: '带标记点的月历，适合排班与日程总览',
      demo: CalendarDemo,
      previewHeight: 300,
      keywords: ['rili', 'calendar'],
      code: `<Calendar
  value={value}
  markedDates={['2026-11-12']}
  onChange={setValue}
/>`,
      props: [
        { name: 'value', type: 'Date', desc: '初始选中日期（挂载后不再同步）' },
        { name: 'markedDates', type: 'string[]', desc: 'YYYY-MM-DD 格式的标记日期' },
        { name: 'weekStartsOn', type: '0 | 1', default: '1', desc: '一周起始（1=周一）' },
      ],
    },
    {
      key: 'date-input',
      name: 'DateInput',
      nameZh: '日期输入',
      summary: '原生日期控件的统一样式，配合 FormField 使用',
      demo: DateInputDemo,
      wide: true,
      previewHeight: 190,
      keywords: ['riqi', 'date'],
      code: `<FormField label="开始时间">
  <Input type="date" leftIcon={<CalendarIcon className="size-3.5" />} />
</FormField>`,
    },
  ],
}
