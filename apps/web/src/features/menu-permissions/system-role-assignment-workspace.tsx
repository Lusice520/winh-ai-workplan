import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  Result,
  Select,
  Spin,
  Table,
  Typography,
  type FormInstance,
  type TableColumnsType,
} from 'antd'
import { ShieldPlus, UserRoundCog } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'

import { getProblemMessage } from '@/api/client/http'
import { getUsers } from '@/features/organization-users/organization-user-api'
import type { UserAccount } from '@/features/organization-users/organization-user-types'
import {
  getAccessControlCapabilities,
  getRoles,
  getSystemRoleAssignmentSet,
  getSystemRoleAssignments,
  replaceSystemRoleAssignments,
} from '@/features/menu-permissions/access-control-api'
import { StatusTag } from '@/features/menu-permissions/access-control-display'
import type {
  AccessRole,
  SystemRoleAssignment,
} from '@/features/menu-permissions/access-control-types'
import {
  AccessControlDrawerHeading,
  FormSection,
} from '@/shared/ui/form-drawer'
import { tablePagination, tableScroll } from '@/shared/ui/table-pagination'

type AssignmentFormValues = {
  roleIds: string[]
  reason: string
}

const emptyUsers: UserAccount[] = []
const emptyRoles: AccessRole[] = []
const emptyAssignments: SystemRoleAssignment[] = []

export function SystemRoleAssignmentWorkspace() {
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const [selectedAccount, setSelectedAccount] = useState<UserAccount>()
  const [keyword, setKeyword] = useState('')
  const search = useDeferredValue(keyword)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form] = Form.useForm<AssignmentFormValues>()
  const capabilitiesQuery = useQuery({
    queryKey: ['access-control', 'capabilities'],
    queryFn: ({ signal }) => getAccessControlCapabilities(signal),
  })
  const canManage =
    capabilitiesQuery.data?.includes('IAM_SYSTEM_ROLE_ASSIGNMENT_MANAGE') ??
    false
  const usersQuery = useQuery({
    queryKey: [
      'iam',
      'users',
      'access-control-assignments',
      search,
      page,
      pageSize,
    ],
    queryFn: ({ signal }) =>
      getUsers({ page, pageSize, keyword: search }, signal),
  })
  const rolesQuery = useQuery({
    queryKey: ['access-control', 'roles', 'SYSTEM', 'ENABLED'],
    queryFn: ({ signal }) =>
      getRoles({ roleType: 'SYSTEM', status: 'ENABLED' }, signal),
  })
  const assignmentsQuery = useQuery({
    queryKey: ['access-control', 'system-role-assignments'],
    queryFn: ({ signal }) => getSystemRoleAssignments({}, signal),
  })
  const users = usersQuery.data?.items ?? emptyUsers
  const roles = rolesQuery.data ?? emptyRoles
  const assignments = assignmentsQuery.data ?? emptyAssignments
  const activeAccountId = selectedAccount?.id ?? users[0]?.id
  const assignmentSetQuery = useQuery({
    queryKey: ['access-control', 'system-role-assignment-set', activeAccountId],
    queryFn: ({ signal }) =>
      getSystemRoleAssignmentSet(activeAccountId!, signal),
    enabled: Boolean(activeAccountId),
  })
  const selectedUser = selectedAccount ?? users[0]
  const selectedUserId = selectedUser?.id

  const assignmentSummary = useMemo(
    () => summarizeAssignments(assignments),
    [assignments],
  )

  useEffect(() => {
    if (!drawerOpen) return

    if (
      !selectedUserId ||
      !assignmentSetQuery.data ||
      assignmentSetQuery.data.accountId !== selectedUserId
    ) {
      return
    }

    form.resetFields()
    form.setFieldsValue({
      roleIds: assignmentSetQuery.data.assignments
        .filter((assignment) => assignment.status === 'ACTIVE')
        .map((assignment) => assignment.roleId),
      reason: '',
    })
  }, [assignmentSetQuery.data, drawerOpen, form, selectedUserId])

  const saveMutation = useMutation({
    mutationFn: async (values: AssignmentFormValues) => {
      if (!selectedUser || !assignmentSetQuery.data) {
        throw new Error('请先选择一个账号并等待授权历史加载完成。')
      }
      return replaceSystemRoleAssignments(selectedUser.id, {
        roleIds: values.roleIds ?? [],
        version: assignmentSetQuery.data.version,
        reason: values.reason.trim(),
      })
    },
    onSuccess: async () => {
      message.success('系统角色授权已更新。')
      setDrawerOpen(false)
      await queryClient.invalidateQueries({
        queryKey: ['access-control', 'system-role-assignments'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['access-control', 'system-role-assignment-set'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['access-control', 'navigation'],
      })
    },
    onError: (error) => {
      message.error(
        getProblemMessage(error, '系统角色授权未完成，请检查后重试。'),
      )
    },
  })

  function openDrawer(user: UserAccount) {
    setSelectedAccount(user)
    setDrawerOpen(true)
  }

  const columns: TableColumnsType<UserAccount> = [
    {
      title: '账号',
      dataIndex: 'displayName',
      width: 220,
      render: (name: string, user) => (
        <button
          className="text-left hover:text-[#2f68d8]"
          type="button"
          onClick={() => openDrawer(user)}
        >
          <div className="font-semibold text-[#35455f]">{name}</div>
          <div className="mt-0.5 text-xs text-[#78869a]">{user.loginName}</div>
        </button>
      ),
    },
    {
      title: '所属组织',
      dataIndex: ['organizationUnit', 'name'],
      width: 180,
    },
    {
      title: '账号状态',
      dataIndex: 'accountStatus',
      width: 100,
      render: (value: UserAccount['accountStatus']) =>
        value === 'ENABLED' ? (
          <StatusTag status="ENABLED" />
        ) : (
          <StatusTag status="DISABLED" />
        ),
    },
    {
      title: '生效系统角色',
      width: 340,
      render: (_, user) => {
        const names = assignmentSummary.get(user.id) ?? []
        return names.length ? (
          <div className="flex flex-wrap gap-1.5">
            {names.map((name) => (
              <span
                key={name}
                className="rounded-md border border-[#d9e7ff] bg-[#f5f8ff] px-2 py-0.5 text-xs text-[#4269a9]"
              >
                {name}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-[#8a96a8]">未分配</span>
        )
      },
    },
    {
      title: '操作',
      width: 110,
      align: 'right',
      render: (_, user) => (
        <Button size="small" onClick={() => openDrawer(user)}>
          {canManage ? '管理授权' : '查看授权'}
        </Button>
      ),
    },
  ]

  if (
    usersQuery.isPending ||
    rolesQuery.isPending ||
    assignmentsQuery.isPending
  ) {
    return <LoadingCard text="正在读取账号和系统角色…" />
  }

  if (usersQuery.isError || rolesQuery.isError || assignmentsQuery.isError) {
    const error = usersQuery.error ?? rolesQuery.error ?? assignmentsQuery.error
    return (
      <Result
        status="error"
        title="无法读取系统角色授权数据"
        subTitle={getProblemMessage(
          error,
          '请确认当前账号具有用户、角色和授权查看权限。',
        )}
        extra={
          <Button onClick={() => void usersQuery.refetch()}>重新加载</Button>
        }
      />
    )
  }

  return (
    <Card
      className="access-control-surface access-control-surface--catalog access-control-surface--table"
      styles={{ body: { padding: 0 } }}
    >
      <div className="access-control-section-header access-control-section-header--catalog">
        <div>
          <Typography.Text className="access-control-section-title">
            <UserRoundCog className="size-4 text-[#4171d8]" />
            系统角色授权
          </Typography.Text>
          <Typography.Paragraph className="access-control-section-description">
            按账号查看和设置系统角色。保存后立即生效，被收回的角色保留历史记录。
          </Typography.Paragraph>
        </div>
        <Button
          disabled={!selectedUser}
          type="primary"
          icon={<ShieldPlus className="size-4" />}
          onClick={() => selectedUser && openDrawer(selectedUser)}
        >
          {canManage ? '管理选中账号' : '查看选中账号'}
        </Button>
      </div>
      <div className="px-4 pb-3">
        <Input.Search
          aria-label="搜索授权账号"
          placeholder="搜索姓名、账号、邮箱…"
          allowClear
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value)
            setPage(1)
          }}
          className="max-w-sm"
        />
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={users}
        scroll={tableScroll(920)}
        pagination={tablePagination({
          current: page,
          pageSize,
          total: usersQuery.data?.total ?? 0,
          onChange: (next, size) => {
            setPage(next)
            setPageSize(size)
          },
        })}
        onRow={(user) => ({
          onClick: () => setSelectedAccount(user),
          className: user.id === selectedUser?.id ? 'bg-[#f5f8ff]' : undefined,
        })}
      />

      <Drawer
        className="management-form-drawer access-control-form-drawer access-control-system-role-drawer"
        destroyOnHidden
        open={drawerOpen}
        size={520}
        title={
          <AccessControlDrawerHeading
            title={canManage ? '维护系统角色授权' : '查看系统角色授权'}
            subtitle="菜单与权限 / 系统角色授权"
          />
        }
        onClose={() => setDrawerOpen(false)}
        footer={
          <div className="flex justify-end gap-3">
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            {canManage && (
              <Button
                disabled={
                  !selectedUser ||
                  selectedUser.accountStatus !== 'ENABLED' ||
                  assignmentSetQuery.isPending ||
                  assignmentSetQuery.isError
                }
                type="primary"
                loading={saveMutation.isPending}
                onClick={() =>
                  void form
                    .validateFields()
                    .then((values) => saveMutation.mutate(values))
                }
              >
                保存角色授权
              </Button>
            )}
          </div>
        }
      >
        {selectedUser ? (
          <div className="form-drawer-stack">
            <FormSection
              icon={<UserRoundCog className="size-4" />}
              title="授权对象"
            >
              <div className="form-drawer-account-context">
                <Typography.Text className="!block !text-sm !font-semibold !text-[#31415e]">
                  {selectedUser.displayName} · {selectedUser.loginName}
                </Typography.Text>
                <Typography.Text className="!mt-1 !block !text-xs !text-[#728198]">
                  所属组织：{selectedUser.organizationUnit.name}
                </Typography.Text>
              </div>
            </FormSection>
            {selectedUser.accountStatus !== 'ENABLED' ? (
              <Alert
                type="warning"
                showIcon
                className="access-control-guardrail"
                description="停用、锁定或离职账号不能被分配系统角色。"
              />
            ) : null}
            {assignmentSetQuery.isPending ? (
              <div className="grid min-h-32 place-items-center">
                <Spin description="正在读取当前授权集…" />
              </div>
            ) : assignmentSetQuery.isError ? (
              <Result
                status="error"
                title="无法读取当前授权集"
                subTitle={getProblemMessage(assignmentSetQuery.error)}
              />
            ) : (
              <AssignmentForm form={form} roles={roles} canManage={canManage} />
            )}
          </div>
        ) : (
          <Empty
            description="请选择账号"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Drawer>
    </Card>
  )
}

function AssignmentForm({
  form,
  roles,
  canManage,
}: {
  form: FormInstance<AssignmentFormValues>
  roles: AccessRole[]
  canManage: boolean
}) {
  return (
    <Form
      disabled={!canManage}
      className="form-section-stack access-control-system-role-form"
      colon={false}
      form={form}
      labelAlign="left"
      labelCol={{ flex: '112px' }}
      layout="horizontal"
      requiredMark
      wrapperCol={{ flex: '1 1 0' }}
    >
      <FormSection
        icon={<ShieldPlus className="size-4" />}
        title="系统角色配置"
      >
        <Form.Item name="roleIds" label="启用系统角色">
          <Select
            allowClear
            mode="multiple"
            showSearch={{ optionFilterProp: 'label' }}
            options={roles.map((role) => ({
              value: role.id,
              label:
                role.name +
                ' · ' +
                role.code +
                '（下放层级 ' +
                role.delegationLevel +
                '）',
            }))}
            placeholder="选择要生效的系统角色"
          />
        </Form.Item>
        <Form.Item
          className="access-control-form-item--multiline"
          name="reason"
          label="调整原因"
          rules={[
            {
              required: true,
              whitespace: true,
              message: '请填写授权调整原因。',
            },
          ]}
          extra="保存将显式撤销未选择的现有生效角色，并保留历史分配记录。"
        >
          <Input.TextArea
            autoSize={{ minRows: 3, maxRows: 5 }}
            maxLength={500}
          />
        </Form.Item>
        <Alert
          className="access-control-guardrail"
          description="只有启用账号和启用系统角色可进入本次授权；服务端会拒绝超出当前操作者可下放层级，或包含其无权下放权限项的角色。"
          showIcon
          type="warning"
        />
      </FormSection>
    </Form>
  )
}

function summarizeAssignments(assignments: SystemRoleAssignment[]) {
  const byAccount = new Map<string, string[]>()
  assignments
    .filter((assignment) => assignment.status === 'ACTIVE')
    .forEach((assignment) => {
      const roles = byAccount.get(assignment.accountId) ?? []
      roles.push(assignment.roleName)
      byAccount.set(assignment.accountId, roles)
    })
  return byAccount
}

function LoadingCard({ text }: { text: string }) {
  return (
    <Card className="access-control-surface">
      <div className="grid min-h-[320px] place-items-center">
        <Spin description={text} />
      </div>
    </Card>
  )
}
