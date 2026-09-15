import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppProviders } from '@/app/providers'
import { MenuResourceWorkspace } from '@/features/menu-permissions/menu-resource-workspace'
import type { MenuResource } from '@/features/menu-permissions/access-control-types'

const resources: MenuResource[] = [
  {
    id: 'system-management',
    code: 'SYSTEM_MANAGEMENT',
    resourceType: 'DIRECTORY',
    parentId: null,
    name: '系统管理',
    routeKey: null,
    actionKey: null,
    iconKey: 'folder',
    sortOrder: 10,
    status: 'ENABLED',
    version: 1,
  },
  {
    id: 'access-control',
    code: 'ACCESS_CONTROL',
    resourceType: 'MENU_PAGE',
    parentId: 'system-management',
    name: '菜单与权限',
    routeKey: 'system.access-control',
    actionKey: null,
    iconKey: 'shield-check',
    sortOrder: 20,
    status: 'ENABLED',
    version: 1,
  },
  {
    id: 'access-control-manage',
    code: 'ACCESS_CONTROL_MANAGE',
    resourceType: 'OPERATION',
    parentId: 'access-control',
    name: '维护菜单资源',
    routeKey: null,
    actionKey: 'iam.access-control.manage',
    iconKey: 'workflow',
    sortOrder: 30,
    status: 'ENABLED',
    version: 1,
  },
]

function response(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function installApiMock(canManage = true) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === '/api/access-control/capabilities')
      return Promise.resolve(
        response(canManage ? ['IAM_MENU_RESOURCE_MANAGE'] : []),
      )
    if (url === '/api/auth/me') {
      return Promise.resolve(
        response({
          accountId: 'admin',
          loginName: 'test-admin',
          displayName: '验证管理员',
          mustChangePassword: false,
          bootstrapSystemAdministrator: true,
        }),
      )
    }
    if (url === '/api/auth/csrf') {
      return Promise.resolve(response({ token: 'test-csrf-token' }))
    }
    if (url === '/api/access-control/menu-resources') {
      return Promise.resolve(response(resources))
    }
    if (
      url === '/api/access-control/menu-resources/system-management' &&
      init?.method === 'PATCH'
    ) {
      return Promise.resolve(
        response({
          ...resources[0],
          ...JSON.parse(String(init.body)),
          version: 2,
        }),
      )
    }
    if (url.includes('/api/access-control/menu-resources/')) {
      return Promise.resolve(
        response({
          resourceId: 'system-management',
          directChildCount: 1,
          permissionItemCount: 1,
          roleGrantCount: 1,
          temporaryGrantCount: 0,
        }),
      )
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('MenuResourceWorkspace', () => {
  it('renames a root directory without inventing a move or requiring a move reason', async () => {
    const fetchMock = installApiMock()
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AppProviders>
          <MenuResourceWorkspace />
        </AppProviders>
      </MemoryRouter>,
    )
    await user.click(await screen.findByLabelText('编辑 系统管理'))
    await user.clear(screen.getByLabelText('资源名称'))
    await user.type(screen.getByLabelText('资源名称'), '系统资源目录')
    expect(screen.queryByLabelText('调整原因')).not.toBeInTheDocument()
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: /保\s*存/,
      }),
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    const writes = fetchMock.mock.calls.filter(
      ([, init]) => init?.method === 'PATCH' || init?.method === 'POST',
    )
    expect(writes).toHaveLength(1)
    expect(writes[0][0]).toBe(
      '/api/access-control/menu-resources/system-management',
    )
  })
  it('keeps resource inspection available while disabling writes for a read-only administrator', async () => {
    installApiMock(false)
    render(
      <MemoryRouter>
        <AppProviders>
          <MenuResourceWorkspace />
        </AppProviders>
      </MemoryRouter>,
    )
    expect(await screen.findByLabelText('编辑 系统管理')).toBeDisabled()
    expect(screen.getByLabelText('按当前层级新建资源')).toBeDisabled()
    expect(screen.getByLabelText('刷新资源目录')).toBeEnabled()
  })
  it('filters the catalog from the compact type control and changes the create form with a real select', async () => {
    installApiMock()
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/system/access-control/menus']}>
        <AppProviders>
          <MenuResourceWorkspace />
        </AppProviders>
      </MemoryRouter>,
    )

    const tableHeader = await screen.findByRole('columnheader', {
      name: '资源名称',
    })
    const table = tableHeader.closest('.ant-table-wrapper')
    if (!(table instanceof HTMLElement)) {
      throw new Error('菜单资源表格未渲染')
    }
    expect(
      within(table).queryByRole('columnheader', {
        name: '路由键（routeKey）',
      }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '筛选资源类型' }))
    await user.click(
      await screen.findByRole('combobox', { name: '筛选资源类型' }),
    )
    await user.click(
      await screen.findByText('操作资源', {
        selector: '.ant-select-item-option-content',
      }),
    )

    expect(within(table).getByText('维护菜单资源')).toBeInTheDocument()
    expect(within(table).queryByText('菜单与权限')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '新建资源' }))
    await user.click(screen.getByLabelText('资源类型'))
    const menuPageOptions = await screen.findAllByText('菜单页', {
      exact: true,
      selector: '.ant-select-item-option-content',
    })
    await user.click(menuPageOptions.at(-1)!)

    expect(screen.getByLabelText('受控 routeKey')).toBeInTheDocument()
    expect(screen.getByLabelText('图标键')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: '排序' })).toBeInTheDocument()
    expect(screen.queryByText('补充图标键')).not.toBeInTheDocument()
  })
})
