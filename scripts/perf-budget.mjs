/// <reference lib="dom" />
/// <reference types="node" />

/**
 * 性能预算门禁
 *
 * CI 里跑：对 `vite build` 产物断言四条硬线，超标即失败。
 * 阈值不是拍脑袋来的 —— 每条都对应一个实测证据，写在下面。
 *
 * 用法：
 *   node scripts/perf-budget.mjs                     # 检查 apps/admin/dist
 *   node scripts/perf-budget.mjs --dir=dist-demo     # 检查演示站构建
 *   node scripts/perf-budget.mjs --json              # 只输出 JSON（供 CI 解析）
 *
 * 退出码：0 通过 / 1 超预算
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const dirArg = process.argv.find((arg) => arg.startsWith('--dir='))?.slice(6) ?? 'dist'
const jsonOnly = process.argv.includes('--json')
const dist = join(root, 'apps/admin', dirArg)

/**
 * 预算表
 *
 * | 指标 | 阈值 | 依据 |
 * | --- | --- | --- |
 * | 入口 chunk gzip | 200 kB | 业界经验档「优秀 < 200 kB」（`docs/PERFORMANCE.md` 5 节），实测 73 kB |
 * | 全量 JS chunk 数 | 110 | 移动端瓶颈是请求数（`perf-attribution` 网络占 80%），
 * |                    |      | 合并后实测 96，留 15% 余量 |
 * | 单个 chunk gzip | 250 kB | webpack `maxAssetSize` 默认 250000 B；ECharts 244.6 kB 是已知上限 |
 * | 首屏 preload 数 | 6 | index.html 的 modulepreload 条数，超过说明入口在膨胀 |
 * | < 1 kB 的碎片 chunk | 10 | 每个碎片仍要走一次 RTT |
 */
const BUDGET = {
  entryGzipKB: 200,
  chunkCount: 110,
  maxChunkGzipKB: 250,
  preloadCount: 6,
  tinyChunks: 10,
}

const assetsDir = join(dist, 'assets')
let assets
try {
  assets = readdirSync(assetsDir).filter((name) => name.endsWith('.js'))
} catch {
  console.error(`找不到构建产物：${assetsDir}\n先运行 pnpm build`)
  process.exit(1)
}

const sizes = assets.map((name) => {
  const body = readFileSync(join(assetsDir, name))
  return { name, raw: body.length, gzip: gzipSync(body, { level: 9 }).length }
})

const entry = sizes
  .filter((item) => item.name.startsWith('index-'))
  .sort((a, b) => b.raw - a.raw)[0]
const html = readFileSync(join(dist, 'index.html'), 'utf8')
const preloadCount = html.split('modulepreload').length - 1
const largest = sizes.reduce((acc, item) => (item.gzip > acc.gzip ? item : acc), sizes[0])
const tiny = sizes.filter((item) => item.raw < 1024)

const checks = [
  {
    key: 'entryGzipKB',
    label: '入口 chunk gzip',
    value: entry ? Number((entry.gzip / 1024).toFixed(1)) : 0,
    limit: BUDGET.entryGzipKB,
    unit: 'kB',
  },
  {
    key: 'chunkCount',
    label: 'JS chunk 总数',
    value: sizes.length,
    limit: BUDGET.chunkCount,
    unit: '个',
  },
  {
    key: 'maxChunkGzipKB',
    label: `最大 chunk（${largest?.name ?? '—'}）`,
    value: largest ? Number((largest.gzip / 1024).toFixed(1)) : 0,
    limit: BUDGET.maxChunkGzipKB,
    unit: 'kB',
  },
  {
    key: 'preloadCount',
    label: '首屏 modulepreload',
    value: preloadCount,
    limit: BUDGET.preloadCount,
    unit: '条',
  },
  {
    key: 'tinyChunks',
    label: '< 1 kB 的碎片 chunk',
    value: tiny.length,
    limit: BUDGET.tinyChunks,
    unit: '个',
  },
]

const failed = checks.filter((item) => item.value > item.limit)

if (jsonOnly) {
  console.log(JSON.stringify({ dir: dirArg, checks, failed: failed.map((f) => f.key) }, null, 2))
} else {
  console.log(`性能预算 · apps/admin/${dirArg}\n`)
  for (const item of checks) {
    const ok = item.value <= item.limit
    console.log(
      `${ok ? '✓' : '✗'} ${item.label.padEnd(34)} ${String(item.value).padStart(7)} ${item.unit}` +
        `  （预算 ${item.limit} ${item.unit}）`,
    )
  }
  if (failed.length) {
    console.log(`\n✗ ${failed.length} 项超出预算：${failed.map((item) => item.label).join('、')}`)
    console.log(
      '阈值依据见 scripts/perf-budget.mjs 文件头注释；调预算必须同时更新 docs/PERFORMANCE.md。',
    )
  } else {
    console.log('\n✓ 全部在预算内')
  }
}

if (failed.length) process.exitCode = 1
void statSync
