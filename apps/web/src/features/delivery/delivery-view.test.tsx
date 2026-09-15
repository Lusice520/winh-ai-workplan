import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BudgetComposition } from './delivery-components'
import {
  budgetCents,
  cents,
  formatCents,
  type DeliveryBudget,
} from './delivery-types'

const budget: DeliveryBudget = {
  mode: 'FULL',
  scope: '实施范围',
  authorizedStageIds: [],
  authorizedCap: null,
  expiresOn: null,
  nextCompletionOn: null,
  remainingScope: null,
  lines: [
    {
      title: '采购费用',
      category: 'PROCUREMENT',
      amount: '999999999999.99',
      stageId: null,
      workPackageId: null,
      resourceRequestId: null,
      itemId: null,
      basis: '测算依据',
    },
  ],
}
describe('delivery budget readout', () => {
  it('adds cents exactly even when many valid rows exceed Number integer precision', () => {
    const large = {
      ...budget,
      lines: Array.from({ length: 100 }, () => ({ ...budget.lines[0] })),
    }
    expect(budgetCents(large)).toBe(9999999999999900n)
    expect(formatCents(budgetCents(large))).toBe('¥99,999,999,999,999.00')
    expect(cents('0.10') + cents('0.20')).toBe(30n)
  })
  it('does not render amounts, categories or chart data without budget access', () => {
    render(<BudgetComposition budget={budget} readable={false} />)
    expect(screen.getByText('预算明细受限')).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText(/999/)).not.toBeInTheDocument()
  })
  it('keeps a zero budget readable without invalid percentages', () => {
    render(<BudgetComposition budget={{ ...budget, lines: [] }} />)
    expect(screen.getByRole('table')).not.toHaveTextContent('NaN')
    expect(screen.getAllByText('0.0%')).toHaveLength(5)
  })
})
