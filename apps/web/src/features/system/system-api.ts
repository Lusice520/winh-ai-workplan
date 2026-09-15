import { getJson } from '@/api/client/http'

export type SystemStatus = {
  status: 'UP' | 'DOWN'
  service: string
  version: string
  timestamp?: string
}

export function getSystemStatus(signal?: AbortSignal) {
  return getJson<SystemStatus>('/api/system/status', { signal })
}
