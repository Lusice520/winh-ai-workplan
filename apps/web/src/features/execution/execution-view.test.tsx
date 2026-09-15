import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ItemExecutionTable } from './execution-tables'
import { ExecutionHistoryList } from './execution-ui'
import { matchesItemFilters, withinDates } from './execution-filter-model'
import type {
  ExecutionEvent,
  ExecutionObject,
  ItemExecution,
} from './execution-types'

describe('project execution evidence', () => {
  it('uses verified acceptance for completion and keeps pending or stale quantities separate', () => {
    const object: ExecutionObject = {
      id: 'item',
      version: 0,
      kind: 'ITEM',
      archived: false,
      baselineVersion: 1,
      content: {
        stage: null,
        milestone: null,
        workPackage: null,
        plan: null,
        budget: null,
        item: {
          title: '控制柜',
          category: 'EQUIPMENT',
          specification: 'A1',
          quantity: 6,
          unit: '台',
          acceptanceScope: '逐台核验',
          stageId: 'stage',
          workPackageId: 'work',
          milestoneId: 'milestone',
          procurementNeeded: true,
          procurementNote: '',
        },
      },
    }
    const item: ItemExecution = {
      id: 'item',
      profile: {
        version: 3,
        requiresReceipt: true,
        requiresInstallation: true,
        brand: null,
        model: null,
        supplier: null,
      },
      totals: {
        received: 6,
        installed: 4,
        accepted: 2,
        pending: 1,
        needsReview: 1,
      },
      allowedActions: [],
    }
    const open = vi.fn()
    expect(matchesItemFilters(object, item, { state: 'PENDING' })).toBe(true)
    expect(matchesItemFilters(object, item, { state: 'VERIFIED' })).toBe(false)
    expect(matchesItemFilters(object, item, { stage: 'another-stage' })).toBe(
      false,
    )
    render(
      <ItemExecutionTable objects={[object]} items={[item]} onOpen={open} />,
    )
    expect(screen.getByText('33%')).toBeVisible()
    expect(screen.queryByText('67%')).not.toBeInTheDocument()
    expect(screen.getByText('重核 1')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '查看记录' }))
    expect(open).toHaveBeenCalledWith('item')
  })
  it('includes both date boundaries and excludes records outside the selected range', () => {
    expect(withinDates('2026-09-13', '2026-09-13', '2026-09-13')).toBe(true)
    expect(withinDates('2026-09-12', '2026-09-13', '2026-09-14')).toBe(false)
    expect(withinDates('2026-09-15', '2026-09-13', '2026-09-14')).toBe(false)
  })
  it('shows the retained before and after facts without inventing inaccessible file labels', () => {
    const event: ExecutionEvent = {
      id: 'event',
      objectId: 'milestone',
      kind: 'MILESTONE',
      action: 'MILESTONE_SUBMIT',
      note: '补充现场依据',
      actorId: 'owner',
      actorName: '验证·负责人',
      occurredOn: '2026-09-13',
      beforeJson: JSON.stringify({ status: 'OPEN', evidence: '第一轮依据' }),
      afterJson: JSON.stringify({ status: 'PENDING', evidence: '第二轮依据' }),
      beforeFiles: { files: [], restricted: 1 },
      afterFiles: { files: [], restricted: 0 },
      objectVersion: 2,
      baselineVersion: 4,
      at: '2026-09-13T00:00:00Z',
    }
    render(<ExecutionHistoryList events={[event]} />)
    fireEvent.click(screen.getByRole('button', { name: /expand row/i }))
    expect(screen.getByText('第一轮依据')).toBeVisible()
    expect(screen.getByText('第二轮依据')).toBeVisible()
    expect(screen.getByText('1 项附件的查看权限受限')).toBeVisible()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
