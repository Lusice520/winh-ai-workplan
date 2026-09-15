import type { Event } from '@/features/business/business-types'

export type ConfigurationKind = 'STAGE_TEMPLATE' | 'REVIEW_POLICY'
export type StageDefinition = {
  code: string
  name: string
  applicability: 'REQUIRED' | 'OPTIONAL' | 'CONDITIONAL'
  condition: string | null
  ownerRoleHint: string | null
  predecessorCodes: string[]
  parallelCodes: string[]
  milestones: string[]
  actions: string[]
  deliverables: string[]
  completionCriteria: string | null
}
export type StageTemplate = {
  projectTypes: string[]
  stages: StageDefinition[]
}
export type ReviewPolicy = {
  projectTypes: string[]
  minimumBudget: number
  maximumBudget: number | null
  riskLevels: string[]
  reviewers: { accountId: string; scope: string }[]
  finalApproverId: string | null
  authorityBasis: string | null
}
export type ConfigurationRow = {
  id: string
  version: number
  seriesId: string
  edition: number
  kind: ConfigurationKind
  name: string
  status: 'DRAFT' | 'PUBLISHED' | 'RETIRED'
  projectTypes: string[]
  stageCount: number
  reviewerCount: number
  createdByName: string
  publishedByName: string | null
  publishedAt: string | null
  updatedAt: string
}
export type ConfigurationDetail = {
  configuration: ConfigurationRow
  versionNote: string
  template: StageTemplate | null
  policy: ReviewPolicy | null
  snapshotHash: string | null
  people: { id: string; name: string }[]
  problems: { field: string; message: string }[]
  editions: ConfigurationRow[]
  retirementReason: string | null
  retiredAt: string | null
  history: Event[]
  allowedActions: string[]
}

export const configurationLabels: Record<string, string> = {
  STAGE_TEMPLATE: '阶段模板',
  REVIEW_POLICY: 'DG-02 评审规则',
  SYSTEM_INTEGRATION: '系统集成',
  TECHNICAL_SERVICE: '技术服务',
  EQUIPMENT: '设备项目',
  REQUIRED: '必选',
  OPTIONAL: '可选',
  CONDITIONAL: '条件适用',
  TECHNICAL: '技术会签',
  COMMERCIAL: '商务会签',
  FINANCIAL: '经营会签',
  SAFETY: '安全会签',
  QUALITY: '质量会签',
  LOW: '低风险',
  MEDIUM: '中风险',
  HIGH: '高风险',
  RETIRED: '已退役',
}
export const configurationLabel = (key: string) =>
  configurationLabels[key] ?? key
export const configurationOptions = (keys: string[]) =>
  keys.map((value) => ({ value, label: configurationLabel(value) }))
export const projectTypeOptions = configurationOptions([
  'SYSTEM_INTEGRATION',
  'TECHNICAL_SERVICE',
  'EQUIPMENT',
])
