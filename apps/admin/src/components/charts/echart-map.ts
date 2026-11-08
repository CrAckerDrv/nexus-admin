/**
 * 中国地图 GeoJSON 注册
 *
 * 单独一个模块，只有大屏页会动态 import 它 ——
 * 59KB 的 geojson 不该进到其他图表的 chunk 里。
 */
import { echarts } from './echart-core'
import chinaGeo from '@/assets/geo/china.json'

let registered = false

/** 幂等注册（多次调用只生效一次） */
export function ensureChinaMap(): void {
  if (registered) return
  echarts.registerMap('china', chinaGeo as never)
  registered = true
}
