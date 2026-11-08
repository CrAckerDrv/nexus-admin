# 部署性能基线

> 代码侧的优化做完之后，**能不能兑现取决于部署**。
> 这份文档给出「拿到第一梯队数字」所需的最小服务器配置，全部是实测结论
> （见 `docs/PERFORMANCE.md` 与 `docs/OPTIMIZATION-BACKLOG.md`）。

## 1. 压缩：一定要开 brotli

实测本仓库产物（`scripts/_compression-probe.mjs`）：

| 算法           | JS + CSS 合计            |
| -------------- | ------------------------ |
| 原始           | 2,798 kB                 |
| gzip -9        | 948 kB                   |
| **brotli -11** | **798 kB（再省 15.7%）** |

零代码改动，纯服务端配置。nginx 需要 `ngx_brotli` 模块（主流发行版的 `nginx-extras` 已内置）。

```nginx
# /etc/nginx/nginx.conf
http {
  # ---- brotli（优先）----
  brotli              on;
  brotli_comp_level   11;
  brotli_static       on;   # 有 .br 预压缩文件就直接发
  brotli_types        text/plain text/css application/javascript application/json
                      image/svg+xml application/manifest+json;

  # ---- gzip（老客户端兜底）----
  gzip                on;
  gzip_vary           on;
  gzip_comp_level     6;
  gzip_min_length     1024;
  gzip_types          text/plain text/css application/javascript application/json
                      image/svg+xml application/manifest+json;

  server {
    listen 443 ssl http2;   # HTTP/2 必须开：首屏 32~40 个请求，多路复用能省掉队头阻塞
    server_name admin.example.com;
    root /var/www/nexus-admin;

    # ---- 带 hash 的静态资源：永久缓存 ----
    # 文件名由 Vite 生成（index-B17jQjhr.js），内容变了 hash 就变，所以可以激进缓存
    location /assets/ {
      expires 1y;
      add_header Cache-Control "public, max-age=31536000, immutable" always;
      access_log off;
      try_files $uri =404;
    }

    # ---- index.html：绝不缓存 ----
    # 它引用了带 hash 的资源名；缓存住会让用户一直用旧版
    location = /index.html {
      add_header Cache-Control "no-cache, must-revalidate" always;
      expires off;
    }

    # ---- SPA 回退 ----
    location / {
      try_files $uri $uri/ /index.html;
    }

    # ---- RUM 上报端点（见下一节）----
    location = /api/vitals {
      access_log off;
      proxy_pass http://127.0.0.1:8788;
    }
  }
}
```

**预压缩**（可选，省 CPU）：构建后跑一次

```bash
find apps/admin/dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.svg' -o -name '*.json' \) \
  -exec brotli -q 11 -k {} \;
# 生成本地文件旁边的 .br，配合 brotli_static on 直接发送
```

## 2. 缓存分层的取舍

当前 chunk 策略（`apps/admin/vite.config.ts` 的 `manualChunks`）把第三方拆成三块：

| chunk      | 典型体积               | 变更频率               | 结论               |
| ---------- | ---------------------- | ---------------------- | ------------------ |
| `react`    | 206 kB raw / 57 kB br  | 半年一次（升级大版本） | 命中率最高         |
| `tanstack` | 107 kB raw / 32 kB br  | 季度级                 | 高                 |
| `vendor`   | ~10 kB raw             | 跟随小依赖             | 中                 |
| `icons`    | 69 kB raw / 19 kB br   | 跟随 lucide 升级       | 中                 |
| `charts`   | 713 kB raw / 203 kB br | 跟随 echarts 升级      | **只在图表页加载** |
| 页面 chunk | 2~55 kB raw            | 每次发版               | 低                 |

**发一次版只会失效「页面 chunk」**，第三方三块仍然命中缓存 —— 这是把
react 与 tanstack 分开、而不是合并成一个大 `core` 的原因。

## 3. 真实用户监控（RUM）接入

前端已内置 `apps/admin/src/core/vitals.ts`（零依赖，采集 LCP / INP / CLS + TTFB），
在 `visibilitychange → hidden` 与 `pagehide` 时通过 `sendBeacon` 上报到 `POST /api/vitals`。

- **没有该端点时静默失败**，不会污染控制台；私有化部署可用 `VITE_ENABLE_VITALS=false` 关掉
- 上报体是 `text/plain`（避免 CORS 预检），内容：

```json
{ "lcp": 1234, "inp": 96, "cls": 0.001, "ttfb": 87, "path": "/dashboard/overview" }
```

最小接收端（Node，30 行级别）：

```js
// server/vitals.mjs
import { createServer } from 'node:http'

createServer((req, res) => {
  if (req.method !== 'POST') return res.writeHead(405).end()
  let body = ''
  req.on('data', (chunk) => (body += chunk))
  req.on('end', () => {
    try {
      const sample = JSON.parse(body)
      // 落库 / 打点到现有监控（Prometheus / ClickHouse / Loki 均可）
      console.log(JSON.stringify({ ...sample, at: new Date().toISOString() }))
    } catch {
      /* 忽略脏数据 */
    }
    res.writeHead(204).end()
  })
}).listen(8788, '127.0.0.1')
```

**看板建议按 p75 聚合**（web.dev 的口径），不要看平均值 —— 平均值会被快用户稀释。

## 4. CI 性能门禁

已内置 `scripts/perf-budget.mjs`，对构建产物断言 5 条硬线：

| 预算项             | 阈值   | 依据                                                   |
| ------------------ | ------ | ------------------------------------------------------ |
| 入口 chunk gzip    | 200 kB | 业界「优秀」档；实测 33.7 kB                           |
| JS chunk 总数      | 110    | 移动端瓶颈是请求数；实测 103                           |
| 单 chunk gzip      | 250 kB | webpack `maxAssetSize` 默认 250000 B；ECharts 235.5 kB |
| 首屏 modulepreload | 6 条   | 实测 6 条                                              |
| < 1 kB 碎片 chunk  | 10 个  | 每个碎片仍要走一次 RTT；实测 5 个                      |

接入 CI（`.github/workflows/ci.yml` 的「构建应用」之后）：

```yaml
- name: 性能预算
  run: node scripts/perf-budget.mjs
```

超预算即 exit 1，PR 会被拦住。调预算必须同时更新 `docs/PERFORMANCE.md`——
否则预算会悄悄失效，变成「每次都通过」的摆设。

## 5. 上线后需要复测的三件事

1. **真实网络下的 LCP**：本地静态服务的 TTFB ≈ 3ms，桌面 LCP 0.2~0.5s
   不代表公网表现。上线后用 RUM 的 p75 与 `docs/PERFORMANCE.md` 的桌面档对照。
2. **移动端 Slow-4G 的 FCP**：合并 chunk 后本地实测 3.2~4.6s，
   真机（含 CDN 边缘）预期更低；若仍 > 2.5s，优先检查 CDN 是否开启 HTTP/2 与 brotli。
3. **组件橱窗的 TBT**：已从 5.1s 降到 0（进视口才渲染），
   上线后确认没有因为「一次滚到底」把长任务带回来（RUM 里看 INP）。
