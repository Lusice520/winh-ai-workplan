// Opt-in local verification. All people, companies, contracts and files below are synthetic.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
const origin=process.env.BUSINESS_CHECK_ORIGIN??'http://127.0.0.1:8080'
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw new Error('Local application required')
const run=Date.now().toString(36), day=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'})
const evidence=[], report=name=>{evidence.push(name);console.log(`PASS ${name}`)}
const out=process.env.BUSINESS_CHECK_ARTIFACT_DIR??'outputs/verification/wi-009-nodes'
function client(){
 const cookies=new Map()
 async function request(method,path,body,expected=200){
  const csrf=method==='GET'?null:(await request('GET','/api/auth/csrf')).token
  const binary=body instanceof FormData
  const response=await fetch(origin+path,{method,headers:{...(!binary?{'Content-Type':'application/json'}:{}),Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),...(csrf?{'X-XSRF-TOKEN':csrf,'Idempotency-Key':randomUUID()}:{})},body:body===undefined?undefined:binary?body:JSON.stringify(body)})
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
 const temp=`Aa!9-${randomUUID()}`,password=`Zz!8-${randomUUID()}`,loginName=`wi009-${suffix}-${run}`
 const u=await admin.request('POST','/api/iam/users',{loginName,displayName:name,organizationUnitId:ownerOrg,temporaryPassword:temp},201)
 const set=await admin.get(`/api/access-control/accounts/${u.id}/system-role-assignments`)
 await admin.request('PUT',`/api/access-control/accounts/${u.id}/system-role-assignments`,{roleIds:[roles.find(r=>r.code===role).id],version:set.version,reason:'WI-009 合同与文件本地验证（合成）。'})
 const api=client();await api.login(loginName,temp);await api.request('POST','/api/auth/password/change',{currentPassword:temp,newPassword:password})
 return {id:u.id,api,loginName}
}
const sales=await user('node-sales','验证·节点商务','CONTRACT_SALES'), archivist=await user('node-archive','验证·节点归档','CONTRACT_ARCHIVIST'), member=await user('node-member','验证·节点普通成员','BUSINESS_USER')
const customer=await admin.post('/api/crm/customers',{name:`验证·节点更正客户 ${run}`,shortName:'节点验证',kind:'CUSTOMER',identifier:`NODE-${run}`,industry:'智能制造',region:'华东',source:'本地合成验证',ownerAccountId:sales.id,status:'ACTIVE'})
const opp=await admin.post('/api/crm/opportunities',{customerId:customer.customer.id,title:`验证·节点更正项目 ${run}`,eventKey:`NODE-${run}`,ownerAccountId:sales.id,source:'本地合成验证',procurementMethod:'DIRECT',estimatedAmount:10000,targetDate:day,background:'合同节点更正与历史验证，合成数据。'})
let project=await admin.post('/api/projects',{opportunityId:opp.opportunity.id,presalesOwnerId:sales.id})
const pid=project.project.id, api=sales.api
for(const [u,role] of [[archivist,'PROJECT_REVIEWER'],[member,'PROJECT_CONTRIBUTOR']]) project=await admin.post(`/api/projects/${pid}/members`,{version:project.project.version,accountId:u.id,roleCodes:[role],active:true,reason:'加入本地节点更正验证。'})
const master={projectId:pid,number:`CT-NODE-${run}`,title:'验证·节点更正与留痕合同',partyA:'验证·节点客户有限公司',partyB:'验证·服务单位',amount:10000,signedOn:day,effectiveOn:day,scope:'仅用于节点登记、纠正、误报撤销和归档重验。'}
let d=await api.post('/api/contracts',master)
const cid=d.contract.id,path=`/api/contracts/${cid}`
for(const [title,amount] of [['设计确认款',4000],['验收结算款',6000]]) d=await api.post(`${path}/nodes`,{version:d.contract.version,title,kind:'PAYMENT',dueDate:day,amount,conditions:'需客户书面确认。'})
const nid=d.nodes[0].id, nid2=d.nodes[1].id
const node=()=>d.nodes.find(n=>n.id===nid), revisions=()=>d.nodeHistory.filter(r=>r.nodeId===nid)
const input=(extra={})=>({version:node().version,contractVersion:d.contract.version,kind:'TERMS',reason:'验证·修正录入的验收条件',title:node().title,dueDate:node().dueDate,amount:node().amount,conditions:node().conditions,...extra})
const correct=(data,status=200)=>api.post(`${path}/nodes/${nid}/corrections`,data,status)
assert.equal(revisions().length,1);assert.equal(revisions()[0].kind,'CREATED')
const count=d.nodeHistory.length
await correct(input({conditions:'补充客户签字条件',reason:''}),400)
await correct(input({amount:5000}),400)
d=await api.get(path);assert.equal(d.nodeHistory.length,count);assert.equal(node().amount,4000)
const request={requestId:randomUUID(),...input({conditions:'设计成果由客户签字确认。'})}
d=await correct(request);assert.equal(revisions().length,2)
const change=revisions()[0];assert.equal(change.before.conditions,'需客户书面确认。');assert.equal(change.after.conditions,'设计成果由客户签字确认。')
d=await correct(request);assert.equal(revisions().length,2)
await correct({...request,reason:'同键不同请求'},409)
await correct({...request,requestId:randomUUID()},409)
report('约定更正须原因；超额事务回滚；前后事实、旧版本与幂等保护')
const limited=await member.api.get(path);assert.equal(limited.nodeHistory.length,0);assert.equal(limited.nodes.length,0)
await member.api.post(`${path}/nodes/${nid}/corrections`,input(),403)
await archivist.api.post(`${path}/nodes/${nid}/corrections`,input(),403)
const another=await api.post('/api/contracts',{...master,number:`CT-NODE-OTHER-${run}`})
await api.post(`/api/contracts/${another.contract.id}/nodes/${nid}/corrections`,input({contractVersion:another.contract.version}),404)
report('节点历史随合同敏感权限隐藏；只读归档角色和跨合同引用拒绝')
d=await api.post(`${path}/nodes/${nid}/complete`,{version:node().version,completedOn:day,evidence:'验证·初次完成记录'})
d=await correct(input({kind:'COMPLETION',completedOn:day,evidence:'验证·更正后的客户确认记录',reason:'原完成证据编号录入错误'}))
assert.equal(revisions()[0].before.evidence,'验证·初次完成记录');assert.equal(node().evidence,'验证·更正后的客户确认记录')
d=await correct(input({kind:'REOPEN',reason:'验证·客户确认尚未完成，原完成为误报'}))
assert.equal(node().status,'PLANNED');assert.equal(node().evidence,null)
assert.equal(revisions()[0].before.evidence,'验证·更正后的客户确认记录')
await correct(input({kind:'REOPEN',reason:'不能重复撤销'}),409)
d=await api.post(`${path}/nodes/${nid}/complete`,{version:node().version,completedOn:day,evidence:'验证·复核后最终完成记录'})
report('完成日期与证据纠正、误报撤销和重新登记均保留完整历史')
const bytes='验证·节点更正合同签署依据；合成文本不构成实际合同。'
const form=new FormData()
form.append('metadata',new Blob([JSON.stringify({requestId:randomUUID(),title:'验证·节点变更签署文件',kind:'CONTRACT',classification:'CONTRACT',changeNote:'合成签署文件，用于节点更正验证'})],{type:'application/json'}))
form.append('file',new Blob([bytes]),'验证节点签署.txt')
let f=await api.request('POST',`/api/projects/${pid}/files`,form)
const docId=f.document.id,fileId=f.versions[0].id,transition=`/api/files/${docId}/versions/${fileId}/transition`
f=await api.post(transition,{version:f.versions[0].version,decision:'IN_REVIEW',comment:'申请发布节点签署验证文件'})
f=await archivist.api.post(transition,{version:f.versions[0].version,decision:'PUBLISHED',comment:'独立核对合成签署文件'})
d=await api.post(`${path}/files`,{version:d.contract.version,fileVersionId:fileId,kind:'SIGNED'})
async function submit(){d=await api.post(`${path}/archive-submissions`,{version:d.contract.version,note:'验证·签署件与节点事实归档'})}
async function approve(){const r=d.archiveReviews[0];d=await archivist.api.post(`${path}/archive-reviews/${r.id}`,{version:r.version,decision:'ARCHIVED',comment:'验证·独立接收节点及其变更依据'})}
await submit()
await correct(input({conditions:'归档中改写应拒绝'}),409)
await api.post(`${path}/nodes/${nid2}/complete`,{version:d.nodes.find(n=>n.id===nid2).version,completedOn:day,evidence:'归档中完成应拒绝'},409)
await approve()
const archivedVersion=d.contract.version
d=await correct(input({kind:'COMPLETION',completedOn:day,evidence:'验证·归档后完成证据补正',reason:'归档后纠正客户确认编号'}))
assert.equal(d.contract.archiveStatus,'ARCHIVED');assert.equal(d.contract.version,archivedVersion)
await correct(input({conditions:'归档后缺少签署依据'}),400)
report('归档接收中冻结节点；完成事实纠正保留归档商务状态；已归档约定须签署依据')
d=await api.post(`${path}/records`,{version:d.contract.version,kind:'AMENDMENT',title:'验证·验收条件变更协议',description:'在书面确认基础上补充联合验收条件。',signedOn:day,fileVersionId:fileId})
const recordId=d.records[0].id
d=await correct(input({recordId,conditions:'设计成果经客户签字，并形成联合验收记录。'}))
assert.equal(d.contract.archiveStatus,'DRAFT');assert.equal(revisions()[0].after.recordId,recordId)
await submit();await approve()
assert.equal(d.archiveReviews.length,2)
assert.equal((await api.get(`/api/projects/${pid}`)).project.mainStage,'PRESALES')
report('签署变更关联、重新独立归档与原节点历史共存，不切换项目主阶段')
await mkdir(out,{recursive:true})
await writeFile(`${out}/api-checks.json`,JSON.stringify({timestamp:new Date().toISOString(),checks:evidence,origin},null,2))
await writeFile(`${out}/fixture.json`,JSON.stringify({projectId:pid,contractId:cid,nodeId:nid,documentId:docId,fileVersionId:fileId,recordId,salesId:sales.id,archivistId:archivist.id,memberId:member.id,run},null,2))
for(const [label,u] of [['sales',sales],['archivist',archivist],['member',member]])await writeFile(`.local-data/wi009-node-${label}-session.json`,JSON.stringify({cookies:u.api.cookies(),origins:[]}),{mode:0o600})
console.log(`Saved ${evidence.length} node correction groups and synthetic fixture references.`)
