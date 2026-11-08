# 动效与过渡

这个项目的动效原则只有一句：**动效必须解释变化，而不是装饰变化**。

## 分层

| 层级 | 例子 | 策略 |
| --- | --- | --- |
| 反馈（≤150ms） | 按钮 hover、图标变色、Tooltip 淡入 | 只改颜色/透明度，不用位移 |
| 过渡（200~350ms） | 侧栏折叠、页签切换、下拉展开 | 位移 + 淡入，缓动 `--ease-out-expo` |
| 场景（>400ms） | 主题圆形扩散、页面进场 | 只允许用户**主动触发** |
| 循环 | 流光边框、跑马灯、骨架微光 | 幅度极小；`prefers-reduced-motion` 下停止 |

## 可复用的类

```css
.n-page-enter   /* 页面级入场：220ms 淡入 + 8px 上浮 + 1.5px 去模糊 */
.n-stagger      /* 卡片逐个入场：delay = var(--i) * 45ms */
.n-rise         /* KPI 区块入场：10px 上浮 + 0.98 缩放 */
.n-fade-in      /* 贴脸出现的浮层（Tooltip / 气泡） */
.n-skeleton     /* 骨架微光 */
```

```tsx
<div className="n-rise" style={{ '--i': 2 } as CSSProperties}>
  <StatCard … />
</div>
```

## 页面切换

`AppShell` 用 `key={pathname}` 强制重挂载 + `.n-page-enter`，因此每次切页都会有稳定的一次入场：

```tsx
<div className="n-page-enter" key={pathname}>
  <Outlet />
</div>
```

配合路由的 `defaultPreload: 'intent'`（悬停 40ms 后预取页面 chunk），
大多数切页在 chunk 已就绪的情况下直接渲染，动画成为唯一的「过渡感」来源，不会出现「卡一下再淡入」。

## 骨架屏

`routes/route-states.tsx` 里的 `RoutePending` **刻意做成和真实页面同构**：

```
标题 + 描述        ←  与页面 PageHeader 等高
KPI 行（4 张卡）    ←  与 StatCard 同高同间距
主图 + 侧栏        ←  与真实布局同比例
```

这样骨架被真实内容替换时不会产生布局跳动，观感比「一堆等宽灰条」接近「秒开」。
表格类页面用 `RouteTablePending`，列宽稳定，避免数据到达时横向抖动。

## 减少动效（重要）

三层策略，从弱到强：

```css
/* 1. 系统偏好：一次性过渡压缩但不消失；循环动画停止 */
@media (prefers-reduced-motion: reduce) { … }

/* 2. 应用内「减少」：同上，且过渡统一 120ms */
[data-motion='reduced'] { … }

/* 3. 应用内「始终开启」：覆盖系统偏好 */
[data-motion='full'] { … }
```

> **为什么不再用全局 `animation-duration: 0.001ms !important`**
>
> 那样会让 OS 开启「减少动画」的用户彻底失去所有过渡反馈：侧栏瞬移、页面硬切、
> 主题切换毫无反应 —— 体验反而更粗糙，也常常被误认为「功能坏了」。
>
> 现在的做法是：**位移类动画降级为纯淡入**，循环装饰停止，一次性过渡保留但缩短。

用户可在「主题设置 → 动效」里选择：跟随系统 / 始终开启 / 减少。

## 主题切换的圆形扩散

```ts
runThemeTransition(apply, origin?, willBeDark?)
```

- 优先用 View Transitions API（`document.startViewTransition` + `flushSync`）
- 新层加 `clip-path: circle(0 at x y)`，半径扩到覆盖整屏
- 时长 720ms，缓动 `cubic-bezier(0.22, 1, 0.36, 1)`
- 不支持时降级到 `overlayTransition`（固定定位遮罩 + 同一条 clip-path 曲线）

```tsx
<button
  onClick={() => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark'
    runThemeTransition(() => setTheme(next), originFromElement(btnRef.current), next === 'dark')
  }}
/>
```

> `originFromElement` 取按钮的几何中心，因此圆总是从你点的地方长出来。

## 性能约束

- 只动 `opacity` / `transform` / `filter`，不动 `width` / `height` / `top` / `left`
- 侧栏宽度过渡是例外（必须改宽度），但已用 `will-change` 与 `contain` 限制重排范围
- 长列表用虚拟滚动，动画只作用于可视区
- `prefers-reduced-motion` 与 `data-motion='reduced'` 会关闭所有循环动画，避免持续重绘
