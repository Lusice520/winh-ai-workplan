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
  Popover,
  Result,
  Select,
  Spin,
  Table,
  Tooltip,
  Tree,
  Typography,
  type FormInstance,
  type TableColumnsType,
  type TreeDataNode,
} from 'antd'
import {
  FileCog,
  FileText,
  Folder,
  Info,
  ListTree,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { getProblemMessage } from '@/api/client/http'
import { getAccessControlCapabilities } from './access-control-api'
import {
  changeMenuResourceStatus,
  createMenuResource,
  getMenuResourceImpact,
  getMenuResources,
  moveMenuResource,
  updateMenuResource,
} from '@/features/menu-permissions/access-control-api'
import { StatusTag } from '@/features/menu-permissions/access-control-display'
import {
  actionKeyOptions,
  iconKeyOptions,
  labelForResourceType,
  routeKeyOptions,
} from '@/features/menu-permissions/access-control-options'
import { defaultParentIdForNewResource } from '@/features/menu-permissions/menu-resource-parent-default'
import type {
  MenuResource,
  MenuResourceImpact,
  MenuResourceStatus,
  MenuResourceType,
} from '@/features/menu-permissions/access-control-types'
import { FormSection } from '@/shared/ui/form-drawer'
import { tablePagination, tableScroll } from '@/shared/ui/table-pagination'

type MenuResourceFormValues = {
  code: string
  resourceType: MenuResourceType
  parentId?: string
  name: string
  routeKey?: string
  actionKey?: string
  iconKey?: string
  sortOrder: number
  status: MenuResourceStatus
  reason?: string
}

type DrawerState =
  | { mode: 'create'; initialValues: MenuResourceFormValues }
  | {
      mode: 'edit'
      resource: MenuResource
      initialValues: MenuResourceFormValues
    }
  | undefined

const emptyMenuResources: MenuResource[] = []

export function MenuResourceWorkspace() {
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const capabilities = useQuery({
    queryKey: ['access-control', 'capabilities'],
    queryFn: ({ signal }) => getAccessControlCapabilities(signal),
  })
  const canManage =
    capabilities.data?.includes('IAM_MENU_RESOURCE_MANAGE') ?? false

  const [query, setQuery] = useState('')
  const [resourceType, setResourceType] = useState<MenuResourceType>()
  const [resourceStatus, setResourceStatus] = useState<MenuResourceStatus>()
  const [selectedResourceId, setSelectedResourceId] = useState<string>()
  const [selectionDismissed, setSelectionDismissed] = useState(false)
  const [resourceTypeFilterOpen, setResourceTypeFilterOpen] = useState(false)
  const [drawerState, setDrawerState] = useState<DrawerState>()
  const [form] = Form.useForm<MenuResourceFormValues>()
  const resourcesQuery = useQuery({
    queryKey: ['access-control', 'menu-resources'],
    queryFn: ({ signal }) => getMenuResources(signal),
  })
  const resources = resourcesQuery.data ?? emptyMenuResources
  const selectedResource =
    resources.find((resource) => resource.id === selectedResourceId) ??
    (selectionDismissed ? undefined : resources[0])
  const impactQuery = useQuery({
    queryKey: ['access-control', 'menu-resource-impact', selectedResource?.id],
    queryFn: ({ signal }) =>
      getMenuResourceImpact(selectedResource!.id, signal),
    enabled: Boolean(selectedResource),
  })

  const filteredResources = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return resources.filter((resource) => {
      const matchesKeyword =
        !normalized ||
        [resource.name, resource.code, resource.routeKey, resource.actionKey]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase().includes(normalized))
      const matchesType =
        !resourceType || resource.resourceType === resourceType
      const matchesStatus =
        !resourceStatus || resource.status === resourceStatus
      return matchesKeyword && matchesType && matchesStatus
    })
  }, [query, resourceStatus, resourceType, resources])

  const treeData = useMemo(() => toTreeData(resources), [resources])

  useEffect(() => {
    if (!drawerState) return

    form.resetFields()
    form.setFieldsValue(drawerState.initialValues)
  }, [drawerState, form])

  const saveMutation = useMutation({
    mutationFn: async (values: MenuResourceFormValues) => {
      if (drawerState?.mode === 'create') {
        return createMenuResource({
          code: values.code.trim(),
          resourceType: values.resourceType,
          parentId: values.parentId,
          name: values.name.trim(),
          routeKey: values.routeKey,
          actionKey: values.actionKey,
          iconKey: values.iconKey,
          sortOrder: values.sortOrder ?? 0,
          status: values.status,
        })
      }

      if (!drawerState || drawerState.mode !== 'edit') {
        throw new Error('未找到待保存的菜单资源。')
      }

      const original = drawerState.resource
      const parentChanged = (values.parentId ?? null) !== original.parentId
      const reason = values.reason?.trim()
      if ((parentChanged || values.status !== original.status) && !reason) {
        throw new Error('调整层级或状态时必须填写调整原因。')
      }
      let saved = await updateMenuResource(original.id, {
        name: values.name.trim(),
        routeKey: values.routeKey,
        actionKey: values.actionKey,
        iconKey: values.iconKey,
        sortOrder: values.sortOrder ?? 0,
        version: original.version,
      })
      if (parentChanged) {
        if (!reason) {
          throw new Error('调整层级时必须填写调整原因。')
        }
        saved = await moveMenuResource(saved.id, {
          parentId: values.parentId,
          reason,
          version: saved.version,
        })
      }
      if (values.status !== saved.status) {
        if (!reason) {
          throw new Error('调整状态时必须填写调整原因。')
        }
        saved = await changeMenuResourceStatus(saved.id, {
          status: values.status,
          reason,
          version: saved.version,
        })
      }
      return saved
    },
    onSuccess: async (saved) => {
      message.success('菜单资源已保存。')
      setDrawerState(undefined)
      setSelectedResourceId(saved.id)
      await queryClient.invalidateQueries({
        queryKey: ['access-control', 'menu-resources'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['access-control', 'menu-resource-impact'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['access-control', 'navigation'],
      })
    },
    onError: (error) => {
      message.error(
        getProblemMessage(error, '菜单资源保存未完成，请检查后重试。'),
      )
    },
  })

  function openCreate(resourceType: MenuResourceType) {
    setDrawerState({
      mode: 'create',
      initialValues: {
        code: '',
        resourceType,
        parentId: defaultParentIdForNewResource(
          resources,
          selectedResource,
          resourceType,
        ),
        name: '',
        routeKey: undefined,
        actionKey: undefined,
        iconKey:
          resourceType === 'DIRECTORY'
            ? 'folder'
            : resourceType === 'OPERATION'
              ? 'workflow'
              : 'file',
        sortOrder: nextSortOrder(resources),
        status: 'ENABLED',
        reason: '',
      },
    })
  }

  function openContextualCreate() {
    openCreate(
      selectedResource?.resourceType === 'DIRECTORY'
        ? 'MENU_PAGE'
        : selectedResource?.resourceType === 'MENU_PAGE'
          ? 'OPERATION'
          : 'DIRECTORY',
    )
  }

  function openEdit(resource: MenuResource) {
    setSelectedResourceId(resource.id)
    setSelectionDismissed(false)
    setDrawerState({
      mode: 'edit',
      resource,
      initialValues: {
        code: resource.code,
        resourceType: resource.resourceType,
        parentId: resource.parentId ?? undefined,
        name: resource.name,
        routeKey: resource.routeKey ?? undefined,
        actionKey: resource.actionKey ?? undefined,
        iconKey: resource.iconKey ?? undefined,
        sortOrder: resource.sortOrder,
        status: resource.status,
        reason: '',
      },
    })
  }

  function selectResource(resourceId: string) {
    setSelectedResourceId(resourceId)
    setSelectionDismissed(false)
  }

  const columns: TableColumnsType<MenuResource> = [
    {
      title: '资源名称',
      dataIndex: 'name',
      width: 230,
      render: (name, resource) => (
        <button
          className="inline-flex items-center gap-2 text-left text-[#354660] hover:text-[#2f68d8]"
          type="button"
          onClick={() => selectResource(resource.id)}
        >
          {resource.resourceType === 'DIRECTORY' ? (
            <Folder className="size-4 text-[#6e83a2]" />
          ) : resource.resourceType === 'MENU_PAGE' ? (
            <FileText className="size-4 text-[#356bda]" />
          ) : (
            <FileCog className="size-4 text-[#61738e]" />
          )}
          <span className="font-semibold">{name}</span>
        </button>
      ),
    },
    {
      title: '资源编码',
      dataIndex: 'code',
      width: 220,
      render: (value: string) => (
        <span className="text-sm text-[#62779b]">{value}</span>
      ),
    },
    {
      title: '类型',
      dataIndex: 'resourceType',
      width: 120,
      render: (value: MenuResourceType) => labelForResourceType(value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      render: (value: MenuResourceStatus) => <StatusTag status={value} />,
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      width: 76,
      align: 'right',
    },
    {
      title: '操作',
      width: 96,
      align: 'right',
      render: (_, resource) => (
        <div className="flex justify-end gap-1">
          <Tooltip title="编辑资源">
            <Button
              disabled={!canManage}
              aria-label={`编辑 ${resource.name}`}
              icon={<Pencil className="size-4" />}
              size="small"
              type="text"
              onClick={(event) => {
                event.stopPropagation()
                openEdit(resource)
              }}
            />
          </Tooltip>
          <Popover
            content={
              <div className="flex min-w-28 flex-col items-stretch">
                <Button
                  size="small"
                  type="text"
                  onClick={() => openEdit(resource)}
                >
                  编辑资源
                </Button>
              </div>
            }
            trigger="click"
          >
            <Button
              disabled={!canManage}
              aria-label={`${resource.name} 的更多操作`}
              icon={<MoreVertical className="size-4" />}
              size="small"
              type="text"
              onClick={(event) => event.stopPropagation()}
            />
          </Popover>
        </div>
      ),
    },
  ]

  if (resourcesQuery.isPending) {
    return <LoadingCard text="正在读取菜单资源…" />
  }

  if (resourcesQuery.isError) {
    return (
      <Result
        status="error"
        title="无法读取菜单资源"
        subTitle={getProblemMessage(
          resourcesQuery.error,
          '请确认当前账号具有菜单资源查看权限。',
        )}
        extra={
          <Button onClick={() => void resourcesQuery.refetch()}>
            重新加载
          </Button>
        }
      />
    )
  }

  return (
    <div className="access-control-menu-grid">
      <Card
        className="access-control-surface access-control-tree-surface"
        styles={{ body: { padding: 0 } }}
      >
        <div className="access-control-tree-header access-control-tree-header--compact">
          <Typography.Text className="access-control-section-title">
            <ListTree className="size-4 text-[#4171d8]" />
            资源分类
          </Typography.Text>
          <div className="access-control-tree-actions">
            <Tooltip title="刷新资源目录">
              <Button
                aria-label="刷新资源目录"
                icon={<RefreshCw className="size-4" />}
                size="small"
                type="text"
                onClick={() => void resourcesQuery.refetch()}
              />
            </Tooltip>
            <Tooltip title="新建资源">
              <Button
                disabled={!canManage}
                aria-label="按当前层级新建资源"
                icon={<Plus className="size-4" />}
                size="small"
                type="primary"
                onClick={openContextualCreate}
              />
            </Tooltip>
          </div>
        </div>
        <div className="access-control-tree-body">
          {treeData.length === 0 ? (
            <Empty
              description="尚未注册菜单资源"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <Tree
              blockNode
              showIcon={false}
              defaultExpandAll
              selectedKeys={selectedResource ? [selectedResource.id] : []}
              treeData={treeData}
              onSelect={(keys) => {
                const selected = String(keys[0] ?? '')
                if (selected) selectResource(selected)
              }}
            />
          )}
        </div>
      </Card>

      <Card
        className="access-control-surface access-control-surface--table"
        styles={{ body: { padding: 0 } }}
      >
        <div className="access-control-selection-band">
          {selectedResource ? (
            <>
              <div className="access-control-selection-band__primary">
                <Info className="size-5 shrink-0 text-[#5d78ab]" />
                <span>已选择 1 项资源：</span>
                <strong>{selectedResource.name}</strong>
              </div>
              <div className="access-control-selection-band__actions">
                <Popover
                  content={
                    <ImpactSummary
                      impact={impactQuery.data}
                      loading={impactQuery.isPending}
                    />
                  }
                  title="资源影响"
                  trigger="click"
                >
                  <Button size="small" type="link">
                    查看详情
                  </Button>
                </Popover>
                <Button
                  icon={<Pencil className="size-3.5" />}
                  size="small"
                  type="link"
                  disabled={!canManage}
                  onClick={() => openEdit(selectedResource)}
                >
                  编辑
                </Button>
                <Button
                  aria-label="取消资源选择"
                  icon={<X className="size-3.5" />}
                  size="small"
                  type="text"
                  onClick={() => {
                    setSelectedResourceId(undefined)
                    setSelectionDismissed(true)
                  }}
                />
              </div>
            </>
          ) : (
            <Typography.Text className="!text-sm !text-[#77869a]">
              从左侧分类或表格中选择一个资源，查看影响并开始维护。
            </Typography.Text>
          )}
        </div>
        <div className="access-control-filter-bar access-control-filter-bar--catalog access-control-resource-toolbar">
          <Input
            allowClear
            className="access-control-resource-toolbar__search"
            prefix={<Search className="size-4 text-[#90a0b7]" />}
            placeholder="搜索资源名称、编码或路由键"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Select
            allowClear
            className="access-control-resource-toolbar__status"
            placeholder="状态：全部"
            value={resourceStatus}
            options={[
              { value: 'ENABLED', label: '启用' },
              { value: 'DISABLED', label: '停用' },
            ]}
            onChange={setResourceStatus}
          />
          <Button
            icon={<Plus className="size-4" />}
            type="primary"
            onClick={openContextualCreate}
          >
            新建资源
          </Button>
          <div className="access-control-resource-toolbar__meta">
            <Typography.Text>共 {filteredResources.length} 条</Typography.Text>
            <Popover
              open={resourceTypeFilterOpen}
              onOpenChange={setResourceTypeFilterOpen}
              content={
                <div className="access-control-resource-type-filter">
                  <Typography.Text className="!mb-2 !block !text-xs !font-semibold !text-[#52627c]">
                    资源类型
                  </Typography.Text>
                  <Select
                    allowClear
                    aria-label="筛选资源类型"
                    className="w-40"
                    placeholder="全部类型"
                    value={resourceType}
                    options={(
                      [
                        'DIRECTORY',
                        'MENU_PAGE',
                        'OPERATION',
                      ] as MenuResourceType[]
                    ).map((value) => ({
                      value,
                      label: labelForResourceType(value),
                    }))}
                    onChange={(nextValue) => {
                      setResourceType(nextValue)
                      setResourceTypeFilterOpen(false)
                    }}
                  />
                </div>
              }
              trigger="click"
            >
              <Button
                aria-label="筛选资源类型"
                icon={<SlidersHorizontal className="size-4" />}
                size="small"
                type="text"
                onClick={() => setResourceTypeFilterOpen(true)}
              />
            </Popover>
          </div>
        </div>
        <div className="access-control-table-frame access-control-table-frame--flush">
          <Table
            rowKey="id"
            size="middle"
            scroll={tableScroll(900)}
            pagination={tablePagination()}
            columns={columns}
            dataSource={filteredResources}
            rowSelection={{
              selectedRowKeys: selectedResource ? [selectedResource.id] : [],
              onChange: (keys) => {
                const selected = String(keys.at(-1) ?? '')
                if (selected) {
                  selectResource(selected)
                  return
                }
                setSelectedResourceId(undefined)
                setSelectionDismissed(true)
              },
            }}
            onRow={(resource) => ({
              onClick: () => selectResource(resource.id),
              className:
                resource.id === selectedResource?.id
                  ? 'bg-[#f5f8ff]'
                  : undefined,
            })}
          />
        </div>
      </Card>

      <Drawer
        className="management-form-drawer access-control-form-drawer access-control-menu-resource-drawer"
        destroyOnHidden
        open={Boolean(drawerState)}
        size={520}
        title={
          <div className="access-control-drawer-heading">
            <Typography.Text className="access-control-drawer-heading__crumb">
              菜单与权限 / 资源登记
            </Typography.Text>
            <Typography.Text className="access-control-drawer-heading__title">
              {drawerState?.mode === 'create' ? '新建菜单资源' : '编辑菜单资源'}
            </Typography.Text>
          </div>
        }
        onClose={() => setDrawerState(undefined)}
        footer={
          <div className="flex justify-end gap-3">
            <Button onClick={() => setDrawerState(undefined)}>取消</Button>
            <Button
              type="primary"
              loading={saveMutation.isPending}
              disabled={
                drawerState?.mode === 'edit' &&
                (impactQuery.isPending || impactQuery.isError)
              }
              onClick={() =>
                void form
                  .validateFields()
                  .then((values) => saveMutation.mutate(values))
              }
            >
              保存
            </Button>
          </div>
        }
      >
        {drawerState?.mode === 'edit' && (
          <FormSection icon={<Info className="size-4" />} title="变更影响">
            <ImpactSummary
              impact={impactQuery.data}
              loading={impactQuery.isPending}
            />
            {impactQuery.isError && (
              <Button onClick={() => void impactQuery.refetch()}>
                重新读取引用影响
              </Button>
            )}
          </FormSection>
        )}
        <MenuResourceForm
          form={form}
          resources={resources}
          drawerState={drawerState}
        />
      </Drawer>
    </div>
  )
}

function MenuResourceForm({
  form,
  resources,
  drawerState,
}: {
  form: FormInstance<MenuResourceFormValues>
  resources: MenuResource[]
  drawerState: DrawerState
}) {
  const resourceType = Form.useWatch('resourceType', form)
  const parentId = Form.useWatch('parentId', form)
  const status = Form.useWatch('status', form)
  const parentOptions = resources
    .filter((resource) =>
      resourceType === 'MENU_PAGE'
        ? resource.resourceType === 'DIRECTORY' && resource.status === 'ENABLED'
        : resourceType === 'OPERATION'
          ? resource.resourceType === 'MENU_PAGE' &&
            resource.status === 'ENABLED'
          : false,
    )
    .map((resource) => ({
      value: resource.id,
      label: resource.name + ' · ' + resource.code,
    }))
  const parentSelectionRequired = resourceType !== 'DIRECTORY'
  const changesNeedReason =
    drawerState?.mode === 'edit' &&
    (parentId !== (drawerState.resource.parentId ?? undefined) ||
      status !== drawerState.resource.status)

  return (
    <Form
      className="form-section-stack access-control-menu-resource-form"
      colon={false}
      form={form}
      labelAlign="left"
      labelCol={{ flex: '112px' }}
      layout="horizontal"
      requiredMark
      wrapperCol={{ flex: '1 1 0' }}
    >
      <FormSection icon={<ListTree className="size-4" />} title="资源定义">
        <Form.Item
          name="resourceType"
          label="资源类型"
          rules={[{ required: true, message: '请选择资源类型。' }]}
        >
          <Select
            disabled={drawerState?.mode === 'edit'}
            options={[
              { value: 'DIRECTORY', label: '目录' },
              { value: 'MENU_PAGE', label: '菜单页' },
              { value: 'OPERATION', label: '操作资源' },
            ]}
            onChange={(nextType: MenuResourceType) => {
              form.setFieldsValue({
                parentId: undefined,
                routeKey: undefined,
                actionKey: undefined,
                iconKey:
                  nextType === 'DIRECTORY'
                    ? 'folder'
                    : nextType === 'OPERATION'
                      ? 'workflow'
                      : 'file',
              })
            }}
          />
        </Form.Item>
        <Form.Item
          name="name"
          label="资源名称"
          rules={[{ required: true, message: '请输入资源名称。' }]}
        >
          <Input maxLength={120} placeholder="例如：菜单与权限" />
        </Form.Item>
        <Form.Item
          name="code"
          label="稳定资源编码"
          rules={[{ required: true, message: '请输入稳定资源编码。' }]}
        >
          <Input
            disabled={drawerState?.mode === 'edit'}
            maxLength={120}
            placeholder="例如：ACCESS_CONTROL"
          />
        </Form.Item>
        {drawerState?.mode === 'create' && parentSelectionRequired ? (
          <Form.Item
            name="parentId"
            label="上级资源"
            rules={[{ required: true, message: '请选择上级资源。' }]}
          >
            <Select
              allowClear
              options={parentOptions}
              placeholder={
                resourceType === 'MENU_PAGE' ? '选择目录资源' : '选择菜单页'
              }
            />
          </Form.Item>
        ) : null}
      </FormSection>

      <FormSection
        icon={<FileCog className="size-4" />}
        tone="violet"
        title="受控能力"
      >
        {resourceType === 'MENU_PAGE' ? (
          <Form.Item
            name="routeKey"
            label="受控 routeKey"
            extra="这里不接受任意 URL；正式系统只允许已注册的 routeKey 或动作键。"
            rules={[{ required: true, message: '请选择已实现路由。' }]}
          >
            <Select options={routeKeyOptions} placeholder="选择已实现页面" />
          </Form.Item>
        ) : null}
        {resourceType === 'OPERATION' ? (
          <Form.Item
            name="actionKey"
            label="受控动作键"
            extra="动作键必须来自已发布的受控能力注册表。"
            rules={[{ required: true, message: '请选择受控动作键。' }]}
          >
            <Select options={actionKeyOptions} placeholder="选择动作键" />
          </Form.Item>
        ) : null}
        <Form.Item name="iconKey" label="图标键">
          <Select
            allowClear
            options={iconKeyOptions}
            placeholder="选择已注册图标键"
          />
        </Form.Item>
        <Form.Item name="sortOrder" label="排序">
          <InputNumber
            className="access-control-menu-resource-form__sort-order"
            min={0}
            precision={0}
          />
        </Form.Item>
        <Form.Item
          name="status"
          label="状态"
          rules={[{ required: true, message: '请选择状态。' }]}
        >
          <Select
            options={[
              { value: 'ENABLED', label: '启用' },
              { value: 'DISABLED', label: '停用' },
            ]}
          />
        </Form.Item>
      </FormSection>

      <div className="access-control-next-step-note">
        <Info className="size-5 shrink-0" />
        <div>
          <Typography.Text>后续流程</Typography.Text>
          <Typography.Paragraph>
            保存资源后，在“权限项目录”登记可授权能力；角色矩阵只授予权限项与数据范围，不直接勾选菜单。
          </Typography.Paragraph>
        </div>
      </div>

      {changesNeedReason ? (
        <FormSection
          icon={<FileText className="size-4" />}
          title="变更说明"
          tone="amber"
        >
          <Form.Item
            className="access-control-form-item--multiline"
            name="reason"
            label="调整原因"
            extra="移动层级或停用资源时必填；该内容会写入审计。"
          >
            <Input.TextArea
              autoSize={{ minRows: 2, maxRows: 4 }}
              maxLength={500}
              placeholder="说明本次调整的原因"
            />
          </Form.Item>
        </FormSection>
      ) : null}
    </Form>
  )
}

function toTreeData(resources: MenuResource[]): TreeDataNode[] {
  const childrenByParent = new Map<string | null, MenuResource[]>()
  resources.forEach((resource) => {
    const siblings = childrenByParent.get(resource.parentId) ?? []
    siblings.push(resource)
    childrenByParent.set(resource.parentId, siblings)
  })
  const build = (parentId: string | null): TreeDataNode[] =>
    (childrenByParent.get(parentId) ?? [])
      .sort(
        (first, second) =>
          first.sortOrder - second.sortOrder ||
          first.name.localeCompare(second.name),
      )
      .map((resource) => ({
        key: resource.id,
        title: (
          <span
            className="access-control-tree-node-title"
            title={resource.name}
          >
            {resource.resourceType === 'DIRECTORY' ? (
              <Folder className="size-3.5 text-[#7185a3]" />
            ) : resource.resourceType === 'MENU_PAGE' ? (
              <FileText className="size-3.5 text-[#386fdd]" />
            ) : (
              <FileCog className="size-3.5 text-[#6a7d97]" />
            )}
            <span className="access-control-tree-node-title__label">
              {resource.name}
            </span>
          </span>
        ),
        children: build(resource.id),
      }))
  return build(null)
}

function nextSortOrder(resources: MenuResource[]) {
  return Math.max(0, ...resources.map((resource) => resource.sortOrder)) + 10
}

function ImpactSummary({
  impact,
  loading,
}: {
  impact?: MenuResourceImpact
  loading: boolean
}) {
  if (loading) {
    return <span className="text-xs text-[#71809a]">正在读取引用影响…</span>
  }

  if (!impact) {
    return (
      <span className="text-xs text-[#71809a]">暂时没有可用影响数据。</span>
    )
  }

  return (
    <dl className="access-control-impact-summary">
      <div>
        <dt>直接子资源</dt>
        <dd>{impact.directChildCount}</dd>
      </div>
      <div>
        <dt>关联权限项</dt>
        <dd>{impact.permissionItemCount}</dd>
      </div>
      <div>
        <dt>角色授权</dt>
        <dd>{impact.roleGrantCount}</dd>
      </div>
      <div>
        <dt>临时授权</dt>
        <dd>{impact.temporaryGrantCount}</dd>
      </div>
    </dl>
  )
}

function LoadingCard({ text }: { text: string }) {
  return (
    <Card className="access-control-surface">
      <div className="grid min-h-[300px] place-items-center">
        <Spin description={text} />
      </div>
    </Card>
  )
}
