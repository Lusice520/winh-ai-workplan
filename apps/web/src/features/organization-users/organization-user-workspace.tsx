import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App as AntdApp,
  Button,
  Card,
  Result,
  Spin,
  Tag,
  Typography,
} from 'antd'
import { Info } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import { getProblemMessage } from '@/api/client/http'
import { getAccessControlCapabilities } from '@/features/menu-permissions/access-control-api'
import {
  createOrganizationUnit,
  createUser,
  getOrganizationTree,
  getUser,
  getUsers,
  moveUser,
  resetUserPassword,
  transitionOrganizationUnitStatus,
  transitionUserStatus,
  updateOrganizationUnit,
  updateUser,
} from '@/features/organization-users/organization-user-api'
import { OrganizationDirectoryPanel } from '@/features/organization-users/organization-directory-panel'
import { OrganizationUnitDrawer } from '@/features/organization-users/organization-unit-drawer'
import {
  findOrganization,
  toOrganizationTreeOptions,
} from '@/features/organization-users/organization-user-helpers'
import {
  type AccountAction,
  type AccountActionFormValues,
  type AccountActionState,
  type DepartmentDrawerState,
  type DepartmentFormValues,
  type UserDrawerState,
  type UserFormValues,
} from '@/features/organization-users/organization-user-ui'
import { UserAccountActionDrawer } from '@/features/organization-users/user-account-action-drawer'
import { UserDetailDrawer } from '@/features/organization-users/user-detail-drawer'
import { UserDirectoryPanel } from '@/features/organization-users/user-directory-panel'
import { defaultTablePageSize } from '@/shared/ui/table-pagination'
import { UserEditorDrawer } from '@/features/organization-users/user-editor-drawer'
import type {
  AccountStatus,
  OrganizationUnit,
  UserAccount,
} from '@/features/organization-users/organization-user-types'

const emptyOrganizationTree: OrganizationUnit[] = []
const accountStatusFilters: AccountStatus[] = [
  'ENABLED',
  'DISABLED',
  'LOCKED',
  'TERMINATED',
]
const pageSizeOptions = [10, 20, 50]

function readPositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function readAccountStatus(value: string | null): 'ALL' | AccountStatus {
  return accountStatusFilters.includes(value as AccountStatus)
    ? (value as AccountStatus)
    : 'ALL'
}

function readPageSize(value: string | null) {
  const parsed = readPositiveInteger(value, defaultTablePageSize)
  return pageSizeOptions.includes(parsed) ? parsed : defaultTablePageSize
}

export function OrganizationUserWorkspace() {
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedOrganizationId = searchParams.get('organization') ?? undefined
  const userSearch = searchParams.get('query') ?? ''
  const deferredUserSearch = useDeferredValue(userSearch)
  const selectedStatus = readAccountStatus(searchParams.get('status'))
  const page = readPositiveInteger(searchParams.get('page'), 1)
  const pageSize = readPageSize(searchParams.get('pageSize'))
  const [departmentDrawer, setDepartmentDrawer] =
    useState<DepartmentDrawerState>()
  const [userDrawer, setUserDrawer] = useState<UserDrawerState>()
  const [detailUserId, setDetailUserId] = useState<string>()
  const [accountAction, setAccountAction] = useState<AccountActionState>()
  const capabilitiesQuery = useQuery({
    queryKey: ['access-control', 'capabilities'],
    queryFn: ({ signal }) => getAccessControlCapabilities(signal),
    refetchInterval: 15_000,
  })
  const canManageOrganizations =
    capabilitiesQuery.data?.includes('IAM_ORGANIZATION_MANAGE') ?? false
  const canManageUsers =
    capabilitiesQuery.data?.includes('IAM_USER_MANAGE') ?? false

  function updateDirectoryParams(updates: Record<string, string | undefined>) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        Object.entries(updates).forEach(([key, value]) => {
          if (value) {
            next.set(key, value)
          } else {
            next.delete(key)
          }
        })
        return next
      },
      { replace: true },
    )
  }

  const organizationTreeQuery = useQuery({
    queryKey: ['iam', 'organization-tree'],
    queryFn: ({ signal }) => getOrganizationTree(signal),
  })
  const organizationTree = organizationTreeQuery.data ?? emptyOrganizationTree
  const activeOrganizationId =
    findOrganization(organizationTree, selectedOrganizationId)?.id ??
    organizationTree[0]?.id
  const selectedOrganization = findOrganization(
    organizationTree,
    activeOrganizationId,
  )

  const usersQuery = useQuery({
    queryKey: [
      'iam',
      'users',
      activeOrganizationId,
      selectedStatus,
      deferredUserSearch,
      page,
      pageSize,
    ],
    queryFn: ({ signal }) =>
      getUsers(
        {
          page,
          pageSize,
          keyword: deferredUserSearch,
          organizationUnitId: activeOrganizationId,
          includeDescendants: true,
          statuses: selectedStatus === 'ALL' ? undefined : [selectedStatus],
        },
        signal,
      ),
    enabled: Boolean(activeOrganizationId),
    placeholderData: (previousData) => previousData,
  })

  const statusCountsQuery = useQuery({
    queryKey: ['iam', 'users', 'status-counts', activeOrganizationId],
    queryFn: async ({ signal }) => {
      const baseQuery = {
        page: 1,
        pageSize: 1,
        organizationUnitId: activeOrganizationId,
        includeDescendants: true,
      }
      const [all, enabled, disabled, locked, terminated] = await Promise.all([
        getUsers(baseQuery, signal),
        getUsers({ ...baseQuery, statuses: ['ENABLED'] }, signal),
        getUsers({ ...baseQuery, statuses: ['DISABLED'] }, signal),
        getUsers({ ...baseQuery, statuses: ['LOCKED'] }, signal),
        getUsers({ ...baseQuery, statuses: ['TERMINATED'] }, signal),
      ])
      return {
        ALL: all.total,
        ENABLED: enabled.total,
        DISABLED: disabled.total,
        LOCKED: locked.total,
        TERMINATED: terminated.total,
      } satisfies Record<'ALL' | AccountStatus, number>
    },
    enabled: Boolean(activeOrganizationId),
  })

  const detailUserQuery = useQuery({
    queryKey: ['iam', 'user', detailUserId],
    queryFn: ({ signal }) => getUser(detailUserId!, signal),
    enabled: Boolean(detailUserId),
  })

  const organizationOptions = useMemo(
    () => toOrganizationTreeOptions(organizationTree),
    [organizationTree],
  )
  const managerOptions = useMemo(
    () =>
      (usersQuery.data?.items ?? [])
        .filter((user) => user.accountStatus === 'ENABLED')
        .map((user) => ({
          value: user.id,
          label: `${user.displayName} · ${user.loginName}`,
        })),
    [usersQuery.data?.items],
  )

  const invalidateDirectory = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['iam', 'organization-tree'] }),
      queryClient.invalidateQueries({ queryKey: ['iam', 'users'] }),
      queryClient.invalidateQueries({ queryKey: ['iam', 'user'] }),
    ])
  }

  const organizationMutation = useMutation({
    mutationFn: async (values: DepartmentFormValues) => {
      if (!departmentDrawer) {
        return
      }

      if (departmentDrawer.mode === 'create') {
        const parentId = values.parentId ?? activeOrganizationId
        if (!parentId) {
          throw new Error('请先选择一个上级组织。')
        }
        await createOrganizationUnit({
          name: values.name.trim(),
          code: values.code.trim(),
          unitType: 'DEPARTMENT',
          parentId,
          managerAccountId: values.managerAccountId,
          sortOrder: values.sortOrder,
          status: values.status,
        })
        return
      }

      const updated = await updateOrganizationUnit(departmentDrawer.unit.id, {
        name: values.name.trim(),
        code: values.code.trim(),
        parentId:
          departmentDrawer.unit.unitType === 'COMPANY'
            ? undefined
            : values.parentId,
        managerAccountId: values.managerAccountId,
        sortOrder: values.sortOrder,
        version: departmentDrawer.unit.version,
      })
      if (updated.status !== values.status) {
        await transitionOrganizationUnitStatus(updated.id, {
          targetStatus: values.status,
          reason: values.reason?.trim() ?? '',
          version: updated.version,
        })
      }
    },
    onSuccess: async () => {
      message.success(
        departmentDrawer?.mode === 'create' ? '部门已创建。' : '部门已更新。',
      )
      setDepartmentDrawer(undefined)
      await invalidateDirectory()
    },
    onError: (error) => {
      message.error(getProblemMessage(error, '部门保存未完成，请检查后重试。'))
    },
  })

  const userMutation = useMutation({
    mutationFn: async (values: UserFormValues) => {
      if (!userDrawer) {
        return
      }

      if (userDrawer.mode === 'create') {
        await createUser({
          loginName: values.loginName.trim(),
          displayName: values.displayName.trim(),
          employeeCode: values.employeeCode?.trim() || undefined,
          workEmail: values.workEmail?.trim() || undefined,
          mobilePhone: values.mobilePhone?.trim() || undefined,
          organizationUnitId: values.organizationUnitId,
          temporaryPassword: values.temporaryPassword!,
        })
        return
      }

      await updateUser(userDrawer.user.id, {
        displayName: values.displayName.trim(),
        employeeCode: values.employeeCode?.trim() || undefined,
        workEmail: values.workEmail?.trim() || undefined,
        mobilePhone: values.mobilePhone?.trim() || undefined,
        version: userDrawer.user.version,
      })
    },
    onSuccess: async () => {
      message.success(
        userDrawer?.mode === 'create' ? '用户已创建。' : '用户资料已更新。',
      )
      setUserDrawer(undefined)
      await invalidateDirectory()
    },
    onError: (error) => {
      message.error(getProblemMessage(error, '用户保存未完成，请检查后重试。'))
    },
  })

  const accountActionMutation = useMutation({
    mutationFn: async (values: AccountActionFormValues) => {
      if (!accountAction) {
        return
      }

      const { action, user } = accountAction
      if (action === 'move') {
        await moveUser(user.id, {
          targetOrganizationUnitId: values.targetOrganizationUnitId!,
          reason: values.reason.trim(),
          version: user.version,
        })
        return
      }
      if (action === 'status') {
        await transitionUserStatus(user.id, {
          targetStatus: values.targetStatus!,
          reason: values.reason.trim(),
          version: user.version,
        })
        return
      }
      await resetUserPassword(user.id, {
        temporaryPassword: values.temporaryPassword!,
        reason: values.reason.trim(),
        version: user.version,
      })
    },
    onSuccess: async () => {
      const actionText =
        accountAction?.action === 'move'
          ? '用户部门已调整。'
          : accountAction?.action === 'status'
            ? '账号状态已更新。'
            : '临时密码已重置。'
      message.success(actionText)
      setAccountAction(undefined)
      setDetailUserId(undefined)
      await invalidateDirectory()
    },
    onError: (error) => {
      message.error(getProblemMessage(error, '账号操作未完成，请检查后重试。'))
    },
  })

  function openUserEditor(state: Exclude<UserDrawerState, undefined>) {
    setUserDrawer(state)
  }

  function openAccountAction(action: AccountAction, user: UserAccount) {
    setDetailUserId(undefined)
    setAccountAction({ action, user })
  }

  if (organizationTreeQuery.isPending) {
    return (
      <div className="grid min-h-[420px] place-items-center rounded-2xl border border-[#e4eaf3] bg-white">
        <Spin description="正在读取组织与用户数据…" />
      </div>
    )
  }

  if (organizationTreeQuery.isError) {
    return (
      <Result
        status="error"
        title="无法读取组织目录"
        subTitle={getProblemMessage(
          organizationTreeQuery.error,
          '请确认本地后端服务已启动。',
        )}
        extra={
          <Button onClick={() => void organizationTreeQuery.refetch()}>
            重新加载
          </Button>
        }
      />
    )
  }

  const counts = statusCountsQuery.data ?? {
    ALL: 0,
    ENABLED: 0,
    DISABLED: 0,
    LOCKED: 0,
    TERMINATED: 0,
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">组织与用户</h1>
      <div className="workspace-notice">
        <Info className="size-4 shrink-0" aria-hidden="true" />
        按组织查看账号与在岗状态。账号资料、部门调整和安全操作均保留变更记录。
      </div>

      {selectedOrganization ? (
        <Card
          className="!border-[#e4eaf3] !shadow-none"
          styles={{ body: { padding: '14px 16px' } }}
        >
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
            <div>
              <Typography.Text className="!text-xs !text-[#8a96ab]">
                当前组织
              </Typography.Text>
              <Typography.Text className="!ml-2 !font-semibold !text-[#31415e]">
                {selectedOrganization.name}
              </Typography.Text>
            </div>
            <div>
              <Typography.Text className="!text-xs !text-[#8a96ab]">
                组织编码
              </Typography.Text>
              <Typography.Text className="!ml-2 !font-medium !text-[#56657c]">
                {selectedOrganization.code}
              </Typography.Text>
            </div>
            <div>
              <Typography.Text className="!text-xs !text-[#8a96ab]">
                直属启用用户
              </Typography.Text>
              <Typography.Text className="!ml-2 !font-semibold !text-[#3157d5]">
                {selectedOrganization.directUserCount}
              </Typography.Text>
            </div>
            <div>
              <Typography.Text className="!text-xs !text-[#8a96ab]">
                组织状态
              </Typography.Text>
              <Tag
                className="!mr-0 !ml-2"
                color={
                  selectedOrganization.status === 'ENABLED'
                    ? 'success'
                    : 'error'
                }
              >
                {selectedOrganization.status === 'ENABLED' ? '启用' : '停用'}
              </Tag>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-[252px_minmax(0,1fr)]">
        <OrganizationDirectoryPanel
          canManage={canManageOrganizations}
          organizationTree={organizationTree}
          selectedOrganizationId={activeOrganizationId}
          selectedOrganization={selectedOrganization}
          onSelectOrganization={(organizationId) => {
            updateDirectoryParams({
              organization: organizationId,
              page: undefined,
            })
          }}
          onCreateOrganization={() => setDepartmentDrawer({ mode: 'create' })}
          onEditOrganization={(organization) =>
            setDepartmentDrawer({ mode: 'edit', unit: organization })
          }
        />
        <UserDirectoryPanel
          canManageOrganizations={canManageOrganizations}
          canManageUsers={canManageUsers}
          users={usersQuery.data}
          isLoading={usersQuery.isFetching}
          error={usersQuery.error}
          counts={counts}
          selectedStatus={selectedStatus}
          keyword={userSearch}
          page={page}
          pageSize={pageSize}
          onSelectedStatusChange={(status) => {
            updateDirectoryParams({
              status: status === 'ALL' ? undefined : status,
              page: undefined,
            })
          }}
          onKeywordChange={(keyword) => {
            updateDirectoryParams({
              query: keyword || undefined,
              page: undefined,
            })
          }}
          onPaginationChange={(nextPage, nextPageSize) => {
            updateDirectoryParams({
              page: nextPage === 1 ? undefined : String(nextPage),
              pageSize:
                nextPageSize === defaultTablePageSize
                  ? undefined
                  : String(nextPageSize),
            })
          }}
          onCreateOrganization={() => setDepartmentDrawer({ mode: 'create' })}
          onCreateUser={() => setUserDrawer({ mode: 'create' })}
          onViewUser={setDetailUserId}
          onEditUser={(user) => openUserEditor({ mode: 'edit', user })}
          onAccountAction={openAccountAction}
        />
      </div>

      <OrganizationUnitDrawer
        state={departmentDrawer}
        defaultParentId={activeOrganizationId}
        organizationOptions={organizationOptions}
        managerOptions={managerOptions}
        isSubmitting={organizationMutation.isPending}
        onClose={() => setDepartmentDrawer(undefined)}
        onSubmit={(values) => organizationMutation.mutate(values)}
      />
      <UserEditorDrawer
        state={userDrawer}
        defaultOrganizationUnitId={activeOrganizationId}
        organizationOptions={organizationOptions}
        isSubmitting={userMutation.isPending}
        onClose={() => setUserDrawer(undefined)}
        onSubmit={(values) => userMutation.mutate(values)}
      />
      <UserDetailDrawer
        canManage={canManageUsers}
        userId={detailUserId}
        user={detailUserQuery.data}
        isLoading={detailUserQuery.isPending}
        error={detailUserQuery.error}
        onClose={() => setDetailUserId(undefined)}
        onEditUser={(user) => {
          setDetailUserId(undefined)
          openUserEditor({ mode: 'edit', user })
        }}
        onAccountAction={openAccountAction}
      />
      <UserAccountActionDrawer
        state={accountAction}
        organizationOptions={organizationOptions}
        isSubmitting={accountActionMutation.isPending}
        onClose={() => setAccountAction(undefined)}
        onSubmit={(values) => accountActionMutation.mutate(values)}
      />
    </div>
  )
}
