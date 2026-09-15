import type { Event } from '@/features/business/business-types'
import type { FileReference } from '@/features/files/file-types'
export type ContractMaster = {
  id: string
  version: number
  projectId: string
  projectCode: string
  projectName: string
  opportunityId: string
  customerId: string
  customerName: string
  number: string
  title: string
  partyA: string | null
  partyB: string | null
  amount: number | null
  signedOn: string
  effectiveOn: string
  scope: string | null
  status: string
  archiveStatus: string
  primaryContract: boolean
  everArchived: boolean
  salesOwnerName: string
  archivedByName: string | null
  archivedAt: string | null
  updatedAt: string
}
export type ContractNode = {
  id: string
  version: number
  recordId: string | null
  title: string
  kind: string
  dueDate: string
  amount: number | null
  conditions: string
  status: string
  completedOn: string | null
  evidence: string | null
  completedByName: string | null
}
export type ContractNodeFact = Omit<ContractNode, 'id' | 'completedByName'> & {
  completedBy: string | null
}
export type ContractNodeRevision = {
  id: string
  nodeId: string
  kind: string
  before: ContractNodeFact | null
  after: ContractNodeFact
  reason: string
  recordedByName: string | null
  createdAt: string
}
export type ContractAmendment = {
  id: string
  kind: string
  title: string
  description: string
  signedOn: string
  fileVersionId: string
  amountBefore: number | null
  amountAfter: number | null
  createdByName: string
  createdAt: string
}
export type ContractLinkedFile = {
  id: string
  kind: string
  active: boolean
  file: FileReference
}
export type ContractArchive = {
  id: string
  version: number
  status: string
  submissionNote: string
  submittedBy: string
  submitterName: string
  reviewerName: string | null
  createdAt: string
  reviewedAt: string | null
  reviewComment: string | null
}
export type ContractDetail = {
  contract: ContractMaster
  nodes: ContractNode[]
  nodeHistory: ContractNodeRevision[]
  records: ContractAmendment[]
  files: ContractLinkedFile[]
  archiveReviews: ContractArchive[]
  history: Event[]
  allowedActions: string[]
  sensitiveVisible: boolean
  filesVisible: boolean
  missingItems: string[]
}
