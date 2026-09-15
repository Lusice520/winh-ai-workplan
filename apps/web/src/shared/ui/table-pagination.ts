import type { TablePaginationConfig } from 'antd'

import { getStablePopupContainer } from '@/shared/ui/popup-container'

export const defaultTablePageSize = 10
export const defaultTableBodyScrollHeight = 'min(600px, calc(100dvh - 300px))'

export function tableScroll(x: number) {
  return {
    x,
    y: defaultTableBodyScrollHeight,
    scrollToFirstRowOnChange: true,
  }
}

export function tablePagination(
  overrides: TablePaginationConfig = {},
): TablePaginationConfig {
  return {
    size: 'small',
    // `pageSize` makes Ant Design's Table controlled. Directory tables that do
    // not own pagination state would then immediately reset a user's 10/50-row
    // choice back to 10 on re-render, so use the uncontrolled default instead.
    defaultPageSize: defaultTablePageSize,
    pageSizeOptions: [10, 20, 50],
    showSizeChanger: {
      showSearch: false,
      'aria-label': '每页展示条数',
      getPopupContainer: getStablePopupContainer,
      placement: 'topRight',
    },
    showTotal: (total) => `共 ${total} 条`,
    ...overrides,
  }
}
