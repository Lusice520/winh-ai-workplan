import type {
  AccountStatus,
  OrganizationUnit,
} from '@/features/organization-users/organization-user-types'
import type { OrganizationTreeOption } from '@/features/organization-users/organization-user-ui'

export const accountStatusMeta: Record<
  AccountStatus,
  { label: string; className: string }
> = {
  ENABLED: { label: '启用', className: 'account-status-tag--enabled' },
  DISABLED: { label: '停用', className: 'account-status-tag--disabled' },
  LOCKED: { label: '锁定', className: 'account-status-tag--locked' },
  TERMINATED: { label: '已终止', className: 'account-status-tag--terminated' },
}

export function findOrganization(
  units: OrganizationUnit[],
  targetId: string | undefined,
): OrganizationUnit | undefined {
  for (const unit of units) {
    if (unit.id === targetId) {
      return unit
    }
    const childMatch = findOrganization(unit.children, targetId)
    if (childMatch) {
      return childMatch
    }
  }

  return undefined
}

export function toOrganizationTreeOptions(
  units: OrganizationUnit[],
): OrganizationTreeOption[] {
  return units.map((unit) => ({
    title: unit.name,
    value: unit.id,
    disabled: unit.status === 'DISABLED',
    children: toOrganizationTreeOptions(unit.children),
  }))
}

export function getInitials(name: string) {
  return name.trim().slice(-2) || '用户'
}

export function avatarColor(name: string) {
  const tones = ['#eaf2ff', '#edeaff', '#e8f8f0', '#fff2e7', '#e9f7f9']
  const value = [...name].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  )
  return tones[value % tones.length]
}

export function formatTime(value: string | null) {
  if (!value) {
    return '—'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}
