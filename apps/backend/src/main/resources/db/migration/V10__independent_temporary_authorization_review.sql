ALTER TABLE temporary_grant ADD COLUMN created_by_account_id UUID REFERENCES user_account(id);
ALTER TABLE temporary_grant ADD COLUMN reviewed_by_account_id UUID REFERENCES user_account(id);
ALTER TABLE temporary_grant ADD COLUMN reviewed_at TIMESTAMPTZ;
ALTER TABLE temporary_grant ADD COLUMN review_comment VARCHAR(1000);
ALTER TABLE temporary_grant DROP CONSTRAINT ck_temporary_grant_status;
ALTER TABLE temporary_grant ADD CONSTRAINT ck_temporary_grant_status CHECK (status IN ('PENDING_REVIEW','ACTIVE','REJECTED','REVOKED','EXPIRED'));
ALTER TABLE temporary_grant ADD CONSTRAINT ck_temporary_review_independent CHECK (
    reviewed_by_account_id IS NULL OR (reviewed_by_account_id=reviewer_account_id
        AND reviewed_by_account_id<>recipient_account_id AND reviewed_by_account_id<>created_by_account_id));

-- Existing rows have no verified approval event; never manufacture an approval.
UPDATE temporary_grant g SET status='PENDING_REVIEW',version=g.version+1,updated_at=CURRENT_TIMESTAMP
FROM permission_item p WHERE p.id=g.permission_item_id AND p.risk_level='HIGH' AND g.status='ACTIVE';

INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status)
VALUES ('9b7c1000-0000-4000-8000-000000000001','IAM_TEMPORARY_GRANT_REVIEW','复核高敏感临时授权','iam.temporary-grant.review','ACTION','HIGH',TRUE,'ENABLED');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope)
SELECT '9b7c1000-0000-4000-8000-000000000002',r.id,p.id,'ALL_ORGANIZATION'
FROM access_role r,permission_item p WHERE r.code='SYSTEM_SECURITY_ADMIN' AND p.code='IAM_TEMPORARY_GRANT_REVIEW';

INSERT INTO access_role(id,code,name,role_type,responsibility_summary,status,delegation_level)
VALUES ('9b7c1000-0000-4000-8000-000000000003','SECURITY_REVIEWER','独立授权复核员','SYSTEM','仅复核分配给本人的高敏感临时授权，不获得业务批准或角色配置权。','ENABLED',90);
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope)
SELECT gen_random_uuid(),r.id,p.id,'ALL_ORGANIZATION'
FROM access_role r,permission_item p
WHERE r.code='SECURITY_REVIEWER' AND p.code IN ('NAV_IAM_ACCESS_CONTROL_VIEW','IAM_TEMPORARY_GRANT_READ','IAM_TEMPORARY_GRANT_REVIEW');
