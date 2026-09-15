-- WI-009: DG-01 versioned handover and controlled early-start commitments.

CREATE TABLE handover_case (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL UNIQUE,
    project_type VARCHAR(40) NOT NULL,
    template_version VARCHAR(40) NOT NULL,
    status VARCHAR(24) NOT NULL,
    receiver_id UUID NOT NULL,
    due_date DATE NOT NULL,
    basis_kind VARCHAR(24),
    basis_reference_id UUID,
    basis_note VARCHAR(2000),
    current_package_id UUID
);

CREATE TABLE handover_item (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    case_id UUID NOT NULL,
    item_key VARCHAR(40) NOT NULL,
    name VARCHAR(80) NOT NULL,
    group_key VARCHAR(40) NOT NULL,
    applicability VARCHAR(24) NOT NULL,
    applicable BOOLEAN NOT NULL,
    sort_order INTEGER NOT NULL,
    owner_id UUID NOT NULL,
    due_date DATE NOT NULL,
    reference_kind VARCHAR(24),
    reference_id UUID,
    note VARCHAR(2000)
);

CREATE TABLE handover_review (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    case_id UUID NOT NULL,
    status VARCHAR(24) NOT NULL,
    snapshot TEXT NOT NULL,
    snapshot_hash VARCHAR(64) NOT NULL,
    submitted_by UUID NOT NULL,
    submission_note VARCHAR(2000) NOT NULL,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_comment VARCHAR(2000)
);

CREATE TABLE handover_package (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    case_id UUID NOT NULL,
    review_id UUID NOT NULL UNIQUE,
    number VARCHAR(40) NOT NULL,
    snapshot TEXT NOT NULL,
    snapshot_hash VARCHAR(64) NOT NULL,
    approved_by UUID NOT NULL,
    review_comment VARCHAR(2000) NOT NULL
);

CREATE TABLE early_start_application (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL,
    title VARCHAR(160) NOT NULL,
    scope VARCHAR(4000) NOT NULL,
    scope_items VARCHAR(4000) NOT NULL,
    requested_hours NUMERIC(16,2) NOT NULL,
    requested_cost NUMERIC(16,2) NOT NULL,
    approved_hours NUMERIC(16,2),
    approved_cost NUMERIC(16,2),
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    risk_owner_id UUID NOT NULL,
    stop_conditions VARCHAR(4000) NOT NULL,
    missing_items VARCHAR(4000) NOT NULL,
    regularization_plan VARCHAR(4000) NOT NULL,
    status VARCHAR(24) NOT NULL,
    created_by UUID NOT NULL,
    submitted_by UUID,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    regularization_package_id UUID,
    finish_reason VARCHAR(2000)
);

CREATE TABLE early_start_review (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    application_id UUID NOT NULL,
    status VARCHAR(24) NOT NULL,
    snapshot TEXT NOT NULL,
    snapshot_hash VARCHAR(64) NOT NULL,
    submitted_by UUID NOT NULL,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_comment VARCHAR(2000)
);

CREATE TABLE early_start_ledger (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    application_id UUID NOT NULL,
    kind VARCHAR(24) NOT NULL,
    commitment_type VARCHAR(24) NOT NULL,
    scope_item VARCHAR(160) NOT NULL,
    owner_id UUID NOT NULL,
    occurred_on DATE NOT NULL,
    hours NUMERIC(16,2) NOT NULL,
    cost NUMERIC(16,2) NOT NULL,
    evidence VARCHAR(4000) NOT NULL,
    created_by UUID NOT NULL,
    commitment_id UUID,
    reverses_id UUID,
    allowance_id UUID,
    reversed BOOLEAN NOT NULL
);

CREATE TABLE early_closure_allowance (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    application_id UUID NOT NULL,
    scope_item VARCHAR(160) NOT NULL,
    hours NUMERIC(16,2) NOT NULL,
    cost NUMERIC(16,2) NOT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    reason VARCHAR(4000) NOT NULL,
    approved_by UUID NOT NULL
);

ALTER TABLE handover_case ADD FOREIGN KEY (project_id) REFERENCES project_space(id);

ALTER TABLE handover_case ADD FOREIGN KEY (receiver_id) REFERENCES user_account(id);

ALTER TABLE handover_case ADD FOREIGN KEY (current_package_id) REFERENCES handover_package(id);

CREATE INDEX ix_handover_case_project_id ON handover_case(project_id);

ALTER TABLE handover_item ADD FOREIGN KEY (case_id) REFERENCES handover_case(id);

ALTER TABLE handover_item ADD FOREIGN KEY (owner_id) REFERENCES user_account(id);

CREATE INDEX ix_handover_item_case_id ON handover_item(case_id);

ALTER TABLE handover_review ADD FOREIGN KEY (case_id) REFERENCES handover_case(id);

ALTER TABLE handover_review ADD FOREIGN KEY (submitted_by) REFERENCES user_account(id);

ALTER TABLE handover_review ADD FOREIGN KEY (reviewed_by) REFERENCES user_account(id);

CREATE INDEX ix_handover_review_case_id ON handover_review(case_id);

ALTER TABLE handover_package ADD FOREIGN KEY (case_id) REFERENCES handover_case(id);

ALTER TABLE handover_package ADD FOREIGN KEY (review_id) REFERENCES handover_review(id);

ALTER TABLE handover_package ADD FOREIGN KEY (approved_by) REFERENCES user_account(id);

CREATE INDEX ix_handover_package_case_id ON handover_package(case_id);

ALTER TABLE early_start_application ADD FOREIGN KEY (project_id) REFERENCES project_space(id);

ALTER TABLE early_start_application ADD FOREIGN KEY (risk_owner_id) REFERENCES user_account(id);

ALTER TABLE early_start_application ADD FOREIGN KEY (created_by) REFERENCES user_account(id);

ALTER TABLE early_start_application ADD FOREIGN KEY (submitted_by) REFERENCES user_account(id);

ALTER TABLE early_start_application ADD FOREIGN KEY (approved_by) REFERENCES user_account(id);

ALTER TABLE early_start_application ADD FOREIGN KEY (regularization_package_id) REFERENCES handover_package(id);

CREATE INDEX ix_early_start_application_project_id ON early_start_application(project_id);

ALTER TABLE early_start_review ADD FOREIGN KEY (application_id) REFERENCES early_start_application(id);

ALTER TABLE early_start_review ADD FOREIGN KEY (submitted_by) REFERENCES user_account(id);

ALTER TABLE early_start_review ADD FOREIGN KEY (reviewed_by) REFERENCES user_account(id);

CREATE INDEX ix_early_start_review_application_id ON early_start_review(application_id);

ALTER TABLE early_start_ledger ADD FOREIGN KEY (application_id) REFERENCES early_start_application(id);

ALTER TABLE early_start_ledger ADD FOREIGN KEY (owner_id) REFERENCES user_account(id);

ALTER TABLE early_start_ledger ADD FOREIGN KEY (created_by) REFERENCES user_account(id);

ALTER TABLE early_start_ledger ADD FOREIGN KEY (commitment_id) REFERENCES early_start_ledger(id);

ALTER TABLE early_start_ledger ADD FOREIGN KEY (reverses_id) REFERENCES early_start_ledger(id);

ALTER TABLE early_start_ledger ADD FOREIGN KEY (allowance_id) REFERENCES early_closure_allowance(id);

CREATE INDEX ix_early_start_ledger_application_id ON early_start_ledger(application_id);

ALTER TABLE early_closure_allowance ADD FOREIGN KEY (application_id) REFERENCES early_start_application(id);

ALTER TABLE early_closure_allowance ADD FOREIGN KEY (approved_by) REFERENCES user_account(id);

CREATE INDEX ix_early_closure_allowance_application_id ON early_closure_allowance(application_id);

ALTER TABLE handover_item ADD UNIQUE(case_id,item_key);

CREATE UNIQUE INDEX ux_handover_open_review ON handover_review(case_id) WHERE status='SUBMITTED';

CREATE UNIQUE INDEX ux_early_open_review ON early_start_review(application_id) WHERE status='SUBMITTED';

CREATE UNIQUE INDEX ux_early_approved_project ON early_start_application(project_id) WHERE status='APPROVED';

ALTER TABLE handover_review ADD CHECK(reviewed_by IS NULL OR reviewed_by <> submitted_by);

ALTER TABLE early_start_review ADD CHECK(reviewed_by IS NULL OR reviewed_by <> submitted_by);

ALTER TABLE early_start_application ADD CHECK(ends_on >= starts_on AND requested_hours >= 0 AND requested_cost >= 0);

ALTER TABLE early_closure_allowance ADD CHECK(ends_on >= starts_on AND hours >= 0 AND cost >= 0);

ALTER TABLE early_start_ledger ADD CHECK(kind='REVERSAL' OR (hours >= 0 AND cost >= 0));

INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('737540f8-fe27-5917-a070-f20d9b5aecf8','HANDOVER_READ','查看 DG-01 清单与移交包','handover.read', 'ACTION','NORMAL',TRUE,'ENABLED');

INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('d31b51fd-e873-5ef8-96b3-78d7b5f05c23','HANDOVER_EDIT','维护及提交 DG-01','handover.edit', 'ACTION','HIGH',TRUE,'ENABLED');

INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('0204007e-317e-5693-ad83-0966fc007fa7','HANDOVER_REVIEW','独立评审 DG-01','handover.review', 'ACTION','HIGH',TRUE,'ENABLED');

INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('7dd39f0e-a951-5f13-97f3-a9e03f362ada','EARLY_START_READ','查看提前开工授权','early.start.read', 'ACTION','NORMAL',TRUE,'ENABLED');

INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('ba21021e-e9de-5c5a-9bea-bd09f810a30d','EARLY_START_EDIT','维护及提交提前开工','early.start.edit', 'ACTION','HIGH',TRUE,'ENABLED');

INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('7427e7a6-4fac-5770-8188-2177945ce1ab','EARLY_START_REVIEW','审批提前开工及止损收尾','early.start.review', 'ACTION','HIGH',TRUE,'ENABLED');

INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('4b745e58-5fc3-59f1-a7fe-476864e1861c','EARLY_LEDGER_READ','查看提前开工台账明细','early.ledger.read', 'ACTION','HIGH',TRUE,'ENABLED');

INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('1e72755e-4317-5578-a68d-ea3c2d0036c7','EARLY_LEDGER_EDIT','登记提前开工承诺与实际','early.ledger.edit', 'ACTION','HIGH',TRUE,'ENABLED');

INSERT INTO access_role(id,code,name,role_type,responsibility_summary,status,delegation_level) VALUES ('91cf5fa2-3e82-51a6-8de1-0ef00696746e','HANDOVER_COORDINATOR','移交协调人','SYSTEM','仅当前参与项目；需显式分配，独立评审约束仍适用。','ENABLED',50);

INSERT INTO access_role(id,code,name,role_type,responsibility_summary,status,delegation_level) VALUES ('c105ddfe-67cb-59ad-87e5-6cd42e970fed','HANDOVER_REVIEWER','移交接收复核人','SYSTEM','仅当前参与项目；需显式分配，独立评审约束仍适用。','ENABLED',50);

INSERT INTO access_role(id,code,name,role_type,responsibility_summary,status,delegation_level) VALUES ('eb93946c-a0f0-518a-a1b9-0be1e4dea6de','EARLY_COORDINATOR','提前开工台账责任人','SYSTEM','仅当前参与项目；需显式分配，独立评审约束仍适用。','ENABLED',50);

INSERT INTO access_role(id,code,name,role_type,responsibility_summary,status,delegation_level) VALUES ('f0bbf790-af7e-5397-837d-3de6c1f614c6','EARLY_AUTHORIZER','提前开工授权人','SYSTEM','仅当前参与项目；需显式分配，独立评审约束仍适用。','ENABLED',50);

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '0259fb42-0fb8-554c-be6c-419d7daeb5e5',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='EARLY_LEDGER_EDIT';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '62d5b06a-98e1-55ca-86e5-6b0a548ed071',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='EARLY_LEDGER_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '952b73b2-f396-5c4c-90a7-491a06f0b1b4',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='EARLY_START_EDIT';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '35793469-4b8a-5959-81e6-5f76d4e76ec0',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='EARLY_START_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '6821af67-b37f-5e91-a261-d7e415f80541',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='EARLY_START_REVIEW';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '3ac5f1b4-9c09-5e08-ace2-3efcdfc96a81',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='HANDOVER_EDIT';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '18a0828d-08b2-56a3-8548-f6352e96ae4c',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='HANDOVER_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '125bb92f-8692-5d8e-a8e6-66919e79d609',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='HANDOVER_REVIEW';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '6a9086d5-0714-56c8-8765-db3cff4960b5',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='EARLY_AUTHORIZER' AND p.code='BUSINESS_PEOPLE_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'e669aa46-615e-5116-8c19-2b02d0c15004',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='EARLY_AUTHORIZER' AND p.code='EARLY_LEDGER_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '517bf33e-01ff-54a0-a766-f39ffe74ab78',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='EARLY_AUTHORIZER' AND p.code='EARLY_START_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '000411b8-a3e9-5ed3-8592-2bc356235996',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='EARLY_AUTHORIZER' AND p.code='EARLY_START_REVIEW';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'c0f88749-71fa-57bd-9b35-0aaeb84f5bd5',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='EARLY_AUTHORIZER' AND p.code='NAV_PROJECTS_VIEW';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'c0f9287e-d363-5f2a-80bd-e5ea3d2546fa',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='EARLY_AUTHORIZER' AND p.code='PROJECT_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '9715b7f8-bdab-5c3b-8ddf-72fba9b23d8c',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='EARLY_COORDINATOR' AND p.code='BUSINESS_PEOPLE_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'c8e44e14-c7ec-52f8-8322-5d793e25eb4d',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='EARLY_COORDINATOR' AND p.code='EARLY_LEDGER_EDIT';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'fecd4751-b917-56bf-811c-3cb4b7e2f191',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='EARLY_COORDINATOR' AND p.code='EARLY_LEDGER_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '24645306-9b54-5e59-86d5-7cfa136f94a4',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='EARLY_COORDINATOR' AND p.code='EARLY_START_EDIT';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '5d51c655-c347-5792-9831-9e4cbaff0b95',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='EARLY_COORDINATOR' AND p.code='EARLY_START_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '12074f2a-7482-5411-a008-5b680739d156',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='EARLY_COORDINATOR' AND p.code='NAV_PROJECTS_VIEW';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '50c0b50e-5700-5772-8f01-8d38b8fe5416',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='EARLY_COORDINATOR' AND p.code='PROJECT_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'becf7a2b-504f-58af-bb8d-c31581785843',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='HANDOVER_COORDINATOR' AND p.code='BUSINESS_PEOPLE_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '17b4245d-2c1e-50cf-9582-1aeec798ce66',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='HANDOVER_COORDINATOR' AND p.code='CONTRACT_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '4cf5bea0-a88f-5c6e-8c94-1da98fe172ab',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='HANDOVER_COORDINATOR' AND p.code='CONTRACT_SENSITIVE_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '0de64bee-e9c5-506a-978d-afb2a95a6b3f',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='HANDOVER_COORDINATOR' AND p.code='EARLY_START_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'e4874c22-15a7-56c8-9456-5d451f46ca39',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='HANDOVER_COORDINATOR' AND p.code='FILE_CONTRACT_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '607eebbb-3c30-5dc0-9571-44afa68c7e2f',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='HANDOVER_COORDINATOR' AND p.code='FILE_COST_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '794ecfd8-8c2d-5b11-91cf-96defb828207',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='HANDOVER_COORDINATOR' AND p.code='FILE_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '8cad8a72-9827-55df-8145-2cd58caa5095',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='HANDOVER_COORDINATOR' AND p.code='HANDOVER_EDIT';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '17191578-2431-591f-851c-b0c4a0d93c1a',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='HANDOVER_COORDINATOR' AND p.code='HANDOVER_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'bcef7b6d-6948-50cf-8391-f96fac2a4cbc',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='HANDOVER_COORDINATOR' AND p.code='NAV_PROJECTS_VIEW';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '6d6a3ce9-8cf3-5c6a-bcea-0e6b108fbc9e',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='HANDOVER_COORDINATOR' AND p.code='PRESALES_INVESTMENT_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd0ae1b8d-f377-52b8-835b-d05b8814cb4c',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='HANDOVER_COORDINATOR' AND p.code='PRESALES_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'e0b6771b-f13d-50b2-a6b7-b480155707ce',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='HANDOVER_COORDINATOR' AND p.code='PROJECT_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'c002ff16-4efe-539b-8c87-8ff60968441a',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='HANDOVER_REVIEWER' AND p.code='BUSINESS_PEOPLE_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '0a41932b-21b7-5e1f-bb45-9aefba51cb09',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='HANDOVER_REVIEWER' AND p.code='CONTRACT_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '30b221c7-654e-57b1-9dcc-8e2e91d346e1',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='HANDOVER_REVIEWER' AND p.code='CONTRACT_SENSITIVE_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '043b35ea-9839-5586-9438-f44bd6a8e05d',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='HANDOVER_REVIEWER' AND p.code='EARLY_START_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'c41a7c12-1800-5e36-9c52-56c359053f87',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='HANDOVER_REVIEWER' AND p.code='FILE_CONTRACT_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '30551a65-8944-588f-9573-e797a0b5d59d',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='HANDOVER_REVIEWER' AND p.code='FILE_COST_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '7c2d3955-bddd-52a8-bc3c-5a614d06e1ea',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='HANDOVER_REVIEWER' AND p.code='FILE_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '44b6380d-509a-583d-b699-5eccc49ea79d',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='HANDOVER_REVIEWER' AND p.code='HANDOVER_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '66b3c56d-19f8-5fcd-90ee-b057d2e033dc',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='HANDOVER_REVIEWER' AND p.code='HANDOVER_REVIEW';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '975add64-7e73-55c8-a4ab-4b46b63155fb',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='HANDOVER_REVIEWER' AND p.code='NAV_PROJECTS_VIEW';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd29a16d9-1396-5b0b-971c-b46ae0237428',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='HANDOVER_REVIEWER' AND p.code='PRESALES_INVESTMENT_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'b89433e5-bcc5-5477-ae96-af1743dc3fa1',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='HANDOVER_REVIEWER' AND p.code='PRESALES_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '2eccbfcb-f808-5e62-a104-b9439e410ba3',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='HANDOVER_REVIEWER' AND p.code='PROJECT_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '0ccdeab8-91ae-5759-97c5-b8e2325c38dd',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='PROJECT_CONTRIBUTOR' AND p.code='EARLY_START_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'b3d6aa23-e538-5b2d-9602-df6874951f7a',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='PROJECT_CONTRIBUTOR' AND p.code='HANDOVER_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '08f6eba2-0eb7-5dd2-9532-1e4e11744131',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='PROJECT_OWNER' AND p.code='EARLY_START_EDIT';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'ad325c53-9460-5c42-ad12-da0fa4d7dbd4',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='PROJECT_OWNER' AND p.code='EARLY_START_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '2b0e4e1b-ecf7-563f-beb8-dbbea6b804a8',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='PROJECT_OWNER' AND p.code='HANDOVER_EDIT';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd7711ac3-03e8-52df-bfb6-323abe40ead4',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='PROJECT_OWNER' AND p.code='HANDOVER_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '9ccf8e9e-568e-5339-9ba6-4be56a0d3759',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='PROJECT_REVIEWER' AND p.code='EARLY_START_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'b634789a-d8f4-5382-a258-097161f3642b',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='PROJECT_REVIEWER' AND p.code='HANDOVER_READ';
