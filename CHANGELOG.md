# 更新日志

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/) 与 [约定式提交](https://www.conventionalcommits.org/)。

## [Unreleased]

### 新增：资源与编辑器（图片 / 视频 / 音频显示 + 四种编辑器 + 资源工作台）

**为什么加**：资源型后台（素材库、内容中心、剪辑台）最先要用到的不是表格也不是图表，
而是「把一份二进制资源显示出来、再改它的参数」。这两件事在项目里原来只有画布节点里零散实现过：
图片靠 `<img>` 裸铺、视频用假的播放条、音频完全没有，编辑器一个都没有。

**组件（`@nexus/ui` 新增 `components/media/` 子目录，10 个组件 + 4 个工具）**

- 资源显示：`ImagePreview`（固定比例 + 类型角标 + 尺寸胶囊，加载中流光、失败给人话）、
  `VideoPreview`（有源才能播，无源时明示「静帧预览」而不是假装在播）、
  `AudioPreview`（确定性波形，点击任意位置跳转试听）、`MediaCard`（三种资源共用一张卡）、
  `MediaKindBadge`（`IMAGE` / `VIDEO` / `AUDIO`）。
- 编辑器：`ImageEditor`（比例 / 旋转 / 缩放 / 亮度 / 对比度 / 饱和度）、
  `TextEditor`（Markdown 工具栏 + 字数统计 + 实时预览，不用 `contentEditable`）、
  `CodeEditor`（行号 + 语言切换 + 高亮 + Tab 缩进，不引 Monaco / CodeMirror）、
  `VideoEditor`（时间轴 + 播放头 + 按播放头拆段）、`EditorWorkbench`（四编辑器页签壳）。
- 协议：`MEDIA_KIND_META` / `EDIT_KIND_META` 是角标文案、语义色、`accept` 的唯一来源；
  `EDITOR_BY_MEDIA_KIND` 给出「资源类型 → 默认编辑器」，音频复用视频时间轴（不造两套口径）。
- 工具：`formatDuration` / `formatPreciseDuration` / `seedWaveform` / `clampRatio`。
- 参数一律以**结构化对象**经 `onChange` 写回，组件不做导出、不做上传；四个编辑器都有「重置」。

**模板中心**

- 新增 `/templates/media-workbench`（侧栏「模板中心 → 智能与内容」）：左侧混排素材库、
  右侧资源详情 + 编辑工作台，点资源按 `EDITOR_BY_MEDIA_KIND` 自动切页签。
- 模板总览新增「资源与编辑器」卡片，业务页面骨架统计从 7 更新为 8，「复用组件」由 48+ 改为 60+。
- `nav.templateMediaWorkbench` 中英词条 + `NAV_KEY_BY_PATH` 注册。

**组件橱窗**

- 新增 `Media` 分类（10 条：三种显示类型、类型角标、资源卡片、四种编辑器、工作台），
  分类顺序排在 `Charts` 之后 `Feedback` 之前 —— 同为「内容呈现」层。
- 橱窗总数 120 条 / 14 个分类（`verify-gallery-guide.mjs` 断言同步）。

**演示素材（ffmpeg 合成，约 80 KB）**

- `apps/admin/src/assets/media/`：6s 渐变短片（640×360 / H.264 crf30）、短片封面、
  三张静帧（WebP 2.6–3.8 KB）、6s 环境音（220 Hz + 回声 / 48 kbps MP3）。
- 生成脚本 `scripts/_gen-media-assets.mjs`：换配色 / 换时长重跑一次即可，不依赖外部下载。

**踩坑**

- `<button>` 不能嵌套：`MediaCard` 的根节点在 `onClick` 下就是 `role="button"`，
  内层 `VideoPreview` 再渲染播放按钮会触发浏览器 HTML 校验错误且互相抢事件；
  现在 `MediaCard` 会传 `interactive={false}`，改用静态播放标识。
- 代码编辑器头部原本复用共享 `Tabs` 的 `pill` 变体，深色底上要层层覆盖（还会把选中项文字一起染白），
  改为局部角色化按钮组，样式口径仍与组件库一致。

### 新增：横幅组件与横幅模板（模板中心 / 组件库 / 经营概览三处打通）

**为什么加**：后台里出现频率最高的区块不是表格也不是图表，而是「一句标题 + 一段说明 +
一个按钮 + 一张插画」。以前每处都要手搓一遍渐变、间距与深浅色适配，改一次要改五六个页面。

**组件（`@nexus/ui` 新增两类）**

- `HeroBanner`：主横幅。六档色调（全部映射到 `--n-chart-1..6`，跟随皮肤 / 深浅色 / 强调色）
  × 三种模式（`soft` 15–17% 混色 / `glass` 6–20% 混色 / `solid` 实色底自动转白前景）；
  插画靠右、`imageSize` 三档、`imageBleed` 下沉贴边、`children` 承载 slot；
  窄屏直接收起插画而不是压扁。
- `BannerCard`：卡片横幅。图在上、文在下，`image` / `icon` 二选一且占位对齐，
  描述固定两行（`line-clamp-2`）保证四列并排时高度一致，`onClick` 才获得按钮语义与键盘支持。
- 与已有 `alert.tsx` 的 `Banner` 明确分工：那个是**轻提示条**（一行文字 + 关闭），
  这两个是**区块级版式**（标题、说明、插画、按钮、slot）。

**模板中心**

- 新增 `/templates/banner`（侧栏「模板中心」下，与「模板总览」并列）：6 个主横幅样例
  - 4 个卡片横幅样例 + 三种模式的对照 + 插画素材墙 + 落地说明；
    文案与色调集中在 `pages/banner-presets.ts`，与组件橱窗共用。
- 模板总览新增横幅卡片；卡片改用 `MotionCard` 后，业务骨架统计由「6 个」修正为现有数量。
- `nav.templateBanner` 中英词条 + `NAV_KEY_BY_PATH` 注册。

**组件橱窗**

- 新增 `Banner` 分类（5 条：色调矩阵 / 模式矩阵 / 插画与 slot / 卡片形态 / 组合用法）。
- 新增 `Motion` 分类（5 条：五种效果对照 / 指标流 / 可点击 / 错峰入场 / 减少动效开关）。

**经营概览**

- 新增「用户欢迎横幅」`WelcomeBanner`：放在 PageHeader 与 KPI 之间，
  按小时给问候语，带用户名、部门、日期、待办数、本月交易额、环比与目标进度条；
  数据全部来自已有的 React Query hook 与 `auth-store`，加载中显示占位文案而不是 0。
- 本月目标口径抽到 `components/goal-meta.ts`：环、进度条、欢迎横幅读同一份，
  不再各写一遍 `10_000_000`。

**动效手感**

- 新增 `MotionCard`：`lift` / `spotlight` / `tilt` / `sweep` / `aurora` 五种低干扰动效，
  指针坐标只写 CSS 变量、手势期间零 setState；除 `aurora` 外无常驻动画；
  `prefers-reduced-motion` 与 `[data-motion='reduced']` 双向生效，关掉后卡片仍可读可聚焦。
- 模板总览的卡片改用 `MotionCard`：按位置轮转分配动效，同一行最多两种。

**3D 插画素材（AI 生成）**

- `apps/admin/src/assets/banners/` 下 12 张透明底 3D 黏土插画（WebP，384px，单张 13–26 KB），
  用于横幅模板、欢迎横幅、403 / 500 错误页与空态。
- 生成与压缩脚本：`scripts/_gen-banners.py`（调图片生成接口，透明底 PNG）
  - `scripts/_optimize-banners.py`（裁白边、补正方形、转 WebP、删原图）。
- 错误页去掉纯色图标块，改为插画 + 数字：这是用户最紧张的时刻，柔和一点更好。

**文档**

- `apps/docs/components/overview.md` 新增「横幅与动效」小节与用法示例；
  README 组件清单补「横幅 / 动效」两行、模板中心补横幅说明与双入口对照。
  模板总览与 README 里的业务页面骨架数量以页面实际条目为准（本轮新增横幅后为 7，
  随后并入「资源与编辑器」一并更新为 8）。

### 修复：拖动窗口时出现横向滚动条（栅格不肯变窄）

**现象**：从大窗口往小拖时，部分页面出现横向滚动条；刷新页面又恢复正常。

**根因**：CSS Grid 的 `<flex>` 轨道等价于 `minmax(auto, Nfr)`，而 `auto` 的下限是**内容最小宽度**。
ECharts 的 canvas 一旦按大尺寸渲染过，就成为该格的 min-content，格子不肯再变窄 ——
反过来又让 ECharts 的 ResizeObserver 永远看不到尺寸变化，于是**永久卡死**，只能刷新恢复。

实测 `/dashboard/overview` 从 2850 逐步拖到 1300：「交易趋势」卡片宽度**停在 1296px 不动**，
溢宽从 1700px 时的 42px 一路涨到 1300px 时的 442px。

**改法**：所有 `grid-cols-[…fr…]` 的裸 fr 轨道包上 `minmax(0, …)`
（`scripts/_grid-minmax.mjs`，23 个文件 / 80 条轨道），把下限从 `auto` 改成 `0`。
这正是 Tailwind 官方 `grid-cols-*` 预设的做法（它内部就是 `repeat(N, minmax(0,1fr))`）。

**回归**：`scripts/audit-overflow-routes.mjs` —— 16 个路由 × 从 2850 拖到 1100（每步 70px）。
修复前仅 `/dashboard/overview` 就有 9 处溢宽，修复后 **0 路由 / 0 处**。
另测浏览器缩放 100%~250%、窄视口 768~1400、暗色、弹窗，全部无溢出；栅格比例（1.85 : 1）保持不变。

### 新增：工作台「性能监控」页（服务器 / 服务 / 告警运维面板）

入口：`/dashboard/performance`（侧栏「工作台」第四个一级入口，无需折叠即可见）。
定位是**值班时不用跳 Grafana 也能定位问题**的工作台页面；与模板中心的「运维监控墙」大屏分工不同：
大屏只看不点，这里可筛选、可下钻、可处置。

- **八个核心指标**：在线节点 / 平均 CPU / 内存水位 / 磁盘最高水位 / 集群 QPS / P95 / 错误率 / 未处理告警，
  复用工作台 `KpiTile`（大数字 + 环比 + 迷你趋势），仅 ≥1800px 才排 8 列，避免标签被右侧图标挤断
- **资源与吞吐趋势**：1 小时 / 6 小时 / 24 小时 / 7 天四档 × 四种形态（资源水位 / 吞吐与延迟 / 网络吞吐 / 错误率）；
  画布高度交给 flex，右栏变高时自动长高，不再在卡片底部留白
- **SLO 与错误预算**：环形指标 + 三条预算进度。条形画「剩余预算」而不是「可用性」——
  可用性永远 99% 以上，画出来三根条都贴满、看不出差别
- **节点健康矩阵**：54 台按角色分组，颜色深浅编码 CPU 强度，离线节点用低饱和灰；点击任意格子打开节点抽屉
  （CPU / 内存 / 磁盘、近 1 小时双线趋势、内核与运行时长、进程 TOP）
- **节点资源 TOP / 服务健康**：自研 `DataTable`，可排序、可下钻；服务表收敛到 9 列后 1440px 不再横向滚动
- **告警中心**：P0/P1/P2 分级、未处理 / 已确认 / 已恢复三态，处置按钮按 `ops:write` 权限禁用；
  顶部红色横幅汇总未处理 P0，一键滚到告警区
- **实时日志 / 存储卷 / 负载热力图 / 进程 TOP / 采集链**：热力图用「最小-最大」归一化上色
  （按绝对 0-100 会糊成一片同色），底部补峰值 / 日均 / 工作日落差三个数，回答「什么时候该扩容」
- **实时刷新可暂停**：`refetchInterval` 由状态驱动，暂停后真的不再发请求（不是只改文案）

配套：

- `mock/performance.ts` 用**独立种子**生成整套数据（不复用 `seed.ts` 的全局 `rand`，否则新增数据文件会改变
  用户 / 订单页的演示数值），并在生成后定点制造 5 处「事故现场」（CPU 打满、磁盘越线、缓存内存、节点失联），
  保证矩阵上真的能看到红格
- `types/domain.ts` 增补 13 个性能领域模型；`services/schemas.ts` 补齐 zod 运行时契约；
  `i18n` 新增「性能监控」词条（中英对齐）
- 组件库 `PageHeader` 新增 `actionsClassName`：本页顶栏有 4 个区间 + 3 个按钮，
  默认 `shrink-0` 会在 768px 以下整体顶出容器
- 顺带修掉 `echarts.tsx` 里数组转 `ChartOption` 的 TS 报错（需经 `unknown`，否则报 TS2352）

验收：`node scripts/verify-performance.mjs`（23 项断言：8 指标 / 4 表 / 54 格 / 4 种趋势形态 / 区间切换 / 筛选 /
节点抽屉 / 服务抽屉 / 告警确认 / 暂停实时 / 0 横向溢出 / 0 控制台错误）；
`node scripts/check-performance-responsive.mjs` 在 1920→390px 七档下横向溢出均为 0；
`pnpm typecheck` / `pnpm lint`（0 error）/ `pnpm test`（admin 50 例，含新增 9 例数据自洽性用例）全绿。

### 新增：登录页人机验证（Cloudflare Turnstile）

登录表单接入 Turnstile。**前端只负责取一次性票据，判定交给后端 siteverify** ——
这条边界决定了这个功能是「真的验证」还是「一层装饰」。

- **按需触发（点「登录」才出现）**：组件用 `execution: 'execute'` + `appearance: 'interaction-only'`
  渲染，挂载后既不运行也不占位；父组件在提交时把 `runKey` +1 才开始验证。
  未展开时用 `-mt-3.5 h-0` 抵消表单 `space-y` 的 14px 间距 ——
  登录按钮与输入框的距离与「没接入验证」时实测一致（16px）
- **组件** `apps/admin/src/components/turnstile-widget.tsx`
  - `render=explicit` 显式渲染：隐式渲染扫 `.cf-turnstile` 节点，与 React 挂载时机、
    StrictMode 双次执行都会打架
  - 每次 effect 自建宿主节点交给 Cloudflare：StrictMode 的「挂载→卸载→再挂载」
    拿到同一个 DOM 节点，第二次 `render()` 会被拒（"already been rendered in this container"），
    组件从此停在空壳状态
  - token 一次性：失败后旧票作废，下次点登录重新出题，重试不会撞
    `timeout-or-duplicate`
  - 脚本失败 / 域名未配对时给出可见错误与「重试」，`language` 统一折成小写
    （Cloudflare 只认 `zh-cn`，传 `zh-CN` 会静默回退英文）
- **内核** `apps/admin/src/core/turnstile.ts`：脚本单例加载（失败可重试）、
  `render/reset/execute/remove` 封装、site key 选择策略
- **构建期开关** `apps/admin/src/core/env-mode.ts`：`MOCK_ENABLED` 从 `main.tsx` 提取，
  与「人机验证用哪把 key」共用同一常量
- **演示态自动换测试 key**：模板没有后端，票据不会被兑换；正式 key 要求当前域名在组件的
  Hostname Management 里，演示站的自定义域名 / 内网地址不可能一一登记，widget 会长期停在
  pending，登录被一张永远到不了的票据按死。因此演示构建用官方测试 key
  （`1x00000000000000000000AA`，永远通过），生产构建固定用正式 key
  `0x4AAAAAAF1Fc2tsbu8bVO-a`（`VITE_TURNSTILE_SITE_KEY` 可覆盖）
- **鉴权链路**：`AuthAdapter.login` 新增可选第三参 `LoginOptions`，
  `captchaToken` 透传；不传时旧调用方式完全兼容
- **门禁位置**：按钮**不**随票据禁用（晚到 1 秒就禁用会让用户以为点不动，也会让 48 个
  验收脚本等 enabled 时超时）；门禁在 `submit()` 里 —— 没票据就触发验证再等票，等不到才提示
- **状态提示**：不再为「正在等待出票」单开一行红字 —— 那段只持续几百毫秒，交给登录按钮自己的 loading 转圈；只有真的没拿到票才补一行带图标的错误提示
- **i18n**：`captcha.*` 4 条词条，zh 为准、en 对齐
- **验收**：`scripts/verify-turnstile.mjs` 9 项断言（初始零占位 / 点登录才出票 / 演示态不拦 /
  失败后重试可登录 / 深色），`apps/admin/src/core/__tests__/turnstile.test.ts` 5 条单测

### 新增：登录页左侧「流动方块」视觉层

左侧品牌区从「静态网格 + 两团光晕」升级为可玩的 Canvas 点阵
（`apps/admin/src/components/login-grid.tsx`，配色只读 `--n-primary`）：

- **全场流动**：方块沿两条正交正弦整体起伏，宽窄、速度都可调，不靠动画库
- **光带扫过**：一条斜向行进的高光带调制填充与描边亮度，静止时几乎看不见
- **指针聚光**：鼠标附近成片点亮、放大，并朝指针方向轻「吸」；
  指针位置带阻尼跟随（`POINTER_EASE`），移动时有短暂余韵而不是硬跟手
- **点击涟漪**：按下时从指针处扩散一圈环带，方块依次亮起再回落，最多同时 4 圈
- 浅色主题整体按 `tint` 压到六成（白底上同样的蓝会更重），深浅色切换时重新取色
- 性能：只画填充 + 描边两种图元，DPR 上限 2；实测稳定 60fps（平均帧间隔 16.67ms）
- 无障碍：整层 `aria-hidden` + `pointer-events-none`；「减少动效」时冻结波形，
  但指针与点击仍即时响应；`[data-motion='full']` 可压过系统偏好

同时补充的叙事层：标题扫光（真实文字保持实色，只复制字形轮廓做 `background-clip: text`）、
模块装配链路（内核 → 模块 → 界面，连接线上有流光）、特性卡跟手聚光、Logo 呼吸光晕。

### 修复：登录输入框「内嵌一块错位色块」

**现象**：登录页输入框中间出现一块深蓝灰底，左边界在图标右侧、右边界贴着 padding，
与外层边框和圆角都错位，重启浏览器、清空重输都消不掉。

**根因**：不是配色写错，是 Chromium 的自动填充（autofill）UA 样式：

```css
input:-internal-autofill-selected {
  background-color: light-dark(#e8f0fe, rgba(70, 90, 126, 0.4)) !important;
  color: FieldText !important;
}
```

这条属于「UA 重要声明」，级联顺序是 UA 重要 > 用户重要 > 作者重要，
所以作者样式**即使加 `!important` 也压不回去**（网上常见的
`transition: background-color 9999s` 也是靠「冻结过渡」绕，副作用是此后该输入框
所有背景过渡全部失灵）。而本项目 `Input` 把表面色画在外层 div、内部 `input` 是透明底，
于是被 UA 上色的只有 input 自己的盒子：左边界 = 外层 padding + 图标 + gap，
右边界 = 外层 padding，上下还各留 1px —— 就是截图里那块内嵌矩形。

**改法**（`packages/ui/src/styles/tokens.css`）：不跟 UA 抢 `background-color`，
改用 UA 压不住的绘制通道把整块盖住：

- `box-shadow: inset 0 0 0 100vmax var(--n-field-bg)` —— 阴影画在背景之上、边框之下
- `-webkit-text-fill-color` 覆盖被强制的 `color`
- `caret-color` 一并修正（光标同样会被改写）

`--n-field-bg` 由 `Input` 下发（默认 surface，禁用态 surface-2），因此填满后
与容器边缘无缝，换皮肤 / 强调色 / 深浅色都自动跟随。实测深浅色下
输入框内 3 个采样点颜色一致（`rgb(21,26,34)` / `#ffffff`），无控制台错误。

### 修复：宽屏下界面被「等比吹大」与侧栏文字变小

**问题**：早期为了不让 2850px 这类超宽屏把内容挤在中间，让根字号随视口等比放大
（`clamp(16px, 1.1111vw, 32px)`），再给侧栏/顶栏套 `zoom` 反缩放。实际效果有两个硬伤：

1. **侧栏图标和文字被压小**。反缩放的 `zoom` 会连 px 一起乘 —— 外框里任何写死
   `size-[18px]` / `text-[13px]` 的地方都被缩成 9px / 6.5px。窗口越大，外框越小。
2. **大屏反而更空**。媒体查询里的 rem 恒按 16px 折算，与根字号无关，所以
   2850 的屏上栅格仍停在 1280px 档的列数：屏幕多出一倍空间却不再加列，
   KPI 卡被撑成 616px 宽的巨无霸。

**改法**（与 Ant Design Pro / shadcn / GitHub / Linear 一致的路线）：

- **根字号回到固定的 16px**，不再随视口缩放；`tokens.css` 里删除 `--n-ui-scale`
  与 `--n-chrome-zoom`，`.n-chrome` 退化为纯语义标记
- **内容宽度分级放宽**：1440 时 1500 收口（与设计稿一致）→ 1680 档 1600 →
  1920 档 1760 → 2240 档 2048 → 2560 档 2200 封顶。1440~2850 之间内容始终占
  可用宽度的 84%~88%，既不会全挤中间，也不会铺成一条读不完的长行
- **新增宽屏断点** `3xl`(1920) / `4xl`(2560)：宽屏真正需要的是「更多列」，
  页面可以直接写 `4xl:grid-cols-6`
- **移除 `useDesignScale()` / `readDesignScale()` 与图表字号缩放**：
  `sx()` 保留（数字尺寸统一转 rem 的书写约定），但不再随视口变化；
  虚拟表格改用行高本值，Dropdown/Tooltip 去掉外框补偿分支

**验收**（`scripts/verify-final.mjs`，4 路由 × 4 宽度 × 明暗）：

| 视口 | 根字号 | 内容宽 | 填充率 | 横向溢出 | 侧栏 | 顶栏 |
| ---- | ------ | ------ | ------ | -------- | ---- | ---- |
| 1440 | 16px   | 1204   | 84%    | 0        | 236  | 56   |
| 1920 | 16px   | 1684   | 88%    | 0        | 236  | 56   |
| 2560 | 16px   | 2200   | 86%    | 0        | 236  | 56   |
| 2850 | 16px   | 2200   | 77%    | 0        | 236  | 56   |

全程零控制台错误；1440 下与原设计稿像素级一致。

### 重做：AI 运营助手（全高抽屉 / 多会话 / 思考链）

- **浮层改为右侧全高抽屉**：从顶到底占满视口、贴右缘，不再是一张浮在右上角的小卡片；
  对话区可用高度翻倍，长回答与页面预览不再被压成一条缝。桌面端**不做遮罩**（助手是「边看边问」的工具），
  移动端退化为覆盖式抽屉
- **宽度可拖拽并记忆**：默认 552px（380–880 之间可调，双击手柄复位），写进 `nexus-ai-panel`；
  另有「加宽为整屏」一键切换
- **去 AI 味**：删掉渐变机器人头像、品牌色气泡与发光阴影；助手身份改用品牌字标，
  消息改用中性底 + 细描边 + 留白分区，页面预览卡也从品牌色块改为中性底（品牌色只留给「应用到侧边栏」）
- **用户身份接真实账号**：用户消息显示当前登录账号的姓名与头像（无头像用姓名首字），不再是写死的「我」
- **多会话**：新建 / 切换 / 重命名 / 置顶 / 删除，会话列可展开（抽屉整体变宽，不遮挡页面）；
  标题由首条输入自动生成，列表带最近一句预览；历史落 `nexus-ai-sessions`，刷新回到上次那段对话
- **思考链**：模型侧接 `reasoning_content` 流式回显，本地引擎则如实写出「意图判定 / 选型 / 改写范围」；
  默认折叠、流式中自动展开，结束后标注「已思考 x.x s · n 条推理」
- **工具调用可视化**：每条工具一行（状态 / 名称 / 耗时），展开看原始参数与结果，写失败标红
- **模型信息**：消息级「模型 · 耗时 · 工具数」元信息与其一键复制
- **命令面板新增「打开 AI 运营助手」**：就地打开抽屉而不跳路由，保住当前页上下文
- **内核（`@nexus/ai-sdk`）**：新增 `AssistantHistoryPort`、`createSession` / `switchSession` /
  `deleteSession` / `renameSession` / `pinSession`、`snapshot.sessions`、`reasoning` / `thinkingMs` 字段与
  `assistant-reasoning` 事件；切换会话会中止在途请求，会话自带上一次的「当前页面」，切回去能接着改
- **测试**：`assistant.test.ts` 从 8 条扩到 14 条（多会话、思考链、历史落盘与还原、页面上下文隔离）
- **验收脚本**：新增 `scripts/verify-assistant-drawer.mjs`（抽屉几何断言 + 多会话 + 思考链 + 宽度记忆）

### 新增：六种菜单布局（外观设置 → 布局）

- **`menuLayout` 取代原 `sidebarVariant`**：垂直 / 双列 / 水平 / 混合 / 悬浮 / 侧边栏六档，
  由 `data-menu-layout` 驱动，与皮肤、强调色、整体布局正交组合
  - `vertical`：整高侧栏承载全部导航，折叠成图标轨道（原 attached / panel 的合并形态）
  - `dual`：模块导轨 + 当前模块子菜单两列并列；折叠时第二列**收成一列图标**（不是消失），
    保留当前模块的入口，悬浮标签补齐文字
  - `horizontal`：模块全部横排进顶栏，悬停展开下拉，不占侧边空间
  - `mixed`：顶栏切换模块，侧栏只放当前模块的子菜单
  - `floating`：导航与内容是两张独立的圆角卡片，整屏等距留白（原 floating 的升级形态）
  - `sidebar`：顶栏通栏在最上方，侧栏从它下沿开始（L 形）
- **外观面板「布局」页签**：线框缩略图选择器（`layout/menu-layout.tsx`），
  顶部实时预览会跟着布局变形，不再只切一个静止的小图
- **系统设置页同步**：外观分组新增「菜单布局」卡片，与抽屉共用同一组件与同一 store
- **导航渲染层抽离**：`layout/sidebar-nav.tsx`（`SidebarNav` / `SingleModuleNav` / `ModuleRail`）
  与 `layout/top-nav.tsx`（水平 / 混合的顶部菜单），外壳只负责摆放
  - 顶部菜单面板 **portal 到 body**：顶栏为容纳全部模块必须 `overflow-x-auto`，
    而 CSS 的滚动容器会隐式裁切另一个轴，绝对定位面板会被裁掉（表现为「点了没反应」）；
    改为 `fixed` + 实测坐标，限高 `min(70vh, 34rem)` 内部滚动，超视口时翻到上方
- **高亮判定收敛到 `core/module.ts`**：新增 `isPathWithin` / `isNodeActive` / `isNavActive` /
  `flattenLeaves` / `firstLeafPath` / `findActiveModule`，
  侧栏、顶部菜单与双列导轨共用一套判定（含 9 条新增单测）
- **持久化迁移 v4 → v5**：旧 `sidebarVariant` 中的 `floating` 映射到 `floating`，其余回落 `vertical`；
  `index.html` 首屏脚本同步写 `data-menu-layout`，避免刷新时布局跳一下
- **移动端回退**：六种布局在 <768px 统一成「抽屉 + 垂直菜单」；通栏布局的 Logo 已进顶栏，侧栏不再重复一次品牌头
- **自检脚本**：
  - `scripts/verify-menu-layout.mjs`：六布局结构断言 + 截图（浅色 / `--dark`）
  - `scripts/_menu-layout-matrix.mjs`：6 种菜单布局 × 3 种整体布局共 18 组合，逐格校验溢出 / 主内容区 / 顶栏
  - `scripts/_menu-layout-check.mjs`：交互语义（折叠宽度、导轨切模块、顶部菜单悬停、混合布局切换）+ `--mobile` 移动端回退
  - `scripts/_menu-layout-en.mjs`：英文模式下六张卡片标签与提示无中文残留

### 新增：自研无限画布（内容创作向）

#### 第二轮反馈落地

| 反馈                               | 落地                                                                                                                                                                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 小地图拖动不行，而且会同时拖动画布 | `CanvasMinimap` 重写：指针事件全量 `stopPropagation` + `setPointerCapture`，用 ref 记录拖拽态（不再依赖 `event.buttons`，避免「拖一下就停」）；容器与 `<svg>` 双层拦截，拖动连续跳转；新增两条断言（相机确实变化、画布没有被框选）     |
| 编组改为底部菜单                   | 编组/解组移到**底部选中工具条**首位（多选后的自然位置）；右键菜单与卡片顶部菜单保留同一入口；新增 `⌘G` / `⇧⌘G` 快捷键                                                                                                                  |
| 多选时支持编组                     | 选中 ≥ 2 个节点即可编组：成员打 `groupId`，外面生成虚线分组框（locked + 最低 z）；拖动分组框成员整体跟随；成员增删后 `recountGroups` 统一重算框体（只扩不缩，避免抖动）；点分组标题 = 整组选中                                         |
| 每个卡片实现顶部菜单               | 新增 `CanvasNodeToolbar`，通过 `CanvasNodeFrame.topMenu` 覆盖在标题栏右侧（带渐隐遮罩，不遮标题），hover / 选中时出现；含 AI、编辑、复制、锁定、置于顶层、编组/解组、删除；所有按钮 `onPointerDown` 阻止冒泡，避免「点按钮变成拖节点」 |
| AI 内容显示在卡片底部              | 新增 `CanvasAIDock`，通过 `CanvasNodeFrame.dock` 渲染在 frame 层级：点节点即在卡片底部展开输入区，回答就地流式显示，可「应用到节点」「另存为子节点」；小卡片自动 `compact`；`autoClose` 应用后收起                                     |

#### 第四轮：双击语义修正

- **双击空白不再新建文本节点**。双击是「打开/编辑已有内容」的通用手势，兼作「新建」
  必然误触：想编辑一张卡片、点偏一格就多出一张空卡。新建统一走左侧素材库或右键菜单
  （两者都在 help-dialog 与文档里写明）。
- **文本卡片双击进入就地编辑**，且进入前先收起底部 AI 输入区 —— 输入区默认展开时会盖住
  卡片下半部分，用户双击落在输入区上会以为「双击没反应」（这是上一轮反馈的实际成因）。
  同时给 `CanvasAIDock` 加了 `onDoubleClickBody`：双击面板空白处也转交宿主去编辑，
  只有在输入框/按钮上的双击才被吞掉。
- 回归断言从「双击空白仍可新建」改为：`双击文本卡片进入就地编辑`、`双击空白不会新建节点`、
  `素材库仍可新建节点`（三点合起来才能证明「改对了且没改坏」）。

#### 第三轮：双击误建节点 + 小地图不丝滑

| 现象                           | 根因                                                                                                                                                                                                         | 修法                                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 双击卡片会凭空多出一个文本节点 | 画布在 `pointerdown` 时对根容器 `setPointerCapture`，双击里的 click / dblclick 被派发到**捕获元素**上，`event.target` 不再指向节点；旧实现只靠 `closest` 判断，把「双击卡片」判成「双击空白」                | 双击归属优先取 `pointerdown` 瞬间记录的命中节点（`downNodeRef`），`target` 只作兜底                                                                           |
| 小地图拖起来发黏、跟不上       | ① 每次 `pointermove` 都走 `animateTo`（320ms 缓动），下一次 move 立刻打断上一次 → 表现为「拖了没反应、动一下又卡住」；② minimap 自己 rAF 合帧 → 再交给画布 schedule 合帧，等于两次缓冲，指针到画面最多差两帧 | ① `onJump` 增加 `{ dragging }` 元信息：拖动中**直接写相机**（相机 store 逐帧合并），松手才做一次平滑收尾；② 去掉 minimap 侧多余的 rAF，只保留画布侧那一层合并 |

回归断言（`verify-canvas.mjs`）新增 3 条：

- `小地图连续拖动逐段跟手（非跳变）`：连续 6 段位移采样，要求至少 4 帧世界层 transform 不同；
- `双击卡片不会凭空新增节点`：节点数 10 → 10；
- `双击空白仍可新建文本节点`：10 → 11（对照，确保修复没有把功能一起关掉）。

- **AI 输入区悬空一截**：children 落在 `.n-canvas-content`（带 `contain: layout`）里，会成为绝对定位后代的包含块，`bottom: 0` 对齐的是内容区底部而不是卡片底部。改为 `dock` 槽位渲染在 frame 层级后对齐正确。
- **顶部菜单盖住标题**：早先是 `inset: 0` 全宽覆盖，分组框上只剩「解组」两个字。改为只占右侧一段 + 左→右渐隐遮罩。
- **底部工具条挤压换行**：加宽后「编组/解组/水平居中」被压成两行。统一 `whitespace-nowrap` + `shrink-0`。
- **右键菜单被动画顶偏**：复用了带 `-50%` 位移的 `n-fade-in`（那是给下拉菜单的），整块被顶掉一半高度。换成独立的 `n-canvas-menu-in`，并加了「菜单必须完整落在画布内」的断言。

验收：`node scripts/verify-canvas.mjs` **30/30** 通过（浅色 / 深色各一遍），
覆盖卡片底部 AI 输入区定位、小地图拖动不串扰、编组/解组、顶部菜单可见性与按钮数。

一套**零第三方依赖**的画布子系统，落在 `packages/ui/src/canvas/`（16 个模块），
外加一个可直接复用的演示页 `/templates/infinite-canvas`（侧边栏「工作流设计器」下方）。

**组件（@nexus/ui 新增导出）**

- `InfiniteCanvas`：相机、手势、剔除、框选、吸附、连线拖拽、右键菜单、LOD 聚合
- `CanvasNodeFrame`：统一节点外壳（标题栏 / 类型徽标 / AI 药丸 / 锁定态 / AI 处理流光 / 选中光环）
- `CanvasAIPopover`：锚定节点的 AI 对话框（思考步骤 → 逐字流式 → 应用到节点 / 另存为子节点）
- `CanvasContextMenu`：分组 + 子菜单 + 键盘导航（↑↓ / → / ← / Esc）+ 位置夹取
- `CanvasNodeToolbar`：卡片顶部菜单（hover / 选中时覆盖标题栏右侧）
- `CanvasAIDock`：卡片底部 AI 输入区（就地展开、流式回答、应用到节点）
- `CanvasMinimap` / `CanvasControls` / `CanvasBackground`
- 内核：`SpatialIndex`、`edgeGeometry`（贝塞尔 / 正交圆角 / 直线）、`createHistory`、`createCameraStore`

**性能**

- 手势期间不 setState：相机只写 store，世界层与背景直接改 CSS
- 拖动节点只写 `--c-dx/--c-dy`，松手才提交坐标；连线拖动中实时改 `path`
- 512px 均匀网格剔除；缩到 30% 以下按屏幕网格 LOD 聚合成色块
- 实测（`node scripts/verify-canvas.mjs`）：1,000 节点压测挂载 **84** 个、交互 **60fps**、0 控制台错误

**演示页**

- 三套场景：品牌短片分镜 / 产品情绪板 / AI 生成工作流
- 六类节点：文本、图片、视频、便签、提示词、分组框（素材程序化生成，零版权风险）
- 右键菜单覆盖 AI 编辑、编辑内容、复制、锁定、层级、对齐、添加节点、聚焦、删除；
  连线右键可换形态/标签/虚线；空白右键含添加、撤销重做、全选适配、网格、压测、帮助
- 撤销重做（600ms 合并窗口）、localStorage 持久化、1,000 节点压力测试、FPS 与挂载数 HUD

**接入**

- 组件橱窗新增 **Canvas 分类**（6 个条目，均为真实可交互 demo）
- 模板总览新增卡片；i18n 补 `nav.templateInfiniteCanvas`；文档站新增
  `components/canvas.md` 与 `templates/infinite-canvas.md`

### 新增：数据大屏从 4 块扩展到 8 块

模板中心原本只有 4 块屏（运营 / 运维 / 财务 / 仓储）。这次补齐了 4 块**面向不同行业场景**的大屏，并顺手把大屏的公共结构件抽成原语，让「新增一块屏」变成三处小改动。

- **新增大屏（4 块）**
  - **城市运行大屏** `/templates/screen-city`：8×12 网格热力（点击任一格联动右侧详情）、实时事件流（每 2.6s 推一条，hover 暂停）、事件量与处置时长双轴 + 20 分钟时限线、处置单位排行、资源水位与市民满意度。暗夜紫配色。
  - **生产制造大屏** `/templates/screen-manufacturing`：OEE gauge、产线点击联动（OEE / 合格率 / 节拍 / 工位矩阵同时切换）、产量柱按目标分色 + 目标线、停机损失环、不良类型、安灯呼叫、4 条产线工位四态矩阵。浅灰车间配色（强光厂房里深色屏反光严重）。
  - **大促战报大屏** `/templates/screen-campaign`：每 2.4s 跳动的 GMV、波次倒计时（进度条 = 当前波次时间进度）、分时 GMV 与订单双轴、渠道环、雷达对比去年、品类 PK、爆款售罄进度（>90% 自动变红）、波次战报时间线。红金配色。
  - **智算中心大屏** `/templates/screen-compute`：6 节点 × 8 卡阵热力（柱高 = 利用率、颜色 = 状态，点卡联动单卡详情）、Token 吞吐与队列双轴（`useLiveSeries` 实时推进）、模型调用分布、租户配额（>85% 变黄）、模型服务明细与平台事件。深空紫配色。
- **大屏公共原语** `pages/screen-primitives.tsx`：新增 `RefreshAction`（自带转圈）、`Segmented`（时间范围切换）、`Dot`（图例点）、`useLiveSeries`（假实时采集点）；`FullscreenAction` 改为跟随全屏状态切换图标与文案；`Delta` 增加 `invert`（成本 / 延迟 / 告警下降算好事）。
- **`screen-meta.ts` 成为唯一事实来源**：新增 `load` 字段做动态 `import`，`module.ts` 的 8 条 `standalone` 路由由 `SCREENS.map` 生成 —— 新增一块屏不再需要改 `module.ts`。
- **大屏选型页重做** `screen-gallery-page.tsx`：卡片网格改 3 列；每块屏有自己的**版式骨架预览**（运营是趋势、运维是主机格、财务是白卡、仓储是地图连线、城市是网格、制造是产线进度 + 工位、大促是 Hero 数字 + 售罄条、算力是节点 × 卡阵）；顶部加「全部 / 深色 / 浅色」筛选。
- **i18n**：补 `nav.templateScreenCity` / `templateScreenManufacturing` / `templateScreenCampaign` / `templateScreenCompute` 中英词条，并在 `NAV_KEY_BY_PATH` 注册 4 条新路径。
- **文档**：文档站侧栏补 4 页（`/templates/city` / `manufacturing` / `campaign` / `compute`），`templates/overview.md` 重写为「8 块大屏 + 6 个业务页面 + 新增一块屏要动哪里」；README 的模板中心表格与截图同步。
- **脚本**：`scripts/verify-screens.mjs` 扩到 8 块屏；`scripts/screenshot.mjs` 增补 4 条路由（36–39）。

### 新增：开发指南（替代原「帮助中心」弹窗）

- **新模块 `guide`**（`/guide/*`，侧边栏底部常驻入口，`section: 'demo'`，`order: 45`）
  - `/guide/overview`：一次请求的完整链路（页面 → 数据层 → 传输层 → 后端）、7 个关键文件职责表、推荐上手顺序
  - `/guide/backend`：**完整接入后端教程**，11 个步骤 + 18 段可复制代码：基地址 / 关 Mock / 鉴权适配器 / 人机验证（Turnstile）/ 响应契约 / 数据层替换 / 权限两端一致 / 错误处理 / Vite 代理与 Nginx 反代 / 跨域 / 自查清单
  - `/guide/module`：两个文件加一个模块，含 `ModuleDefinition` / `ModuleRoute` / `NavNode` 字段速查表
  - `/guide/contract`：17 个接口的契约（方法 / 路径 / 参数 / 请求体 / 响应示例），支持搜索与分组过滤
- **通用组件** `modules/guide/components.tsx`：`GuidePage`（左正文 + 右目录，IntersectionObserver 高亮）、`GuideSection` / `GuideStep` / `GuideNote` / `CodeTabs` / `FileRef` / `Level` / `GuideNext`
- **入口迁移**：`SidebarFooter` 的弹窗改为直达 `/guide/overview`；命令面板「查看帮助与文档」补上 `path: '/guide/backend'`（原条目没有路径，选中后什么都不发生）
- **词条**：删掉 7 条只有弹窗在用的 `help.*` 与 `command.subtitleSupport`；新增 `nav.developerGuide` / `nav.guideOverview` / `nav.guideBackend` / `nav.guideModule` / `nav.guideContract` / `nav.guideTip`

### 新增：开发指南补齐 SDK 与组件库（7 页）

在原有 4 页之上补 3 页，并新增侧栏二级分组「SDK 与组件库」：

- `/guide/ai-sdk`：**`@nexus/ai-sdk` 完整教程**（8 节，16 段代码）
  - PageSpec / PageTheme / PageNav 契约与七种区块、归一化规则与静默截断上限
  - `createOpenAICompatibleTransport` 的配置字段、请求体、SSE 与工具增量累积、`TransportError`
  - 6 个内置工具、`ToolDefinition` 自定义写法、`AssistantApiOperation` 接口注册表
  - 本地降级引擎（`planLocally` / `detectIntent`）的能力边界
  - `AssistantCore` 的全部公开方法（并纠正旧文档里不存在的 `regenerate` / `stop` / `newSession` 叫法）
  - 宿主接入四个端口 + 20 行最小接入、扩展点、**12 条源码级坑**（`apply_page` 不落地、`patchPageSpec` 的 accent 三态、`configure({ tools })` 是替换、只带最近 8 条消息等）
- `/guide/ui-kit`：`@nexus/ui` 的结构与约定（7 节，11 段代码）
  - 真实依赖（只有 clsx + tailwind-merge）、`index.ts` 为何不用 `export *`、目录分层
  - 三层令牌体系与「不要写 bg-white」这类深色陷阱、`data-*` 驱动的密度 / 圆角 / 配色
  - `useControllableState` 双模原理与「受控时忘了 onChange 会点不动」
  - 文案注入（`configureUILabels`）、无障碍清单、新增组件三步、8 条 code review 禁忌
- `/guide/workflow`：7 步改动闭环 + 5 道门禁 + 验收脚本写法 + 提交规范与发布前清单
- **词条**：新增 `nav.guideGroupSdk` / `nav.guideAiSdk` / `nav.guideUiKit` / `nav.guideWorkflow`；`GROUP_KEY_BY_KEY` 补 `group-sdk`

### 新增：组件橱窗补齐 Charts / Hooks / Banner 分类

- **Charts 分类（8 条，应用层 `EChart` 封装）**：折线 / 面积、柱状、饼 / 环、雷达、仪表盘、漏斗 / 排行、`ChartTokens` 主题令牌、写法约定
  - 每条都是真实 ECharts 实例，带交互切换；顺手验证深浅色切换后图表颜色正确
- **Hooks 分类（9 条，`@nexus/ui` 的底层能力）**：`useControllableState`、`useBreakpoint`、`useClickOutside`、`useElementSize`、`useLocalStorageState` / `useCountdown`、`useHotkey`、`sx` / `useDesignScale`、纯函数、`configureUILabels`
  - 都是可操作演示（真的按快捷键、真的拖动窗口量尺寸、真的写 localStorage），不是静态说明
- 另补 **Banner 分类（5 条，区块级横幅版式）**：页面级公告、数据来源声明、升级提醒、试用到期、维护窗口，比 Alert 更重、比 SectionCard 更轻
- 总条目 77 → **105**，分类 8 → **12**：`Basic / Form / Data / Charts / Feedback / Banner / Navigation / Layout / Canvas / Hooks / Utility / Premium`

### 重做：组件总览改为 Element Plus 式橱窗

- **页面**：`modules/components/pages/gallery-page.tsx` 替代原 `overview-page.tsx`
  - 左侧常驻组件索引（当前 12 分类 / 117 条目），滚动用 `IntersectionObserver` 高亮当前分类，点击平滑滚动
  - 顶部大搜索框：分类名、英文名、中文名、说明、拼音关键字与 Props 名都参与匹配（`fuzzyMatch` + `includes` 双通道）
  - 主体按分类分段，标题带计数徽标；卡片是**真实渲染**的组件（不是截图），悬浮出现「用法」
  - 详情弹窗：用法示例（`CodeBlock`）+ Props 表（属性 / 类型 / 默认 / 说明）；`key={item.key}` 重挂载保证每次打开回到用法页
- **数据层**：`modules/components/gallery/{types,registry,basic,form,data,charts,banner,feedback,more,runtime}.tsx`
  - 105 个条目，每条声明 `name / nameZh / summary / demo / code / props / keywords / wide / previewHeight`
  - 新增组件 = 在对应分类文件里加一条声明，页面零改动

### 修复

- **`VITE_API_BASE` 不生效**（`core/http.ts`）：`DEFAULT_BASE_URL` 之前写死 `'/api'`，与 README / 文档站的指引矛盾；现在真正读取环境变量。同时 `buildURL` 之前无条件返回 `pathname + search`，会把跨域绝对地址静默降级成同源请求（照着文档接后端会得到 404），现在按 base 是否带协议区分。
- **截图脚本在 HMR 下超时**（`scripts/shot.mjs` / `screenshot.mjs`）：等待策略由 `networkidle` 改为 `domcontentloaded` + 显式等待，并补上 `--login` / `--full` / `--dark` 参数。
- **教程页代码块并排过窄**：`grid lg:grid-cols-2` 会让两段代码各占半屏、长行被横向截断，统一改为整宽堆叠。
- **组件总览标题右侧的英文**：原来写的是 `Overview`，与页内其它「总览」字样重复；改为项目名 **Nexus Admin**，让页面标题同时承担品牌识别。

### 验收

- 新增 `scripts/verify-gallery-guide.mjs`（**30 项断言**：侧栏入口 / 橱窗卡片数 / 索引条目 / 搜索过滤 / 详情弹窗 / Props / 中文搜索 / **指南 7 页渲染 + 每页代码块数量** / 二级分组入口 / **12 分类齐全** / 目录 / 深色）
- 新增 `scripts/verify-i18n-smoke.mjs`（英文模式下指南 7 页与组件总览无缺词条）
- `pnpm typecheck` / `pnpm lint`（新增代码 0 error）/ `pnpm test`（全部通过）✅；`node scripts/screenshot.mjs` 42 个路由 0 控制台错误

### 新增：AI 运营助手（SDK 架构 + 零代码页面）

- **`@nexus/ai-sdk`（新包）**：纯 TypeScript 助手内核，零 React / 零后端依赖
  - `page-spec.ts`：`PageSpec` 契约（KPI / 图表 / 表格 / 清单 / 进度 / 步骤 / 文本）+ 归一化 + 内置模板
  - `transport.ts`：OpenAI Chat Completions 兼容流式传输；**按 index 累积分片的工具调用参数**（否则拿到半截 JSON）
  - `tools.ts`：`create_page` / `update_page` / `apply_page` / `list_api_operations` / `call_api` / `explain_backend_integration`
  - `planner.ts`：本地降级引擎（网关不可达时仍能生成页面、改配色、查接口），只是兜底不是默认路径
  - `assistant.ts`：工具循环（最多 3 轮）、`AssistantCore` 外部 store、后端操作注册表与单例装配
- **顶栏入口 + 右侧全高抽屉**：`BotMessageSquare` 风格按钮常驻顶栏，`Ctrl/⌘ + J` 唤起；
  抽屉贴右缘、宽度可拖拽并持久化（默认 552px），桌面端不做遮罩（边看边问）、ESC 关闭；
  移动端退化为覆盖式抽屉；内部可展开会话列（新建 / 切换 / 重命名 / 置顶 / 删除）
- **工作台**：`/assistant/workspace` 四页签（对话 / 页面预览 / 接口接入 / 使用说明），与抽屉共享同一会话
- **零代码落地链路**：生成 → 预览（与正式页共用 `page-renderer`）→「应用到侧边栏」→ 侧栏出现「AI 生成」分组 → 刷新不丢
  - 路由用一条 `/generated/$` 通配路由承接全部生成页，应用页面不需要重建路由树
  - 页面库持久化在 `localStorage`（`nexus-ai-pages`），上限 20 页，同路径自动补序号
- **后端交给助手**：客户只改 `apps/admin/src/ai/api-operations.ts`；执行器默认接到 `core/http`，
  可 `configureAssistantApiExecutor()` 整体替换，或给单条操作写 `run`；写操作标 `mutating: true` 会在界面标红
- **接口接入面板**：把「已登记接口清单」和「可复制的代码示例」并排展示，判断依据是运行时注册表而非写死文案
- **同源 AI 网关 + 供应商回退链**：`scripts/ai-gateway.mjs` 转发 `/ai-gateway/*` 到真实模型服务
  - 回退顺序：`opencode`（有 `OPENCODE_API_KEY`）→ `custom`（有 `AI_API_KEY` + `AI_UPSTREAM`）→
    `pollinations`（**免密钥**，始终可用）。401/402/403/429/5xx 自动换下一家，全失败才报错
  - 密钥只在服务端，`VITE_*` 一律不进浏览器包；`x-opencode-session` 只发给识别它的供应商
  - 免密钥通道有「每 IP 45 秒 1 条」的公益额度，网关据此把工具轮次压到 1（一轮调用即收尾），
    配了 ① 后恢复 3 轮；这个差异通过 `/ai-gateway/health.maxToolRounds` 下发，前端不猜
  - `/ai-gateway/health` 恒 200 + `ok` 字段：探活失败不再留一条红色 503 把真错误淹没；
    前端把 `ok` 映射成 `ready`（早期版本漏了映射，导致「网关明明能用、界面却一直显示本地引擎」）
  - 空 `tools: []` 会被部分网关判成非法（Pollinations 回 `usage_missing`），网关统一删字段而不是传空数组
  - dev 挂在 Vite 中间件（`pnpm dev` 一条命令），生产可 `pnpm ai:gateway` 独立跑，或用自建 BFF 实现同样三个路由
- **i18n**：新增 60+ 条 `assistant.*` 词条（中英严格对齐）；`nav.assistant` / `nav.assistantWorkspace` 接入导航投影
- **测试与验收**：`@nexus/ai-sdk` 48 个用例（规格归一化 / 规划器 / 传输层分片 / 工具 / 内核）；
  `scripts/verify-assistant.mjs` 8 步交互全链路（顶栏入口 → 生成 → 应用 → 正式页 → 改配色 → 接入说明 → 接口面板 → 深色态）；
  `scripts/verify-assistant-llm.mjs` 真模型链路（断言引擎角标已从「本地引擎」切到模型名、观测到真实网关请求）；
  `scripts/check-assistant-responsive.mjs` 覆盖 320–1920 共 10 档宽度
- **文档**：`docs/AI-ASSISTANT.md`、文档站 `/guide/assistant`、`.env.example` 补齐三家供应商配置

### 修复（顶栏响应式与移动端）

- **移动端顶栏多占一行**：原先在顶栏上方单独渲染了一个 `md:hidden` 的抽屉按钮容器，窄屏时顶栏被挤到第二行（页面整体下移 28px）。现删除该容器，抽屉开关并入顶栏，与桌面端共用同一个 32×32 图标按钮
- **侧栏开关的位置**：顶栏开关固定渲染在搜索入口**左侧**（`Topbar` 的 `navToggle` 属性），移动端不再出现「开关在上、搜索在下」的错位
- **移动端搜索框占位文案溢出**：窄屏下搜索入口退化为纯图标按钮（无描边、无占位文案、无 ⌘K 提示），点击直接唤起命令面板；`md` 起恢复描边搜索框。320px 起各档均无横向溢出

### 新增（第二轮：视觉与交互升级）

- **主题设置面板** `layout/theme-panel.tsx`：一套可视化外观控制台
  - 主题模式（浅色/深色/跟随系统）带缩略图预览
  - 10 组渐变配色预设（品牌蓝、极光紫、翡翠绿、琥珀橙、玫瑰红、玫瑰花园、海风、日落霞光、森林低语、薰衣草梦）
  - 字体（跟随系统/无衬线/衬线/等宽）、圆角 5 档、密度 4 档
  - 侧边栏 3 形态（贴合/浮动/面板）、布局 3 种、内容宽度、LTR/RTL
  - 语言切换、多页签开关、动效偏好（跟随系统/始终开启/减少）
- **零依赖 i18n**：`i18n/index.ts`（词典 + 插值 + `useI18n`）+ `locales/zh.ts` / `locales/en.ts`（`en` 的类型来自 `zh`，漏译编译期报错）
  - `i18n/modules.ts` 做「导航 / 路由 / 页签标题」的多语言投影，业务代码无需逐处 `t()`
  - 侧边栏分组、页签、命令面板、顶栏、登录页、主题面板全部双语
- **个人资料页** `/account/profile`：身份卡 + 基本信息（可复制）+ 账号安全 + 登录设备 + 登录历史时间线
  - 新增 `modules/account`（`nav: []`，只贡献路由，从顶栏头像菜单进入）
- **应用图标与登录页**：`public/favicon.svg` 重做为圆角方形 + 品牌渐变的 N 字标；新增 `manifest.webmanifest`
- **动效体系**：`.n-page-enter`（页面级入场）、`.n-stagger`（卡片逐个入场）、`data-motion` 应用内动效开关
- **动画时长调整**：主题圆形扩散 460ms → 720ms，缓动 `cubic-bezier(0.22,1,0.36,1)`

### 变更（第二轮）

- **侧边栏与顶栏同底色、去分割线**：只在内容区左侧保留一条 `md:border-l`
- **折叠按钮常驻**：从 hover 手柄改为顶栏搜索框左侧的常驻按钮
- **顶栏精简**：删除快捷键图标按钮，图标按钮统一 32×32；新增语言切换按钮
- **页签栏重写**：跟随激活项滚动（`scrollIntoView inline:'nearest'`）、溢出渐隐、所有页签（含经营概览）均可关闭
- **侧边栏底部**：删除用户信息与多余按钮，只保留「帮助中心」
- **路由骨架**：`RoutePending` 重写为与真实页面同构的骨架（KPI 行 + 图表 + 侧栏），新增 `RouteTablePending`；预加载延迟 60ms → 40ms
- **减少动效策略**：不再用全局 `!important` 把动画压到 0，改为「压缩但不消失」，并允许应用内显式覆盖

### 修复（第二轮）

- **日夜切换"没有特效"**：Windows 关闭「显示动画」时 Chromium 报告 `prefers-reduced-motion: reduce`，早期实现直接跳过动画。现在用户主动点击的主题切换**始终播放**，reduce 下压到 420ms
- **切换语言后页签标题不更新**：页签标题改由 i18n 投影生成，并在语言变化时同步
- **`settings-page` 与 store 枚举不同步**：`radius: 'square'` → `'none'`，密度补齐 4 档，强调色改为从 `ACCENT_PRESETS` 派生
- **个人资料页渲染期调用 `Date.now()`**：改为模块级基准时刻，满足 React Compiler 的 purity 规则

### 新增（第一轮）

- **模板中心（`templates` 模块）**：6 个可直接复用的完整页面骨架
  - `实时运营大屏`：全深色投屏布局、假实时数据流（可换 WebSocket）、日志流 hover 暂停、SLO 环形指标
  - `项目看板`：原生 HTML5 拖拽、列内精确排序、WIP 超限告警（不阻止动作）
  - `甘特图排期`：CSS Grid + 绝对定位任务条、今天指示线自动定位、周/月/季三档缩放
  - `AI 助手对话`：逐字流式渲染（cursor 数字驱动，不拼字符串）、停止生成、引用来源展开、复制与反馈
  - `工作流设计器`：DOM 节点 + SVG 贝塞尔连线、拖拽时只写 CSS 变量不重渲染、右侧属性面板联动
  - `文件管理器`：网格/列表双视图、拖拽上传（计数器避免闪烁）、文件夹树与预览面板联动
- **侧边栏分组可折叠**：所有模块分组带箭头可收起/展开，状态写入 `nexus-ui-prefs` 持久化；子项缩进 + 左侧引导线形成层级错位
- **图标态平铺导航**：侧栏收起时不再只显示 6 个「组图标」，而是平铺所有叶子菜单（保留分组分割线）
- **用户表格列设置**：真实可用的列显隐开关，`useLocalStorageState` 持久化，「操作」列锁定不可隐藏
- **i18n 词典**：补齐 `zh` / `en` 双语词条（190+ key），`en` 的类型来自 `zh`，漏译会在编译期报错

### 修复

- **Tooltip 背景透明**：`bg-inverse` 类此前未在 `@theme` 中注册，气泡只有文字反色而背景缺失。新增 `--n-bg-inverse` / `--color-inverse` 令牌，深浅色各自取值
- **`DataTable` 的 `pinned` 是空声明**：类型上有 `pinned?: boolean` 但渲染完全忽略。现已实现左右固定列（`'left'` / `'right'` / `true` 等价右侧），并补齐横向溢出所需的最小宽度
- **`Tree` 键盘不可用**：注释声称支持 ↑↓→← 与 Enter，实际没有 `onKeyDown`。现已按 WAI-ARIA tree 模式实现完整键盘导航（含 Home / End、disabled 跳过、焦点与选中解耦）
- **`FormField` 标签未与控件关联**：全项目 `htmlFor` 零调用，点击标签不聚焦、屏幕阅读器读不到字段名与错误。现由 `FieldContext` 自动下发 `id` / `aria-describedby` / `aria-invalid` / `aria-required` / `aria-labelledby`
- **控件双重描边**：输入类控件同时命中浏览器默认 `outline` 与外层 `focus-within` ring，聚焦时出现难看的双层蓝框。现在控件内部禁用默认 outline，由外层 ring 单独承担
- **侧边栏悬浮提示被裁切**：标签原本是 `nav` 内的绝对定位元素，被 `overflow-y-auto` 裁掉一半。改用 `createPortal` 挂到 `body` + `fixed` 实测坐标，并加指向三角与延迟淡入
- **滚动条挤压图标**：侧栏滚动条出现/消失会把图标推偏。`nav` 改用 `scrollbar-gutter: stable both-edges`，并让滚动条默认透明、hover 才淡入
- **移动端强制展开**：窄屏下侧栏是抽屉，图标态没有意义。用 `useMediaQuery` 屏蔽持久化的折叠偏好（不改写它，回到桌面端仍还原）

### 变更

- `Column.pinned` 类型从 `boolean` 扩展为 `boolean | 'left' | 'right'`（旧写法行为不变）
- 新增导出：`useFieldContext`、`pinnedSide`、`computeSticky`
- `Select` 补 `aria-activedescendant` 与选项 `id`，键盘高亮项现在能被屏幕阅读器播报
- `SegmentedControl` 的 `label` 放宽为 `ReactNode`，支持图标分段
- **移除重复演示**：`/components/templates` 业务模板页与模板中心内容重叠，已删除；模板相关内容统一收敛到 `templates` 模块
- 截图脚本路由同步更新，新增 6 个模板页截图

### 计划中

- 虚拟滚动支持分组行
- 表格列宽拖拽与列顺序调整

## [0.1.0] - 2026-11-04

首个可运行版本。

### 新增

- **模块化内核**：`defineModule` 协议，导航 / 路由 / 权限 / 面包屑 / 命令面板由同一份清单驱动
- **组件库 `@nexus/ui`**：40+ 零依赖组件
  - 基础：Button、Card、SectionCard、Badge、StatusDot、Tag、Avatar、Kbd
  - 表单：Input、Textarea、FormField、Select（单选/多选/搜索/分组）、Switch、Checkbox、RadioGroup、Slider、SegmentedControl、Transfer
  - 数据：DataTable、VirtualTable、Pagination、TableToolbar、Descriptions、Timeline、Tree、Steps、Collapse、Calendar、Progress、Meter、UploadList
  - 反馈：Dialog、ConfirmDialog、Drawer、Toast、Alert、Banner、EmptyState、Skeleton、Spinner
  - 导航：Tabs、SideTabs、Breadcrumb、Dropdown、Tooltip
  - 工具：ClipboardText、CopyButton、CodeBlock、HighlightText、SearchInput
- **业务模块**：工作台（概览 / 数据分析）、业务管理（用户 / 订单 / 内容）、组织与权限（架构 / 角色）、组件与示例（总览 / 表格 / 图表 / 表单 / 反馈 / 业务模板）、系统管理（审计 / 设置）、异常页（403 / 500）
- **设计令牌**：3 种主题模式 × 5 种强调色 × 4 档圆角 × 3 档密度，首帧内联脚本防闪白
- **数据层**：fetch 拦截式 Mock（无需 Service Worker）、React Query 缓存策略、统一 `http.ts` 传输层
- **权限**：权限码驱动菜单过滤、路由守卫与按钮禁用
- **工程化**：pnpm workspace、ESLint 9 扁平配置、Prettier、Vitest 单元测试、GitHub Actions CI、Issue / PR 模板
- **文档站**：VitePress，含指南、架构、组件三大部分

### 性能

- 路由级代码分割，每个页面独立 chunk
- ECharts 动态加载 + 按需注册（首屏不含图表库）
- 虚拟滚动表格：5,000 行保持 60fps
- CSS 变量主题切换，不触发组件重渲染
