-- WI-011: actual facts reference the original approved delivery objects.
CREATE TABLE execution_stage (
 id UUID PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 project_id UUID NOT NULL REFERENCES project_space(id), stage_id UUID NOT NULL UNIQUE REFERENCES delivery_object(id),
 status VARCHAR(24) NOT NULL CHECK(status IN ('NOT_STARTED','IN_PROGRESS','PAUSED','COMPLETED')), progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
 started_on DATE, completed_on DATE, scope_hash VARCHAR(64) NOT NULL, object_version BIGINT NOT NULL, baseline_version INTEGER NOT NULL,
 CHECK(completed_on IS NULL OR (started_on IS NOT NULL AND completed_on>=started_on)), CHECK(status<>'COMPLETED' OR (progress=100 AND completed_on IS NOT NULL))
);
CREATE TABLE execution_item_profile (
 id UUID PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 project_id UUID NOT NULL REFERENCES project_space(id), item_id UUID NOT NULL UNIQUE REFERENCES delivery_object(id),
 requires_receipt BOOLEAN NOT NULL, requires_installation BOOLEAN NOT NULL, brand VARCHAR(160), model VARCHAR(160), supplier VARCHAR(240), scope_json TEXT NOT NULL, object_version BIGINT NOT NULL
);
CREATE TABLE execution_item_event (
 id UUID PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 project_id UUID NOT NULL REFERENCES project_space(id), item_id UUID NOT NULL REFERENCES delivery_object(id),
 kind VARCHAR(24) NOT NULL CHECK(kind IN ('RECEIVED','INSTALLED','ACCEPTED','REVERSAL')), status VARCHAR(24) NOT NULL CHECK(status IN ('RECORDED','PENDING','VERIFIED','RETURNED','REVERSED')),
 quantity NUMERIC(14,2) NOT NULL CHECK(quantity>0), occurred_on DATE NOT NULL, evidence VARCHAR(4000) NOT NULL, files_json TEXT NOT NULL,
 submitted_by UUID NOT NULL REFERENCES user_account(id), verifier_id UUID REFERENCES user_account(id), decided_by UUID REFERENCES user_account(id), decided_at TIMESTAMPTZ, decision VARCHAR(4000),
 reversal_of_id UUID UNIQUE REFERENCES execution_item_event(id), scope_hash VARCHAR(64) NOT NULL, object_version BIGINT NOT NULL, baseline_version INTEGER NOT NULL,
 CHECK((kind='REVERSAL')=(reversal_of_id IS NOT NULL)),
 CHECK(kind<>'ACCEPTED' OR (verifier_id IS NOT NULL AND verifier_id<>submitted_by)),
 CHECK(status<>'VERIFIED' OR (kind='ACCEPTED' AND decided_by=verifier_id AND decided_by<>submitted_by AND decided_at IS NOT NULL))
);
CREATE TABLE execution_milestone (
 id UUID PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 project_id UUID NOT NULL REFERENCES project_space(id), milestone_id UUID NOT NULL UNIQUE REFERENCES delivery_object(id),
 status VARCHAR(24) NOT NULL CHECK(status IN ('OPEN','PENDING','VERIFIED')), occurred_on DATE, evidence VARCHAR(4000), files_json TEXT NOT NULL,
 submitted_by UUID REFERENCES user_account(id), verifier_id UUID REFERENCES user_account(id), decided_by UUID REFERENCES user_account(id), decided_at TIMESTAMPTZ, decision VARCHAR(4000),
 scope_hash VARCHAR(64) NOT NULL, object_version BIGINT NOT NULL, baseline_version INTEGER NOT NULL,
 CHECK(status='OPEN' OR (occurred_on IS NOT NULL AND evidence IS NOT NULL AND submitted_by IS NOT NULL AND verifier_id IS NOT NULL AND verifier_id<>submitted_by)),
 CHECK(status<>'VERIFIED' OR (decided_by=verifier_id AND decided_by<>submitted_by AND decided_at IS NOT NULL))
);
CREATE TABLE execution_event (
 id UUID PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 project_id UUID NOT NULL REFERENCES project_space(id), object_id UUID NOT NULL REFERENCES delivery_object(id), kind VARCHAR(24) NOT NULL,
 action VARCHAR(40) NOT NULL, note VARCHAR(4000) NOT NULL, actor_id UUID NOT NULL REFERENCES user_account(id), occurred_on DATE NOT NULL,
 before_json TEXT NOT NULL, after_json TEXT NOT NULL, object_version BIGINT NOT NULL, baseline_version INTEGER NOT NULL
);
CREATE INDEX ix_execution_stage_project ON execution_stage(project_id);
CREATE INDEX ix_execution_profile_project ON execution_item_profile(project_id);
CREATE INDEX ix_execution_item_project ON execution_item_event(project_id,item_id,created_at DESC);
CREATE INDEX ix_execution_milestone_project ON execution_milestone(project_id);
CREATE INDEX ix_execution_event_project ON execution_event(project_id,created_at DESC);
CREATE INDEX ix_execution_event_object ON execution_event(project_id,object_id,created_at DESC);

INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES
 ('d1800000-0000-4000-8000-000000000001','DELIVERY_EXECUTION_READ','查看项目实际执行','delivery-execution.read','ACTION','NORMAL',TRUE,'ENABLED'),
 ('d1800000-0000-4000-8000-000000000002','DELIVERY_EXECUTION_EDIT','登记负责范围的执行事实','delivery-execution.edit','ACTION','NORMAL',TRUE,'ENABLED'),
 ('d1800000-0000-4000-8000-000000000003','DELIVERY_EXECUTION_REVIEW','独立核验交付事实','delivery-execution.review','ACTION','NORMAL',TRUE,'ENABLED'),
 ('d1800000-0000-4000-8000-000000000004','DELIVERY_EXECUTION_MANAGE','管理项目执行状态与适用性','delivery-execution.manage','ACTION','NORMAL',TRUE,'ENABLED');
-- Ordinary project capabilities; actual command ownership and independent verification are checked at runtime.
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope)
 SELECT md5('wi011-execution:'||r.code||':'||p.code)::uuid,r.id,p.id,
 CASE WHEN r.code='BUSINESS_ADMIN' THEN 'ALL_ORGANIZATION' ELSE 'PARTICIPATING_PROJECTS' END
 FROM access_role r CROSS JOIN permission_item p
 WHERE (r.code IN ('BUSINESS_ADMIN','PROJECT_OWNER') AND p.code IN ('DELIVERY_EXECUTION_READ','DELIVERY_EXECUTION_EDIT','DELIVERY_EXECUTION_REVIEW','DELIVERY_EXECUTION_MANAGE'))
 OR (r.code='PROJECT_CONTRIBUTOR' AND p.code IN ('DELIVERY_EXECUTION_READ','DELIVERY_EXECUTION_EDIT'))
 OR (r.code IN ('PROJECT_REVIEWER','DELIVERY_REVIEWER','DELIVERY_AUTHORIZER') AND p.code IN ('DELIVERY_EXECUTION_READ','DELIVERY_EXECUTION_REVIEW'));
