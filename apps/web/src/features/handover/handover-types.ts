import type { Event } from '@/features/business/business-types'

export type HandoverCase = {
  id: string
  version: number
  projectId: string
  projectType: string
  templateVersion: string
  status: string
  receiverId: string
  receiverName: string
  dueDate: string
  basisKind: string | null
  basisReferenceId: string | null
  basisNote: string | null
}
export type HandoverItem = {
  id: string
  version: number
  key: string
  name: string
  groupKey: string
  applicability: string
  applicable: boolean
  ownerId: string
  ownerName: string
  dueDate: string
  referenceKind: string | null
  referenceId: string | null
  referenceTitle: string | null
  note: string | null
  status: string
  problem: string | null
  overdue: boolean
}
export type HandoverReview = {
  id: string
  version: number
  status: string
  submittedBy: string
  submittedByName: string
  submissionNote: string
  reviewedByName: string | null
  createdAt: string
  reviewedAt: string | null
  comment: string | null
  snapshotHash: string
}
export type HandoverPackage = {
  id: string
  number: string
  snapshotHash: string
  approvedByName: string
  approvedAt: string
  current: boolean
  comment: string
}
export type HandoverWorkspace = {
  handover: HandoverCase | null
  items: HandoverItem[]
  requiredCount: number
  readyCount: number
  missingCount: number
  reviews: HandoverReview[]
  packages: HandoverPackage[]
  history: Event[]
  allowedActions: string[]
}
export type HandoverPackageDetail = {
  handoverPackage: HandoverPackage
  projectCode: string
  projectName: string
  projectType: string
  templateVersion: string
  receiverName: string
  dueDate: string
  basisKind: string
  basisNote: string
  items: HandoverItem[]
}
export type EarlyFacts = {
  projectId: string
  title: string
  scope: string
  scopeItems: string[]
  requestedHours: number
  requestedCost: number
  startsOn: string
  endsOn: string
  riskOwnerId: string
  stopConditions: string
  missingItems: string
  regularizationPlan: string
}
export type LedgerTotals = {
  committedHours: number
  committedCost: number
  outstandingHours: number
  outstandingCost: number
  actualHours: number
  actualCost: number
  usedHours: number
  usedCost: number
}
export type EarlyApplication = {
  id: string
  version: number
  request: EarlyFacts
  riskOwnerName: string
  status: string
  effectiveStatus: string
  approvedHours: number | null
  approvedCost: number | null
  submittedBy: string | null
  submittedByName: string | null
  approvedByName: string | null
  approvedAt: string | null
  regularizationPackageId: string | null
  finishReason: string | null
  totals: LedgerTotals
}
export type EarlyReview = {
  id: string
  version: number
  applicationId: string
  status: string
  snapshot: EarlyFacts
  submittedBy: string
  submittedByName: string
  reviewedByName: string | null
  createdAt: string
  reviewedAt: string | null
  comment: string | null
}
export type EarlyLedger = {
  id: string
  applicationId: string
  kind: string
  commitmentType: string
  scopeItem: string
  ownerId: string
  ownerName: string
  occurredOn: string
  hours: number
  cost: number
  evidence: string
  commitmentId: string | null
  reversesId: string | null
  allowanceId: string | null
  reversed: boolean
  recordedByName: string
}
export type EarlyAllowance = {
  id: string
  applicationId: string
  scopeItem: string
  hours: number
  cost: number
  startsOn: string
  endsOn: string
  reason: string
  approvedByName: string
  totals: LedgerTotals
}
export type EarlyWorkspace = {
  applications: EarlyApplication[]
  reviews: EarlyReview[]
  ledger: EarlyLedger[]
  allowances: EarlyAllowance[]
  ledgerVisible: boolean
  history: Event[]
  allowedActions: string[]
}
