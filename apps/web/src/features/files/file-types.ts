import type { Event } from '@/features/business/business-types'
export type FileVersion = {
  id: string
  version: number
  versionNumber: number
  filename: string
  sizeBytes: number
  sha256: string
  status: string
  changeNote: string
  uploadedBy: string
  uploaderName: string
  reviewerName: string | null
  createdAt: string
  reviewedAt: string | null
  reviewComment: string | null
}
export type ProjectDocument = {
  id: string
  version: number
  projectId: string
  title: string
  kind: string
  mainStage: string
  classification: string
  currentVersionId: string | null
  latestVersion: FileVersion
  updatedAt: string
}
export type FileDetail = {
  document: ProjectDocument
  versions: FileVersion[]
  history: Event[]
  allowedActions: string[]
}
export type FileWorkspace = {
  items: ProjectDocument[]
  storageConfigured: boolean
  maxBytes: number
  allowedActions: string[]
}
export type FileReference = {
  documentId: string
  versionId: string
  projectId: string
  title: string
  filename: string
  versionNumber: number
  classification: string
  status: string
  current: boolean
  stateVersion: number
  sha256: string
}
