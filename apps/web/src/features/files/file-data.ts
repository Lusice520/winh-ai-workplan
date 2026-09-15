import { HttpError } from '@/api/client/http'

export const fileKinds = [
  'CONTRACT',
  'SURVEY',
  'REQUIREMENTS',
  'SOLUTION',
  'ESTIMATE',
  'QUOTATION',
  'BIDDING',
  'HANDOVER',
  'OTHER',
]
export const fileSize = (bytes: number) =>
  bytes < 1048576
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1048576).toFixed(1)} MB`

export async function downloadFile(
  documentId: string,
  versionId: string,
  filename: string,
) {
  const response = await fetch(
    `/api/files/${documentId}/versions/${versionId}/download`,
    { credentials: 'include' },
  )
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined)
    throw new HttpError(response.status, '文件未能下载，请重试。', body)
  }
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const fileKindName = (value: string) =>
  value === 'CONTRACT'
    ? '合同文件'
    : value === 'ESTIMATE'
      ? '成本估算'
      : undefined
