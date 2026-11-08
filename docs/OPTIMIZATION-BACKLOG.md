# 优化项盘点（2026-11-07）

> 前置：`docs/PERFORMANCE.md` 已给出基线。本文件只回答一个问题 ——
> **按当前数据，下一步该修什么、每一项值多少、代价多大。**
> 全部结论都来自本轮实测脚本（`scripts/perf-*.mjs`、`scripts/_*.mjs`），不是估算。

## 0. 一句话

**移动端慢的主因是网络/请求数（占 FCP 增量 80%），不是 CPU**；
**把 154 个 chunk 合到 96 个，移动 FCP 平均降 1.2s**（实测已验证）；
剩下的短板是：AI 助手被静态打进外壳、`reduced` 档仍有 `animate-ping` 在跑、
`will-change` 常驻、缺少真实用户监控。

---

## 1. 归因实验：网络 vs CPU（`scripts/perf-attribution.mjs`）

同一页 `/dashboard/overview`，四种组合（移动视口、两次实验取区间）：

| 组合                         | FCP         | LCP         | TBT         |
| ---------------------------- | ----------- | ----------- | ----------- |
| A 限速 + 4×CPU（线上复现档） | 4,480~4,992 | 4,880~5,492 | 908~1,494   |
| B 限速 + 1×CPU               | 3,604~3,620 | 3,720~3,756 | 108~112     |
| C 不限速 + 4×CPU             | 1,160~1,168 | 1,376~1,400 | 1,110~1,133 |
| D 不限速 + 1×CPU（理想下限） | 264~280     | 312~348     | 114~122     |

**增量分摊（以 D 为基准，两次实验结论一致）**

| 来源           | FCP 增量   | 占比    |
| -------------- | ---------- | ------- |
| 网络 / 请求数  | 3,340 ms   | **80%** |
| CPU / 模块求值 | 888~896 ms | 21~22%  |
| 交互项         | −28~−76 ms | −1~−2%  |

> ⚠️ 第一版脚本用「A−B 与 A−C 谁大」判断主因，得出「CPU 是主因」的**错误结论** ——
> 那比较的是「把另一项拿掉后的世界」，不是「各项贡献了多少增量」。
> 现脚本改为 C−D / B−D 的增量分摊，并保留 TBT 的单独归因（CPU 单独 ~1,000ms，网络 −14ms）。

**结论**：FCP 靠**减少请求数**，TBT 靠**减少主线程求值**。两者需要不同药方。

---

## 2. 已验证有效：请求合并（实验产物 `dist-lab`）

改 `manualChunks`：lucide 图标并成一个 `icons` chunk、`@nexus/ui` 与框架并成 `core`、其余进 `vendor`。
体积几乎不变（154 → 96 chunk，916 → 898 kB gzip），但请求数腰斩：

| 路由     | FCP 基线            | FCP 合并 | Δ          | TBT 基线 | TBT 合并 | JS 请求 |
| -------- | ------------------- | -------- | ---------- | -------- | -------- | ------- |
| 登录页   | 2,504               | 2,428    | −76        | 0        | 0        | 19 → 14 |
| 经营概览 | 4,840               | 3,632    | **−1,208** | 575      | 420      | 64 → 33 |
| 数据分析 | 4,592               | 3,420    | **−1,172** | 558      | 475      | 61 → 31 |
| 用户管理 | 4,568               | 3,368    | **−1,200** | 214      | 23       | 59 → 32 |
| 性能监控 | 5,448               | 4,036    | **−1,412** | 712      | 810      | 66 → 35 |
| 组件橱窗 | 0（主线程一直没空） | 4,516    | 首次有 FCP | 5,144    | **0**    | 74 → 40 |
| 运营大屏 | 2,944               | 3,204    | +260       | 360      | 249      | 20 → 14 |
| 无限画布 | 4,612               | 3,540    | **−1,072** | 0        | 0        | 47 → 24 |

**代价**：路由级缓存命中率下降（原来改一个页面只失效 1 个 chunk，现在会动 `core`），
且首个页面要多下载未用到的组件。**建议只在生产配置启用**，并把 `core` 进一步拆成
`react` + `tanstack` 两个（保留长期缓存），`@nexus/ui` 单独一个。

**结论：这是唯一一个「改了就能进第一梯队」的项。** 当前门槛差的就是移动端 LCP ≤ 2.5s。

---

## 3. AI 助手被「每一页」加载

打开 `/business/users`（纯表格页，完全不用 AI），实测 59 个 JS chunk 里有两个 AI 专属：

```
session-list-*.js      27.6 kB raw / 7.9 kB gzip
page-renderer-*.js      9.6 kB raw / 3.2 kB gzip
```

来源：`app-shell.tsx:12` 静态 `import { AssistantPanel }`，且 `main.tsx` 顶层
`bootstrapAssistant(...)` + `import './ai/api-operations'` 把 `@nexus/ai-sdk` 内核
（`PageSpec`/`toolCalls`/`maxToolRounds`）拉进入口 chunk（入口 73.2 kB gzip 里有一部分是它）。

**建议**：`AssistantPanel` 改 `lazy()` + `Suspense`，只在首次打开抽屉（`Ctrl/⌘+J`）时加载；
`bootstrapAssistant` 改为「首次打开时才配置」。预期每页省 ~11 kB gzip + 2 个请求。

---

## 4. `reduced` 档并没有真的「全关」

把 `<html data-motion="reduced">` 切下去之后实测：

| 页面     | 仍在跑的动画 | 其中无限循环 |
| -------- | ------------ | ------------ |
| 性能监控 | 7            | 2            |
| 经营概览 | 1            | 1            |
| 运营大屏 | 1            | 1            |

全是 Tailwind 的 `animate-ping`（「实时」脉冲点），源码里 `tokens.css` 只对
`.n-skeleton / .n-beam / .n-marquee__track` 写了 `animation: none`，
**没有覆盖 `.animate-ping / .animate-spin / .animate-pulse`**。

这既是无障碍问题（用户明确要求减少动效仍看到脉冲），也是性能问题（常驻合成层）。
**建议**：在 `[data-motion='reduced']` 块里补一条
`[data-motion='reduced'] .animate-ping, … .animate-spin, … .animate-pulse { animation: none !important }`，
并在 `@media (prefers-reduced-motion: reduce)` 里同步。**改动 6 行，收益确定。**

---

## 5. 动效成本

移动档同页对比 full / reduced：

| 页面     | FCP Δ      | TBT Δ      |
| -------- | ---------- | ---------- |
| 经营概览 | 268 ms     | 13 ms      |
| 性能监控 | **412 ms** | **269 ms** |
| 组件橱窗 | 164 ms     | 0          |

入场的 `.n-page-enter` 用了 `filter: blur(1.5px)` + `scale(0.996)`，是浏览器最贵的整页绘制；
同时挂了 `will-change: opacity, transform`（**动画结束后仍常驻**），等于给每页最外层容器
永久提升了一个合成层。

**建议**（按性价比）：

1. 去掉 `filter: blur()`，只保留 opacity + 8px 位移 —— 观感差异很小，性能差异很大；
2. `will-change` 改为只在动画期间生效（`animation-fill-mode` 结束后由浏览器回收，
   或改成 `.n-page-enter { will-change: opacity }`，去掉 transform）；
3. `tokens.css` 里的 `will-change` 常驻点共 5 处（1797/1947/2020/2902/2936），
   `1947`（画布视口）与 `2936`（aurora）建议保留，其余可去。

---

## 6. 路由切换手感（`scripts/perf-route-switch.mjs`）

motion=full、生产构建、桌面：

| 切换        | URL 变化 | 首帧   | 600ms 内帧数 | 最长任务  |
| ----------- | -------- | ------ | ------------ | --------- |
| 概览 → 用户 | 105 ms   | 134 ms | 42           | 0         |
| 用户 → 分析 | 74 ms    | 114 ms | 43           | 0         |
| 分析 → 橱窗 | 65 ms    | 185 ms | 43           | **98 ms** |
| 橱窗 → 设置 | 68 ms    | 118 ms | 42           | 0         |
| 设置 → 概览 | 68 ms    | 83 ms  | 41           | 0         |

**UR 切换 65~105 ms、首帧 ≤185 ms**，已是第一梯队手感（对照：未做 intent 预加载的项目普遍 300~600 ms）。
唯一的长任务在首次进入组件橱窗（120 张卡片 + 6 张图表同时初始化，98ms），
可用 `content-visibility: auto` 或分批 `requestIdleCallback` 初始化图表进一步压。

---

## 7. 体积仍可压的点

| 位置              | 现状                                                                                                                                            | 建议                                                                 | 预估收益                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------- |
| ECharts 按需注册  | `echart-core.ts` 注册了 9 chart + 10 component，但 `HeatmapChart` / `ScatterChart` / `GraphicComponent` / `TransformComponent` **全项目零使用** | 删掉这 4 项（已实验：charts chunk 740.2 → 729.7 kB raw）             | −10.6 kB raw / ~3 kB gzip              |
| CSS 主题维度      | 198.2 kB 里 `[data-skin]` 12.5 kB + `.dark` 5.2 kB + 密度/圆角/布局 0.9 kB = **18.6 kB（9.4%）**                                                | 皮肤块按需（把 10 组皮肤拆成独立 `@import`，只加载选中的那组）       | 单用户首次 ~12 kB raw / 2 kB gzip      |
| 压缩算法          | 产物 gzip 948 kB，**brotli 798 kB**                                                                                                             | 部署时开 brotli level 11（nginx `brotli on; brotli_compressor 11;`） | **−15.7%（约 150 kB）**，零代码改动    |
| 中国地图 GeoJSON  | 59.8 kB raw / 41.9 kB gzip，只有两块大屏用它                                                                                                    | 已是动态 import，可再压成 TopoJSON（约 −60%）或简化边界              | −25 kB gzip（只影响大屏）              |
| `zh.ts` + `en.ts` | 各 ~25 kB raw，**两份都进了入口**                                                                                                               | 按语言动态 import                                                    | −9 kB gzip（切到英文的会话再拉另一份） |
| Mock 层           | 36 kB raw，仅演示站需要                                                                                                                         | 已是生产默认关闭                                                     | 0（生产包本来就没有）                  |

---

## 8. 工程与可观测性缺口

1. **没有真实用户监控（RUM）**：`web-vitals` 未接入，团队只能靠本地脚本回归。
   建议加 30 行 `PerformanceObserver` → `sendBeacon('/api/vitals')`，否则线上劣化无人知晓。
2. **没有性能预算门禁**：CI 里没有「入口 gzip > 200 kB 就失败」的检查。
   建议在 `scripts/perf-audit.mjs` 基础上加 `--budget` 断言，接进 `.github/workflows/ci.yml`。
3. **没有 HTTP 缓存策略说明**：产物是 hash 文件名，但仓库里看不到 `Cache-Control: immutable` 的部署配置，
   建议在 `docs/` 补一页部署基线（`index.html: no-cache`，`assets/*: max-age=31536000, immutable`）。
4. **PWA 只有 manifest，没有 Service Worker**：`start_url` 已指向工作台，但离线不可用。
   要么补 SW（预缓存外壳），要么把 manifest 里的 `display: standalone` 降级 —— 现在两头不靠。
5. **`preflight` 无 `preconnect`**：如果之后接入 CDN / 字体 / 对象存储，需要在 `index.html` 补 `preconnect`。

---

## 9. 优先级建议（按投入产出排序）

| 优先级 | 项                                       | 预期收益                                   | 风险                                |
| ------ | ---------------------------------------- | ------------------------------------------ | ----------------------------------- |
| **P0** | 请求合并（chunk 154→~60）                | 移动 FCP −1.2s，唯一能补齐第一梯队门槛的项 | 缓存粒度变粗，需配合 `immutable` 头 |
| **P0** | `reduced` 补 `animate-*` 覆盖            | 无障碍合规 + 去掉常驻合成层                | 6 行 CSS                            |
| **P1** | AI 助手懒加载                            | 每页 −11 kB gzip / −2 请求                 | 首次开抽屉多一次 await              |
| **P1** | 部署开 brotli                            | 全站 −15.7% 传输                           | 需服务端配置                        |
| **P1** | 去掉 `filter: blur` + `will-change` 常驻 | 移动 FCP −0.2~0.4s                         | 观感微调                            |
| **P2** | 删 4 个未用 ECharts 模块                 | −3 kB gzip                                 | 需回归图表页                        |
| **P2** | 皮肤 CSS 按需                            | −2 kB gzip                                 | 构建配置改动                        |
| **P2** | RUM + 性能预算门禁                       | 防止劣化                                   | 需要后端接收端点                    |
| **P3** | TopoJSON / 语言拆分                      | −25 / −9 kB gzip                           | 只影响特定页面                      |

---

## 9.1 执行结果（2026-11-07 已落地）

| 项                                       | 状态    | 实测结果                                                                                      |
| ---------------------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| 请求合并                                 | ✅      | 154 → 103 chunk；移动 FCP 平均 **−1.1s**（见 9.2）                                            |
| `reduced` 补 `animate-*`                 | ✅      | 性能监控页「仍在跑的无限循环」**2 → 0**；概览/大屏 0 动画                                     |
| AI 助手懒加载                            | ✅      | 用户管理页 AI chunk **2 个 / 11 kB gzip → 0 个**；整页 59 → **32 个请求**                     |
| 去掉 `filter: blur` + `will-change` 常驻 | ✅      | 组件橱窗桌面 LCP **772 → 440ms**、DOM 6,113 → 2,888                                           |
| 删 4 个未用 ECharts 模块                 | ✅      | charts chunk 740.2 → **712.6 kB raw**（gzip 244.6 → 235.5）                                   |
| 英文词典按需                             | ✅      | 入口 gzip **73 → 33.7 kB**；`en.js` 23 kB 只在英文用户/切换时加载                             |
| RUM（零依赖 LCP/INP/CLS+TTFB）           | ✅      | `core/vitals.ts` → `POST /api/vitals`；`VITE_ENABLE_VITALS=false` 可关                        |
| 性能预算门禁                             | ✅      | `scripts/perf-budget.mjs` 5 条硬线，已接进 CI                                                 |
| 部署基线文档                             | ✅      | `docs/DEPLOYMENT-PERF.md`（brotli / cache-control / HTTP2 / RUM 接收端）                      |
| 皮肤 CSS 按需                            | ❌ 不做 | 压缩后仅 **2.9 kB gzip**（原文 12.5 kB 是被 gzip 吃掉的重复变量名），**不值得引入构建复杂度** |
| 地图 TopoJSON                            | ❌ 不做 | 需联网抓新数据 + 重做注册流程，收益只落在两块大屏（P3）                                       |

> 皮肤那条是本轮修正的一个判断错误：上一轮按**原文字节**估 12.5 kB（6.3%）看似可观，
> 但 CSS 走 gzip，变量名高度重复 → 实测只剩 2.9 kB（18.8% 的 **raw** 占比，绝对值很小）。
> 当时的复现实验只跑过一次，脚本未入库；方法同 §10。

### 9.2 优化前后（移动档 Slow-4G + 4×CPU，同机同网）

| 路由     | FCP                    | LCP               | JS gzip         |
| -------- | ---------------------- | ----------------- | --------------- |
| 登录页   | 2,504 → **2,308**      | 2,504 → **2,308** | 205 → 192       |
| 经营概览 | 4,840 → **3,680**      | 5,440 → **3,864** | 507 → 466       |
| 数据分析 | 4,592 → **3,404**      | 4,792 → **3,652** | 508 → 467       |
| 用户管理 | 4,568 → **3,272**      | 5,048 → **3,708** | 263 → 230       |
| 性能监控 | 5,448 → **3,848**      | 5,448 → **4,832** | 279 → **481** ⚠ |
| 组件橱窗 | 0（无 FCP）→ **4,644** | 0 → **4,760**     | 369 → 336       |
| 运营大屏 | 2,944 → **2,432**      | 2,944 → **2,432** | 493 → 471       |
| 无限画布 | 4,612 → **3,460**      | 4,612 → **3,460** | 282 → 250       |

- **组件橱窗**：优化前主线程被 5.1s 长任务占满、**根本没有 FCP**；
  现在 4.6s 有首帧，且 TBT 5,144 → **0**
- **性能监控**：FCP 降 1.6s，但 JS 涨 202 kB —— 合并 chunk 后该页要连 `vendor` 一起拿，
  这是合并策略的已知代价（LCP 仍 5,448 → 4,832）
- 桌面档全部仍在优区间：LCP 172~520ms、TBT ≤ 73ms、CLS ≈ 0

### 9.3 仍未达标

移动端 **LCP 仍 > 2.5s**（3.5~4.8s）。要兑现第一梯队还差两件事：

1. **HTTP/2 + CDN 边缘**：本地静态服务 TTFB ≈ 3ms 已是最理想情况，
   但 32 个请求 × 150ms RTT 仍要 ~3s；只有把 RTT 压到 20ms 量级才够。
   配置见 `docs/DEPLOYMENT-PERF.md` §1。
2. **更粗的预打包**：余下 30 个「其它」chunk 已是页面级最小粒度，
   继续在 `manualChunks` 堆规则会牺牲路由级缓存；应改为**按模块分组的 vendor 预打包**。

---

## 10. 复现方式

```bash
# 演示站冒烟（启动 dev server 后先跑这个，2 分钟出结论）
pnpm dev                 # 另开一个终端
pnpm smoke               # node scripts/smoke-dev.mjs

# 归因（网络 vs CPU）
pnpm perf:attribution /dashboard/overview

# 优化前后对比（需先构建 dist-demo）
cd apps/admin && VITE_ENABLE_MOCK=true pnpm exec vite build --outDir dist-demo
node ../scripts/perf-audit.mjs --only=mobile --out=docs/perf/final-mobile.json
pnpm perf:compare            # 基线 vs 当前，逐路由 FCP/LCP/JS

# 路由切换手感
pnpm perf:routes

# 性能预算门禁（CI 里也跑这条）
pnpm perf:budget
```

> 本文写作时用过几个一次性诊断脚本（动效成本、reduced 覆盖、AI 每页税、CSS 与皮肤体积、
> 产物对比），它们只服务那一轮排查、结论已沉淀到本文，仓库里不再保留，避免把一次性工具
> 混进正式工具链。需要重跑同类实验时，可参照 `scripts/perf-attribution.mjs` 的写法自建。

### 10.1 长跑脚本的坑（脚本编写者注意）

`perf-stress.mjs` / `perf-waterfall.mjs` / `perf-attribution.mjs` 都会自建静态服务
并在结尾 `server.close()`。**一旦脚本中途抛错，Node 进程会因为监听句柄未释放而挂住**，
表现为「命令一直不返回、端口被占」。排查与处置：

```powershell
# 看谁占着端口（4181~4195 是这些脚本的默认端口段）
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -ge 4181 -and $_.LocalPort -le 4195 }
# 直接杀进程（Windows 上 node 常显示为 DSH Desktop.exe）
Stop-Process -Id <OwningProcess> -Force
```

已在 `perf-waterfall.mjs` 加了 `--port=` 参数，并行对比两套产物时不会撞端口。
