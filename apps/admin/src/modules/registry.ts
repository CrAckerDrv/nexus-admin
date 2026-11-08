import type { ModuleDefinition } from '@/core/module'
import { dashboardModule } from './dashboard/module'
import { assistantModule } from './assistant/module'
import { businessModule } from './business/module'
import { organizationModule } from './organization/module'
import { templatesModule } from './templates/module'
import { systemModule } from './system/module'
import { componentsModule } from './components/module'
import { guideModule } from './guide/module'
import { errorModule } from './errors/module'
import { accountModule } from './account/module'

/**
 * 模块注册表
 *
 * 新增模块 = 新建 src/modules/<name>/module.ts + 在此数组加一行。
 * 路由、侧边栏、命令面板、面包屑会自动生成。
 *
 * 注意：`nav` 为空的模块（如 account）只贡献路由，不出现在侧边栏——
 * 个人资料这类页面从顶栏头像菜单进入更符合直觉。
 */
export const modules: ModuleDefinition[] = [
  dashboardModule,
  assistantModule,
  businessModule,
  organizationModule,
  templatesModule,
  componentsModule,
  guideModule,
  systemModule,
  accountModule,
  errorModule,
].sort((a, b) => a.order - b.order)
