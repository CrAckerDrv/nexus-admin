# 主题、皮肤与设计令牌

所有视觉决策集中在 `packages/ui/src/styles/tokens.css`。组件不写死颜色，只消费语义类名。

## 令牌分层

```
基础色板 + 皮肤(data-skin) + 强调色(data-accent)
        ↓
原始变量 (--n-*)
        ↓
Tailwind @theme 映射
        ↓
语义类名 (bg-surface / text-fg-2)
```

```css
:root {
  --n-surface: #ffffff; /* 原始值 */
}
@theme inline {
  --color-surface: var(--n-surface); /* 映射 */
}
```

```tsx
<div className="border-line bg-surface text-fg" /> /* 使用 */
```

## 四个正交的外观维度

| 维度   | 取值                                                      | 切换方式                                | 影响范围                             |
| ------ | --------------------------------------------------------- | --------------------------------------- | ------------------------------------ |
| 明暗   | `light` / `dark` / `system`                               | `<html class="dark">` + `data-theme`    | 整套中性色阶                         |
| 皮肤   | `cloud` / `graphite` / `sand` / `pine` / `ocean` / `neon` | `data-skin="sand"`                      | 中性色、侧栏配色、图表色板、投影     |
| 强调色 | `auto`（跟随皮肤） + 10 组预设                            | `data-accent="violet"`（`auto` 时不写） | 只覆盖品牌主色 / 图表第 1 位         |
| 调色盘 | 8 个区域 × 明暗两套                                       | `<html style="--n-*: …">` 行内变量      | 用户显式改过的区域，覆盖皮肤与强调色 |

**皮肤和强调色的分工是关键**：强调色只是「把主色换成另一个颜色」，皮肤换的是整套气质
（米色纸感 / 深色导航 / 冷灰工位 / 紫青撞色）。所以两者可以自由组合 ——
「暖砂纸 + 极光紫」和「深海 + 品牌蓝」都是合法的，面板里两个分区也分开放。

调色盘是**第三层叠加**：它只覆盖用户真正动过的区域，没动过的继续由皮肤决定，
因此「换皮肤」与「微调某几个区域」不会互相打架。

## 调色盘（按区域自定义配色）

### 为什么是「区域」而不是「变量」

设计令牌有 40+ 个 `--n-*`，让用户直接面对它们是设计失败。面板只暴露 8 个区域：

| 区域        | 写入的主变量     | 自动派生                                               |
| ----------- | ---------------- | ------------------------------------------------------ |
| 页面底色    | `--n-bg`         | `--n-bg-subtle`、`--n-surface-inset`                   |
| 卡片表面    | `--n-surface`    | `--n-surface-2/3`                                      |
| 顶栏 / 页签 | `--n-topbar-bg`  | —                                                      |
| 侧栏轨道    | `--n-sidebar-bg` | `--n-sidebar-hover/fg/fg-2/3/4/border×3/accent/active` |
| 主色        | `--n-primary`    | `--n-primary-hover/active/weak/weak-2/ring/fg`         |
| 描边        | `--n-border`     | `--n-border-strong`、`--n-border-subtle`               |
| 正文文字    | `--n-fg`         | `--n-fg-2/3/4`                                         |
| 图表        | `--n-chart-1..6` | —（六色循环）                                          |

派生规则在 `apps/admin/src/core/palette.ts`，纯函数、无依赖：

```ts
derivePaletteVars({ bg: '#eef2f8', sidebar: '#101116', primary: '#0f8fb0' }, false)
// → --n-bg / --n-bg-subtle / --n-sidebar-bg / --n-sidebar-fg(自动取浅字)
//   --n-sidebar-accent / --n-primary-hover / --n-primary-weak / --n-primary-fg …
```

几个刻意的决定：

1. **轨道与主色上的文字自动取黑 / 白**：`readableOn()` 按 WCAG 相对亮度选字色，
   于是「浅色页面 + 深色导轨」不需要用户再挑一次文字色。
2. **悬停 / 按下方向随明暗翻转**：深色下提亮、浅色下压暗。深色底上「变暗」几乎看不见。
3. **弱色 = 主色 × 卡片面混合**：换皮肤底色时弱色依然协调，不会出现「米色皮肤里一块冷蓝底」。
4. **对比度即时反馈**：主色与轨道两行会显示自动字色与该底色的对比度（`18.3:1`），
   不达 4.5:1 标黄、不达 3:1 标红 —— 配色翻车能当场看见。

### 明暗两套分开存

`palette.light` / `palette.dark` 各自独立。面板顶部可切「明色 / 暗色」预览，
**正在使用的那一套**会标出来；切换深浅色时自动换用对应的一套。
写入时显式传 `target`，避免「在暗色预览里改，结果改到了明色那套」。

### 首帧为什么不会闪

派生逻辑在 TS 里，`index.html` 的内联脚本算不出来。所以每次应用调色盘时，
`applyPalette()` 会把**明 / 暗两套已派生的成品变量**写进 `localStorage['nexus-palette-cache']`，
内联脚本只负责按当前明暗贴到 `<html style>` 上：

```js
var pal = JSON.parse(localStorage.getItem('nexus-palette-cache') || '{}')
var vars = (dark ? pal.dark : pal.light) || {}
for (var name in vars) root.style.setProperty(name, vars[name])
```

行内变量的优先级高于所有 `data-skin` / `data-accent` 选择器规则，
因此不需要 `!important`，也不需要提高特异性。

### 导出 / 导入

面板底部可「复制 JSON」把整套调色盘贴进 issue 或存成团队预设，
「导入 JSON」直接还原。JSON 形状：

```json
{
  "enabled": true,
  "light": { "bg": "#eef2f8", "primary": "#0f8fb0", "charts": ["#0f8fb0", "…"] },
  "dark": { "bg": "#04080f", "surface": "#0d1520", "primary": "#22d3ee" }
}
```

另有四个内置起点（水墨 / 午夜 / 牛皮纸 / 薄荷），以及「从当前皮肤取样」——
后者会临时摘下自定义变量、读出底层皮肤的真实配色再挂回去，
所以在自定义主题上继续取样，拿到的是皮肤而不是自己的自定义值。

## 皮肤是怎么实现的

每一套皮肤只声明变量，不写选择器：

```css
[data-skin='sand'] {
  --n-bg: #f6f0e4;
  --n-surface: #fffdf8;
  --n-border: #e5dac7;
  --n-chart-1: #c2410c;
  /* 侧栏是一块独立着色的表面 */
  --n-sidebar-bg: #fbf5e9;
  --n-sidebar-fg-2: #5a5140;
  --n-sidebar-accent: #c2410c;
  /* 暖色投影代替中性黑 */
  --n-shadow-md: 0 4px 14px -4px rgb(74 56 32 / 0.1);
}
.dark[data-skin='sand'] {
  --n-bg: #17130e;
  --n-sidebar-bg: #1d1812;
}
```

侧栏之所以能「一换皮肤就整块变色」，靠的是 `.n-sidebar` 里的**就地重映射**：

```css
.n-sidebar {
  background-color: var(--n-sidebar-bg);
  --n-surface: var(--n-sidebar-bg);
  --n-surface-2: var(--n-sidebar-hover);
  --n-fg: var(--n-sidebar-fg);
  --n-fg-3: var(--n-sidebar-fg-3);
  --n-border: var(--n-sidebar-border);
  --n-primary: var(--n-sidebar-accent);
}
```

子组件（导航项、分组标题、hover 底色、选中态、折叠后的悬浮标签）本来就在消费
`bg-surface-2 / text-fg-3 / border-line`，因此**不用给任何组件加 `isDarkRail` 分支**，
深色导航就自动成立了。

### 加一套新皮肤

1. `tokens.css` 里写 `[data-skin='x']` 与 `.dark[data-skin='x']` 两组变量（照抄最近的一套改色值即可）
2. `ui-store.ts` 的 `Skin` 联合类型加 `'x'`，`SKIN_PRESETS` 加一条（文案 + 三色圆点）
3. 完成 —— 外观面板的缩略图、系统设置页的皮肤卡片、图表色板、深浅色自动跟随

缩略图**不写任何色值**：它只是挂了 `data-skin` 的 DOM，色值由 CSS 变量提供，
所以调色只改一个文件，TS 里不会出现第二份色板。

## 其余可调维度

| 维度     | 取值                                                                  | 切换方式                  |
| -------- | --------------------------------------------------------------------- | ------------------------- |
| 圆角     | `none` / `small` / `medium` / `large` / `xlarge`                      | `data-radius="small"`     |
| 密度     | `compact` / `default` / `comfortable` / `ultra`                       | `data-density="compact"`  |
| 字体     | `auto` / `sans` / `serif` / `mono`                                    | `data-font="serif"`       |
| 菜单布局 | `vertical` / `dual` / `horizontal` / `mixed` / `floating` / `sidebar` | `data-menu-layout="dual"` |
| 整体布局 | `default` / `compact` / `fullscreen`                                  | `data-layout="compact"`   |
| 内容宽度 | `full` / `centered`                                                   | `data-content="centered"` |
| 文字方向 | `ltr` / `rtl`                                                         | `dir` 属性 + `data-dir`   |
| 动效偏好 | `system` / `full` / `reduced`                                         | `data-motion="reduced"`   |

## 外观面板为什么是右侧抽屉

1. 调外观时**页面本身就是素材**：居中对话框会把它整块盖住，只能靠小缩略图猜；
   右侧抽屉只占 404px，左侧页面保持可见，改动即时能对照真实界面。
2. 分组多、纵向内容长，居中弹窗必然内部滚动（旧版「密度」一栏就被截断）；
   抽屉占满视口高度，再用分页签拆成「基础 / 皮肤 / 布局 / 细节」四屏。
3. 顶部常驻一块**实时预览**，它消费的是当前真实令牌（含皮肤、圆角、密度），
   改动立刻可见，不必反复开关面板。
4. 抽屉用 `overlay="soft"`：只压一层极淡遮罩，页面仍可读 —— 这是「边调边看」的前提。

对应实现：`packages/ui/src/components/dialog.tsx` 的 `Drawer`（新增 `overlay` / `footerLeft` /
焦点陷阱 / 关闭后焦点归还），以及 `apps/admin/src/layout/theme-panel.tsx`。

## 动效偏好为什么需要应用内开关

很多 Windows 机器关闭了「显示动画」（`MinAnimate = 0`），Chromium 因此始终报告
`prefers-reduced-motion: reduce`。早期实现遵循媒体查询直接跳过动画，结果是
「主题切换没有任何特效、侧栏瞬移、页面硬切」。

现在的策略是三层：

1. **纯装饰的循环动画**（流光边框、跑马灯、骨架微光）在 reduce 下停止 —— 这些持续闪烁确实会让人不适
2. **有信息价值的一次性过渡**（切页、侧栏折叠、主题扩散）压缩时长但**不消失**
3. **应用内 `data-motion` 显式开关**优先级最高，用户可选「始终开启」覆盖系统偏好

## 主题切换的圆形扩散

用 View Transitions API + `clip-path: circle()` 实现，以点击位置为圆心扩散：

```ts
runThemeTransition(() => setTheme('dark'), { x, y }, /* willBeDark */ true)
```

- 时长 720ms，缓动 `cubic-bezier(0.22, 1, 0.36, 1)`
- 不支持 View Transitions 的浏览器降级到 `overlayTransition`（固定定位的遮罩层）
- reduce 环境下时长压到 420ms，仍保留圆形扩散观感

## 为什么要规避闪白

主题在 React 挂载**之前**就需要确定，否则深色模式下会有一帧白屏。`index.html`
内联脚本会同步写入 `class="dark"`、`data-skin`、`data-accent`、`data-radius` 等属性：

```html
<script>
  ;(function () {
    var raw = localStorage.getItem('nexus-ui-prefs')
    var prefs = raw ? JSON.parse(raw).data || JSON.parse(raw) : {}
    var theme = prefs.theme || 'system'
    var dark =
      theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    var root = document.documentElement
    root.classList.toggle('dark', dark)
    if (prefs.skin) root.dataset.skin = prefs.skin
    if (prefs.accent && prefs.accent !== 'auto') root.dataset.accent = prefs.accent
  })()
</script>
```

## 添加新的强调色

1. 在 `tokens.css` 增加一组变量（浅色 + 深色），顺带同步侧栏强调色：

```css
[data-accent='cyan'] {
  --n-primary: #0891b2;
  --n-primary-hover: #0e7490;
  --n-primary-weak: #e6f7fb;
  --n-primary-ring: #0891b233;
  --n-sidebar-accent: #67e8f9;
}
.dark[data-accent='cyan'] {
  --n-primary: #22d3ee;
  --n-primary-weak: #0d2830;
}
```

2. `ui-store.ts` 的 `Accent` 类型加入 `'cyan'`，并在 `ACCENT_PRESETS` 里补文案与渐变
3. 外观面板与系统设置页会自动出现这一项（两处都是从 `ACCENT_PRESETS` 派生的）

## 密度如何影响布局

```css
[data-density='compact'] {
  --n-control-h: 1.875rem;
  --n-row-h: 2.5rem;
}
```

组件里统一使用 `h-[var(--n-control-h)]`，因此密度切换后**无需重渲染任何组件**，只是 CSS 变量变了。
所有尺寸用 `rem` 书写，但根字号**恒为 16px**（`1rem = 16px`），所以 rem 在这里的作用是统一单位，
而不是随视口缩放 —— 详见下一节。

## 宽屏适配（为什么不做整体等比放大）

曾经试过让根字号随视口放大（`clamp(16px, 1.1111vw, 32px)`），让 2850 这类超宽屏
把界面等比吹大。实测不成立，两条硬原因：

1. **媒体查询里的 rem 恒按 16px 折算**，与根字号无关。所以断点不会跟着放大，
   2850 的屏上栅格仍停在 1280px 档的列数 —— 屏幕多出一倍空间却不再加列，卡片被撑成巨无霸。
2. 面板、画布、图表里写死的 px 不会跟着长，出现「字变大了、图标没变」的失衡。

现行做法（与 Ant Design Pro / shadcn / GitHub / Linear 一致）：

| 手段             | 位置                            | 作用                                                       |
| ---------------- | ------------------------------- | ---------------------------------------------------------- |
| 内容宽度分级放宽 | `tokens.css` 的 `.n-page-shell` | 1440→1500、1680→1600、1920→1760、2240→2048、2560→2200 封顶 |
| 宽屏断点         | `tokens.css` 的 `@theme inline` | `3xl`(1920) / `4xl`(2560)，页面写 `4xl:grid-cols-6`        |
| 容器查询         | 组件内部                        | 卡片按自身宽度换行，不随视口跳                             |

实测填充率：1440 = 84%、1920 = 88%、2560 = 86%、2850 = 77%，全程零横向溢出。

## 六种菜单布局

导航摆在哪是一个独立维度，和外层留白（整体布局）、配色（皮肤）互不干扰。
实现集中在 `apps/admin/src/layout/`：外壳算几何，导航组件只负责渲染。

| 布局              | 顶栏       | 侧栏                       | 顶栏内容            |
| ----------------- | ---------- | -------------------------- | ------------------- |
| `vertical` 垂直   | 在内容列内 | 整树导航，可折叠成图标轨道 | 开关 + 搜索         |
| `dual` 双列       | 在内容列内 | 模块导轨 + 当前模块子菜单  | 开关 + 搜索         |
| `horizontal` 水平 | 通栏       | 无                         | 品牌 + 全量横向菜单 |
| `mixed` 混合      | 通栏       | 只放当前模块的子菜单       | 品牌 + 模块切换     |
| `floating` 悬浮   | 在内容列内 | 整树导航，与内容是两张卡片 | 开关 + 搜索         |
| `sidebar` 侧边栏  | 通栏       | 整树导航，从顶栏下沿开始   | 品牌 + 搜索         |

三条实现约定，改动布局时不要破坏：

1. **一份导航，六种摆法**：`sidebar-nav.tsx` 里的 `SidebarNav` / `SingleModuleNav` / `ModuleRail`
   是同一棵导航树的三种投影，布局只决定用哪个、放在哪一列。新增布局不要复制菜单项。
2. **高亮判定只有一处**：`core/module.ts` 的 `isNodeActive` / `isNavActive` / `findActiveModule`
   同时服务侧栏、顶部菜单与双列导轨。三处各写一份前缀匹配，迟早会出现两个模块同时高亮。
3. **移动端一律回退成「抽屉 + 垂直菜单」**：双列在手机上没有第二列，水平菜单没有悬停语义。

「收起」在不同布局里含义不同（整条侧栏 / 双列第二列 / 混合子菜单），
因此 `sidebarCollapsed` 是一个共享布尔量，由布局各自解释 —— 这也是它能和「整体布局」正交的前提。
