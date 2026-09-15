import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Drawer,
  Descriptions,
  Empty,
  Form,
  Input,
  Result,
  Select,
  Spin,
  Table,
  Space,
  Tag,
  Typography,
  type FormInstance,
  type TableColumnsType,
} from 'antd'
import { Clock3, Plus, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { getProblemMessage } from '@/api/client/http'
import { CommandDrawer, type Command } from '@/features/business/business-ui'
import { getUsers } from '@/features/organization-users/organization-user-api'
import type { UserAccount } from '@/features/organization-users/organization-user-types'
import {
  createTemporaryGrant,
  getAccessControlCapabilities,
  getPermissionItems,
  getTemporaryGrants,
  revokeTemporaryGrant,
} from '@/features/menu-permissions/access-control-api'
import {
  RiskTag,
  StatusTag,
} from '@/features/menu-permissions/access-control-display'
import {
  formatDateTime,
  labelForDataScope,
  temporaryDataScopeOptions,
  toDateTimeLocalValue,
  toIsoDateTime,
} from '@/features/menu-permissions/access-control-options'
import type {
  DataScope,
  PermissionItem,
  TemporaryGrant,
  TemporaryGrantStatus,
} from '@/features/menu-permissions/access-control-types'
import {
  AccessControlDrawerHeading,
  FormSection,
} from '@/shared/ui/form-drawer'
import { tablePagination, tableScroll } from '@/shared/ui/table-pagination'

type GrantFormValues = {
  recipientAccountId: string
  permissionCode: string
  dataScope: DataScope
  scopeReferences?: string
  startsAt: string
  endsAt: string
  reason: string
  reviewerAccountId?: string
}

type RevokeFormValues = {
  reason: string
}

const emptyUsers: UserAccount[] = []
const emptyPermissionItems: PermissionItem[] = []
const emptyTemporaryGrants: TemporaryGrant[] = []

export function TemporaryGrantWorkspace() {
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<TemporaryGrantStatus>()
  const [createOpen, setCreateOpen] = useState(false)
  const [createDefaults, setCreateDefaults] =
    useState<Partial<GrantFormValues>>()
  const [revokeTarget, setRevokeTarget] = useState<TemporaryGrant>()
  const [command, setCommand] = useState<Command | null>(null)
  const [form] = Form.useForm<GrantFormValues>()
  const [revokeForm] = Form.useForm<RevokeFormValues>()
  const capabilities = useQuery({
    queryKey: ['access-control', 'capabilities'],
    queryFn: ({ signal }) => getAccessControlCapabilities(signal),
  })
  const canManage = [
    'IAM_TEMPORARY_GRANT_MANAGE',
    'IAM_USER_READ',
    'IAM_PERMISSION_ITEM_READ',
  ].every((p) => capabilities.data?.includes(p))
  const usersQuery = useQuery({
    queryKey: ['iam', 'users', 'access-control-temporary-grants'],
    queryFn: ({ signal }) => getUsers({ page: 1, pageSize: 100 }, signal),
    enabled: canManage,
  })
  const permissionsQuery = useQuery({
    queryKey: ['access-control', 'permission-items'],
    queryFn: ({ signal }) => getPermissionItems(signal),
    enabled: canManage,
  })
  const grantsQuery = useQuery({
    queryKey: ['access-control', 'temporary-grants', status],
    queryFn: ({ signal }) => getTemporaryGrants({ status }, signal),
    refetchInterval: 15000,
  })
  const users = usersQuery.data?.items ?? emptyUsers
  const permissions = permissionsQuery.data ?? emptyPermissionItems
  const grants = grantsQuery.data ?? emptyTemporaryGrants

  useEffect(() => {
    if (!createOpen || !createDefaults) return

    form.resetFields()
    form.setFieldsValue(createDefaults)
  }, [createDefaults, createOpen, form])

  useEffect(() => {
    if (!revokeTarget) return

    revokeForm.resetFields()
    revokeForm.setFieldsValue({ reason: '' })
  }, [revokeForm, revokeTarget])

  const createMutation = useMutation({
    mutationFn: (values: GrantFormValues) =>
      createTemporaryGrant({
        recipientAccountId: values.recipientAccountId,
        permissionCode: values.permissionCode,
        dataScope: values.dataScope,
        scopeReferences: values.scopeReferences?.trim() || undefined,
        startsAt: toIsoDateTime(values.startsAt),
        endsAt: toIsoDateTime(values.endsAt),
        reason: values.reason.trim(),
        reviewerAccountId: values.reviewerAccountId,
      }),
    onSuccess: async (result) => {
      message.success(
        result.status === 'PENDING_REVIEW'
          ? '已提交独立复核，通过前不会生效。'
          : '临时授权已创建，将按所设时间生效。',
      )
      setCreateOpen(false)
      await queryClient.invalidateQueries({
        queryKey: ['access-control', 'temporary-grants'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['access-control', 'navigation'],
      })
    },
    onError: (error) => {
      message.error(
        getProblemMessage(error, '临时授权创建未完成，请检查后重试。'),
      )
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (values: RevokeFormValues) => {
      if (!revokeTarget) throw new Error('未找到待撤销的临时授权。')
      return revokeTemporaryGrant(revokeTarget.id, {
        reason: values.reason.trim(),
        version: revokeTarget.version,
      })
    },
    onSuccess: async () => {
      message.success('临时授权已撤销。')
      setRevokeTarget(undefined)
      await queryClient.invalidateQueries({
        queryKey: ['access-control', 'temporary-grants'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['access-control', 'navigation'],
      })
    },
    onError: (error) => {
      message.error(
        getProblemMessage(error, '临时授权撤销未完成，请检查后重试。'),
      )
    },
  })

  function openCreate() {
    const startsAt = new Date(Date.now() + 5 * 60_000)
    const endsAt = new Date(startsAt.getTime() + 60 * 60_000)
    setCreateDefaults({
      recipientAccountId: undefined,
      permissionCode: undefined,
      dataScope: 'NAMED_OBJECTS',
      scopeReferences: '',
      startsAt: toDateTimeLocalValue(startsAt),
      endsAt: toDateTimeLocalValue(endsAt),
      reason: '',
      reviewerAccountId: undefined,
    })
    setCreateOpen(true)
  }

  function inspect(grant: TemporaryGrant, review = false) {
    setCommand({
      title: review ? '独立复核临时授权' : '临时授权记录',
      path: `/api/access-control/temporary-grants/${grant.id}/review`,
      readOnly: !review,
      values: { version: grant.version, decision: 'APPROVED' },
      description: review
        ? '批准后仅在原定范围及时间内生效；不能延长时限或替换申请内容。'
        : '保留原申请、独立复核及撤销记录。',
      content: (
        <Descriptions
          size="small"
          column={1}
          items={[
            {
              key: 'recipient',
              label: '受授人',
              children: grant.recipientDisplayName,
            },
            {
              key: 'permission',
              label: '权限',
              children: grant.permissionName,
            },
            {
              key: 'scope',
              label: '最小范围',
              children: labelForDataScope(grant.dataScope),
            },
            {
              key: 'objects',
              label: '指定对象',
              children: grant.scopeReferences || '按受授人范围',
            },
            {
              key: 'time',
              label: '有效期',
              children: `${formatDateTime(grant.startsAt)} 至 ${formatDateTime(grant.endsAt)}`,
            },
            {
              key: 'creator',
              label: '申请人',
              children: grant.createdByName || '历史未记录',
            },
            { key: 'reason', label: '申请原因', children: grant.reason },
            {
              key: 'reviewer',
              label: '指定复核人',
              children: grant.reviewerName || '常规授权无需复核',
            },
            {
              key: 'review',
              label: '复核意见',
              children: grant.reviewComment || '尚无复核结论',
            },
            {
              key: 'reviewed',
              label: '复核时间',
              children: grant.reviewedAt
                ? formatDateTime(grant.reviewedAt)
                : '—',
            },
            {
              key: 'revoke',
              label: '撤销原因',
              children: grant.revokeReason || '—',
            },
          ]}
        />
      ),
      fields: review
        ? [
            {
              name: 'decision',
              label: '复核结论',
              type: 'select',
              options: [
                { value: 'APPROVED', label: '批准' },
                { value: 'REJECTED', label: '拒绝' },
              ],
            },
            {
              name: 'comment',
              label: '复核意见',
              type: 'textarea',
              maxLength: 1000,
            },
          ]
        : [],
      submitLabel: '保存独立复核结论',
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['access-control'] })
      },
    })
  }

  const columns: TableColumnsType<TemporaryGrant> = [
    {
      title: '受授人',
      dataIndex: 'recipientDisplayName',
      width: 180,
      render: (name: string | null, grant) => (
        <div>
          <div className="font-semibold text-[#35455f]">
            {name ?? '已不可用账号'}
          </div>
          <div className="mt-0.5 text-xs text-[#7a879b]">
            {grant.recipientLoginName ?? grant.recipientAccountId}
          </div>
        </div>
      ),
    },
    {
      title: '权限与范围',
      width: 260,
      render: (_, grant) => (
        <div>
          <div className="font-medium text-[#45556d]">
            {grant.permissionName}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Typography.Text code className="!text-xs">
              {grant.permissionCode}
            </Typography.Text>
            <RiskTag riskLevel={grant.riskLevel} />
          </div>
          <div className="mt-1 text-xs text-[#728198]">
            {labelForDataScope(grant.dataScope)}
            {grant.scopeReferences ? ' · ' + grant.scopeReferences : ''}
          </div>
        </div>
      ),
    },
    {
      title: '有效期',
      width: 190,
      render: (_, grant) => (
        <div className="text-xs leading-5 text-[#62728a]">
          <div>{formatDateTime(grant.startsAt)}</div>
          <div>至 {formatDateTime(grant.endsAt)}</div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (value: TemporaryGrantStatus, grant) =>
        value === 'ACTIVE' &&
        new Date(grant.startsAt).getTime() > Date.now() ? (
          <Tag color="processing">待生效</Tag>
        ) : (
          <StatusTag status={value} />
        ),
    },
    {
      title: '复核与原因',
      width: 230,
      render: (_, grant) => (
        <div>
          <div>{grant.reviewerName || '常规授权'}</div>
          <div className="mt-1 text-xs text-[#728198]">
            {grant.reviewComment || grant.reason}
          </div>
        </div>
      ),
    },
    {
      title: '操作',
      width: 190,
      align: 'right',
      render: (_, grant) => (
        <Space size={4}>
          <Button size="small" onClick={() => inspect(grant)}>
            查看
          </Button>
          {grant.allowedActions.includes('REVIEW') && (
            <Button
              size="small"
              type="primary"
              onClick={() => inspect(grant, true)}
            >
              复核
            </Button>
          )}
          {grant.allowedActions.includes('REVOKE') && (
            <Button
              danger
              size="small"
              icon={<Undo2 className="size-3.5" />}
              onClick={() => {
                setRevokeTarget(grant)
              }}
            >
              撤销
            </Button>
          )}
        </Space>
      ),
    },
  ]

  if (
    capabilities.isPending ||
    (canManage && (usersQuery.isPending || permissionsQuery.isPending)) ||
    grantsQuery.isPending
  ) {
    return <LoadingCard text="正在读取临时授权…" />
  }

  if (
    capabilities.isError ||
    (canManage && (usersQuery.isError || permissionsQuery.isError)) ||
    grantsQuery.isError
  ) {
    const error =
      capabilities.error ??
      usersQuery.error ??
      permissionsQuery.error ??
      grantsQuery.error
    return (
      <Result
        status="error"
        title="无法读取临时授权"
        subTitle={getProblemMessage(
          error,
          '请确认当前账号具有临时授权和用户目录查看权限。',
        )}
        extra={
          <Button onClick={() => void grantsQuery.refetch()}>重新加载</Button>
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
            <Clock3 className="size-4 text-[#4171d8]" />
            临时授权
          </Typography.Text>
          <Typography.Paragraph className="access-control-section-description">
            仅用于有原因、有时间窗、可审计的最小例外。普通授权最长 7
            天；高敏感权限最长 24 小时且必须由独立启用账号复核。
          </Typography.Paragraph>
        </div>
        <div className="access-control-catalog-toolbar">
          <Select
            allowClear
            className="access-control-catalog-toolbar__compact-select"
            placeholder="全部状态"
            value={status}
            options={(
              [
                'PENDING_REVIEW',
                'ACTIVE',
                'REJECTED',
                'REVOKED',
                'EXPIRED',
              ] as TemporaryGrantStatus[]
            ).map((value) => ({
              value,
              label: <StatusTag status={value} />,
            }))}
            onChange={setStatus}
          />
          {canManage && (
            <Button
              type="primary"
              icon={<Plus className="size-4" />}
              onClick={openCreate}
            >
              新建临时授权
            </Button>
          )}
        </div>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={grants}
        scroll={tableScroll(1090)}
        pagination={tablePagination()}
        locale={{
          emptyText: (
            <Empty
              description="暂无临时授权"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
      />

      <CommandDrawer command={command} onClose={() => setCommand(null)} />

      <Drawer
        className="management-form-drawer access-control-form-drawer access-control-temporary-grant-drawer"
        destroyOnHidden
        size={520}
        open={createOpen}
        title={
          <AccessControlDrawerHeading
            title="新建临时授权"
            subtitle="菜单与权限 / 临时例外"
          />
        }
        onClose={() => setCreateOpen(false)}
        footer={
          <div className="flex justify-end gap-3">
            <Button onClick={() => setCreateOpen(false)}>取消</Button>
            <Button
              type="primary"
              loading={createMutation.isPending}
              onClick={() =>
                void form
                  .validateFields()
                  .then((values) => createMutation.mutate(values))
              }
            >
              创建授权
            </Button>
          </div>
        }
      >
        <TemporaryGrantForm
          form={form}
          users={users}
          permissions={permissions}
        />
      </Drawer>

      <Drawer
        className="management-form-drawer access-control-form-drawer access-control-temporary-grant-drawer"
        destroyOnHidden
        size={440}
        open={Boolean(revokeTarget)}
        title={
          <AccessControlDrawerHeading
            title="撤销临时授权"
            subtitle="菜单与权限 / 临时例外"
          />
        }
        onClose={() => setRevokeTarget(undefined)}
        footer={
          <div className="flex justify-end gap-3">
            <Button onClick={() => setRevokeTarget(undefined)}>取消</Button>
            <Button
              danger
              type="primary"
              loading={revokeMutation.isPending}
              onClick={() =>
                void revokeForm
                  .validateFields()
                  .then((values) => revokeMutation.mutate(values))
              }
            >
              确认撤销
            </Button>
          </div>
        }
      >
        <Form
          className="form-section-stack access-control-temporary-grant-form"
          colon={false}
          form={revokeForm}
          labelAlign="left"
          labelCol={{ flex: '96px' }}
          layout="horizontal"
          requiredMark
          wrapperCol={{ flex: '1 1 0' }}
        >
          <FormSection
            icon={<Undo2 className="size-4" />}
            title="撤销确认"
            tone="amber"
          >
            {revokeTarget ? (
              <Alert
                className="!mb-4"
                description={
                  revokeTarget.permissionName +
                  ' 将立即失效；撤销原因和时间会保留在审计记录中。'
                }
                showIcon
                type="warning"
              />
            ) : null}
            <Form.Item
              className="access-control-form-item--multiline"
              name="reason"
              label="撤销原因"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: '请填写撤销原因。',
                },
              ]}
            >
              <Input.TextArea
                autoSize={{ minRows: 3, maxRows: 5 }}
                maxLength={500}
              />
            </Form.Item>
          </FormSection>
        </Form>
      </Drawer>
    </Card>
  )
}

function TemporaryGrantForm({
  form,
  users,
  permissions,
}: {
  form: FormInstance<GrantFormValues>
  users: UserAccount[]
  permissions: PermissionItem[]
}) {
  const permissionCode = Form.useWatch('permissionCode', form)
  const dataScope = Form.useWatch('dataScope', form)
  const selectedPermission = permissions.find(
    (permission) => permission.code === permissionCode,
  )
  const namedScope = [
    'NAMED_ORG_UNITS',
    'NAMED_PROJECTS',
    'NAMED_OBJECTS',
  ].includes(dataScope ?? '')
  const enabledUsers = useMemo(
    () => users.filter((user) => user.accountStatus === 'ENABLED'),
    [users],
  )
  const userOptions = enabledUsers.map((user) => ({
    value: user.id,
    label: user.displayName + ' · ' + user.loginName,
  }))

  return (
    <Form
      className="form-section-stack access-control-temporary-grant-form"
      colon={false}
      form={form}
      labelAlign="left"
      labelCol={{ flex: '112px' }}
      layout="horizontal"
      requiredMark
      wrapperCol={{ flex: '1 1 0' }}
    >
      <FormSection icon={<Clock3 className="size-4" />} title="授权对象与权限">
        <Form.Item
          name="recipientAccountId"
          label="受授人"
          rules={[{ required: true, message: '请选择启用账号。' }]}
        >
          <Select showSearch optionFilterProp="label" options={userOptions} />
        </Form.Item>
        <Form.Item
          name="permissionCode"
          label="权限项"
          rules={[{ required: true, message: '请选择权限项。' }]}
        >
          <Select
            optionFilterProp="label"
            options={permissions
              .filter((permission) => permission.status === 'ENABLED')
              .map((permission) => ({
                value: permission.code,
                label:
                  permission.name +
                  ' · ' +
                  permission.code +
                  (permission.riskLevel === 'HIGH' ? '（高敏感）' : ''),
              }))}
            showSearch
          />
        </Form.Item>
        {selectedPermission?.riskLevel === 'HIGH' ? (
          <Alert
            className="!mb-4"
            description="当前权限为高敏感：时间窗不得超过 24 小时，须由具备复核权且与申请人、受授人不同的人实际批准，填写姓名不会直接生效。"
            showIcon
            type="warning"
          />
        ) : null}
      </FormSection>

      <FormSection
        icon={<Clock3 className="size-4" />}
        title="最小数据范围"
        tone="violet"
      >
        <Form.Item
          name="dataScope"
          label="最小数据范围"
          rules={[{ required: true, message: '请选择最小数据范围。' }]}
        >
          <Select options={temporaryDataScopeOptions} />
        </Form.Item>
        <Form.Item
          name="scopeReferences"
          label="对象引用"
          rules={
            namedScope
              ? [
                  {
                    required: true,
                    whitespace: true,
                    message: '该范围必须指定对象引用。',
                  },
                ]
              : []
          }
        >
          <Input
            placeholder={namedScope ? '逗号分隔对象引用' : '此范围无需对象引用'}
            disabled={!namedScope}
          />
        </Form.Item>
      </FormSection>

      <FormSection
        icon={<Clock3 className="size-4" />}
        title="时间窗与审计"
        tone="amber"
      >
        <Form.Item
          name="startsAt"
          label="开始时间"
          rules={[{ required: true, message: '请选择开始时间。' }]}
        >
          <Input type="datetime-local" />
        </Form.Item>
        <Form.Item
          name="endsAt"
          label="结束时间"
          rules={[{ required: true, message: '请选择结束时间。' }]}
        >
          <Input type="datetime-local" />
        </Form.Item>
        <Form.Item
          name="reviewerAccountId"
          label="独立复核人"
          rules={
            selectedPermission?.riskLevel === 'HIGH'
              ? [{ required: true, message: '高敏感临时授权必须选择复核人。' }]
              : []
          }
        >
          <Select
            allowClear
            optionFilterProp="label"
            options={userOptions}
            placeholder={
              selectedPermission?.riskLevel === 'HIGH'
                ? '请选择独立复核人'
                : '常规授权可不填写'
            }
            showSearch
          />
        </Form.Item>
        <Form.Item
          className="access-control-form-item--multiline"
          name="reason"
          label="授权原因"
          rules={[
            {
              required: true,
              whitespace: true,
              message: '请填写临时授权原因。',
            },
          ]}
        >
          <Input.TextArea
            autoSize={{ minRows: 3, maxRows: 5 }}
            maxLength={1_000}
          />
        </Form.Item>
      </FormSection>
    </Form>
  )
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
