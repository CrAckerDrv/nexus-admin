import { describe, expect, it } from 'vitest'
import {
  filterNav,
  findActiveModule,
  findNavTrail,
  firstLeafPath,
  flattenLeaves,
  flattenNav,
  flattenRoutes,
  isNavActive,
  isNodeActive,
  isPathWithin,
  partitionBySection,
} from '@/core/module'
import type { ModuleDefinition, NavNode } from '@/core/module'

const tree: NavNode[] = [
  {
    key: 'business',
    title: '业务管理',
    children: [
      { key: 'users', title: '用户管理', path: '/business/users', permission: 'user:read' },
      { key: 'roles', title: '角色权限', path: '/organization/roles', permission: 'role:read' },
    ],
  },
  { key: 'dashboard', title: '经营概览', path: '/dashboard/overview' },
]

const modules: ModuleDefinition[] = [
  {
    id: 'business',
    title: '业务管理',
    order: 20,
    permission: 'user:read',
    nav: tree,
    routes: [
      { path: '/business/users', component: async () => ({ default: () => null }) },
      {
        path: '/organization/roles',
        permission: 'role:read',
        component: async () => ({ default: () => null }),
      },
    ],
  },
  {
    id: 'disabled',
    title: '已关闭模块',
    order: 90,
    enabled: false,
    nav: [{ key: 'x', title: 'X', path: '/x' }],
    routes: [{ path: '/x', component: async () => ({ default: () => null }) }],
  },
]

describe('filterNav', () => {
  it('按权限裁剪导航，同时移除空的分组', () => {
    const result = filterNav(tree, (permission) => permission !== 'role:read')
    expect(result).toHaveLength(2)
    const business = result[0]
    expect(business?.children).toHaveLength(1)
    expect(business?.children?.[0]?.key).toBe('users')
  })

  it('全部无权限时分组被整体移除', () => {
    const result = filterNav(tree, (permission) => permission === undefined)
    expect(result.map((node) => node.key)).toEqual(['dashboard'])
  })
})

describe('flattenNav', () => {
  it('只展开叶子节点并带上层级链路', () => {
    const flat = flattenNav(modules)
    expect(flat.map((item) => item.path)).toEqual([
      '/business/users',
      '/organization/roles',
      '/dashboard/overview',
    ])
    expect(flat[0]?.trail).toEqual(['业务管理', '用户管理'])
  })

  it('忽略 enabled: false 的模块', () => {
    const flat = flattenNav(modules)
    expect(flat.some((item) => item.path === '/x')).toBe(false)
  })
})

describe('findNavTrail', () => {
  it('能匹配二级路径', () => {
    const trail = findNavTrail(tree, '/business/users')
    expect(trail.map((node) => node.key)).toEqual(['business', 'users'])
  })

  it('支持子路径前缀匹配', () => {
    const trail = findNavTrail(tree, '/business/users/u_1001')
    expect(trail.map((node) => node.key)).toEqual(['business', 'users'])
  })

  it('无匹配时返回空数组', () => {
    expect(findNavTrail(tree, '/unknown')).toEqual([])
  })
})

describe('flattenRoutes', () => {
  it('路由继承模块级权限', () => {
    const routes = flattenRoutes(modules)
    expect(routes.find((route) => route.path === '/business/users')?.permission).toBe('user:read')
  })

  it('路由自身的权限优先于模块权限', () => {
    const routes = flattenRoutes(modules)
    expect(routes.find((route) => route.path === '/organization/roles')?.permission).toBe(
      'role:read',
    )
  })

  it('跳过已关闭模块的路由', () => {
    const routes = flattenRoutes(modules)
    expect(routes.some((route) => route.path === '/x')).toBe(false)
  })
})

describe('partitionBySection', () => {
  it('按业务区 → 演示区排序，与入参顺序无关', () => {
    const items = [
      { id: 'templates', section: 'demo' as const },
      { id: 'business', section: 'main' as const },
      { id: 'components', section: 'demo' as const },
      { id: 'system', section: 'main' as const },
    ]
    const groups = partitionBySection(items)
    expect(groups.map((group) => group.section)).toEqual(['main', 'demo'])
    expect(groups[0]?.items.map((item) => item.id)).toEqual(['business', 'system'])
    expect(groups[1]?.items.map((item) => item.id)).toEqual(['templates', 'components'])
  })

  it('缺省 section 视为 main', () => {
    const groups = partitionBySection([{ id: 'dashboard' }, { id: 'templates', section: 'demo' }])
    expect(groups[0]?.items.map((item) => item.id)).toEqual(['dashboard'])
  })

  it('空分区被裁掉，避免侧栏出现孤立标题', () => {
    const groups = partitionBySection([{ id: 'dashboard', section: 'main' as const }])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.section).toBe('main')
  })

  it('全部为空时返回空数组', () => {
    expect(partitionBySection([])).toEqual([])
  })
})

describe('菜单布局的路径判定', () => {
  const navTree: NavNode[] = [
    {
      key: 'group-screens',
      title: '数据大屏',
      children: [
        { key: 'screens', title: '大屏模板', path: '/templates/screens' },
        { key: 'ops', title: '运维监控墙', path: '/templates/screen-ops' },
      ],
    },
    { key: 'kanban', title: '项目看板', path: '/templates/kanban' },
  ]

  it('精确路径与子路径都命中', () => {
    expect(isPathWithin('/templates/kanban', '/templates/kanban')).toBe(true)
    expect(isPathWithin('/templates/kanban/42', '/templates/kanban')).toBe(true)
  })

  it('前缀相似但不同段不算命中', () => {
    // /templates/screens 不能因为字面前缀而匹配 /templates/screen-ops
    expect(isPathWithin('/templates/screen-ops', '/templates/screens')).toBe(false)
    expect(isPathWithin('/dashboard', '/business')).toBe(false)
  })

  it('父级分组因任一子级命中而高亮', () => {
    const group = navTree[0]
    expect(group && isNodeActive(group, '/templates/screen-ops')).toBe(true)
    expect(group && isNodeActive(group, '/templates/kanban')).toBe(false)
  })

  it('展平只保留叶子且保持声明顺序', () => {
    expect(flattenLeaves(navTree).map((node) => node.path)).toEqual([
      '/templates/screens',
      '/templates/screen-ops',
      '/templates/kanban',
    ])
  })

  it('模块落点取第一个叶子路径', () => {
    expect(firstLeafPath(navTree)).toBe('/templates/screens')
    expect(firstLeafPath([])).toBeUndefined()
  })

  it('一组节点里任一命中即视为分组激活（顶部菜单高亮用）', () => {
    expect(isNavActive(navTree, '/templates/screen-ops')).toBe(true)
    expect(isNavActive(navTree, '/dashboard/overview')).toBe(false)
  })
})

describe('findActiveModule', () => {
  const modulesWithNav: Array<{ id: string; nav: NavNode[] }> = [
    {
      id: 'business',
      nav: [{ key: 'users', title: '用户管理', path: '/business/users' }],
    },
    {
      id: 'business-detail',
      nav: [{ key: 'detail', title: '用户详情', path: '/business/users/detail' }],
    },
    {
      id: 'templates',
      nav: [
        { key: 'kanban', title: '看板', path: '/templates/kanban' },
        { key: 'overview', title: '总览', path: '/templates/overview' },
      ],
    },
  ]

  it('同前缀时选更精确的模块（最长前缀命中）', () => {
    expect(findActiveModule(modulesWithNav, '/business/users/detail')?.id).toBe('business-detail')
  })

  it('普通路径命中对应模块', () => {
    expect(findActiveModule(modulesWithNav, '/templates/overview')?.id).toBe('templates')
  })

  it('无匹配返回 undefined（布局层据此回落到第一个模块）', () => {
    expect(findActiveModule(modulesWithNav, '/unknown/path')).toBeUndefined()
  })
})
