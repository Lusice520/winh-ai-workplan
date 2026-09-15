export type Page<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
}
export type Event = {
  id: string
  action: string
  description: string
  actorId: string
  actorName: string
  createdAt: string
}
export type Person = { id: string; name: string; organizationUnitId: string }
export type Customer = {
  id: string
  version: number
  code: string
  name: string
  shortName: string | null
  kind: string
  identifier: string | null
  industry: string | null
  region: string | null
  source: string
  ownerAccountId: string
  ownerName: string
  status: string
  mergedIntoId: string | null
  updatedAt: string
}
export type Contact = {
  id: string
  version: number
  name: string
  position: string | null
  phone: string | null
  email: string | null
  status: string
  contactVisible: boolean
}
export type CustomerDetail = {
  customer: Customer
  contacts: Contact[]
  opportunities: Opportunity[]
  history: Event[]
  allowedActions: string[]
}
export type MergePreview = {
  target: Customer
  source: Customer
  contacts: number
  opportunities: number
  conflicts: string[]
}
export type Opportunity = {
  id: string
  version: number
  code: string
  customerId: string
  customerName: string
  title: string
  eventKey: string | null
  ownerAccountId: string
  ownerName: string
  source: string
  grade: string
  progress: string
  procurementMethod: string
  estimatedAmount: number | null
  targetDate: string | null
  background: string | null
  status: string
  result: string
  projectId: string | null
  health: string
  nextAction: string | null
  nextOwnerName: string | null
  nextDueDate: string | null
  updatedAt: string
}
export type Activity = {
  id: string
  fact: string
  nextAction: string | null
  assigneeId: string | null
  assigneeName: string | null
  dueDate: string | null
  recordedByName: string
  createdAt: string
}
export type OpportunityDetail = {
  opportunity: Opportunity
  activities: Activity[]
  history: Event[]
  allowedActions: string[]
}
export type Project = {
  id: string
  version: number
  code: string
  name: string
  opportunityId: string
  customerId: string
  customerName: string
  salesOwnerId: string
  salesOwnerName: string
  presalesOwnerId: string
  presalesOwnerName: string
  mainStage: string
  focus: string
  status: string
  result: string
  procurementMethod: string
  background: string | null
  updatedAt: string
}
export type Member = {
  id: string
  accountId: string
  name: string
  roleCodes: string[]
  active: boolean
  salesOwner: boolean
  presalesOwner: boolean
  version: number
}
export type ProjectDetail = {
  project: Project
  members: Member[]
  history: Event[]
  allowedActions: string[]
}
export type Initiation = {
  id: string
  version: number
  purpose: string
  scope: string
  expectedOutputs: string
  exitConditions: string
  requestedHours: number
  requestedCost: number
  approvedHours: number | null
  approvedCost: number | null
  startsOn: string
  endsOn: string
  status: string
  submittedBy: string | null
  submittedByName: string | null
  submittedAt: string | null
  reviewedByName: string | null
  reviewedAt: string | null
  reviewComment: string | null
}
export type Deliverable = {
  id: string
  title: string
  kind: string
  scope: string
  content: string
  versionNumber: number
  changeNote: string
  status: string
  createdByName: string
  createdAt: string
}
export type PresalesAction = {
  id: string
  version: number
  actionKey: string
  name: string
  status: string
  ownerAccountId: string | null
  ownerName: string | null
  dueDate: string | null
  note: string | null
  deliverables: Deliverable[]
}
export type Investment = {
  id: string
  kind: string
  hours: number
  cost: number
  occurredOn: string
  description: string
  commitmentId: string | null
  reversesId: string | null
  reversed: boolean
  createdByName: string
}
export type Quote = {
  id: string
  version: number
  feasibility: string
  scope: string
  estimate: string
  priceAuthorization: string
  constraints: string
  assumptionsRisks: string
  finalVersion: string
  deliverableIds: string[]
  status: string
  current: boolean
  submittedBy: string
  submittedByName: string
  reviewedByName: string | null
  reviewComment: string | null
  createdAt: string
  reviewedAt: string | null
}
export type PresalesWorkspace = {
  investmentDetailsVisible: boolean
  actions: PresalesAction[]
  initiations: Initiation[]
  investments: Investment[]
  quoteReviews: Quote[]
  committedHours: number
  committedCost: number
  actualHours: number
  actualCost: number
  allowedActions: string[]
}
export type Requirement = {
  id: string
  version: number
  code: string
  projectId: string
  projectName: string
  title: string
  originalText: string
  source: string
  requester: string
  createdBy: string
  ownerAccountId: string
  ownerName: string
  verifierAccountId: string
  verifierName: string
  priority: string
  status: string
  expectedOn: string | null
  importantCustomer: boolean
  disposition: string | null
  completionEvidence: string | null
  verificationComment: string | null
  customerEvidence: string | null
  completedByName: string | null
  verifiedByName: string | null
  verifiedAt: string | null
  updatedAt: string
}
export type Assessment = {
  id: string
  clarification: string
  category: string
  scopeImpact: string
  technicalImpact: string
  scheduleImpact: string
  costImpact: string
  contractImpact: string
  acceptanceImpact: string
  safetyImpact: string
  baselineImpact: boolean
  createdByName: string
  createdAt: string
}
export type WorkLink = {
  id: string
  workItemId: string | null
  kind: string
  title: string
  status: string
  active: boolean
  approved: boolean
}
export type RequirementDetail = {
  requirement: Requirement
  assessments: Assessment[]
  links: WorkLink[]
  history: Event[]
  allowedActions: string[]
}
export type WorkReference = {
  id: string
  projectId: string
  kind: string
  title: string
  status: string
  approved: boolean
}
export type WorkDetail = {
  id: string
  version: number
  projectId: string
  projectName: string
  sourceRequirementId: string | null
  creationSource: 'REQUIREMENT' | 'DELIVERY' | 'DELIVERY_TASK'
  taskWorkPackageId?: string | null
  deliveryState: string
  deliveryBaselineVersion: number
  kind: string
  title: string
  description: string
  ownerAccountId: string
  ownerName: string
  verifierAccountId: string
  verifierName: string
  status: string
  dueDate: string | null
  evidence: string | null
  approvedByName: string | null
  approvedAt: string | null
  verifiedByName: string | null
  verifiedAt: string | null
  history: Event[]
  allowedActions: string[]
}
