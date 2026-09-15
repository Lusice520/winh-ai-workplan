-- Navigation is global; project authorization is evaluated again for every delivery record.
-- Participating-project scope cannot resolve from an empty navigation context.
UPDATE role_permission_grant SET data_scope='ALL_ORGANIZATION'
WHERE permission_item_id=(SELECT id FROM permission_item WHERE code='NAV_DELIVERY_INITIATION_VIEW')
AND role_id IN (SELECT id FROM access_role WHERE role_type='SYSTEM');

INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope)
SELECT 'd1300000-0000-4000-8000-000000000001',r.id,p.id,'ALL_ORGANIZATION'
FROM access_role r,permission_item p
WHERE r.code='BUSINESS_USER' AND p.code='NAV_DELIVERY_INITIATION_VIEW';
