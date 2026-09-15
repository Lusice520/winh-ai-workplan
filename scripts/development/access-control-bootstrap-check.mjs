// Opt-in local verification. All people, companies, contracts and files below are synthetic.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
const origin=process.env.BUSINESS_CHECK_ORIGIN??'http://127.0.0.1:8080'
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw new Error('Local application required')
const run=Date.now().toString(36)
const evidence=[], report=name=>{evidence.push(name);console.log(`PASS ${name}`)}
const out=process.env.BUSINESS_CHECK_ARTIFACT_DIR??'outputs/verification/wi-007'
function client(){
 const cookies=new Map()
 async function request(method,path,body,expected=200,key=randomUUID()){
  const csrf=method==='GET'?null:(await request('GET','/api/auth/csrf')).token
  const binary=body instanceof FormData
  const response=await fetch(origin+path,{method,headers:{...(!binary?{'Content-Type':'application/json'}:{}),Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),...(csrf?{'X-XSRF-TOKEN':csrf,'Idempotency-Key':key}:{})},body:body===undefined?undefined:binary?body:JSON.stringify(body)})
  for(const h of response.headers.getSetCookie()){const p=h.split(';')[0],i=p.indexOf('=');cookies.set(p.slice(0,i),p.slice(i+1))}
  const data=response.headers.get('content-type')?.includes('application/json')?await response.json():Buffer.from(await response.arrayBuffer())
  assert.equal(response.status,expected,`${method} ${path}: ${response.status} ${data?.code??''} ${data?.message??''}`)
  return data
 }
 return {request,get:(p)=>request('GET',p),post:(p,b,status)=>request('POST',p,{requestId:randomUUID(),...b},status),patch:(p,b,status)=>request('PATCH',p,{requestId:randomUUID(),...b},status),login:(name,password)=>request('POST','/api/auth/login',{loginName:name,password}),cookies:()=>[...cookies].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/',httpOnly:name!=='XSRF-TOKEN',secure:false,sameSite:'Lax'}))}
}

const admin=client(),me=await admin.login(process.env.APP_BOOTSTRAP_ADMIN_LOGIN??'admin',process.env.APP_BOOTSTRAP_ADMIN_PASSWORD)
const roles=await admin.get('/api/access-control/roles'), assignments=await admin.get(`/api/access-control/accounts/${me.accountId}/system-role-assignments`)
assert.ok(assignments.assignments.some(a=>a.roleCode==='SYSTEM_SECURITY_ADMIN'&&a.status==='ACTIVE'))
const caps=await admin.get('/api/access-control/capabilities');assert.ok(caps.includes('IAM_USER_MANAGE'));assert.ok(caps.includes('IAM_ROLE_MANAGE'))
const unknown=await admin.post('/api/access-control/permission-preview',{subjectAccountId:me.accountId,permissionCode:'UNREGISTERED_BOOTSTRAP_PROBE'},404)
assert.equal(unknown.code,'RESOURCE_NOT_FOUND')
const hard=await admin.post('/api/access-control/permission-preview',{subjectAccountId:me.accountId,permissionCode:'IAM_USER_READ',sensitiveConditionsMet:false})
assert.equal(hard.allowed,false)
const org=(await admin.get(`/api/iam/users/${me.accountId}`)).organizationUnit.id
const created=await admin.request('POST','/api/iam/users',{loginName:`wi007-formal-first-${run}`,displayName:'验证·正式初始化角色创建账号',organizationUnitId:org,temporaryPassword:`Aa!9-${randomUUID()}`},201)
const bootstrapEvidence={at:new Date().toISOString(),origin,formalSecurityRoleAssigned:true,formalPermissionsPresent:true,unknownPermissionHttpStatus:404,hardConstraintDenied:true,syntheticUserCreated:true,createdUserId:created.id,roleCount:roles.length}
await mkdir('outputs/verification/wi-007',{recursive:true});await writeFile(`outputs/verification/wi-007/bootstrap-${new URL(origin).port}.json`,JSON.stringify(bootstrapEvidence,null,2))
console.log('PASS formal first-start roles, administrator creation, unknown permission and hard constraints after bridge removal')
