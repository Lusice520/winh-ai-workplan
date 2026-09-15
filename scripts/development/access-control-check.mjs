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
const admin=client(), me=await admin.login(process.env.APP_BOOTSTRAP_ADMIN_LOGIN??'admin',process.env.APP_BOOTSTRAP_ADMIN_PASSWORD)
const ownerOrg=(await admin.get(`/api/iam/users/${me.accountId}`)).organizationUnit.id, roles=await admin.get('/api/access-control/roles')
async function user(suffix,name,role){
 const temp=`Aa!9-${randomUUID()}`,password=`Zz!8-${randomUUID()}`,loginName=`wi007-${suffix}-${run}`
 const u=await admin.request('POST','/api/iam/users',{loginName,displayName:`${name} ${run}`,organizationUnitId:ownerOrg,temporaryPassword:temp},201)
 const set=await admin.get(`/api/access-control/accounts/${u.id}/system-role-assignments`)
 await admin.request('PUT',`/api/access-control/accounts/${u.id}/system-role-assignments`,{roleIds:[roles.find(r=>r.code===role).id],version:set.version,reason:'WI-007 本地合成账号授权验证。'})
 const api=client();await api.login(loginName,temp);await api.request('POST','/api/auth/password/change',{currentPassword:temp,newPassword:password})
 return {id:u.id,api,loginName,name:u.displayName}
}
const recipient=await user('recipient','验证·权限闭环受授人','BUSINESS_USER'), reviewer=await user('reviewer','验证·独立授权复核员','SECURITY_REVIEWER'), delegate=await user('delegate','验证·有限委派管理员','BUSINESS_USER'), browserUser=await user('browser','验证·浏览器角色验证账号','BUSINESS_USER')
const caps=await reviewer.api.get('/api/access-control/capabilities');assert.ok(caps.includes('IAM_TEMPORARY_GRANT_REVIEW'));assert.ok(!caps.includes('IAM_ROLE_MANAGE'))
const menuBody={code:`VERIFY_DIRECTORY_${run.toUpperCase()}`,name:'验证·权限资源目录',resourceType:'DIRECTORY',iconKey:'settings',sortOrder:99,status:'ENABLED'}, key=randomUUID()
let directory=await admin.request('POST','/api/access-control/menu-resources',menuBody,201,key)
assert.equal((await admin.request('POST','/api/access-control/menu-resources',menuBody,201,key)).id,directory.id)
await admin.request('POST','/api/access-control/menu-resources',menuBody,409)
await admin.request('POST','/api/access-control/menu-resources',{...menuBody,code:`INVALID_${run.toUpperCase()}`,resourceType:'MENU_PAGE',parentId:directory.id,routeKey:'https://invalid.example'},400)
const page=(await admin.get('/api/access-control/menu-resources')).find(m=>m.routeKey==='business.projects')
assert.ok(page)
await admin.request('POST','/api/access-control/menu-resources',{code:`VERIFY_PAGE_${run.toUpperCase()}`,name:'验证·已占用页面键',resourceType:'MENU_PAGE',parentId:directory.id,routeKey:'business.projects',iconKey:'folder',sortOrder:1,status:'ENABLED'},409)
await admin.request('POST','/api/access-control/menu-resources',{code:`VERIFY_OPERATION_${run.toUpperCase()}`,name:'验证·已占用动作键',resourceType:'OPERATION',parentId:page.id,actionKey:'iam.access-control.manage',iconKey:'settings',sortOrder:1,status:'ENABLED'},409)
assert.equal((await admin.get(`/api/access-control/menu-resources/${directory.id}/impact`)).directChildCount,0)
await admin.request('DELETE',`/api/access-control/menu-resources/${page.id}`,undefined,405)
report('目录创建与幂等；重复编码及已占用页面/动作键拒绝；受控路由、影响引用及无物理删除入口')
const normalGrants=['NAV_IAM_ORGANIZATION_USERS_VIEW','IAM_USER_READ','IAM_ORGANIZATION_READ'].map(permissionCode=>({permissionCode,dataScope:'ALL_ORGANIZATION'}))
async function createRole(suffix,type='SYSTEM',level=10,grants=normalGrants){return admin.request('POST','/api/access-control/roles',{code:`VERIFY_${suffix}_${run.toUpperCase()}`,name:suffix==='USER_READ'?'验证·用户只读角色':`验证·${suffix}角色`,roleType:type,responsibilitySummary:'本地合成授权验证角色。',status:'ENABLED',delegationLevel:level,grants},201)}
const viewerRole=await createRole('USER_READ'), highRole=await createRole('HIGHER','SYSTEM',80)
// Stable role codes use ASCII; names remain descriptive Chinese.
for(const type of ['PROJECT','STAGE'])await createRole(type,type,10)
const lowRole=await createRole('DELEGATE','SYSTEM',50,['IAM_USER_READ','IAM_ROLE_READ','IAM_ROLE_MANAGE','IAM_SYSTEM_ROLE_ASSIGNMENT_READ','IAM_SYSTEM_ROLE_ASSIGNMENT_MANAGE'].map(permissionCode=>({permissionCode,dataScope:'ALL_ORGANIZATION'})))
async function assign(who,target,ids,expected=200){const current=await admin.get(`/api/access-control/accounts/${target}/system-role-assignments`);return who.request('PUT',`/api/access-control/accounts/${target}/system-role-assignments`,{roleIds:ids,version:current.version,reason:'验证·真实授权变化及撤回'},expected)}
const basic=roles.find(r=>r.code==='BUSINESS_USER').id
await assign(admin,delegate.id,[basic,lowRole.id]);await assign(admin,browserUser.id,[basic,highRole.id])
await delegate.api.request('POST','/api/access-control/roles',{code:`PEER_${run.toUpperCase()}`,name:'验证·同级拦截',roleType:'SYSTEM',responsibilitySummary:'不能创建同级角色',status:'DRAFT',delegationLevel:50,grants:[]},403)
await delegate.api.request('PATCH',`/api/access-control/roles/${highRole.id}`,{name:highRole.name,responsibilitySummary:'不能通过新低级别改写旧高级别',delegationLevel:10,version:highRole.version,grants:normalGrants},403)
await delegate.api.request('POST',`/api/access-control/roles/${highRole.id}/status`,{status:'DISABLED',reason:'不能停用原较高角色',version:highRole.version},403)
await assign(delegate.api,browserUser.id,[],403)
await assign(admin,browserUser.id,[basic])
await admin.request('POST','/api/access-control/roles',{code:`INVALID_SCOPE_${run.toUpperCase()}`,name:'验证·菜单范围错误',roleType:'SYSTEM',responsibilitySummary:'菜单不能使用对象范围',status:'ENABLED',delegationLevel:10,grants:[{permissionCode:'NAV_IAM_ORGANIZATION_USERS_VIEW',dataScope:'NAMED_OBJECTS',scopeReferences:'x'}]},400)
report('系统/项目/阶段角色分层；同级创建、原高级别降级/停用/撤销和不兼容范围被拒绝')
const original=JSON.parse(await readFile('outputs/verification/wi-009-nodes/fixture.json'))
let p=await admin.get(`/api/projects/${original.projectId}`)
p=await admin.post(`/api/projects/${original.projectId}/members`,{version:p.project.version,accountId:recipient.id,roleCodes:['PROJECT_CONTRIBUTOR'],active:true,reason:'验证·限定项目的临时合同敏感查看权'})
const contractPath=`/api/contracts/${original.contractId}`
assert.equal((await recipient.api.get(contractPath)).sensitiveVisible,false)
async function grant(startDelay=1000,duration=120000,expected=201,extra={}){const start=new Date(Date.now()+startDelay);return admin.request('POST','/api/access-control/temporary-grants',{recipientAccountId:recipient.id,permissionCode:'CONTRACT_SENSITIVE_READ',dataScope:'NAMED_PROJECTS',scopeReferences:original.projectId,startsAt:start.toISOString(),endsAt:new Date(start.getTime()+duration).toISOString(),reason:'验证·限定项目合同历史查验',reviewerAccountId:reviewer.id,...extra},expected)}
await grant(1000,25*3600000,400)
await grant(1000,120000,400,{reviewerAccountId:recipient.id})
let g=await grant();assert.equal(g.status,'PENDING_REVIEW');assert.equal((await recipient.api.get(contractPath)).sensitiveVisible,false)
const reviewPath=`/api/access-control/temporary-grants/${g.id}/review`,decision={decision:'APPROVED',comment:'验证·独立确认最小项目范围和原期限',version:g.version}
await admin.request('POST',reviewPath,decision,403);await recipient.api.request('POST',reviewPath,decision,403)
const reviewKey=randomUUID();g=await reviewer.api.request('POST',reviewPath,decision,200,reviewKey)
assert.equal((await reviewer.api.request('POST',reviewPath,decision,200,reviewKey)).version,g.version)
const delay=new Date(g.startsAt).getTime()-Date.now()+30;if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay))
assert.equal((await recipient.api.get(contractPath)).sensitiveVisible,true)
const hard=await admin.request('POST','/api/access-control/permission-preview',{subjectAccountId:recipient.id,permissionCode:'CONTRACT_SENSITIVE_READ',projectId:original.projectId,participatingProject:true,sensitiveConditionsMet:false})
assert.equal(hard.allowed,false)
g=await admin.request('POST',`/api/access-control/temporary-grants/${g.id}/revoke`,{version:g.version,reason:'验证·独立复核链验证结束，立即撤销'})
assert.equal(g.status,'REVOKED');assert.equal((await recipient.api.get(contractPath)).sensitiveVisible,false)
report('高敏感授权待复核不生效；指定独立审批、真实敏感字段变化、硬约束拒绝及即时撤销')
let expired=await grant(1000,3500)
expired=await reviewer.api.request('POST',`/api/access-control/temporary-grants/${expired.id}/review`,{decision:'APPROVED',comment:'验证·原期限到期严格失效',version:expired.version})
const remaining=new Date(expired.endsAt).getTime()-Date.now()+30;if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining))
assert.equal((await recipient.api.get(contractPath)).sensitiveVisible,false)
let rejected=await grant(1000,120000)
rejected=await reviewer.api.request('POST',`/api/access-control/temporary-grants/${rejected.id}/review`,{decision:'REJECTED',comment:'验证·拒绝例外，不产生任何访问能力',version:rejected.version})
assert.equal(rejected.status,'REJECTED');assert.equal((await recipient.api.get(contractPath)).sensitiveVisible,false)
report('服务器按原期限精确拒绝访问；复核拒绝保留意见且不生效')
await assign(admin,browserUser.id,[basic,viewerRole.id]);assert.ok((await browserUser.api.get('/api/access-control/navigation')).some(n=>n.children.some(c=>c.routeKey==='system.organization-users')))
await browserUser.api.get('/api/iam/users?page=1&pageSize=10');await browserUser.api.request('POST','/api/iam/users',{},403)
await assign(admin,browserUser.id,[basic]);await browserUser.api.request('GET','/api/iam/users?page=1&pageSize=10',undefined,403)
assert.ok((await admin.get(`/api/access-control/roles/${viewerRole.id}/impact`)).historicalAssignmentCount>=1)
await assign(admin,delegate.id,[basic])
report('真实系统角色分配/撤销即时改变导航与 HTTP 权限；只读角色不能新增用户，历史保留')
const pendingBrowser=await grant(1000,30*60000)
await mkdir(out,{recursive:true})
await writeFile(`${out}/api-checks.json`,JSON.stringify({timestamp:new Date().toISOString(),checks:evidence},null,2))
await writeFile(`${out}/fixture.json`,JSON.stringify({recipientId:recipient.id,reviewerId:reviewer.id,browserUserId:browserUser.id,browserUserName:browserUser.name,viewerRoleId:viewerRole.id,viewerRoleName:viewerRole.name,baseRoleId:basic,pendingGrantId:pendingBrowser.id,projectId:original.projectId,contractId:original.contractId,directoryId:directory.id,pageId:page.id,run},null,2))
for(const [label,api] of [['admin',admin],['recipient',recipient.api],['reviewer',reviewer.api],['browser-user',browserUser.api]])await writeFile(`.local-data/wi007-${label}-session.json`,JSON.stringify({cookies:api.cookies(),origins:[]}),{mode:0o600})
console.log(`Saved ${evidence.length} groups and synthetic authorization fixtures.`)
