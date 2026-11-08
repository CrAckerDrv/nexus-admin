import type { ModuleSection } from '@/core/module'
import type { DictKey } from '@/i18n'

/**
 * 分区 → 侧栏小标题的词典 key
 *
 * 分区是结构约定（main = 业务、demo = 演示），文案交给 i18n。
 * 侧栏、双列第二列与顶部菜单都要用同一份映射，集中在这里避免三处各写一份中文。
 */
export const SECTION_LABEL: Record<ModuleSection, DictKey> = {
  main: 'nav.businessSection',
  demo: 'nav.demoSection',
}
