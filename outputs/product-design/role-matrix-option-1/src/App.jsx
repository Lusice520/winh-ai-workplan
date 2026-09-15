import { useMemo, useState } from "react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  FileKey2,
  FileText,
  Home,
  Info,
  Menu,
  PencilLine,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";

const roles = [
  { id: "project-manager", name: "项目管理员", count: 12, description: "负责项目、成员与进度的日常管理。" },
  { id: "engineer", name: "开发工程师", count: 8, description: "负责项目执行、任务协作与交付材料维护。" },
  { id: "tester", name: "测试工程师", count: 6, description: "负责测试计划、测试执行与缺陷跟踪。" },
  { id: "ops", name: "运维工程师", count: 9, description: "负责环境、发布和运行状态维护。" },
  { id: "auditor", name: "审计员", count: 7, description: "负责查看审计材料与合规核验。" },
  {
    id: "system-security-admin",
    name: "系统安全管理员",
    count: 17,
    description: "负责系统安全策略配置、权限管理与审计。",
  },
  { id: "visitor", name: "只读访客", count: 3, description: "仅查看已获授权的公开或协作内容。" },
];

const permissions = [
  { code: "IAM_MENU_RESOURCE_MANAGE", label: "维护菜单资源", dimension: "MENU", defaultScope: "ALL_ORGANIZATION" },
  { code: "IAM_MENU_RESOURCE_READ", label: "读取菜单资源", dimension: "MENU", defaultScope: "ALL_ORGANIZATION" },
  { code: "IAM_ORGANIZATION_MANAGE", label: "维护组织目录", dimension: "ORGANIZATION", defaultScope: "ALL_ORGANIZATION" },
  { code: "IAM_ORGANIZATION_READ", label: "读取组织目录", dimension: "ORGANIZATION", defaultScope: "ALL_ORGANIZATION" },
  { code: "IAM_PERMISSION_ITEM_READ", label: "读取权限项目", dimension: "PERMISSION", defaultScope: "ALL_ORGANIZATION" },
  { code: "IAM_PERMISSION_PREVIEW", label: "预览实际权限", dimension: "PERMISSION", defaultScope: "ALL_ORGANIZATION" },
  { code: "PROJECT_TASK_MANAGE", label: "维护项目任务", dimension: "PROJECT", defaultScope: "NAMED_PROJECT" },
  { code: "PROJECT_DOCUMENT_READ", label: "读取项目文档", dimension: "PROJECT", defaultScope: "NAMED_PROJECT" },
];

const scopeOptions = [
  { value: "ALL_ORGANIZATION", label: "全组织" },
  { value: "NAMED_ORGANIZATION", label: "指定组织" },
  { value: "NAMED_PROJECT", label: "指定项目" },
  { value: "OBJECTS", label: "指定对象" },
  { value: "PERSONAL", label: "仅本人" },
];

const initialMatrix = [
  { code: "IAM_MENU_RESOURCE_MANAGE", scope: "ALL_ORGANIZATION", reference: "", condition: "" },
  { code: "IAM_MENU_RESOURCE_READ", scope: "ALL_ORGANIZATION", reference: "", condition: "" },
  { code: "IAM_ORGANIZATION_MANAGE", scope: "ALL_ORGANIZATION", reference: "", condition: "" },
  { code: "IAM_ORGANIZATION_READ", scope: "ALL_ORGANIZATION", reference: "", condition: "" },
  { code: "IAM_PERMISSION_ITEM_READ", scope: "ALL_ORGANIZATION", reference: "", condition: "" },
  { code: "IAM_PERMISSION_PREVIEW", scope: "ALL_ORGANIZATION", reference: "", condition: "" },
];

const requiresReference = (scope) => ["NAMED_ORGANIZATION", "NAMED_PROJECT", "OBJECTS"].includes(scope);
const permissionLabel = (code) => permissions.find((item) => item.code === code)?.label ?? code;
const scopeLabel = (scope) => scopeOptions.find((item) => item.value === scope)?.label ?? scope;

function draftFor(permissionCode = permissions[0].code) {
  const permission = permissions.find((item) => item.code === permissionCode) ?? permissions[0];
  return { code: permission.code, scope: permission.defaultScope, reference: "", condition: "" };
}

function roleFormFor(role) {
  return {
    name: role.name,
    code: role.id.toUpperCase().replaceAll("-", "_"),
    description: role.description,
  };
}

function NavItem({ icon: Icon, label, active = false }) {
  return (
    <button className={`nav-item${active ? " nav-item--active" : ""}`} type="button">
      <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
      <span>{label}</span>
    </button>
  );
}

export function App() {
  const [activeRoleId, setActiveRoleId] = useState("system-security-admin");
  const [createdRoles, setCreatedRoles] = useState([]);
  const [matrixByRole, setMatrixByRole] = useState({ "system-security-admin": initialMatrix });
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [creatingRole, setCreatingRole] = useState(false);
  const [roleForm, setRoleForm] = useState(() => roleFormFor(roles[5]));
  const [draftOpen, setDraftOpen] = useState(true);
  const [draft, setDraft] = useState(draftFor());
  const [editingIndex, setEditingIndex] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const allRoles = [...roles, ...createdRoles];
  const activeRole = allRoles.find((role) => role.id === activeRoleId) ?? roles[0];
  const grants = creatingRole ? [] : (matrixByRole[activeRoleId] ?? initialMatrix);
  const selectedPermission = permissions.find((permission) => permission.code === draft.code) ?? permissions[0];
  const menuScopeLocked = selectedPermission.dimension === "MENU";
  const showReference = requiresReference(draft.scope);
  const matrixTotal = activeRole.id === "system-security-admin"
    ? 17 + Math.max(0, grants.length - initialMatrix.length)
    : Math.max(activeRole.count, grants.length);
  const draftOrdinal = editingIndex === null ? matrixTotal + 1 : editingIndex + 1;
  const roleCountText = useMemo(
    () => (activeRole.id !== "system-security-admin" ? activeRole.count : Math.max(17, matrixTotal)),
    [activeRole.count, activeRole.id, matrixTotal],
  );

  function chooseRole(roleId) {
    const role = allRoles.find((item) => item.id === roleId);
    if (!role) return;
    setActiveRoleId(roleId);
    setRoleForm(roleFormFor(role));
    setCreatingRole(false);
    setDrawerOpen(true);
    setDraftOpen(false);
    setEditingIndex(null);
    setNotice("");
  }

  function beginNewRole() {
    setCreatingRole(true);
    setRoleForm({ name: "", code: "", description: "" });
    setDrawerOpen(true);
    setDraftOpen(false);
    setEditingIndex(null);
    setNotice("");
  }

  function updateRoleForm(field, value) {
    setRoleForm((current) => ({ ...current, [field]: value }));
  }

  function createRoleAndAuthorize() {
    const name = roleForm.name.trim();
    const code = roleForm.code.trim().toUpperCase().replaceAll(/[^A-Z0-9_]+/g, "_");
    if (!name || !code) {
      setNotice("请先填写角色名称与角色标识，再配置第一条授权。");
      return;
    }
    if (allRoles.some((role) => role.id === code.toLowerCase())) {
      setNotice("该角色标识已存在，请更换后再创建。");
      return;
    }

    const newRole = { id: code.toLowerCase(), name, count: 0, description: roleForm.description.trim() };
    setCreatedRoles((current) => [...current, newRole]);
    setMatrixByRole((current) => ({ ...current, [newRole.id]: [] }));
    setActiveRoleId(newRole.id);
    setRoleForm({ name, code, description: newRole.description });
    setCreatingRole(false);
    setDraft(draftFor());
    setDraftOpen(true);
    setNotice(`角色“${name}”已创建，现在配置第一条授权（仅原型状态）。`);
  }

  function openNewDraft() {
    setDraft(draftFor());
    setEditingIndex(null);
    setAdvancedOpen(false);
    setDraftOpen(true);
    setNotice("");
  }

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function changePermission(code) {
    const permission = permissions.find((item) => item.code === code) ?? permissions[0];
    setDraft({ code: permission.code, scope: permission.defaultScope, reference: "", condition: "" });
  }

  function changeScope(scope) {
    if (menuScopeLocked) return;
    setDraft((current) => ({ ...current, scope, reference: requiresReference(scope) ? current.reference : "" }));
  }

  function saveDraft() {
    if (showReference && !draft.reference.trim()) {
      setNotice("请先填写对象引用；指定组织、项目或对象必须明确范围。");
      return;
    }

    setMatrixByRole((current) => {
      const existing = current[activeRoleId] ?? initialMatrix;
      const next = editingIndex === null
        ? [...existing, { ...draft }]
        : existing.map((grant, index) => (index === editingIndex ? { ...draft } : grant));
      return { ...current, [activeRoleId]: next };
    });
    setNotice(editingIndex === null ? "已加入权限矩阵（仅原型状态）。" : "授权条目已更新（仅原型状态）。");
    setDraftOpen(false);
    setEditingIndex(null);
  }

  function editGrant(index) {
    const grant = grants[index];
    setDraft({ ...grant });
    setEditingIndex(index);
    setAdvancedOpen(Boolean(grant.condition));
    setDraftOpen(true);
    setNotice("");
  }

  function deleteGrant(index) {
    setMatrixByRole((current) => ({
      ...current,
      [activeRoleId]: (current[activeRoleId] ?? initialMatrix).filter((_, grantIndex) => grantIndex !== index),
    }));
    setNotice("授权条目已移出矩阵（仅原型状态）。");
  }

  return (
    <main className="prototype-shell">
      <aside className="app-sidebar" aria-label="主导航">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><BriefcaseBusiness size={20} /></span>
          <span>项目工作台</span>
          <ChevronDown size={16} aria-hidden="true" />
        </div>

        <nav className="side-navigation">
          <NavItem icon={Home} label="概览" />
          <p className="nav-section-label">身份与访问</p>
          <NavItem icon={UsersRound} label="用户" />
          <NavItem icon={UsersRound} label="用户组" />
          <NavItem icon={ShieldCheck} label="角色" active />
          <NavItem icon={FileKey2} label="权限项" />
          <NavItem icon={ClipboardCheck} label="权限模板" />
          <p className="nav-section-label">审计</p>
          <NavItem icon={ClipboardCheck} label="操作日志" />
          <NavItem icon={FileText} label="访问日志" />
          <NavItem icon={BadgeCheck} label="登录日志" />
          <p className="nav-section-label">设置</p>
          <NavItem icon={FileText} label="策略配置" />
          <NavItem icon={Settings2} label="系统设置" />
        </nav>

        <button className="account-switcher" type="button" aria-label="打开管理员账户菜单">
          <span className="account-avatar">A</span>
          <span>admin</span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </aside>

      <section className="role-catalog" aria-label="角色列表">
        <header className="catalog-heading">
          <h1>角色</h1>
          <p>角色是权限配置的集合，用于授予用户一组权限。</p>
        </header>
        <div className="catalog-action-row">
          <button className="primary-button" type="button" onClick={beginNewRole}>
            <Plus size={18} aria-hidden="true" />
            新建角色
          </button>
        </div>
        <div className="role-table" role="list" aria-label="可管理角色">
          <div className="role-table__head">角色名称</div>
          {allRoles.map((role) => {
            const count = role.id === activeRole.id ? roleCountText : role.count;
            return (
              <button
                className={`role-row${role.id === activeRole.id ? " role-row--selected" : ""}`}
                key={role.id}
                onClick={() => chooseRole(role.id)}
                type="button"
                role="listitem"
              >
                <span className="role-row__icon"><ShieldCheck size={17} aria-hidden="true" /></span>
                <span className="role-row__copy">
                  <strong>{role.name}</strong>
                  <small>{count} 个权限</small>
                </span>
              </button>
            );
          })}
          <footer className="role-table__footer">共 {allRoles.length} 条</footer>
        </div>
      </section>

      {drawerOpen ? (
        <section className="editor-drawer" aria-label={creatingRole ? "新建角色与权限矩阵" : `编辑 ${activeRole.name} 与权限矩阵`}>
          <header className="drawer-header">
            <h2>{creatingRole ? "新建角色与权限矩阵" : "编辑角色与权限矩阵"}</h2>
            <button className="icon-button" onClick={() => setDrawerOpen(false)} type="button" aria-label="关闭编辑面板">
              <X size={20} aria-hidden="true" />
            </button>
          </header>

          <div className="drawer-content">
            <section className="definition-card">
              <div className="section-heading"><h3>角色定义</h3></div>
              <div className="definition-grid">
                <label>
                  <span><b>*</b> 角色名称</span>
                  <input value={roleForm.name} onChange={(event) => updateRoleForm("name", event.target.value)} placeholder={creatingRole ? "例如：项目交付经理" : undefined} aria-label="角色名称" />
                </label>
                <label>
                  <span>角色标识</span>
                  <input value={roleForm.code} onChange={(event) => updateRoleForm("code", event.target.value)} placeholder={creatingRole ? "例如：PROJECT_DELIVERY_MANAGER" : undefined} aria-label="角色标识" />
                </label>
                <label className="definition-grid__wide">
                  <span>角色描述 <em>（可选）</em></span>
                  <textarea value={roleForm.description} onChange={(event) => updateRoleForm("description", event.target.value)} placeholder={creatingRole ? "说明该角色的职责边界" : undefined} aria-label="角色描述" />
                </label>
                {creatingRole ? (
                  <div className="role-creation-guide definition-grid__wide">
                    <p>先创建角色，再在同一抽屉中配置第一条授权。</p>
                    <button className="primary-button primary-button--compact" type="button" onClick={createRoleAndAuthorize}>创建角色并进入授权</button>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="matrix-card">
              <header className="matrix-header">
                <h3>权限矩阵</h3>
                <button className="primary-button primary-button--compact" onClick={openNewDraft} type="button" disabled={creatingRole}>
                  <Plus size={16} aria-hidden="true" />
                  新增授权
                </button>
              </header>

              {notice ? <div className="matrix-notice" role="status"><Info size={16} aria-hidden="true" />{notice}</div> : null}

              {creatingRole ? <div className="matrix-empty"><ShieldCheck size={22} aria-hidden="true" /><strong>等待创建角色</strong><span>完成角色定义后，这里将自动打开“新增授权”。</span></div> : null}

              {!creatingRole && draftOpen ? (
                <section className="grant-editor" aria-label={editingIndex === null ? "新增授权条目" : "编辑授权条目"}>
                  <div className="grant-editor__title">
                    <strong>正在{editingIndex === null ? "新增" : "编辑"}第 {draftOrdinal} 条授权</strong>
                    <span>未保存</span>
                  </div>
                  <div className="workflow-row">
                    <span className="step-badge">1</span>
                    <label className="grant-field grant-field--permission">
                      <span>选择权限项</span>
                      <span className="select-control select-control--search">
                        <Search size={16} aria-hidden="true" />
                        <select value={draft.code} onChange={(event) => changePermission(event.target.value)} aria-label="选择权限项">
                          {permissions.map((permission) => <option key={permission.code} value={permission.code}>{permission.label} / {permission.code}</option>)}
                        </select>
                      </span>
                    </label>
                  </div>

                  <div className="workflow-row workflow-row--scope">
                    <span className="step-badge">2</span>
                    <label className="grant-field">
                      <span>数据范围</span>
                      <span className="select-control">
                        <select value={draft.scope} onChange={(event) => changeScope(event.target.value)} disabled={menuScopeLocked} aria-label="选择数据范围">
                          {scopeOptions.map((scope) => <option key={scope.value} value={scope.value}>{scope.label}</option>)}
                        </select>
                        <ChevronDown size={17} aria-hidden="true" />
                      </span>
                    </label>
                    {showReference ? (
                      <label className="grant-field grant-field--reference">
                        <span>对象引用</span>
                        <input value={draft.reference} onChange={(event) => updateDraft("reference", event.target.value)} placeholder="输入 UUID，以逗号分隔" aria-label="对象引用" />
                      </label>
                    ) : null}
                  </div>

                  {menuScopeLocked ? <p className="scope-rule"><Info size={16} aria-hidden="true" />菜单可见性相关权限的数据范围固定为“全组织”，不可更改。</p> : null}

                  <button className="advanced-toggle" type="button" onClick={() => setAdvancedOpen((open) => !open)} aria-expanded={advancedOpen}>
                    {advancedOpen ? <ChevronUp size={17} aria-hidden="true" /> : <ChevronRight size={17} aria-hidden="true" />}
                    高级条件 <span>（可选）</span>
                  </button>

                  {advancedOpen ? (
                    <label className="condition-field">
                      <span>附加条件</span>
                      <textarea value={draft.condition} onChange={(event) => updateDraft("condition", event.target.value)} placeholder="例如：仅处理状态为进行中的项目" aria-label="附加条件" />
                      <small>条件用于补充边界，不会替代数据范围。</small>
                    </label>
                  ) : null}

                  <div className="grant-editor__actions">
                    <button className="secondary-button" onClick={() => { setDraftOpen(false); setEditingIndex(null); setNotice(""); }} type="button">取消</button>
                    <button className="primary-button primary-button--compact" onClick={saveDraft} type="button">{editingIndex === null ? "加入矩阵" : "保存修改"}</button>
                  </div>
                </section>
              ) : null}

              {!creatingRole ? <div className="matrix-table" role="table" aria-label="当前角色的权限矩阵">
                <div className="matrix-table__head" role="row">
                  <span role="columnheader">权限项</span>
                  <span role="columnheader">数据范围</span>
                  <span role="columnheader">限定对象／条件</span>
                  <span role="columnheader">操作</span>
                </div>
                {grants.map((grant, index) => (
                  <div className="matrix-table__row" role="row" key={`${grant.code}-${index}`}>
                    <span className="permission-cell" role="cell"><strong>{permissionLabel(grant.code)}</strong><small>{grant.code}</small></span>
                    <span role="cell"><i className={`scope-tag scope-tag--${grant.scope.toLowerCase()}`}>{scopeLabel(grant.scope)}</i></span>
                    <span className="rule-cell" role="cell">{grant.reference || grant.condition || "—"}</span>
                    <span className="row-actions" role="cell">
                      <button className="icon-button icon-button--table" type="button" onClick={() => editGrant(index)} aria-label={`编辑 ${permissionLabel(grant.code)}`}><PencilLine size={17} aria-hidden="true" /></button>
                      <button className="icon-button icon-button--danger" type="button" onClick={() => deleteGrant(index)} aria-label={`移除 ${permissionLabel(grant.code)}`}><Trash2 size={17} aria-hidden="true" /></button>
                    </span>
                  </div>
                ))}
              </div> : null}
            </section>
          </div>
        </section>
      ) : (
        <section className="drawer-closed" aria-label="编辑面板已关闭">
          <Menu size={24} aria-hidden="true" />
          <h2>角色详情已收起</h2>
          <p>选择一个角色后，在同一处维护其权限矩阵。</p>
          <button className="primary-button" type="button" onClick={() => setDrawerOpen(true)}>重新打开编辑面板</button>
        </section>
      )}
    </main>
  );
}
