import type {
  DeliveryObject,
  DeliveryResource,
  DeliverySnapshot,
} from './delivery-types'

export type ScopeRow = {
  id: string
  version: number
  status: string
  baseBaselineVersion: number
  stale: boolean
  objectCount: number
  resourceCount: number
  createdBy: string
  preparedBy: string
  createdAt: string
  updatedAt: string
  reason: string | null
}
export type ScopeObjectEdit = {
  proposed: DeliveryObject
  originalVersion: number | null
  workVersion: number | null
  adopted: boolean
}
export type ScopeResourceEdit = {
  proposed: DeliveryResource
  originalVersion: number | null
  releaseRequested: boolean
}
export type ScopeDraft = {
  objects: ScopeObjectEdit[]
  resources: ScopeResourceEdit[]
}
export type ScopeRound = {
  id: string
  version: number
  number: number
  status: string
  snapshotHash: string
  submittedBy: string
  submittedAt: string
  decidedBy: string | null
  decidedAt: string | null
  decisionNote: string | null
  baselineVersion: number | null
}
export type ScopeView = {
  change: ScopeRow
  reference: DeliverySnapshot
  candidate: DeliverySnapshot
  draft: ScopeDraft
  budgetReadable: boolean
  finalApproverId: string | null
  impact: string | null
  basis: string | null
  selectedPolicyEditionId: string | null
  problems: string[]
  staleProblems: string[]
  rounds: ScopeRound[]
  events: {
    id: string
    action: string
    actorId: string
    at: string
    note: string | null
  }[]
  allowedActions: string[]
}
export type ScopeFrozen = {
  baseBaselineVersion: number
  baseHash: string
  reference: DeliverySnapshot
  candidate: DeliverySnapshot
  draft: ScopeDraft
  reason: string | null
  impact: string | null
  basis: string | null
  preparedBy: string
}
export const scopeLabel = (status: string) =>
  ({
    DRAFT: '变更草案',
    RETURNED: '退回补齐',
    SUBMITTED: '待独立确认',
    APPROVED: '已生效',
    CANCELLED: '已取消',
    WITHDRAWN: '已撤回',
  })[status] ?? status

export const scopeActionLabel = (action: string) =>
  ({
    CREATED: '建立草案',
    EDITED: '更新说明',
    OBJECT_EDITED: '维护对象',
    OBJECT_RETIRED: '拟停用对象',
    RESOURCE_EDITED: '维护资源',
    RESOURCE_SIGNED: '签认资源',
    SUBMIT: '提交确认',
    APPROVE: '独立批准',
    RETURN: '退回补齐',
    WITHDRAW: '撤回提交',
    CANCEL: '取消提案',
    REBASE: '更新引用依据',
    REVERT_OBJECT: '撤回对象调整',
    REVERT_RESOURCE: '撤回资源调整',
  })[action] ?? action
