import { describe, expect, it } from 'vitest'

import {
  preferredDataScopeForPermission,
  requiresScopeReferences,
  toRoleGrantInput,
} from '@/features/menu-permissions/role-grant-policy'

describe('role grant policy', () => {
  it('keeps references only for named data scopes', () => {
    expect(requiresScopeReferences('NAMED_ORG_UNITS')).toBe(true)
    expect(requiresScopeReferences('NAMED_PROJECTS')).toBe(true)
    expect(requiresScopeReferences('ALL_ORGANIZATION')).toBe(false)

    expect(
      toRoleGrantInput(
        {
          permissionCode: 'IAM_ORGANIZATION_READ',
          dataScope: 'OWN_ORG',
          scopeReferences: 'should-be-cleared',
          conditionSummary: '  仅查看在职人员  ',
        },
        { dimension: 'DATA_SCOPE' },
      ),
    ).toEqual({
      permissionCode: 'IAM_ORGANIZATION_READ',
      dataScope: 'OWN_ORG',
      scopeReferences: undefined,
      conditionSummary: '仅查看在职人员',
    })
  })

  it('locks menu visibility grants to the service-side all-organization rule', () => {
    expect(
      preferredDataScopeForPermission({ dimension: 'MENU' }, 'OWN_ORG'),
    ).toBe('ALL_ORGANIZATION')

    expect(
      toRoleGrantInput(
        {
          permissionCode: 'IAM_MENU_RESOURCE_READ',
          dataScope: 'NAMED_PROJECTS',
          scopeReferences: 'ignored-by-menu-grant',
        },
        { dimension: 'MENU' },
      ),
    ).toMatchObject({
      permissionCode: 'IAM_MENU_RESOURCE_READ',
      dataScope: 'ALL_ORGANIZATION',
      scopeReferences: undefined,
    })
  })
})
