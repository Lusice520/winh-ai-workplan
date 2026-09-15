import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  Eye,
  FileCog,
  FileKey2,
  FileText,
  Folder,
  FolderOpen,
  Home,
  Info,
  KeyRound,
  ListTree,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRoundPlus,
  UsersRound,
  X,
} from "lucide-react";

const tabs = [
  { id: "roles", label: "角色与矩阵", icon: ShieldCheck },
  { id: "resources", label: "菜单资源", icon: ListTree },
  { id: "permissions", label: "权限项目录", icon: KeyRound },
  { id: "assignments", label: "系统角色授权", icon: UsersRound },
  { id: "temporary", label: "临时授权", icon: UserRoundPlus },
  { id: "preview", label: "有效权限预览", icon: Eye },
];

const typeLabels = {
  DIRECTORY: "目录",
  MENU_PAGE: "菜单页",
  OPERATION: "操作资源",
};
const scopeLabels = {
  ALL_ORGANIZATION: "全组织",
  OWN_ORGANIZATION: "本组织",
  NAMED_ORGANIZATION: "指定组织",
  NAMED_PROJECT: "指定项目",
  NAMED_OBJECTS: "指定对象",
  SELF: "仅本人",
};

const permissionItems = [
  {
    code: "IAM_MENU_RESOURCE_MANAGE",
    label: "维护菜单资源",
    dimension: "操作",
    fixedScope: "ALL_ORGANIZATION",
  },
  {
    code: "IAM_MENU_RESOURCE_READ",
    label: "读取菜单资源",
    dimension: "操作",
    fixedScope: "ALL_ORGANIZATION",
  },
  {
    code: "IAM_ORGANIZATION_MANAGE",
    label: "维护组织目录",
    dimension: "操作",
    fixedScope: null,
  },
  {
    code: "IAM_ORGANIZATION_READ",
    label: "读取组织目录",
    dimension: "操作",
    fixedScope: null,
  },
  {
    code: "IAM_PERMISSION_ITEM_READ",
    label: "读取权限项目录",
    dimension: "操作",
    fixedScope: "ALL_ORGANIZATION",
  },
  {
    code: "IAM_PERMISSION_PREVIEW",
    label: "预览实际权限",
    dimension: "操作",
    fixedScope: "ALL_ORGANIZATION",
  },
  {
    code: "IAM_USER_MANAGE",
    label: "用户管理",
    dimension: "操作",
    fixedScope: null,
  },
  {
    code: "PROJECT_TASK_MANAGE",
    label: "维护项目任务",
    dimension: "项目",
    fixedScope: null,
  },
  {
    code: "PROJECT_DOCUMENT_READ",
    label: "读取项目文档",
    dimension: "项目",
    fixedScope: null,
  },
];

const initialResources = [
  [
    "system-overview",
    "工作台",
    "SYSTEM_OVERVIEW",
    "system.overview",
    "MENU_PAGE",
    10,
  ],
  [
    "system-dashboard",
    "系统概览",
    "SYSTEM_DASHBOARD",
    "system.dashboard",
    "MENU_PAGE",
    20,
  ],
  ["my-todo", "待办事项", "MY_TODO", "my.todo", "MENU_PAGE", 30],
  [
    "my-notifications",
    "消息通知",
    "MY_NOTIFICATIONS",
    "my.notifications",
    "MENU_PAGE",
    40,
  ],
  [
    "organization-user",
    "组织与用户",
    "IAM_ORGANIZATION_USER",
    "iam.organization-user.manage",
    "OPERATION",
    50,
  ],
  [
    "organization-manage",
    "组织管理",
    "IAM_ORGANIZATION_MANAGE",
    "iam.organization.manage",
    "OPERATION",
    60,
  ],
  [
    "user-manage",
    "用户管理",
    "IAM_USER_MANAGE",
    "iam.user.manage",
    "OPERATION",
    70,
  ],
  [
    "group-manage",
    "用户组管理",
    "IAM_GROUP_MANAGE",
    "iam.group.manage",
    "OPERATION",
    80,
  ],
  [
    "role-directory",
    "角色目录",
    "IAM_ROLE_DIRECTORY",
    "iam.role.directory",
    "DIRECTORY",
    90,
  ],
  [
    "menu-resource",
    "菜单资源",
    "IAM_MENU_RESOURCE",
    "iam.menu.resource",
    "DIRECTORY",
    100,
  ],
  [
    "permission-directory",
    "权限项目录",
    "IAM_PERMISSION_DIRECTORY",
    "iam.permission.directory",
    "DIRECTORY",
    110,
  ],
  [
    "system-settings",
    "系统设置",
    "SYSTEM_SETTINGS",
    "system.settings",
    "MENU_PAGE",
    120,
  ],
  [
    "security-policy",
    "安全策略配置",
    "SECURITY_POLICY_CONFIG",
    "security.policy.config",
    "OPERATION",
    130,
  ],
  [
    "operation-log",
    "操作日志",
    "AUDIT_OPERATION_LOG",
    "audit.operation.log",
    "MENU_PAGE",
    140,
  ],
].map(([id, name, code, routeKey, type, sort]) => ({
  id,
  name,
  code,
  routeKey,
  type,
  sort,
  status: "ENABLED",
}));

const initialRoles = [
  [
    "project-admin",
    "项目管理员",
    "PROJECT_ADMIN",
    12,
    8,
    "负责项目、成员与进度的日常管理。",
  ],
  [
    "engineer",
    "开发工程师",
    "ENGINEER",
    8,
    16,
    "负责项目执行、任务协作与交付材料维护。",
  ],
  [
    "tester",
    "测试工程师",
    "TESTER",
    6,
    6,
    "负责测试计划、测试执行与缺陷跟踪。",
  ],
  ["ops", "运维工程师", "OPS_ENGINEER", 9, 7, "负责环境、发布和运行状态维护。"],
  ["auditor", "审计员", "AUDITOR", 7, 4, "负责查看审计材料与合规核验。"],
  [
    "system-security-admin",
    "系统安全管理员",
    "SYSTEM_SECURITY_ADMIN",
    17,
    5,
    "负责系统安全策略配置、权限管理与审计。",
  ],
  [
    "visitor",
    "只读访客",
    "READ_ONLY_VISITOR",
    3,
    11,
    "仅查看已获授权的公开或协作内容。",
  ],
].map(([id, name, code, grants, assignments, description]) => ({
  id,
  name,
  code,
  grants,
  assignments,
  description,
  status: "ENABLED",
}));

const initialGrants = [
  ["grant-1", "IAM_MENU_RESOURCE_MANAGE", "ALL_ORGANIZATION", "—", 0],
  ["grant-2", "IAM_MENU_RESOURCE_READ", "ALL_ORGANIZATION", "—", 0],
  ["grant-3", "IAM_ORGANIZATION_MANAGE", "OWN_ORGANIZATION", "—", 5],
  ["grant-4", "IAM_ORGANIZATION_READ", "OWN_ORGANIZATION", "—", 5],
  ["grant-5", "IAM_PERMISSION_ITEM_READ", "ALL_ORGANIZATION", "—", 5],
  ["grant-6", "IAM_PERMISSION_PREVIEW", "ALL_ORGANIZATION", "—", 5],
  [
    "grant-7",
    "IAM_USER_MANAGE",
    "OWN_ORGANIZATION",
    "部门：信息安全部；状态：启用",
    2,
  ],
  ["grant-8", "PROJECT_TASK_MANAGE", "NAMED_PROJECT", "项目：产品迭代计划", 2],
  [
    "grant-9",
    "PROJECT_DOCUMENT_READ",
    "NAMED_PROJECT",
    "项目：产品迭代计划",
    1,
  ],
].map(([id, code, scope, reference, affected]) => ({
  id,
  code,
  scope,
  reference,
  affected,
}));

const newResource = () => ({
  id: "",
  name: "",
  code: "",
  routeKey: "",
  type: "MENU_PAGE",
  status: "ENABLED",
  sort: 150,
});
const newRole = () => ({
  name: "",
  code: "",
  description: "",
  status: "ENABLED",
});
const newGrant = () => ({
  id: "",
  code: "IAM_MENU_RESOURCE_MANAGE",
  scope: "ALL_ORGANIZATION",
  reference: "",
  affected: 0,
});
const permissionByCode = (code) =>
  permissionItems.find((item) => item.code === code) ?? permissionItems[0];
const usesReference = (scope) =>
  ["NAMED_ORGANIZATION", "NAMED_PROJECT", "NAMED_OBJECTS"].includes(scope);

function resourceIcon(type, size = 16) {
  return type === "DIRECTORY" ? (
    <Folder size={size} aria-hidden="true" />
  ) : type === "OPERATION" ? (
    <FileCog size={size} aria-hidden="true" />
  ) : (
    <FileText size={size} aria-hidden="true" />
  );
}

function StatusPill({ status }) {
  return (
    <span className={`status-pill status-pill--${status.toLowerCase()}`}>
      {status === "ENABLED" ? "启用" : "停用"}
    </span>
  );
}
function IconButton({
  label,
  children,
  onClick,
  danger = false,
  active = false,
}) {
  return (
    <button
      aria-label={label}
      className={`icon-button${danger ? " icon-button--danger" : ""}${active ? " icon-button--active" : ""}`}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Pagination({ total = 56, page, onPage }) {
  return (
    <footer className="table-pagination" aria-label="分页">
      <span>共 {total} 条</span>
      <div className="page-numbers">
        <button
          aria-label="上一页"
          className="pagination-icon"
          type="button"
          onClick={() => onPage(Math.max(1, page - 1))}
        >
          <ChevronLeft size={17} />
        </button>
        {[1, 2, 3, 4, 5].map((item) => (
          <button
            className={
              item === page ? "page-number page-number--active" : "page-number"
            }
            key={item}
            type="button"
            onClick={() => onPage(item)}
          >
            {item}
          </button>
        ))}
        <button
          aria-label="下一页"
          className="pagination-icon"
          type="button"
          onClick={() => onPage(Math.min(5, page + 1))}
        >
          <ChevronRight size={17} />
        </button>
      </div>
      <label className="page-size">
        <span className="sr-only">每页展示条数</span>
        <select aria-label="每页展示条数" defaultValue="20 条/页">
          <option>20 条/页</option>
          <option>50 条/页</option>
          <option>100 条/页</option>
        </select>
        <ChevronDown size={16} aria-hidden="true" />
      </label>
    </footer>
  );
}

function Sidebar({ activePage, onChange }) {
  return (
    <aside className="app-sidebar" aria-label="主导航">
      <div className="brand-lockup">
        <span className="brand-mark">
          <BriefcaseBusiness size={19} />
        </span>
        <strong>项目工作台</strong>
        <ChevronDown size={16} />
      </div>
      <nav className="side-navigation">
        <button className="nav-item" type="button">
          <Home size={18} />
          概览
        </button>
        <p className="nav-section-label">身份与访问</p>
        <button className="nav-item" type="button">
          <UsersRound size={18} />
          用户
        </button>
        <button className="nav-item" type="button">
          <UsersRound size={18} />
          用户组
        </button>
        <button
          className="nav-item"
          type="button"
          onClick={() => onChange("roles")}
        >
          <ShieldCheck size={18} />
          角色
        </button>
        <button
          className={`nav-item${["resources", "roles", "permissions"].includes(activePage) ? " nav-item--active" : ""}`}
          type="button"
          onClick={() => onChange("resources")}
        >
          <KeyRound size={18} />
          权限项
        </button>
        <button className="nav-item" type="button">
          <FileKey2 size={18} />
          权限模板
        </button>
        <p className="nav-section-label">审计</p>
        <button className="nav-item" type="button">
          <ClipboardCheck size={18} />
          操作日志
        </button>
        <button className="nav-item" type="button">
          <FileText size={18} />
          访问日志
        </button>
        <button className="nav-item" type="button">
          <ShieldCheck size={18} />
          登录日志
        </button>
        <p className="nav-section-label">设置</p>
        <button className="nav-item" type="button">
          <FileText size={18} />
          策略配置
        </button>
        <button className="nav-item" type="button">
          <Settings2 size={18} />
          系统设置
        </button>
      </nav>
      <button className="account-switcher" type="button">
        <span className="account-avatar">A</span>
        <span>admin</span>
        <ChevronDown size={16} />
      </button>
    </aside>
  );
}

function Tabs({ activePage, onChange }) {
  return (
    <div className="access-tabs" role="tablist" aria-label="菜单与权限工作区">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            className={
              activePage === tab.id
                ? "access-tab access-tab--active"
                : "access-tab"
            }
            key={tab.id}
            role="tab"
            aria-selected={activePage === tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
          >
            <Icon size={16} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function ResourceTree({ selectedId, onSelect, onCreate }) {
  const [expanded, setExpanded] = useState({
    system: true,
    business: true,
    data: true,
  });
  const groups = [
    {
      id: "system",
      label: "系统管理",
      nodes: ["工作台", "组织与用户", "角色与权限", "系统设置", "审计日志"],
    },
    {
      id: "business",
      label: "业务管理",
      nodes: ["项目管理", "任务管理", "合同管理", "报表中心"],
    },
    {
      id: "data",
      label: "数据中心",
      nodes: ["数据概览", "数据集市", "数据服务"],
    },
  ];
  return (
    <section className="tree-card" aria-label="资源分类">
      <header className="tree-card__header">
        <strong>资源分类</strong>
        <span>
          <IconButton
            label="刷新资源树"
            onClick={() => onSelect("system-overview")}
          >
            <RefreshCw size={16} />
          </IconButton>
          <IconButton active label="新建资源" onClick={onCreate}>
            <Plus size={18} />
          </IconButton>
        </span>
      </header>
      <div className="tree-root">
        <button
          className={
            selectedId === "all" ? "tree-node tree-node--selected" : "tree-node"
          }
          type="button"
          onClick={() => onSelect("all")}
        >
          <ChevronDown size={15} />
          <FolderOpen size={15} />
          全部资源
        </button>
        {groups.map((group) => (
          <div className="tree-group" key={group.id}>
            <button
              className="tree-node tree-node--group"
              type="button"
              onClick={() =>
                setExpanded((current) => ({
                  ...current,
                  [group.id]: !current[group.id],
                }))
              }
            >
              {expanded[group.id] ? (
                <ChevronDown size={15} />
              ) : (
                <ChevronRight size={15} />
              )}
              <Folder size={15} />
              {group.label}
            </button>
            {expanded[group.id] ? (
              <div className="tree-children">
                {group.nodes.map((node) => {
                  const id =
                    node === "工作台"
                      ? "system-overview"
                      : `${group.id}-${node}`;
                  return (
                    <button
                      className={
                        selectedId === id
                          ? "tree-node tree-node--selected"
                          : "tree-node"
                      }
                      key={node}
                      type="button"
                      onClick={() => onSelect(id)}
                    >
                      {resourceIcon(
                        node.includes("管理") ? "OPERATION" : "MENU_PAGE",
                        15,
                      )}
                      {node}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function ResourcePage({
  resources,
  setResources,
  openDrawer,
  setActivePage,
  notify,
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selectedId, setSelectedId] = useState("system-overview");
  const [page, setPage] = useState(1);
  const [moreOpen, setMoreOpen] = useState(false);
  const selected = resources.find((item) => item.id === selectedId);
  const filtered = useMemo(
    () =>
      resources.filter(
        (item) =>
          [item.name, item.code, item.routeKey]
            .join(" ")
            .toLowerCase()
            .includes(query.trim().toLowerCase()) &&
          (status === "ALL" || item.status === status),
      ),
    [query, resources, status],
  );
  const select = (id) => {
    if (id === "all") return setSelectedId("system-overview");
    if (resources.some((item) => item.id === id)) setSelectedId(id);
  };
  const copy = () => {
    if (!selected) return;
    const clone = {
      ...selected,
      id: `${selected.id}-copy`,
      name: `${selected.name}（副本）`,
      code: `${selected.code}_COPY`,
      sort: selected.sort + 5,
    };
    setResources((current) => [...current, clone]);
    setSelectedId(clone.id);
    setMoreOpen(false);
    notify("已在原型中创建资源副本；正式保存仍需通过受控键校验。");
  };
  return (
    <div className="page-layout page-layout--resources">
      <ResourceTree
        selectedId={selectedId}
        onSelect={select}
        onCreate={() => openDrawer({ kind: "resource", mode: "create" })}
      />
      <section className="table-card resource-table-card">
        <div className="selection-banner">
          {selected ? (
            <>
              <span className="selection-banner__copy">
                <Info size={17} />
                已选择 1 项资源：<strong>{selected.name}</strong>
              </span>
              <span className="selection-banner__actions">
                <button
                  type="button"
                  onClick={() =>
                    openDrawer({
                      kind: "resource",
                      mode: "view",
                      resource: selected,
                    })
                  }
                >
                  查看详情
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openDrawer({
                      kind: "resource",
                      mode: "edit",
                      resource: selected,
                    })
                  }
                >
                  编辑
                </button>
                <IconButton label="取消选中" onClick={() => setSelectedId("")}>
                  <X size={17} />
                </IconButton>
              </span>
            </>
          ) : (
            <span className="selection-banner__copy">
              <Info size={17} />
              从资源树或表格中选择资源，查看其受控键与后续影响。
            </span>
          )}
        </div>
        <div className="table-toolbar">
          <label className="search-control">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索资源名称、编码或路由键"
            />
          </label>
          <label className="select-control">
            <span className="sr-only">资源状态</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="ALL">状态：全部</option>
              <option value="ENABLED">状态：启用</option>
              <option value="DISABLED">状态：停用</option>
            </select>
            <ChevronDown size={17} />
          </label>
          <button
            className="primary-button primary-button--table"
            type="button"
            onClick={() => openDrawer({ kind: "resource", mode: "create" })}
          >
            <Plus size={17} />
            新建资源
          </button>
          <span className="table-total">共 56 条</span>
          <IconButton label="资源表格设置">
            <Settings2 size={18} />
          </IconButton>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="check-col">
                  <input
                    aria-label="选择全部资源"
                    type="checkbox"
                    checked={Boolean(selected)}
                    readOnly
                  />
                </th>
                <th>资源名称</th>
                <th>资源编码</th>
                <th>路由键（routeKey）</th>
                <th>类型</th>
                <th>状态</th>
                <th className="number-col">排序</th>
                <th className="action-col">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((resource) => (
                <tr
                  className={
                    resource.id === selectedId ? "table-row--selected" : ""
                  }
                  key={resource.id}
                  onClick={() => setSelectedId(resource.id)}
                >
                  <td className="check-col">
                    <input
                      aria-label={`选择${resource.name}`}
                      type="checkbox"
                      checked={resource.id === selectedId}
                      onChange={() => setSelectedId(resource.id)}
                    />
                  </td>
                  <td>
                    <button
                      className="resource-name"
                      type="button"
                      onClick={() => setSelectedId(resource.id)}
                    >
                      {resourceIcon(resource.type)}
                      <span>{resource.name}</span>
                    </button>
                  </td>
                  <td>
                    <code>{resource.code}</code>
                  </td>
                  <td className="route-key">{resource.routeKey || "—"}</td>
                  <td>{typeLabels[resource.type]}</td>
                  <td>
                    <StatusPill status={resource.status} />
                  </td>
                  <td className="number-col">{resource.sort}</td>
                  <td className="action-col">
                    <IconButton
                      label={`编辑${resource.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        openDrawer({
                          kind: "resource",
                          mode: "edit",
                          resource,
                        });
                      }}
                    >
                      <Pencil size={17} />
                    </IconButton>
                    <span className="more-wrap">
                      <IconButton
                        label={`更多操作：${resource.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedId(resource.id);
                          setMoreOpen((open) => !open);
                        }}
                      >
                        <MoreVertical size={18} />
                      </IconButton>
                      {moreOpen && resource.id === selectedId ? (
                        <span className="more-menu">
                          <button type="button" onClick={copy}>
                            创建副本
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMoreOpen(false);
                              openDrawer({
                                kind: "resource",
                                mode: "view",
                                resource,
                              });
                            }}
                          >
                            查看影响
                          </button>
                        </span>
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} onPage={setPage} />
      </section>
      <aside className="resource-next-step">
        <CircleCheck size={18} />
        <div>
          <strong>资源登记完成后</strong>
          <p>
            菜单资源只描述入口与受控键；下一步在权限项目录登记可授权能力，再进入角色矩阵配置数据范围。
          </p>
          <button type="button" onClick={() => setActivePage("roles")}>
            进入角色与矩阵 <ChevronRight size={15} />
          </button>
        </div>
      </aside>
    </div>
  );
}

function RolesPage({
  roles,
  setRoles,
  grantsByRole,
  setGrantsByRole,
  openDrawer,
  setActivePage,
  notify,
}) {
  const [roleQuery, setRoleQuery] = useState("");
  const [grantQuery, setGrantQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [activeRoleId, setActiveRoleId] = useState("system-security-admin");
  const [selectedGrantId, setSelectedGrantId] = useState("grant-5");
  const [page, setPage] = useState(1);
  const activeRole = roles.find((role) => role.id === activeRoleId) ?? roles[0];
  const grants = grantsByRole[activeRole.id] ?? [];
  const roleList = roles.filter((role) =>
    [role.name, role.code]
      .join(" ")
      .toLowerCase()
      .includes(roleQuery.trim().toLowerCase()),
  );
  const displayed = grants.filter(
    (grant) =>
      [permissionByCode(grant.code).label, grant.code]
        .join(" ")
        .toLowerCase()
        .includes(grantQuery.trim().toLowerCase()) &&
      (scopeFilter === "ALL" || grant.scope === scopeFilter),
  );
  const chooseRole = (id) => {
    setActiveRoleId(id);
    setSelectedGrantId("");
    setGrantQuery("");
    setScopeFilter("ALL");
  };
  const removeGrant = (id) => {
    setGrantsByRole((current) => ({
      ...current,
      [activeRole.id]: (current[activeRole.id] ?? []).filter(
        (grant) => grant.id !== id,
      ),
    }));
    setSelectedGrantId("");
    notify("授权条目已从矩阵移除（仅原型状态）。");
  };
  return (
    <div className="roles-layout">
      <section className="role-list-card">
        <button
          className="primary-button role-create-button"
          type="button"
          onClick={() =>
            openDrawer({ kind: "role", mode: "create", onSaved: chooseRole })
          }
        >
          <Plus size={17} />
          新建角色
        </button>
        <label className="catalog-search">
          <Search size={16} />
          <input
            value={roleQuery}
            onChange={(event) => setRoleQuery(event.target.value)}
            placeholder="搜索角色名称"
          />
        </label>
        <div className="role-list" role="list">
          {roleList.map((role) => (
            <button
              className={
                role.id === activeRole.id
                  ? "role-list__item role-list__item--selected"
                  : "role-list__item"
              }
              key={role.id}
              type="button"
              onClick={() => chooseRole(role.id)}
            >
              <span className="role-list__icon">
                <ShieldCheck size={17} />
              </span>
              <span>
                <strong>{role.name}</strong>
                <small>{role.grants} 个权限</small>
              </span>
            </button>
          ))}
        </div>
        <footer className="role-list__footer">共 {roles.length} 个角色</footer>
      </section>
      <section className="role-matrix-card table-card" id="role-matrix">
        <div className="role-table-toolbar">
          <label className="search-control search-control--compact">
            <Search size={17} />
            <input
              value={grantQuery}
              onChange={(event) => setGrantQuery(event.target.value)}
              placeholder="搜索权限项名称、编码"
            />
          </label>
          <label className="select-control select-control--compact">
            <span className="sr-only">数据范围筛选</span>
            <select
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value)}
            >
              <option value="ALL">数据范围：全部</option>
              {Object.entries(scopeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronDown size={16} />
          </label>
          <label className="select-control select-control--compact">
            <span className="sr-only">状态筛选</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="ALL">状态：全部</option>
              <option value="ENABLED">启用</option>
            </select>
            <ChevronDown size={16} />
          </label>
          <button
            className="primary-button primary-button--table"
            type="button"
            onClick={() =>
              openDrawer({ kind: "grant", mode: "create", role: activeRole })
            }
          >
            <Plus size={17} />
            新增授权
          </button>
          <IconButton label="矩阵表格设置">
            <Settings2 size={18} />
          </IconButton>
        </div>
        <div className="role-selection-banner">
          {selectedGrantId ? (
            <>
              <span>
                <Info size={17} />
                已选择 1 条授权
              </span>
              <span>
                <button
                  type="button"
                  onClick={() => setActivePage("permissions")}
                >
                  <FileKey2 size={16} />
                  查看权限项
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openDrawer({
                      kind: "grant",
                      mode: "edit",
                      role: activeRole,
                      grant: grants.find(
                        (grant) => grant.id === selectedGrantId,
                      ),
                    })
                  }
                >
                  <Pencil size={16} />
                  编辑授权
                </button>
                <IconButton
                  label="取消选中授权"
                  onClick={() => setSelectedGrantId("")}
                >
                  <X size={17} />
                </IconButton>
              </span>
            </>
          ) : (
            <span>
              <Info size={17} />
              选择一条授权可查看权限项或继续编辑其数据范围。
            </span>
          )}
        </div>
        <div className="matrix-context">
          <strong>当前角色：{activeRole.name}</strong>
          <span>{activeRole.description}</span>
        </div>
        <div className="data-table-wrap">
          <table className="data-table matrix-table">
            <thead>
              <tr>
                <th className="check-col">
                  <input
                    aria-label="选择所有授权"
                    type="checkbox"
                    checked={Boolean(selectedGrantId)}
                    readOnly
                  />
                </th>
                <th>
                  权限项
                  <br />
                  <small>编码</small>
                </th>
                <th>权限维度</th>
                <th>数据范围</th>
                <th>对象引用 / 条件</th>
                <th>影响用户数</th>
                <th className="action-col">操作</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((grant) => {
                const permission = permissionByCode(grant.code);
                return (
                  <tr
                    className={
                      grant.id === selectedGrantId ? "table-row--selected" : ""
                    }
                    key={grant.id}
                    onClick={() => setSelectedGrantId(grant.id)}
                  >
                    <td className="check-col">
                      <input
                        aria-label={`选择${permission.label}`}
                        type="checkbox"
                        checked={grant.id === selectedGrantId}
                        onChange={() => setSelectedGrantId(grant.id)}
                      />
                    </td>
                    <td className="permission-cell">
                      <strong>{permission.label}</strong>
                      <small>{permission.code}</small>
                    </td>
                    <td>{permission.dimension}</td>
                    <td>
                      <span
                        className={
                          grant.scope === "ALL_ORGANIZATION"
                            ? "scope-value scope-value--global"
                            : "scope-value"
                        }
                      >
                        {scopeLabels[grant.scope]}
                      </span>
                    </td>
                    <td className="reference-cell">{grant.reference || "—"}</td>
                    <td>{grant.affected} 人</td>
                    <td className="action-col">
                      <IconButton
                        label={`编辑${permission.label}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openDrawer({
                            kind: "grant",
                            mode: "edit",
                            role: activeRole,
                            grant,
                          });
                        }}
                      >
                        <Pencil size={17} />
                      </IconButton>
                      <IconButton
                        danger
                        label={`移除${permission.label}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeGrant(grant.id);
                        }}
                      >
                        <Trash2 size={17} />
                      </IconButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} onPage={setPage} />
      </section>
      <aside className="role-inspector">
        <div className="inspector-heading">
          <span>当前角色</span>
          <strong>
            <ShieldCheck size={18} />
            {activeRole.name}
          </strong>
        </div>
        <section className="inspector-section">
          <div className="inspector-section__title">
            <strong>角色描述</strong>
            <IconButton
              label="编辑角色定义"
              onClick={() =>
                openDrawer({ kind: "role", mode: "edit", role: activeRole })
              }
            >
              <Pencil size={16} />
            </IconButton>
          </div>
          <p>{activeRole.description}</p>
        </section>
        <section className="inspector-section">
          <strong>统计信息</strong>
          <dl className="inspector-metrics">
            <div>
              <dt>权限项授权数</dt>
              <dd>
                {activeRole.grants}
                <small>个</small>
              </dd>
              <a href="#role-matrix">查看全部</a>
            </div>
            <div>
              <dt>已分配用户数</dt>
              <dd>
                {activeRole.assignments}
                <small>人</small>
              </dd>
              <a href="#assignment">查看用户</a>
            </div>
          </dl>
        </section>
        <section className="inspector-section inspector-next">
          <strong>后续操作</strong>
          <p>
            <UsersRound size={17} />
            将系统角色分配给用户
          </p>
          <span>把当前角色分配给用户，使其获得这些权限与数据范围。</span>
          <button
            className="primary-button primary-button--inspector"
            type="button"
            onClick={() => openDrawer({ kind: "assignment", role: activeRole })}
          >
            分配系统角色
          </button>
        </section>
        <section className="inspector-section inspector-meta">
          <strong>创建信息</strong>
          <p>
            创建人
            <br />
            <b>admin</b>
          </p>
          <p>
            更新时间
            <br />
            <b>2026-08-30 13:56:08</b>
          </p>
        </section>
      </aside>
    </div>
  );
}

function SupportingPage({ page, setActivePage }) {
  const copy = {
    permissions: [
      "权限项目录",
      "登记服务端可实际判断的权限项。菜单可见不自动等于动作被授予。",
    ],
    assignments: [
      "系统角色授权",
      "在此为启用账号分配系统角色；用户资料页不承担角色维护。",
    ],
    temporary: [
      "临时授权",
      "临时授权必须最小化、有原因和结束时间，并在到期后自动失效。",
    ],
    preview: [
      "有效权限预览",
      "按用户、对象和目标动作解释当前允许或拒绝的原因。",
    ],
  }[page];
  return (
    <section className="supporting-page">
      <span className="supporting-icon">
        <Info size={24} />
      </span>
      <h2>{copy[0]}</h2>
      <p>{copy[1]}</p>
      <div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => setActivePage("resources")}
        >
          查看菜单资源
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={() => setActivePage("roles")}
        >
          进入角色与矩阵
        </button>
      </div>
    </section>
  );
}

function Drawer({
  drawer,
  onClose,
  resources,
  setResources,
  roles,
  setRoles,
  setGrantsByRole,
  notify,
}) {
  const [error, setError] = useState("");
  const [resourceDraft, setResourceDraft] = useState(newResource());
  const [roleDraft, setRoleDraft] = useState(newRole());
  const [grantDraft, setGrantDraft] = useState(newGrant());
  const [account, setAccount] = useState("liuchuanxin");
  useEffect(() => {
    if (!drawer) return;
    setError("");
    setResourceDraft(drawer.resource ? { ...drawer.resource } : newResource());
    setRoleDraft(
      drawer.role
        ? {
            name: drawer.role.name,
            code: drawer.role.code,
            description: drawer.role.description,
            status: drawer.role.status,
          }
        : newRole(),
    );
    setGrantDraft(drawer.grant ? { ...drawer.grant } : newGrant());
  }, [drawer]);
  if (!drawer) return null;
  const view = drawer.kind === "resource" && drawer.mode === "view";
  const permission = permissionByCode(grantDraft.code);
  const scopeFixed = Boolean(permission.fixedScope);
  const needsReference = usesReference(grantDraft.scope);
  const close = () => {
    setError("");
    onClose();
  };
  const saveResource = () => {
    if (
      !resourceDraft.name.trim() ||
      !resourceDraft.code.trim() ||
      !resourceDraft.routeKey.trim()
    )
      return setError(
        "请填写资源名称、稳定资源编码和受控键。受控键只能从已注册页面或动作中选择。",
      );
    const value = {
      ...resourceDraft,
      name: resourceDraft.name.trim(),
      code: resourceDraft.code.trim().toUpperCase(),
      routeKey: resourceDraft.routeKey.trim(),
    };
    if (drawer.mode === "edit") {
      setResources((current) =>
        current.map((item) => (item.id === value.id ? value : item)),
      );
      notify("菜单资源已更新（仅原型状态）。");
    } else {
      const created = {
        ...value,
        id: `resource-${Date.now()}`,
        sort: Number(value.sort) || 0,
      };
      setResources((current) => [...current, created]);
      drawer.onSaved?.(created.id);
      notify(
        "菜单资源已登记。下一步：在权限项目录登记可授权能力，再进入角色矩阵。",
      );
    }
    close();
  };
  const saveRole = () => {
    if (!roleDraft.name.trim() || !roleDraft.code.trim())
      return setError("请填写角色名称与稳定角色编码。创建后再配置第一条授权。");
    const value = {
      ...roleDraft,
      name: roleDraft.name.trim(),
      code: roleDraft.code.trim().toUpperCase(),
    };
    if (drawer.mode === "edit") {
      setRoles((current) =>
        current.map((item) =>
          item.id === drawer.role.id ? { ...item, ...value } : item,
        ),
      );
      notify("角色定义已更新（仅原型状态）。");
      close();
      return;
    }
    const id = value.code.toLowerCase();
    if (roles.some((role) => role.id === id || role.code === value.code))
      return setError("角色编码已存在，请换一个稳定角色编码。");
    setRoles((current) => [
      ...current,
      { id, ...value, grants: 0, assignments: 0 },
    ]);
    setGrantsByRole((current) => ({ ...current, [id]: [] }));
    drawer.onSaved?.(id);
    notify(`角色“${value.name}”已创建。请在角色矩阵中新增第一条授权。`);
    close();
  };
  const saveGrant = () => {
    if (needsReference && !grantDraft.reference.trim())
      return setError(
        "当前数据范围需要明确对象引用；请填写组织、项目或对象范围。",
      );
    const value = {
      ...grantDraft,
      id: grantDraft.id || `grant-${Date.now()}`,
      reference: needsReference ? grantDraft.reference.trim() : "—",
    };
    setGrantsByRole((current) => ({
      ...current,
      [drawer.role.id]:
        drawer.mode === "edit"
          ? (current[drawer.role.id] ?? []).map((item) =>
              item.id === value.id ? value : item,
            )
          : [...(current[drawer.role.id] ?? []), value],
    }));
    if (drawer.mode !== "edit") {
      setRoles((current) =>
        current.map((role) =>
          role.id === drawer.role.id
            ? { ...role, grants: role.grants + 1 }
            : role,
        ),
      );
    }
    notify(
      drawer.mode === "edit"
        ? "授权条目已更新（仅原型状态）。"
        : "授权已加入角色矩阵（仅原型状态）。",
    );
    close();
  };
  const assign = () => {
    setRoles((current) =>
      current.map((role) =>
        role.id === drawer.role.id
          ? { ...role, assignments: role.assignments + 1 }
          : role,
      ),
    );
    notify(
      `已将“${drawer.role.name}”分配给 ${account === "liuchuanxin" ? "刘传鑫" : "本地管理员"}（仅原型状态）。`,
    );
    close();
  };
  const title =
    drawer.kind === "resource"
      ? view
        ? "菜单资源详情"
        : drawer.mode === "edit"
          ? "编辑菜单资源"
          : "新建菜单资源"
      : drawer.kind === "role"
        ? drawer.mode === "edit"
          ? "编辑角色"
          : "新建角色"
        : drawer.kind === "grant"
          ? drawer.mode === "edit"
            ? "编辑授权"
            : "新增授权"
          : "分配系统角色";
  return (
    <div className="drawer-layer">
      <button
        className="drawer-backdrop"
        type="button"
        aria-label="关闭抽屉"
        onClick={close}
      />
      <aside
        className="management-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="drawer-header">
          <div>
            <span className="drawer-kicker">
              菜单与权限 /{" "}
              {drawer.kind === "resource"
                ? "资源登记"
                : drawer.kind === "role"
                  ? "角色定义"
                  : drawer.kind === "grant"
                    ? "角色授权"
                    : "系统角色授权"}
            </span>
            <h2>{title}</h2>
          </div>
          <IconButton label="关闭抽屉" onClick={close}>
            <X size={21} />
          </IconButton>
        </header>
        <div className="drawer-body">
          {drawer.kind === "resource" && (
            <>
              <section className="drawer-section">
                <h3>
                  <ListTree size={17} />
                  资源定义
                </h3>
                <label>
                  资源类型
                  <select
                    disabled={view}
                    value={resourceDraft.type}
                    onChange={(event) =>
                      setResourceDraft((current) => ({
                        ...current,
                        type: event.target.value,
                      }))
                    }
                  >
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  资源名称
                  <input
                    disabled={view}
                    value={resourceDraft.name}
                    onChange={(event) =>
                      setResourceDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="例如：菜单与权限"
                  />
                </label>
                <label>
                  稳定资源编码
                  <input
                    disabled={view || drawer.mode === "edit"}
                    value={resourceDraft.code}
                    onChange={(event) =>
                      setResourceDraft((current) => ({
                        ...current,
                        code: event.target.value,
                      }))
                    }
                    placeholder="例如：IAM_MENU_RESOURCE"
                  />
                </label>
              </section>
              <section className="drawer-section">
                <h3>
                  <FileCog size={17} />
                  受控能力
                </h3>
                <label>
                  受控 routeKey / 动作键
                  <input
                    disabled={view}
                    value={resourceDraft.routeKey}
                    onChange={(event) =>
                      setResourceDraft((current) => ({
                        ...current,
                        routeKey: event.target.value,
                      }))
                    }
                    placeholder="选择已注册页面或动作"
                  />
                </label>
                <p className="field-help">
                  <Info size={15} />
                  这里不接受任意 URL；正式系统只允许已注册的 routeKey 或动作键。
                </p>
                <div className="field-pair">
                  <label>
                    排序
                    <input
                      disabled={view}
                      type="number"
                      value={resourceDraft.sort}
                      onChange={(event) =>
                        setResourceDraft((current) => ({
                          ...current,
                          sort: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    状态
                    <select
                      disabled={view}
                      value={resourceDraft.status}
                      onChange={(event) =>
                        setResourceDraft((current) => ({
                          ...current,
                          status: event.target.value,
                        }))
                      }
                    >
                      <option value="ENABLED">启用</option>
                      <option value="DISABLED">停用</option>
                    </select>
                  </label>
                </div>
              </section>
              <section className="drawer-section drawer-section--note">
                <h3>
                  <Info size={17} />
                  后续流程
                </h3>
                <p>
                  保存资源后，在“权限项目录”登记可授权能力；角色矩阵只授予权限项与数据范围，不直接勾选菜单。
                </p>
              </section>
            </>
          )}
          {drawer.kind === "role" && (
            <>
              <section className="drawer-section">
                <h3>
                  <ShieldCheck size={17} />
                  角色定义
                </h3>
                <label>
                  <span>
                    角色名称 <b>*</b>
                  </span>
                  <input
                    value={roleDraft.name}
                    onChange={(event) =>
                      setRoleDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="例如：项目交付负责人"
                  />
                </label>
                <label>
                  <span>
                    稳定角色编码 <b>*</b>
                  </span>
                  <input
                    disabled={drawer.mode === "edit"}
                    value={roleDraft.code}
                    onChange={(event) =>
                      setRoleDraft((current) => ({
                        ...current,
                        code: event.target.value,
                      }))
                    }
                    placeholder="例如：PROJECT_DELIVERY_OWNER"
                  />
                </label>
                <label>
                  职责说明
                  <textarea
                    value={roleDraft.description}
                    onChange={(event) =>
                      setRoleDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="说明该角色拥有的职责边界"
                  />
                </label>
                <label>
                  状态
                  <select
                    value={roleDraft.status}
                    onChange={(event) =>
                      setRoleDraft((current) => ({
                        ...current,
                        status: event.target.value,
                      }))
                    }
                  >
                    <option value="ENABLED">启用</option>
                    <option value="DISABLED">停用</option>
                  </select>
                </label>
              </section>
              <section className="drawer-section drawer-section--note">
                <h3>
                  <CircleCheck size={17} />
                  下一步
                </h3>
                <p>
                  角色创建后会出现在左侧目录。选中该角色，再点“新增授权”配置权限项、数据范围和必要的对象范围。
                </p>
              </section>
            </>
          )}
          {drawer.kind === "grant" && (
            <>
              <section className="drawer-section">
                <h3>
                  <KeyRound size={17} />
                  1. 选择权限项
                </h3>
                <label>
                  权限项
                  <select
                    value={grantDraft.code}
                    onChange={(event) => {
                      const next = permissionByCode(event.target.value);
                      setGrantDraft((current) => ({
                        ...current,
                        code: next.code,
                        scope: next.fixedScope ?? current.scope,
                        reference: next.fixedScope ? "" : current.reference,
                      }));
                    }}
                  >
                    {permissionItems.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.label} · {item.code}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="field-help">
                  权限项在“权限项目录”中登记；角色矩阵只对已登记项配置授权。
                </p>
              </section>
              <section className="drawer-section">
                <h3>
                  <SlidersHorizontal size={17} />
                  2. 设置数据范围
                </h3>
                <label>
                  数据范围
                  <select
                    disabled={scopeFixed}
                    value={grantDraft.scope}
                    onChange={(event) =>
                      setGrantDraft((current) => ({
                        ...current,
                        scope: event.target.value,
                        reference: "",
                      }))
                    }
                  >
                    {Object.entries(scopeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {scopeFixed && (
                  <p className="field-help field-help--warning">
                    <CircleAlert size={15} />
                    菜单可见性相关权限的数据范围固定为“全组织”，不可更改。
                  </p>
                )}
                {needsReference && (
                  <label>
                    对象引用
                    <input
                      value={grantDraft.reference}
                      onChange={(event) =>
                        setGrantDraft((current) => ({
                          ...current,
                          reference: event.target.value,
                        }))
                      }
                      placeholder="例如：项目 UUID 或对象标识"
                    />
                  </label>
                )}
              </section>
              <section className="drawer-section">
                <h3>
                  <FileText size={17} />
                  3. 附加条件 <small>（可选）</small>
                </h3>
                <label>
                  条件摘要
                  <textarea placeholder="例如：仅处理状态为进行中的项目" />
                </label>
                <p className="field-help">
                  条件用于补充边界，不会替代数据范围或服务端硬约束。
                </p>
              </section>
            </>
          )}
          {drawer.kind === "assignment" && (
            <>
              <section className="drawer-section assignment-context">
                <h3>
                  <ShieldCheck size={17} />
                  即将分配的角色
                </h3>
                <strong>{drawer.role.name}</strong>
                <p>{drawer.role.description}</p>
              </section>
              <section className="drawer-section">
                <h3>
                  <UsersRound size={17} />
                  选择启用账号
                </h3>
                <label className="account-option">
                  <input
                    type="radio"
                    value="liuchuanxin"
                    checked={account === "liuchuanxin"}
                    onChange={(event) => setAccount(event.target.value)}
                  />
                  <span>
                    <strong>刘传鑫</strong>
                    <small>liuchuanxin · 本地示例组织</small>
                  </span>
                </label>
                <label className="account-option">
                  <input
                    type="radio"
                    value="admin"
                    checked={account === "admin"}
                    onChange={(event) => setAccount(event.target.value)}
                  />
                  <span>
                    <strong>本地管理员</strong>
                    <small>admin · 本地示例组织</small>
                  </span>
                </label>
              </section>
              <section className="drawer-section drawer-section--note">
                <h3>
                  <CircleAlert size={17} />
                  完整替换说明
                </h3>
                <p>
                  正式保存时，系统角色授权以完整授权集写入并记录审计；本页面仅演示操作流，不改动真实账号。
                </p>
              </section>
            </>
          )}
          {error && (
            <p className="drawer-error" role="alert">
              <CircleAlert size={16} />
              {error}
            </p>
          )}
        </div>
        <footer className="drawer-footer">
          <button className="secondary-button" type="button" onClick={close}>
            {view ? "关闭" : "取消"}
          </button>
          {!view && (
            <button
              className="primary-button"
              type="button"
              onClick={
                drawer.kind === "resource"
                  ? saveResource
                  : drawer.kind === "role"
                    ? saveRole
                    : drawer.kind === "grant"
                      ? saveGrant
                      : assign
              }
            >
              {drawer.kind === "role" && drawer.mode === "create"
                ? "创建角色"
                : drawer.kind === "grant"
                  ? "保存授权"
                  : drawer.kind === "assignment"
                    ? "保存完整授权集"
                    : "保存"}
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}

export function App() {
  const [activePage, setActivePage] = useState("resources");
  const [resources, setResources] = useState(initialResources);
  const [roles, setRoles] = useState(initialRoles);
  const [grantsByRole, setGrantsByRole] = useState({
    "system-security-admin": initialGrants,
  });
  const [drawer, setDrawer] = useState(null);
  const [notice, setNotice] = useState("");
  const notify = (message) => {
    setNotice(message);
    window.setTimeout(
      () => setNotice((current) => (current === message ? "" : current)),
      4600,
    );
  };
  const title =
    activePage === "resources"
      ? "受控资源目录"
      : activePage === "roles"
        ? "角色与矩阵"
        : (tabs.find((tab) => tab.id === activePage)?.label ?? "菜单与权限");
  const subtitle =
    activePage === "resources"
      ? "routeKey、动作键和图标键只能从已发布注册表中选择；已引用资源仅可停用或调整，不能物理删除。"
      : activePage === "roles"
        ? "先维护权限项和菜单资源，再向角色授予权限项与数据范围。菜单可见不等于服务端操作获准。"
        : "本原型当前聚焦菜单资源与角色矩阵的完整操作流。";
  return (
    <main className="prototype-shell">
      <Sidebar activePage={activePage} onChange={setActivePage} />
      <section className="workspace">
        <header className="workspace-header">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="header-actions">
            <button className="header-icon" aria-label="查看通知" type="button">
              <Bell size={18} />
            </button>
            <button className="header-icon" aria-label="切换设置" type="button">
              <Settings2 size={18} />
            </button>
          </div>
        </header>
        <Tabs activePage={activePage} onChange={setActivePage} />
        <div className="page-area">
          {activePage === "resources" && (
            <ResourcePage
              resources={resources}
              setResources={setResources}
              openDrawer={setDrawer}
              setActivePage={setActivePage}
              notify={notify}
            />
          )}
          {activePage === "roles" && (
            <RolesPage
              roles={roles}
              setRoles={setRoles}
              grantsByRole={grantsByRole}
              setGrantsByRole={setGrantsByRole}
              openDrawer={setDrawer}
              setActivePage={setActivePage}
              notify={notify}
            />
          )}
          {!["resources", "roles"].includes(activePage) && (
            <SupportingPage page={activePage} setActivePage={setActivePage} />
          )}
        </div>
      </section>
      {notice && (
        <div className="toast" role="status">
          <CircleCheck size={17} />
          {notice}
        </div>
      )}
      <Drawer
        drawer={drawer}
        onClose={() => setDrawer(null)}
        resources={resources}
        setResources={setResources}
        roles={roles}
        setRoles={setRoles}
        setGrantsByRole={setGrantsByRole}
        notify={notify}
      />
    </main>
  );
}
