CREATE TABLE delivery_scope_change (
    id uuid PRIMARY KEY, version bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
    case_id uuid NOT NULL REFERENCES delivery_case(id),
    status varchar(24) NOT NULL CHECK (status IN ('DRAFT','RETURNED','SUBMITTED','APPROVED','CANCELLED')),
    base_baseline_version integer NOT NULL, base_hash varchar(64) NOT NULL,
    base_snapshot_json text NOT NULL, draft_json text NOT NULL, policy_json text,
    reason varchar(2000) NOT NULL, impact varchar(4000) NOT NULL, basis varchar(4000) NOT NULL,
    created_by uuid NOT NULL REFERENCES user_account(id), prepared_by uuid NOT NULL REFERENCES user_account(id),
    current_submission_id uuid
);
CREATE UNIQUE INDEX uq_delivery_scope_open ON delivery_scope_change(case_id)
    WHERE status IN ('DRAFT','RETURNED','SUBMITTED');
CREATE INDEX ix_delivery_scope_case ON delivery_scope_change(case_id,created_at);
CREATE TABLE delivery_scope_submission (
    id uuid PRIMARY KEY, version bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
    change_id uuid NOT NULL REFERENCES delivery_scope_change(id), number integer NOT NULL,
    status varchar(24) NOT NULL CHECK (status IN ('SUBMITTED','APPROVED','RETURNED','WITHDRAWN','CANCELLED')),
    frozen_json text NOT NULL, snapshot_hash varchar(64) NOT NULL,
    submitted_by uuid NOT NULL REFERENCES user_account(id), decided_by uuid REFERENCES user_account(id),
    decided_at timestamptz, decision_note varchar(4000), baseline_version integer,
    UNIQUE(change_id,number)
);
ALTER TABLE delivery_scope_change ADD CONSTRAINT fk_delivery_scope_current_submission
    FOREIGN KEY(current_submission_id) REFERENCES delivery_scope_submission(id);
