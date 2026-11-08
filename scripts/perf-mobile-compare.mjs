import { readFileSync } from 'node:fs'

/**
 * 优化前后逐路由对比（移动档，Slow-4G + 4×CPU）
 *
 * 基线 = 优化前的 `docs/perf/perf-report.json`
 * 结果 = 优化后的 `docs/perf/final-mobile.json`
 * 两次都是同机同网、同一套 Playwright + CDP 节流参数。
 */
const before = JSON.parse(readFileSync('docs/perf/perf-report.json', 'utf8')).results
const after = JSON.parse(readFileSync('docs/perf/final-mobile.json', 'utf8')).results

const map = Object.fromEntries(
  before.filter((row) => row.profile === 'mobile').map((row) => [row.route, row]),
)

const delta = (from, to) => {
  const diff = to - from
  return `${String(from).padStart(5)} → ${String(to).padStart(5)} (${diff > 0 ? '+' : ''}${diff})`
}

console.log('移动档：优化前 → 优化后（同机同网，Slow-4G + 4×CPU）\n')
console.log(
  `${'路由'.padEnd(10)} ${'FCP'.padStart(21)} ${'LCP'.padStart(21)} ${'JS gzip'.padStart(19)}`,
)
for (const row of after) {
  const prev = map[row.route]
  if (!prev) continue
  console.log(
    `${(row.name ?? row.route).padEnd(10)} ${delta(prev.fcp, row.fcp).padStart(21)} ${delta(
      prev.lcp,
      row.lcp,
    ).padStart(21)} ${delta(prev.jsGzipKB, row.jsGzipKB).padStart(19)}`,
  )
}
