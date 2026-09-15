import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router'
import { useIncomeSearchParams } from './income-search-params'
import { IncomeHistory, IncomeStatus, IncomeSource } from './income-ui'
import {
  money,
  totalLines,
  compareLines,
  matchesIncome,
  type ForecastLine,
  type IncomeRow,
  type IncomeEvent,
} from './income-types'
const line = (id: string, amount: string): ForecastLine => ({
  id,
  title: '验证·计划节点',
  plannedOn: '2026-09-13',
  amount,
  sourceType: 'PROJECT',
  source: { value: null, restricted: false },
  sourceNote: '验证·项目来源',
  incomeReference: null,
  files: { files: [], restricted: 0 },
})
describe('income financial facts and projections', () => {
  it('keeps decimal cents exact even when a forecast total exceeds JavaScript integer precision', () => {
    expect(money('999999999999.99')).toBe('999,999,999,999.99')
    expect(
      totalLines(
        Array.from({ length: 100 }, () => ({ amount: '999999999999.99' })),
      ),
    ).toBe('99999999999999.00')
    expect(totalLines([{ amount: '-0.01' }, { amount: '0.02' }])).toBe('0.01')
  })
  it('compares stable nodes including removed sources without relabelling unchanged amounts', () => {
    const old = line('same', '100.00'),
      next = { ...old, amount: '120.00', plannedOn: '2026-09-14' }
    expect(
      compareLines(
        [next, line('added', '15.00')],
        [old, line('removed', '5.00')],
      ).map((c) => c.change),
    ).toEqual([
      '金额 100.00 → 120.00；日期 2026-09-13 → 2026-09-14',
      '新增节点 · 15.00',
      '本版移除节点；原收入引用保留',
    ])
    expect(compareLines([line('same', '100.0')], [old])).toEqual([])
  })
  it('shows pending and reversed states separately and never exposes a hidden source link', () => {
    render(
      <MemoryRouter>
        <IncomeStatus status="SUBMITTED" />
        <IncomeStatus status="CONFIRMED" reversed />
        <IncomeSource source={{ value: null, restricted: true }} />
      </MemoryRouter>,
    )
    expect(screen.getByText('待营销确认')).toBeVisible()
    expect(screen.getByText('已确认 · 已冲销')).toBeVisible()
    expect(screen.getByText('合同依据查看受限')).toBeVisible()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
  it('uses inclusive actual-date boundaries and source/state filters', () => {
    const row = {
      title: '验证·设备收入',
      sourceNote: '接口原依据',
      source: { value: null, restricted: false },
      status: 'SUBMITTED',
      kind: 'INCOME',
      occurredOn: '2026-09-13',
    } as IncomeRow
    expect(
      matchesIncome(
        row,
        new URLSearchParams(
          'q=接口&status=SUBMITTED&from=2026-09-13&to=2026-09-13',
        ),
      ),
    ).toBe(true)
    expect(matchesIncome(row, new URLSearchParams('kind=REVERSAL'))).toBe(false)
    expect(matchesIncome(row, new URLSearchParams('to=2026-09-12'))).toBe(false)
  })
  it('keeps the old submission reason, designated reviewer and restricted evidence in each historical round', () => {
    const event: IncomeEvent = {
      id: 'e',
      action: 'RETURN',
      reason: '验证·补齐依据',
      actorId: 'reviewer',
      actorName: '验证·独立确认人',
      at: '2026-09-13T01:00:00Z',
      before: {
        title: '验证·第一轮收入',
        status: 'SUBMITTED',
        amount: '100.00',
        currency: 'CNY',
        occurredOn: '2026-09-12',
        sourceNote: '验证·原收入依据',
        submitterName: '验证·原提交人',
        confirmerName: '验证·独立确认人',
        source: { value: null, restricted: true },
        files: { files: [], restricted: 1 },
      },
      after: { status: 'RETURNED', sourceNote: '验证·原收入依据' },
    }
    render(
      <MemoryRouter>
        <IncomeHistory events={[event]} />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /expand row/i }))
    expect(screen.getAllByText('验证·原收入依据')).toHaveLength(2)
    expect(screen.getByText('1 项附件的查看权限受限')).toBeVisible()
    expect(screen.getByText(/验证·原提交人/)).toBeVisible()
  })
})

function RapidFilters() {
  const [params, update] = useIncomeSearchParams()
  return (
    <>
      <output aria-label="当前筛选">{params.toString()}</output>
      <button
        onClick={() => {
          for (const [key, value] of [
            ['q', '接口'],
            ['from', '2026-09-11'],
            ['to', '2026-09-11'],
          ]) {
            update((previous) => {
              const next = new URLSearchParams(previous)
              next.set(key!, value!)
              return next
            })
          }
        }}
      >
        连续筛选
      </button>
    </>
  )
}
it('retains keyword and both date bounds when filters change before navigation renders', () => {
  render(
    <MemoryRouter initialEntries={['/?period=2026-09&currency=CNY']}>
      <RapidFilters />
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: '连续筛选' }))
  const result = new URLSearchParams(
    screen.getByLabelText('当前筛选').textContent!,
  )
  expect(Object.fromEntries(result)).toEqual({
    period: '2026-09',
    currency: 'CNY',
    q: '接口',
    from: '2026-09-11',
    to: '2026-09-11',
  })
})
