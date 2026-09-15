import { getJson, patchJson, postJson } from '@/api/client/http'
import type {
  AccountStatus,
  CreateOrganizationUnitInput,
  CreateUserInput,
  OrganizationUnit,
  OrganizationUnitStatus,
  PageResponse,
  UpdateOrganizationUnitInput,
  UpdateUserInput,
  UserAccount,
  UserQuery,
} from '@/features/organization-users/organization-user-types'

const iamPath = '/api/iam'

export function getOrganizationTree(signal?: AbortSignal) {
  return getJson<OrganizationUnit[]>(`${iamPath}/organization-units/tree`, {
    signal,
  })
}

export function createOrganizationUnit(input: CreateOrganizationUnitInput) {
  return postJson<OrganizationUnit>(`${iamPath}/organization-units`, input)
}

export function updateOrganizationUnit(
  unitId: string,
  input: UpdateOrganizationUnitInput,
) {
  return patchJson<OrganizationUnit>(
    `${iamPath}/organization-units/${unitId}`,
    input,
  )
}

export function transitionOrganizationUnitStatus(
  unitId: string,
  input: {
    targetStatus: OrganizationUnitStatus
    reason: string
    version: number
  },
) {
  return postJson<OrganizationUnit>(
    `${iamPath}/organization-units/${unitId}/status-transitions`,
    input,
  )
}

export function getUsers(query: UserQuery, signal?: AbortSignal) {
  const search = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    includeDescendants: String(query.includeDescendants ?? true),
  })
  if (query.keyword?.trim()) {
    search.set('keyword', query.keyword.trim())
  }
  if (query.organizationUnitId) {
    search.set('organizationUnitId', query.organizationUnitId)
  }
  if (query.statuses?.length) {
    query.statuses.forEach((status) => search.append('statuses', status))
  }

  return getJson<PageResponse<UserAccount>>(`${iamPath}/users?${search}`, {
    signal,
  })
}

export function getUser(accountId: string, signal?: AbortSignal) {
  return getJson<UserAccount>(`${iamPath}/users/${accountId}`, { signal })
}

export function createUser(input: CreateUserInput) {
  return postJson<UserAccount>(`${iamPath}/users`, input)
}

export function updateUser(accountId: string, input: UpdateUserInput) {
  return patchJson<UserAccount>(`${iamPath}/users/${accountId}`, input)
}

export function moveUser(
  accountId: string,
  input: {
    targetOrganizationUnitId: string
    reason: string
    version: number
  },
) {
  return postJson<UserAccount>(`${iamPath}/users/${accountId}/move`, input, {
    headers: { 'Idempotency-Key': createIdempotencyKey() },
  })
}

export function transitionUserStatus(
  accountId: string,
  input: { targetStatus: AccountStatus; reason: string; version: number },
) {
  return postJson<UserAccount>(
    `${iamPath}/users/${accountId}/status-transitions`,
    input,
    { headers: { 'Idempotency-Key': createIdempotencyKey() } },
  )
}

export function resetUserPassword(
  accountId: string,
  input: { temporaryPassword: string; reason: string; version: number },
) {
  return postJson<UserAccount>(
    `${iamPath}/users/${accountId}/password-resets`,
    input,
    { headers: { 'Idempotency-Key': createIdempotencyKey() } },
  )
}

function createIdempotencyKey() {
  return crypto.randomUUID()
}
