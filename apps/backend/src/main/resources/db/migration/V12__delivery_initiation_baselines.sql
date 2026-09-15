-- WI-010: typed delivery preparation, independent reviews and immutable baselines.
-- Existing work identities and requirement links are preserved. No company thresholds or initial authorizations are invented.

CREATE TABLE delivery_case (
id UUID PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, project_id UUID NOT NULL UNIQUE REFERENCES project_space(id), status VARCHAR(24) NOT NULL CHECK(status IN ('PREPARING','RETURNED','WITHDRAWN','SUBMITTED','IN_REVIEW','APPROVED')),
manager_id UUID NOT NULL REFERENCES user_account(id), prepared_by UUID NOT NULL REFERENCES user_account(id), header_json TEXT NOT NULL,
handover_package_id UUID NOT NULL REFERENCES handover_package(id), handover_json TEXT NOT NULL,
template_edition_id UUID REFERENCES delivery_configuration_edition(id), template_json TEXT,
policy_edition_id UUID REFERENCES delivery_configuration_edition(id), policy_json TEXT,
current_round_id UUID, round_number INTEGER NOT NULL DEFAULT 0, baseline_version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE delivery_object (
id UUID PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, case_id UUID NOT NULL REFERENCES delivery_case(id), kind VARCHAR(24) NOT NULL CHECK(kind IN ('STAGE','MILESTONE','ITEM','WORK_PACKAGE','PLAN','BUDGET')),
content_json TEXT NOT NULL, prepared_by UUID NOT NULL REFERENCES user_account(id), archived BOOLEAN NOT NULL DEFAULT FALSE, baseline_version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE delivery_resource (
id UUID PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, case_id UUID NOT NULL REFERENCES delivery_case(id), project_id UUID NOT NULL REFERENCES project_space(id),
work_package_id UUID NOT NULL REFERENCES delivery_object(id), person_id UUID NOT NULL REFERENCES user_account(id), committer_id UUID NOT NULL REFERENCES user_account(id),
starts_on DATE NOT NULL, ends_on DATE NOT NULL, daily_hours NUMERIC(5,2) NOT NULL CHECK(daily_hours>0 AND daily_hours<=24),
request_json TEXT NOT NULL, status VARCHAR(24) NOT NULL CHECK(status IN ('REQUESTED','COMMITTED','CONFLICT','RESOLVED','REVOKED')), commitment_json TEXT,
committed_by UUID REFERENCES user_account(id), committed_at TIMESTAMPTZ, overlap_hash VARCHAR(64), prepared_by UUID NOT NULL REFERENCES user_account(id),
CHECK(ends_on>=starts_on), CHECK(status NOT IN ('COMMITTED','RESOLVED') OR (committed_by=committer_id AND committed_at IS NOT NULL AND commitment_json IS NOT NULL))
);

CREATE TABLE delivery_finding (
id UUID PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, case_id UUID NOT NULL REFERENCES delivery_case(id), content_json TEXT NOT NULL, status VARCHAR(24) NOT NULL CHECK(status IN ('OPEN','PENDING_VERIFICATION','CLOSED')),
blocking BOOLEAN NOT NULL, prepared_by UUID NOT NULL REFERENCES user_account(id), evidence VARCHAR(4000), evidence_by UUID REFERENCES user_account(id), evidence_at TIMESTAMPTZ,
verification VARCHAR(4000), verified_by UUID REFERENCES user_account(id), verified_at TIMESTAMPTZ,
CHECK(status<>'CLOSED' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL AND verification IS NOT NULL AND evidence IS NOT NULL AND verified_by<>evidence_by))
);

CREATE TABLE delivery_round (
id UUID PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, case_id UUID NOT NULL REFERENCES delivery_case(id), round_number INTEGER NOT NULL CHECK(round_number>0), status VARCHAR(24) NOT NULL CHECK(status IN ('SUBMITTED','IN_REVIEW','WITHDRAWN','RETURNED','APPROVED')),
snapshot_json TEXT NOT NULL, snapshot_hash VARCHAR(64) NOT NULL, submitted_by UUID NOT NULL REFERENCES user_account(id), submission_note VARCHAR(4000) NOT NULL,
decided_by UUID REFERENCES user_account(id), decided_at TIMESTAMPTZ, decision_note VARCHAR(4000),
UNIQUE(case_id,round_number), CHECK(status<>'APPROVED' OR (decided_by IS NOT NULL AND decided_by<>submitted_by AND decided_at IS NOT NULL))
);

CREATE TABLE delivery_review (
id UUID PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, round_id UUID NOT NULL REFERENCES delivery_round(id), reviewer_id UUID NOT NULL REFERENCES user_account(id),
scope VARCHAR(24) NOT NULL CHECK(scope IN ('TECHNICAL','COMMERCIAL','FINANCIAL','SAFETY','QUALITY')), status VARCHAR(24) NOT NULL CHECK(status IN ('PENDING','AGREED','RETURNED')),
comment VARCHAR(4000), reviewed_at TIMESTAMPTZ, UNIQUE(round_id,reviewer_id)
);

CREATE TABLE delivery_baseline (
id UUID PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, case_id UUID NOT NULL REFERENCES delivery_case(id), baseline_version INTEGER NOT NULL CHECK(baseline_version>0),
round_id UUID REFERENCES delivery_round(id), snapshot_json TEXT NOT NULL, snapshot_hash VARCHAR(64) NOT NULL, approved_by UUID NOT NULL REFERENCES user_account(id), reason VARCHAR(4000) NOT NULL,
UNIQUE(case_id,baseline_version)
);

CREATE TABLE delivery_revision (
id UUID PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, case_id UUID NOT NULL REFERENCES delivery_case(id), object_id UUID NOT NULL, kind VARCHAR(24) NOT NULL, object_version BIGINT NOT NULL,
before_json TEXT, after_json TEXT NOT NULL, actor_id UUID NOT NULL REFERENCES user_account(id), reason VARCHAR(2000) NOT NULL, impact VARCHAR(4000), basis VARCHAR(4000)
);

CREATE TABLE delivery_change (
id UUID PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, case_id UUID NOT NULL REFERENCES delivery_case(id), object_id UUID NOT NULL REFERENCES delivery_object(id),
expected_object_version BIGINT NOT NULL, content_json TEXT NOT NULL, archive_requested BOOLEAN NOT NULL,
status VARCHAR(24) NOT NULL CHECK(status IN ('PENDING','APPROVED','RETURNED')), submitted_by UUID NOT NULL REFERENCES user_account(id),
reason VARCHAR(2000) NOT NULL, impact VARCHAR(4000) NOT NULL, basis VARCHAR(4000) NOT NULL,
decided_by UUID REFERENCES user_account(id), decided_at TIMESTAMPTZ, decision VARCHAR(4000),
CHECK(status<>'APPROVED' OR (decided_by IS NOT NULL AND decided_by<>submitted_by AND decided_at IS NOT NULL))
);

ALTER TABLE delivery_case ADD FOREIGN KEY(current_round_id) REFERENCES delivery_round(id);
CREATE UNIQUE INDEX ux_delivery_budget ON delivery_object(case_id) WHERE kind='BUDGET' AND NOT archived;
CREATE UNIQUE INDEX ux_delivery_open_round ON delivery_round(case_id) WHERE status IN ('SUBMITTED','IN_REVIEW');
CREATE UNIQUE INDEX ux_delivery_pending_change ON delivery_change(case_id,object_id) WHERE status='PENDING';
CREATE INDEX ix_delivery_resource_person_dates ON delivery_resource(person_id,starts_on,ends_on);
CREATE INDEX ix_delivery_resource_case ON delivery_resource(case_id);
CREATE INDEX ix_delivery_object_case ON delivery_object(case_id);
CREATE INDEX ix_delivery_finding_case ON delivery_finding(case_id);
CREATE INDEX ix_delivery_revision_case ON delivery_revision(case_id,created_at DESC);
ALTER TABLE project_work_item ALTER COLUMN source_requirement_id DROP NOT NULL;
ALTER TABLE project_work_item ADD COLUMN creation_source VARCHAR(24) NOT NULL DEFAULT 'REQUIREMENT';
ALTER TABLE project_work_item ADD COLUMN delivery_state VARCHAR(24) NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE project_work_item ADD COLUMN delivery_baseline_version INTEGER NOT NULL DEFAULT 0;
UPDATE project_work_item SET delivery_state=CASE WHEN status='DONE' THEN 'LEGACY_COMPLETE' ELSE 'AWAITING_BASELINE' END WHERE kind='WORK_PACKAGE';
ALTER TABLE project_work_item ADD CHECK((creation_source='REQUIREMENT' AND source_requirement_id IS NOT NULL) OR (creation_source='DELIVERY' AND kind='WORK_PACKAGE' AND source_requirement_id IS NULL));
ALTER TABLE project_work_item ADD CHECK(delivery_state IN ('NOT_REQUIRED','AWAITING_BASELINE','PREPARING','IN_REVIEW','BASELINED','LEGACY_COMPLETE'));

INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('d1200000-0000-4000-8000-000000000001','DG2_READ','查看交付立项与基线','dg2.read','ACTION','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('d1200000-0000-4000-8000-000000000002','DG2_EDIT','维护交付基线草案','dg2.edit','ACTION','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('d1200000-0000-4000-8000-000000000003','DG2_SUBMIT','提交交付联合评审','dg2.submit','ACTION','HIGH',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('d1200000-0000-4000-8000-000000000004','DG2_REVIEW','按专业范围会签交付立项','dg2.review','ACTION','HIGH',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('d1200000-0000-4000-8000-000000000005','DG2_APPROVE','按公司授权最终批准交付立项','dg2.approve','ACTION','HIGH',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('d1200000-0000-4000-8000-000000000006','DG2_RESOURCE_COMMIT','签认指定资源承诺','dg2.resource.commit','ACTION','HIGH',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('d1200000-0000-4000-8000-000000000007','DELIVERY_BUDGET_READ','查看实施预算明细','delivery.budget.read','ACTION','HIGH',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('d1200000-0000-4000-8000-000000000008','DELIVERY_BUDGET_EDIT','维护实施预算','delivery.budget.edit','ACTION','HIGH',TRUE,'ENABLED');
INSERT INTO menu_resource(id,code,resource_type,parent_id,name,route_key,icon_key,sort_order,status) VALUES ('d1200000-0000-4000-8000-000000000009','DELIVERY_INITIATION','MENU_PAGE','53d6fd93-46b0-556a-bc69-85720a84405a','交付立项','business.delivery-initiation','layers',5,'ENABLED');
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('d1200000-0000-4000-8000-000000000010','NAV_DELIVERY_INITIATION_VIEW','d1200000-0000-4000-8000-000000000009','查看交付立项目录','nav.delivery.initiation.view','MENU','NORMAL',TRUE,'ENABLED');
INSERT INTO access_role(id,code,name,role_type,responsibility_summary,status,delegation_level) VALUES ('d1200000-0000-4000-8000-000000000011','DELIVERY_RESOURCE_MANAGER','交付资源承诺人','SYSTEM','指定资源承诺与部门容量签认；不包含项目批准权。','ENABLED',70);
INSERT INTO access_role(id,code,name,role_type,responsibility_summary,status,delegation_level) VALUES ('d1200000-0000-4000-8000-000000000012','DELIVERY_REVIEWER','交付专业会签人','SYSTEM','仅在指定专业范围独立会签。','ENABLED',70);
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000013',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='DG2_READ';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000014',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='DG2_EDIT';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000015',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='DG2_SUBMIT';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000016',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='DG2_REVIEW';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000017',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='DELIVERY_BUDGET_READ';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000018',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='DELIVERY_BUDGET_EDIT';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000019',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='BUSINESS_ADMIN' AND p.code='NAV_DELIVERY_INITIATION_VIEW';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000020',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='PROJECT_OWNER' AND p.code='DG2_READ';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000021',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='PROJECT_OWNER' AND p.code='DG2_EDIT';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000022',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='PROJECT_OWNER' AND p.code='DG2_SUBMIT';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000023',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='PROJECT_OWNER' AND p.code='DELIVERY_BUDGET_READ';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000024',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='PROJECT_OWNER' AND p.code='DELIVERY_BUDGET_EDIT';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000025',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='PROJECT_OWNER' AND p.code='NAV_DELIVERY_INITIATION_VIEW';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000026',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='PROJECT_CONTRIBUTOR' AND p.code='DG2_READ';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000027',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='PROJECT_CONTRIBUTOR' AND p.code='DG2_EDIT';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000028',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='PROJECT_CONTRIBUTOR' AND p.code='NAV_DELIVERY_INITIATION_VIEW';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000029',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='PROJECT_REVIEWER' AND p.code='DG2_READ';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000030',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='PROJECT_REVIEWER' AND p.code='DG2_REVIEW';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000031',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='PROJECT_REVIEWER' AND p.code='NAV_DELIVERY_INITIATION_VIEW';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000032',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='DELIVERY_AUTHORIZER' AND p.code='DG2_READ';
-- Actual approval additionally requires current project membership and explicit designation.
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000033',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='DELIVERY_AUTHORIZER' AND p.code='DG2_APPROVE';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000034',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='DELIVERY_AUTHORIZER' AND p.code='DELIVERY_BUDGET_READ';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000035',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='DELIVERY_AUTHORIZER' AND p.code='PROJECT_READ';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000036',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='DELIVERY_AUTHORIZER' AND p.code='HANDOVER_READ';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000037',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='DELIVERY_AUTHORIZER' AND p.code='WORK_READ';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000038',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='DELIVERY_AUTHORIZER' AND p.code='NAV_DELIVERY_INITIATION_VIEW';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000039',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='DELIVERY_AUTHORIZER' AND p.code='NAV_PROJECTS_VIEW';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000040',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='DELIVERY_REVIEWER' AND p.code='DG2_READ';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000041',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='DELIVERY_REVIEWER' AND p.code='DG2_REVIEW';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000042',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='DELIVERY_REVIEWER' AND p.code='PROJECT_READ';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000043',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='DELIVERY_REVIEWER' AND p.code='HANDOVER_READ';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000044',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='DELIVERY_REVIEWER' AND p.code='WORK_READ';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000045',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='DELIVERY_REVIEWER' AND p.code='BUSINESS_PEOPLE_READ';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000046',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='DELIVERY_REVIEWER' AND p.code='NAV_DELIVERY_INITIATION_VIEW';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000047',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='DELIVERY_RESOURCE_MANAGER' AND p.code='DG2_READ';
-- Resource actions additionally enforce designated committer, project membership and the person's current organization.
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000048',r.id,p.id,'ALL_ORGANIZATION' FROM access_role r,permission_item p WHERE r.code='DELIVERY_RESOURCE_MANAGER' AND p.code='DG2_RESOURCE_COMMIT';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000049',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='DELIVERY_RESOURCE_MANAGER' AND p.code='PROJECT_READ';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000050',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='DELIVERY_RESOURCE_MANAGER' AND p.code='BUSINESS_PEOPLE_READ';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT 'd1200000-0000-4000-8000-000000000051',r.id,p.id,'PARTICIPATING_PROJECTS' FROM access_role r,permission_item p WHERE r.code='DELIVERY_RESOURCE_MANAGER' AND p.code='NAV_DELIVERY_INITIATION_VIEW';
