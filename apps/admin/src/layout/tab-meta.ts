import { modules } from '@/modules/registry'

/**
 * 静态路径清单（仅供首屏前的老代码/测试引用）
 *
 * 运行时请用 `useModuleTitleMap()`（i18n 感知）。
 * 这里不再展开中文标题，避免切换语言后残留一份过期映射。
 */
export const KNOWN_PATHS: string[] = modules
  .flatMap((mod) => mod.routes.map((route) => route.path))
  .sort()
