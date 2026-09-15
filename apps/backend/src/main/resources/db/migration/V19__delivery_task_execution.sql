-- WI-012: TASK keeps its original Work identity; plans and actual facts extend that record.
CREATE TABLE delivery_task_profile (
 id UUID PRIMARY KEY REFERENCES project_work_item(id), version BIGINT NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 project_id UUID NOT NULL REFERENCES project_space(id), work_package_id UUID NOT NULL REFERENCES project_work_item(id), stage_id UUID NOT NULL REFERENCES delivery_object(id),
 starts_on DATE NOT NULL, estimated_days NUMERIC(8,1), acceptance_criteria VARCHAR(4000) NOT NULL, item_ids_json TEXT NOT NULL,
 scope_hash VARCHAR(64) NOT NULL, baseline_version INTEGER NOT NULL, progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
 actual_started_on DATE, last_actual_on DATE, actual_completed_on DATE, files_json TEXT NOT NULL,
 CHECK(estimated_days IS NULL OR (estimated_days>0 AND MOD(estimated_days,0.5)=0)),
 CHECK(actual_completed_on IS NULL OR (actual_started_on IS NOT NULL AND actual_completed_on>=actual_started_on)),
 CHECK(last_actual_on IS NULL OR (actual_started_on IS NOT NULL AND last_actual_on>=actual_started_on))
);
CREATE INDEX ix_delivery_task_parent ON delivery_task_profile(project_id,work_package_id,updated_at DESC);
CREATE TABLE delivery_task_event (
 id UUID PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 project_id UUID NOT NULL REFERENCES project_space(id), task_id UUID NOT NULL REFERENCES project_work_item(id),
 action VARCHAR(32) NOT NULL, note VARCHAR(4000) NOT NULL, actor_id UUID NOT NULL REFERENCES user_account(id),
 before_json TEXT NOT NULL, after_json TEXT NOT NULL
);
CREATE INDEX ix_delivery_task_event ON delivery_task_event(project_id,task_id,created_at DESC);
