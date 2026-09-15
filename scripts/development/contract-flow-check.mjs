// Opt-in local verification. All people, companies, contracts and files below are synthetic.
import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
const origin=process.env.BUSINESS_CHECK_ORIGIN??'http://127.0.0.1:8080'
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw new Error('Local application required')
const run=Date.now().toString(36), day=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'})
const evidence=[], report=name=>{evidence.push(name);console.log(`PASS ${name}`)}
const out=process.env.BUSINESS_CHECK_ARTIFACT_DIR??'outputs/verification/wi-009'
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
const sales=await user('sales','验证·合同责任商务','CONTRACT_SALES'), archivist=await user('archive','验证·综合管理归档','CONTRACT_ARCHIVIST'), member=await user('member','验证·资料协作成员','BUSINESS_USER'), outsider=await user('outside','验证·其他项目成员','BUSINESS_USER')
const customer=await admin.post('/api/crm/customers',{name:`验证·合同归档客户 ${run}`,shortName:'合同验证客户',kind:'CUSTOMER',identifier:`CONTRACT-${run}`,industry:'智能制造',region:'华东',source:'本地合成验证',ownerAccountId:sales.id,status:'ACTIVE'})
const opp=await admin.post('/api/crm/opportunities',{customerId:customer.customer.id,title:`验证·自动化升级合同项目 ${run}`,eventKey:`CONTRACT-${run}`,ownerAccountId:sales.id,source:'本地合成验证',procurementMethod:'DIRECT',estimatedAmount:1280000,targetDate:day,background:'本地合同、文件与归档验证，所有数据均为合成。'})
let project=await admin.post('/api/projects',{opportunityId:opp.opportunity.id,presalesOwnerId:sales.id})
const pid=project.project.id,root=`/api/projects/${pid}`,api=sales.api
for(const [u,role] of [[archivist,'PROJECT_REVIEWER'],[member,'PROJECT_CONTRIBUTOR']])project=await admin.post(`${root}/members`,{version:project.project.version,accountId:u.id,roleCodes:[role],active:true,reason:'加入本地归档验证项目。'})
await outsider.api.request('GET',root,undefined,404)
const initial={requestId:randomUUID(),projectId:pid,number:`CT-VERIFY-${run}`,title:'验证·自动化升级项目合同',partyA:'验证·合同客户有限公司',partyB:'验证·示例服务公司',amount:1280000,signedOn:day,effectiveOn:day,scope:'现场系统设计、数据采集、联合调试与验收；外部资金和签署操作不在本地验证范围。'}
let contract=await api.post('/api/contracts',initial),cid=contract.contract.id,path=`/api/contracts/${cid}`
assert.equal((await api.post('/api/contracts',initial)).contract.id,cid)
await api.post('/api/contracts',{...initial,requestId:randomUUID()},400)
await api.post('/api/contracts',{...initial,requestId:randomUUID(),number:`NULL-${run}`,projectId:null},400)
report('合同沿原项目登记、编号唯一、空项目校验与重复提交保护')
const restricted=await member.api.get(path);assert.equal(restricted.sensitiveVisible,false);assert.equal(restricted.contract.amount,null);assert.equal(restricted.contract.partyA,null);assert.equal(restricted.records.length,0)
await member.api.patch(path,{...initial,version:contract.contract.version},403)
await outsider.api.request('GET',path,undefined,404)
await archivist.api.patch(path,{...initial,version:contract.contract.version},403)
report('合同敏感字段隐藏；普通成员、归档人员不能越权编辑；非项目成员不可枚举')
async function upload(who,{title='验证·主合同签署件',kind='CONTRACT',classification='CONTRACT',docId,version,requestId=randomUUID(),content='本地验证用合成文件，不构成真实签署合同。\n编号：'+initial.number,filename='验证合同.txt'}={}){
 const body=new FormData();body.append('metadata',new Blob([JSON.stringify({requestId,title,kind,classification,changeNote:'合成签署资料版本，用于验证权限、校验和归档关系。',version})],{type:'application/json'}));body.append('file',new Blob([content]),filename)
 const result=await who.request('POST',docId?`/api/files/${docId}/versions`:`${root}/files`,body)
 return {result,content,requestId}
}
let uploaded=await upload(api),doc=uploaded.result,docId=doc.document.id,fileId=doc.versions[0].id
const repeated=await upload(api,{requestId:uploaded.requestId});assert.equal(repeated.result.document.id,docId)
const bytes=await api.get(`/api/files/${docId}/versions/${fileId}/download`);assert.equal(bytes.toString(),uploaded.content);assert.equal(createHash('sha256').update(bytes).digest('hex'),doc.versions[0].sha256)
assert.equal((await member.api.get(`${root}/files`)).items.length,0)
await member.api.request('GET',`/api/files/${docId}`,undefined,404)
await api.post(`${path}/files`,{version:contract.contract.version,fileVersionId:fileId,kind:'SIGNED'},409)
report('真实 S3 协议上传下载一致、SHA-256 与幂等；敏感资料隐藏，草稿不能作归档依据')
const transition=(who,detail,decision)=>who.post(`/api/files/${detail.document.id}/versions/${detail.versions[0].id}/transition`,{version:detail.versions[0].version,decision,comment:'本地合成验证：'+decision})
doc=await transition(api,doc,'IN_REVIEW');doc=await transition(archivist.api,doc,'PUBLISHED')
assert.equal(doc.document.currentVersionId,fileId)
contract=await api.post(`${path}/files`,{version:contract.contract.version,fileVersionId:fileId,kind:'SIGNED'})
for(const [title,kind,amount,conditions] of [['签约预付款','PAYMENT',384000,'签署件齐备，付款条件完成'],['设计确认款','PAYMENT',256000,'设计文件联合确认'],['到货付款','PAYMENT',256000,'到货清单核对完成'],['联调验收款','PAYMENT',256000,'联调验收记录完成'],['质保款','PAYMENT',128000,'质保期结束并确认无遗留'],['最终验收','ACCEPTANCE',null,'形成客户确认的验收文件']])contract=await api.post(`${path}/nodes`,{version:contract.contract.version,title,kind,amount,dueDate:day,conditions})
await api.post(`${path}/nodes`,{version:contract.contract.version,title:'超过合同总额',kind:'PAYMENT',amount:1,dueDate:day,conditions:'不应保存'},400)
report('独立资料发布、当前签署件关联、付款及验收节点、合同总额上限')
const internal=await upload(member.api,{title:'验证·内部资料',kind:'OTHER',classification:'INTERNAL',content:'内部资料验证'})
assert.equal(internal.result.allowedActions.includes('FILE_DOWNLOAD'),false)
await member.api.request('GET',`/api/files/${internal.result.document.id}/versions/${internal.result.versions[0].id}/download`,undefined,403)
const own=await upload(admin,{title:'验证·禁止自审',kind:'OTHER',classification:'INTERNAL'});let ownDoc=await transition(admin,own.result,'IN_REVIEW')
await admin.post(`/api/files/${ownDoc.document.id}/versions/${ownDoc.versions[0].id}/transition`,{version:ownDoc.versions[0].version,decision:'PUBLISHED',comment:'自审应拒绝'},409)
report('资料查看/上传不隐含下载；有发布权限也不能自审')
contract=await api.post(`${path}/archive-submissions`,{version:contract.contract.version,note:'签署件及约定节点已整理，请综合管理接收。'})
let review=contract.archiveReviews[0]
await api.post(`${path}/archive-reviews/${review.id}`,{version:review.version,decision:'ARCHIVED',comment:'营销没有归档接收权'},403)
const v2=await upload(api,{docId,version:doc.document.version,content:'验证合同第二版（实际内容已修订）'})
assert.equal(v2.result.document.currentVersionId,fileId)
let second=await transition(api,v2.result,'IN_REVIEW');second=await transition(archivist.api,second,'PUBLISHED')
assert.equal(second.versions.find(v=>v.id===fileId).status,'SUPERSEDED')
await archivist.api.post(`${path}/archive-reviews/${review.id}`,{version:review.version,decision:'ARCHIVED',comment:'旧版本不能归档'},409)
contract=await archivist.api.post(`${path}/archive-reviews/${review.id}`,{version:review.version,decision:'RETURNED',comment:'主合同签署件已更新，请改为当前发布版本后重新提交。'})
contract=await api.post(`${path}/files`,{version:contract.contract.version,fileVersionId:second.document.currentVersionId,kind:'SIGNED'})
assert.equal(contract.files.filter(l=>l.active&&l.kind==='SIGNED').length,1);assert.equal(contract.files.length,2)
contract=await api.post(`${path}/archive-submissions`,{version:contract.contract.version,note:'改用主合同第二版，原版本留存。'})
review=contract.archiveReviews[0]
contract=await archivist.api.post(`${path}/archive-reviews/${review.id}`,{version:review.version,decision:'ARCHIVED',comment:'核对签署资料及节点，接收归档。'})
assert.equal(contract.contract.archiveStatus,'ARCHIVED');assert.equal(contract.archiveReviews.length,2)
assert.equal((await api.get(root)).project.mainStage,'PRESALES')
await api.patch(path,{...initial,version:contract.contract.version,title:'覆盖历史主档尝试'},409)
report('修订草稿保留旧有效版；新发布使归档快照过期；退回重提接收留史且不改变主阶段')
const afterArchive=await api.get(`/api/files/${docId}/versions/${fileId}/download`);assert.equal(afterArchive.toString(),uploaded.content)
const n=contract.nodes[0];contract=await api.post(`${path}/nodes/${n.id}/complete`,{version:n.version,completedOn:day,evidence:'验证·客户节点确认记录（合成）。'})
assert.equal(contract.nodes.find(x=>x.id===n.id).status,'COMPLETED')
await api.post(`${path}/nodes/${n.id}/complete`,{version:n.version,completedOn:day,evidence:'重复覆盖不允许'},409)
report('历史文件仍可追溯，约定节点完成有独立证据并拒绝覆盖')
const extra=await upload(api,{title:'验证·补充协议',content:'合成补充协议：明确新增接口范围。'})
let extraDoc=await transition(api,extra.result,'IN_REVIEW');extraDoc=await transition(archivist.api,extraDoc,'PUBLISHED')
contract=await api.post(`${path}/records`,{version:contract.contract.version,kind:'SUPPLEMENT',title:'验证·接口范围补充协议',description:'补充现场接口范围并将合同金额调整为 138 万元，本记录用于验证。',signedOn:day,fileVersionId:extraDoc.document.currentVersionId,amountAfter:1380000})
assert.equal(contract.contract.amount,1380000);assert.equal(contract.records[0].amountBefore,1280000);assert.equal(contract.contract.archiveStatus,'DRAFT')
contract=await api.post(`${path}/archive-submissions`,{version:contract.contract.version,note:'移交补充协议，合同金额及范围已更新。'})
review=contract.archiveReviews[0];contract=await archivist.api.post(`${path}/archive-reviews/${review.id}`,{version:review.version,decision:'ARCHIVED',comment:'补充协议接收完成。'})
report('补充协议保存前后金额和原文件关系，独立重新归档')
const selfInput={...initial,requestId:randomUUID(),number:`CT-SELF-${run}`,title:'验证·自归档拦截合同'}
let self=await admin.post('/api/contracts',selfInput),selfPath=`/api/contracts/${self.contract.id}`
self=await admin.post(`${selfPath}/files`,{version:self.contract.version,fileVersionId:second.document.currentVersionId,kind:'SIGNED'})
self=await admin.post(`${selfPath}/archive-submissions`,{version:self.contract.version,note:'自归档拦截检查'})
await admin.post(`${selfPath}/archive-reviews/${self.archiveReviews[0].id}`,{version:self.archiveReviews[0].version,decision:'ARCHIVED',comment:'有权限也不可自归档'},409)
report('同一账号即使同时具有管理权限，也不能接收自己的归档')
await mkdir(out,{recursive:true});await mkdir('.local-data',{recursive:true})
const fixture={projectId:pid,contractId:cid,documentId:docId,currentFileVersionId:second.document.currentVersionId,originalFileVersionId:fileId,customerId:customer.customer.id,opportunityId:opp.opportunity.id,salesId:sales.id,archivistId:archivist.id,memberId:member.id,run}
await writeFile(`${out}/fixture.json`,JSON.stringify(fixture,null,2));await writeFile(`${out}/api-checks.json`,JSON.stringify({timestamp:new Date().toISOString(),checks:evidence,origin},null,2))
for(const [label,user] of [['sales',sales],['archivist',archivist],['member',member]])await writeFile(`.local-data/wi009-${label}-session.json`,JSON.stringify({cookies:user.api.cookies(),origins:[]}),{mode:0o600})
console.log(`Saved ${evidence.length} verified groups and non-secret fixture references.`)
