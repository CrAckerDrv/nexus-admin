import { ArrowRight, Boxes, Component, Layers, Palette, ShieldCheck } from 'lucide-react'
import { Badge, Button, CodeBlock, Descriptions, SectionCard, Tabs } from '@nexus/ui'
import { useAppNavigate } from '@/components/app-link'
import {
  CodeTabs,
  FileRef,
  GuideNext,
  GuideNote,
  GuidePage,
  GuideSection,
  GuideStep,
  Level,
} from '../components'

/**
 * 组件库 @nexus/ui
 *
 * 这一页回答三个问题：
 * 1. 这 50+ 组件凭什么「零依赖」——它到底依赖了什么
 * 2. 为什么同一套组件能同时支持受控/非受控、深浅色、密度、圆角、RTL
 * 3. 想加一个组件、改一条令牌，要动哪几个文件
 *
 * 组件清单不在这里重复（`/components/overview` 的橱窗页更直观），
 * 这一页讲的是**结构**与**约定**。
 */

const TOC = [
  { id: 'what', label: '0. 它是什么' },
  { id: 'structure', label: '1. 目录结构' },
  { id: 'tokens', label: '2. 设计令牌' },
  { id: 'controlled', label: '3. 受控双模' },
  { id: 'labels', label: '4. 文案注入' },
  { id: 'a11y', label: '5. 无障碍' },
  { id: 'add', label: '6. 新增组件' },
  { id: 'rules', label: '7. 约定与禁忌' },
]

const PACKAGE = `packages/ui/
├── package.json          peer: react / react-dom；dep: clsx / tailwind-merge
└── src/
    ├── index.ts          ★ 唯一的公开出口（显式列举，不用 export *）
    ├── components/       27 个文件 + media/ 子目录（图片 / 视频 / 音频 + 四种编辑器）
    ├── lib/
    │   ├── utils.ts      cn / format* / copyText / debounce / fuzzyMatch
    │   ├── hooks.ts      useControllableState / useMediaQuery / useHotkey / …
    │   └── scale.tsx     sx / sxSize（设计像素 → rem）
    ├── canvas/           无限画布子系统（相机 / 剔除 / 连线 / 节点 AI）
    └── styles/tokens.css ★ 设计令牌 + Tailwind 主题映射`

const DEPS = `// 真正的运行时依赖只有两个「无渲染」小库
clsx           1.6 kB   条件类名
tailwind-merge 7 kB     同属性类名后者覆盖前者（cn 的实现）

// peerDependencies（由宿主提供）
react / react-dom

// 不存在的东西
✗ antd / element-plus / radix / headless-ui
✗ styled-components / emotion（样式全是 Tailwind 原子类 + CSS 变量）
✗ 图标库（用宿主自己的 lucide-react；画布另有 30 个内置 SVG 图标）`

const TOKENS = `/* 1. 语义变量：组件只消费这些名字，从不写死颜色 */
:root {
  --n-surface: #ffffff;
  --n-fg: #1d2129;
  --n-border: #e4e6eb;
  --n-primary: #0d6efd;
  --n-radius: 8px;
  --n-control-h: 34px;
}

.dark {
  --n-surface: #151a22;
  --n-fg: #eef1f6;
}

[data-accent='violet'] { --n-primary: #7c3aed; }
[data-radius='large']  { --n-radius: 14px; }
[data-density='compact'] { --n-control-h: 30px; }

/* 2. 注册进 Tailwind 主题 → 生成 bg-surface / text-fg-2 / border-line 等工具类 */
@theme inline {
  --color-surface: var(--n-surface);
  --color-fg: var(--n-fg);
  --color-line: var(--n-border);
  --color-primary: var(--n-primary);
}`

const TOKEN_USAGE = `// ✅ 组件里只写语义类名
<div className="rounded-md border border-line bg-surface text-fg-2" />

// ✅ 需要计算尺寸时用令牌变量
<div style={{ height: 'var(--n-control-h)' }} />

// ❌ 不要在组件里写具体色值或 --n-* 之外的颜色
<div className="bg-[#0d6efd]" />
<div style={{ color: '#86909c' }} />`

const CONTROLLED = `// 所有带状态的组件都走同一个 hook：value + defaultValue 双模
import { useControllableState } from '../lib/hooks'

export function Switch({ checked, defaultChecked = false, onChange, ...rest }: SwitchProps) {
  const [value, setValue] = useControllableState({
    value: checked,
    defaultValue: defaultChecked,
    onChange,
  })
  return <button role="switch" aria-checked={value} onClick={() => setValue(!value)} {...rest} />
}

// 宿主侧两种用法都对：
<Switch defaultChecked />                 // 非受控
<Switch checked={on} onChange={setOn} />  // 受控`

const CONTROLLED_LIST = `受控 / 非受控双模
  Switch  Checkbox  RadioGroup  Tabs  Select  Slider
  SegmentedControl  Collapse  Tree  Dropdown

纯受控（必须自己给 value + onChange）
  SearchInput  ConfirmDialog  SlidingTabs  Dialog  Drawer
  InfiniteCanvas 的 selection / camera 可选受控`

const LABELS = `// 组件库不反向依赖应用的 i18n：内置中文只是缺省值
import { configureUILabels, useUILabels, DEFAULT_UI_LABELS } from '@nexus/ui'

// 应用启动时注入一次（本仓库在 routes/root.tsx 的 effect 里）
configureUILabels({
  copy: t('common.copy'),
  copied: t('common.copied'),
  search: t('common.search'),
  empty: t('common.empty'),
  selectedCount: (n) => t('common.selected', { n }),
})

// 组件内部订阅（useSyncExternalStore，切语言即时生效，不需要 Provider）
const L = useUILabels()
return <button>{copied ? L.copied : L.copy}</button>`

const A11Y = `// 不是「有空再加」的装饰，而是每条都要满足：
Dialog / Drawer       焦点陷阱 + ESC + 滚动锁 + aria-modal + 关闭后焦点归还
Select                role=combobox + aria-activedescendant + ↑↓ / Home / End
Tree                  完整 WAI-ARIA tree 键盘导航（含展开/折叠/选中）
Tabs                  role=tablist + ←→ 循环切换 + aria-controls
Slider                ←→ / ↑↓ 步进 + aria-valuetext（自定义格式时）
FormField             自动下发 id / aria-describedby / aria-invalid / aria-required
toast                 role=status + aria-live，同 id 复用避免刷屏
Table 固定列          sticky 实现，不复制 DOM（避免重复朗读）`

const ADD_COMPONENT = `// 1) 新建 packages/ui/src/components/xxx.tsx
import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

export interface XxxProps {
  children: ReactNode
  tone?: 'primary' | 'neutral'
  className?: string
}

export function Xxx({ children, tone = 'neutral', className }: XxxProps) {
  return (
    <div className={cn('rounded-md border border-line bg-surface px-3 py-2', tone === 'primary' && 'text-primary', className)}>
      {children}
    </div>
  )
}

// 2) 在 packages/ui/src/index.ts 显式导出（值 + 类型分开写）
export { Xxx } from './components/xxx'
export type { XxxProps } from './components/xxx'

// 3) 在橱窗页登记一条（apps/admin/src/modules/components/gallery/*.tsx）
{
  key: 'xxx',
  name: 'Xxx',
  nameZh: '示例',
  summary: '一句话说明它解决什么问题',
  demo: XxxDemo,      // 无 props 的组件，可以写 hooks
  code: '<Xxx>内容</Xxx>',
  props: [{ name: 'tone', type: "'primary' | 'neutral'", desc: '语义色' }],
}`

const RULES: Array<[string, string]> = [
  ['只消费语义类名', '颜色 / 圆角 / 控件高度一律走 --n-* 变量，否则主题面板与深浅色会失效。'],
  ['不引入第三方 UI 依赖', '需要新能力就手写；这决定了包体与「换框架只改装配层」的可行性。'],
  ['不反向依赖应用', '组件库不认识路由、i18n、core/http；文案走 configureUILabels，跳转走回调。'],
  ['导出必须显式列举', 'index.ts 不用 export *：画布内核里也有 clamp 这类通用名，通配导出会撞名。'],
  ['样式入口只 import 一次', '应用入口 import tokens.css；组件里不要各自 import 样式。'],
  ['动画尊重减少动效', '所有位移/循环动画在 prefers-reduced-motion 与 data-motion 下都要降级。'],
  [
    'Portal 与定位',
    'Dialog / Drawer / Dropdown 走 createPortal；Tooltip 用 fixed 就地渲染，祖先有 transform 会跑位。',
  ],
  ['不写死中文之外的文案', '默认中文可以，但必须能被 configureUILabels 覆盖。'],
]

const TEST = `// 组件测试在 packages/ui/src/__tests__/，用 Testing Library + jsdom
pnpm --filter @nexus/ui test        # 82 个用例

// 约定：断言「用户能看到的行为」，不断言内部类名
it('Switch 点击后触发 onChange', async () => {
  const onChange = vi.fn()
  render(<Switch defaultChecked={false} onChange={onChange} label="启用" />)
  await userEvent.click(screen.getByRole('switch'))
  expect(onChange).toHaveBeenCalledWith(true)
})`

export default function GuideUiKitPage() {
  const navigate = useAppNavigate()

  return (
    <GuidePage
      title="组件库 @nexus/ui"
      subtitle="50+ 手写组件、零第三方 UI 依赖、一套设计令牌驱动深浅色 / 配色 / 圆角 / 密度 / RTL。这一页讲它的结构、约定与「怎么加一个组件」，组件长什么样请看组件总览。"
      toc={TOC}
      actions={
        <>
          <Badge tone="primary" variant="outline" size="sm">
            zero-deps
          </Badge>
          <Button
            size="sm"
            variant="primary"
            rightIcon={<ArrowRight className="size-3.5" />}
            onClick={() => navigate('/components/overview')}
          >
            打开组件总览
          </Button>
        </>
      }
    >
      <GuideSection
        id="what"
        eyebrow="Overview"
        title={
          <span className="flex flex-wrap items-center gap-2">
            0. 它是什么 <Level value="必读" />
          </span>
        }
        description="不是「把某个 UI 库包一层」，而是一套只依赖 React + Tailwind 的组件实现；包体与样式都可控。"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            {
              icon: <Component className="size-4" />,
              title: '50+ 组件',
              desc: '从 Button 到 VirtualTable，全部手写；含无限画布与资源编辑器',
            },
            {
              icon: <Palette className="size-4" />,
              title: '令牌驱动',
              desc: '颜色 / 圆角 / 密度 / 字体全走 CSS 变量，主题面板即时生效',
            },
            {
              icon: <ShieldCheck className="size-4" />,
              title: '可访问性内置',
              desc: '焦点陷阱、键盘导航、aria 属性与滚动锁是默认而非可选',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border border-line bg-surface p-3.5">
              <span className="grid size-7 place-items-center rounded-md bg-primary-weak text-primary">
                {item.icon}
              </span>
              <p className="mt-2 text-[13px] font-medium text-fg">{item.title}</p>
              <p className="mt-1 text-2xs leading-5 text-fg-3">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <SectionCard title="目录结构" bodyClassName="p-4">
            <CodeBlock language="bash" filename="packages/ui" code={PACKAGE} maxHeight={260} />
          </SectionCard>
          <SectionCard
            title="真实依赖"
            description="零依赖说的是「零 UI 依赖」"
            bodyClassName="p-4"
          >
            <CodeBlock language="bash" filename="依赖清单" code={DEPS} maxHeight={260} />
          </SectionCard>
        </div>
      </GuideSection>

      <GuideSection
        id="structure"
        eyebrow="Layout"
        title="1. 目录结构与出口策略"
        description="index.ts 显式列举每一个导出：可读、可审、不会因为内部改名而意外暴露。"
      >
        <CodeTabs
          filename="packages/ui/src/index.ts"
          tabs={[
            {
              key: 'sample',
              label: '导出写法',
              code: `// 值导出与类型导出分开写，IDE 跳转与 tree-shaking 都更准
export { Button, ButtonGroup, buttonVariants } from './components/button'
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/button'

export { DataTable, TableToolbar, Pagination, pinnedSide, computeSticky } from './components/table'
export type { Column, DataTableProps, PaginationProps } from './components/table'

// 画布子系统集中在一个块里（含 30 个内置 SVG 图标与几何工具）
export { InfiniteCanvas, CanvasNodeFrame, CanvasAIPopover, … } from './canvas'`,
            },
            {
              key: 'why',
              label: '为什么不 export *',
              code: `// ❌ 通配导出会把这些名字一起丢进公共 API：
//   canvas/math.ts 的 clamp 与 lib/utils.ts 的 clamp
//   canvas/icons.tsx 的 30 个 SVG 组件
// 结果：外部 import { clamp } 拿到哪个取决于导出顺序，且包体更难摇树。

// ✅ 显式列举 = 公共契约可被 review，内部工具改名不影响使用者。`,
            },
          ]}
        />
        <div className="space-y-1.5">
          <FileRef path="packages/ui/src/index.ts" note="唯一公开出口（324 行，全部显式）" />
          <FileRef
            path="packages/ui/src/styles/tokens.css"
            note="设计令牌 + @theme 映射 + 关键帧"
          />
          <FileRef path="packages/ui/src/lib/hooks.ts" note="10 个 hooks + 文案注入" />
          <FileRef path="packages/ui/src/lib/scale.ts" note="设计像素 → rem" />
        </div>
      </GuideSection>

      <GuideSection
        id="tokens"
        eyebrow="Tokens"
        title={
          <span className="flex flex-wrap items-center gap-2">
            2. 设计令牌 <Level value="必读" />
          </span>
        }
        description="三层：语义变量 → Tailwind 主题映射 → 组件类名。改主题只动第一层。"
      >
        <div className="space-y-3">
          <div className="space-y-2">
            <CodeBlock filename="tokens.css（节选）" code={TOKENS} maxHeight={330} />
          </div>
          <div className="space-y-2">
            <CodeBlock filename="组件里的写法" code={TOKEN_USAGE} maxHeight={330} />
          </div>
        </div>

        <SectionCard title="令牌清单" description="改主题只需要知道这几组" bodyClassName="px-0">
          <Descriptions
            className="p-4"
            columns={2}
            size="sm"
            items={[
              { label: '表面', value: '--n-bg / --n-surface / --n-surface-2 / --n-surface-3' },
              { label: '文本', value: '--n-fg / --n-fg-2 / --n-fg-3 / --n-fg-4 / --n-fg-inverse' },
              { label: '描边', value: '--n-border / --n-border-strong / --n-border-subtle' },
              { label: '品牌', value: '--n-primary / -hover / -active / -weak / -ring' },
              {
                label: '语义',
                value: '--n-success / --n-warning / --n-danger / --n-info（各带 -weak）',
              },
              { label: '图表', value: '--n-chart-1 … --n-chart-6' },
              { label: '形状', value: '--n-radius / -sm / -lg / -xl，由 data-radius 覆盖' },
              {
                label: '密度',
                value: '--n-control-h / -sm / -lg、--n-row-h，由 data-density 覆盖',
              },
              { label: '布局', value: '--n-sidebar-w / --n-header-h / --n-sidebar-duration' },
              { label: '阴影', value: '--n-shadow-xs / -sm / -md / -lg / -xl' },
            ]}
          />
        </SectionCard>

        <GuideNote tone="warn" title="深色模式下最容易踩的一条">
          不要写 <code className="font-mono">bg-white</code> 或{' '}
          <code className="font-mono">text-black</code>：它们在深色主题下不会自动反转。 用{' '}
          <code className="font-mono">bg-surface</code> / <code className="font-mono">text-fg</code>
          ，这两个变量在 <code className="font-mono">.dark</code> 下有另一组值。
        </GuideNote>
      </GuideSection>

      <GuideSection
        id="controlled"
        eyebrow="Controlled"
        title="3. 受控 / 非受控双模"
        description="一个 hook 解决「组件既想自己管状态，又想让外部接管」这个经典矛盾。"
      >
        <div className="space-y-3">
          <SectionCard title="实现" bodyClassName="p-4">
            <CodeBlock filename="lib/hooks.ts" code={CONTROLLED} maxHeight={280} />
          </SectionCard>
          <SectionCard title="覆盖范围" bodyClassName="p-4">
            <CodeBlock language="bash" filename="双模清单" code={CONTROLLED_LIST} maxHeight={280} />
          </SectionCard>
        </div>
        <GuideNote tone="tip" title="受控时忘了给 onChange">
          传了 <code className="font-mono">value</code> 却不传{' '}
          <code className="font-mono">onChange</code>，组件会「点不动」——
          这是设计使然：受控组件不该偷偷改自己的状态。开发时如果发现某个开关没反应，先检查这一点。
        </GuideNote>
      </GuideSection>

      <GuideSection
        id="labels"
        eyebrow="Labels"
        title="4. 组件文案注入"
        description="组件库不能反向依赖应用的 i18n，所以内置中文只是缺省值，由应用注入真实语言。"
      >
        <CodeBlock filename="configureUILabels / useUILabels" code={LABELS} maxHeight={300} />
        <GuideNote tone="tip" title="为什么不直接内置双语">
          内置双语会把「语言判断」固化进组件库，一旦应用要做第三种语言或按租户切换文案，
          就得改组件。注入式把决策留给应用，组件只负责用。
        </GuideNote>
      </GuideSection>

      <GuideSection
        id="a11y"
        eyebrow="A11y"
        title="5. 无障碍与交互细节"
        description="这些默认行为是组件库价值的一半——自己写一个能看的下拉很容易，写一个键盘可用的不简单。"
      >
        <CodeBlock language="bash" filename="已内置" code={A11Y} maxHeight={320} />
      </GuideSection>

      <GuideSection
        id="add"
        eyebrow="Extend"
        title={
          <span className="flex flex-wrap items-center gap-2">
            6. 新增组件 <Level value="进阶" />
          </span>
        }
        description="三步：写组件 → 显式导出 → 橱窗登记。第三步不是可选项——没有橱窗的组件等于没有文档。"
      >
        <GuideStep
          index={1}
          title="写组件"
          description="只消费语义类名，状态走 useControllableState"
        >
          <CodeBlock filename="components/xxx.tsx" code={ADD_COMPONENT} maxHeight={460} />
        </GuideStep>

        <GuideStep index={2} title="补测试" description="断言用户可见行为，不断言内部类名">
          <CodeBlock filename="__tests__/xxx.test.tsx" code={TEST} maxHeight={220} />
        </GuideStep>

        <GuideStep
          index={3}
          title="登记到橱窗"
          description="在对应分类文件里加一条；页面本身零改动"
        >
          <FileRef path="apps/admin/src/modules/components/gallery/basic.tsx" note="基础类" />
          <FileRef path="apps/admin/src/modules/components/gallery/form.tsx" note="表单类" />
          <FileRef path="apps/admin/src/modules/components/gallery/data.tsx" note="数据展示" />
          <FileRef path="apps/admin/src/modules/components/gallery/charts.tsx" note="图表封装" />
          <FileRef
            path="apps/admin/src/modules/components/gallery/feedback.tsx"
            note="反馈与弹层"
          />
          <FileRef
            path="apps/admin/src/modules/components/gallery/more.tsx"
            note="导航 / 布局 / 工具 / 高级视觉"
          />
          <FileRef path="apps/admin/src/modules/components/gallery/canvas.tsx" note="无限画布" />
          <FileRef
            path="apps/admin/src/modules/components/gallery/runtime.tsx"
            note="Hooks 与工具函数"
          />
        </GuideStep>
      </GuideSection>

      <GuideSection
        id="rules"
        eyebrow="Rules"
        title="7. 约定与禁忌"
        description="下面每条都对应过一次真实返工，建议直接当 code review 清单。"
      >
        <div className="space-y-2">
          {RULES.map(([title, body], index) => (
            <div
              key={title}
              className="flex items-start gap-2.5 rounded-md border border-line bg-surface px-3 py-2.5"
            >
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[10px] font-semibold text-fg-3 tabular-nums">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-fg">{title}</p>
                <p className="mt-0.5 text-2xs leading-5 text-fg-3">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <Tabs
          variant="line"
          defaultValue="check"
          items={[
            {
              key: 'check',
              label: '提交前自查',
              content: (
                <Descriptions
                  size="sm"
                  columns={2}
                  items={[
                    { label: '类型', value: 'pnpm --filter @nexus/ui typecheck' },
                    { label: '测试', value: 'pnpm --filter @nexus/ui test' },
                    { label: 'Lint', value: 'pnpm lint（0 error）' },
                    { label: '橱窗', value: '新组件在 /components/overview 能看到' },
                    { label: '深浅色', value: '切换主题后没有写死的色块' },
                    { label: '键盘', value: 'Tab 能到、Esc 能关、方向键能走' },
                  ]}
                />
              ),
            },
            {
              key: 'size',
              label: '包体检查',
              content: (
                <div className="space-y-2 text-xs leading-6 text-fg-2">
                  <p>
                    组件库是源码直引（workspace），没有独立产物；它的体积会直接进应用的{' '}
                    <code className="font-mono">index-*.js</code>。
                  </p>
                  <p>
                    因此新增依赖前先问：这个能力能不能用 20 行手写替代？现在的真实依赖只有{' '}
                    <code className="font-mono">clsx</code> 与{' '}
                    <code className="font-mono">tailwind-merge</code>，两者加起来不到 9 kB。
                  </p>
                  <p className="text-fg-3">
                    ECharts 这类「大且只在个别页面用」的库不进组件库，而是应用层的懒加载封装
                    （见「图表封装」分类）。
                  </p>
                </div>
              ),
            },
          ]}
        />
      </GuideSection>

      <GuideNext to="/guide/module" label="新增模块" desc="把组件组装成业务页面，并挂到侧边栏" />
    </GuidePage>
  )
}

/* 让未被条目直接引用的图标保持可读：本页只用三个统计卡图标 */
void Boxes
void Layers
