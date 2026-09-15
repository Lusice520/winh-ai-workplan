import type { Event } from '@/features/business/business-types'
import type { StageTemplate, ReviewPolicy } from './configuration-types'

export type DeliveryHeader = {
  projectManagerId: string
  technicalLeadId: string | null
  projectType: string
  riskLevel: string
  scopeAcceptance: string | null
  acceptanceCriteria: string | null
  timeConstraints: string | null
  handoverFollowups: string | null
}
export type DeliveryStage = {
  templateCode: string | null
  title: string
  applicable: boolean
  applicabilityReason: string | null
  differenceReason: string | null
  ownerId: string | null
  startsOn: string | null
  endsOn: string | null
  predecessorIds: string[]
  parallelIds: string[]
  focus: boolean
  actions: string[]
  deliverables: string[]
  completionCriteria: string | null
}
export type DeliveryMilestone = {
  title: string
  kind: string
  dueDate: string | null
  ownerId: string | null
  stageId: string | null
  contractNodeId: string | null
  sourceNote: string | null
  acceptanceCriteria: string | null
}
export type DeliveryItem = {
  title: string
  category: string
  specification: string | null
  quantity: number | null
  unit: string | null
  acceptanceScope: string | null
  stageId: string | null
  workPackageId: string | null
  milestoneId: string | null
  procurementNeeded: boolean
  procurementNote: string | null
}
export type DeliveryWorkPackage = {
  title: string
  scope: string
  deliverables: string | null
  acceptanceCriteria: string | null
  ownerId: string
  verifierId: string
  stageId: string | null
  startsOn: string | null
  endsOn: string | null
  resourceNotes: string | null
  itemIds: string[]
  milestoneIds: string[]
}
export type DeliveryPlan = {
  title: string
  kind: string
  stageId: string | null
  workPackageId: string | null
  startsOn: string | null
  endsOn: string | null
  deliveryWindowStart: string | null
  deliveryWindowEnd: string | null
  dependsOnIds: string[]
  resourceConstraints: string | null
}
export type BudgetLine = {
  title: string
  category: string
  amount: number | string
  stageId: string | null
  workPackageId: string | null
  resourceRequestId: string | null
  itemId: string | null
  basis: string | null
}
export type DeliveryBudget = {
  mode: string
  scope: string | null
  authorizedStageIds: string[]
  authorizedCap: number | string | null
  expiresOn: string | null
  nextCompletionOn: string | null
  remainingScope: string | null
  lines: BudgetLine[]
}
export type DeliveryContent = {
  stage: DeliveryStage | null
  milestone: DeliveryMilestone | null
  item: DeliveryItem | null
  workPackage: DeliveryWorkPackage | null
  plan: DeliveryPlan | null
  budget: DeliveryBudget | null
}
export type DeliveryKind =
  'STAGE' | 'MILESTONE' | 'ITEM' | 'WORK_PACKAGE' | 'PLAN' | 'BUDGET'
export type DeliveryObject = {
  id: string
  version: number
  kind: DeliveryKind
  content: DeliveryContent
  preparedBy: string
  archived: boolean
  baselineVersion: number
}
export type ResourceRequest = {
  workPackageId: string
  personId: string
  committerId: string
  startsOn: string
  endsOn: string
  dailyHours: number
  requestNote: string
}
export type ResourceCommitment = {
  dailyCapacity: number
  conclusion: string
  impact: string | null
  escalationPath: string | null
}
export type DeliveryResource = {
  id: string
  version: number
  request: ResourceRequest
  status: string
  commitment: ResourceCommitment | null
  committedBy: string | null
  committedAt: string | null
  preparedBy: string
  overlapHash: string | null
}
export type FindingContent = {
  title: string
  kind: string
  impactCategory: string
  riskLevel: string
  ownerId: string
  verifierId: string
  dueDate: string
  closingCriteria: string
  impactScope: string
  escalationOwnerId: string
  escalationPath: string
}
export type DeliveryFinding = {
  id: string
  version: number
  finding: FindingContent
  status: string
  blocking: boolean
  preparedBy: string
  evidence: string | null
  evidenceBy: string | null
  evidenceAt: string | null
  verification: string | null
  verifiedBy: string | null
  verifiedAt: string | null
}
export type PublishedDeliveryConfiguration = {
  id: string
  seriesId: string
  edition: number
  name: string
  kind: string
  template: StageTemplate | null
  policy: ReviewPolicy | null
  snapshotHash: string
}
export type HandoverReference = {
  id: string
  projectId: string
  receiverId: string
  number: string
  hash: string
  basisKind: string
  projectType: string
}
export type DeliveryRow = {
  projectId: string
  projectCode: string
  projectName: string
  customerName: string
  mainStage: string
  projectStatus: string
  status: string
  managerId: string | null
  managerName: string | null
  roundNumber: number
  baselineVersion: number
  openFindings: number
  overdueFindings: number
  updatedAt: string | null
}
export type DeliveryPreparation = {
  id: string
  version: number
  status: string
  header: DeliveryHeader
  roundNumber: number
  baselineVersion: number
  handover: HandoverReference
  template: PublishedDeliveryConfiguration | null
  policy: PublishedDeliveryConfiguration | null
  budgetReadable: boolean
  reviewAssignments: { accountId: string; scope: string }[]
  finalApproverId: string | null
}
export type DeliveryCheck = {
  code: string
  title: string
  status: string
  problems: string[]
  href: string
}
export type DeliveryReview = {
  id: string
  version: number
  reviewerId: string
  scope: string
  status: string
  comment: string | null
  reviewedAt: string | null
}
export type DeliveryRound = {
  id: string
  version: number
  number: number
  status: string
  snapshotHash: string
  submittedBy: string
  submittedAt: string
  submissionNote: string | null
  decidedBy: string | null
  decidedAt: string | null
  decisionNote: string | null
  reviews: DeliveryReview[]
}
export type DeliveryBaseline = {
  id: string
  number: number
  snapshotHash: string
  approvedBy: string
  approvedAt: string
  reason: string
}
export type DeliveryChange = {
  id: string
  version: number
  objectId: string
  expectedObjectVersion: number
  status: string
  content: DeliveryContent
  archiveRequested: boolean
  submittedBy: string
  reason: string | null
  impact: string | null
  basis: string | null
  decidedBy: string | null
  decidedAt: string | null
  decision: string | null
}
export type DeliveryWorkspace = {
  project: DeliveryRow
  preparation: DeliveryPreparation | null
  objects: DeliveryObject[]
  resources: DeliveryResource[]
  findings: DeliveryFinding[]
  checks: DeliveryCheck[]
  rounds: DeliveryRound[]
  baselines: DeliveryBaseline[]
  changes: DeliveryChange[]
  people: { id: string; name: string }[]
  history: Event[]
  allowedActions: string[]
}
export type DeliverySnapshot = {
  caseId: string
  projectId: string
  caseVersion: number
  header: DeliveryHeader
  preparedBy: string
  handover: HandoverReference
  template: PublishedDeliveryConfiguration | null
  policy: PublishedDeliveryConfiguration | null
  objects: DeliveryObject[]
  resources: DeliveryResource[]
  findings: DeliveryFinding[]
}
export type WorkPackageCandidate = {
  id: string
  version: number
  title: string
  kind: string
  status: string
  sourceRequirementId: string | null
  creationSource: string
  ownerId: string
  verifierId: string
  dueDate: string | null
  deliveryState: string
  deliveryBaselineVersion: number
}
export type ContractNodeCandidate = {
  id: string
  contractId: string
  version: number
  title: string
  dueDate: string
}
export type ResourceOverlap = {
  resourceId: string | null
  projectId: string | null
  projectName: string
  startsOn: string
  endsOn: string
  dailyHours: number
  status: string
}

export const deliveryLabels: Record<string, string> = {
  PREPARING: '立项准备',
  NOT_STARTED: '待开始准备',
  WITHDRAWN: '已撤回',
  SUBMITTED: '待评审',
  IN_REVIEW: '评审中',
  APPROVED: '已批准',
  RETURNED: '已退回',
  PASS: '通过',
  BLOCKED: '待补齐',
  RESTRICTED: '受限',
  STAGE: '项目阶段',
  MILESTONE: '里程碑',
  ITEM: '项目清单',
  WORK_PACKAGE: '专业工作包',
  PLAN: '计划',
  BUDGET: '实施预算',
  REQUESTED: '待承诺',
  COMMITTED: '已承诺',
  CONFLICT: '待协调',
  RESOLVED: '已协调',
  REVOKED: '已撤回',
  PENDING: '待处理',
  AGREED: '已同意',
  OPEN: '待处理',
  PENDING_VERIFICATION: '待验证',
  CLOSED: '已关闭',
  FULL: '全范围',
  PHASED: '分阶段',
  BASELINED: '已批准基线',
  PERSONNEL: '人员成本',
  PROCUREMENT: '设备采购',
  SUBCONTRACT: '分包实施',
  TRAVEL: '差旅费用',
  OTHER: '其他费用',
  MASTER: '主计划',
  EQUIPMENT: '设备',
  MATERIAL: '物料',
  DELIVERABLE: '交付成果',
  ACCEPTANCE: '验收节点',
  CONTRACT: '合同节点',
  DELIVERY: '交付节点',
  LEGAL: '法律开工条件',
  SCOPE: '范围与验收',
  RESPONSIBILITY: '关键责任',
  INITIAL_RESOURCE: '首段资源',
  KEY_DATE: '关键日期',
  DETAIL: '后续细化',
  RISK: '风险',
  GAP: '缺项',
  DEPENDENCY: '外部依赖',
  LOW: '低风险',
  MEDIUM: '中风险',
  HIGH: '高风险',
}
export const deliveryLabel = (key?: string | null) =>
  key ? (deliveryLabels[key] ?? key) : '—'
export const deliveryOptions = (keys: string[]) =>
  keys.map((value) => ({ value, label: deliveryLabel(value) }))
export const contentKey: Record<DeliveryKind, keyof DeliveryContent> = {
  STAGE: 'stage',
  MILESTONE: 'milestone',
  ITEM: 'item',
  WORK_PACKAGE: 'workPackage',
  PLAN: 'plan',
  BUDGET: 'budget',
}
export const objectTitle = (
  o: DeliveryObject | { kind: DeliveryKind; content: DeliveryContent },
) =>
  o.kind === 'BUDGET'
    ? '实施预算'
    : ((o.content[contentKey[o.kind]] as { title: string } | null)?.title ??
      '待补齐名称')
export const personName = (data: DeliveryWorkspace, id?: string | null) =>
  id ? (data.people.find((p) => p.id === id)?.name ?? '当前责任人') : '待明确'
export const objectName = (data: DeliveryWorkspace, id?: string | null) =>
  id
    ? data.objects.find((o) => o.id === id && !o.archived)
      ? objectTitle(data.objects.find((o) => o.id === id)!)
      : '关联已失效'
    : '待关联'
export const activeObjects = (
  data: { objects: DeliveryObject[] },
  kind: DeliveryKind,
) => data.objects.filter((o) => !o.archived && o.kind === kind)

export const objectOptions = (
  data: { objects: DeliveryObject[] },
  kind: DeliveryKind,
  exclude?: string,
) =>
  activeObjects(data, kind)
    .filter(
      (o) =>
        o.id !== exclude && (kind !== 'STAGE' || o.content.stage?.applicable),
    )
    .map((o) => ({ value: o.id, label: objectTitle(o) }))

// Sum exact cents. Individual rows are bounded by the server; totals may exceed Number's integer precision.
export function cents(value: number | string): bigint {
  const text = typeof value === 'number' ? value.toFixed(2) : value
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return 0n
  const [whole, fraction = ''] = text.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}
export const budgetCents = (budget?: DeliveryBudget | null) =>
  budget?.lines.reduce((sum, line) => sum + cents(line.amount), 0n) ?? 0n
export const formatCents = (amount: bigint) =>
  '¥' +
  (amount / 100n).toLocaleString('zh-CN') +
  '.' +
  (amount % 100n).toString().padStart(2, '0')
