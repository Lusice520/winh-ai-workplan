import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppProviders } from '@/app/providers'
import { RoleCatalog } from '@/features/menu-permissions/role-catalog'
import type {
  AccessRole,
  PermissionItem,
} from '@/features/menu-permissions/access-control-types'

const role: AccessRole = {
  id: 'system-security-admin',
  code: 'SYSTEM_SECURITY_ADMIN',
  name: '系统安全管理员',
  roleType: 'SYSTEM',
  responsibilitySummary: '维护系统管理资源、角色和授权边界。',
  status: 'ENABLED',
  delegationLevel: 10,
  version: 1,
  activeAssignmentCount: 1,
  grants: [
    {
      id: 'menu-read-grant',
      permissionCode: 'IAM_MENU_RESOURCE_READ',
      permissionName: '查看菜单资源',
      actionKey: 'iam.access-control.read',
      dimension: 'MENU',
      riskLevel: 'NORMAL',
      dataScope: 'ALL_ORGANIZATION',
      scopeReferences: null,
      conditionSummary: null,
    },
  ],
}

const permissions: PermissionItem[] = [
  {
    id: 'menu-read',
    code: 'IAM_MENU_RESOURCE_READ',
    menuResourceId: 'access-control',
    menuResourceCode: 'ACCESS_CONTROL',
    name: '查看菜单资源',
    actionKey: 'iam.access-control.read',
    dimension: 'MENU',
    riskLevel: 'NORMAL',
    canDelegate: true,
    status: 'ENABLED',
    version: 1,
  },
  {
    id: 'organization-read',
    code: 'IAM_ORGANIZATION_READ',
    menuResourceId: null,
    menuResourceCode: null,
    name: '读取组织目录',
    actionKey: 'iam.organization.read',
    dimension: 'DATA_SCOPE',
    riskLevel: 'NORMAL',
    canDelegate: true,
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
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/access-control/capabilities')
      return Promise.resolve(response(canManage ? ['IAM_ROLE_MANAGE'] : []))
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
    if (url.startsWith('/api/access-control/roles/')) {
      return Promise.resolve(
        response({
          roleId: role.id,
          activeAssignmentCount: 1,
          historicalAssignmentCount: 2,
          permissionGrantCount: 0,
          relatedTemporaryGrantCount: 0,
        }),
      )
    }
    if (url.startsWith('/api/access-control/roles')) {
      return Promise.resolve(response([role]))
    }
    if (url === '/api/access-control/permission-items') {
      return Promise.resolve(response(permissions))
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`))
  })
  vi.stubGlobal('fetch', fetchMock)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RoleCatalog', () => {
  it('allows role inspection without enabling mutations for a read-only administrator', async () => {
    installApiMock(false)
    render(
      <MemoryRouter>
        <AppProviders>
          <RoleCatalog />
        </AppProviders>
      </MemoryRouter>,
    )
    await screen.findByText('查看菜单资源')
    expect(screen.getByText('新建角色').closest('button')).toBeDisabled()
    expect(screen.getByText('新增授权').closest('button')).toBeDisabled()
    expect(screen.getByLabelText('编辑角色与矩阵')).toBeDisabled()
    expect(screen.getByLabelText('移除授权 查看菜单资源')).toBeDisabled()
  })
  it('keeps menu visibility grants on the required all-organization scope', async () => {
    installApiMock()
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <AppProviders>
          <RoleCatalog />
        </AppProviders>
      </MemoryRouter>,
    )

    expect(
      (await screen.findAllByText('系统安全管理员')).length,
    ).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: '新建角色' }))
    await user.click(
      await screen.findByRole('button', { name: '添加权限条目' }),
    )
    await user.click(screen.getByLabelText('权限项'))
    await user.click(
      await screen.findByText('查看菜单资源 · IAM_MENU_RESOURCE_READ'),
    )

    expect(
      screen.getByText(
        '菜单可见权限固定使用“全组织”范围，确保导航与服务端判断保持一致。',
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('数据范围')).toBeDisabled()
    expect(screen.queryByLabelText('对象引用')).not.toBeInTheDocument()
  })

  it('opens a full-matrix draft for adding an authorization without changing the role immediately', async () => {
    installApiMock()
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <AppProviders>
          <RoleCatalog />
        </AppProviders>
      </MemoryRouter>,
    )

    await screen.findByText('查看菜单资源')

    await user.click(screen.getByRole('button', { name: '新增授权' }))

    expect(
      await screen.findByText(
        '已新增一条待配置授权。选择权限项后，系统会按最小权限规则校验数据范围；点击“保存角色”后才生效。',
      ),
    ).toBeInTheDocument()
    expect(screen.getAllByLabelText('权限项')).toHaveLength(2)
  })
})
