import type { ExecutionObject } from '@/features/execution/execution-types'
import type { FileReference } from '@/features/files/file-types'

export type TaskRow = {
  id: string
  version: number
  workVersion: number
  title: string
  acceptanceCriteria: string
  status: string
  needsReview: boolean
  sourceRequirementId: string | null
  ownerId: string
  ownerName: string
  verifierId: string
  verifierName: string
  startsOn: string
  dueDate: string
  estimatedDays: number | null
  progress: number
  actualStartedOn: string | null
  actualCompletedOn: string | null
  itemCount: number
  allowedActions: string[]
}
export type TaskFiles = { files: FileReference[]; restricted: number }
export type TaskSnapshot = { json: string; files: TaskFiles }
export type TaskEvent = {
  id: string
  taskId: string
  action: string
  note: string
  actorId: string
  actorName: string
  at: string
  before: TaskSnapshot
  after: TaskSnapshot
}
export type TaskSource = {
  id: string
  version: number
  title: string
  sourceRequirementId: string | null
  ownerId: string
  verifierId: string
}
export type TaskWorkspace = {
  projectId: string
  projectName: string
  workPackage: ExecutionObject
  packageStatus: string
  stage: { status: string; startedOn: string | null }
  items: ExecutionObject[]
  tasks: TaskRow[]
  availableTasks: TaskSource[]
  recentEvents: TaskEvent[]
  allowedActions: string[]
}
export type TaskDetail = Omit<
  TaskWorkspace,
  'tasks' | 'availableTasks' | 'allowedActions' | 'recentEvents'
> & {
  task: TaskRow
  description: string
  acceptanceCriteria: string
  itemIds: string[]
  evidence: string | null
  submittedBy: string | null
  submitterName: string | null
  verifiedBy: string | null
  verifierName: string | null
  verifiedAt: string | null
  baselineVersion: number
  files: TaskFiles
  history: TaskEvent[]
}
export const taskLabels: Record<string, string> = {
  OPEN: '未完成',
  IN_PROGRESS: '进行中',
  NOT_STARTED: '未开始',
  DONE: '已验证',
  PENDING_VERIFICATION: '待验证',
  CANCELLED: '已取消',
  CREATE: '新建任务',
  ADOPT: '接纳原任务',
  EDIT: '修订任务计划',
  PROGRESS: '登记进展',
  COMPLETE: '提交完成',
  VERIFY: '独立核验通过',
  RETURN: '退回补齐',
  CANCEL: '取消任务',
  REOPEN: '明确重开',
  RESPONSIBILITY_TRANSFER: '责任交接',
}
export const taskLabel = (value: string) => taskLabels[value] ?? value
export const taskState = (row: TaskRow) =>
  row.status === 'OPEN'
    ? row.actualStartedOn
      ? 'IN_PROGRESS'
      : 'NOT_STARTED'
    : row.status
export const taskPath = (projectId: string, workPackageId: string) =>
  `/projects/${projectId}/work-packages/${workPackageId}/tasks`

export function taskStats(rows: TaskRow[]) {
  const active = rows.filter((r) => r.status !== 'CANCELLED'),
    done = active.filter((r) => r.status === 'DONE' && !r.needsReview).length
  return {
    total: active.length,
    done,
    pending: active.filter((r) => r.status === 'PENDING_VERIFICATION').length,
    review: active.filter((r) => r.needsReview).length,
    cancelled: rows.length - active.length,
    percent: active.length ? Math.round((done / active.length) * 100) : 0,
  }
}
export function matchesTask(row: TaskRow, params: URLSearchParams) {
  const keyword = params.get('q')?.trim().toLocaleLowerCase() ?? '',
    state = params.get('state'),
    from = params.get('from'),
    to = params.get('to')
  return (
    (!keyword ||
      `${row.title} ${row.ownerName} ${row.verifierName}`
        .toLocaleLowerCase()
        .includes(keyword)) &&
    (!state ||
      (state === 'NEEDS_REVIEW'
        ? row.needsReview
        : taskState(row) === state)) &&
    (!from || row.startsOn >= from) &&
    (!to || row.dueDate <= to)
  )
}
