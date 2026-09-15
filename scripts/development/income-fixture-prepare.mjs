// Explicit, loopback-only synthetic finance authority; no production or standard-role grants.
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {storedClient} from './local-business-client.mjs'
assert.equal(process.env.BUSINESS_CHECK_SYNTHETIC_AUTHORITY_FIXTURE,'1')
const original=JSON.parse(await readFile('outputs/verification/wi-011-execution/fixture.json','utf8')),projectId=original.projectId
assert.equal(projectId,'c2ebb10c-39e1-4cdb-bca0-00724ffa808e')
const out='outputs/verification/wi-013-income';await mkdir(out,{recursive:true})
const admin=await storedClient('http://127.0.0.1:8080','.local-data/wi010-dg2-admin-session.json')
const definitions=[['manager','FORECAST',['FINANCE_READ','FINANCE_FORECAST_EDIT']],['successor','SUBMIT',['FINANCE_READ','FINANCE_INCOME_SUBMIT','CONTRACT_READ','CONTRACT_SENSITIVE_READ','FILE_CONTRACT_READ']],['verifier','CONFIRM',['FINANCE_READ','FINANCE_INCOME_CONFIRM','CONTRACT_READ','CONTRACT_SENSITIVE_READ','FILE_CONTRACT_READ']],['reviewer','CONFIRM',['FINANCE_READ','FINANCE_INCOME_CONFIRM','CONTRACT_READ','CONTRACT_SENSITIVE_READ','FILE_CONTRACT_READ']]]
const fixture={projectId,period:'2026-09',currency:'CNY',people:{},roles:{},checks:[]}
const sql=['BEGIN;']
for(const [personKey,kind,codes] of definitions){
 const person=original.people[personKey];assert.ok(person);assert.match(person.id,/^[a-f0-9-]{36}$/);assert.match(person.loginName,new RegExp('^wi010dg2-'+personKey+'-[a-z0-9]+$'))
 const current=await admin.get('/api/iam/users/'+person.id);assert.equal(current.loginName,person.loginName);assert.ok(current.displayName.startsWith('验证·'))
 const code='SYNTHETIC_WI013_'+kind;let role=fixture.roles[code]
 if(!role){role={id:randomUUID(),codes};fixture.roles[code]=role
  sql.push(`INSERT INTO access_role(id,code,name,role_type,responsibility_summary,status,delegation_level) VALUES ('${role.id}','${code}','验证·收入${kind}','PROJECT','仅用于当前WI013合成项目验证，不代表公司真实授权。','ENABLED',0);`)
  for(const permission of codes)sql.push(`INSERT INTO role_permission_grant(id,role_id,permission_item_id,data_scope) SELECT '${randomUUID()}','${role.id}',id,'PARTICIPATING_PROJECTS' FROM permission_item WHERE code='${permission}';`)
 }
 sql.push(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM project_member WHERE project_id='${projectId}' AND account_id='${person.id}' AND active) THEN RAISE EXCEPTION 'Synthetic actor must be a current participant'; END IF; END $$;`)
 sql.push(`INSERT INTO project_role_assignment(id,project_id,account_id,active,assigned_by,role_id) VALUES ('${randomUUID()}','${projectId}','${person.id}',TRUE,'${original.people.manager.id}','${role.id}');`)
 sql.push(`UPDATE project_member SET role_codes=role_codes||',${code}',version=version+1,updated_at=CURRENT_TIMESTAMP,change_reason='验证·显式建立本地收入岗位，无真实人员授权变更' WHERE project_id='${projectId}' AND account_id='${person.id}' AND active;`)
 fixture.people[personKey]=person
}
sql.push('COMMIT;')
await writeFile(out+'/authority-fixture.sql',sql.join('\n')+'\n',{flag:'wx'})
execFileSync('.local-tools/postgresapp-2.9.6/Postgres.app/Contents/Versions/18/bin/psql',['-X','-h','127.0.0.1','-p','54329','-U','winh','-d','winh_workplan','-v','ON_ERROR_STOP=1'],{input:sql.join('\n'),encoding:'utf8',stdio:['pipe','pipe','pipe']})
fixture.checks.push('Only exact synthetic enabled project actors received separate finance role assignments; standard roles and migration grant nobody.')
await writeFile(out+'/fixture.json',JSON.stringify(fixture,null,2),{flag:'wx'})
console.log('PASS synthetic forecast, PMO and two independent marketing roles are scoped to the existing project')
