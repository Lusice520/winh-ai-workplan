import { describe, expect, it } from 'vitest'

import {
  menuItemsFromNavigation,
  navigationOpenKeys,
  pageContextForPath,
} from '@/features/menu-permissions/access-control-navigation'

describe('access-control navigation mapping', () => {
  const navigation = [
    {
      code: 'SYSTEM_MANAGEMENT',
      name: '系统管理',
      routeKey: null,
      iconKey: 'settings',
      children: [
        {
          code: 'ACCESS_CONTROL',
          name: '菜单与权限',
          routeKey: 'system.access-control',
          iconKey: 'shield-check',
          children: [],
        },
        {
          code: 'UNREGISTERED_PAGE',
          name: '未注册页面',
          routeKey: 'system.not-registered',
          iconKey: 'shield-cog',
          children: [],
        },
      ],
    },
  ]

  it('only renders backend-authorized routes registered in the SPA', () => {
    expect(menuItemsFromNavigation(navigation)).toMatchObject([
      {
        key: 'SYSTEM_MANAGEMENT',
        label: '系统管理',
        children: [
          {
            key: '/system/access-control/roles',
            label: '菜单与权限',
          },
        ],
      },
    ])
  })

  it('keeps menu hierarchy and resolves route-level breadcrumb context', () => {
    expect(navigationOpenKeys(navigation)).toEqual(['SYSTEM_MANAGEMENT'])
    expect(
      pageContextForPath('/system/access-control/temporary-grants'),
    ).toEqual(['系统管理', '菜单与权限'])
    expect(pageContextForPath('/unknown')).toEqual(['工作台'])
  })
})
