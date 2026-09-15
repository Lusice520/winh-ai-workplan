import type { FileReference } from '@/features/files/file-types'
export type Money = string
export type IncomeSource = {
  contractId: string
  contractVersion: number
  contractNumber: string
  contractTitle: string
  nodeId: string | null
  nodeVersion: number | null
  nodeTitle: string | null
}
export type SourceView = { value: IncomeSource | null; restricted: boolean }
export type IncomeFiles = { files: FileReference[]; restricted: number }
export type IncomeReference = {
  id: string
  version: number
  title: string
  amount: Money
  status: string
}
export type ForecastReference = {
  revisionId: string
  revisionNumber: number
  lineId: string
  title: string
  plannedOn: string
  amount: Money
}
export type ForecastLine = {
  id: string
  title: string
  plannedOn: string
  amount: Money
  sourceType: string
  source: SourceView
  sourceNote: string
  incomeReference: IncomeReference | null
  files: IncomeFiles
}
export type ForecastRevision = {
  id: string
  version: number
  number: number
  status: string
  reason: string
  editedByName: string
  publishedByName: string | null
  publishedAt: string | null
  updatedAt: string
  total: Money
  lines: ForecastLine[]
}
export type ForecastBook = {
  id: string
  version: number
  period: string
  currency: string
  currentRevisionId: string | null
  draftRevisionId: string | null
  revisions: ForecastRevision[]
}
export type IncomeRow = {
  id: string
  version: number
  kind: string
  status: string
  title: string
  amount: Money
  currency: string
  occurredOn: string
  sourceNote: string
  source: SourceView
  forecast: ForecastReference | null
  unplannedReason: string | null
  originalIncomeId: string | null
  reversed: boolean
  createdBy: string
  creatorName: string
  ownerId: string
  ownerName: string
  confirmerId: string
  confirmerName: string
  submittedBy: string | null
  submitterName: string | null
  submittedAt: string | null
  confirmedBy: string | null
  confirmedByName: string | null
  confirmedAt: string | null
  files: IncomeFiles
  allowedActions: string[]
}
export type IncomeSnapshot = Partial<IncomeRow> & {
  revisions?: {
    id: string
    number: number
    status: string
    reason: string
    lines: ForecastLine[]
  }[]
  period?: string
  currency?: string
}
export type IncomeEvent = {
  id: string
  action: string
  reason: string
  actorId: string
  actorName: string
  at: string
  before: IncomeSnapshot | null
  after: IncomeSnapshot | null
}
export type IncomeDetail = { income: IncomeRow; history: IncomeEvent[] }
export type IncomeWorkspace = {
  projectId: string
  projectName: string
  period: string
  currency: string
  book: ForecastBook | null
  totals: {
    planned: Money
    confirmedNet: Money
    pendingIncome: Money
    pendingReversal: Money
    count: number
  }
  incomes: IncomeRow[]
  confirmers: { id: string; name: string }[]
  contracts: {
    id: string
    version: number
    number: string
    title: string
    status: string
    archiveStatus: string
  }[]
  contractNodes: {
    id: string
    contractId: string
    version: number
    title: string
    dueDate: string
  }[]
  allowedActions: string[]
}
export const incomeLabels: Record<string, string> = {
  DRAFT: '草案',
  SUBMITTED: '待营销确认',
  RETURNED: '已退回',
  CONFIRMED: '已确认',
  CANCELLED: '已取消',
  INCOME: '正向收入',
  REVERSAL: '整笔冲销',
  PUBLISHED: '已发布',
  DISCARDED: '已放弃',
  EDIT: '修改草案',
  SUBMIT: '提交确认',
  RETURN: '退回补充',
  CONFIRM: '确认收入',
  WITHDRAW: '撤回提交',
  CANCEL: '取消草案',
  REVERSE: '申请整笔冲销',
  CORRECT: '新增更正收入',
  CREATE: '建立草案',
  PUBLISH: '发布预测',
  DISCARD: '放弃草案',
  DRAFT_SAVE: '保存预测草案',
  RESPONSIBILITY_TRANSFER: '收入责任交接',
}
export const incomeLabel = (value: string) => incomeLabels[value] ?? value
export function money(value: Money | number | undefined | null) {
  if (value == null) return '—'
  const [integer, decimal = ''] = String(value).split('.')
  return (
    integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + decimal.padEnd(2, '0')
  )
}
export function cents(value: Money) {
  const [integer, fraction = ''] = value.split('.')
  return (
    BigInt(integer) * 100n +
    BigInt(fraction.padEnd(2, '0')) * (integer.startsWith('-') ? -1n : 1n)
  )
}
export function totalLines(lines: { amount: Money }[]) {
  const value = lines.reduce((v, l) => v + cents(l.amount || '0'), 0n),
    abs = value < 0n ? -value : value
  return (
    (value < 0n ? '-' : '') +
    abs / 100n +
    '.' +
    String(abs % 100n).padStart(2, '0')
  )
}
export function compareLines(
  current: ForecastLine[],
  previous: ForecastLine[],
) {
  const changes: { id: string; title: string; change: string }[] = []
  for (const line of current) {
    const old = previous.find((l) => l.id === line.id)
    if (!old) {
      changes.push({
        id: line.id,
        title: line.title,
        change: '新增节点 · ' + money(line.amount),
      })
      continue
    }
    const parts: string[] = []
    if (cents(old.amount) !== cents(line.amount))
      parts.push('金额 ' + money(old.amount) + ' → ' + money(line.amount))
    if (old.plannedOn !== line.plannedOn)
      parts.push('日期 ' + old.plannedOn + ' → ' + line.plannedOn)
    if (old.title !== line.title) parts.push('名称调整')
    if (
      JSON.stringify([
        old.sourceType,
        old.source,
        old.sourceNote,
        old.incomeReference,
        old.files,
      ]) !==
      JSON.stringify([
        line.sourceType,
        line.source,
        line.sourceNote,
        line.incomeReference,
        line.files,
      ])
    )
      parts.push('来源或依据更新')
    if (parts.length)
      changes.push({ id: line.id, title: line.title, change: parts.join('；') })
  }
  for (const old of previous)
    if (!current.some((l) => l.id === old.id))
      changes.push({
        id: old.id,
        title: old.title,
        change: '本版移除节点；原收入引用保留',
      })
  return changes
}
export function matchesIncome(row: IncomeRow, params: URLSearchParams) {
  const q = (params.get('q') ?? '').trim().toLocaleLowerCase()
  return (
    (!q ||
      [
        row.title,
        row.sourceNote,
        row.source.value?.contractNumber,
        row.source.value?.nodeTitle,
      ].some((v) => v?.toLocaleLowerCase().includes(q))) &&
    (!params.get('status') || row.status === params.get('status')) &&
    (!params.get('kind') || row.kind === params.get('kind')) &&
    (!params.get('from') || row.occurredOn >= params.get('from')!) &&
    (!params.get('to') || row.occurredOn <= params.get('to')!)
  )
}
