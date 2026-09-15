import { describe, expect, it } from 'vitest'

import {
  defaultTableBodyScrollHeight,
  defaultTablePageSize,
  tablePagination,
  tableScroll,
} from '@/shared/ui/table-pagination'

describe('tablePagination', () => {
  it('keeps every Web directory on the shared 10-row pagination contract', () => {
    const pagination = tablePagination()

    expect(defaultTablePageSize).toBe(10)
    expect(pagination.defaultPageSize).toBe(10)
    expect(pagination.pageSize).toBeUndefined()
    expect(pagination.pageSizeOptions).toEqual([10, 20, 50])
    expect(pagination.showTotal?.(56, [1, 10])).toBe('共 56 条')
    expect(pagination.showSizeChanger).toMatchObject({
      placement: 'topRight',
      showSearch: false,
    })
  })

  it('keeps expanded pages inside the table viewport', () => {
    expect(defaultTableBodyScrollHeight).toBe(
      'min(600px, calc(100dvh - 300px))',
    )
    expect(tableScroll(900)).toEqual({
      x: 900,
      y: defaultTableBodyScrollHeight,
      scrollToFirstRowOnChange: true,
    })
  })
})
