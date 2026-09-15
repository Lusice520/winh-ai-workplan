export { DrawerTitle, FormSection } from '@/shared/ui/form-drawer'

import type {
  AccountStatus,
  OrganizationUnit,
  OrganizationUnitStatus,
  UserAccount,
} from '@/features/organization-users/organization-user-types'

export type DepartmentDrawerState =
  | { mode: 'create'; unit?: undefined }
  | { mode: 'edit'; unit: OrganizationUnit }
  | undefined

export type UserDrawerState =
  | { mode: 'create'; user?: undefined }
  | { mode: 'edit'; user: UserAccount }
  | undefined

export type AccountAction = 'move' | 'status' | 'reset-password'

export type AccountActionState = {
  action: AccountAction
  user: UserAccount
}

export type DepartmentFormValues = {
  name: string
  code: string
  parentId?: string
  managerAccountId?: string
  status: OrganizationUnitStatus
  sortOrder: number
  reason?: string
}

export type UserFormValues = {
  loginName: string
  displayName: string
  employeeCode?: string
  workEmail?: string
  mobilePhone?: string
  organizationUnitId: string
  temporaryPassword?: string
}

export type AccountActionFormValues = {
  targetOrganizationUnitId?: string
  targetStatus?: AccountStatus
  temporaryPassword?: string
  reason: string
}

export type OrganizationTreeOption = {
  title: string
  value: string
  disabled?: boolean
  children?: OrganizationTreeOption[]
}
