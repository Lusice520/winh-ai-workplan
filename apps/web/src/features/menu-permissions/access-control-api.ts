import { getJson, patchJson, postJson, putJson } from '@/api/client/http'
import type {
  AccessRole,
  AccessRoleStatus,
  AccessRoleType,
  DataScope,
  MenuResource,
  MenuResourceImpact,
  MenuResourceStatus,
  MenuResourceType,
  NavigationItem,
  PermissionItem,
  PermissionPreview,
  RoleGrantInput,
  RoleImpact,
  SystemRoleAssignment,
  SystemRoleAssignmentSet,
  TemporaryGrant,
  TemporaryGrantStatus,
} from '@/features/menu-permissions/access-control-types'

const accessControlPath = '/api/access-control'

type IdempotentOptions = {
  headers: { 'Idempotency-Key': string }
}

export function getNavigation(signal?: AbortSignal) {
  return getJson<NavigationItem[]>(accessControlPath + '/navigation', {
    signal,
  })
}

export function getAccessControlCapabilities(signal?: AbortSignal) {
  return getJson<string[]>(accessControlPath + '/capabilities', { signal })
}

export function getMenuResources(signal?: AbortSignal) {
  return getJson<MenuResource[]>(accessControlPath + '/menu-resources', {
    signal,
  })
}

export function createMenuResource(input: {
  code: string
  resourceType: MenuResourceType
  parentId?: string
  name: string
  routeKey?: string
  actionKey?: string
  iconKey?: string
  sortOrder: number
  status?: MenuResourceStatus
}) {
  return postJson<MenuResource>(
    accessControlPath + '/menu-resources',
    input,
    idempotentOptions(),
  )
}

export function updateMenuResource(
  resourceId: string,
  input: {
    name: string
    routeKey?: string
    actionKey?: string
    iconKey?: string
    sortOrder: number
    version: number
  },
) {
  return patchJson<MenuResource>(
    accessControlPath + '/menu-resources/' + resourceId,
    input,
    idempotentOptions(),
  )
}

export function moveMenuResource(
  resourceId: string,
  input: { parentId?: string; reason: string; version: number },
) {
  return postJson<MenuResource>(
    accessControlPath + '/menu-resources/' + resourceId + '/move',
    input,
    idempotentOptions(),
  )
}

export function changeMenuResourceStatus(
  resourceId: string,
  input: { status: MenuResourceStatus; reason: string; version: number },
) {
  return postJson<MenuResource>(
    accessControlPath + '/menu-resources/' + resourceId + '/status',
    input,
    idempotentOptions(),
  )
}

export function getMenuResourceImpact(
  resourceId: string,
  signal?: AbortSignal,
) {
  return getJson<MenuResourceImpact>(
    accessControlPath + '/menu-resources/' + resourceId + '/impact',
    { signal },
  )
}

export function getPermissionItems(signal?: AbortSignal) {
  return getJson<PermissionItem[]>(accessControlPath + '/permission-items', {
    signal,
  })
}

export function getRoles(
  query: {
    roleType?: AccessRoleType
    status?: AccessRoleStatus
    keyword?: string
  } = {},
  signal?: AbortSignal,
) {
  const search = new URLSearchParams()
  if (query.roleType) search.set('roleType', query.roleType)
  if (query.status) search.set('status', query.status)
  if (query.keyword?.trim()) search.set('keyword', query.keyword.trim())
  const suffix = search.size ? '?' + search.toString() : ''
  return getJson<AccessRole[]>(accessControlPath + '/roles' + suffix, {
    signal,
  })
}

export function getRole(roleId: string, signal?: AbortSignal) {
  return getJson<AccessRole>(accessControlPath + '/roles/' + roleId, { signal })
}

export function createRole(input: {
  code: string
  name: string
  roleType: AccessRoleType
  responsibilitySummary: string
  status?: AccessRoleStatus
  delegationLevel: number
  grants: RoleGrantInput[]
}) {
  return postJson<AccessRole>(
    accessControlPath + '/roles',
    input,
    idempotentOptions(),
  )
}

export function updateRole(
  roleId: string,
  input: {
    name: string
    responsibilitySummary: string
    delegationLevel: number
    version: number
    grants: RoleGrantInput[]
  },
) {
  return patchJson<AccessRole>(
    accessControlPath + '/roles/' + roleId,
    input,
    idempotentOptions(),
  )
}

export function changeRoleStatus(
  roleId: string,
  input: { status: AccessRoleStatus; reason: string; version: number },
) {
  return postJson<AccessRole>(
    accessControlPath + '/roles/' + roleId + '/status',
    input,
    idempotentOptions(),
  )
}

export function getRoleImpact(roleId: string, signal?: AbortSignal) {
  return getJson<RoleImpact>(
    accessControlPath + '/roles/' + roleId + '/impact',
    {
      signal,
    },
  )
}

export function getSystemRoleAssignments(
  query: { accountId?: string } = {},
  signal?: AbortSignal,
) {
  const suffix = query.accountId
    ? '?' + new URLSearchParams({ accountId: query.accountId }).toString()
    : ''
  return getJson<SystemRoleAssignment[]>(
    accessControlPath + '/system-role-assignments' + suffix,
    { signal },
  )
}

export function getSystemRoleAssignmentSet(
  accountId: string,
  signal?: AbortSignal,
) {
  return getJson<SystemRoleAssignmentSet>(
    accessControlPath + '/accounts/' + accountId + '/system-role-assignments',
    { signal },
  )
}

export function replaceSystemRoleAssignments(
  accountId: string,
  input: { roleIds: string[]; version: number; reason: string },
) {
  return putJson<SystemRoleAssignmentSet>(
    accessControlPath + '/accounts/' + accountId + '/system-role-assignments',
    input,
    idempotentOptions(),
  )
}

export function getTemporaryGrants(
  query: { recipientAccountId?: string; status?: TemporaryGrantStatus } = {},
  signal?: AbortSignal,
) {
  const search = new URLSearchParams()
  if (query.recipientAccountId) {
    search.set('recipientAccountId', query.recipientAccountId)
  }
  if (query.status) search.set('status', query.status)
  const suffix = search.size ? '?' + search.toString() : ''
  return getJson<TemporaryGrant[]>(
    accessControlPath + '/temporary-grants' + suffix,
    { signal },
  )
}

export function createTemporaryGrant(input: {
  recipientAccountId: string
  permissionCode: string
  dataScope: DataScope
  scopeReferences?: string
  startsAt: string
  endsAt: string
  reason: string
  reviewerAccountId?: string
}) {
  return postJson<TemporaryGrant>(
    accessControlPath + '/temporary-grants',
    input,
    idempotentOptions(),
  )
}

export function revokeTemporaryGrant(
  grantId: string,
  input: { reason: string; version: number },
) {
  return postJson<TemporaryGrant>(
    accessControlPath + '/temporary-grants/' + grantId + '/revoke',
    input,
    idempotentOptions(),
  )
}

export function previewPermission(input: {
  subjectAccountId: string
  permissionCode: string
  organizationUnitId?: string
  projectId?: string
  objectReference?: string
  participatingProject?: boolean
  resourceEnabled?: boolean
  recordStateAllowed?: boolean
  sensitiveConditionsMet?: boolean
}) {
  return postJson<PermissionPreview>(
    accessControlPath + '/permission-preview',
    input,
    idempotentOptions(),
  )
}

function idempotentOptions(): IdempotentOptions {
  return { headers: { 'Idempotency-Key': crypto.randomUUID() } }
}
