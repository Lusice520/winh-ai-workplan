-- WI-010: immutable delivery configuration editions; no company policy or person is pre-approved.

CREATE TABLE delivery_configuration_series (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    kind VARCHAR(32) NOT NULL CHECK (kind IN ('STAGE_TEMPLATE','REVIEW_POLICY')),
    latest_edition INTEGER NOT NULL CHECK (latest_edition > 0)
);

CREATE TABLE delivery_configuration_edition (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    series_id UUID NOT NULL REFERENCES delivery_configuration_series(id),
    edition INTEGER NOT NULL CHECK (edition > 0),
    kind VARCHAR(32) NOT NULL CHECK (kind IN ('STAGE_TEMPLATE','REVIEW_POLICY')),
    name VARCHAR(160) NOT NULL,
    status VARCHAR(24) NOT NULL CHECK (status IN ('DRAFT','PUBLISHED','RETIRED')),
    version_note VARCHAR(2000) NOT NULL,
    definition_json TEXT NOT NULL CHECK (octet_length(definition_json) <= 131072),
    created_by UUID NOT NULL REFERENCES user_account(id),
    published_by UUID REFERENCES user_account(id),
    published_at TIMESTAMPTZ,
    snapshot_hash VARCHAR(64),
    retired_by UUID REFERENCES user_account(id),
    retired_at TIMESTAMPTZ,
    retirement_reason VARCHAR(2000),
    UNIQUE (series_id, edition),
    CHECK ((status='DRAFT' AND published_by IS NULL AND published_at IS NULL AND snapshot_hash IS NULL)
        OR (status IN ('PUBLISHED','RETIRED') AND published_by IS NOT NULL AND published_at IS NOT NULL AND snapshot_hash IS NOT NULL)),
    CHECK (status<>'RETIRED' OR (retired_by IS NOT NULL AND retired_at IS NOT NULL AND retirement_reason IS NOT NULL))
);

CREATE UNIQUE INDEX ux_delivery_configuration_draft ON delivery_configuration_edition(series_id) WHERE status='DRAFT';

CREATE INDEX ix_delivery_configuration_kind_status ON delivery_configuration_edition(kind,status,updated_at DESC);

INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('e9f227ff-5be5-52bd-8e95-7d2c693e4ba2','DELIVERY_CONFIG_READ','查看交付模板与评审规则','delivery.config.read','SYSTEM_CONFIGURATION','NORMAL',TRUE,'ENABLED');

INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('50e3ea5a-3e1c-5bc3-aca3-56d4cf4a3280','DELIVERY_TEMPLATE_MANAGE','维护和发布项目阶段模板','delivery.template.manage','SYSTEM_CONFIGURATION','HIGH',TRUE,'ENABLED');

INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('7391dfd4-f8db-5233-bb6d-c528042d77d3','DELIVERY_POLICY_MANAGE','维护交付评审规则草稿','delivery.policy.manage','SYSTEM_CONFIGURATION','HIGH',TRUE,'ENABLED');

INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('18954797-bb17-5e4a-85d0-bcf34bcb7eb0','DELIVERY_POLICY_PUBLISH','按公司授权发布或退役交付评审规则','delivery.policy.publish','SYSTEM_CONFIGURATION','HIGH',TRUE,'ENABLED');

INSERT INTO menu_resource(id,code,resource_type,parent_id,name,route_key,icon_key,sort_order,status) VALUES ('817b5089-8f32-542f-b46c-06ee5ae2b6f2','DELIVERY_CONFIGURATION','MENU_PAGE','10000000-0000-0000-0000-000000000001','交付模板与规则','system.delivery-configuration','layers',40,'ENABLED');

INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('0f57d3d4-ebe2-5efb-b21f-ac67b8a39ee0','NAV_DELIVERY_CONFIGURATION_VIEW','817b5089-8f32-542f-b46c-06ee5ae2b6f2','查看交付模板与规则菜单','nav.delivery.configuration.view','MENU','NORMAL',TRUE,'ENABLED');

INSERT INTO access_role(id,code,name,role_type,responsibility_summary,status,delegation_level) VALUES ('71c7f364-b719-5000-a990-598cc202d8e2','DELIVERY_GOVERNANCE_ADMIN','交付治理配置人','SYSTEM','维护模板和评审规则草稿；不因配置权限取得公司授权发布或项目批准权。','ENABLED',70);

INSERT INTO access_role(id,code,name,role_type,responsibility_summary,status,delegation_level) VALUES ('b4f50366-d837-5a80-ba99-47f28d754a9c','DELIVERY_AUTHORIZER','交付公司授权人','SYSTEM','须显式分配；可发布交付评审规则，项目批准仍须独立业务校验。','ENABLED',70);

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '913cf830-383e-5edf-b3f0-8ea7a8433675',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='DELIVERY_CONFIG_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd16ee119-ba0a-5531-ae50-8627c3b9dd76',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='DELIVERY_TEMPLATE_MANAGE';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '5aa40d84-bb1d-5409-8297-461552650b57',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='DELIVERY_POLICY_MANAGE';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '04b5d2d4-d86a-59e1-8492-ba599f62fa1e',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='NAV_DELIVERY_CONFIGURATION_VIEW';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '23dfdea8-2831-5772-82de-72355fb8f225',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='DELIVERY_GOVERNANCE_ADMIN' AND p.code='DELIVERY_CONFIG_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'c38b5969-1bab-5def-8110-8a31db5b016d',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='DELIVERY_GOVERNANCE_ADMIN' AND p.code='DELIVERY_TEMPLATE_MANAGE';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '667c03a7-ca91-51ac-808f-2bd8669ed321',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='DELIVERY_GOVERNANCE_ADMIN' AND p.code='DELIVERY_POLICY_MANAGE';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '41128b0d-eb8a-507f-a1f2-d7a83a2d6768',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='DELIVERY_GOVERNANCE_ADMIN' AND p.code='BUSINESS_PEOPLE_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '11e6db38-9a37-5d96-a2f8-b0a71986af18',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='DELIVERY_GOVERNANCE_ADMIN' AND p.code='NAV_DELIVERY_CONFIGURATION_VIEW';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd9cd417c-9dd0-5db8-b72b-27fa3c694b2e',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='DELIVERY_AUTHORIZER' AND p.code='DELIVERY_CONFIG_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '0d0f0c07-3f4b-5ffc-9284-ba0ab32beec3',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='DELIVERY_AUTHORIZER' AND p.code='DELIVERY_POLICY_PUBLISH';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'a43727cf-86cb-5da8-a40a-ebf4fe6efc01',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='DELIVERY_AUTHORIZER' AND p.code='BUSINESS_PEOPLE_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '00e816de-ae6f-53d5-b6d3-ab2a8b765188',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='DELIVERY_AUTHORIZER' AND p.code='NAV_DELIVERY_CONFIGURATION_VIEW';
