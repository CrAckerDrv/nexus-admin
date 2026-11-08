# 数据流

## 全链路

```
页面组件
   │  调用 hooks（useUsers / useOrders ...）
   ▼
src/services/queries.ts        ← 数据访问层（唯一知道接口路径的地方）
   │  api.get('/users', { params })
   ▼
src/core/http.ts               ← 传输层（鉴权头 / 超时 / 错误处理）
   │  fetch('/api/users?...')
   ▼
src/mock/index.tsx             ← 演示模式拦截（生产环境删除）
   │
   ▼
src/mock/handlers.ts           ← 返回假数据
```

## 为什么要有数据访问层

页面里直接写 `fetch` 的常见后果：接口路径散落、参数拼装重复、错误处理各写一套。
集中在 `queries.ts` 后：

- 换后端只改这一层
- `queryKey` 统一由 `queryKeys` 工厂生成，失效逻辑不会写错
- 页面组件只关心 `data / isLoading / refetch`

## React Query 配置

```ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s 内不重复请求
      gcTime: 5 * 60_000,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false, // 后台系统频繁切窗口，关闭以免放大 QPS
    },
  },
})
```

`refetchOnWindowFocus: false` 是有意的取舍：后台系统用户经常在多个窗口间切换，
浏览器默认的聚焦刷新会造成请求风暴。需要实时性时用显式轮询：

```ts
useQuery({ queryKey: ['overview'], queryFn, refetchInterval: 30_000 })
```

## 分页保持不闪屏

```ts
useQuery({
  queryKey: queryKeys.users(params),
  queryFn: () => api.get('/users', { params }),
  placeholderData: (prev) => prev, // 翻页时保留上一页数据
})
```

没有 `placeholderData` 时，每次翻页表格都会瞬间变成骨架屏，体验很差。

## 变更与失效

```ts
export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }) => api.patch(`/users/${id}`, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
```

`invalidateQueries({ queryKey: ['users'] })` 会精确匹配 `['users', 'stats']` 与所有分页 key，
因此列表和统计卡片会同时刷新。

## 乐观更新（进阶）

对于"点赞""开关"这类高频操作用乐观更新：

```ts
useMutation({
  mutationFn: toggle,
  onMutate: async (next) => {
    await queryClient.cancelQueries({ queryKey: ['settings'] })
    const prev = queryClient.getQueryData(['settings'])
    queryClient.setQueryData(['settings'], next)
    return { prev }
  },
  onError: (_err, _next, ctx) => queryClient.setQueryData(['settings'], ctx?.prev),
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
})
```

## 全局状态该放哪里

| 数据               | 放哪               | 原因                     |
| ------------------ | ------------------ | ------------------------ |
| 服务端数据         | React Query        | 有缓存、失效、重试需求   |
| 登录态 / token     | Zustand（persist） | 需要同步读取（拦截器里） |
| 主题 / 密度 / 页签 | Zustand（persist） | 全局且需持久化           |
| 弹窗开关 / 表单值  | 组件 `useState`    | 生命周期与组件一致       |
| 派生数据           | `useMemo`          | 不需要额外存储           |

**不要**把服务端数据也塞进 Zustand——那会同时出现两份真相。
