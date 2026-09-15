import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppProviders } from '@/app/providers'
import { AppShell } from '@/shared/layout/app-shell'

function installSessionMock() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      if (String(input) === '/api/access-control/navigation') {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                code: 'SYSTEM_MANAGEMENT',
                name: '系统管理',
                routeKey: null,
                iconKey: 'settings',
                children: [
                  {
                    code: 'ACCESS_CONTROL',
                    name: '菜单与权限',
                    routeKey: 'system.access-control',
                    iconKey: 'shield-check',
                    children: [],
                  },
                ],
              },
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            accountId: 'admin',
            loginName: 'test-admin',
            displayName: '验证管理员',
            mustChangePassword: false,
            bootstrapSystemAdministrator: true,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AppShell mobile navigation', () => {
  it('closes the navigation drawer with Escape and restores trigger focus', async () => {
    installSessionMock()
    const user = userEvent.setup()
    const router = createMemoryRouter([
      {
        element: <AppShell />,
        children: [{ index: true, element: <p>页面内容</p> }],
      },
    ])

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    )

    const trigger = screen.getByRole('button', { name: '打开导航' })
    await user.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('opens business search from the compact header control', async () => {
    installSessionMock()
    const user = userEvent.setup()
    const router = createMemoryRouter([
      {
        element: <AppShell />,
        children: [{ index: true, element: <p>页面内容</p> }],
      },
    ])

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    )

    await user.click(screen.getByRole('button', { name: '搜索业务记录' }))
    expect(
      screen.getByRole('dialog', { name: '搜索业务记录' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: '搜索关键词' }),
    ).toBeInTheDocument()
  })
})
