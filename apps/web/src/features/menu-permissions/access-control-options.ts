import type {
  AccessRoleType,
  DataScope,
  MenuResourceType,
  PermissionDimension,
} from '@/features/menu-permissions/access-control-types'

export const routeKeyOptions = [
  { value: 'system.overview', label: 'system.overview · 工作台' },
  {
    value: 'system.organization-users',
    label: 'system.organization-users · 组织与用户',
  },
  {
    value: 'system.access-control',
    label: 'system.access-control · 菜单与权限',
  },
]

export const actionKeyOptions = [
  {
    value: 'iam.organization-user.manage',
    label: 'iam.organization-user.manage',
  },
  {
    value: 'iam.access-control.manage',
    label: 'iam.access-control.manage',
  },
]

export const iconKeyOptions = [
  'settings',
  'gauge',
  'users',
  'shield-check',
  'users-cog',
  'shield-cog',
  'folder',
  'file',
  'key-round',
  'lock-keyhole',
  'list-tree',
  'database',
  'workflow',
].map((value) => ({ value, label: value }))

export const dataScopeOptions: Array<{ value: DataScope; label: string }> = [
  { value: 'SELF', label: '仅本人' },
  { value: 'OWN_ORG', label: '本组织' },
  { value: 'OWN_ORG_AND_DESCENDANTS', label: '本组织及下级' },
  { value: 'NAMED_ORG_UNITS', label: '指定组织' },
  { value: 'PARTICIPATING_PROJECTS', label: '参与的项目' },
  { value: 'NAMED_PROJECTS', label: '指定项目' },
  { value: 'NAMED_OBJECTS', label: '指定对象' },
  { value: 'ALL_ORGANIZATION', label: '全组织' },
  { value: 'ALL_PROJECTS', label: '全部项目' },
]

export const temporaryDataScopeOptions = dataScopeOptions.filter((option) =>
  [
    'SELF',
    'OWN_ORG',
    'NAMED_ORG_UNITS',
    'NAMED_PROJECTS',
    'NAMED_OBJECTS',
  ].includes(option.value),
)

export function labelForDataScope(value: DataScope) {
  return (
    dataScopeOptions.find((option) => option.value === value)?.label ?? value
  )
}

export function labelForRoleType(value: AccessRoleType) {
  return (
    {
      SYSTEM: '系统角色',
      PROJECT: '项目角色模板',
      STAGE: '阶段角色模板',
    } as const
  )[value]
}

export function labelForResourceType(value: MenuResourceType) {
  return (
    {
      DIRECTORY: '目录',
      MENU_PAGE: '菜单页',
      OPERATION: '操作资源',
    } as const
  )[value]
}

export function labelForDimension(value: PermissionDimension) {
  return (
    {
      MENU: '菜单可见',
      ACTION: '业务动作',
      DATA_SCOPE: '数据范围',
      SENSITIVE_FIELD: '敏感字段',
      FILE_ACTION: '文件动作',
      SYSTEM_CONFIGURATION: '系统配置',
    } as const
  )[value]
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false,
  }).format(new Date(value))
}

export function toDateTimeLocalValue(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000
  return new Date(value.getTime() - offset).toISOString().slice(0, 16)
}

export function toIsoDateTime(value: string) {
  return new Date(value).toISOString()
}
