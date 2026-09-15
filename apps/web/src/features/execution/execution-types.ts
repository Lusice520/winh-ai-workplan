import type { DeliveryObject } from '@/features/delivery/delivery-types'
import type { FileReference } from '@/features/files/file-types'

export type ExecutionObject = Omit<DeliveryObject, 'preparedBy'>
export type StageExecution = {
  id: string
  version: number
  status: string
  progress: number
  startedOn: string | null
  completedOn: string | null
  blockers: string[]
  allowedActions: string[]
}
export type ItemProfile = {
  version: number
  requiresReceipt: boolean
  requiresInstallation: boolean
  brand: string | null
  model: string | null
  supplier: string | null
}
export type ItemTotals = {
  received: number
  installed: number
  accepted: number
  pending: number
  needsReview: number
}
export type ItemExecution = {
  id: string
  profile: ItemProfile | null
  totals: ItemTotals
  allowedActions: string[]
}
export type ItemEvent = {
  id: string
  version: number
  itemId: string
  kind: string
  status: string
  quantity: number
  occurredOn: string
  evidence: string
  files: FileReference[]
  restrictedFileCount: number
  submittedBy: string
  submitterName: string
  verifierId: string | null
  verifierName: string | null
  decidedBy: string | null
  decisionName: string | null
  decidedAt: string | null
  decision: string | null
  reversalOfId: string | null
  objectVersion: number
  baselineVersion: number
  createdAt: string
  allowedActions: string[]
}
export type MilestoneExecution = {
  id: string
  version: number
  status: string
  occurredOn: string | null
  evidence: string | null
  files: FileReference[]
  restrictedFileCount: number
  submittedBy: string | null
  submitterName: string | null
  verifierId: string | null
  verifierName: string | null
  decidedBy: string | null
  decisionName: string | null
  decidedAt: string | null
  decision: string | null
  blockers: string[]
  allowedActions: string[]
}
export type ExecutionEvent = {
  id: string
  objectId: string
  kind: string
  action: string
  note: string
  actorId: string
  actorName: string
  occurredOn: string
  beforeJson: string
  afterJson: string
  beforeFiles: { files: FileReference[]; restricted: number }
  afterFiles: { files: FileReference[]; restricted: number }
  objectVersion: number
  baselineVersion: number
  at: string
}
export type ExecutionWorkspace = {
  projectId: string
  projectName: string
  projectStatus: string
  managerId: string
  baselineVersion: number
  objects: ExecutionObject[]
  stages: StageExecution[]
  items: ItemExecution[]
  milestones: MilestoneExecution[]
  recentEvents: ExecutionEvent[]
  reviewQueue: ItemEvent[]
  allowedActions: string[]
}
export type ItemExecutionDetail = {
  object: ExecutionObject
  item: ItemExecution
  events: ItemEvent[]
  history: ExecutionEvent[]
}
export const executionLabels: Record<string, string> = {
  OPEN: '未提交',
  NOT_STARTED: '未开始',
  IN_PROGRESS: '进行中',
  PAUSED: '已暂停',
  COMPLETED: '已完成',
  SKIPPED: '不适用',
  NEEDS_REVIEW: '需重新核验',
  PENDING: '待验证',
  VERIFIED: '已验证',
  RECORDED: '已记录',
  RETURNED: '已退回',
  REVERSED: '已冲回',
  START: '开始阶段',
  PROGRESS: '登记进展',
  PAUSE: '暂停阶段',
  RESUME: '恢复阶段',
  COMPLETE: '确认阶段完成',
  REOPEN: '明确重开',
  PROFILE: '执行环节与资料',
  RECEIVED: '登记到货',
  INSTALLED: '登记安装',
  ACCEPTED: '提交验收',
  REVERSAL: '冲回记录',
  SUBMIT: '提交实际完成',
  VERIFY: '独立核验通过',
  RETURN: '退回补齐',
  REVERSE: '冲回此记录',
  STAGE_START: '开始阶段',
  STAGE_PROGRESS: '登记阶段进展',
  STAGE_PAUSE: '暂停阶段',
  STAGE_RESUME: '恢复阶段',
  STAGE_COMPLETE: '阶段完成',
  STAGE_REOPEN: '阶段重开',
  ITEM_PROFILE: '明确执行环节与资料',
  ITEM_RECEIVED: '登记到货',
  ITEM_INSTALLED: '登记安装',
  ITEM_ACCEPTED: '提交分批验收',
  ITEM_VERIFY: '验收通过',
  ITEM_RETURN: '验收退回',
  ITEM_REVERSE: '冲回实际记录',
  ITEM_VERIFY_TRANSFER: '验收责任交接',
  MILESTONE_SUBMIT: '提交里程碑实际',
  MILESTONE_VERIFY: '里程碑验证通过',
  MILESTONE_RETURN: '里程碑退回',
  MILESTONE_REOPEN: '里程碑重开',
  MILESTONE_VERIFY_TRANSFER: '里程碑核验交接',
}
export const executionLabel = (value: string) => executionLabels[value] ?? value
export const executionTitle = (o?: ExecutionObject) =>
  o?.content.stage?.title ??
  o?.content.item?.title ??
  o?.content.milestone?.title ??
  o?.content.workPackage?.title ??
  o?.content.plan?.title ??
  '历史对象'
export const actualToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
export const quantityText = (n: number | null | undefined) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(n)
