import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App as AntdApp,
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Result,
  Select,
  Spin,
  Table,
  Typography,
  type FormInstance,
  type TableColumnsType,
} from 'antd'
import {
  Info,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import { getProblemMessage } from '@/api/client/http'
import { getAccessControlCapabilities } from './access-control-api'
import {
  changeRoleStatus,
  createRole,
  getPermissionItems,
  getRoleImpact,
  getRoles,
  updateRole,
} from '@/features/menu-permissions/access-control-api'
import { StatusTag } from '@/features/menu-permissions/access-control-display'
import {
  dataScopeOptions,
  labelForDataScope,
  labelForDimension,
  labelForRoleType,
} from '@/features/menu-permissions/access-control-options'
import type {
  AccessRole,
  AccessRoleStatus,
  AccessRoleType,
  DataScope,
  PermissionItem,
  RoleGrant,
  RoleGrantInput,
} from '@/features/menu-permissions/access-control-types'
import {
  preferredDataScopeForPermission,
  requiresScopeReferences,
  toRoleGrantInput,
  type RoleGrantDraft,
} from '@/features/menu-permissions/role-grant-policy'
import {
  AccessControlDrawerHeading,
  FormSection,
} from '@/shared/ui/form-drawer'
import { tablePagination, tableScroll } from '@/shared/ui/table-pagination'

type RoleFormValues = {
  code: string
  name: string
  roleType: AccessRoleType
  responsibilitySummary: string
  status: AccessRoleStatus
  delegationLevel: number
  reason?: string
  grants: RoleGrantDraft[]
}

type DrawerState =
  | { mode: 'create' }
  | {
      mode: 'edit'
      role: AccessRole
      addGrant?: boolean
      removeGrantId?: string
    }
  | undefined

const emptyRoles: AccessRole[] = []
const emptyPermissionItems: PermissionItem[] = []

export function RoleCatalog() {
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const capabilities = useQuery({
    queryKey: ['access-control', 'capabilities'],
    queryFn: ({ signal }) => getAccessControlCapabilities(signal),
  })
  const canManage = capabilities.data?.includes('IAM_ROLE_MANAGE') ?? false

  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<AccessRoleStatus>()
  const [selectedRoleId, setSelectedRoleId] = useState<string>()
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>()
  const [matrixKeyword, setMatrixKeyword] = useState('')
  const [matrixScope, setMatrixScope] = useState<DataScope>()
  const [drawerState, setDrawerState] = useState<DrawerState>()
  const [form] = Form.useForm<RoleFormValues>()
  const rolesQuery = useQuery({
    queryKey: ['access-control', 'roles', status, keyword],
    queryFn: ({ signal }) => getRoles({ status, keyword }, signal),
  })
  const permissionsQuery = useQuery({
    queryKey: ['access-control', 'permission-items'],
    queryFn: ({ signal }) => getPermissionItems(signal),
  })
  const roles = rolesQuery.data ?? emptyRoles
  const selectedRole =
    roles.find((role) => role.id === selectedRoleId) ?? roles[0]
  const selectedGrant =
    selectedGrantId === null
      ? undefined
      : (selectedRole?.grants.find((grant) => grant.id === selectedGrantId) ??
        selectedRole?.grants[0])
  const filteredGrants = useMemo(() => {
    if (!selectedRole) return []

    const normalizedKeyword = matrixKeyword.trim().toLocaleLowerCase()
    return selectedRole.grants.filter((grant) => {
      const matchesKeyword =
        !normalizedKeyword ||
        [grant.permissionName, grant.permissionCode, grant.actionKey]
          .filter(Boolean)
          .some((value) =>
            value.toLocaleLowerCase().includes(normalizedKeyword),
          )
      const matchesScope = !matrixScope || grant.dataScope === matrixScope
      return matchesKeyword && matchesScope
    })
  }, [matrixKeyword, matrixScope, selectedRole])
  const impactQuery = useQuery({
    queryKey: ['access-control', 'role-impact', selectedRole?.id],
    queryFn: ({ signal }) => getRoleImpact(selectedRole!.id, signal),
    enabled: Boolean(selectedRole),
  })

  useEffect(() => {
    if (!drawerState) return

    form.resetFields()
    if (drawerState.mode === 'create') {
      form.setFieldsValue({
        code: '',
        name: '',
        roleType: 'SYSTEM',
        responsibilitySummary: '',
        status: 'DRAFT',
        delegationLevel: 0,
        reason: '',
        grants: [],
      })
      return
    }

    const role = drawerState.role
    form.setFieldsValue({
      code: role.code,
      name: role.name,
      roleType: role.roleType,
      responsibilitySummary: role.responsibilitySummary,
      status: role.status,
      delegationLevel: role.delegationLevel,
      reason: '',
      grants: [
        ...role.grants
          .filter((grant) => grant.id !== drawerState.removeGrantId)
          .map((grant) => ({
            permissionCode: grant.permissionCode,
            dataScope: grant.dataScope,
            scopeReferences: grant.scopeReferences ?? undefined,
            conditionSummary: grant.conditionSummary ?? undefined,
          })),
        ...(drawerState.addGrant
          ? [
              {
                dataScope: 'ALL_ORGANIZATION' as const,
              },
            ]
          : []),
      ],
    })
  }, [drawerState, form])

  const saveMutation = useMutation({
    mutationFn: async (values: RoleFormValues) => {
      const grants = toRoleGrantInputs(
        values.grants,
        permissionsQuery.data ?? emptyPermissionItems,
      )
      if (drawerState?.mode === 'create') {
        return createRole({
          code: values.code.trim(),
          name: values.name.trim(),
          roleType: values.roleType,
          responsibilitySummary: values.responsibilitySummary.trim(),
          status: values.status,
          delegationLevel: values.delegationLevel,
          grants,
        })
      }
      if (!drawerState || drawerState.mode !== 'edit') {
        throw new Error('未找到待保存的角色。')
      }
      const original = drawerState.role
      const reason = values.reason?.trim()
      let current = original
      if (values.status !== original.status && values.status !== 'ENABLED') {
        if (!reason) throw new Error('调整角色状态时必须填写原因。')
        current = await changeRoleStatus(original.id, {
          status: values.status,
          reason,
          version: original.version,
        })
      }
      current = await updateRole(original.id, {
        name: values.name.trim(),
        responsibilitySummary: values.responsibilitySummary.trim(),
        delegationLevel: values.delegationLevel,
        version: current.version,
        grants,
      })
      if (values.status !== current.status) {
        if (!reason) throw new Error('调整角色状态时必须填写原因。')
        current = await changeRoleStatus(current.id, {
          status: values.status,
          reason,
          version: current.version,
        })
      }
      return current
    },
    onSuccess: async (saved) => {
      message.success('角色与权限矩阵已保存。')
      setSelectedRoleId(saved.id)
      setDrawerState(undefined)
      await queryClient.invalidateQueries({
        queryKey: ['access-control', 'roles'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['access-control', 'role-impact'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['access-control', 'navigation'],
      })
    },
    onError: (error) => {
      message.error(getProblemMessage(error, '角色保存未完成，请检查后重试。'))
    },
  })

  function openCreate() {
    setDrawerState({ mode: 'create' })
  }

  function openEdit(
    role: AccessRole,
    options: { addGrant?: boolean; removeGrantId?: string } = {},
  ) {
    setSelectedRoleId(role.id)
    setSelectedGrantId(undefined)
    setDrawerState({ mode: 'edit', role, ...options })
  }

  const grantColumns: TableColumnsType<RoleGrant> = [
    {
      title: (
        <span>
          权限项
          <br />
          <span className="font-normal text-[#8290a7]">编码</span>
        </span>
      ),
      dataIndex: 'permissionName',
      width: 260,
      render: (name: string, grant) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-[#35455f]">{name}</div>
          <Typography.Text code className="!text-xs">
            {grant.permissionCode}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: '权限维度',
      width: 146,
      render: (_, grant) => (
        <div className="min-w-0">
          <div className="text-sm text-[#4f607a]">
            {labelForDimension(grant.dimension)}
          </div>
        </div>
      ),
    },
    {
      title: '数据范围',
      dataIndex: 'dataScope',
      width: 132,
      render: (value: DataScope) => (
        <span className="access-control-grant-scope">
          {labelForDataScope(value)}
        </span>
      ),
    },
    {
      title: '对象引用 / 条件',
      width: 230,
      ellipsis: true,
      render: (_, grant) =>
        grant.scopeReferences || grant.conditionSummary || '—',
    },
    {
      title: '影响用户数',
      width: 112,
      render: () => `${impactQuery.data?.activeAssignmentCount ?? 0} 人`,
    },
    {
      title: '操作',
      width: 94,
      align: 'right',
      render: (_, grant) => (
        <div className="flex justify-end gap-1">
          <Button
            disabled={!canManage}
            aria-label={`编辑授权 ${grant.permissionName}`}
            icon={<Pencil className="size-4" />}
            size="small"
            type="text"
            onClick={() => selectedRole && openEdit(selectedRole)}
          />
          <Popconfirm
            cancelText="取消"
            description="将先在完整矩阵草稿中移除该权限，保存后才会生效。"
            okText="打开草稿"
            title={`移除“${grant.permissionName}”授权？`}
            onConfirm={() =>
              selectedRole &&
              openEdit(selectedRole, { removeGrantId: grant.id })
            }
          >
            <Button
              disabled={!canManage}
              aria-label={`移除授权 ${grant.permissionName}`}
              danger
              icon={<Trash2 className="size-4" />}
              size="small"
              type="text"
            />
          </Popconfirm>
        </div>
      ),
    },
  ]

  if (rolesQuery.isPending || permissionsQuery.isPending) {
    return <LoadingCard text="正在读取角色与权限矩阵…" />
  }

  if (rolesQuery.isError || permissionsQuery.isError) {
    const error = rolesQuery.error ?? permissionsQuery.error
    return (
      <Result
        status="error"
        title="无法读取角色与权限矩阵"
        subTitle={getProblemMessage(error, '请确认当前账号具有角色查看权限。')}
        extra={
          <Button onClick={() => void rolesQuery.refetch()}>重新加载</Button>
        }
      />
    )
  }

  return (
    <div className="access-control-role-workbench">
      <Card
        className="access-control-surface access-control-role-catalog"
        styles={{ body: { padding: 0 } }}
      >
        <div className="access-control-role-catalog__create">
          <Button
            block
            type="primary"
            icon={<Plus className="size-4" />}
            disabled={!canManage}
            onClick={openCreate}
          >
            新建角色
          </Button>
        </div>
        <div className="access-control-role-catalog__filters">
          <Input
            allowClear
            prefix={<Search className="size-4 text-[#90a0b7]" />}
            placeholder="搜索角色名称或编码"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
        <div className="access-control-role-catalog__list">
          {roles.length ? (
            roles.map((role) => (
              <button
                type="button"
                className={
                  'access-control-role-option' +
                  (role.id === selectedRole?.id
                    ? ' access-control-role-option--selected'
                    : '')
                }
                key={role.id}
                onClick={() => {
                  setSelectedRoleId(role.id)
                  setSelectedGrantId(undefined)
                }}
              >
                <span className="access-control-role-option__icon">
                  <ShieldCheck className="size-4" />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-semibold text-[#33445e]">
                    {role.name}
                  </span>
                  <span className="mt-1 block truncate text-xs text-[#78869b]">
                    {role.grants.length} 个权限
                  </span>
                </span>
              </button>
            ))
          ) : (
            <Empty
              className="!my-10"
              description="没有符合条件的角色"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </div>
        <div className="access-control-role-catalog__footer">
          共 {roles.length} 个角色
        </div>
      </Card>

      <Card
        className="access-control-surface access-control-surface--table access-control-role-matrix"
        styles={{ body: { padding: 0 } }}
      >
        {selectedRole ? (
          <>
            <div className="access-control-filter-bar access-control-filter-bar--matrix access-control-role-toolbar">
              <Input
                allowClear
                className="access-control-role-toolbar__search"
                prefix={<Search className="size-4 text-[#90a0b7]" />}
                placeholder="搜索权限项、编码或动作键"
                value={matrixKeyword}
                onChange={(event) => setMatrixKeyword(event.target.value)}
              />
              <Select
                allowClear
                className="access-control-role-toolbar__scope"
                placeholder="数据范围：全部"
                value={matrixScope}
                options={dataScopeOptions}
                onChange={setMatrixScope}
              />
              <Select
                allowClear
                className="access-control-role-toolbar__status"
                placeholder="状态：全部"
                value={status}
                options={(
                  ['DRAFT', 'ENABLED', 'DISABLED'] as AccessRoleStatus[]
                ).map((value) => ({
                  value,
                  label: <StatusTag status={value} />,
                }))}
                onChange={setStatus}
              />
              <Button
                icon={<Plus className="size-4" />}
                type="primary"
                disabled={!canManage}
                onClick={() => openEdit(selectedRole, { addGrant: true })}
              >
                新增授权
              </Button>
              <Button
                aria-label="筛选角色与矩阵"
                icon={<SlidersHorizontal className="size-4" />}
                size="small"
                type="text"
              />
            </div>
            <div className="access-control-selection-band access-control-selection-band--matrix">
              <div className="access-control-selection-band__primary">
                <Info className="size-5 shrink-0 text-[#5d78ab]" />
                <span>
                  {selectedGrant
                    ? '已选择 1 条授权'
                    : '当前角色：' + selectedRole.name}
                </span>
              </div>
              <div className="access-control-selection-band__actions">
                <Button
                  size="small"
                  type="link"
                  onClick={() =>
                    navigate('/system/access-control/permission-items')
                  }
                >
                  查看权限项
                </Button>
                <Button
                  size="small"
                  type="link"
                  disabled={!canManage}
                  onClick={() => openEdit(selectedRole)}
                >
                  编辑授权
                </Button>
                {selectedGrant ? (
                  <Button
                    aria-label="取消授权条目选择"
                    icon={<X className="size-3.5" />}
                    size="small"
                    type="text"
                    onClick={() => setSelectedGrantId(undefined)}
                  />
                ) : null}
              </div>
            </div>
            <div className="access-control-role-matrix__context">
              <Typography.Text>当前角色：</Typography.Text>
              <Typography.Text className="!font-semibold !text-[#34445e]">
                {selectedRole.name}
              </Typography.Text>
              <Typography.Text>
                {selectedRole.responsibilitySummary}
              </Typography.Text>
            </div>
            <div className="access-control-table-frame access-control-table-frame--flush">
              <Table
                rowKey="id"
                columns={grantColumns}
                dataSource={filteredGrants}
                scroll={tableScroll(1_060)}
                pagination={tablePagination()}
                rowSelection={{
                  selectedRowKeys: selectedGrant ? [selectedGrant.id] : [],
                  onChange: (keys) => {
                    const selected = String(keys.at(-1) ?? '')
                    setSelectedGrantId(selected || null)
                  },
                }}
                onRow={(grant) => ({
                  onClick: () => setSelectedGrantId(grant.id),
                  className:
                    grant.id === selectedGrant?.id ? 'bg-[#eef4ff]' : undefined,
                })}
              />
            </div>
          </>
        ) : (
          <Empty
            className="!my-24"
            description="请先创建或选择一个角色"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Card>

      <aside
        className="access-control-role-summary"
        aria-label="角色影响与摘要"
      >
        {selectedRole ? (
          <div className="access-control-role-summary__content">
            <div className="access-control-role-summary__heading">
              <Typography.Text className="access-control-context-kicker">
                当前角色
              </Typography.Text>
              <div className="access-control-role-summary__role-name">
                <ShieldCheck className="size-5 shrink-0" />
                <Typography.Text>{selectedRole.name}</Typography.Text>
              </div>
            </div>
            <div className="access-control-role-summary__description">
              <div className="flex items-center justify-between gap-3">
                <Typography.Text className="access-control-context-kicker">
                  角色描述
                </Typography.Text>
                <Button
                  disabled={!canManage}
                  aria-label="编辑角色与矩阵"
                  icon={<Pencil className="size-4" />}
                  size="small"
                  type="text"
                  onClick={() => openEdit(selectedRole)}
                />
              </div>
              <Typography.Paragraph className="access-control-role-summary__description-copy">
                {selectedRole.responsibilitySummary}
              </Typography.Paragraph>
            </div>
            <section className="access-control-role-summary__statistics">
              <Typography.Text className="access-control-context-kicker">
                统计信息
              </Typography.Text>
              <dl className="access-control-role-summary__metrics">
                <Metric
                  label="权限项授权数"
                  value={impactQuery.data?.permissionGrantCount}
                />
                <Metric
                  label="已分配用户数"
                  value={impactQuery.data?.activeAssignmentCount}
                />
              </dl>
            </section>
            <div className="access-control-role-summary__next-step">
              <Typography.Text className="access-control-context-kicker">
                后续操作
              </Typography.Text>
              <div className="access-control-role-summary__next-step-title">
                <UsersRound className="size-5" />
                <Typography.Text>将系统角色分配给用户</Typography.Text>
              </div>
              <Typography.Paragraph className="access-control-role-summary__next-step-copy">
                把当前角色分配给启用用户，使其获得这些权限与数据范围。
              </Typography.Paragraph>
              <Button
                block
                type="primary"
                disabled={
                  !capabilities.data?.includes(
                    'IAM_SYSTEM_ROLE_ASSIGNMENT_MANAGE',
                  )
                }
                onClick={() => navigate('/system/access-control/assignments')}
              >
                分配系统角色
              </Button>
            </div>
            <div className="access-control-role-summary__created">
              <Typography.Text className="access-control-context-kicker">
                创建信息
              </Typography.Text>
              <Typography.Text>由系统管理员维护</Typography.Text>
            </div>
          </div>
        ) : (
          <Empty
            description="尚未创建角色"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </aside>

      <Drawer
        className="management-form-drawer access-control-form-drawer access-control-role-drawer"
        destroyOnHidden
        size={520}
        open={Boolean(drawerState)}
        title={
          <AccessControlDrawerHeading
            title={drawerState?.mode === 'create' ? '新建角色' : '编辑角色'}
            subtitle="菜单与权限 / 角色与矩阵"
          />
        }
        onClose={() => setDrawerState(undefined)}
        footer={
          <div className="flex justify-end gap-3">
            <Button onClick={() => setDrawerState(undefined)}>取消</Button>
            <Button
              type="primary"
              loading={saveMutation.isPending}
              onClick={() =>
                void form
                  .validateFields()
                  .then((values) => saveMutation.mutate(values))
              }
            >
              {drawerState?.mode === 'create' ? '创建角色' : '保存角色'}
            </Button>
          </div>
        }
      >
        <RoleForm
          form={form}
          permissions={permissionsQuery.data ?? emptyPermissionItems}
          drawerState={drawerState}
        />
      </Drawer>
    </div>
  )
}

function RoleForm({
  form,
  permissions,
  drawerState,
}: {
  form: FormInstance<RoleFormValues>
  permissions: PermissionItem[]
  drawerState: DrawerState
}) {
  const permissionOptions = permissions
    .filter((permission) => permission.status === 'ENABLED')
    .map((permission) => ({
      value: permission.code,
      label: permission.name + ' · ' + permission.code,
    }))

  return (
    <Form
      className="form-section-stack access-control-role-form"
      colon={false}
      form={form}
      labelAlign="left"
      labelCol={{ flex: '112px' }}
      layout="horizontal"
      requiredMark
      scrollToFirstError={{ behavior: 'smooth', block: 'center', focus: true }}
      wrapperCol={{ flex: '1 1 0' }}
    >
      {drawerState?.mode === 'edit' && drawerState.addGrant ? (
        <div className="access-control-grant-draft-notice">
          已新增一条待配置授权。选择权限项后，系统会按最小权限规则校验数据范围；点击“保存角色”后才生效。
        </div>
      ) : null}
      {drawerState?.mode === 'edit' && drawerState.removeGrantId ? (
        <div className="access-control-grant-draft-notice access-control-grant-draft-notice--warning">
          已在草稿中移除一条授权。你可以继续检查矩阵；点击“保存角色”后才会正式生效。
        </div>
      ) : null}
      <FormSection icon={<ShieldCheck className="size-4" />} title="角色定义">
        <Form.Item
          name="name"
          label="角色名称"
          rules={[{ required: true, message: '请输入角色名称。' }]}
        >
          <Input maxLength={120} placeholder="例如：项目交付负责人" />
        </Form.Item>
        <Form.Item
          name="code"
          label="稳定角色编码"
          rules={[{ required: true, message: '请输入角色编码。' }]}
        >
          <Input
            disabled={drawerState?.mode === 'edit'}
            maxLength={120}
            placeholder="例如：PROJECT_DELIVERY_OWNER"
          />
        </Form.Item>
        <Form.Item
          name="roleType"
          label="角色类型"
          rules={[{ required: true, message: '请选择角色类型。' }]}
        >
          <Select
            disabled={drawerState?.mode === 'edit'}
            options={(['SYSTEM', 'PROJECT', 'STAGE'] as AccessRoleType[]).map(
              (value) => ({
                value,
                label: labelForRoleType(value),
              }),
            )}
          />
        </Form.Item>
        <Form.Item
          name="delegationLevel"
          label="可下放层级"
          rules={[{ required: true, message: '请输入可下放层级。' }]}
        >
          <InputNumber className="w-full" min={0} precision={0} />
        </Form.Item>
        <Form.Item
          className="access-control-form-item--multiline"
          name="responsibilitySummary"
          label="职责说明"
          rules={[{ required: true, message: '请输入职责说明。' }]}
        >
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 4 }}
            maxLength={1_000}
            showCount
          />
        </Form.Item>
        <Form.Item
          name="status"
          label="状态"
          rules={[{ required: true, message: '请选择状态。' }]}
        >
          <Select
            options={(
              ['DRAFT', 'ENABLED', 'DISABLED'] as AccessRoleStatus[]
            ).map((value) => ({
              value,
              label: <StatusTag status={value} />,
            }))}
          />
        </Form.Item>
        {drawerState?.mode === 'edit' ? (
          <Form.Item
            className="access-control-form-item--multiline"
            name="reason"
            label="状态调整原因"
            extra="角色状态发生变化时必填，并会写入审计。"
          >
            <Input.TextArea
              autoSize={{ minRows: 2, maxRows: 3 }}
              maxLength={500}
            />
          </Form.Item>
        ) : null}
      </FormSection>

      <FormSection
        icon={<ShieldCheck className="size-4" />}
        tone="violet"
        title="权限矩阵"
      >
        <div className="mb-3">
          <div>
            <Typography.Text className="!font-semibold !text-[#34445e]">
              最小权限配置
            </Typography.Text>
            <Typography.Paragraph className="!mt-1 !mb-0 !text-xs !leading-5 !text-[#7a879b]">
              仅能下放已注册、且当前操作者拥有可下放能力的权限项。
            </Typography.Paragraph>
          </div>
        </div>
        <Form.List name="grants">
          {(fields, { add, remove }) => (
            <div className="access-control-grant-editor">
              {fields.length ? (
                fields.map((field, index) => (
                  <RoleGrantEditorRow
                    field={field}
                    form={form}
                    index={index}
                    key={field.key}
                    permissionOptions={permissionOptions}
                    permissions={permissions}
                    onRemove={() => remove(field.name)}
                  />
                ))
              ) : (
                <div className="access-control-grant-editor__empty">
                  尚未添加权限条目。你可以先保存角色草稿，或直接添加第一条授权。
                </div>
              )}
              <Button
                block
                type="dashed"
                icon={<Plus className="size-4" />}
                onClick={() =>
                  add({
                    dataScope: 'ALL_ORGANIZATION',
                  } satisfies Partial<RoleGrantDraft>)
                }
              >
                添加权限条目
              </Button>
              <Typography.Text className="access-control-grant-editor__help">
                保存时会将整张矩阵作为一个版本提交；命名范围才需要填写对象引用。
              </Typography.Text>
            </div>
          )}
        </Form.List>
      </FormSection>
    </Form>
  )
}

function RoleGrantEditorRow({
  field,
  form,
  index,
  permissions,
  permissionOptions,
  onRemove,
}: {
  field: { key: number; name: number }
  form: FormInstance<RoleFormValues>
  index: number
  permissions: PermissionItem[]
  permissionOptions: Array<{ value: string; label: string }>
  onRemove: () => void
}) {
  const permissionCode = Form.useWatch(
    ['grants', field.name, 'permissionCode'],
    form,
  )
  const dataScope = Form.useWatch(['grants', field.name, 'dataScope'], form)
  const permission = permissions.find(
    (candidate) => candidate.code === permissionCode,
  )
  const isMenuVisibilityPermission = permission?.dimension === 'MENU'
  const effectiveScope = dataScope
    ? preferredDataScopeForPermission(permission, dataScope)
    : undefined
  const needsReferences = requiresScopeReferences(effectiveScope)

  function setPermission(permissionCode: string) {
    const nextPermission = permissions.find(
      (candidate) => candidate.code === permissionCode,
    )
    if (nextPermission?.dimension !== 'MENU') return

    form.setFieldValue(['grants', field.name, 'dataScope'], 'ALL_ORGANIZATION')
    form.setFieldValue(['grants', field.name, 'scopeReferences'], undefined)
  }

  function setDataScope(nextScope: DataScope) {
    if (requiresScopeReferences(nextScope)) return
    form.setFieldValue(['grants', field.name, 'scopeReferences'], undefined)
  }

  return (
    <article className="access-control-grant-editor__item">
      <header className="access-control-grant-editor__item-header">
        <span className="access-control-grant-index">{index + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[#394a65]">
            授权条目 {String(index + 1).padStart(2, '0')}
          </span>
          <span className="mt-0.5 block truncate text-xs text-[#7a879b]">
            {permission?.name ?? '先选择权限项，再确定最小数据范围'}
          </span>
        </span>
        <Button
          danger
          size="small"
          type="text"
          icon={<Trash2 className="size-3.5" />}
          aria-label={'移除授权条目 ' + (index + 1)}
          onClick={onRemove}
        />
      </header>
      <div className="access-control-grant-editor__fields">
        <Form.Item
          className="access-control-grant-editor__field"
          label="权限项"
          labelCol={{ flex: '96px' }}
          name={[field.name, 'permissionCode']}
          rules={[{ required: true, message: '请选择权限项。' }]}
          wrapperCol={{ flex: '1 1 0' }}
        >
          <Select
            showSearch
            optionFilterProp="label"
            options={permissionOptions}
            placeholder="选择权限项"
            onChange={setPermission}
          />
        </Form.Item>
        <Form.Item
          className="access-control-grant-editor__field"
          label="数据范围"
          labelCol={{ flex: '96px' }}
          name={[field.name, 'dataScope']}
          rules={[{ required: true, message: '请选择数据范围。' }]}
          wrapperCol={{ flex: '1 1 0' }}
        >
          <Select
            disabled={isMenuVisibilityPermission}
            options={
              isMenuVisibilityPermission
                ? dataScopeOptions.filter(
                    (option) => option.value === 'ALL_ORGANIZATION',
                  )
                : dataScopeOptions
            }
            onChange={setDataScope}
          />
        </Form.Item>
        {isMenuVisibilityPermission ? (
          <div className="access-control-grant-editor__rule">
            菜单可见权限固定使用“全组织”范围，确保导航与服务端判断保持一致。
          </div>
        ) : null}
        {needsReferences ? (
          <Form.Item
            className="access-control-grant-editor__field access-control-grant-editor__field--multiline"
            extra="多个对象使用逗号分隔；命名组织和项目必须填写 UUID。"
            label="对象引用"
            labelCol={{ flex: '96px' }}
            name={[field.name, 'scopeReferences']}
            rules={[{ required: true, message: '请填写对象引用。' }]}
            wrapperCol={{ flex: '1 1 0' }}
          >
            <Input placeholder="例如：对象标识 1, 对象标识 2" />
          </Form.Item>
        ) : null}
        <Form.Item
          className="access-control-grant-editor__field access-control-grant-editor__field--multiline"
          label="附加条件"
          labelCol={{ flex: '96px' }}
          name={[field.name, 'conditionSummary']}
          wrapperCol={{ flex: '1 1 0' }}
        >
          <Input.TextArea
            autoSize={{ minRows: 1, maxRows: 2 }}
            maxLength={1_000}
            placeholder="可选，例如：仅在项目处于交付阶段时允许"
          />
        </Form.Item>
      </div>
    </article>
  )
}

function toRoleGrantInputs(
  grants: RoleGrantDraft[] | undefined,
  permissions: PermissionItem[],
): RoleGrantInput[] {
  return (grants ?? []).map((grant) =>
    toRoleGrantInput(
      grant,
      permissions.find(
        (permission) => permission.code === grant.permissionCode,
      ),
    ),
  )
}

function Metric({
  label,
  value,
}: {
  label: string
  value: number | undefined
}) {
  return (
    <div className="access-control-metric">
      <dt>{label}</dt>
      <dd>{value ?? '…'}</dd>
    </div>
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
