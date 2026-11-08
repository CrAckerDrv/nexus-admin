# AI 运营助手（SDK 架构 + 零代码页面）

> 位置：顶栏右侧「AI 运营助手」按钮（`Ctrl/⌘ + J` 也可唤起）→ 右侧全高抽屉。
> 侧边栏「AI 助手 → AI 运营助手」是同一个会话的整页工作台。

抽屉的几个刻意设计：

- **贴右缘全高**：对话区可用高度翻倍，长回答与页面预览卡不再被压成一条缝
- **宽度可拖拽并记忆**：默认 552px，拖过就记住（`nexus-ai-panel`）
- **多会话**：左侧会话列可展开，支持新建 / 切换 / 重命名 / 置顶 / 删除
- **桌面端不做遮罩**：助手是「边看边问」的工具，点页面不关闭抽屉，只有 ESC 才收起；
  移动端退化为覆盖式抽屉（带淡遮罩）
- **去 AI 味**：不用渐变发光机器人，用品牌字标 + 中性色 + 细描边，与后台其它面板同一套语言

## 一、它解决什么

| 场景       | 用户怎么说                                       | 助手做了什么                               |
| ---------- | ------------------------------------------------ | ------------------------------------------ |
| 零代码开发 | 「帮我实现一个用户数据统计页面」                 | 生成页面规格 → 渲染预览 → 一键应用到侧边栏 |
| 页面微调   | 「把主色改成紫色」「圆角再大一点」「用紧凑密度」 | 改 `PageSpec.theme`，即时预览              |
| 结构修改   | 「再加一个明细表」                               | 追加区块并重绘                             |
| 后端接入   | 「怎么把后端接口交给助手」                       | 返回三步代码示例 + 当前寄存器清单          |
| 真实数据   | 「查一下用户列表」                               | 调用已注册的后端操作，回填到页面数据源     |

## 二、SDK 架构

```
packages/ai-sdk/            纯 TypeScript 内核，零 React / 零后端依赖
├── types.ts                消息、工具、事件、传输、多会话（历史端口）契约
├── page-spec.ts            PageSpec 定义 + 归一化 + 内置模板
├── transport.ts            OpenAI Chat Completions 兼容流式传输（含 reasoning_content）
├── tools.ts                内置工具（生成/调整/应用/接口清单/调用/接入说明）
├── planner.ts              本地引擎：无模型时的降级规划器
└── assistant.ts            AssistantCore：多会话、思考链、工具循环、订阅、注册表

apps/admin/src/ai/         应用侧装配层（唯一依赖路由与 core/http 的地方）
├── index.ts                传输层配置 + 执行器 + 页面端口 + React 绑定
├── history-store.ts        会话历史（localStorage `nexus-ai-sessions`）+ 持久化端口
├── panel-store.ts          抽屉开关 / 宽度 / 会话列展开（localStorage `nexus-ai-panel`）
├── page-store.ts           页面库（localStorage）+ 动态模块投影
├── api-operations.ts       ★ 客户唯一需要改的文件：登记后端接口
├── generated-page-route.tsx  /generated/$ 通配路由
└── components/             抽屉、会话列、对话流、消息零件、页面渲染器、接口接入面板
```

**为什么这样分**：内核完全不认识路由、localStorage、`core/http`。
换 UI 框架（Vue / 原生）时只需重写装配层；换后端只改执行器。

### 多会话与思考链（内核侧）

| 能力           | 内核 API                                                                               |
| -------------- | -------------------------------------------------------------------------------------- |
| 新建 / 切换    | `createSession()` / `switchSession(id)`                                                |
| 重命名 / 置顶  | `renameSession(id, title)` / `pinSession(id, pinned)`                                  |
| 删除           | `deleteSession(id)` —— 删的是对话，已生成页面不受影响                                  |
| 列表           | `snapshot.sessions: AssistantSessionSummary[]`（标题 / 预览 / 消息数 / 置顶）          |
| 落盘           | `config.history: AssistantHistoryPort { load, save }`，**只在消息边界**调用            |
| 思考链（模型） | 传输层 `onReasoning` → `snapshot.reasoningDraft` → 消息上的 `reasoning` / `thinkingMs` |
| 思考链（本地） | 规划器会把「意图判定 / 选型 / 改写范围」如实写出来，不是假装在推理                     |

两个刻意的取舍：

- **切换会话会中止正在生成的那一轮**：两个会话共用一条传输链路，串流会让两边都收到半截文本
- **会话自带上一次的「当前页面」**：切回旧会话接着说「把主色改成紫色」，改的是那段对话里的页面，
  而不是页面库里最新的一份

## 三、零代码是怎么做到的

模型**不生成 React 代码**，而是生成可序列化的 `PageSpec`：

```ts
interface PageSpec {
  id: string
  title: string
  path: string // 一定是 /generated/<slug>
  theme: { accent?; radius?; density?; surface? }
  nav: { group?; order?; badge? }
  blocks: PageBlock[] // kpi | chart | table | list | text | progress | steps
}
```

渲染侧只有一套受控实现（`ai/components/page-renderer.tsx`）：

- **对话预览**、**工作台预览**、**正式路由页**共用它，三处永远一致
- 未知区块类型被静默跳过；颜色只取设计令牌，不接收模型给的颜色值
- 因此不存在任意代码执行、样式失控、包体膨胀

**为什么不用「模型生成代码 + 沙箱执行」**：那要求把运行时编译（Babel/Sucrase）
打进产物、把预览隔离进 iframe，且失败模式是「白屏且不可解释」。
规格方案失败模式是「少一个区块」，可解释、可修。

## 四、把后端接口交给助手（三步）

### 1. 声明操作 —— `apps/admin/src/ai/api-operations.ts`

```ts
import { registerAssistantApi } from '@nexus/ai-sdk'

registerAssistantApi([
  {
    id: 'user_list', // 工具名 api_user_list
    title: '用户列表',
    description: '分页查询用户，支持关键字搜索',
    method: 'GET',
    path: '/users',
    params: { page: '页码', pageSize: '每页条数', keyword: '姓名/邮箱' },
  },
  {
    id: 'order_create',
    title: '创建订单',
    description: '新建一笔订单',
    method: 'POST',
    path: '/orders',
    body: { customer: '客户名', amount: 0 },
    mutating: true, // 写操作：界面标红并要求确认
  },
])
```

### 2. 执行器（已内置，通常不用改）

`src/ai/index.ts` 里已把执行器接到 `core/http`：

```ts
configureAssistantApiExecutor(async (operation, input) => {
  const data = await api.request(operation.method, operation.path, { params, body })
  return { ok: true, data }
})
```

需要走自己的 BFF / 加签名时，替换这一个函数即可（条目上的 `run` 优先级更高）。

### 3. 验证

在助手抽屉里问：

- 「助手能调哪些接口」→ 逐条列出 `GET /users` 等
- 「查一下用户列表」→ 真的发起请求，把结果回填

> 安全边界：**未登记的接口助手看不到**。写操作标 `mutating: true`，
> 模型会被要求先确认，界面也会标红。

## 五、模型链路（真实 API + 供应商回退链）

浏览器永远只认一个地址：`POST /ai-gateway/chat/completions`。
网关内部维护一条**回退链**，按顺序尝试，命中即用、失败自动换下一家：

```
浏览器  →  /ai-gateway/chat/completions
           ↑ vite.config.ts 中间件（dev）/ scripts/ai-gateway.mjs（独立进程或生产 BFF）
         ↓
   ① opencode      配了 OPENCODE_API_KEY 时    https://opencode.ai/inference/openai/v1
   ② custom        配了 AI_API_KEY 时           任意 OpenAI 兼容服务（DeepSeek / Moonshot / 自建）
   ③ pollinations  始终可用（免密钥）           https://text.pollinations.ai/openai
```

401 / 402 / 403 / 429 / 5xx 都会触发切换到下一家；全部失败才把错误返回前端。

**开箱即用**：一个密钥都不配，也会走 ③，所以克隆下来就能跟真模型对话。
③ 的公益额度是「每 IP 每 45 秒 1 条」，因此网关对它会自动把工具轮次压到 1
（一轮工具调用后直接收尾，不为第二次配额干等）；配置 ① 后恢复 3 轮。

配置（写进 `apps/admin/.env.local`，**不是** `.env.example`）：

```bash
# ① 首选：OpenCode 免费档 / Go
OPENCODE_API_KEY=oc_sk_xxxxxxxxxxxxxxxx
AI_MODEL=deepseek-v4.1-flash-free

# ② 或者任意 OpenAI 兼容服务
# AI_API_KEY=sk-xxxxxxxxxxxxxxxx
# AI_UPSTREAM=https://api.deepseek.com/v1
# AI_MODEL=deepseek-chat

# 强制只用某一家（排查用）
# AI_PROVIDER=pollinations
```

- 密钥只在服务端读，`VITE_*` 一律不进包
- 前端启动时探活 `/ai-gateway/health`，拿到「当前供应商 / 模型 / 允许几轮工具」，
  界面角标据此显示真实模型名（例如 `openai`）
- 网关与企业网络完全不通时，助手自动切本地引擎，界面显示「本地引擎 + 原因」，功能不中断
- 独立部署：`node scripts/ai-gateway.mjs`（默认 8787），或在你自己的 BFF 实现同样三个路由
  （`/ai-gateway/health`、`/ai-gateway/chat/completions`、`/ai-gateway/models`）

## 六、本地引擎（网关不可达时的降级）

`packages/ai-sdk/src/planner.ts` 是一个规则规划器，稳定识别：

- 生成页面（含「用户数据统计」专用结构与通用看板结构）
- 改配色 / 圆角 / 密度 / 标题、追加图表
- 应用页面、查接口清单、拉取接口数据、后端接入说明

它的存在让离线演示不依赖外网，也让「客户刚克隆下来、网关又恰好不通」时不至于面对死界面。
**它只是兜底，不是默认路径**：只要网关健康，走的就是真实模型。

## 七、自测

```bash
# 交互全链路（本地引擎也跑得通，验证 UI 与落地链路）
node scripts/verify-assistant.mjs

# 抽屉几何 / 多会话 / 思考链 / 宽度记忆（这一版外观与交互承诺的专项验收）
node scripts/verify-assistant-drawer.mjs

# 真实模型链路（要求网关健康；会断言「界面已切到模型」而不是本地引擎）
node scripts/verify-assistant-llm.mjs

# 真模型 + 后端接口联合链路
node scripts/verify-assistant-api.mjs

# 宽度适配 320–1920
node scripts/check-assistant-responsive.mjs
```

截图输出到 `docs/screenshots/assistant/`。

## 八、视觉回归要点

- **抽屉必须贴右缘、全高**：`10-drawer-empty.png` 里抽屉 y=0、height=视口高度；
  脚本里带断言，退化成浮层会直接失败
- **没有渐变与发光**：助手侧只用品牌字标 + 中性色 + 细描边；页面预览卡也是中性底，
  品牌色只留给「应用到侧边栏」这一个主操作
- **静止即静止**：思考中的三个点只做透明度起伏，不做位移；hover 才有颜色变化
- **用户身份来自登录账号**：消息区显示 `authStore.user.name` 与头像（无头像用姓名首字），
  不是写死的「我」
