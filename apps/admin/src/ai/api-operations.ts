import { registerAssistantApi, type AssistantApiOperation } from '@nexus/ai-sdk'

/**
 * 把后端接口交给助手 · 唯一需要客户动手的文件
 *
 * 约定：
 * 1. 只登记**允许助手访问**的接口；助手看不到未登记的接口，这是默认安全的边界
 * 2. `id` 会变成工具名 `api_<id>`，只用字母数字下划线
 * 3. `params` 既是给模型看的字段说明，也是执行器挑选查询参数的依据
 * 4. 写操作把 `mutating` 设为 true：界面会标红，模型也会被要求在调用前确认
 *
 * 执行器已默认接到 `core/http`（见 src/ai/index.ts），无需重复配置。
 * 接入自己的后端时，把 path 换成你真实的接口路径即可 —— 页面代码不受影响。
 */
export const ASSISTANT_OPERATIONS: AssistantApiOperation[] = [
  {
    id: 'user_list',
    title: '用户列表',
    description: '分页查询用户，支持关键字、状态与角色过滤',
    method: 'GET',
    path: '/users',
    params: {
      page: '页码，从 1 开始',
      pageSize: '每页条数，默认 10',
      keyword: '姓名 / 邮箱 / 手机号关键字',
      status: '状态：active / invited / disabled / locked',
    },
  },
  {
    id: 'user_stats',
    title: '用户统计',
    description: '用户总量、活跃、待邀请、停用与 MFA 统计',
    method: 'GET',
    path: '/users/stats',
  },
  {
    id: 'order_list',
    title: '订单列表',
    description: '分页查询订单，支持关键字与状态过滤',
    method: 'GET',
    path: '/orders',
    params: {
      page: '页码',
      pageSize: '每页条数',
      keyword: '订单号 / 客户名',
      status: '状态：pending / paid / refunding',
    },
  },
  {
    id: 'order_stats',
    title: '订单统计',
    description: '订单各状态数量与总金额',
    method: 'GET',
    path: '/orders/stats',
  },
  {
    id: 'audit_logs',
    title: '审计日志',
    description: '分页查询操作审计日志',
    method: 'GET',
    path: '/audit-logs',
    params: {
      page: '页码',
      pageSize: '每页条数',
      keyword: '操作人 / 目标 / 详情关键字',
      result: '结果：success / failure',
    },
  },
]

/**
 * 注册
 *
 * 放在模块加载时执行：助手首次打开前就绪，用户问「能调哪些接口」时立刻有答案。
 */
registerAssistantApi(ASSISTANT_OPERATIONS)

export const apiOperationCount = ASSISTANT_OPERATIONS.length
