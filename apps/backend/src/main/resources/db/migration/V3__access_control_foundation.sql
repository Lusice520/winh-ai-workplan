CREATE TABLE menu_resource (
    id UUID PRIMARY KEY,
    code VARCHAR(120) NOT NULL,
    resource_type VARCHAR(24) NOT NULL,
    parent_id UUID NULL REFERENCES menu_resource(id),
    name VARCHAR(120) NOT NULL,
    route_key VARCHAR(120) NULL,
    action_key VARCHAR(120) NULL,
    icon_key VARCHAR(80) NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(24) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ux_menu_resource_code UNIQUE (code),
    CONSTRAINT ck_menu_resource_type CHECK (resource_type IN ('DIRECTORY', 'MENU_PAGE', 'OPERATION')),
    CONSTRAINT ck_menu_resource_status CHECK (status IN ('ENABLED', 'DISABLED')),
    CONSTRAINT ck_menu_resource_navigation_key CHECK (
        (resource_type = 'DIRECTORY' AND route_key IS NULL AND action_key IS NULL)
        OR (resource_type = 'MENU_PAGE' AND route_key IS NOT NULL AND action_key IS NULL)
        OR (resource_type = 'OPERATION' AND route_key IS NULL AND action_key IS NOT NULL)
    )
);

CREATE UNIQUE INDEX ux_menu_resource_route_key ON menu_resource(route_key) WHERE route_key IS NOT NULL;
CREATE UNIQUE INDEX ux_menu_resource_action_key ON menu_resource(action_key) WHERE action_key IS NOT NULL;
CREATE INDEX ix_menu_resource_parent_sort ON menu_resource(parent_id, sort_order, name);

CREATE TABLE permission_item (
    id UUID PRIMARY KEY,
    code VARCHAR(120) NOT NULL,
    menu_resource_id UUID NULL REFERENCES menu_resource(id),
    name VARCHAR(160) NOT NULL,
    action_key VARCHAR(120) NOT NULL,
    dimension VARCHAR(32) NOT NULL,
    risk_level VARCHAR(24) NOT NULL,
    can_delegate BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(24) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ux_permission_item_code UNIQUE (code),
    CONSTRAINT ck_permission_item_dimension CHECK (dimension IN ('MENU', 'ACTION', 'DATA_SCOPE', 'SENSITIVE_FIELD', 'FILE_ACTION', 'SYSTEM_CONFIGURATION')),
    CONSTRAINT ck_permission_item_risk CHECK (risk_level IN ('NORMAL', 'HIGH')),
    CONSTRAINT ck_permission_item_status CHECK (status IN ('ENABLED', 'DISABLED'))
);

CREATE UNIQUE INDEX ux_permission_item_menu_action ON permission_item(menu_resource_id, action_key) WHERE menu_resource_id IS NOT NULL;
CREATE INDEX ix_permission_item_action_key ON permission_item(action_key);

CREATE TABLE access_role (
    id UUID PRIMARY KEY,
    code VARCHAR(120) NOT NULL,
    name VARCHAR(120) NOT NULL,
    role_type VARCHAR(24) NOT NULL,
    responsibility_summary VARCHAR(1000) NOT NULL,
    status VARCHAR(24) NOT NULL,
    delegation_level INTEGER NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ux_access_role_type_code UNIQUE (role_type, code),
    CONSTRAINT ck_access_role_type CHECK (role_type IN ('SYSTEM', 'PROJECT', 'STAGE')),
    CONSTRAINT ck_access_role_status CHECK (status IN ('DRAFT', 'ENABLED', 'DISABLED')),
    CONSTRAINT ck_access_role_delegation_level CHECK (delegation_level >= 0)
);

CREATE TABLE role_permission_grant (
    id UUID PRIMARY KEY,
    role_id UUID NOT NULL REFERENCES access_role(id),
    permission_item_id UUID NOT NULL REFERENCES permission_item(id),
    data_scope VARCHAR(40) NOT NULL,
    scope_references TEXT NULL,
    condition_summary VARCHAR(1000) NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ux_role_permission_grant UNIQUE (role_id, permission_item_id, data_scope, scope_references),
    CONSTRAINT ck_role_permission_grant_scope CHECK (data_scope IN ('SELF', 'OWN_ORG', 'OWN_ORG_AND_DESCENDANTS', 'NAMED_ORG_UNITS', 'PARTICIPATING_PROJECTS', 'NAMED_PROJECTS', 'NAMED_OBJECTS', 'ALL_ORGANIZATION', 'ALL_PROJECTS'))
);

CREATE INDEX ix_role_permission_grant_role ON role_permission_grant(role_id);
CREATE INDEX ix_role_permission_grant_permission ON role_permission_grant(permission_item_id);

CREATE TABLE system_role_assignment (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES user_account(id),
    role_id UUID NOT NULL REFERENCES access_role(id),
    status VARCHAR(24) NOT NULL,
    assigned_by_account_id UUID NULL REFERENCES user_account(id),
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ux_system_role_assignment UNIQUE (account_id, role_id),
    CONSTRAINT ck_system_role_assignment_status CHECK (status IN ('ACTIVE', 'REVOKED'))
);

CREATE INDEX ix_system_role_assignment_account_status ON system_role_assignment(account_id, status);
CREATE INDEX ix_system_role_assignment_role_status ON system_role_assignment(role_id, status);

CREATE TABLE temporary_grant (
    id UUID PRIMARY KEY,
    recipient_account_id UUID NOT NULL REFERENCES user_account(id),
    permission_item_id UUID NOT NULL REFERENCES permission_item(id),
    data_scope VARCHAR(40) NOT NULL,
    scope_references TEXT NULL,
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    reviewer_account_id UUID NULL REFERENCES user_account(id),
    status VARCHAR(24) NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE NULL,
    revoked_by_account_id UUID NULL REFERENCES user_account(id),
    revoke_reason VARCHAR(1000) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_temporary_grant_scope CHECK (data_scope IN ('SELF', 'OWN_ORG', 'OWN_ORG_AND_DESCENDANTS', 'NAMED_ORG_UNITS', 'PARTICIPATING_PROJECTS', 'NAMED_PROJECTS', 'NAMED_OBJECTS', 'ALL_ORGANIZATION', 'ALL_PROJECTS')),
    CONSTRAINT ck_temporary_grant_status CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
    CONSTRAINT ck_temporary_grant_window CHECK (ends_at > starts_at)
);

CREATE INDEX ix_temporary_grant_recipient_window ON temporary_grant(recipient_account_id, status, starts_at, ends_at);
CREATE INDEX ix_temporary_grant_expiry ON temporary_grant(status, ends_at);

INSERT INTO menu_resource (id, code, resource_type, parent_id, name, route_key, action_key, icon_key, sort_order, status)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'SYSTEM_MANAGEMENT', 'DIRECTORY', NULL, '系统管理', NULL, NULL, 'settings', 100, 'ENABLED'),
    ('10000000-0000-0000-0000-000000000002', 'SYSTEM_OVERVIEW', 'MENU_PAGE', '10000000-0000-0000-0000-000000000001', '工作台', 'system.overview', NULL, 'gauge', 10, 'ENABLED'),
    ('10000000-0000-0000-0000-000000000003', 'ORGANIZATION_USERS', 'MENU_PAGE', '10000000-0000-0000-0000-000000000001', '组织与用户', 'system.organization-users', NULL, 'users', 20, 'ENABLED'),
    ('10000000-0000-0000-0000-000000000004', 'ACCESS_CONTROL', 'MENU_PAGE', '10000000-0000-0000-0000-000000000001', '菜单与权限', 'system.access-control', NULL, 'shield-check', 30, 'ENABLED'),
    ('10000000-0000-0000-0000-000000000005', 'ORGANIZATION_USER_MANAGEMENT', 'OPERATION', '10000000-0000-0000-0000-000000000003', '组织与用户管理操作', NULL, 'iam.organization-user.manage', 'users-cog', 10, 'ENABLED'),
    ('10000000-0000-0000-0000-000000000006', 'ACCESS_CONTROL_MANAGEMENT', 'OPERATION', '10000000-0000-0000-0000-000000000004', '菜单与权限管理操作', NULL, 'iam.access-control.manage', 'shield-cog', 10, 'ENABLED');

INSERT INTO permission_item (id, code, menu_resource_id, name, action_key, dimension, risk_level, can_delegate, status)
VALUES
    ('20000000-0000-0000-0000-000000000001', 'NAV_SYSTEM_OVERVIEW_VIEW', '10000000-0000-0000-0000-000000000002', '查看工作台菜单', 'nav.system.overview.view', 'MENU', 'NORMAL', TRUE, 'ENABLED'),
    ('20000000-0000-0000-0000-000000000002', 'NAV_IAM_ORGANIZATION_USERS_VIEW', '10000000-0000-0000-0000-000000000003', '查看组织与用户菜单', 'nav.iam.organization-users.view', 'MENU', 'NORMAL', TRUE, 'ENABLED'),
    ('20000000-0000-0000-0000-000000000003', 'NAV_IAM_ACCESS_CONTROL_VIEW', '10000000-0000-0000-0000-000000000004', '查看菜单与权限菜单', 'nav.iam.access-control.view', 'MENU', 'HIGH', TRUE, 'ENABLED'),
    ('20000000-0000-0000-0000-000000000004', 'IAM_ORGANIZATION_READ', '10000000-0000-0000-0000-000000000005', '读取组织目录', 'iam.organization.read', 'ACTION', 'NORMAL', TRUE, 'ENABLED'),
    ('20000000-0000-0000-0000-000000000005', 'IAM_ORGANIZATION_MANAGE', '10000000-0000-0000-0000-000000000005', '维护组织目录', 'iam.organization.manage', 'ACTION', 'HIGH', TRUE, 'ENABLED'),
    ('20000000-0000-0000-0000-000000000006', 'IAM_USER_READ', '10000000-0000-0000-0000-000000000005', '读取用户目录', 'iam.user.read', 'ACTION', 'NORMAL', TRUE, 'ENABLED'),
    ('20000000-0000-0000-0000-000000000007', 'IAM_USER_MANAGE', '10000000-0000-0000-0000-000000000005', '维护用户账号', 'iam.user.manage', 'ACTION', 'HIGH', TRUE, 'ENABLED'),
    ('20000000-0000-0000-0000-000000000008', 'IAM_MENU_RESOURCE_READ', '10000000-0000-0000-0000-000000000006', '读取菜单资源', 'iam.menu-resource.read', 'ACTION', 'NORMAL', TRUE, 'ENABLED'),
    ('20000000-0000-0000-0000-000000000009', 'IAM_MENU_RESOURCE_MANAGE', '10000000-0000-0000-0000-000000000006', '维护菜单资源', 'iam.menu-resource.manage', 'ACTION', 'HIGH', TRUE, 'ENABLED'),
    ('20000000-0000-0000-0000-000000000010', 'IAM_PERMISSION_ITEM_READ', '10000000-0000-0000-0000-000000000006', '读取权限项目录', 'iam.permission-item.read', 'ACTION', 'NORMAL', TRUE, 'ENABLED'),
    ('20000000-0000-0000-0000-000000000011', 'IAM_ROLE_READ', '10000000-0000-0000-0000-000000000006', '读取角色目录', 'iam.role.read', 'ACTION', 'NORMAL', TRUE, 'ENABLED'),
    ('20000000-0000-0000-0000-000000000012', 'IAM_ROLE_MANAGE', '10000000-0000-0000-0000-000000000006', '维护角色与权限矩阵', 'iam.role.manage', 'ACTION', 'HIGH', TRUE, 'ENABLED'),
    ('20000000-0000-0000-0000-000000000013', 'IAM_SYSTEM_ROLE_ASSIGNMENT_READ', '10000000-0000-0000-0000-000000000006', '读取系统角色授权', 'iam.system-role-assignment.read', 'ACTION', 'NORMAL', TRUE, 'ENABLED'),
    ('20000000-0000-0000-0000-000000000014', 'IAM_SYSTEM_ROLE_ASSIGNMENT_MANAGE', '10000000-0000-0000-0000-000000000006', '维护系统角色授权', 'iam.system-role-assignment.manage', 'ACTION', 'HIGH', TRUE, 'ENABLED'),
    ('20000000-0000-0000-0000-000000000015', 'IAM_TEMPORARY_GRANT_READ', '10000000-0000-0000-0000-000000000006', '读取临时授权', 'iam.temporary-grant.read', 'ACTION', 'NORMAL', TRUE, 'ENABLED'),
    ('20000000-0000-0000-0000-000000000016', 'IAM_TEMPORARY_GRANT_MANAGE', '10000000-0000-0000-0000-000000000006', '维护临时授权', 'iam.temporary-grant.manage', 'ACTION', 'HIGH', TRUE, 'ENABLED'),
    ('20000000-0000-0000-0000-000000000017', 'IAM_PERMISSION_PREVIEW', '10000000-0000-0000-0000-000000000006', '预览实际权限', 'iam.permission-preview', 'ACTION', 'HIGH', TRUE, 'ENABLED');

INSERT INTO access_role (id, code, name, role_type, responsibility_summary, status, delegation_level)
VALUES
    ('30000000-0000-0000-0000-000000000001', 'SYSTEM_SECURITY_ADMIN', '系统安全管理员', 'SYSTEM', '维护菜单资源、角色、系统角色授权、临时授权与权限排查。', 'ENABLED', 100);

INSERT INTO role_permission_grant (id, role_id, permission_item_id, data_scope)
SELECT
    ('40000000-0000-0000-0000-' || lpad(row_number() OVER (ORDER BY id)::text, 12, '0'))::UUID,
    '30000000-0000-0000-0000-000000000001',
    id,
    'ALL_ORGANIZATION'
FROM permission_item;

INSERT INTO system_role_assignment (id, account_id, role_id, status, assigned_by_account_id)
SELECT
    ('50000000-0000-0000-0000-' || lpad(row_number() OVER (ORDER BY id)::text, 12, '0'))::UUID,
    id,
    '30000000-0000-0000-0000-000000000001',
    'ACTIVE',
    id
FROM user_account
WHERE bootstrap_system_administrator = TRUE
ON CONFLICT (account_id, role_id) DO NOTHING;
