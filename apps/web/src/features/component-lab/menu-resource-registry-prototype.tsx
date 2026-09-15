import {
  Alert,
  Button,
  ConfigProvider,
  Drawer,
  Input,
  Popover,
  Select,
  Table,
  Tooltip,
  Typography,
  type TableColumnsType,
} from 'antd'
import {
  Blocks,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileCog,
  FileText,
  Folder,
  Info,
  KeyRound,
  LayoutDashboard,
  ListTree,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

import { projectTheme } from '@/shared/theme/antd-theme'

type ResourceStatus = 'ENABLED' | 'DISABLED'
type ResourceKind = '目录' | '菜单页' | '操作资源'
type EditorMode = 'create' | 'edit' | undefined

type ResourceRecord = {
  key: string
  name: string
  code: string
  routeKey: string
  kind: ResourceKind
  status: ResourceStatus
  affectedRoles: number
  sortOrder: number
}

type ResourceDraft = Omit<ResourceRecord, 'key' | 'affectedRoles'>

const initialResources: ResourceRecord[] = [
  {
    key: 'system.overview',
    name: '工作台',
    code: 'SYSTEM_OVERVIEW',
    routeKey: 'system.overview',
    kind: '菜单页',
    status: 'ENABLED',
    affectedRoles: 5,
    sortOrder: 10,
  },
  {
    key: 'system.dashboard',
    name: '系统概览',
    code: 'SYSTEM_DASHBOARD',
    routeKey: 'system.dashboard',
    kind: '菜单页',
    status: 'ENABLED',
    affectedRoles: 5,
    sortOrder: 20,
  },
  {
    key: 'my.todo',
    name: '待办事项',
    code: 'MY_TODO',
    routeKey: 'my.todo',
    kind: '菜单页',
    status: 'ENABLED',
    affectedRoles: 4,
    sortOrder: 30,
  },
  {
    key: 'my.notifications',
    name: '消息通知',
    code: 'MY_NOTIFICATIONS',
    routeKey: 'my.notifications',
    kind: '菜单页',
    status: 'ENABLED',
    affectedRoles: 4,
    sortOrder: 40,
  },
  {
    key: 'iam.organization-user.manage',
    name: '组织与用户',
    code: 'IAM_ORGANIZATION_USER',
    routeKey: 'iam.organization-user.manage',
    kind: '操作资源',
    status: 'ENABLED',
    affectedRoles: 5,
    sortOrder: 50,
  },
  {
    key: 'iam.organization.manage',
    name: '组织管理',
    code: 'IAM_ORGANIZATION_MANAGE',
    routeKey: 'iam.organization.manage',
    kind: '操作资源',
    status: 'ENABLED',
    affectedRoles: 5,
    sortOrder: 60,
  },
  {
    key: 'iam.user.manage',
    name: '用户管理',
    code: 'IAM_USER_MANAGE',
    routeKey: 'iam.user.manage',
    kind: '操作资源',
    status: 'ENABLED',
    affectedRoles: 5,
    sortOrder: 70,
  },
  {
    key: 'iam.group.manage',
    name: '用户组管理',
    code: 'IAM_GROUP_MANAGE',
    routeKey: 'iam.group.manage',
    kind: '操作资源',
    status: 'ENABLED',
    affectedRoles: 5,
    sortOrder: 80,
  },
  {
    key: 'iam.role.directory',
    name: '角色目录',
    code: 'IAM_ROLE_DIRECTORY',
    routeKey: 'iam.role.directory',
    kind: '目录',
    status: 'ENABLED',
    affectedRoles: 4,
    sortOrder: 90,
  },
  {
    key: 'iam.menu.resource',
    name: '菜单资源',
    code: 'IAM_MENU_RESOURCE',
    routeKey: 'iam.menu.resource',
    kind: '目录',
    status: 'ENABLED',
    affectedRoles: 4,
    sortOrder: 100,
  },
  {
    key: 'iam.permission.directory',
    name: '权限项目录',
    code: 'IAM_PERMISSION_DIRECTORY',
    routeKey: 'iam.permission.directory',
    kind: '目录',
    status: 'ENABLED',
    affectedRoles: 4,
    sortOrder: 110,
  },
  {
    key: 'system.settings',
    name: '系统设置',
    code: 'SYSTEM_SETTINGS',
    routeKey: 'system.settings',
    kind: '菜单页',
    status: 'ENABLED',
    affectedRoles: 3,
    sortOrder: 120,
  },
  {
    key: 'security.policy.config',
    name: '安全策略配置',
    code: 'SECURITY_POLICY_CONFIG',
    routeKey: 'security.policy.config',
    kind: '操作资源',
    status: 'ENABLED',
    affectedRoles: 3,
    sortOrder: 130,
  },
  {
    key: 'audit.operation.log',
    name: '操作日志',
    code: 'AUDIT_OPERATION_LOG',
    routeKey: 'audit.operation.log',
    kind: '菜单页',
    status: 'ENABLED',
    affectedRoles: 3,
    sortOrder: 140,
  },
]

const statusMeta: Record<ResourceStatus, { label: string; className: string }> =
  {
    ENABLED: {
      label: '启用',
      className: 'border-[#c9ebd8] bg-[#effaf3] text-[#23865f]',
    },
    DISABLED: {
      label: '停用',
      className: 'border-[#e1e5ed] bg-[#f1f3f7] text-[#6d7788]',
    },
  }

const accessTabs = [
  {
    label: '角色与矩阵',
    icon: <ShieldCheck className="size-4" />,
    href: '/system/access-control/roles',
  },
  {
    label: '菜单资源',
    icon: <ListTree className="size-4" />,
    href: '/component-lab?scene=menu-resources',
    active: true,
  },
  {
    label: '权限项目录',
    icon: <KeyRound className="size-4" />,
    href: '/system/access-control/permission-items',
  },
  {
    label: '系统角色授权',
    icon: <Users className="size-4" />,
    href: '/system/access-control/assignments',
  },
  {
    label: '临时授权',
    icon: <Users className="size-4" />,
    href: '/system/access-control/temporary-grants',
  },
  {
    label: '有效权限预览',
    icon: <Eye className="size-4" />,
    href: '/system/access-control/preview',
  },
]

function ResourceTreeLabel({
  label,
  kind = '目录',
}: {
  label: string
  kind?: ResourceKind
}) {
  const Icon = kind === '目录' ? Folder : kind === '菜单页' ? FileText : FileCog

  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Icon className="size-3.5 shrink-0 text-[#667894]" strokeWidth={1.75} />
      <span className="truncate">{label}</span>
    </span>
  )
}

type ResourceTreeNode = {
  key: string
  label: string
  kind: ResourceKind
  resourceKey?: string
  depth: 0 | 1
  children?: ResourceTreeNode[]
}

function buildResourceTreeData(
  resources: ResourceRecord[],
): ResourceTreeNode[] {
  const newlyRegistered = resources
    .filter((resource) => resource.key.startsWith('resource-'))
    .map((resource) => ({
      key: resource.key,
      label: resource.name,
      kind: resource.kind,
      resourceKey: resource.key,
      depth: 1 as const,
    }))

  return [
    {
      key: 'all-resources',
      label: '全部资源',
      kind: '目录',
      depth: 0,
      children: [
        {
          key: 'system-management',
          label: '系统管理',
          kind: '目录',
          depth: 0,
          children: [
            {
              key: 'system.overview',
              label: '工作台',
              kind: '菜单页',
              resourceKey: 'system.overview',
              depth: 1,
            },
            {
              key: 'organization-and-users',
              label: '组织与用户',
              kind: '菜单页',
              resourceKey: 'iam.organization-user.manage',
              depth: 1,
            },
            {
              key: 'access-control',
              label: '角色与权限',
              kind: '菜单页',
              resourceKey: 'iam.menu.resource',
              depth: 1,
            },
            {
              key: 'system.settings',
              label: '系统设置',
              kind: '菜单页',
              resourceKey: 'system.settings',
              depth: 1,
            },
            {
              key: 'audit.operation.log',
              label: '审计日志',
              kind: '菜单页',
              resourceKey: 'audit.operation.log',
              depth: 1,
            },
            ...newlyRegistered,
          ],
        },
        {
          key: 'business-management',
          label: '业务管理',
          kind: '目录',
          depth: 0,
          children: [
            {
              key: 'project-management',
              label: '项目管理',
              kind: '菜单页',
              depth: 1,
            },
            {
              key: 'task-management',
              label: '任务管理',
              kind: '菜单页',
              depth: 1,
            },
            {
              key: 'contract-management',
              label: '合同管理',
              kind: '菜单页',
              depth: 1,
            },
            {
              key: 'report-center',
              label: '报表中心',
              kind: '菜单页',
              depth: 1,
            },
          ],
        },
        {
          key: 'data-center',
          label: '数据中心',
          kind: '目录',
          depth: 0,
          children: [
            {
              key: 'data-overview',
              label: '数据概览',
              kind: '菜单页',
              depth: 1,
            },
            {
              key: 'data-market',
              label: '数据集市',
              kind: '菜单页',
              depth: 1,
            },
            {
              key: 'data-service',
              label: '数据服务',
              kind: '菜单页',
              depth: 1,
            },
          ],
        },
      ],
    },
  ]
}

function ResourceCatalogTree({
  resources,
  selectedKey,
  onSelect,
}: {
  resources: ResourceRecord[]
  selectedKey: string
  onSelect: (resource: ResourceRecord) => void
}) {
  const [expandedKeys, setExpandedKeys] = useState<string[]>([
    'all-resources',
    'system-management',
    'business-management',
    'data-center',
  ])
  const treeData = useMemo(() => buildResourceTreeData(resources), [resources])

  function toggleNode(key: string) {
    setExpandedKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    )
  }

  function renderNodes(nodes: ResourceTreeNode[]): ReactNode {
    return nodes.map((node) => {
      const hasChildren = Boolean(node.children?.length)
      const isCategory = hasChildren && node.key !== 'all-resources'
      const isExpanded = expandedKeys.includes(node.key)
      const resource = node.resourceKey
        ? resources.find((item) => item.key === node.resourceKey)
        : undefined
      const isSelected = resource?.key === selectedKey

      return (
        <div key={node.key}>
          <button
            aria-expanded={hasChildren ? isExpanded : undefined}
            aria-selected={isSelected || undefined}
            className={
              isSelected
                ? `menu-resource-prototype__tree-node menu-resource-prototype__tree-node--depth-${node.depth} ${isCategory ? 'menu-resource-prototype__tree-node--group' : ''} menu-resource-prototype__tree-node--selected`
                : `menu-resource-prototype__tree-node menu-resource-prototype__tree-node--depth-${node.depth} ${isCategory ? 'menu-resource-prototype__tree-node--group' : ''}`
            }
            type="button"
            onClick={() => {
              if (hasChildren) toggleNode(node.key)
              if (resource) onSelect(resource)
            }}
          >
            <span className="menu-resource-prototype__tree-switcher">
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )
              ) : null}
            </span>
            <ResourceTreeLabel kind={node.kind} label={node.label} />
          </button>
          {hasChildren && isExpanded ? renderNodes(node.children!) : null}
        </div>
      )
    })
  }

  return (
    <div
      aria-label="资源分类"
      className="menu-resource-prototype__tree"
      role="tree"
    >
      {renderNodes(treeData)}
    </div>
  )
}

function toDraft(resource: ResourceRecord): ResourceDraft {
  const { key: _key, affectedRoles: _affectedRoles, ...draft } = resource
  return draft
}

function StatusTag({ status }: { status: ResourceStatus }) {
  const meta = statusMeta[status]

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs leading-4 ${meta.className}`}
    >
      {meta.label}
    </span>
  )
}

function ProductNavigation() {
  const identityItems = [
    { label: '用户', icon: <Users className="size-4" /> },
    { label: '用户组', icon: <Users className="size-4" /> },
    { label: '角色', icon: <ShieldCheck className="size-4" /> },
    { label: '权限项', icon: <KeyRound className="size-4" /> },
    { label: '权限模板', icon: <FileText className="size-4" /> },
  ]
  const auditItems = [
    { label: '操作日志', icon: <FileText className="size-4" /> },
    { label: '访问日志', icon: <FileText className="size-4" /> },
    { label: '登录日志', icon: <ShieldCheck className="size-4" /> },
  ]

  return (
    <aside className="menu-resource-prototype__sider">
      <div className="menu-resource-prototype__brand">
        <span className="menu-resource-prototype__brand-mark">
          <Blocks className="size-4" />
        </span>
        <strong>项目工作台</strong>
        <ChevronDown className="ml-auto size-4 text-[#556781]" />
      </div>

      <nav aria-label="主导航" className="menu-resource-prototype__global-nav">
        <button type="button">
          <LayoutDashboard className="size-4" />
          概览
        </button>

        <p className="menu-resource-prototype__global-nav-label">身份与访问</p>
        {identityItems.map((item) => (
          <button
            aria-current={item.label === '权限项' ? 'page' : undefined}
            className={
              item.label === '权限项'
                ? 'menu-resource-prototype__global-nav-item--active'
                : undefined
            }
            key={item.label}
            type="button"
          >
            {item.icon}
            {item.label}
          </button>
        ))}

        <p className="menu-resource-prototype__global-nav-label">审计</p>
        {auditItems.map((item) => (
          <button key={item.label} type="button">
            {item.icon}
            {item.label}
          </button>
        ))}

        <p className="menu-resource-prototype__global-nav-label">设置</p>
        <button type="button">
          <FileCog className="size-4" />
          策略配置
        </button>
        <button type="button">
          <Settings className="size-4" />
          系统设置
        </button>
      </nav>

      <button className="menu-resource-prototype__profile" type="button">
        <span>A</span>
        admin
      </button>
    </aside>
  )
}

function AccessControlTabs() {
  return (
    <nav
      aria-label="菜单与权限工作台"
      className="menu-resource-prototype__access-tabs"
    >
      {accessTabs.map((tab) => (
        <a
          aria-current={tab.active ? 'page' : undefined}
          className={
            tab.active
              ? 'menu-resource-prototype__access-tab menu-resource-prototype__access-tab--active'
              : 'menu-resource-prototype__access-tab'
          }
          href={tab.href}
          key={tab.label}
        >
          {tab.icon}
          {tab.label}
        </a>
      ))}
    </nav>
  )
}

function EditorSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <section className="menu-resource-prototype__editor-section">
      <div className="menu-resource-prototype__editor-section-heading">
        <span className="menu-resource-prototype__editor-section-icon">
          {icon}
        </span>
        <Typography.Text>{title}</Typography.Text>
      </div>
      <div className="menu-resource-prototype__editor-section-body">
        {children}
      </div>
    </section>
  )
}

function EditorField({
  label,
  helper,
  children,
}: {
  label: string
  helper?: string
  children: ReactNode
}) {
  return (
    <>
      <label className="menu-resource-prototype__editor-field">
        <span className="menu-resource-prototype__editor-label">{label}</span>
        {children}
      </label>
      {helper ? (
        <span className="menu-resource-prototype__editor-helper">
          <Info className="size-3.5 shrink-0" />
          {helper}
        </span>
      ) : null}
    </>
  )
}

function ResourceImpactSummary({ resource }: { resource: ResourceRecord }) {
  return (
    <div className="w-[250px] space-y-2 text-sm text-[#53657e]">
      <p className="font-semibold text-[#31425c]">{resource.name}</p>
      <p>关联系统角色：{resource.affectedRoles} 个</p>
      <p>状态：{statusMeta[resource.status].label}</p>
      <p className="text-xs leading-5 text-[#7d8da4]">
        停用资源会隐藏相关菜单或阻止受控操作；保存前请确认后续影响。
      </p>
    </div>
  )
}

function ResourceEditorDrawer({
  draft,
  isNew,
  open,
  resources,
  onChange,
  onClose,
  onSave,
}: {
  draft: ResourceDraft
  isNew: boolean
  open: boolean
  resources: ResourceRecord[]
  onChange: (next: ResourceDraft) => void
  onClose: () => void
  onSave: () => void
}) {
  const registeredKeys = resources
    .filter((resource) => resource.kind !== '目录')
    .map((resource) => ({
      value: resource.routeKey,
      label: resource.routeKey,
    }))
  const controlledCapabilityLabel = '受控 routeKey / 动作键'

  return (
    <Drawer
      className="menu-resource-prototype__editor-drawer"
      closable={false}
      destroyOnHidden
      footer={
        <div className="flex justify-end gap-3">
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={onSave}>
            保存
          </Button>
        </div>
      }
      open={open}
      size={520}
      title={
        <div className="menu-resource-prototype__drawer-titlebar">
          <div className="menu-resource-prototype__drawer-heading">
            <span>菜单与权限 / 资源登记</span>
            <strong>{isNew ? '新建菜单资源' : '编辑菜单资源'}</strong>
          </div>
          <Button
            aria-label="关闭"
            icon={<X className="size-5" />}
            type="text"
            onClick={onClose}
          />
        </div>
      }
      onClose={onClose}
    >
      <div className="menu-resource-prototype__editor-stack">
        <EditorSection icon={<ListTree className="size-4" />} title="资源定义">
          <EditorField label="资源类型">
            <Select
              aria-label="资源类型"
              className="w-full"
              options={(['目录', '菜单页', '操作资源'] as ResourceKind[]).map(
                (kind) => ({ value: kind, label: kind }),
              )}
              value={draft.kind}
              onChange={(kind: ResourceKind) => onChange({ ...draft, kind })}
            />
          </EditorField>
          <EditorField label="资源名称">
            <Input
              aria-label="资源名称"
              maxLength={120}
              placeholder="例如：菜单与权限"
              value={draft.name}
              onChange={(event) =>
                onChange({ ...draft, name: event.target.value })
              }
            />
          </EditorField>
          <EditorField label="稳定资源编码">
            <Input
              aria-label="稳定资源编码"
              disabled={!isNew}
              maxLength={120}
              placeholder="例如：IAM_MENU_RESOURCE"
              value={draft.code}
              onChange={(event) =>
                onChange({ ...draft, code: event.target.value })
              }
            />
          </EditorField>
        </EditorSection>

        <EditorSection icon={<FileCog className="size-4" />} title="受控能力">
          {draft.kind === '目录' ? (
            <div className="menu-resource-prototype__editor-directory-note">
              目录只负责组织资源；不直接绑定 routeKey 或动作键。
            </div>
          ) : (
            <EditorField
              label={controlledCapabilityLabel}
              helper="这里不接受任意 URL；正式系统只允许已注册的 routeKey 或动作键。"
            >
              <Select
                aria-label={controlledCapabilityLabel}
                className="w-full"
                options={registeredKeys}
                placeholder="选择已注册页面或动作"
                value={draft.routeKey || undefined}
                onChange={(routeKey: string) =>
                  onChange({ ...draft, routeKey })
                }
              />
            </EditorField>
          )}
          <div className="menu-resource-prototype__editor-compact-grid">
            <EditorField label="排序">
              <Input
                aria-label="排序"
                min={0}
                type="number"
                value={draft.sortOrder}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    sortOrder: Number(event.target.value) || 0,
                  })
                }
              />
            </EditorField>
            <EditorField label="状态">
              <Select
                aria-label="资源状态"
                className="w-full"
                options={[
                  { value: 'ENABLED', label: '启用' },
                  { value: 'DISABLED', label: '停用' },
                ]}
                value={draft.status}
                onChange={(status: ResourceStatus) =>
                  onChange({ ...draft, status })
                }
              />
            </EditorField>
          </div>
        </EditorSection>

        <div className="menu-resource-prototype__next-step-note">
          <Info className="size-5 shrink-0" />
          <div>
            <Typography.Text>后续流程</Typography.Text>
            <Typography.Paragraph>
              保存资源后，在“权限项目录”登记可授权能力；角色矩阵只授予权限项与数据范围，不直接勾选菜单。
            </Typography.Paragraph>
          </div>
        </div>
      </div>
    </Drawer>
  )
}

function ResourcePagination({
  currentPage,
  onChange,
}: {
  currentPage: number
  onChange: (page: number) => void
}) {
  return (
    <div className="menu-resource-prototype__pagination">
      <span>共 56 条</span>
      <div className="menu-resource-prototype__pagination-pages">
        <Button
          aria-label="上一页"
          disabled={currentPage === 1}
          icon={<ChevronLeft className="size-4" />}
          type="text"
          onClick={() => onChange(Math.max(1, currentPage - 1))}
        />
        {[1, 2, 3, 4, 5].map((page) => (
          <Button
            aria-current={page === currentPage ? 'page' : undefined}
            className={
              page === currentPage
                ? 'menu-resource-prototype__page-button--active'
                : undefined
            }
            key={page}
            type="text"
            onClick={() => onChange(page)}
          >
            {page}
          </Button>
        ))}
        <Button
          aria-label="下一页"
          icon={<ChevronRight className="size-4" />}
          type="text"
          onClick={() => onChange(Math.min(5, currentPage + 1))}
        />
      </div>
      <Select
        aria-label="每页展示条数"
        className="menu-resource-prototype__page-size"
        options={[
          { value: '20', label: '20 条/页' },
          { value: '50', label: '50 条/页' },
        ]}
        value="20"
      />
    </div>
  )
}

function MenuResourceRegistryContent() {
  const [resources, setResources] = useState(initialResources)
  const [selectedKey, setSelectedKey] = useState(initialResources[0].key)
  const [selectionVisible, setSelectionVisible] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ResourceStatus>()
  const [kindFilter, setKindFilter] = useState<ResourceKind>()
  const [kindFilterOpen, setKindFilterOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<EditorMode>()
  const [page, setPage] = useState(1)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [draft, setDraft] = useState<ResourceDraft>(() =>
    toDraft(initialResources[0]),
  )

  const selectedResource = resources.find(
    (resource) => resource.key === selectedKey,
  )
  const filteredResources = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase()

    return resources.filter(
      (resource) =>
        (!statusFilter || resource.status === statusFilter) &&
        (!kindFilter || resource.kind === kindFilter) &&
        (!query ||
          [resource.name, resource.code, resource.routeKey].some((value) =>
            value.toLocaleLowerCase().includes(query),
          )),
    )
  }, [kindFilter, resources, searchQuery, statusFilter])

  function selectResource(resource: ResourceRecord) {
    setSelectedKey(resource.key)
    setSelectionVisible(true)
    setDraft(toDraft(resource))
    setSaveNotice(null)
  }

  function createResource() {
    setDraft({
      name: '',
      code: '',
      routeKey: '',
      kind: '菜单页',
      status: 'ENABLED',
      sortOrder:
        Math.max(...resources.map((resource) => resource.sortOrder)) + 10,
    })
    setEditorMode('create')
    setSaveNotice(null)
  }

  function editSelectedResource() {
    if (!selectedResource) return
    setDraft(toDraft(selectedResource))
    setEditorMode('edit')
    setSaveNotice(null)
  }

  function closeEditor() {
    if (selectedResource) setDraft(toDraft(selectedResource))
    setEditorMode(undefined)
  }

  function saveChanges() {
    if (!draft.name.trim() || !draft.code.trim()) {
      setSaveNotice('请先填写资源名称和稳定资源编码。')
      return
    }

    if (editorMode === 'create') {
      const key = `resource-${Date.now()}`
      const resource: ResourceRecord = {
        ...draft,
        key,
        affectedRoles: 0,
      }
      setResources((current) => [...current, resource])
      setSelectedKey(key)
      setSelectionVisible(true)
      setDraft(toDraft(resource))
      setSaveNotice(`${resource.name} 已保存（仅原型状态）。`)
      setEditorMode(undefined)
      return
    }

    if (!selectedResource) return

    setResources((current) =>
      current.map((resource) =>
        resource.key === selectedKey ? { ...resource, ...draft } : resource,
      ),
    )
    setSaveNotice(`${draft.name} 已保存（仅原型状态）。`)
    setEditorMode(undefined)
  }

  const columns = useMemo<TableColumnsType<ResourceRecord>>(
    () => [
      {
        title: '资源名称',
        dataIndex: 'name',
        width: 136,
        render: (name, resource) => (
          <button
            className="inline-flex items-center gap-2 text-left text-[13px] text-[#42536b] hover:text-[#2f68d8]"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              selectResource(resource)
            }}
          >
            {resource.kind === '目录' ? (
              <Folder className="size-4 text-[#6e83a2]" />
            ) : resource.kind === '菜单页' ? (
              <FileText className="size-4 text-[#316ae0]" />
            ) : (
              <FileCog className="size-4 text-[#61718a]" />
            )}
            <span className="font-semibold">{name}</span>
          </button>
        ),
      },
      {
        title: '资源编码',
        dataIndex: 'code',
        width: 215,
        render: (code) => (
          <span className="text-xs text-[#61718a]">{code}</span>
        ),
      },
      {
        title: '路由键（routeKey）',
        dataIndex: 'routeKey',
        width: 210,
        render: (routeKey) => (
          <span className="text-xs text-[#52637a]">{routeKey || '—'}</span>
        ),
      },
      {
        title: '类型',
        dataIndex: 'kind',
        width: 81,
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 68,
        render: (status) => <StatusTag status={status} />,
      },
      {
        title: '排序',
        dataIndex: 'sortOrder',
        width: 70,
        align: 'right',
      },
      {
        title: '操作',
        width: 88,
        align: 'right',
        render: (_, resource) => (
          <div className="flex justify-end gap-1">
            <Tooltip title="编辑资源">
              <Button
                aria-label={`编辑 ${resource.name}`}
                icon={<Pencil className="size-4" />}
                size="small"
                type="text"
                onClick={(event) => {
                  event.stopPropagation()
                  selectResource(resource)
                  setEditorMode('edit')
                }}
              />
            </Tooltip>
            <Popover
              content={
                <Button
                  size="small"
                  type="text"
                  onClick={() => {
                    selectResource(resource)
                    setEditorMode('edit')
                  }}
                >
                  编辑资源
                </Button>
              }
              trigger="click"
            >
              <Button
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
    ],
    [],
  )

  return (
    <div
      className="menu-resource-prototype"
      data-testid="menu-resource-registry-prototype"
    >
      <ProductNavigation />

      <main className="menu-resource-prototype__main">
        <div className="menu-resource-prototype__workspace">
          <div className="menu-resource-prototype__page-heading">
            <div>
              <Typography.Title level={3}>受控资源目录</Typography.Title>
              <Typography.Paragraph>
                routeKey、动作键和图标键只能从已发布注册表中选择；已引用资源仅可停用或调整，不能物理删除。
              </Typography.Paragraph>
            </div>
          </div>

          <AccessControlTabs />

          {saveNotice ? (
            <div className="mt-4" role="status">
              <Alert
                className={
                  saveNotice.startsWith('请先')
                    ? '!border-[#f0d7ae] !bg-[#fffaf2]'
                    : '!border-[#c9ebd8] !bg-[#f1fbf5]'
                }
                showIcon
                title={saveNotice}
                type={saveNotice.startsWith('请先') ? 'warning' : 'success'}
              />
            </div>
          ) : null}

          <div className="menu-resource-prototype__workbench">
            <section className="menu-resource-prototype__surface menu-resource-prototype__tree-surface">
              <div className="menu-resource-prototype__tree-heading">
                <Typography.Text>资源分类</Typography.Text>
                <div className="flex items-center gap-1">
                  <Tooltip title="刷新资源目录">
                    <Button
                      aria-label="刷新资源目录"
                      icon={<RefreshCw className="size-4" />}
                      size="small"
                      type="text"
                    />
                  </Tooltip>
                  <Tooltip title="新建资源">
                    <Button
                      aria-label="按当前层级新建资源"
                      icon={<Plus className="size-4" />}
                      size="small"
                      type="primary"
                      onClick={createResource}
                    />
                  </Tooltip>
                </div>
              </div>
              <div className="menu-resource-prototype__tree-body">
                <ResourceCatalogTree
                  resources={resources}
                  selectedKey={selectedKey}
                  onSelect={selectResource}
                />
              </div>
            </section>

            <section className="menu-resource-prototype__surface menu-resource-prototype__table-surface">
              <div className="menu-resource-prototype__selection-band">
                {selectionVisible && selectedResource ? (
                  <>
                    <div className="menu-resource-prototype__selection-copy">
                      <Info className="size-5 shrink-0" />
                      <span>已选择 1 项资源：</span>
                      <strong>{selectedResource.name}</strong>
                    </div>
                    <div className="menu-resource-prototype__selection-actions">
                      <Popover
                        content={
                          <ResourceImpactSummary resource={selectedResource} />
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
                        onClick={editSelectedResource}
                      >
                        编辑
                      </Button>
                      <Button
                        aria-label="取消资源选择"
                        icon={<X className="size-3.5" />}
                        size="small"
                        type="text"
                        onClick={() => setSelectionVisible(false)}
                      />
                    </div>
                  </>
                ) : (
                  <Typography.Text>
                    从左侧分类或表格中选择一个资源，查看影响并开始维护。
                  </Typography.Text>
                )}
              </div>

              <div className="menu-resource-prototype__toolbar">
                <Input
                  allowClear
                  aria-label="搜索资源"
                  className="menu-resource-prototype__toolbar-search"
                  prefix={<Search className="size-4 text-[#90a0b7]" />}
                  placeholder="搜索资源名称、编码或路由键"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                <Select
                  allowClear
                  aria-label="筛选资源状态"
                  className="menu-resource-prototype__toolbar-status"
                  options={[
                    { value: 'ENABLED', label: '状态：启用' },
                    { value: 'DISABLED', label: '状态：停用' },
                  ]}
                  placeholder="状态：全部"
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
                <Button
                  icon={<Plus className="size-4" />}
                  type="primary"
                  onClick={createResource}
                >
                  新建资源
                </Button>
                <div className="menu-resource-prototype__toolbar-meta">
                  <span>共 56 条</span>
                  <Popover
                    content={
                      <div className="space-y-2 p-1">
                        <Typography.Text>资源类型</Typography.Text>
                        <Select
                          allowClear
                          aria-label="筛选资源类型"
                          className="w-40"
                          options={(
                            ['目录', '菜单页', '操作资源'] as ResourceKind[]
                          ).map((kind) => ({ value: kind, label: kind }))}
                          placeholder="全部类型"
                          value={kindFilter}
                          onChange={(kind) => {
                            setKindFilter(kind)
                            setKindFilterOpen(false)
                          }}
                        />
                      </div>
                    }
                    open={kindFilterOpen}
                    trigger="click"
                    onOpenChange={setKindFilterOpen}
                  >
                    <Button
                      aria-label="筛选资源类型"
                      icon={<SlidersHorizontal className="size-4" />}
                      size="small"
                      type="text"
                      onClick={() => setKindFilterOpen(true)}
                    />
                  </Popover>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                <Table<ResourceRecord>
                  className="menu-resource-prototype__table"
                  columns={columns}
                  dataSource={filteredResources}
                  pagination={false}
                  rowKey="key"
                  rowSelection={{
                    columnWidth: 42,
                    selectedRowKeys: selectionVisible ? [selectedKey] : [],
                    onChange: (_, rows) => {
                      if (rows[0]) selectResource(rows[0])
                    },
                  }}
                  scroll={{ x: 910 }}
                  size="middle"
                  onRow={(resource) => ({
                    onClick: () => selectResource(resource),
                    'data-testid': `resource-row-${resource.key}`,
                    className:
                      resource.key === selectedKey && selectionVisible
                        ? 'menu-resource-prototype__table-row--selected'
                        : '',
                  })}
                />
              </div>
              <ResourcePagination currentPage={page} onChange={setPage} />
            </section>

            <aside className="menu-resource-prototype__workflow-note">
              <Info className="size-5 shrink-0" />
              <div>
                <Typography.Text>资源登记完成后</Typography.Text>
                <Typography.Paragraph>
                  菜单资源只描述入口与受控键；下一步在“权限项目录”登记可授权能力，再进入角色矩阵配置数据范围。
                </Typography.Paragraph>
              </div>
              <Button
                href="/system/access-control/permission-items"
                type="link"
              >
                下一步：权限项目录
              </Button>
            </aside>
          </div>
        </div>
      </main>

      <ResourceEditorDrawer
        draft={draft}
        isNew={editorMode === 'create'}
        open={Boolean(editorMode)}
        resources={resources}
        onChange={setDraft}
        onClose={closeEditor}
        onSave={saveChanges}
      />
    </div>
  )
}

export function MenuResourceRegistryPrototype() {
  return (
    <ConfigProvider theme={projectTheme}>
      <MenuResourceRegistryContent />
    </ConfigProvider>
  )
}
