export type AccountStatus = 'ENABLED' | 'DISABLED' | 'LOCKED' | 'TERMINATED'

export type OrganizationUnitStatus = 'ENABLED' | 'DISABLED'

export type OrganizationUnitType = 'COMPANY' | 'DEPARTMENT'

export type OrganizationUnit = {
  id: string
  parentId: string | null
  name: string
  code: string
  unitType: OrganizationUnitType
  status: OrganizationUnitStatus
  managerAccountId: string | null
  sortOrder: number
  version: number
  directUserCount: number
  children: OrganizationUnit[]
}

export type OrganizationReference = {
  id: string
  name: string
  code: string
}

export type UserAccount = {
  id: string
  loginName: string
  displayName: string
  employeeCode: string | null
  workEmail: string | null
  mobilePhone: string | null
  organizationUnit: OrganizationReference
  accountStatus: AccountStatus
  lastSuccessfulLoginAt: string | null
  mustChangePassword: boolean
  bootstrapSystemAdministrator: boolean
  version: number
}

export type PageResponse<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
}

export type UserQuery = {
  page: number
  pageSize: number
  keyword?: string
  organizationUnitId?: string
  includeDescendants?: boolean
  statuses?: AccountStatus[]
}

export type CreateOrganizationUnitInput = {
  name: string
  code: string
  unitType: OrganizationUnitType
  parentId?: string
  managerAccountId?: string
  sortOrder: number
  status?: OrganizationUnitStatus
}

export type UpdateOrganizationUnitInput = {
  name: string
  code: string
  parentId?: string
  managerAccountId?: string
  sortOrder: number
  version: number
}

export type CreateUserInput = {
  loginName: string
  displayName: string
  employeeCode?: string
  workEmail?: string
  mobilePhone?: string
  organizationUnitId: string
  temporaryPassword: string
}

export type UpdateUserInput = {
  displayName: string
  employeeCode?: string
  workEmail?: string
  mobilePhone?: string
  version: number
}
