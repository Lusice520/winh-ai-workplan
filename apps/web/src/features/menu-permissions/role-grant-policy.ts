import type {
  DataScope,
  PermissionItem,
  RoleGrantInput,
} from '@/features/menu-permissions/access-control-types'

export type RoleGrantDraft = {
  permissionCode: string
  dataScope: DataScope
  scopeReferences?: string
  conditionSummary?: string
}

const namedScopes = new Set<DataScope>([
  'NAMED_ORG_UNITS',
  'NAMED_PROJECTS',
  'NAMED_OBJECTS',
])

export function requiresScopeReferences(dataScope: DataScope | undefined) {
  return dataScope ? namedScopes.has(dataScope) : false
}

export function preferredDataScopeForPermission(
  permission: Pick<PermissionItem, 'dimension'> | undefined,
  currentScope: DataScope,
) {
  return permission?.dimension === 'MENU' ? 'ALL_ORGANIZATION' : currentScope
}

export function toRoleGrantInput(
  draft: RoleGrantDraft,
  permission: Pick<PermissionItem, 'dimension'> | undefined,
): RoleGrantInput {
  const dataScope = preferredDataScopeForPermission(permission, draft.dataScope)

  return {
    permissionCode: draft.permissionCode,
    dataScope,
    scopeReferences: requiresScopeReferences(dataScope)
      ? draft.scopeReferences?.trim() || undefined
      : undefined,
    conditionSummary: draft.conditionSummary?.trim() || undefined,
  }
}
