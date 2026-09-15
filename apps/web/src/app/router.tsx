import { createBrowserRouter, Navigate } from 'react-router'

import { NotFoundPage } from '@/app/not-found-page'
import { AuthGate } from '@/features/auth/auth-gate'
import { AppShell } from '@/shared/layout/app-shell'

async function loadSystemOverviewPage() {
  const { SystemOverviewPage } =
    await import('@/features/system/system-overview-page')
  return { Component: SystemOverviewPage }
}

async function loadOrganizationUserWorkspace() {
  const { OrganizationUserWorkspace } =
    await import('@/features/organization-users/organization-user-workspace')
  return { Component: OrganizationUserWorkspace }
}

async function loadAccessControlWorkspace() {
  const { AccessControlWorkspace } =
    await import('@/features/menu-permissions/access-control-workspace')
  return { Component: AccessControlWorkspace }
}

async function loadLoginPage() {
  const { LoginPage } = await import('@/features/auth/login-page')
  return { Component: LoginPage }
}

async function loadChangePasswordPage() {
  const { ChangePasswordPage } =
    await import('@/features/auth/change-password-page')
  return { Component: ChangePasswordPage }
}

async function loadComponentLabPage() {
  const { ComponentLabPage } =
    await import('@/features/component-lab/component-lab-page')
  return { Component: ComponentLabPage }
}

const routeLoadingFallback = (
  <div
    className="bg-canvas text-slate grid min-h-dvh place-items-center text-sm"
    role="status"
  >
    正在加载本地工作台…
  </div>
)

const prototypeRoutes = import.meta.env.DEV
  ? [
      {
        path: 'component-lab',
        lazy: loadComponentLabPage,
        hydrateFallbackElement: (
          <div className="grid min-h-dvh place-items-center bg-[#f4f6fa] text-sm text-[#667085]">
            正在加载 Ant Design v6 视觉验证页…
          </div>
        ),
      },
    ]
  : []

export const router = createBrowserRouter([
  ...prototypeRoutes,
  {
    path: '/login',
    lazy: loadLoginPage,
    hydrateFallbackElement: routeLoadingFallback,
  },
  {
    element: <AuthGate />,
    hydrateFallbackElement: routeLoadingFallback,
    children: [
      {
        path: '/password/change',
        lazy: loadChangePasswordPage,
        hydrateFallbackElement: routeLoadingFallback,
      },
      {
        element: <AppShell />,
        children: [
          {
            index: true,
            element: <Navigate to="system/overview" replace />,
          },
          { path: 'system/overview', lazy: loadSystemOverviewPage },
          ...['delivery-initiation', 'delivery-initiation/:id'].map((path) => ({
            path,
            lazy: async () => ({
              Component: (
                await import('@/features/delivery/delivery-workspace')
              ).DeliveryWorkspacePage,
            }),
          })),
          ...[
            'system/delivery-configuration',
            'system/delivery-configuration/:id',
          ].map((path) => ({
            path,
            lazy: async () => ({
              Component: (
                await import('@/features/delivery/configuration-workspace')
              ).ConfigurationWorkspace,
            }),
          })),
          ...['crm/customers', 'crm/customers/:id'].map((path) => ({
            path,
            lazy: async () => ({
              Component: (await import('@/features/crm/crm-workspace'))
                .CustomerWorkspace,
            }),
          })),
          ...['crm/opportunities', 'crm/opportunities/:id'].map((path) => ({
            path,
            lazy: async () => ({
              Component: (await import('@/features/crm/crm-workspace'))
                .OpportunityWorkspace,
            }),
          })),
          ...['projects', 'projects/:id', 'presales'].map((path) => ({
            path,
            lazy: async () => ({
              Component: (await import('@/features/projects/project-workspace'))
                .ProjectWorkspace,
            }),
          })),
          {
            path: 'projects/:projectId/income',
            lazy: async () => ({
              Component: (await import('@/features/income/income-workspace'))
                .IncomeWorkspacePage,
            }),
          },
          {
            path: 'projects/:projectId/work-packages/:workPackageId/tasks',
            lazy: async () => ({
              Component: (await import('@/features/tasks/task-workspace'))
                .TaskWorkspacePage,
            }),
          },
          ...['contracts', 'contracts/:id'].map((path) => ({
            path,
            lazy: async () => ({
              Component: (
                await import('@/features/contracts/contract-workspace')
              ).ContractWorkspace,
            }),
          })),
          ...['requirements', 'requirements/:id'].map((path) => ({
            path,
            lazy: async () => ({
              Component: (
                await import('@/features/requirements/requirement-workspace')
              ).RequirementWorkspace,
            }),
          })),
          {
            path: 'work-items/:id',
            lazy: async () => ({
              Component: (
                await import('@/features/requirements/requirement-workspace')
              ).WorkItemWorkspace,
            }),
          },
          {
            path: 'system/organization-users',
            lazy: loadOrganizationUserWorkspace,
          },
          {
            path: 'system/access-control',
            element: <Navigate to="/system/access-control/roles" replace />,
          },
          {
            path: 'system/access-control/roles',
            lazy: loadAccessControlWorkspace,
          },
          {
            path: 'system/access-control/menus',
            lazy: loadAccessControlWorkspace,
          },
          {
            path: 'system/access-control/permission-items',
            lazy: loadAccessControlWorkspace,
          },
          {
            path: 'system/access-control/assignments',
            lazy: loadAccessControlWorkspace,
          },
          {
            path: 'system/access-control/temporary-grants',
            lazy: loadAccessControlWorkspace,
          },
          {
            path: 'system/access-control/preview',
            lazy: loadAccessControlWorkspace,
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
