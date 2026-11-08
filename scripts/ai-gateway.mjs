/**
 * AI 网关（同源代理 + 多供应商回退链）
 *
 * 浏览器的 `/ai-gateway/*` 在这里被转发到**真实模型服务**，并统一处理鉴权。
 *
 * 为什么必须有这一层：
 * 1. 密钥不能进浏览器包（Vite 的 `VITE_*` 会被打进产物）
 * 2. OpenCode 的免费模型（`*-free`）只对 OpenCode 客户端放行，其它来源直接 403 / 429；
 *    必须由服务端注入 `Authorization` 与 `x-opencode-session` 才可能复用额度
 * 3. 供应商差异（URL、鉴权方式、限流）收敛在一处，前端一行都不改
 *
 * 供应商回退链（按顺序尝试，命中即用）：
 *  1. `opencode`   —— 配了 OPENCODE_API_KEY 时优先（¥0 免费档 / Go 订阅）
 *  2. `custom`     —— 配了 AI_API_KEY + AI_UPSTREAM 时使用（任何 OpenAI 兼容服务）
 *  3. `pollinations` —— **无需密钥**的公益推理网关，开箱即用（每 IP 45 秒 1 条）
 *
 * 环境变量：
 *   OPENCODE_API_KEY   可选，OpenCode Console 个人密钥（oc_sk_...）
 *   AI_API_KEY         可选，任意 OpenAI 兼容服务的密钥（DeepSeek / Moonshot / 自建…）
 *   AI_UPSTREAM        可选，配合 AI_API_KEY 使用；默认指向 OpenCode
 *   AI_MODEL           可选，模型名（会按供应商能力自动兜底）
 *   AI_PROVIDER        可选，强制指定 opencode / custom / pollinations
 *   AI_GATEWAY_OPEN    可选，设为 1 时允许透传浏览器自带密钥（仅本地调试）
 */
import { createServer } from 'node:http'

export const DEFAULT_UPSTREAM = 'https://opencode.ai/inference/openai/v1'
export const DEFAULT_MODEL = 'deepseek-v4.1-flash-free'

/** 无需密钥的公益网关：真实模型（gpt-oss-20b），支持 SSE 与 function calling */
export const POLLINATIONS_UPSTREAM = 'https://text.pollinations.ai'
export const POLLINATIONS_MODEL = 'openai'
/** 该网关的免费额度：每 IP 45 秒 1 条 */
export const POLLINATIONS_NOTE =
  '公益额度：每 IP 每 45 秒 1 条；要更快的节奏请配置 OPENCODE_API_KEY'

/** 允许透传/改写的请求头（其余一律丢弃，避免把浏览器指纹之类带出去） */
const FORWARD_REQUEST_HEADERS = ['content-type', 'accept', 'x-opencode-session']

/** 允许回传给浏览器的响应头 */
const FORWARD_RESPONSE_HEADERS = ['content-type', 'cache-control', 'x-request-id']

/**
 * 解析供应商回退链
 *
 * 顺序固定（显式配置优先），并允许用 `AI_PROVIDER` 强制只用一个 ——
 * 排查「到底是哪个供应商在回话」时很有用。
 */
export function resolveProviders(env = process.env) {
  const forced = (env.AI_PROVIDER ?? '').trim()
  const model = env.AI_MODEL ?? DEFAULT_MODEL
  const upstream = (env.AI_UPSTREAM ?? DEFAULT_UPSTREAM).replace(/\/+$/, '')
  const opencodeKey = env.OPENCODE_API_KEY ?? env.DSH_OPENCODE_API_KEY ?? ''
  const customKey = env.AI_API_KEY ?? ''

  const providers = [
    {
      id: 'opencode',
      label: 'OpenCode',
      upstream,
      apiKey: opencodeKey,
      model,
      // OpenCode 用会话头做粘性路由与提示缓存
      sessionHeader: 'x-opencode-session',
      maxToolRounds: 3,
    },
    {
      id: 'custom',
      label: '自定义网关',
      upstream,
      apiKey: customKey,
      model,
      maxToolRounds: 3,
    },
    {
      id: 'pollinations',
      label: 'Pollinations（免密钥）',
      upstream: POLLINATIONS_UPSTREAM,
      apiKey: '',
      model: POLLINATIONS_MODEL,
      // 它把 OpenAI 兼容接口挂在 /openai，不是 /chat/completions
      chatPath: '/openai',
      modelsPath: '/models',
      // 免密钥有 45 秒节流：一轮工具调用后直接收尾，避免用户等第二次配额
      maxToolRounds: 1,
      note: POLLINATIONS_NOTE,
    },
  ]

  const available = providers.filter(
    (provider) => provider.apiKey || provider.id === 'pollinations',
  )
  const selected = forced ? available.filter((provider) => provider.id === forced) : available
  return { providers: selected.length ? selected : [], forced, open: env.AI_GATEWAY_OPEN === '1' }
}

/** 兼容旧调用点：取回退链里的第一个 */
export function resolveGatewayConfig(env = process.env) {
  const { providers, open } = resolveProviders(env)
  const primary = providers[0]
  return {
    upstream: primary?.upstream ?? DEFAULT_UPSTREAM,
    apiKey: primary?.apiKey ?? '',
    model: primary?.model ?? DEFAULT_MODEL,
    open,
  }
}

function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(body)
}

/** 供应商的完整地址：pollinations 走 /openai，其余走 /chat/completions */
function endpointOf(provider, path) {
  const base = provider.upstream.replace(/\/+$/, '')
  const target = path === '/chat/completions' ? (provider.chatPath ?? path) : path
  return `${base}${target}`
}

/**
 * 创建网关处理器
 *
 * `next` 存在时表现成 connect 中间件（Vite dev / express）；
 * 不存在时表现成独立 http handler（`scripts/ai-gateway.mjs`）。
 */
export function createAiGateway(options = {}) {
  const env = options.env ?? process.env
  const resolved = resolveProviders(env)
  const providers = options.providers ?? resolved.providers
  const prefix = '/ai-gateway'

  /** 最近一次成功的供应商：下次优先用它，少打一次无谓的 429 */
  let preferredId = providers[0]?.id ?? ''

  const ordered = () => {
    const index = providers.findIndex((provider) => provider.id === preferredId)
    if (index <= 0) return providers
    return [providers[index], ...providers.slice(0, index), ...providers.slice(index + 1)]
  }

  const primary = providers[0]

  return async function handle(req, res, next) {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (!url.pathname.startsWith(prefix)) {
      if (next) return next()
      return sendJson(res, 404, { error: '未找到该路径' })
    }
    const path = url.pathname.slice(prefix.length) || '/'

    // 探活：前端据此决定「走模型」还是「降级到本地引擎」。
    // 恒返回 200 —— 「没有可用供应商」是正常状态而非错误，
    // 用 503 会在浏览器控制台留一条红色失败请求，把真正的错误淹没掉。
    if (path === '/health') {
      const ready = providers.length > 0
      return sendJson(res, 200, {
        ok: ready,
        provider: ready ? preferredId || primary?.id : null,
        providers: providers.map((provider) => ({
          id: provider.id,
          label: provider.label,
          model: provider.model,
          keyless: !provider.apiKey && provider.id === 'pollinations',
        })),
        model: ready ? (providers.find((p) => p.id === preferredId) ?? primary)?.model : null,
        maxToolRounds: ready ? (providers[0]?.maxToolRounds ?? 3) : 1,
        note: primary?.note ?? null,
        reason: ready
          ? null
          : '没有可用的模型供应商：设置 OPENCODE_API_KEY 或 AI_API_KEY；免密钥通道也已被 AI_PROVIDER 排除',
      })
    }

    if (path === '/models') {
      const provider = ordered()[0]
      if (!provider) return sendJson(res, 503, { error: '没有可用的模型供应商' })
      try {
        const upstream = await fetch(endpointOf(provider, provider.modelsPath ?? '/models'), {
          headers: provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {},
        })
        const payload = await upstream.text()
        res.writeHead(upstream.status, { 'content-type': 'application/json' })
        return res.end(payload)
      } catch (error) {
        return sendJson(res, 502, { error: String(error?.message ?? error) })
      }
    }

    if (path === '/chat/completions' || path === '/responses') {
      if (req.method !== 'POST') return sendJson(res, 405, { error: '仅支持 POST' })
      if (!providers.length) {
        return sendJson(res, 503, {
          error: '没有可用的模型供应商：设置 OPENCODE_API_KEY 或 AI_API_KEY',
          type: 'GatewayNotConfigured',
        })
      }

      let body
      try {
        body = JSON.parse(await readBody(req))
      } catch (error) {
        return sendJson(res, 400, { error: `请求体解析失败：${error.message}` })
      }
      if (path === '/chat/completions') body.stream = true
      // 空的 tools 数组会被部分网关判成非法请求（Pollinations 直接回 usage_missing），
      // 「没有工具」的正确表达是**不带字段**，不是传空数组
      if (Array.isArray(body.tools) && body.tools.length === 0) {
        delete body.tools
        delete body.tool_choice
      }

      // 依次尝试供应商：402/429/403（额度或权限）以及 5xx 都换下一家
      let lastError = ''
      let lastStatus = 0
      for (const provider of ordered()) {
        const payload = { ...body, model: provider.model }
        const headers = { 'content-type': 'application/json', accept: 'text/event-stream' }
        if (provider.apiKey) headers.Authorization = `Bearer ${provider.apiKey}`
        for (const name of FORWARD_REQUEST_HEADERS) {
          const value = req.headers[name]
          if (typeof value === 'string' && value) {
            // 会话头只发给识别它的供应商
            if (name === provider.sessionHeader || name !== 'x-opencode-session')
              headers[name] = value
          }
        }

        const controller = new AbortController()
        const clientGone = () => controller.abort()
        res.on('close', clientGone)

        try {
          const upstream = await fetch(endpointOf(provider, path), {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal,
          })

          // 401 也算「这家不行」：密钥失效/过期时不该把整轮对话拖死，
          // 换下一家还能用就继续用，全都不行才把错误抛给前端
          const retriable = [401, 402, 403, 408, 429, 500, 502, 503, 504].includes(upstream.status)
          if (retriable) {
            lastStatus = upstream.status
            lastError = (await upstream.text().catch(() => '')).slice(0, 400)
            continue
          }

          preferredId = provider.id
          const responseHeaders = {}
          for (const name of FORWARD_RESPONSE_HEADERS) {
            const value = upstream.headers.get(name)
            if (value) responseHeaders[name] = value
          }
          // 让前端知道自己拿到的是哪家（浏览器控制台/网络面板可直接看到）
          responseHeaders['x-ai-provider'] = provider.id
          responseHeaders['x-ai-model'] = provider.model
          res.writeHead(upstream.status, responseHeaders)

          if (!upstream.body) {
            res.end(await upstream.text())
            return
          }
          for await (const chunk of upstream.body) res.write(chunk)
          res.end()
          return
        } catch (error) {
          if (controller.signal.aborted) {
            res.end()
            return
          }
          lastStatus = 502
          lastError = String(error?.message ?? error)
        } finally {
          res.off('close', clientGone)
        }
      }

      if (!res.headersSent) {
        sendJson(res, lastStatus || 502, {
          error: `所有供应商都不可用：${lastError || '未知原因'}`,
          type: 'GatewayUpstreamError',
          tried: ordered().map((provider) => provider.id),
        })
      } else {
        res.end()
      }
      return
    }

    if (next) return next()
    return sendJson(res, 404, { error: `未知的网关路径：${path}` })
  }
}

/** Vite / connect 中间件 */
export function createAiGatewayMiddleware(options) {
  return createAiGateway(options)
}

/** 独立服务：`node scripts/ai-gateway.mjs` */
export function startAiGatewayServer({
  port = Number(process.env.AI_GATEWAY_PORT ?? 8787),
  ...rest
} = {}) {
  const handler = createAiGateway(rest)
  const server = createServer((req, res) => {
    void handler(req, res)
  })
  server.listen(port, '127.0.0.1', () => {
    const { providers } = resolveProviders()
    const summary = providers.length
      ? providers.map((provider) => `${provider.id}(${provider.model})`).join(' → ')
      : '无可用供应商'
    console.info(`[ai] 网关已启动：http://127.0.0.1:${port}/ai-gateway`)
    console.info(`[ai] 供应商链：${summary}`)
  })
  return server
}
