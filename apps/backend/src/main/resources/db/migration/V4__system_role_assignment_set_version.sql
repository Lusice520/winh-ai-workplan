CREATE TABLE system_role_assignment_set (
    account_id UUID PRIMARY KEY REFERENCES user_account(id),
    version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_role_assignment_set (account_id, version, updated_at)
SELECT DISTINCT account_id, 0, CURRENT_TIMESTAMP
FROM system_role_assignment
ON CONFLICT (account_id) DO NOTHING;
