import type { ExecutionObject, ItemExecution } from './execution-types'
export type ExecutionFilters = Record<string, string>

export function matchesItemFilters(
  object: ExecutionObject,
  item: ItemExecution,
  filters: ExecutionFilters,
) {
  const source = object.content.item!
  if (
    (filters.category && filters.category !== source.category) ||
    (filters.stage && filters.stage !== source.stageId) ||
    (filters.work && filters.work !== source.workPackageId)
  )
    return false
  const totals = item.totals,
    profile = item.profile
  switch (filters.state) {
    case 'PROFILE':
      return !profile
    case 'RECEIPT':
      return (
        !!profile?.requiresReceipt &&
        source.quantity != null &&
        totals.received < source.quantity
      )
    case 'INSTALL':
      return (
        !!profile?.requiresInstallation &&
        source.quantity != null &&
        totals.installed < source.quantity
      )
    case 'PENDING':
      return totals.pending > 0
    case 'NEEDS_REVIEW':
      return totals.needsReview > 0
    case 'VERIFIED':
      return source.quantity != null && totals.accepted >= source.quantity
    default:
      return true
  }
}
export const withinDates = (date: string | null, from?: string, to?: string) =>
  date ? (!from || date >= from) && (!to || date <= to) : !from && !to
