export type NavigationItem = {
  code: string
  name: string
  routeKey: string | null
  iconKey: string | null
  children: NavigationItem[]
}

export type MenuResourceType = 'DIRECTORY' | 'MENU_PAGE' | 'OPERATION'
export type MenuResourceStatus = 'ENABLED' | 'DISABLED'

export type MenuResource = {
  id: string
  code: string
  resourceType: MenuResourceType
  parentId: string | null
  name: string
  routeKey: string | null
  actionKey: string | null
  iconKey: string | null
  sortOrder: number
  status: MenuResourceStatus
  version: number
}

export type MenuResourceImpact = {
  resourceId: string
  directChildCount: number
  permissionItemCount: number
  roleGrantCount: number
  temporaryGrantCount: number
}

export type PermissionDimension =
  | 'MENU'
  | 'ACTION'
  | 'DATA_SCOPE'
  | 'SENSITIVE_FIELD'
  | 'FILE_ACTION'
  | 'SYSTEM_CONFIGURATION'

export type RiskLevel = 'NORMAL' | 'HIGH'
export type PermissionItemStatus = 'ENABLED' | 'DISABLED'

export type PermissionItem = {
  id: string
  code: string
  menuResourceId: string | null
  menuResourceCode: string | null
  name: string
  actionKey: string
  dimension: PermissionDimension
  riskLevel: RiskLevel
  canDelegate: boolean
  status: PermissionItemStatus
  version: number
}

export type DataScope =
  | 'SELF'
  | 'OWN_ORG'
  | 'OWN_ORG_AND_DESCENDANTS'
  | 'NAMED_ORG_UNITS'
  | 'PARTICIPATING_PROJECTS'
  | 'NAMED_PROJECTS'
  | 'NAMED_OBJECTS'
  | 'ALL_ORGANIZATION'
  | 'ALL_PROJECTS'

export type AccessRoleType = 'SYSTEM' | 'PROJECT' | 'STAGE'
export type AccessRoleStatus = 'DRAFT' | 'ENABLED' | 'DISABLED'

export type RoleGrant = {
  id: string
  permissionCode: string
  permissionName: string
  actionKey: string
  dimension: PermissionDimension
  riskLevel: RiskLevel
  dataScope: DataScope
  scopeReferences: string | null
  conditionSummary: string | null
}

export type AccessRole = {
  id: string
  code: string
  name: string
  roleType: AccessRoleType
  responsibilitySummary: string
  status: AccessRoleStatus
  delegationLevel: number
  version: number
  activeAssignmentCount: number
  grants: RoleGrant[]
}

export type RoleImpact = {
  roleId: string
  activeAssignmentCount: number
  historicalAssignmentCount: number
  permissionGrantCount: number
  relatedTemporaryGrantCount: number
}

export type SystemRoleAssignmentStatus = 'ACTIVE' | 'REVOKED'

export type SystemRoleAssignment = {
  id: string
  accountId: string
  accountLoginName: string | null
  accountDisplayName: string | null
  roleId: string
  roleCode: string
  roleName: string
  status: SystemRoleAssignmentStatus
  assignedByAccountId: string | null
  assignedAt: string
  version: number
}

export type SystemRoleAssignmentSet = {
  accountId: string
  version: number
  assignments: SystemRoleAssignment[]
}

export type TemporaryGrantStatus =
  'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED' | 'REVOKED' | 'EXPIRED'

export type TemporaryGrant = {
  id: string
  recipientAccountId: string
  recipientLoginName: string | null
  recipientDisplayName: string | null
  permissionCode: string
  permissionName: string
  riskLevel: RiskLevel
  dataScope: DataScope
  scopeReferences: string | null
  startsAt: string
  endsAt: string
  reason: string
  reviewerAccountId: string | null
  createdByAccountId: string | null
  createdByName: string | null
  reviewerName: string | null
  reviewedByAccountId: string | null
  reviewedAt: string | null
  reviewComment: string | null
  status: TemporaryGrantStatus
  revokedAt: string | null
  revokedByAccountId: string | null
  revokeReason: string | null
  version: number
  allowedActions: string[]
}

export type PermissionPreview = {
  subjectAccountId: string
  permissionCode: string
  allowed: boolean
  reasonCode: string
  explanation: string[]
}

export type RoleGrantInput = {
  permissionCode: string
  dataScope: DataScope
  scopeReferences?: string
  conditionSummary?: string
}
