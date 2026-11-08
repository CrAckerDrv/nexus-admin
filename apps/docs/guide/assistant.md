# AI 运营助手

> 一句话：**让运营用自然语言做页面，让开发只登记一份接口清单。**

入口有三个，共用同一段会话：

| 入口     | 位置                                     | 适用                   |
| -------- | ---------------------------------------- | ---------------------- |
| 抽屉     | 顶栏右侧「AI 运营助手」按钮 / `Ctrl + J` | 边看页面边问、快速生成 |
| 工作台   | 侧边栏「AI 助手 → AI 运营助手」          | 长上下文、连续改几版   |
| 命令面板 | `Ctrl + K` → 导航到工作台                | 键盘流                 |

## 能做什么

| 你说                         | 它做                                     |
| ---------------------------- | ---------------------------------------- |
| 帮我实现一个用户数据统计页面 | 生成页面规格 → 预览 → 一键应用到侧边栏   |
| 把主色改成紫色               | 改页面主题，即时生效                     |
| 圆角再大一点 / 用紧凑密度    | 同上，纯本地状态，不用等模型             |
| 再加一个明细表               | 追加区块                                 |
| 应用到侧边栏                 | 写入侧边栏「AI 生成」分组 + 生成可达路由 |
| 怎么把后端接口交给助手       | 返回三步代码示例                         |
| 助手能调哪些接口             | 列出当前已登记的接口                     |
| 查一下用户列表               | 真的发起请求，把结果回填                 |

## 零代码是怎么做到的

模型**不生成 React 代码**，只生成一份可序列化的 `PageSpec`：

```ts
interface PageSpec {
  id: string
  title: string
  path: string // 一定是 /generated/<slug>
  theme: { accent?: string; radius?: string; density?: string; surface?: 'plain' | 'gradient' }
  nav: { group?: string; order?: number; badge?: string }
  blocks: PageBlock[] // kpi | chart | table | list | text | progress | steps
}
```

渲染侧只有一套受控实现 `apps/admin/src/ai/components/page-renderer.tsx`：
对话预览、工作台预览、正式路由页都跑它，所以「预览看到的」就是「上线后看到的」。

这样做的取舍：

- ✅ 不存在任意代码执行、样式失控、包体膨胀；失败模式是「少一个区块」，可解释
- ✅ 规格可以存 localStorage、导出 JSON、发给同事复用
- ❌ 表达力受区块类型限制（新形态需要先扩展 `PageBlock`）

## 把后端接口交给助手

只有**一个文件**需要客户动手：`apps/admin/src/ai/api-operations.ts`。

```ts
import { registerAssistantApi } from '@nexus/ai-sdk'

registerAssistantApi([
  {
    id: 'user_list', // → 工具名 api_user_list
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
    mutating: true, // 写操作：界面标红、模型需确认
  },
])
```

执行器默认已经接到 `core/http`（见 `src/ai/index.ts`）：

```ts
configureAssistantApiExecutor(async (operation, input) => {
  const data = await api.request(operation.method, operation.path, { params, body })
  return { ok: true, data }
})
```

需要走自己的 BFF / 加签名时，替换这一个函数；单条操作也可以直接给 `run`。

> **安全边界**：助手只能看到登记过的接口。写操作标 `mutating: true` 后会要求确认。

## 模型链路（OpenCode 免费 API）

免费模型（`*-free`）只对 OpenCode 客户端开放，其它来源会 `403` / `429`。
因此助手统一走**同源代理**，密钥只存在于服务端：

```
浏览器 → /ai-gateway/chat/completions
        ↑ vite 中间件（dev）/ scripts/ai-gateway.mjs（独立进程或生产 BFF）
        ↓ 回退链：失败自动换下一家
   ① opencode      有 OPENCODE_API_KEY 时
   ② custom        有 AI_API_KEY 时（任意 OpenAI 兼容服务）
   ③ pollinations  始终可用（免密钥，每 IP 45 秒 1 条）
```

配置写进 `apps/admin/.env.local`（**不是** `.env.example`，也不要用 `VITE_` 前缀）：

```bash
# ① 首选：OpenCode 免费档 / Go
OPENCODE_API_KEY=oc_sk_xxxxxxxxxxxxxxxx
AI_MODEL=deepseek-v4.1-flash-free

# ② 或者任意 OpenAI 兼容服务
# AI_API_KEY=sk-xxxxxxxxxxxxxxxx
# AI_UPSTREAM=https://api.deepseek.com/v1
# AI_MODEL=deepseek-chat

# 强制只用某一家（排查用）：opencode | custom | pollinations
# AI_PROVIDER=pollinations
```

一个密钥都不配也能用：网关会自动落到 ③，克隆下来即可跟真模型对话。
免密钥通道有节流，网关会自动把它压到「一轮工具调用」，因此体验是「一句话出一个页面」。

独立部署时：

```bash
node scripts/ai-gateway.mjs      # 默认 8787，前端用 VITE_AI_BASE_URL 指过去
```

网关整体不可达时助手**自动切本地引擎**，界面显示「本地引擎 + 原因」，功能不中断。

## SDK 结构

```
packages/ai-sdk/           纯 TypeScript 内核（零 React / 零后端依赖）
├── types.ts               消息、工具、事件、传输契约
├── page-spec.ts           PageSpec + 归一化 + 内置模板
├── transport.ts           OpenAI Chat Completions 兼容流式传输
├── tools.ts               内置工具（生成/调整/应用/接口清单/调用/接入说明）
├── planner.ts             本地引擎（无模型时的规则规划器）
└── assistant.ts           AssistantCore：工具循环、订阅、注册表

apps/admin/src/ai/         装配层（唯一认识路由与 core/http 的地方）
├── index.ts               传输配置 + 执行器 + 页面端口 + useSyncExternalStore 绑定
├── page-store.ts          页面库（localStorage）+ 动态侧栏模块投影
├── api-operations.ts      ★ 客户唯一需要改的文件
├── generated-page-route.tsx  /generated/$ 通配路由
└── components/            抽屉、会话列、对话流、页面渲染器、接口接入面板
```

**换 UI 框架**只需要重写装配层；**换后端**只改执行器。

## 自测

```bash
node scripts/verify-assistant.mjs            # 8 步全链路 + 截图
node scripts/verify-assistant.mjs http://127.0.0.1:5183
```

产物截图在 `docs/screenshots/assistant/`。
