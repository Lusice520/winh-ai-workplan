-- Summary access does not imply access to sensitive individual investment entries.
INSERT INTO permission_item(id,code,menu_resource_id,name,action_key,dimension,risk_level,can_delegate,status)
VALUES ('3fb8bd70-0cbe-4d34-966c-76f5aa600601','PRESALES_INVESTMENT_READ',NULL,'查看售前投入明细','presales.investment.read','ACTION','HIGH',TRUE,'ENABLED'),
       ('3fb8bd70-0cbe-4d34-966c-76f5aa600602','PRESALES_INVESTMENT_EDIT',NULL,'登记及冲销售前投入','presales.investment.edit','ACTION','HIGH',TRUE,'ENABLED');
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope)
SELECT '3fb8bd70-0cbe-4d34-966c-76f5aa600611',id,'3fb8bd70-0cbe-4d34-966c-76f5aa600601','ALL_ORGANIZATION' FROM access_role WHERE code='BUSINESS_ADMIN';
INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope)
SELECT '3fb8bd70-0cbe-4d34-966c-76f5aa600612',id,'3fb8bd70-0cbe-4d34-966c-76f5aa600602','ALL_ORGANIZATION' FROM access_role WHERE code='BUSINESS_ADMIN';
