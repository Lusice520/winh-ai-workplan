import { describe, expect, it } from 'vitest'

import type { MenuResource } from '@/features/menu-permissions/access-control-types'
import { defaultParentIdForNewResource } from '@/features/menu-permissions/menu-resource-parent-default'

const directory: MenuResource = {
  id: 'directory',
  code: 'SYSTEM_MANAGEMENT',
  resourceType: 'DIRECTORY',
  parentId: null,
  name: '系统管理',
  routeKey: null,
  actionKey: null,
  iconKey: 'folder',
  sortOrder: 10,
  status: 'ENABLED',
  version: 0,
}

const page: MenuResource = {
  id: 'page',
  code: 'ACCESS_CONTROL',
  resourceType: 'MENU_PAGE',
  parentId: directory.id,
  name: '菜单与权限',
  routeKey: 'system.access-control',
  actionKey: null,
  iconKey: 'shield-check',
  sortOrder: 20,
  status: 'ENABLED',
  version: 0,
}

const operation: MenuResource = {
  id: 'operation',
  code: 'ACCESS_CONTROL_MANAGE',
  resourceType: 'OPERATION',
  parentId: page.id,
  name: '维护权限',
  routeKey: null,
  actionKey: 'iam.access-control.manage',
  iconKey: 'workflow',
  sortOrder: 30,
  status: 'ENABLED',
  version: 0,
}

describe('menu resource parent defaults', () => {
  const resources = [directory, page, operation]

  it('uses the selected enabled directory for a new menu page', () => {
    expect(
      defaultParentIdForNewResource(resources, directory, 'MENU_PAGE'),
    ).toBe(directory.id)
  })

  it('uses the selected page or an operation parent for a new operation', () => {
    expect(defaultParentIdForNewResource(resources, page, 'OPERATION')).toBe(
      page.id,
    )
    expect(
      defaultParentIdForNewResource(resources, operation, 'OPERATION'),
    ).toBe(page.id)
  })
})
