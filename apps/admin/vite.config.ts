import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createAiGatewayMiddleware } from '../../scripts/ai-gateway.mjs'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    /**
     * AI 网关中间件
     *
     * 把 `/ai-gateway/*` 转发到 OpenCode 推理网关，并在服务端注入密钥。
     * 挂在 dev server 上而不是单独的进程：`pnpm dev` 一条命令即可，
     * 且与前端同源，不涉及 CORS。
     *
     * 密钥只从环境变量读（`OPENCODE_API_KEY`），永远不进浏览器包。
     */
    {
      name: 'nexus-ai-gateway',
      configureServer(server) {
        server.middlewares.use(createAiGatewayMiddleware())
      },
      configurePreviewServer(server) {
        server.middlewares.use(createAiGatewayMiddleware())
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@nexus/ui': fileURLToPath(new URL('../../packages/ui/src/index.ts', import.meta.url)),
      '@nexus/ai-sdk': fileURLToPath(new URL('../../packages/ai-sdk/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    reportCompressedSize: false,
    // ECharts 本体（charts chunk）约 670 kB，属预期内；其余 chunk 远低于阈值
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        /**
         * chunk 切分策略
         *
         * 分成两组目标，按优先级排：
         *
         * 1. **少发请求**（移动端主要瓶颈）
         *    实测（`scripts/perf-attribution.mjs`）：Slow-4G 下 FCP 的增量有 80% 来自
         *    「请求数 × RTT」，而不是体积。原配置把 lucide 图标拆成 64 个 <1 kB 的文件、
         *    `@nexus/ui` 被路由切散，首页要发 64~74 个请求；合并后降到 30~40 个，
         *    移动 FCP 平均降 1.2s（`docs/OPTIMIZATION-BACKLOG.md` 第 2 节）。
         *
         * 2. **保住长期缓存**
         *    react / @tanstack 变化频率最低，单独成块；
         *    只要不改依赖，发版后这两个 chunk 的 hash 不变，用户仍然命中缓存。
         *    因此**不**把它们并进一个 `core` —— 那会让「换个 react 补丁版本」
         *    连带失效 tanstack 的缓存。
         *
         * 其余第三方统一进 `vendor`：它们都是小包（clsx / tailwind-merge / zod / zustand），
         * 拆开只会制造更多请求。
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          // 图表库：体积最大且只在图表页需要，动态 import，不进首屏
          if (id.includes('echarts') || id.includes('zrender')) return 'charts'
          // 图标：不加这条会被逐个文件拆成 60+ 个 0.x kB 的 chunk（纯 RTT 开销）
          if (id.includes('lucide-react')) return 'icons'
          // 变化频率最低的两个依赖：单独成块，保住发版后的缓存命中
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) {
            return 'react'
          }
          if (id.includes('@tanstack')) return 'tanstack'
          return 'vendor'
        },
      },
    },
  },
})
