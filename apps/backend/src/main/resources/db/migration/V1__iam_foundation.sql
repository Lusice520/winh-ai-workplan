CREATE TABLE org_unit (
    id UUID PRIMARY KEY,
    parent_id UUID NULL REFERENCES org_unit(id),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(64) NOT NULL,
    unit_type VARCHAR(24) NOT NULL,
    status VARCHAR(24) NOT NULL,
    manager_account_id UUID NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_org_unit_type CHECK (unit_type IN ('COMPANY', 'DEPARTMENT')),
    CONSTRAINT ck_org_unit_status CHECK (status IN ('ENABLED', 'DISABLED'))
);

CREATE UNIQUE INDEX ux_org_unit_code ON org_unit(code);
CREATE UNIQUE INDEX ux_org_unit_parent_name ON org_unit(parent_id, name);
CREATE INDEX ix_org_unit_parent ON org_unit(parent_id);

CREATE TABLE user_account (
    id UUID PRIMARY KEY,
    login_name VARCHAR(100) NOT NULL,
    login_name_normalized VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    employee_code VARCHAR(100) NULL,
    work_email VARCHAR(254) NULL,
    mobile_phone VARCHAR(32) NULL,
    organization_unit_id UUID NOT NULL REFERENCES org_unit(id),
    account_status VARCHAR(24) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    failed_login_count INTEGER NOT NULL DEFAULT 0,
    last_failed_login_at TIMESTAMP WITH TIME ZONE NULL,
    locked_until TIMESTAMP WITH TIME ZONE NULL,
    last_successful_login_at TIMESTAMP WITH TIME ZONE NULL,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    bootstrap_system_administrator BOOLEAN NOT NULL DEFAULT FALSE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_user_account_status CHECK (account_status IN ('ENABLED', 'DISABLED', 'LOCKED', 'TERMINATED'))
);

CREATE UNIQUE INDEX ux_user_account_login_name_normalized ON user_account(login_name_normalized);
CREATE UNIQUE INDEX ux_user_account_employee_code ON user_account(employee_code) WHERE employee_code IS NOT NULL;
CREATE INDEX ix_user_account_organization_unit ON user_account(organization_unit_id);
CREATE INDEX ix_user_account_status ON user_account(account_status);

ALTER TABLE org_unit
    ADD CONSTRAINT fk_org_unit_manager_account
    FOREIGN KEY (manager_account_id) REFERENCES user_account(id);

CREATE TABLE account_organization_history (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES user_account(id),
    previous_organization_unit_id UUID NULL REFERENCES org_unit(id),
    current_organization_unit_id UUID NOT NULL REFERENCES org_unit(id),
    reason VARCHAR(500) NOT NULL,
    actor_account_id UUID NULL REFERENCES user_account(id),
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    correlation_id VARCHAR(64) NOT NULL
);

CREATE INDEX ix_account_organization_history_account_time ON account_organization_history(account_id, occurred_at DESC);

CREATE TABLE account_status_history (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES user_account(id),
    previous_status VARCHAR(24) NULL,
    current_status VARCHAR(24) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    actor_account_id UUID NULL REFERENCES user_account(id),
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    correlation_id VARCHAR(64) NOT NULL
);

CREATE INDEX ix_account_status_history_account_time ON account_status_history(account_id, occurred_at DESC);

CREATE TABLE account_session (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES user_account(id),
    token_hash CHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    absolute_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    idle_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE NULL,
    revoked_reason VARCHAR(100) NULL
);

CREATE UNIQUE INDEX ux_account_session_token_hash ON account_session(token_hash);
CREATE INDEX ix_account_session_account_active ON account_session(account_id, revoked_at);

CREATE TABLE idempotency_record (
    id UUID PRIMARY KEY,
    operation_scope VARCHAR(120) NOT NULL,
    idempotency_key VARCHAR(160) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    target_id UUID NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE UNIQUE INDEX ux_idempotency_scope_key ON idempotency_record(operation_scope, idempotency_key);

CREATE TABLE audit_event (
    id UUID PRIMARY KEY,
    event_type VARCHAR(120) NOT NULL,
    actor_account_id UUID NULL,
    subject_type VARCHAR(100) NOT NULL,
    subject_id UUID NULL,
    outcome VARCHAR(24) NOT NULL,
    correlation_id VARCHAR(64) NOT NULL,
    reason VARCHAR(500) NULL,
    before_summary TEXT NULL,
    after_summary TEXT NULL,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_audit_event_outcome CHECK (outcome IN ('SUCCEEDED', 'DENIED', 'FAILED'))
);

CREATE INDEX ix_audit_event_subject_time ON audit_event(subject_type, subject_id, occurred_at DESC);
CREATE INDEX ix_audit_event_correlation ON audit_event(correlation_id);
