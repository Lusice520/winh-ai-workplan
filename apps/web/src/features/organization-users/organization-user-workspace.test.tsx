import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppProviders } from '@/app/providers'
import { OrganizationUserWorkspace } from '@/features/organization-users/organization-user-workspace'

const organizationTree = [
  {
    id: 'root',
    parentId: null,
    name: '验证组织',
    code: 'TEST-ROOT',
    unitType: 'COMPANY',
    status: 'ENABLED',
    managerAccountId: null,
    sortOrder: 0,
    version: 0,
    directUserCount: 1,
    children: [
      {
        id: 'department',
        parentId: 'root',
        name: '华东业务部',
        code: 'EAST-BIZ',
        unitType: 'DEPARTMENT',
        status: 'ENABLED',
        managerAccountId: null,
        sortOrder: 10,
        version: 0,
        directUserCount: 1,
        children: [],
      },
    ],
  },
]

const userPage = {
  items: [
    {
      id: 'admin',
      loginName: 'test-admin',
      displayName: '验证管理员',
      employeeCode: 'HN0001',
      workEmail: 'admin@example.test',
      mobilePhone: null,
      organizationUnit: { id: 'root', name: '验证组织', code: 'TEST-ROOT' },
      accountStatus: 'ENABLED',
      lastSuccessfulLoginAt: null,
      mustChangePassword: false,
      bootstrapSystemAdministrator: true,
      version: 0,
    },
  ],
  page: 1,
  pageSize: 10,
  total: 1,
}

function response(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function installApiMock(canManage = true) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === '/api/access-control/capabilities') {
      return Promise.resolve(
        response(
          canManage
            ? ['IAM_ORGANIZATION_MANAGE', 'IAM_USER_MANAGE']
            : ['IAM_ORGANIZATION_READ', 'IAM_USER_READ'],
        ),
      )
    }
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
    if (url === '/api/iam/organization-units/tree') {
      return Promise.resolve(response(organizationTree))
    }
    if (url.startsWith('/api/iam/users?')) {
      return Promise.resolve(response(userPage))
    }
    if (url === '/api/iam/users' && init?.method === 'POST') {
      return Promise.resolve(
        response({
          ...userPage.items[0],
          id: 'new-user',
          loginName: 'acceptance.user',
          displayName: '验收用户',
          employeeCode: 'UAT-001',
          workEmail: 'acceptance.user@example.test',
          mobilePhone: '13900001234',
          mustChangePassword: true,
          bootstrapSystemAdministrator: false,
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

describe('OrganizationUserWorkspace', () => {
  it('lets a read-only user browse while hiding organization and account mutations', async () => {
    installApiMock(false)
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AppProviders>
          <OrganizationUserWorkspace />
        </AppProviders>
      </MemoryRouter>,
    )
    await screen.findByText('验证管理员')
    expect(
      screen.queryByRole('button', { name: '新建用户' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '新建部门' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '编辑当前组织' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '验证管理员 的操作' }))
    expect(screen.getByText('查看详情')).toBeInTheDocument()
    expect(screen.queryByText('编辑资料')).not.toBeInTheDocument()
    expect(screen.queryByText('重置临时密码')).not.toBeInTheDocument()
  })
  it('renders real directory fields without a pretend role selector', async () => {
    installApiMock()
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <AppProviders>
          <OrganizationUserWorkspace />
        </AppProviders>
      </MemoryRouter>,
    )

    expect(await screen.findByText('验证管理员')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '新建用户' }))

    expect(screen.getByLabelText('姓名')).toBeInTheDocument()
    expect(screen.getByLabelText('登录账号')).toBeInTheDocument()
    expect(screen.getByLabelText('临时密码')).toBeInTheDocument()
    expect(screen.queryByText('系统角色')).not.toBeInTheDocument()
  })

  it('exposes a real page-size selector for the user directory', async () => {
    installApiMock()

    render(
      <MemoryRouter>
        <AppProviders>
          <OrganizationUserWorkspace />
        </AppProviders>
      </MemoryRouter>,
    )

    await screen.findByText('验证管理员')

    expect(screen.getByLabelText('每页展示条数')).toBeInTheDocument()
  })

  it('submits a valid new user through the user-directory API seam', async () => {
    const fetchMock = installApiMock()
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <AppProviders>
          <OrganizationUserWorkspace />
        </AppProviders>
      </MemoryRouter>,
    )

    await screen.findByText('验证管理员')
    await user.click(screen.getByRole('button', { name: '新建用户' }))
    await user.type(screen.getByLabelText('姓名'), '验收用户')
    await user.type(screen.getByLabelText('登录账号'), 'acceptance.user')
    await user.type(screen.getByLabelText('内部标识'), 'UAT-001')
    await user.type(
      screen.getByLabelText('工作邮箱'),
      'acceptance.user@example.test',
    )
    await user.type(screen.getByLabelText('手机号'), '13900001234')
    await user.type(screen.getByLabelText('临时密码'), 'Uat!user123456')
    await user.click(screen.getByRole('button', { name: '创建用户' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/iam/users',
        expect.objectContaining({
          body: JSON.stringify({
            loginName: 'acceptance.user',
            displayName: '验收用户',
            employeeCode: 'UAT-001',
            workEmail: 'acceptance.user@example.test',
            mobilePhone: '13900001234',
            organizationUnitId: 'root',
            temporaryPassword: 'Uat!user123456',
          }),
          method: 'POST',
        }),
      )
    })

    await waitFor(() => {
      expect(screen.queryByLabelText('临时密码')).not.toBeInTheDocument()
    })
  })

  it('restores directory query state from the URL', async () => {
    const fetchMock = installApiMock()

    render(
      <MemoryRouter
        initialEntries={[
          '/system/organization-users?organization=department&status=DISABLED&query=chen&page=2&pageSize=20',
        ]}
      >
        <AppProviders>
          <OrganizationUserWorkspace />
        </AppProviders>
      </MemoryRouter>,
    )

    expect(await screen.findByDisplayValue('chen')).toBeInTheDocument()

    await waitFor(() => {
      const userRequests = fetchMock.mock.calls
        .map(([input]) => String(input))
        .filter((url) => url.startsWith('/api/iam/users?'))

      expect(userRequests).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'page=2&pageSize=20&includeDescendants=true&keyword=chen&organizationUnitId=department&statuses=DISABLED',
          ),
        ]),
      )
    })
  })
})
