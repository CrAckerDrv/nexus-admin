import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * 实验用构建配置：量化「请求合并」能省多少
 *
 * 与正式 vite.config.ts 的唯一差异是 manualChunks：
 * - lucide-react 全部图标并成一个 chunk（当前被拆成 60+ 个 <1kB 的文件，纯 RTT 开销）
 * - @nexus/ui 并成一个 chunk（组件库被路由切分后重复出现在多个 chunk 里）
 * - 其余第三方进 vendor
 *
 * 产物写入 dist-lab，不影响正式构建。
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@nexus/ui': fileURLToPath(new URL('../../packages/ui/src/index.ts', import.meta.url)),
      '@nexus/ai-sdk': fileURLToPath(
        new URL('../../packages/ai-sdk/src/index.ts', import.meta.url),
      ),
    },
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('echarts') || id.includes('zrender')) return 'charts'
            if (id.includes('lucide-react')) return 'icons'
            if (id.includes('@tanstack') || id.includes('react-dom') || id.includes('/react/')) {
              return 'core'
            }
            return 'vendor'
          }
          return undefined
        },
      },
    },
  },
})
