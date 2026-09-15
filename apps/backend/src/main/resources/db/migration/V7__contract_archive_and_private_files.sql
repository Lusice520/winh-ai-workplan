-- WI-009: private file metadata, immutable signed contract relations, independent archive acceptance.

CREATE TABLE project_document (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL,
    title VARCHAR(160) NOT NULL,
    kind VARCHAR(40) NOT NULL,
    main_stage VARCHAR(24) NOT NULL,
    classification VARCHAR(24) NOT NULL,
    current_version_id UUID,
    created_by UUID NOT NULL
);

CREATE TABLE document_version (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    document_id UUID NOT NULL,
    version_number INTEGER NOT NULL,
    filename VARCHAR(240) NOT NULL,
    object_key VARCHAR(200) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL,
    change_note VARCHAR(2000) NOT NULL,
    uploaded_by UUID NOT NULL,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_comment VARCHAR(2000)
);

CREATE TABLE contract_master (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL,
    number VARCHAR(80) NOT NULL,
    number_key VARCHAR(80) NOT NULL,
    title VARCHAR(160) NOT NULL,
    party_a VARCHAR(240) NOT NULL,
    party_b VARCHAR(240) NOT NULL,
    amount NUMERIC(16,2) NOT NULL,
    signed_on DATE NOT NULL,
    effective_on DATE NOT NULL,
    scope VARCHAR(4000) NOT NULL,
    archive_status VARCHAR(24) NOT NULL,
    primary_contract BOOLEAN NOT NULL,
    ever_archived BOOLEAN NOT NULL,
    terminated BOOLEAN NOT NULL,
    created_by UUID NOT NULL,
    archived_by UUID,
    archived_at TIMESTAMPTZ
);

CREATE TABLE contract_record (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    contract_id UUID NOT NULL,
    kind VARCHAR(24) NOT NULL,
    title VARCHAR(160) NOT NULL,
    description VARCHAR(4000) NOT NULL,
    signed_on DATE NOT NULL,
    file_version_id UUID NOT NULL,
    amount_before NUMERIC(16,2),
    amount_after NUMERIC(16,2),
    created_by UUID NOT NULL
);

CREATE TABLE contract_node (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    contract_id UUID NOT NULL,
    record_id UUID,
    title VARCHAR(160) NOT NULL,
    kind VARCHAR(24) NOT NULL,
    due_date DATE NOT NULL,
    amount NUMERIC(16,2),
    conditions VARCHAR(2000) NOT NULL,
    status VARCHAR(24) NOT NULL,
    completed_on DATE,
    evidence VARCHAR(4000),
    completed_by UUID
);

CREATE TABLE contract_file_link (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    contract_id UUID NOT NULL,
    file_version_id UUID NOT NULL,
    kind VARCHAR(24) NOT NULL,
    active BOOLEAN NOT NULL,
    linked_by UUID NOT NULL
);

CREATE TABLE contract_archive_review (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    contract_id UUID NOT NULL,
    status VARCHAR(24) NOT NULL,
    snapshot VARCHAR(30000) NOT NULL,
    submission_note VARCHAR(2000) NOT NULL,
    submitted_by UUID NOT NULL,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_comment VARCHAR(2000)
);

ALTER TABLE project_document ADD FOREIGN KEY (project_id) REFERENCES project_space(id);

ALTER TABLE project_document ADD FOREIGN KEY (created_by) REFERENCES user_account(id);

ALTER TABLE project_document ADD FOREIGN KEY (current_version_id) REFERENCES document_version(id);

CREATE INDEX ix_project_document_project_id ON project_document(project_id);

ALTER TABLE document_version ADD FOREIGN KEY (document_id) REFERENCES project_document(id);

ALTER TABLE document_version ADD FOREIGN KEY (uploaded_by) REFERENCES user_account(id);

ALTER TABLE document_version ADD FOREIGN KEY (reviewed_by) REFERENCES user_account(id);

CREATE INDEX ix_document_version_document_id ON document_version(document_id);

ALTER TABLE contract_master ADD FOREIGN KEY (project_id) REFERENCES project_space(id);

ALTER TABLE contract_master ADD FOREIGN KEY (created_by) REFERENCES user_account(id);

ALTER TABLE contract_master ADD FOREIGN KEY (archived_by) REFERENCES user_account(id);

CREATE INDEX ix_contract_master_project_id ON contract_master(project_id);

ALTER TABLE contract_record ADD FOREIGN KEY (contract_id) REFERENCES contract_master(id);

ALTER TABLE contract_record ADD FOREIGN KEY (file_version_id) REFERENCES document_version(id);

ALTER TABLE contract_record ADD FOREIGN KEY (created_by) REFERENCES user_account(id);

CREATE INDEX ix_contract_record_contract_id ON contract_record(contract_id);

ALTER TABLE contract_node ADD FOREIGN KEY (contract_id) REFERENCES contract_master(id);

ALTER TABLE contract_node ADD FOREIGN KEY (record_id) REFERENCES contract_record(id);

ALTER TABLE contract_node ADD FOREIGN KEY (completed_by) REFERENCES user_account(id);

CREATE INDEX ix_contract_node_contract_id ON contract_node(contract_id);

ALTER TABLE contract_file_link ADD FOREIGN KEY (contract_id) REFERENCES contract_master(id);

ALTER TABLE contract_file_link ADD FOREIGN KEY (file_version_id) REFERENCES document_version(id);

ALTER TABLE contract_file_link ADD FOREIGN KEY (linked_by) REFERENCES user_account(id);

CREATE INDEX ix_contract_file_link_contract_id ON contract_file_link(contract_id);

ALTER TABLE contract_archive_review ADD FOREIGN KEY (contract_id) REFERENCES contract_master(id);

ALTER TABLE contract_archive_review ADD FOREIGN KEY (submitted_by) REFERENCES user_account(id);

ALTER TABLE contract_archive_review ADD FOREIGN KEY (reviewed_by) REFERENCES user_account(id);

CREATE INDEX ix_contract_archive_review_contract_id ON contract_archive_review(contract_id);

ALTER TABLE contract_master ADD UNIQUE(number_key);

CREATE UNIQUE INDEX ux_primary_contract_per_project ON contract_master(project_id) WHERE primary_contract;

ALTER TABLE document_version ADD UNIQUE(document_id, version_number);

CREATE UNIQUE INDEX ux_published_document_version ON document_version(document_id) WHERE status='PUBLISHED';

ALTER TABLE document_version ADD CHECK (size_bytes > 0);

ALTER TABLE contract_master ADD CHECK (amount > 0);

ALTER TABLE contract_archive_review ADD CHECK (submitted_by <> reviewed_by);

INSERT INTO menu_resource(id,code,resource_type,parent_id,name,route_key,icon_key,sort_order,status) VALUES ('eecc73ed-93f4-5f3b-9b4b-212759360103','CONTRACTS_PAGE','MENU_PAGE','53d6fd93-46b0-556a-bc69-85720a84405a','合同台账','business.contracts','folder',5,'ENABLED');

INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('141ccb08-0621-538e-9c90-65840e390f3a','NAV_CONTRACTS_VIEW','eecc73ed-93f4-5f3b-9b4b-212759360103','查看合同台账','nav.contracts.view','MENU','NORMAL',TRUE,'ENABLED');

INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('d08b9eb8-85b9-5de7-b6b1-6a1acb609055','CONTRACT_READ',NULL,'查看合同摘要','contract.read','ACTION','NORMAL',TRUE,'ENABLED');

INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('cfe23f94-da3e-5180-b8bb-5a4d6d813191','CONTRACT_SENSITIVE_READ',NULL,'查看合同敏感内容','contract.sensitive.read','ACTION','HIGH',TRUE,'ENABLED');

INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('0ad72ec4-ea07-5436-aa48-cee1bcb15bf2','CONTRACT_EDIT',NULL,'维护合同签署事实','contract.edit','ACTION','HIGH',TRUE,'ENABLED');

INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('8137c0be-ae38-5983-9d16-5edbee254762','CONTRACT_ARCHIVE',NULL,'接收合同归档','contract.archive','ACTION','HIGH',TRUE,'ENABLED');

INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('247bc7a9-576c-5bbb-894c-7a5b3764b412','FILE_READ',NULL,'查看项目资料','file.read','ACTION','NORMAL',TRUE,'ENABLED');

INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('babce8c7-21c8-5994-9e2f-5823db1fe391','FILE_UPLOAD',NULL,'上传与修订资料','file.upload','ACTION','HIGH',TRUE,'ENABLED');

INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('76f484f0-086b-5d5e-b5b9-e830f27904a6','FILE_PUBLISH',NULL,'评审发布与作废资料','file.publish','ACTION','HIGH',TRUE,'ENABLED');

INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('1c650097-66b0-5431-aa6e-42c7b4632042','FILE_DOWNLOAD',NULL,'下载项目资料','file.download','ACTION','HIGH',TRUE,'ENABLED');

INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('017a952f-4b27-5d43-8de5-7bae9a9f04ad','FILE_CONTRACT_READ',NULL,'查看合同敏感资料','file.contract.read','ACTION','HIGH',TRUE,'ENABLED');

INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('b247ed94-bfc3-5cd5-8822-70b4700f5399','FILE_COST_READ',NULL,'查看成本敏感资料','file.cost.read','ACTION','HIGH',TRUE,'ENABLED');

INSERT INTO access_role(id,code,name,role_type,responsibility_summary,status,delegation_level) VALUES ('33af0ae1-49f8-556f-9b1c-3960ef037fd5','CONTRACT_SALES','合同责任商务','SYSTEM','签署后合同资料职责，需显式分配，不自动授权员工。','ENABLED',50);

INSERT INTO access_role(id,code,name,role_type,responsibility_summary,status,delegation_level) VALUES ('543bd437-c313-57eb-99db-e5da05d30bf5','CONTRACT_ARCHIVIST','合同归档管理','SYSTEM','签署后合同资料职责，需显式分配，不自动授权员工。','ENABLED',50);

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'fb069677-3b47-552a-ae0b-2c7eb655f611',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='NAV_CONTRACTS_VIEW';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'c6bd4ff9-b29d-599b-a56f-8a79da1975b6',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='CONTRACT_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '1db4a04d-d150-5e86-b969-4a2dc453df1f',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='CONTRACT_SENSITIVE_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'c857136e-a7fe-5911-b54f-a0a024e7ef80',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='CONTRACT_EDIT';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'ca7ba474-b569-5563-967d-5b7421a47ba0',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='CONTRACT_ARCHIVE';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'ab84bbdc-73d7-5f25-b162-1059d17b95b5',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='FILE_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '042447b1-c044-5582-a4e0-b2b3627462ea',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='FILE_UPLOAD';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '1a29f758-c329-5580-9f1f-317a64487612',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='FILE_PUBLISH';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'ec710b89-6f89-5dc8-8aa7-337e1d3a92f5',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='FILE_DOWNLOAD';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '736a3ba2-be69-550e-b938-ef166a373f7e',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='FILE_CONTRACT_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '305b53fc-e0e5-5935-96a8-0369684ffff7',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='FILE_COST_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '789f0a51-e5c1-58fb-9b0f-fd8a9700ad45',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='BUSINESS_USER' AND p.code='NAV_CONTRACTS_VIEW';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '31a5dee7-da40-5c9d-949f-5da1bc060314',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r, permission_item p WHERE r.code='PROJECT_OWNER' AND p.code='FILE_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '721b3b4a-5bfb-5c0a-bccb-95cfb37a7a34',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r, permission_item p WHERE r.code='PROJECT_OWNER' AND p.code='FILE_UPLOAD';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '6de10872-fc1b-5d1a-b96a-920de7565767',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r, permission_item p WHERE r.code='PROJECT_OWNER' AND p.code='FILE_DOWNLOAD';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '96116c4d-66b3-55a5-a0db-88ab77af24e3',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r, permission_item p WHERE r.code='PROJECT_OWNER' AND p.code='CONTRACT_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '15b7377a-3fad-542e-a206-349919dec214',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r, permission_item p WHERE r.code='PROJECT_CONTRIBUTOR' AND p.code='FILE_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '034ab32c-49af-53a5-acd8-171155c13389',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r, permission_item p WHERE r.code='PROJECT_CONTRIBUTOR' AND p.code='FILE_UPLOAD';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'c3b46924-a387-58be-bbc0-67f89d2f7ac3',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r, permission_item p WHERE r.code='PROJECT_CONTRIBUTOR' AND p.code='CONTRACT_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '4b9a45c9-db35-5ffd-ad7a-bf024e1b9747',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r, permission_item p WHERE r.code='PROJECT_REVIEWER' AND p.code='FILE_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'ecdcc07c-a950-5ac8-9d0e-0d3671539800',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r, permission_item p WHERE r.code='PROJECT_REVIEWER' AND p.code='FILE_PUBLISH';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '450d51b3-8f48-531c-a681-2b357b462bce',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r, permission_item p WHERE r.code='PROJECT_REVIEWER' AND p.code='CONTRACT_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '20795f61-2157-5e7f-aa82-9c2b7e25963b',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='CONTRACT_SALES' AND p.code='NAV_CONTRACTS_VIEW';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '09b919f0-f31b-57be-8531-3be5f65d6a41',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='CONTRACT_SALES' AND p.code='NAV_PROJECTS_VIEW';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'cfaa1e32-ff01-52ea-96c3-f794abb9e99b',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='CONTRACT_SALES' AND p.code='PROJECT_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '29190e76-df5f-55f7-9e5b-64cb9d03fc1a',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='CONTRACT_SALES' AND p.code='BUSINESS_PEOPLE_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd5d37fbd-7796-558e-be96-462f9a277a86',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='CONTRACT_SALES' AND p.code='CONTRACT_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '41362a29-1dcb-54bd-8db6-b8746b440d1b',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='CONTRACT_SALES' AND p.code='CONTRACT_SENSITIVE_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'eb8fa344-6431-58b6-ba71-7af1123762d4',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='CONTRACT_SALES' AND p.code='CONTRACT_EDIT';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '16db7a59-53eb-59b7-83e0-8509f1845918',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='CONTRACT_SALES' AND p.code='FILE_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '328efaec-609a-57a7-820b-265daca9eed9',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='CONTRACT_SALES' AND p.code='FILE_UPLOAD';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '646b76dc-db71-5c1d-9016-a22a7cd8b2d8',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='CONTRACT_SALES' AND p.code='FILE_DOWNLOAD';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '7bfdf022-bcf7-5075-9bed-9caae1b85ba4',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='CONTRACT_SALES' AND p.code='FILE_CONTRACT_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1f7ab75-0840-5d32-ae5a-22fd051cea90',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='CONTRACT_ARCHIVIST' AND p.code='NAV_CONTRACTS_VIEW';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '2152b9e1-c2cc-5abc-a31c-b4caadbdea55',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='CONTRACT_ARCHIVIST' AND p.code='NAV_PROJECTS_VIEW';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '68b4cbce-e64a-5279-b8af-788273c62353',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='CONTRACT_ARCHIVIST' AND p.code='PROJECT_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'dbb2caec-aad9-5b58-af2b-5e18e34b6a36',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='CONTRACT_ARCHIVIST' AND p.code='BUSINESS_PEOPLE_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '43884bb6-e28e-557f-8f29-b899548a4ee4',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='CONTRACT_ARCHIVIST' AND p.code='CONTRACT_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '201d68da-0b26-509f-88ae-91a268a425c0',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='CONTRACT_ARCHIVIST' AND p.code='CONTRACT_SENSITIVE_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '929618c9-eccf-501a-85be-35a6e7ad303c',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='CONTRACT_ARCHIVIST' AND p.code='CONTRACT_ARCHIVE';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '1d9988cd-9ddc-5eb6-a6c9-86b66f47cc2b',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='CONTRACT_ARCHIVIST' AND p.code='FILE_READ';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '5db35465-03f5-5c61-aa03-a291e416da10',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='CONTRACT_ARCHIVIST' AND p.code='FILE_PUBLISH';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'f4770b97-f39c-51c4-a714-7805a13952b1',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='CONTRACT_ARCHIVIST' AND p.code='FILE_DOWNLOAD';

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'ea08e2e2-bce3-541c-a92a-bdbffc7806d4',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r, permission_item p WHERE r.code='CONTRACT_ARCHIVIST' AND p.code='FILE_CONTRACT_READ';
