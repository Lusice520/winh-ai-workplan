-- WI-008: additive business records and explicitly scoped business permissions.
-- V1-V4 are unchanged. No customer/project/demo data is inserted.

CREATE TABLE crm_customer (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    normalized_name VARCHAR(160) NOT NULL,
    short_name VARCHAR(80),
    kind VARCHAR(24) NOT NULL,
    identifier VARCHAR(80),
    active_identifier VARCHAR(80) UNIQUE,
    industry VARCHAR(80),
    region VARCHAR(120),
    source VARCHAR(120) NOT NULL,
    owner_account_id UUID NOT NULL,
    organization_unit_id UUID NOT NULL,
    status VARCHAR(24) NOT NULL,
    merged_into_id UUID
);

CREATE TABLE crm_contact (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    customer_id UUID NOT NULL,
    name VARCHAR(120) NOT NULL,
    position VARCHAR(120),
    phone VARCHAR(40),
    email VARCHAR(160),
    status VARCHAR(24) NOT NULL
);

CREATE TABLE crm_opportunity (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    code VARCHAR(40) NOT NULL UNIQUE,
    customer_id UUID NOT NULL,
    title VARCHAR(160) NOT NULL,
    event_key VARCHAR(120),
    owner_account_id UUID NOT NULL,
    organization_unit_id UUID NOT NULL,
    source VARCHAR(120) NOT NULL,
    grade VARCHAR(8) NOT NULL,
    progress VARCHAR(32) NOT NULL,
    procurement_method VARCHAR(24) NOT NULL,
    estimated_amount NUMERIC(16,2),
    target_date DATE,
    background VARCHAR(8000),
    status VARCHAR(24) NOT NULL,
    result VARCHAR(32) NOT NULL,
    project_id UUID UNIQUE
);

CREATE TABLE crm_opportunity_activity (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    opportunity_id UUID NOT NULL,
    fact VARCHAR(4000) NOT NULL,
    next_action VARCHAR(1000),
    assignee_id UUID,
    due_date DATE,
    recorded_by UUID NOT NULL
);

CREATE TABLE project_space (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    code VARCHAR(40) NOT NULL UNIQUE,
    opportunity_id UUID NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    sales_owner_id UUID NOT NULL,
    presales_owner_id UUID NOT NULL,
    organization_unit_id UUID NOT NULL,
    main_stage VARCHAR(24) NOT NULL,
    focus VARCHAR(80) NOT NULL,
    status VARCHAR(32) NOT NULL,
    status_before_close VARCHAR(32),
    background VARCHAR(8000)
);

CREATE TABLE project_member (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL,
    account_id UUID NOT NULL,
    role_codes VARCHAR(200) NOT NULL,
    active BOOLEAN NOT NULL,
    change_reason VARCHAR(1000)
);

CREATE TABLE project_role_assignment (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL,
    account_id UUID NOT NULL,
    active BOOLEAN NOT NULL,
    assigned_by UUID NOT NULL,
    role_id UUID NOT NULL
);

CREATE TABLE presales_initiation (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL,
    purpose VARCHAR(2000) NOT NULL,
    scope VARCHAR(2000) NOT NULL,
    expected_outputs VARCHAR(2000) NOT NULL,
    exit_conditions VARCHAR(2000) NOT NULL,
    requested_hours NUMERIC(16,2) NOT NULL,
    requested_cost NUMERIC(16,2) NOT NULL,
    approved_hours NUMERIC(16,2),
    approved_cost NUMERIC(16,2),
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    status VARCHAR(24) NOT NULL,
    submitted_by UUID,
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_comment VARCHAR(2000)
);

CREATE TABLE presales_action (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL,
    action_key VARCHAR(40) NOT NULL,
    name VARCHAR(120) NOT NULL,
    sort_order INTEGER NOT NULL,
    status VARCHAR(24) NOT NULL,
    owner_account_id UUID NOT NULL,
    due_date DATE,
    note VARCHAR(2000)
);

CREATE TABLE presales_deliverable (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL,
    action_id UUID NOT NULL,
    version_number INTEGER NOT NULL,
    title VARCHAR(160) NOT NULL,
    kind VARCHAR(40) NOT NULL,
    scope VARCHAR(2000) NOT NULL,
    content VARCHAR(12000) NOT NULL,
    change_note VARCHAR(2000) NOT NULL,
    status VARCHAR(24) NOT NULL,
    created_by UUID NOT NULL
);

CREATE TABLE presales_investment (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL,
    initiation_id UUID NOT NULL,
    kind VARCHAR(24) NOT NULL,
    hours NUMERIC(16,2) NOT NULL,
    cost NUMERIC(16,2) NOT NULL,
    occurred_on DATE NOT NULL,
    description VARCHAR(2000) NOT NULL,
    commitment_id UUID,
    reverses_id UUID,
    reversed BOOLEAN NOT NULL,
    created_by UUID NOT NULL
);

CREATE TABLE presales_quote_review (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL,
    feasibility VARCHAR(2000) NOT NULL,
    scope VARCHAR(2000) NOT NULL,
    estimate VARCHAR(2000) NOT NULL,
    price_authorization VARCHAR(2000) NOT NULL,
    constraints VARCHAR(2000) NOT NULL,
    assumptions_risks VARCHAR(2000) NOT NULL,
    final_version VARCHAR(2000) NOT NULL,
    deliverable_ids VARCHAR(4000) NOT NULL,
    action_snapshot VARCHAR(8000) NOT NULL,
    status VARCHAR(24) NOT NULL,
    submitted_by UUID NOT NULL,
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_comment VARCHAR(2000)
);

CREATE TABLE project_requirement (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL,
    code VARCHAR(40) NOT NULL UNIQUE,
    title VARCHAR(160) NOT NULL,
    original_text VARCHAR(8000) NOT NULL,
    source VARCHAR(24) NOT NULL,
    requester VARCHAR(160) NOT NULL,
    created_by UUID NOT NULL,
    owner_account_id UUID NOT NULL,
    verifier_account_id UUID NOT NULL,
    handler_ids VARCHAR(4000) NOT NULL,
    priority VARCHAR(24) NOT NULL,
    status VARCHAR(32) NOT NULL,
    expected_on DATE,
    important_customer BOOLEAN NOT NULL,
    disposition VARCHAR(24),
    completion_evidence VARCHAR(4000),
    completed_by UUID,
    verification_comment VARCHAR(4000),
    customer_evidence VARCHAR(4000),
    verified_by UUID,
    verified_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE requirement_assessment (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    requirement_id UUID NOT NULL,
    clarification VARCHAR(8000) NOT NULL,
    category VARCHAR(80) NOT NULL,
    scope_impact VARCHAR(2000) NOT NULL,
    technical_impact VARCHAR(2000) NOT NULL,
    schedule_impact VARCHAR(2000) NOT NULL,
    cost_impact VARCHAR(2000) NOT NULL,
    contract_impact VARCHAR(2000) NOT NULL,
    acceptance_impact VARCHAR(2000) NOT NULL,
    safety_impact VARCHAR(2000) NOT NULL,
    baseline_impact BOOLEAN NOT NULL,
    created_by UUID NOT NULL
);

CREATE TABLE project_work_item (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id UUID NOT NULL,
    source_requirement_id UUID NOT NULL,
    kind VARCHAR(24) NOT NULL,
    title VARCHAR(160) NOT NULL,
    description VARCHAR(8000) NOT NULL,
    owner_account_id UUID NOT NULL,
    verifier_account_id UUID NOT NULL,
    created_by UUID NOT NULL,
    status VARCHAR(32) NOT NULL,
    due_date DATE,
    evidence VARCHAR(4000),
    completed_by UUID,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID,
    verified_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE requirement_link (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    requirement_id UUID NOT NULL,
    work_item_id UUID NOT NULL,
    kind VARCHAR(24) NOT NULL,
    active BOOLEAN NOT NULL
);

CREATE TABLE business_event (
    id UUID PRIMARY KEY,
    object_id UUID NOT NULL,
    domain VARCHAR(40) NOT NULL,
    action VARCHAR(80) NOT NULL,
    description VARCHAR(4000) NOT NULL,
    actor_id UUID NOT NULL REFERENCES user_account(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_business_event_object ON business_event(object_id,created_at DESC);

ALTER TABLE crm_contact ADD FOREIGN KEY (customer_id) REFERENCES crm_customer(id);
ALTER TABLE crm_customer ADD FOREIGN KEY (owner_account_id) REFERENCES user_account(id);
ALTER TABLE crm_customer ADD FOREIGN KEY (organization_unit_id) REFERENCES org_unit(id);
ALTER TABLE crm_customer ADD FOREIGN KEY (merged_into_id) REFERENCES crm_customer(id);
ALTER TABLE crm_opportunity ADD FOREIGN KEY (customer_id) REFERENCES crm_customer(id);
ALTER TABLE crm_opportunity ADD FOREIGN KEY (owner_account_id) REFERENCES user_account(id);
ALTER TABLE crm_opportunity ADD FOREIGN KEY (organization_unit_id) REFERENCES org_unit(id);
ALTER TABLE crm_opportunity ADD FOREIGN KEY (project_id) REFERENCES project_space(id);
ALTER TABLE crm_opportunity_activity ADD FOREIGN KEY (opportunity_id) REFERENCES crm_opportunity(id);
ALTER TABLE crm_opportunity_activity ADD FOREIGN KEY (assignee_id) REFERENCES user_account(id);
ALTER TABLE crm_opportunity_activity ADD FOREIGN KEY (recorded_by) REFERENCES user_account(id);
ALTER TABLE project_space ADD FOREIGN KEY (opportunity_id) REFERENCES crm_opportunity(id);
ALTER TABLE project_space ADD FOREIGN KEY (sales_owner_id) REFERENCES user_account(id);
ALTER TABLE project_space ADD FOREIGN KEY (presales_owner_id) REFERENCES user_account(id);
ALTER TABLE project_space ADD FOREIGN KEY (organization_unit_id) REFERENCES org_unit(id);
ALTER TABLE project_member ADD FOREIGN KEY (project_id) REFERENCES project_space(id);
ALTER TABLE project_member ADD FOREIGN KEY (account_id) REFERENCES user_account(id);
ALTER TABLE project_role_assignment ADD FOREIGN KEY (project_id) REFERENCES project_space(id);
ALTER TABLE project_role_assignment ADD FOREIGN KEY (account_id) REFERENCES user_account(id);
ALTER TABLE project_role_assignment ADD FOREIGN KEY (role_id) REFERENCES access_role(id);
ALTER TABLE project_role_assignment ADD FOREIGN KEY (assigned_by) REFERENCES user_account(id);
ALTER TABLE presales_initiation ADD FOREIGN KEY (project_id) REFERENCES project_space(id);
ALTER TABLE presales_initiation ADD FOREIGN KEY (submitted_by) REFERENCES user_account(id);
ALTER TABLE presales_initiation ADD FOREIGN KEY (reviewed_by) REFERENCES user_account(id);
ALTER TABLE presales_action ADD FOREIGN KEY (project_id) REFERENCES project_space(id);
ALTER TABLE presales_action ADD FOREIGN KEY (owner_account_id) REFERENCES user_account(id);
ALTER TABLE presales_deliverable ADD FOREIGN KEY (project_id) REFERENCES project_space(id);
ALTER TABLE presales_deliverable ADD FOREIGN KEY (action_id) REFERENCES presales_action(id);
ALTER TABLE presales_deliverable ADD FOREIGN KEY (created_by) REFERENCES user_account(id);
ALTER TABLE presales_investment ADD FOREIGN KEY (project_id) REFERENCES project_space(id);
ALTER TABLE presales_investment ADD FOREIGN KEY (initiation_id) REFERENCES presales_initiation(id);
ALTER TABLE presales_investment ADD FOREIGN KEY (commitment_id) REFERENCES presales_investment(id);
ALTER TABLE presales_investment ADD FOREIGN KEY (reverses_id) REFERENCES presales_investment(id);
ALTER TABLE presales_investment ADD FOREIGN KEY (created_by) REFERENCES user_account(id);
ALTER TABLE presales_quote_review ADD FOREIGN KEY (project_id) REFERENCES project_space(id);
ALTER TABLE presales_quote_review ADD FOREIGN KEY (submitted_by) REFERENCES user_account(id);
ALTER TABLE presales_quote_review ADD FOREIGN KEY (reviewed_by) REFERENCES user_account(id);
ALTER TABLE project_requirement ADD FOREIGN KEY (project_id) REFERENCES project_space(id);
ALTER TABLE project_requirement ADD FOREIGN KEY (created_by) REFERENCES user_account(id);
ALTER TABLE project_requirement ADD FOREIGN KEY (owner_account_id) REFERENCES user_account(id);
ALTER TABLE project_requirement ADD FOREIGN KEY (verifier_account_id) REFERENCES user_account(id);
ALTER TABLE project_requirement ADD FOREIGN KEY (completed_by) REFERENCES user_account(id);
ALTER TABLE project_requirement ADD FOREIGN KEY (verified_by) REFERENCES user_account(id);
ALTER TABLE requirement_assessment ADD FOREIGN KEY (requirement_id) REFERENCES project_requirement(id);
ALTER TABLE requirement_assessment ADD FOREIGN KEY (created_by) REFERENCES user_account(id);
ALTER TABLE project_work_item ADD FOREIGN KEY (project_id) REFERENCES project_space(id);
ALTER TABLE project_work_item ADD FOREIGN KEY (source_requirement_id) REFERENCES project_requirement(id);
ALTER TABLE project_work_item ADD FOREIGN KEY (owner_account_id) REFERENCES user_account(id);
ALTER TABLE project_work_item ADD FOREIGN KEY (verifier_account_id) REFERENCES user_account(id);
ALTER TABLE project_work_item ADD FOREIGN KEY (created_by) REFERENCES user_account(id);
ALTER TABLE project_work_item ADD FOREIGN KEY (completed_by) REFERENCES user_account(id);
ALTER TABLE project_work_item ADD FOREIGN KEY (approved_by) REFERENCES user_account(id);
ALTER TABLE project_work_item ADD FOREIGN KEY (verified_by) REFERENCES user_account(id);
ALTER TABLE requirement_link ADD FOREIGN KEY (requirement_id) REFERENCES project_requirement(id);
ALTER TABLE requirement_link ADD FOREIGN KEY (work_item_id) REFERENCES project_work_item(id);
ALTER TABLE crm_opportunity ADD UNIQUE (customer_id,event_key);
ALTER TABLE project_member ADD UNIQUE (project_id,account_id);
ALTER TABLE project_role_assignment ADD UNIQUE (project_id,account_id,role_id);
ALTER TABLE presales_action ADD UNIQUE (project_id,action_key);
ALTER TABLE presales_deliverable ADD UNIQUE (action_id,version_number);
ALTER TABLE presales_investment ADD UNIQUE (reverses_id);
CREATE INDEX ix_crm_customer_owner_account_id ON crm_customer(owner_account_id);
CREATE INDEX ix_crm_contact_customer_id ON crm_contact(customer_id);
CREATE INDEX ix_crm_opportunity_customer_id ON crm_opportunity(customer_id);
CREATE INDEX ix_crm_opportunity_owner_account_id ON crm_opportunity(owner_account_id);
CREATE INDEX ix_crm_opportunity_project_id ON crm_opportunity(project_id);
CREATE INDEX ix_crm_opportunity_activity_opportunity_id ON crm_opportunity_activity(opportunity_id);
CREATE INDEX ix_project_space_opportunity_id ON project_space(opportunity_id);
CREATE INDEX ix_project_member_project_id ON project_member(project_id);
CREATE INDEX ix_project_role_assignment_project_id ON project_role_assignment(project_id);
CREATE INDEX ix_presales_initiation_project_id ON presales_initiation(project_id);
CREATE INDEX ix_presales_action_project_id ON presales_action(project_id);
CREATE INDEX ix_presales_action_owner_account_id ON presales_action(owner_account_id);
CREATE INDEX ix_presales_deliverable_project_id ON presales_deliverable(project_id);
CREATE INDEX ix_presales_investment_project_id ON presales_investment(project_id);
CREATE INDEX ix_presales_quote_review_project_id ON presales_quote_review(project_id);
CREATE INDEX ix_project_requirement_project_id ON project_requirement(project_id);
CREATE INDEX ix_project_requirement_owner_account_id ON project_requirement(owner_account_id);
CREATE INDEX ix_requirement_assessment_requirement_id ON requirement_assessment(requirement_id);
CREATE INDEX ix_project_work_item_project_id ON project_work_item(project_id);
CREATE INDEX ix_project_work_item_owner_account_id ON project_work_item(owner_account_id);
CREATE INDEX ix_requirement_link_requirement_id ON requirement_link(requirement_id);
ALTER TABLE project_requirement ADD CHECK (owner_account_id <> verifier_account_id);
ALTER TABLE project_work_item ADD CHECK (owner_account_id <> verifier_account_id);
INSERT INTO menu_resource(id,code,resource_type,name,icon_key,sort_order,status) VALUES ('d14ea086-d0a8-5c5d-b412-acefd0bb1a6d','CRM_DIRECTORY','DIRECTORY','商机与客户','folder',10,'ENABLED');
INSERT INTO menu_resource(id,code,resource_type,name,icon_key,sort_order,status) VALUES ('53d6fd93-46b0-556a-bc69-85720a84405a','PROJECT_CENTER_DIRECTORY','DIRECTORY','项目中心','folder',20,'ENABLED');
INSERT INTO menu_resource(id,code,resource_type,parent_id,name,route_key,icon_key,sort_order,status) VALUES ('546e1f3e-478f-5cc9-a07e-9e49cda82107','CRM_CUSTOMERS_PAGE','MENU_PAGE','d14ea086-d0a8-5c5d-b412-acefd0bb1a6d','客户管理','crm.customers','users',0,'ENABLED');
INSERT INTO menu_resource(id,code,resource_type,parent_id,name,route_key,icon_key,sort_order,status) VALUES ('eaf3afa8-f55a-540e-8ab3-c396870a51d0','CRM_OPPORTUNITIES_PAGE','MENU_PAGE','d14ea086-d0a8-5c5d-b412-acefd0bb1a6d','商机台账','crm.opportunities','folder',1,'ENABLED');
INSERT INTO menu_resource(id,code,resource_type,parent_id,name,route_key,icon_key,sort_order,status) VALUES ('3a7676cc-dbe8-57b8-8611-bc6025eb4a74','PROJECTS_PAGE','MENU_PAGE','53d6fd93-46b0-556a-bc69-85720a84405a','项目台账','business.projects','folder',2,'ENABLED');
INSERT INTO menu_resource(id,code,resource_type,parent_id,name,route_key,icon_key,sort_order,status) VALUES ('c4abc8b0-7ae1-59a3-b12b-ee6171e7bfff','PRESALES_PAGE','MENU_PAGE','53d6fd93-46b0-556a-bc69-85720a84405a','售前管理','business.presales','gauge',3,'ENABLED');
INSERT INTO menu_resource(id,code,resource_type,parent_id,name,route_key,icon_key,sort_order,status) VALUES ('7d62f67e-0c91-56a2-ab88-b6287ae42c2f','REQUIREMENTS_PAGE','MENU_PAGE','53d6fd93-46b0-556a-bc69-85720a84405a','需求池','business.requirements','folder',4,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('34bd49fa-69ea-53c7-96ac-1b1b35d6c3c6','NAV_CRM_CUSTOMERS_VIEW','546e1f3e-478f-5cc9-a07e-9e49cda82107','查看客户管理','nav.crm.customers.view','MENU','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('0057229c-0989-5df4-93b7-36e0b45064eb','NAV_CRM_OPPORTUNITIES_VIEW','eaf3afa8-f55a-540e-8ab3-c396870a51d0','查看商机台账','nav.crm.opportunities.view','MENU','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('2ee3a395-588e-58be-8bf5-434c3376684e','NAV_PROJECTS_VIEW','3a7676cc-dbe8-57b8-8611-bc6025eb4a74','查看项目台账','nav.projects.view','MENU','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('3cadc66e-3a59-54f9-b8c1-790c603d2248','NAV_PRESALES_VIEW','c4abc8b0-7ae1-59a3-b12b-ee6171e7bfff','查看售前管理','nav.presales.view','MENU','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('314ef46a-1c10-5d8c-a68e-ccdb3ebee84a','NAV_REQUIREMENTS_VIEW','7d62f67e-0c91-56a2-ab88-b6287ae42c2f','查看需求池','nav.requirements.view','MENU','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('cc2416b5-9407-50db-87f5-dd3270869185','BUSINESS_PEOPLE_READ',NULL,'查看业务可选人员','business.people.read','ACTION','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('a1994a0d-3711-5fff-93e0-5a8fbc7e2066','CRM_CUSTOMER_READ',NULL,'查看客户','crm.customer.read','ACTION','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('ad3953f3-df60-5e55-8047-2938fcc21e09','CRM_CUSTOMER_CREATE',NULL,'创建客户','crm.customer.create','ACTION','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('70a0e415-2f63-5c93-b322-df63dbedf0d7','CRM_CUSTOMER_EDIT',NULL,'维护客户','crm.customer.edit','ACTION','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('2435babc-2740-575f-b1d8-76dd1cfe5dbe','CRM_CUSTOMER_MERGE',NULL,'合并客户','crm.customer.merge','ACTION','HIGH',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('3321cd7a-0bd2-5db1-b675-892ad334fff6','CRM_CONTACT_READ',NULL,'查看客户联系方式','crm.contact.read','ACTION','HIGH',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('402a78ed-faaf-57c5-8c9b-d72a3c561466','CRM_CONTACT_EDIT',NULL,'维护客户联系人','crm.contact.edit','ACTION','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('5a6545bf-1cf4-5372-9c56-0a525e15b9f4','CRM_OPPORTUNITY_READ',NULL,'查看商机','crm.opportunity.read','ACTION','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('7df12e01-e2da-57ad-aa28-bf01a17f46c5','CRM_OPPORTUNITY_CREATE',NULL,'创建商机','crm.opportunity.create','ACTION','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('97f62b3f-fccc-5f7b-99eb-76279b2d8e28','CRM_OPPORTUNITY_EDIT',NULL,'维护商机行动及分类','crm.opportunity.edit','ACTION','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('d18668ff-9330-5986-acde-92f3314ab532','CRM_OPPORTUNITY_RESULT',NULL,'记录商机结果与重开','crm.opportunity.result','ACTION','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('85b161f1-a897-567c-a6b8-28fe114fe164','PROJECT_READ',NULL,'查看项目空间','project.read','ACTION','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('c1e943a6-c9b4-5387-93e9-199fc061192a','PROJECT_CREATE',NULL,'从商机创建空间','project.create','ACTION','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('e25d19ae-b019-5f48-be0b-9bd2eed41f33','PROJECT_EDIT',NULL,'维护项目概览','project.edit','ACTION','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('6b38d6f7-b61c-54fa-ad31-bf3c2550df9f','PROJECT_MEMBER_MANAGE',NULL,'管理项目成员与职责','project.member.manage','ACTION','HIGH',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('a6422648-6f89-5422-bd85-510ccdc566b2','PRESALES_READ',NULL,'查看售前协同','presales.read','ACTION','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('41e9ffb8-417d-5e6a-b37c-ccbf7a7619a0','PRESALES_EDIT',NULL,'维护售前申请、动作及成果','presales.edit','ACTION','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('6f1894dd-bc2f-5480-a27f-ce9d0f5e6158','PRESALES_REVIEW',NULL,'复核售前立项与报价','presales.review','ACTION','HIGH',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('0622d256-d564-5742-a43e-fcc38110fb26','REQUIREMENT_READ',NULL,'查看需求池','requirement.read','ACTION','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('14544c33-f0f5-53cc-bfac-5258ec195ecb','REQUIREMENT_CREATE',NULL,'登记原始需求','requirement.create','ACTION','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('65159d92-042b-5805-bc72-dce2cf173890','REQUIREMENT_EDIT',NULL,'澄清及处理需求','requirement.edit','ACTION','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('cdcdc10d-dfca-53c0-89e4-77d7df6c3ee8','REQUIREMENT_VERIFY',NULL,'独立验证需求','requirement.verify','ACTION','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('1be21af5-42e3-5e27-a26f-624bc9905768','WORK_READ',NULL,'查看需求处理记录','work.read','ACTION','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('ed20fb3a-c75f-5596-bf1f-64c5f686112f','WORK_EDIT',NULL,'维护需求处理记录','work.edit','ACTION','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('3916e35a-8e01-5b9f-9349-2d110e071aa0','WORK_REVIEW',NULL,'审批或验证需求处理记录','work.review','ACTION','HIGH',TRUE,'ENABLED');
INSERT INTO access_role(id,code,name,role_type,responsibility_summary,status,delegation_level) VALUES ('425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','BUSINESS_ADMIN','业务管理员','SYSTEM','WI-008 初始业务角色，可在正式权限管理中维护。','ENABLED',80);
INSERT INTO access_role(id,code,name,role_type,responsibility_summary,status,delegation_level) VALUES ('061a8962-8d69-58c0-8230-a6d242ea1aa7','BUSINESS_USER','业务员工','SYSTEM','WI-008 初始业务角色，可在正式权限管理中维护。','ENABLED',10);
INSERT INTO access_role(id,code,name,role_type,responsibility_summary,status,delegation_level) VALUES ('da383aaa-2d85-5535-975a-284ebbaeacdb','PROJECT_OWNER','项目责任人','PROJECT','WI-008 初始业务角色，可在正式权限管理中维护。','ENABLED',30);
INSERT INTO access_role(id,code,name,role_type,responsibility_summary,status,delegation_level) VALUES ('15569e82-56fb-506f-9716-6c723b22d81a','PROJECT_CONTRIBUTOR','项目协作成员','PROJECT','WI-008 初始业务角色，可在正式权限管理中维护。','ENABLED',10);
INSERT INTO access_role(id,code,name,role_type,responsibility_summary,status,delegation_level) VALUES ('1965e77a-5c66-5150-b81a-88ff60f3b583','PROJECT_REVIEWER','项目复核人','PROJECT','WI-008 初始业务角色，可在正式权限管理中维护。','ENABLED',40);
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('c48a7941-0c89-5629-9085-447d82b1eea8','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','34bd49fa-69ea-53c7-96ac-1b1b35d6c3c6','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('6ecf2098-6b55-509d-830f-d8971e40ff9a','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','0057229c-0989-5df4-93b7-36e0b45064eb','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('21fa098b-5916-5874-838b-94c0e6adc3b4','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','2ee3a395-588e-58be-8bf5-434c3376684e','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('b8dc36d0-a6c9-5ed5-afdf-e4b0b5499b5e','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','3cadc66e-3a59-54f9-b8c1-790c603d2248','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('03fea838-aa34-52bc-8fdd-c63b9df9152f','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','314ef46a-1c10-5d8c-a68e-ccdb3ebee84a','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('a221267a-94de-529b-ad6c-7a3be0c2ac07','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','cc2416b5-9407-50db-87f5-dd3270869185','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('b9b714a9-19f9-5d6c-beef-4112a06e0794','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','a1994a0d-3711-5fff-93e0-5a8fbc7e2066','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('df952fb0-e101-5be4-9472-5b44b32b8db6','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','ad3953f3-df60-5e55-8047-2938fcc21e09','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('b47adf31-7401-524f-8537-139e30179aea','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','70a0e415-2f63-5c93-b322-df63dbedf0d7','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('7e2b7ef5-7015-57f3-9d15-9758ffc2c1b8','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','2435babc-2740-575f-b1d8-76dd1cfe5dbe','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('97f14664-3f79-524f-be42-c9691da32140','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','3321cd7a-0bd2-5db1-b675-892ad334fff6','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('9f4e20b3-12c3-5436-a350-9f95625584d2','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','402a78ed-faaf-57c5-8c9b-d72a3c561466','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('142676a9-a8ec-57d0-b9b8-77fbef4e0c1f','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','5a6545bf-1cf4-5372-9c56-0a525e15b9f4','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('7f237b51-d19a-5675-acd6-065af1b6e7f0','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','7df12e01-e2da-57ad-aa28-bf01a17f46c5','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('3105f1c6-af63-51da-9953-66b204d75984','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','97f62b3f-fccc-5f7b-99eb-76279b2d8e28','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('7999ba66-992d-5e60-a73a-ab9c9bff3c66','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','d18668ff-9330-5986-acde-92f3314ab532','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('1b2171e2-708f-5513-b4e9-139125281b31','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','85b161f1-a897-567c-a6b8-28fe114fe164','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('600ba023-0d10-5a1b-94bc-2714ee98e5e0','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','c1e943a6-c9b4-5387-93e9-199fc061192a','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('9db833c3-b84a-5beb-83df-9f1d94e8bd94','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','e25d19ae-b019-5f48-be0b-9bd2eed41f33','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('7ab56895-8810-5e06-b1ac-76aab1fb2b89','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','6b38d6f7-b61c-54fa-ad31-bf3c2550df9f','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('f0379ddf-418b-5a44-b815-20d924e69000','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','a6422648-6f89-5422-bd85-510ccdc566b2','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('eb8ce613-9638-5995-b490-2b65c2ab7342','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','41e9ffb8-417d-5e6a-b37c-ccbf7a7619a0','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('9fef2725-9077-5a4e-957a-31bfbb6fefaf','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','6f1894dd-bc2f-5480-a27f-ce9d0f5e6158','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('b9ae72e2-219a-581c-a8ab-881194c1baed','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','0622d256-d564-5742-a43e-fcc38110fb26','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('dbf928d3-8473-5aa0-969b-f48003f6de56','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','14544c33-f0f5-53cc-bfac-5258ec195ecb','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('c96649c3-10d8-5dae-a163-1a01ebbebb03','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','65159d92-042b-5805-bc72-dce2cf173890','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('3fac3d0a-e3ca-52d8-8a95-fde2fe5f94d4','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','cdcdc10d-dfca-53c0-89e4-77d7df6c3ee8','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('3f86e495-b295-5161-917e-d0a3cd858c70','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','1be21af5-42e3-5e27-a26f-624bc9905768','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('1f787f59-ef00-503d-916c-c852795798ca','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','ed20fb3a-c75f-5596-bf1f-64c5f686112f','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('ccd46eb3-ef56-5eb2-9ad1-982262b33ec2','425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','3916e35a-8e01-5b9f-9349-2d110e071aa0','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('bf858ff9-ba57-5a94-9e9d-eef1f0423c6c','061a8962-8d69-58c0-8230-a6d242ea1aa7','34bd49fa-69ea-53c7-96ac-1b1b35d6c3c6','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('32a29cae-f153-5d5e-8fb6-416adb105a6a','061a8962-8d69-58c0-8230-a6d242ea1aa7','0057229c-0989-5df4-93b7-36e0b45064eb','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('b1119432-a66c-51c1-a10d-72fc9d38ca6a','061a8962-8d69-58c0-8230-a6d242ea1aa7','2ee3a395-588e-58be-8bf5-434c3376684e','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('8ee6bc21-4ef5-5581-9f45-cf44614c3cea','061a8962-8d69-58c0-8230-a6d242ea1aa7','3cadc66e-3a59-54f9-b8c1-790c603d2248','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('816c52c0-e204-5f75-8f04-5ad71f47655c','061a8962-8d69-58c0-8230-a6d242ea1aa7','314ef46a-1c10-5d8c-a68e-ccdb3ebee84a','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('1c28659d-28d8-544d-82c4-8c863bb75bb8','061a8962-8d69-58c0-8230-a6d242ea1aa7','cc2416b5-9407-50db-87f5-dd3270869185','ALL_ORGANIZATION');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('9284ff20-affd-5a12-88d6-77f91a93bd32','061a8962-8d69-58c0-8230-a6d242ea1aa7','a1994a0d-3711-5fff-93e0-5a8fbc7e2066','OWN_ORG');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('7a722df8-f251-5124-90c6-c044808a8002','061a8962-8d69-58c0-8230-a6d242ea1aa7','ad3953f3-df60-5e55-8047-2938fcc21e09','SELF');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('e5facf98-56d3-5880-b8f9-8685ecf84ffb','061a8962-8d69-58c0-8230-a6d242ea1aa7','70a0e415-2f63-5c93-b322-df63dbedf0d7','SELF');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('28364f5a-6d2a-5b19-951c-a8ca347a3336','061a8962-8d69-58c0-8230-a6d242ea1aa7','3321cd7a-0bd2-5db1-b675-892ad334fff6','OWN_ORG');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('f652da1d-69e8-59ce-8d63-5b38dff6ab23','061a8962-8d69-58c0-8230-a6d242ea1aa7','402a78ed-faaf-57c5-8c9b-d72a3c561466','SELF');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('adc14dd8-e491-5c09-9cdf-5cd57386cb49','061a8962-8d69-58c0-8230-a6d242ea1aa7','5a6545bf-1cf4-5372-9c56-0a525e15b9f4','OWN_ORG');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('6ad59104-bda7-5a12-a4c1-a5bf260772c8','061a8962-8d69-58c0-8230-a6d242ea1aa7','7df12e01-e2da-57ad-aa28-bf01a17f46c5','SELF');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('73c4150d-15c5-5a26-a283-2775c970cb4e','061a8962-8d69-58c0-8230-a6d242ea1aa7','97f62b3f-fccc-5f7b-99eb-76279b2d8e28','SELF');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('7473a3ff-c1cd-50a3-b96b-1ed40035c348','061a8962-8d69-58c0-8230-a6d242ea1aa7','d18668ff-9330-5986-acde-92f3314ab532','SELF');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('a1d68f1d-272e-5c55-9fbf-965c2e038f91','061a8962-8d69-58c0-8230-a6d242ea1aa7','c1e943a6-c9b4-5387-93e9-199fc061192a','SELF');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('a44d5a62-2f05-5760-a430-2c4f900e1182','061a8962-8d69-58c0-8230-a6d242ea1aa7','85b161f1-a897-567c-a6b8-28fe114fe164','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('4a693653-42a1-5530-832d-ce572fc934c4','da383aaa-2d85-5535-975a-284ebbaeacdb','85b161f1-a897-567c-a6b8-28fe114fe164','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('fb5b27fa-1548-542b-8a6d-75abd72a810e','da383aaa-2d85-5535-975a-284ebbaeacdb','a6422648-6f89-5422-bd85-510ccdc566b2','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('ddbb3d82-1f4e-59e2-905b-8681bda33b27','da383aaa-2d85-5535-975a-284ebbaeacdb','41e9ffb8-417d-5e6a-b37c-ccbf7a7619a0','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('234f0b54-eec1-5ac4-9e3b-2e7313f3fab2','da383aaa-2d85-5535-975a-284ebbaeacdb','0622d256-d564-5742-a43e-fcc38110fb26','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('f14ce07b-6d91-516c-bf4f-609dc3c085f7','da383aaa-2d85-5535-975a-284ebbaeacdb','14544c33-f0f5-53cc-bfac-5258ec195ecb','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('d4ead015-aef5-591a-a802-521b32497d95','da383aaa-2d85-5535-975a-284ebbaeacdb','65159d92-042b-5805-bc72-dce2cf173890','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('e4e29df6-ead9-52cf-812d-9b257daecd21','da383aaa-2d85-5535-975a-284ebbaeacdb','cdcdc10d-dfca-53c0-89e4-77d7df6c3ee8','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('9aa0fe4e-2e39-5ea2-bfba-041cc59f3859','da383aaa-2d85-5535-975a-284ebbaeacdb','1be21af5-42e3-5e27-a26f-624bc9905768','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('32d5efbf-ce01-53ad-99d3-14707a537cdc','da383aaa-2d85-5535-975a-284ebbaeacdb','ed20fb3a-c75f-5596-bf1f-64c5f686112f','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('4af32fad-78af-5a3b-9afb-90e0db0b2167','da383aaa-2d85-5535-975a-284ebbaeacdb','3916e35a-8e01-5b9f-9349-2d110e071aa0','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('beaaed48-d997-5f7d-82e3-f7250e6e583d','da383aaa-2d85-5535-975a-284ebbaeacdb','e25d19ae-b019-5f48-be0b-9bd2eed41f33','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('cb20169a-2505-565a-91c0-cf916b652324','da383aaa-2d85-5535-975a-284ebbaeacdb','6b38d6f7-b61c-54fa-ad31-bf3c2550df9f','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('60417259-32e6-518b-ad78-00ab36ce4c36','15569e82-56fb-506f-9716-6c723b22d81a','85b161f1-a897-567c-a6b8-28fe114fe164','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('c39cec39-ba6e-5dfa-a866-56af8e112569','15569e82-56fb-506f-9716-6c723b22d81a','a6422648-6f89-5422-bd85-510ccdc566b2','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('de291e2e-c2e7-5ec1-8c86-76d0a655c3cd','15569e82-56fb-506f-9716-6c723b22d81a','41e9ffb8-417d-5e6a-b37c-ccbf7a7619a0','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('1b18239c-a9fc-5e3b-947b-761da1e6a9f1','15569e82-56fb-506f-9716-6c723b22d81a','0622d256-d564-5742-a43e-fcc38110fb26','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('94646a3f-9a1b-5f4f-a6a1-5e99ccd9c874','15569e82-56fb-506f-9716-6c723b22d81a','14544c33-f0f5-53cc-bfac-5258ec195ecb','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('acd3bad7-258a-5d87-9aff-1a5a91e4086b','15569e82-56fb-506f-9716-6c723b22d81a','65159d92-042b-5805-bc72-dce2cf173890','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('977fef8f-411e-5e8a-a838-f137f51345d1','15569e82-56fb-506f-9716-6c723b22d81a','cdcdc10d-dfca-53c0-89e4-77d7df6c3ee8','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('791e26d9-a1a8-58a2-bdbc-ca403cad3446','15569e82-56fb-506f-9716-6c723b22d81a','1be21af5-42e3-5e27-a26f-624bc9905768','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('3cd0f54a-36c5-5c3f-8144-66eb5cdfcfaf','15569e82-56fb-506f-9716-6c723b22d81a','ed20fb3a-c75f-5596-bf1f-64c5f686112f','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('bd07696d-d307-5ea7-b6fa-d90c13b71df9','15569e82-56fb-506f-9716-6c723b22d81a','3916e35a-8e01-5b9f-9349-2d110e071aa0','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('64c2574d-77eb-5c78-b123-c2abe6dfff38','1965e77a-5c66-5150-b81a-88ff60f3b583','85b161f1-a897-567c-a6b8-28fe114fe164','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('99f55cad-00ad-5892-a941-4bb8999249b4','1965e77a-5c66-5150-b81a-88ff60f3b583','a6422648-6f89-5422-bd85-510ccdc566b2','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('634e747b-cc81-5199-b0aa-a265228df50d','1965e77a-5c66-5150-b81a-88ff60f3b583','6f1894dd-bc2f-5480-a27f-ce9d0f5e6158','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('6ec15c62-dc5d-5e5a-8ac2-02cd612c9943','1965e77a-5c66-5150-b81a-88ff60f3b583','0622d256-d564-5742-a43e-fcc38110fb26','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('f534f8f2-7714-5806-8aaa-3880cbbdca2d','1965e77a-5c66-5150-b81a-88ff60f3b583','cdcdc10d-dfca-53c0-89e4-77d7df6c3ee8','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('3cc0c9b3-ed84-5d71-a514-c160811eb8ca','1965e77a-5c66-5150-b81a-88ff60f3b583','1be21af5-42e3-5e27-a26f-624bc9905768','PARTICIPATING_PROJECTS');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) VALUES ('e78aabdc-4110-5136-9626-a4392594585a','1965e77a-5c66-5150-b81a-88ff60f3b583','3916e35a-8e01-5b9f-9349-2d110e071aa0','PARTICIPATING_PROJECTS');
-- Only the existing local bootstrap account receives the explicit business-admin role.
INSERT INTO system_role_assignment(id,account_id,role_id,status,assigned_by_account_id)
SELECT md5('WI008-BUSINESS-ADMIN:' || id::text)::uuid,id,'425eb4ba-1d2c-51d1-81b0-9fb1ffe1fa6b','ACTIVE',id
FROM user_account WHERE bootstrap_system_administrator = TRUE
ON CONFLICT(account_id,role_id) DO NOTHING;

