import { useState } from 'react'
import {
  Button,
  CodeBlock,
  Input,
  SegmentedControl,
  cn,
  copyText,
  debounce,
  fuzzyMatch,
  randomId,
  toast,
  useBreakpoint,
  useClickOutside,
  useControllableState,
  useCountdown,
  useElementSize,
  useHotkey,
  useLocalStorageState,
  useMediaQuery,
} from '@nexus/ui'
import type { GalleryCategory } from './types'

/* ================================================================== *
 * Hooks 与工具函数
 *
 * 组件橱窗不只是「看得见的组件」：@nexus/ui 还导出了一整套 hooks、
 * 纯函数与设计缩放工具，它们决定了组件为什么能同时支持受控/非受控、
 * 为什么宽屏下数字尺寸不会变形。这一组用「可操作的迷你演示 + 真实返回值」
 * 把它们展示出来，避免读者只能去翻源码。
 * ================================================================== */

/* ------------------------------ 1. 受控 / 非受控 ------------------------------ */

function ControllableDemo() {
  // 不传 value：内部自管；传 value：完全由外部决定
  const [outer, setOuter] = useState(2)
  const [inner, setInner] = useControllableState({ defaultValue: 1 })
  const step = useControllableState({ value: outer, defaultValue: 2, onChange: setOuter })

  return (
    <div className="w-full space-y-2.5 text-xs text-fg-2">
      <div className="flex items-center gap-2">
        <span className="w-32 text-fg-3">非受控</span>
        <Button size="xs" variant="secondary" onClick={() => setInner(inner + 1)}>
          +1
        </Button>
        <span className="font-mono text-fg tabular-nums">{inner}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-32 text-fg-3">受控</span>
        <Button size="xs" variant="secondary" onClick={() => step[1]((prev) => prev + 1)}>
          +1
        </Button>
        <span className="font-mono text-fg tabular-nums">{step[0]}</span>
        <Button size="xs" variant="ghost" onClick={() => setOuter(0)}>
          外部重置
        </Button>
      </div>
      <p className="text-2xs leading-5 text-fg-4">
        组件的 Switch / Tabs / Select / Slider / Collapse / Tree 都是它实现的双模支持。
      </p>
    </div>
  )
}

/* ------------------------------ 2. 断点与媒体查询 ------------------------------ */

function BreakpointDemo() {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const { isMobile: mobile, isTablet, isDesktop } = useBreakpoint()
  return (
    <div className="w-full space-y-2 text-xs">
      <div className="flex flex-wrap gap-1.5">
        {[
          { label: 'mobile ≤767', on: mobile },
          { label: 'tablet ≤1023', on: isTablet },
          { label: 'desktop ≥1280', on: isDesktop },
        ].map((item) => (
          <span
            key={item.label}
            className={cn(
              'rounded-sm border px-2 py-1 font-mono text-2xs',
              item.on ? 'border-primary/40 bg-primary-weak text-primary' : 'border-line text-fg-4',
            )}
          >
            {item.label}
          </span>
        ))}
      </div>
      <p className="font-mono text-2xs text-fg-4">
        useMediaQuery('(max-width: 767px)') → {String(isMobile)}
      </p>
      <p className="text-2xs leading-5 text-fg-4">缩放浏览器窗口，上面的徽标会实时切换。</p>
    </div>
  )
}

/* ------------------------------ 3. 点击外部 ------------------------------ */

function ClickOutsideDemo() {
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open)
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <Button variant="secondary" size="sm" onClick={() => setOpen((prev) => !prev)}>
        {open ? '已打开，点空白处关闭' : '点我打开'}
      </Button>
      <div
        ref={ref}
        className={cn(
          'w-full max-w-[240px] rounded-md border px-3 py-2 text-center text-2xs transition-colors',
          open ? 'border-primary/40 bg-primary-weak text-primary' : 'border-line text-fg-4',
        )}
      >
        {open ? '这是一个会自己关掉的浮层' : '浮层已关闭'}
      </div>
    </div>
  )
}

/* ------------------------------ 4. 尺寸观察 ------------------------------ */

function ElementSizeDemo() {
  const [ref, size] = useElementSize<HTMLDivElement>()
  return (
    <div className="w-full space-y-2">
      <div
        ref={ref}
        className="grid h-20 w-full place-items-center rounded-md border border-dashed border-line bg-surface-2/40 text-2xs text-fg-3"
      >
        拖窗口改变宽度
      </div>
      <p className="font-mono text-2xs text-fg-2 tabular-nums">
        width {Math.round(size.width)} · height {Math.round(size.height)}
      </p>
      <p className="text-2xs leading-5 text-fg-4">
        useElementSize 内部是 useResizeObserver；画布、虚拟表格与迷你趋势线都靠它拿真实尺寸。
      </p>
    </div>
  )
}

/* ------------------------------ 5. 本地存储 / 倒计时 ------------------------------ */

function StorageDemo() {
  const [text, setText] = useLocalStorageState('nexus-gallery-demo', '刷新页面我还在')
  const { remaining, start, stop } = useCountdown(5000)
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2">
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="会自动写入 localStorage"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="xs" variant="secondary" onClick={start}>
          开始 5s 倒计时
        </Button>
        <Button size="xs" variant="ghost" onClick={stop}>
          停止
        </Button>
        <span className="font-mono text-2xs text-fg-2 tabular-nums">
          {(remaining / 1000).toFixed(1)}s
        </span>
      </div>
      <p className="text-2xs leading-5 text-fg-4">
        useLocalStorageState 的 key 是 nexus-gallery-demo：刷新页面后文本仍在（清空即恢复默认）。
      </p>
    </div>
  )
}

/* ------------------------------ 6. 快捷键 ------------------------------ */

function HotkeyDemo() {
  const [count, setCount] = useState(0)
  useHotkey('mod+shift+g', () => {
    setCount((prev) => prev + 1)
    toast.info(`已触发 ${count + 1} 次`)
  })
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs text-fg-2">
        按下
        <kbd className="rounded-sm border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-2xs">
          Ctrl/⌘ + Shift + G
        </kbd>
      </span>
      <span className="font-mono text-lg font-semibold text-fg tabular-nums">{count}</span>
      <span className="text-2xs text-fg-4">mod = Ctrl 或 ⌘，跨平台同一份写法</span>
    </div>
  )
}

/* ------------------------------ 7. 设计缩放 ------------------------------ */

function DesignScaleDemo() {
  return (
    <div className="w-full space-y-2.5 text-xs">
      <div className="flex items-end gap-2">
        <div className="w-10 rounded-sm bg-primary-weak" style={{ height: 'var(--demo-40)' }}>
          <span className="block pt-1 text-center font-mono text-[0.625rem] text-primary">40</span>
        </div>
        <CodeBlock
          className="min-w-0 flex-1"
          showLineNumbers={false}
          maxHeight={120}
          code={`// 设计稿按 1440 宽、根字号 16px 标注
style={{ height: sx(40) }}   // 40px；数字尺寸统一走 sx()

// rem 与 px 在此等价（根字号恒 16px），
// 好处是尺寸只写一处，未来要调节奏时不必满项目改 px`}
        />
      </div>
      <p className="text-2xs leading-5 text-fg-4">
        组件的数字尺寸（图表高度、头像大小、列宽）都是设计像素，交给 sx() 转 rem 统一单位。
      </p>
    </div>
  )
}

/* ------------------------------ 8. 纯函数 ------------------------------ */

function UtilsDemo() {
  const [keyword, setKeyword] = useState('yhs')
  const isActive = keyword.length > 0
  const samples = [
    { label: 'cn(...)', value: cn('px-2', isActive && 'text-primary', 'text-xs') },
    { label: 'randomId()', value: randomId('page') },
    { label: 'fuzzyMatch(用户管理, yhs)', value: String(fuzzyMatch('用户管理', 'yhs')) },
    { label: 'fuzzyMatch(用户管理, abc)', value: String(fuzzyMatch('用户管理', 'abc')) },
  ]
  const debounced = debounce(() => toast.info('防抖 400ms 后才执行'), 400)

  return (
    <div className="w-full space-y-2.5">
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {samples.map((item) => (
          <div key={item.label} className="rounded-md border border-line px-2 py-1.5">
            <p className="font-mono text-2xs text-fg-4">{item.label}</p>
            <p className="truncate font-mono text-2xs text-fg-2">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="输入拼音首字母试 fuzzyMatch"
          className="max-w-[180px]"
        />
        <Button
          size="xs"
          variant="secondary"
          onClick={() => {
            void copyText('已复制到剪贴板').then((ok) => {
              if (ok) toast.success('copyText 成功')
            })
          }}
        >
          copyText()
        </Button>
        <Button size="xs" variant="outline" onClick={debounced}>
          debounce(400ms)
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------ 9. 组件文案 ------------------------------ */

function LabelsDemo() {
  const [locale, setLocale] = useState<'zh' | 'en'>('zh')
  return (
    <div className="w-full space-y-2.5">
      <SegmentedControl
        size="sm"
        value={locale}
        onChange={setLocale}
        options={[
          { label: '中文', value: 'zh' },
          { label: 'English', value: 'en' },
        ]}
      />
      <CodeBlock
        showLineNumbers={false}
        maxHeight={130}
        code={`// 应用启动时按当前语言注入一次（routes/root.tsx 里已接好）
configureUILabels({
  copy: '复制', copied: '已复制', search: '搜索', empty: '暂无数据',
})

// 组件内部用 useSyncExternalStore 订阅，切语言即时生效且不需要 Provider`}
      />
      <p className="text-2xs leading-5 text-fg-4">
        当前演示只是展示契约：真实切换请用顶栏语言按钮（{locale === 'zh' ? '中文' : 'English'}{' '}
        状态下整站文案会一起变）。
      </p>
    </div>
  )
}

export const runtimeCategory: GalleryCategory = {
  id: 'runtime',
  name: 'Hooks',
  title: 'Hooks 与工具',
  description: '受控状态、断点、点击外部、尺寸观察、本地存储、倒计时、快捷键与设计缩放',
  items: [
    {
      key: 'use-controllable-state',
      name: 'useControllableState',
      nameZh: '受控状态',
      summary: '一个 hook 同时支持 value 与 defaultValue，组件不用写两套逻辑',
      demo: ControllableDemo,
      wide: true,
      previewHeight: 190,
      keywords: ['shoukong', 'controllable', 'state', 'hook'],
      code: `const [current, setCurrent] = useControllableState({
  value,                 // 传了就是受控
  defaultValue: 1,       // 没传就是非受控
  onChange,
})

setCurrent((prev) => prev + 1)`,
      props: [
        { name: 'value', type: 'T | undefined', desc: '传了即受控，组件内部不再改状态' },
        { name: 'defaultValue', type: 'T', desc: '非受控时的初始值（必填）' },
        { name: 'onChange', type: '(value: T) => void', desc: '两种模式都会回调' },
        {
          name: '返回',
          type: '[T, (next | (prev) => next) => void]',
          desc: '值与 setter，支持函数式更新',
        },
      ],
    },
    {
      key: 'use-breakpoint',
      name: 'useMediaQuery / useBreakpoint',
      nameZh: '断点',
      summary: '媒体查询与三档断点，SSR 安全（服务端返回 false）',
      demo: BreakpointDemo,
      wide: true,
      previewHeight: 180,
      keywords: ['duandian', 'breakpoint', 'media', 'responsive'],
      code: `const isMobile = useMediaQuery('(max-width: 767px)')
const { isMobile, isTablet, isDesktop } = useBreakpoint()`,
      props: [
        {
          name: 'useMediaQuery(query)',
          type: '(query: string) => boolean',
          desc: '监听任意媒体查询',
        },
        {
          name: 'useBreakpoint()',
          type: '() => { isMobile; isTablet; isDesktop }',
          desc: '≤767 / ≤1023 / ≥1280 三档',
        },
      ],
    },
    {
      key: 'use-click-outside',
      name: 'useClickOutside',
      nameZh: '点击外部',
      summary: '返回一个 ref，挂在浮层根节点上就能自动关闭',
      demo: ClickOutsideDemo,
      keywords: ['dianjiwaibu', 'dismiss', 'popover'],
      code: `const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open)

return <div ref={ref}>{open && <Popover />}</div>`,
      props: [
        { name: 'handler', type: '(event) => void', desc: '点击外部时触发' },
        { name: 'enabled', type: 'boolean', default: 'true', desc: '关闭时传 false 可暂停监听' },
        { name: '返回', type: 'RefObject<HTMLElement>', desc: '挂到浮层根节点' },
      ],
    },
    {
      key: 'use-element-size',
      name: 'useElementSize / useResizeObserver',
      nameZh: '尺寸观察',
      summary: '拿真实像素尺寸：画布、虚拟表格与图表都依赖它',
      demo: ElementSizeDemo,
      wide: true,
      previewHeight: 200,
      keywords: ['chicun', 'size', 'resize', 'observer'],
      code: `const [ref, { width, height }] = useElementSize<HTMLDivElement>()
const canvasRef = useResizeObserver<HTMLCanvasElement>((entry) => redraw(entry))`,
      props: [
        {
          name: 'useElementSize()',
          type: '() => [ref, {width, height}]',
          desc: 'contentRect 尺寸（不含滚动条）',
        },
        {
          name: 'useResizeObserver(cb)',
          type: '(cb) => ref',
          desc: '拿到原始 ResizeObserverEntry',
        },
      ],
    },
    {
      key: 'use-local-storage',
      name: 'useLocalStorageState / useCountdown',
      nameZh: '本地存储 / 倒计时',
      summary: '持久化状态与毫秒倒计时，粘性面板宽度、验证码重发都用它',
      demo: StorageDemo,
      wide: true,
      previewHeight: 210,
      keywords: ['bendi', 'localstorage', 'daojishi', 'countdown'],
      code: `const [text, setText] = useLocalStorageState('my-key', '默认值')
const { remaining, start, stop } = useCountdown(5000)`,
      props: [
        {
          name: 'useLocalStorageState(key, init)',
          type: '(string, T) => [T, setter]',
          desc: 'JSON 序列化；解析失败回退初始值',
        },
        {
          name: 'useCountdown(ms)',
          type: '(number) => { remaining; start; stop }',
          desc: 'remaining 单位毫秒，每秒递减',
        },
      ],
    },
    {
      key: 'use-hotkey',
      name: 'useHotkey',
      nameZh: '快捷键',
      summary: 'mod 同时映射 Ctrl 与 ⌘，命令面板与画布快捷键都基于它',
      demo: HotkeyDemo,
      previewHeight: 170,
      keywords: ['kuaijiejian', 'hotkey', 'shortcut'],
      code: `useHotkey('mod+k', () => setOpen(true))
useHotkey('mod+shift+g', handler, { enabled: canEdit })`,
      props: [
        { name: 'combo', type: 'string', desc: "如 'mod+k' / 'shift+alt+z'；mod = Ctrl | ⌘" },
        { name: 'handler', type: '(event) => void', desc: '命中时调用，已 preventDefault' },
        { name: 'options.enabled', type: 'boolean', default: 'true', desc: '条件注册' },
      ],
    },
    {
      key: 'design-scale',
      name: 'sx / 设计像素',
      nameZh: '设计像素',
      summary: '数字尺寸 = 设计像素，sx() 统一转 rem',
      demo: DesignScaleDemo,
      wide: true,
      previewHeight: 200,
      keywords: ['suofang', 'scale', 'rem', 'sx'],
      code: `import { sx, sxSize, DESIGN_ROOT_FONT } from '@nexus/ui'

<div style={{ height: sx(340) }} />   // 340px
<Drawer width={sxSize(420)} />        // 420px`,
      props: [
        { name: 'sx(px)', type: '(number) => string', desc: '设计像素 → rem 字符串' },
        {
          name: 'sxSize(size)',
          type: '(number | string) => string',
          desc: '数字走 sx()，字符串原样返回',
        },
        { name: 'DESIGN_ROOT_FONT', type: 'number', desc: '设计基准 16px' },
      ],
    },
    {
      key: 'utils',
      name: '工具函数',
      nameZh: '纯函数',
      summary: 'cn / copyText / randomId / debounce / clamp / fuzzyMatch / avatarColor',
      demo: UtilsDemo,
      wide: true,
      previewHeight: 230,
      keywords: ['gongju', 'utils', 'cn', 'debounce'],
      code: `cn('px-2', isActive && 'bg-primary')      // Tailwind 类名合并（后者覆盖前者）
copyText('文本')                            // Promise<boolean>，非安全上下文也能用
randomId('page')                            // page_x8f2a9c1
debounce(fn, 300)                           // 返回防抖后的函数
clamp(120, 0, 100)                          // 100
fuzzyMatch('用户管理', 'yhs')                // 子序列匹配（拼音首字母可用）
avatarColor('陈彦之')                        // 稳定的头像底色类名`,
    },
    {
      key: 'ui-labels',
      name: 'configureUILabels',
      nameZh: '组件文案',
      summary: '组件内置中文只是缺省值；应用启动时注入一次，切语言即时生效',
      demo: LabelsDemo,
      wide: true,
      previewHeight: 210,
      keywords: ['wenan', 'labels', 'i18n'],
      code: `import { configureUILabels, useUILabels, DEFAULT_UI_LABELS } from '@nexus/ui'

// 启动时按当前语言注入（routes/root.tsx 已经接好）
configureUILabels({ copy: 'Copy', copied: 'Copied', search: 'Search' })

// 组件内部
const L = useUILabels()`,
      props: [
        {
          name: 'configureUILabels(partial)',
          type: '(Partial<UILabels>) => void',
          desc: '合并式覆盖；传 DEFAULT_UI_LABELS 可恢复中文',
        },
        {
          name: 'useUILabels()',
          type: '() => UILabels',
          desc: '订阅当前文案（useSyncExternalStore）',
        },
        {
          name: 'UILabels',
          type: '{ copy; copied; search; empty; confirm; … }',
          desc: '14 个字段，含 selectedCount 这类函数型文案',
        },
      ],
    },
  ],
}
