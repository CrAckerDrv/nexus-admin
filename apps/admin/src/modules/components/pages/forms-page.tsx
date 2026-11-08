import { useState } from 'react'
import { CircleCheck, CircleAlert, CirclePlus, Save, Trash, WandSparkles } from 'lucide-react'
import {
  Alert,
  Button,
  CodeBlock,
  ConfirmDialog,
  FormField,
  Input,
  PageContainer,
  PageHeader,
  RadioGroup,
  SectionCard,
  Select,
  Slider,
  Switch,
  Textarea,
  cn,
  toast,
  useFieldContext,
} from '@nexus/ui'

interface FormState {
  name: string
  slug: string
  owner: string
  visibility: 'public' | 'internal' | 'private'
  notifications: boolean
  autoArchive: boolean
  quota: number
  description: string
  tags: string[]
}

const INITIAL: FormState = {
  name: '',
  slug: '',
  owner: 'u_1001',
  visibility: 'internal',
  notifications: true,
  autoArchive: false,
  quota: 60,
  description: '',
  tags: [],
}

export default function FormsPage() {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key as string]
      return next
    })
  }

  const validate = () => {
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = '请填写项目名称'
    if (form.name.length > 32) next.name = '名称不能超过 32 个字符'
    if (!form.slug.trim()) next.slug = '请填写唯一标识'
    else if (!/^[a-z][a-z0-9-]{2,30}$/.test(form.slug))
      next.slug = '仅支持小写字母、数字与中划线，3-31 位'
    if (form.description.length > 200) next.description = '描述不能超过 200 字'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async () => {
    if (!validate()) {
      toast.warning('请修正表单中的错误')
      return
    }
    setSaving(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 800))
      toast.success('项目已创建', { description: `唯一标识：${form.slug}` })
      setForm(INITIAL)
    } finally {
      setSaving(false)
    }
  }

  const completion = (() => {
    let score = 0
    if (form.name) score += 25
    if (form.slug) score += 25
    if (form.description) score += 25
    if (form.tags.length > 0) score += 25
    return score
  })()

  return (
    <PageContainer size="md">
      <PageHeader
        title="表单示例"
        description="受控表单、字段校验、联动禁用与异步提交的完整参考实现"
        actions={
          <>
            <Button
              variant="ghost"
              leftIcon={<Trash className="size-3.5" />}
              onClick={() => setConfirmOpen(true)}
            >
              重置
            </Button>
            <Button
              variant="primary"
              leftIcon={<Save className="size-3.5" />}
              loading={saving}
              onClick={() => void submit()}
            >
              创建项目
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
        <div className="space-y-3">
          <SectionCard title="基础信息" description="项目名称与唯一标识创建后仍可修改">
            <div className="space-y-4 p-4">
              <FormField
                label="项目名称"
                required
                error={errors.name}
                hint="建议使用业务域名称，如「用户增长中心」"
              >
                <Input
                  value={form.name}
                  status={errors.name ? 'error' : 'default'}
                  onChange={(event) => update('name', event.target.value)}
                  placeholder="请输入项目名称"
                  maxLength={40}
                />
              </FormField>

              <FormField
                label="唯一标识"
                required
                error={errors.slug}
                hint="用于 API 路径与资源命名，创建后不可修改"
              >
                <Input
                  value={form.slug}
                  status={errors.slug ? 'error' : 'default'}
                  onChange={(event) => update('slug', event.target.value.toLowerCase())}
                  placeholder="my-project"
                  prefix="/api/"
                />
              </FormField>

              <FormField label="负责人">
                <Select
                  searchable
                  options={[
                    { label: '陈彦之 · 平台技术部', value: 'u_1001' },
                    { label: '林知夏 · 用户增长组', value: 'u_1002' },
                    { label: '周予安 · 数据智能组', value: 'u_1003' },
                    { label: '吴星野 · 平台技术部', value: 'u_1004' },
                  ]}
                  value={form.owner}
                  onChange={(value) => update('owner', value)}
                />
              </FormField>

              <FormField
                label="项目描述"
                hint={`${form.description.length} / 200`}
                error={errors.description}
              >
                <Textarea
                  value={form.description}
                  maxLength={200}
                  onChange={(event) => update('description', event.target.value)}
                  placeholder="简要描述项目目标与范围"
                />
              </FormField>

              <FormField label="标签" hint="回车或逗号分隔添加，最多 5 个">
                <TagInput value={form.tags} onChange={(tags) => update('tags', tags)} />
              </FormField>
            </div>
          </SectionCard>

          <SectionCard title="访问与策略" description="可见性决定谁可以访问该项目">
            <div className="space-y-4 p-4">
              <FormField label="可见性">
                <RadioGroup
                  card
                  options={[
                    { label: '公开', value: 'public', description: '组织内所有人可见，可被搜索' },
                    { label: '内部', value: 'internal', description: '仅项目成员可见（推荐）' },
                    { label: '私有', value: 'private', description: '仅负责人与管理员可见' },
                  ]}
                  value={form.visibility}
                  onChange={(value) => update('visibility', value as FormState['visibility'])}
                />
              </FormField>

              <div className="divide-y divide-line-subtle rounded-md border border-line">
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div>
                    <p className="text-[0.8125rem] text-fg">启用通知</p>
                    <p className="text-2xs text-fg-3">项目内有变更时通过邮件通知成员</p>
                  </div>
                  <Switch
                    checked={form.notifications}
                    onChange={(value) => update('notifications', value)}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div>
                    <p className="text-[0.8125rem] text-fg">自动归档</p>
                    <p className="text-2xs text-fg-3">连续 90 天无活跃时自动归档</p>
                  </div>
                  <Switch
                    checked={form.autoArchive}
                    onChange={(value) => update('autoArchive', value)}
                    disabled={form.visibility === 'public'}
                  />
                </div>
              </div>

              {form.visibility === 'public' && (
                <Alert tone="warning" compact title="公开项目不支持自动归档">
                  公开项目可能被外部引用，归档会破坏链接可用性，请手动管理。
                </Alert>
              )}

              <FormField label="存储配额" hint="达到上限后将停止写入，仅保留读取">
                <Slider
                  value={form.quota}
                  onChange={(value) => update('quota', value)}
                  min={10}
                  max={500}
                  step={10}
                  formatValue={(value) => `${value} GB`}
                  showValue
                />
              </FormField>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-3">
          <SectionCard title="创建进度" description="完成度越高，项目越容易被协作">
            <div className="p-4">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-2xl font-semibold text-fg tabular-nums">{completion}%</span>
                <span className="text-2xs text-fg-3">4 项必填</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${completion}%` }}
                />
              </div>
              <ul className="mt-3 space-y-1.5">
                {[
                  { label: '填写项目名称', done: Boolean(form.name) },
                  { label: '设置唯一标识', done: Boolean(form.slug) },
                  { label: '补充项目描述', done: Boolean(form.description) },
                  { label: '添加至少一个标签', done: form.tags.length > 0 },
                ].map((item) => (
                  <li key={item.label} className="flex items-center gap-2 text-xs">
                    {item.done ? (
                      <CircleCheck className="size-3.5 shrink-0 text-success" />
                    ) : (
                      <CircleAlert className="size-3.5 shrink-0 text-fg-4" />
                    )}
                    <span className={cn(item.done ? 'text-fg-2' : 'text-fg-3', 'truncate')}>
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </SectionCard>

          <SectionCard title="表单即代码" description="校验规则集中管理">
            <div className="p-3">
              <CodeBlock
                language="tsx"
                filename="校验函数"
                maxHeight={280}
                code={`const validate = () => {
  const next: Record<string, string> = {}
  if (!form.name.trim()) next.name = '请填写项目名称'
  if (!/^[a-z][a-z0-9-]{2,30}$/.test(form.slug))
    next.slug = '仅支持小写字母、数字与中划线'
  setErrors(next)
  return Object.keys(next).length === 0
}`}
              />
            </div>
          </SectionCard>

          <SectionCard title="快捷操作">
            <div className="flex flex-col gap-2 p-3">
              <Button
                variant="secondary"
                block
                leftIcon={<WandSparkles className="size-3.5" />}
                onClick={() => {
                  setForm({
                    ...INITIAL,
                    name: '用户增长中心',
                    slug: 'growth-center',
                    description: '承载拉新、激活与留存策略的统一项目。',
                    tags: ['增长', '核心'],
                  })
                  setErrors({})
                  toast.success('已填充示例数据')
                }}
              >
                填充示例数据
              </Button>
              <Button
                variant="ghost"
                block
                leftIcon={<CirclePlus className="size-3.5" />}
                onClick={() => toast.info('演示环境：新建分支')}
              >
                新建环境分支
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="重置表单"
        description="确认清空当前已填写的内容吗？"
        confirmText="重置"
        onConfirm={() => {
          setForm(INITIAL)
          setErrors({})
          setConfirmOpen(false)
          toast.success('表单已重置')
        }}
      />
    </PageContainer>
  )
}

function TagInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const field = useFieldContext()
  const [draft, setDraft] = useState('')

  const commit = () => {
    const tag = draft.trim()
    if (!tag) return
    if (value.length >= 5) {
      toast.warning('最多添加 5 个标签')
      return
    }
    if (value.includes(tag)) {
      setDraft('')
      return
    }
    onChange([...value, tag])
    setDraft('')
  }

  return (
    <div className="focus-within:ring-primary-ring flex min-h-[var(--n-control-h)] flex-wrap items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 focus-within:border-primary/70 focus-within:ring-2">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex h-5 items-center gap-1 rounded-sm bg-primary-weak px-1.5 text-2xs text-primary"
        >
          {tag}
          <button
            type="button"
            aria-label={`移除 ${tag}`}
            onClick={() => onChange(value.filter((item) => item !== tag))}
            className="opacity-60 hover:opacity-100"
          >
            <Trash className="size-2.5" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        aria-labelledby={field?.labelledBy}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault()
            commit()
          }
          if (event.key === 'Backspace' && !draft && value.length > 0) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={commit}
        placeholder={value.length === 0 ? '输入后回车添加' : ''}
        className="h-6 min-w-[5rem] flex-1 bg-transparent text-[0.8125rem] text-fg outline-none placeholder:text-fg-4"
      />
    </div>
  )
}
