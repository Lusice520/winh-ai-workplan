import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { MenuResourceRegistryPrototype } from '@/features/component-lab/menu-resource-registry-prototype'

describe('MenuResourceRegistryPrototype', () => {
  it('selects a resource from the table and opens its editor in a drawer', async () => {
    const user = userEvent.setup()
    render(<MenuResourceRegistryPrototype />)

    await user.click(screen.getByTestId('resource-row-system.dashboard'))

    expect(screen.getByText('已选择 1 项资源：')).toBeInTheDocument()
    expect(screen.getAllByText('系统概览')).not.toHaveLength(0)

    await user.click(screen.getByRole('button', { name: '编辑 系统概览' }))

    expect(await screen.findByText('编辑菜单资源')).toBeInTheDocument()
    expect(screen.getByDisplayValue('系统概览')).toBeInTheDocument()
    expect(screen.getByDisplayValue('SYSTEM_DASHBOARD')).toBeInTheDocument()
    expect(screen.getByText('后续流程')).toBeInTheDocument()
  }, 10_000)

  it('filters the central resource table without changing the resource tree', async () => {
    const user = userEvent.setup()
    render(<MenuResourceRegistryPrototype />)

    await user.type(
      screen.getByPlaceholderText('搜索资源名称、编码或路由键'),
      '安全策略',
    )

    expect(
      screen.getByTestId('resource-row-security.policy.config'),
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('resource-row-system.dashboard'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('全部资源')).toBeInTheDocument()
  })

  it('creates a resource through the same drawer and returns it to the table', async () => {
    const user = userEvent.setup()
    render(<MenuResourceRegistryPrototype />)

    await user.click(screen.getByRole('button', { name: '新建资源' }))

    expect(await screen.findByText('新建菜单资源')).toBeInTheDocument()
    await user.type(screen.getByLabelText('资源名称'), '项目阶段看板')
    await user.type(
      screen.getByLabelText('稳定资源编码'),
      'PROJECT_PHASE_BOARD',
    )
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      '项目阶段看板 已保存（仅原型状态）。',
    )
    expect(screen.getAllByText('项目阶段看板')).not.toHaveLength(0)
  })
})
