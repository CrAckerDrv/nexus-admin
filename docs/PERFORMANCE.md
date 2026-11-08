# Nexus Admin 性能与自研审计报告

> 采集时间：2026-11-06 ~ 11-07（Asia/Shanghai）
> 被测对象：`nexus-admin`（React 19.3.1 / Vite 8.3.5 / TS 6.0.3 / Tailwind v4）
> 环境：Windows / Edge headless（Playwright + CDP），桌面 1440×900、移动 412×892
> 原始数据：`docs/perf/perf-report.json`、`docs/perf/stress-report.json`

## 0. 一句话结论

**桌面端已经达到开源第一梯队（8 条路由 LCP ≤ 0.78s、TBT ≤ 64ms、CLS ≈ 0，优于实测的 Vben Admin 之外全部对照项）；移动端 Slow-4G + 4× CPU 降频下不达标（FCP 4.5~5.4s），瓶颈是首屏 64 个 JS 请求的串行 RTT，而不是包太大。**
**自研程度：组件库/画布/AI SDK/Mock 全为原创实现，未发现复制粘贴；但 ECharts、Lucide、TanStack、Zustand、Zod 属第三方，不能笼统称「全部自研」。**

---

## 1. 测试方法

### 1.1 为什么要重新造轮子

仓库里原有的 `scripts/screenshot.mjs` / `verify-*.mjs` 全部跑在 **dev server** 上：
源码逐个请求、HMR 运行时在跑、没有压缩。用它得出的耗时不能对外，也无法和
Ant Design Pro / Vben 这类"生产构建产物"对比。因此新建三个脚本，全部跑 `vite build` 产物：

| 脚本                         | 职责                                                            |
| ---------------------------- | --------------------------------------------------------------- |
| `scripts/perf-audit.mjs`     | 16 组 Core Web Vitals（8 路由 × 桌面/移动两档），含 gzip 体积表 |
| `scripts/perf-stress.mjs`    | 交互压测：万行表格滚动、画布拖动/缩放、大屏高频刷新             |
| `scripts/perf-waterfall.mjs` | 单路由资源瀑布，用于定位"哪一步拖慢了首屏"                      |

### 1.2 口径

- **构建产物**：`VITE_ENABLE_MOCK=true vite build`（演示站形态，能完整渲染；生产包无 Mock 体积更小）
- **静态服务**：Node `http` + **真实 gzip**（与开源项目公开数字同口径），冷缓存（`cache-control: no-store`）
- **桌面档**：无网络限速、无 CPU 降频
- **移动档**：Slow 4G（1.6Mbps / 750kbps / 150ms RTT）+ 4× CPU 降频（对齐 Lighthouse mobile 预设）
- **FCP/LCP**：`PerformanceObserver` 最终值；**CLS**：只累计 `hadRecentInput === false`；
  **TBT**：Σ(longtask − 50ms)，只统 FCP 之后；**帧率**：注入 rAF 计数器，`帧数 / 时长`

> ⚠️ 已知局限：本地静态服务 TTFB ≈ 3~8ms，**不代表真实 CDN 网络**。
> 桌面端的 LCP 绝对值会比线上好，横向比较请看「同环境下的对照组」。

---

## 2. 构建体积

> 下表是**优化后**的数字（2026-11-07，见 `OPTIMIZATION-BACKLOG.md` 9.1）。
> 括号里是优化前的值，用来对照。

| 指标                                                 | 数值                                                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 全量产物                                             | 120 个文件 / 3,071 kB raw / **1,231 kB gzip**（原 171 / 3,113 / 1,252）                        |
| 首屏 JS（index + react + tanstack + icons + vendor） | **33.7 kB gzip 入口 + 6 条 preload**（原 175.6 kB gzip / 5 条）                                |
| CSS                                                  | 195 kB raw / **30.5 kB gzip**（单文件，无重复）                                                |
| 最大单 chunk                                         | `charts-*.js` **712.6 kB raw / 235.5 kB gzip**（原 740.2 / 244.6；动态 import，不在首屏）      |
| 构建耗时                                             | **550~750 ms**（Vite 8 / Rolldown）                                                            |
| 代码分割粒度                                         | **103 个 JS chunk**（原 154）；`< 1 kB` 的碎片 **5 个**（原 64）；页面 chunk 中位数 ~5 kB gzip |

**判断**：入口 chunk 从 73 kB gzip 降到 **33.7 kB**（AI SDK 与英文词典被移出入口），
首屏 preload 总量从 175.6 kB 降到约 **150 kB**；碎片 chunk 从 64 个降到 5 个 ——
这才是移动端 FCP 平均降 1.1s 的直接原因（请求数从 64~74 降到 32~40）。
`charts` 仍然 > 250 kB gzip 的默认警戒线，但**不在首屏 preload 列表**里，可接受。

---

## 3. 运行时性能（实测数据）

### 3.1 桌面档（1440×900，本地无节流）

| 路由     | FCP | LCP     | TBT    | CLS   | 该路由 JS(gzip) | DOM 节点 | JS 堆   |
| -------- | --- | ------- | ------ | ----- | --------------- | -------- | ------- |
| 登录页   | 444 | 444     | 0      | 0.008 | 196 kB          | 242      | 5.6 MB  |
| 经营概览 | 432 | **516** | **0**  | 0.000 | 476 kB          | 1,460    | 13.4 MB |
| 数据分析 | 260 | 296     | 22     | 0.000 | 476 kB          | 1,235    | 15.1 MB |
| 用户管理 | 248 | 248     | 0      | 0.000 | 239 kB          | 1,470    | 6.9 MB  |
| 性能监控 | 336 | 520     | **73** | 0.000 | 492 kB          | 3,363    | 14.4 MB |
| 组件橱窗 | 440 | **440** | 0      | 0.000 | 348 kB          | 2,888    | 9.1 MB  |
| 运营大屏 | 172 | 172     | 0      | 0.001 | 476 kB          | 513      | 17.1 MB |
| 无限画布 | 348 | 396     | 0      | 0.000 | 257 kB          | 1,698    | 7.7 MB  |

> 「该路由 JS」= 打开这一页实际下载的 JS 总量（含动态 import 的页面 chunk）；
> 「首屏 preload」是 `index.html` 里 6 个 `modulepreload` 的合计（约 150 kB gzip）。

**8/8 条路由 FCP / LCP / TBT / CLS 全部落在 web.dev「优」区间。**
组件橱窗（120 张卡片真实渲染）从 LCP 772ms / DOM 6,113 / TBT 7ms
降到 **440ms / 2,888 / 0ms** —— 进视口才渲染 + 合包两项叠加的结果。

### 3.2 移动档（412×892，Slow 4G + 4× CPU）

| 路由     | FCP   | LCP   | TBT   | CLS   | 该路由 JS(gzip) |
| -------- | ----- | ----- | ----- | ----- | --------------- |
| 登录页   | 2,308 | 2,308 | 0     | 0.048 | 196 kB          |
| 经营概览 | 3,680 | 3,864 | 442   | 0.000 | 476 kB          |
| 数据分析 | 3,404 | 3,652 | 333   | 0.000 | 476 kB          |
| 用户管理 | 3,272 | 3,708 | 197   | 0.000 | 239 kB          |
| 性能监控 | 3,848 | 4,832 | 943   | 0.060 | 492 kB          |
| 组件橱窗 | 4,644 | 4,760 | **0** | 0.000 | 348 kB          |
| 运营大屏 | 2,432 | 2,432 | 316   | 0.005 | 476 kB          |
| 无限画布 | 3,460 | 3,460 | 0     | 0.000 | 257 kB          |

**结论：移动档仍未达标**（LCP 3.5~4.8s）。FCP 已从 4.5~5.4s 降到 3.2~4.6s，
但「用户管理」只载入 239 kB JS 依然 FCP 3.3s —— 瓶颈不在包大小，而在请求数 × RTT。

### 3.3 根因：请求数 × RTT，而不是体积

`perf-waterfall.mjs` 在 Slow 4G（150ms RTT）下抓取组件橱窗（优化前）：

```
188 → 1387  73kB  index-*.js      ← 入口
189 → 1355  66kB  react-*.js
189 → 1048  35kB  router-*.js
189 →  972  31kB  index-*.css
...
JS 请求 74 个，合计 395 kB；首个 JS 开始 188ms，最后一个 JS 结束 3971ms
```

- 首屏 JS 只有 395 kB，**但要发 74 个请求**
- 浏览器对同源 HTTP/1.1 限 6 并发；即使 HTTP/2 多路复用，150ms RTT 下
  一轮往返只能推进一批，74 个请求摊成 ~3.8s 的下载尾
- 期间主线程要做 3,005 个模块的求值 → 移动档 TBT 峰值 5.1s

**优化后**（同一脚本、同一路由）：请求数 74 → **40**，最后一个 JS 结束 3,971 → **2,650ms**。
但「请求数 × RTT」这个物理约束仍在 —— 32~40 个请求 × 150ms，还是有 ~1s 的纯等待下限。

**这条是"第一梯队"与"合格"的分界线**：Vben Admin 也是同一个病（166 个请求），
它靠 HTTP/2 + CDN 边缘把 RTT 压到 20ms 才跑出 823ms 的 LCP。
本项目要兑现同样的数字，**必须先把 RTT 从 150ms 压下来**（见 `docs/DEPLOYMENT-PERF.md`）。

---

## 4. 交互压测（生产构建，桌面）

| 场景                          | fps    | 长任务            | 判定 |
| ----------------------------- | ------ | ----------------- | ---- |
| 万行表格连续滚动（27 行/帧）  | **59** | 0                 | 流畅 |
| 表格排序重排（全量 5,000 行） | **60** | 0                 | 流畅 |
| 无限画布拖动 90 帧            | 55     | 0                 | 流畅 |
| 无限画布滚轮缩放 25 档        | **60** | 0                 | 流畅 |
| 战报大屏 12s（GMV 跳 5 次）   | **60** | 0                 | 流畅 |
| 工作台首屏 2.2s               | 51     | 2 次 / 最长 186ms | 可用 |

**要点**

- 自研 `VirtualTable` 的窗口化（`startIndex = floor(scrollTop/rowPx) - overscan`）在 5,000 行下零长任务，
  与 `@tanstack/react-virtual` 同档。
- 画布拖动期只写 `--c-dx/--c-dy` CSS 变量、不进 React，是 55fps 的关键。
- 战报屏每 2.4s 刷新 GMV 时**不掉帧**——数字滚动走 rAF + `displayRef`，不触发父组件重渲染。
- 唯一「可用」项是工作台首屏，长任务来自 3 张 ECharts 初始化（186ms），可通过
  `requestIdleCallback` 分批初始化进一步压低（当前已是空闲加载）。

---

## 5. 与开源第一梯队的对照

对照组为同期在同机同网实测（Lighthouse 13.6 / Edge headless / mobile 模拟节流，3 轮中位数）。

| 项目                 | 入口 JS gzip         | LCP            | TBT          | CLS       | 判定                            |
| -------------------- | -------------------- | -------------- | ------------ | --------- | ------------------------------- |
| **Vben Admin**       | **62.1 kB**          | **823 ms**     | 44 ms        | 0         | ✅ 四项全过（短板：166 个请求） |
| **本项目（桌面档）** | **首屏 ~150 kB**     | **172~516 ms** | 0~73 ms      | 0         | ✅ 四项全过                     |
| shadcn-admin         | 200.3 kB             | 3.8~7.3 s      | 150 ms       | 0.009     | ❌ LCP                          |
| vue-element-admin    | 363.7 kB             | 1.05 s         | 140 ms       | **0.221** | ❌ CLS                          |
| React Admin (MUI)    | 508.5 kB（单 chunk） | 2.2 s          | 221 ms       | 0         | ⚠️ 零 code-split                |
| Ant Design Pro       | 580.6 kB             | 4.46 s         | 306 ms       | 0         | ❌ LCP/TBT                      |
| Soybean Admin        | 586.8 kB             | 4.11 s         | 87 ms        | 0         | ❌ LCP                          |
| Refine demo          | 905.5 kB（单 chunk） | 6.28 s         | **2,311 ms** | 0.006     | ❌❌ 反面基线                   |

**门槛判定（web.dev 官方阈值）**

| 指标              | 优                     | 需改进   | 本项目（桌面） |
| ----------------- | ---------------------- | -------- | -------------- |
| LCP               | ≤ 2.5 s                | > 4.0 s  | 0.17~0.52 s ✅ |
| TBT（实验室代理） | < 200 ms               | > 600 ms | 0~73 ms ✅     |
| CLS               | ≤ 0.1                  | > 0.25   | 0~0.008 ✅     |
| 入口 JS gzip      | < 200 KB（业界经验档） | —        | **33.7 kB** ✅ |
| 首屏 script 请求  | < 50 个                | —        | **32 个** ✅   |

> 三处常见误传已在对照表中修正：**TBT 不是 Core Web Vital**（只是实验室代理，INP 才是）；
> **FID 已被 INP 取代**（2024-03）；**Lighthouse 原生只有 90 / 50 两个断点**，
> 「75~89」是团队 SLA 惯例而非工具档位。

### 5.1 结论：是否「第一梯队」？

| 维度                           | 结论                                                      |
| ------------------------------ | --------------------------------------------------------- |
| 桌面端运行时性能               | ✅ **第一梯队**（8 路由全优，优于除 Vben 外全部对照项）   |
| 构建体积 / 代码分割            | ✅ **第一梯队**（入口 33.7 kB gzip，103 chunk，5 个碎片） |
| 交互压测（万行表格/画布/大屏） | ✅ **第一梯队**（55~60 fps，0 长任务）                    |
| 移动端 Slow-4G                 | ❌ **未达标**（LCP 3.5~4.8s），根因是「请求数 × RTT」     |
| 可维护性/约束                  | ✅ typecheck/lint/211 个测试/40+ 验收脚本/CI 性能预算     |

**总评：桌面端已经站在第一梯队；移动弱网还差「部署侧 HTTP/2 + CDN」这最后一环。**
纯前端能做的都做了 —— 请求数 74 → 32、碎片 64 → 5、入口 73 → 33.7 kB，
移动 FCP 平均降 1.1s，但 150ms RTT × 32 个请求的物理下限仍是 ~1s。

### 5.2 移动端后续优化（剩余两项）

1. **HTTP/2 + CDN 边缘**（部署侧，收益最大）：RTT 从 150ms 降到 20ms 量级，
   同一套产物在 Lighthouse 模拟环境就能接近 2.5s。配置见 `docs/DEPLOYMENT-PERF.md`。
2. **按模块的 vendor 预打包**（构建侧）：余下 30 个「其它」chunk 已是页面级最小粒度，
   继续在 `manualChunks` 堆规则会牺牲路由缓存；应改为「模块组 → 预打包 chunk」。

已完成（本轮）：请求合并（154 → 103 chunk）、图标并块（64 → 5 碎片）、
组件橱窗进视口渲染（TBT 5,144 → 0）、AI 助手按需加载（每页 −2 请求 / −11 kB）、
英文词典按需（入口 −39 kB gzip）。

---

## 6. 自研程度审计

### 6.1 结论

| 对象                                             | 分级                                    | 关键证据                                                                                                                                      |
| ------------------------------------------------ | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `@nexus/ui` 组件库（116 组件 / 17,350 行）       | **原创代码，API 受 antd / shadcn 启发** | 运行时依赖仅 `clsx` + `tailwind-merge`；235 个导出全部显式列举；2,447 行中文注释；`radix`/`headless`/`cva(`/`useFloating` 等痕迹**零命中**    |
| 无限画布（18 文件 / 5,685 行）                   | **全自研**                              | 空间索引用**均匀网格分桶**（React Flow 用 quadtree/filter）；相机有**惯性滑动 + settled 两阶段**；`reactflow`/`@xyflow`/`d3-zoom` 全部 absent |
| VirtualTable（201 行）                           | **全自研**                              | `floor(scrollTop/rowPx) - overscan` 窗口算法；注释明确写「不引入 @tanstack/react-virtual」，该包 absent                                       |
| `@nexus/ai-sdk`（14 文件 / 4,112 行）            | **全自研**                              | **零运行时依赖**；手写 SSE 跨 chunk 断行解析 + 按 index 累积工具分片 + 3 轮工具循环 + 本地 planner 降级；`ai`/`@ai-sdk`/`useChat` absent      |
| Mock 层（2,487 行）                              | **全自研**                              | 覆盖 `window.fetch`，非 MSW；无 service worker 文件                                                                                           |
| i18n（词典 + 插值 + 类型安全漏译报错）           | **全自研**                              | 无 i18next/react-intl 依赖                                                                                                                    |
| 主题令牌 tokens.css（3,029 行 / 877 个 `--n-*`） | **自研命名体系**                        | 无 shadcn 的 `--background/--foreground`、无 antd 的 `--ant-*`                                                                                |

### 6.2 明确「不构成自研」的部分

这些是第三方，不能算进自研：

| 项                               | 许可       | 用法                                                                                |
| -------------------------------- | ---------- | ----------------------------------------------------------------------------------- |
| **ECharts 6.1.0**                | Apache-2.0 | 按需注册 9 图表 + 10 组件；`echart.tsx` 只是 297 行封装（令牌解析、主题不重建实例） |
| **Lucide (lucide-react)**        | ISC        | 应用层 93 处 import                                                                 |
| **TanStack Router / Query**      | MIT        | 路由与数据请求                                                                      |
| **Zustand**                      | MIT        | 应用层 store（组件库内不用）                                                        |
| **Zod**                          | MIT        | 契约校验                                                                            |
| **React / Vite / Tailwind / TS** | MIT/Apache | 基础设施                                                                            |
| **中国地图 GeoJSON**             | 未声明     | `china.json` 为 ECharts/DataV 的 `UTF8Encoding` 压缩格式，**无出处声明，建议补**    |
| **clsx / tailwind-merge**        | MIT        | 组件库仅有的两个运行时依赖（所以"零依赖"应表述为"零 UI 框架依赖"）                  |

### 6.3 抄袭/改写取证

- 全仓只有 1 份 LICENSE（根 MIT），无 `vendor/` 目录、无第二份许可证、无 `components.json`（shadcn CLI 产物）
- `Copyright` / `SPDX` / `@license` / `DO NOT EDIT` / `auto-generated` → **零命中**
- `packages/ui/src` 的外部 import 只有 7 种：`react`、`react-dom`(createPortal)、`clsx`、`tailwind-merge`、vitest、@testing-library
- **唯一同构点**：`icons.tsx` 的 PlusIcon / CloseIcon / CopyIcon 路径几何与 Lucide 同源（Lucide 是 ISC，商业友好）。
  文件头已声明「与 lucide 观感一致」，建议补一句「部分路径参考 Lucide（ISC License）」。
- **同名同题材**：`BorderBeam` / `Marquee` / `SpotlightCard` / `AnimatedNumber` 与 Magic UI 重名，
  但实现路径完全不同（本项目纯 CSS + rAF，Magic UI 依赖 `motion` + `offsetPath`）。

### 6.4 3 个非阻断风险

1. ✅ **硬编码密钥**：`scripts/_gen-banners.py` 原先内联过图片生成服务的密钥，已改为读取
   `BANNER_API_KEY` / `BANNER_API_URL` / `BANNER_API_MODEL` 环境变量（该密钥已作废）。
2. ✅ `packages/ui/package.json` 的描述已改为「零 UI 框架依赖」，与实际的 2 个运行时依赖（clsx / tailwind-merge）一致。
3. ✅ 根目录 `tmp-patch.ps1` 与一次性诊断脚本已清理。

---

## 7. 本轮代码改动（数字递增滚动）

### 7.1 需求

> 「启用动效后数字显示也需要递增的滚动效果」

### 7.2 原来的问题

CSS 动画遵循 `<html data-motion>` 与 `prefers-reduced-motion` 的双重约定，
但 **JS 驱动的数字滚动只读了媒体查询**：

- 主题面板选「始终开启」→ 卡片会抬升、侧栏会过渡，**数字却直接跳到终值**
- Windows 用户默认关闭了系统「显示动画」→ 即使用户在应用里打开动效，数字仍不滚

一处开关、两种行为。

### 7.3 改动

| 文件                                                           | 改动                                                                                                                                                                                          |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/lib/hooks.ts`                                 | 新增 `useMotionEnabled()`（订阅 `<html data-motion>` 的 MutationObserver + 媒体查询）与 `isMotionEnabled()`（初始化器用），二者与 CSS 同源                                                    |
| `packages/ui/src/components/premium.tsx`                       | `AnimatedNumber` 改用 `useMotionEnabled()`；**新增 `rollFromPrevious`**（默认从当前显示值续滚）；时长按变化幅度自适应（下限 380ms）；夹住 `progress` 修复首帧负值（首帧读数会先变负再爬回来） |
| `RingMetric`                                                   | 同样接入 `useMotionEnabled()`，开关切换即时生效                                                                                                                                               |
| `apps/admin/src/modules/templates/pages/screen-primitives.tsx` | 新增 `ScreenNumber`：把大屏的字符串指标（`'1,284,600'`、`'99.99%'`、`'412 / 448'`）拆成可滚动片段，解析不了的原样输出                                                                         |
| 8 块大屏 + `command-center-page.tsx`                           | Hero / KPI / 比率 / 资源水位全部换成 `ScreenNumber`（30+ 处）                                                                                                                                 |
| `packages/ui/src/index.ts`                                     | 导出 `useMotionEnabled` / `isMotionEnabled`                                                                                                                                                   |
| `theme-panel.tsx`                                              | 动效开关下方补一行说明，写清「同时作用于 CSS 与 JS 数字滚动」                                                                                                                                 |
| `gallery/more.tsx` + `premium-page.tsx`                        | 橱窗 demo 改成「每次点击目标值 +128,400」，可肉眼验证"续滚"；补 `rollFromPrevious` 文档；页面加「切换动效开关」按钮                                                                           |
| `packages/ui/src/__tests__/motion-number.test.tsx`             | 新增 3 例（关闭即终值 / 开启时递增 / 开关切换跟随）                                                                                                                                           |
| `scripts/verify-motion-number.mjs`                             | 新增浏览器验收 12 项                                                                                                                                                                          |

### 7.4 验收

```
node scripts/verify-motion-number.mjs   → 12/12 通过
  ✓ full：存在首帧小于终值的指标（真的在递增） — 0 → 8642300
  ✓ full：各指标读数随时间单调不减 — 0,0,0,0 | 5013237,69711,6545 | 8642300,128460,12846
  ✓ reduced：第一帧就是终值（不滚）
  ✓ 大屏 Hero 数字递增 — 0.42 → 1.24（终值 8,527,638 千分位保留）
  ✓ 切换 data-motion 后已挂载的组件立即跟随
```

`pnpm typecheck` 0 error · `pnpm lint` 0 error / 51 warning（全为既有 React Compiler 规则）·
`pnpm test` 208 通过（ui 108 + admin 50 + ai-sdk 53，UI 套件连跑 4 次稳定）·
`pnpm build` 588ms · `verify-gallery-guide` 30/30 · `verify-performance` 23/23 · `verify-templates` 全通过

### 7.5 顺带修的性能问题

组件橱窗（120 张卡片真实渲染）在移动档会一次性挂载 1,300+ 组件实例，
产生 **4~5s 的长任务、FCP 直接为 0**。改为 IntersectionObserver 进视口才渲染后：

| 指标     | 优化前   | 优化后                           |
| -------- | -------- | -------------------------------- |
| TBT      | 5,144 ms | **0 ms**                         |
| DOM 节点 | 6,113    | 2,888                            |
| 占位高度 | —        | 沿用 `previewHeight`，CLS 仍为 0 |

### 7.6 第二批优化（同一天，见 `OPTIMIZATION-BACKLOG.md` 9.1）

| 项               | 关键改动                                                                                                | 文件                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 请求合并         | `manualChunks` 按 `charts / icons / react / tanstack / vendor` 分组，lucide 不再逐图标拆文件            | `apps/admin/vite.config.ts`                                                |
| `reduced` 全覆盖 | `[data-motion='reduced']` 与 `@media (prefers-reduced-motion)` 都补上 `.animate-ping/spin/pulse/bounce` | `packages/ui/src/styles/tokens.css`                                        |
| AI 按需          | 抽屉改 `lazy()`；入口按钮拆到 `assistant-launcher.tsx`；`main.tsx` 不再引用 `@/ai`                      | `ai/lazy.ts`、`ai/status-store.ts`、`ai/components/assistant-launcher.tsx` |
| 页面入场动画     | 去掉 `filter: blur(1.5px)` 与常驻 `will-change`；`tilt` 的 `will-change` 改为只在 hover                 | `packages/ui/src/styles/tokens.css`                                        |
| ECharts 瘦身     | 删掉零使用的 `HeatmapChart / ScatterChart / GraphicComponent / TransformComponent`                      | `components/charts/echart-core.ts`                                         |
| 英文词典按需     | `en.ts` 改 `import()`，`useI18n` 订阅版本号；切换语言/设置页/主题面板都预取                             | `i18n/index.ts`                                                            |
| RUM              | 零依赖采集 LCP/INP/CLS+TTFB，`sendBeacon` 上报 `/api/vitals`，失败静默、可关闭                          | `core/vitals.ts`、`core/env-mode.ts`                                       |
| 性能预算         | 5 条硬线，接入 CI                                                                                       | `scripts/perf-budget.mjs`、`.github/workflows/ci.yml`                      |

---

## 8. 附录：脚本用法

```bash
# 0. 启动演示站并冒烟（2 分钟内确认「它活着」）
pnpm dev
pnpm smoke                      # 登录页 + 4 条代表性路由，查 DOM/canvas/溢出/控制台

# 1. 构建（演示站形态，能完整渲染）
cd apps/admin && VITE_ENABLE_MOCK=true pnpm exec vite build --outDir dist-demo

# 2. Core Web Vitals（16 组）
pnpm perf:audit                          # 全部
pnpm perf:audit --only=desktop           # 只跑桌面档
pnpm perf:audit --routes=gallery         # 只跑组件橱窗

# 3. 交互压测（自动起静态服务，跑 dist-demo）
pnpm perf:stress
pnpm perf:stress --only=tables,canvas

# 4. 路由切换手感
pnpm perf:routes

# 5. 归因（网络 vs CPU 四象限）
pnpm perf:attribution /dashboard/overview

# 6. 优化前后对比
pnpm perf:compare

# 7. 性能预算（CI 同款命令）
pnpm perf:budget

# 8. 单路由资源瀑布（--port 可换端口，便于并行）
node scripts/perf-waterfall.mjs /components/overview --dir=dist-demo --port=4181

# 9. 数字递增滚动验收（dev server）
pnpm verify:motion
```

> ⚠️ 长跑脚本（`perf-stress` / `perf-waterfall` / `perf-attribution`）会自建静态服务；
> 中途抛错时 Node 可能因监听句柄未释放而挂住。排查方式见
> `OPTIMIZATION-BACKLOG.md` §10.1。
