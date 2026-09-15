import type {
  DeliveryContent,
  DeliveryHeader,
  DeliveryObject,
  DeliveryResource,
  DeliveryFinding,
  ResourceRequest,
  ResourceCommitment,
} from './delivery-types'

export type TransferMember = {
  accountId: string
  version: number
  roleCodes: string[]
  originalOwner: boolean
}
export type TransferRole = {
  accountId: string
  expectedVersion: number
  roleCodes: string[]
}
export type TransferMapping = {
  from: TransferMember
  to: TransferMember
  beforeHeader: DeliveryHeader
  afterHeader: DeliveryHeader
  objects: { before: DeliveryObject; after: DeliveryContent }[]
  resources: { before: DeliveryResource; after: ResourceRequest }[]
  findings: { before: DeliveryFinding; after: DeliveryFinding['finding'] }[]
  related: {
    domain: string
    objectId: string
    version: number
    title: string
    roles: string[]
  }[]
}
export type TransferPreview = { hash: string; mapping: TransferMapping }
export type TransferSignature = {
  resourceId: string
  status: string
  commitment: ResourceCommitment
  signedBy: string
  signedAt: string
  overlapHash: string
}
export type ResponsibilityTransfer = {
  id: string
  version: number
  status: string
  fromId: string
  fromName: string
  toId: string
  toName: string
  mapping: TransferMapping
  mappingHash: string
  permissions: TransferRole[]
  signatures: TransferSignature[]
  basis: string
  submittedBy: string
  submittedAt: string
  acceptedBy: string | null
  acceptedAt: string | null
  acceptanceNote: string | null
  decidedBy: string | null
  effectiveAt: string | null
  decisionNote: string | null
}
export type TransferOverlaps = {
  request: ResourceRequest
  peakHours: number
  allocations: {
    resourceId: string | null
    projectId: string | null
    projectName: string
    startsOn: string
    endsOn: string
    dailyHours: number
    proposed: boolean
  }[]
}
