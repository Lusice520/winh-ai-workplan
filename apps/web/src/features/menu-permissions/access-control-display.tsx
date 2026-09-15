import { Tag } from 'antd'

import type {
  AccessRoleStatus,
  MenuResourceStatus,
  RiskLevel,
  TemporaryGrantStatus,
} from '@/features/menu-permissions/access-control-types'

export function StatusTag({
  status,
}: {
  status:
    | MenuResourceStatus
    | AccessRoleStatus
    | TemporaryGrantStatus
    | 'ACTIVE'
    | 'REVOKED'
}) {
  const properties = {
    ENABLED: { color: 'success', label: '启用' },
    DISABLED: { color: 'default', label: '停用' },
    DRAFT: { color: 'processing', label: '草稿' },
    ACTIVE: { color: 'success', label: '生效中' },
    PENDING_REVIEW: { color: 'processing', label: '待独立复核' },
    REJECTED: { color: 'error', label: '未通过' },
    REVOKED: { color: 'default', label: '已撤销' },
    EXPIRED: { color: 'warning', label: '已到期' },
  }[status]

  return (
    <Tag color={properties.color} className="!mr-0">
      {properties.label}
    </Tag>
  )
}

export function RiskTag({ riskLevel }: { riskLevel: RiskLevel }) {
  return riskLevel === 'HIGH' ? (
    <Tag color="volcano" className="!mr-0">
      高敏感
    </Tag>
  ) : (
    <Tag color="blue" className="!mr-0">
      常规
    </Tag>
  )
}
