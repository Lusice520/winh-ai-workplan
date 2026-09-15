// Local synthetic DG-01 / early-start verification. Never prints credentials or cookies.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir,writeFile } from 'node:fs/promises'
const origin=process.env.BUSINESS_CHECK_ORIGIN??'http://127.0.0.1:8080'
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw new Error('Local application required')
const run=Date.now().toString(36),day=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'})
const date=(offset)=>new Date(Date.now()+offset*86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'})
const checks=[],pass=name=>{checks.push(name);console.log('PASS '+name)}
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
const admin=client(),me=await admin.login(process.env.APP_BOOTSTRAP_ADMIN_LOGIN??'admin',process.env.APP_BOOTSTRAP_ADMIN_PASSWORD)
const org=(await admin.get(`/api/iam/users/${me.accountId}`)).organizationUnit.id,roles=await admin.get('/api/access-control/roles')
async function setRoles(id,codes){const current=await admin.get(`/api/access-control/accounts/${id}/system-role-assignments`);await admin.request('PUT',`/api/access-control/accounts/${id}/system-role-assignments`,{roleIds:codes.map(code=>roles.find(r=>r.code===code).id),version:current.version,reason:'WI-009 移交验证合成账号授权'})}
async function user(suffix,name,codes){
 const temp=`Aa!9-${randomUUID()}`,password=`Zz!8-${randomUUID()}`,loginName=`wi009hg-${suffix}-${run}`
 const u=await admin.request('POST','/api/iam/users',{loginName,displayName:name,organizationUnitId:org,temporaryPassword:temp},201)
 await setRoles(u.id,codes);const api=client();await api.login(loginName,temp);await api.request('POST','/api/auth/password/change',{currentPassword:temp,newPassword:password})
 return {id:u.id,api}
}
const ownerRoles=['BUSINESS_USER','HANDOVER_COORDINATOR','EARLY_COORDINATOR']
const owner=await user('owner','验证·移交协调',ownerRoles),receiver=await user('receiver','验证·独立移交接收',['BUSINESS_USER','HANDOVER_REVIEWER','EARLY_AUTHORIZER']),member=await user('member','验证·普通移交成员',['BUSINESS_USER']),outside=await user('outside','验证·无项目成员',['BUSINESS_USER'])
const c=await admin.post('/api/crm/customers',{name:`验证·移交客户 ${run}`,kind:'CUSTOMER',source:'本地合成验证',ownerAccountId:owner.id,status:'ACTIVE'})
async function project(suffix){const o=await admin.post('/api/crm/opportunities',{customerId:c.customer.id,title:`验证·DG01 联调项目 ${suffix} ${run}`,ownerAccountId:owner.id,source:'本地合成验证',procurementMethod:'TENDER',background:'合成移交与提前开工验证'});return admin.post('/api/projects',{opportunityId:o.opportunity.id,presalesOwnerId:owner.id})}
let p=await project('主线'),pid=p.project.id,base=`/api/projects/${pid}`,hg=base+'/handover',es=base+'/early-start'
for(const [u,role]of[[receiver,'PROJECT_REVIEWER'],[member,'PROJECT_CONTRIBUTOR']])p=await admin.post(base+'/members',{version:p.project.version,accountId:u.id,active:true,roleCodes:[role],reason:'加入合成移交验证项目'})
await outside.api.request('GET',hg,undefined,404)
await member.api.request('POST',hg,{requestId:randomUUID(),projectType:'SYSTEM_INTEGRATION',receiverId:receiver.id,dueDate:date(7)},403)
const init={requestId:randomUUID(),projectType:'SYSTEM_INTEGRATION',receiverId:receiver.id,dueDate:date(7)}
let h=await owner.api.post(hg,init);assert.equal((await owner.api.post(hg,init)).handover.id,h.handover.id)
assert.equal(h.missingCount,9);await owner.api.post(hg+'/submissions',{version:h.handover.version,note:'缺项不能通过'},409)
let i=h.items.find(i=>i.key==='EQUIPMENT');await owner.api.patch(hg+`/items/${i.id}`,{version:i.version,ownerId:owner.id,dueDate:date(7),applicable:false,note:'必需项不能跳过'},400)
pass('同项目初始化、幂等、权限范围、缺项及条件必需约束')
async function upload(title,classification,doc,projectId=pid){const body=new FormData();body.append('metadata',new Blob([JSON.stringify({requestId:randomUUID(),title,kind:classification==='COST'?'ESTIMATE':classification==='CONTRACT'?'BIDDING':'HANDOVER',classification,changeNote:'本地合成移交文件',version:doc?.document.version})],{type:'application/json'}));body.append('file',new Blob([title+'\n'+randomUUID()]),'验证移交资料.txt');return owner.api.request('POST',doc?`/api/files/${doc.document.id}/versions`:`/api/projects/${projectId}/files`,body)}
async function publish(d){d=await owner.api.post(`/api/files/${d.document.id}/versions/${d.versions[0].id}/transition`,{version:d.versions[0].version,decision:'IN_REVIEW',comment:'提交合成移交文件'});return receiver.api.post(`/api/files/${d.document.id}/versions/${d.versions[0].id}/transition`,{version:d.versions[0].version,decision:'PUBLISHED',comment:'独立核对并发布合成资料'})}
let general=await upload('验证·完整交付方案与验收计划','INTERNAL'),cost=await upload('验证·移交投入估算','COST'),award=await upload('验证·中标通知与委托依据','CONTRACT')
i=h.items.find(i=>i.key==='SCOPE');await owner.api.patch(hg+`/items/${i.id}`,{version:i.version,ownerId:owner.id,dueDate:date(7),applicable:true,referenceKind:'FILE',referenceId:general.versions[0].id},409)
general=await publish(general);cost=await publish(cost);award=await publish(award)
h=await owner.api.post(hg+'/basis',{version:h.handover.version,kind:'AWARD',referenceId:award.document.currentVersionId,note:'独立中标通知作为商务依据，不伪造合同'})
for(const item of h.items.filter(i=>!['BASE','COMMERCIAL'].includes(i.key)))h=await owner.api.patch(hg+`/items/${item.id}`,{version:item.version,ownerId:owner.id,dueDate:date(7),applicable:true,referenceKind:'FILE',referenceId:item.key==='INVESTMENT'?cost.document.currentVersionId:general.document.currentVersionId,note:'核对本项交付内容和适用性'})
assert.equal(h.missingCount,0)
const restricted=await member.api.get(hg);assert.equal(restricted.items.find(i=>i.key==='INVESTMENT').referenceId,null);assert.equal(restricted.items.find(i=>i.key==='COMMERCIAL').referenceTitle,null)
const other=await project('跨项目'),foreign=await upload('验证·其他项目资料','INTERNAL',null,other.project.id)
i=h.items.find(i=>i.key==='SCOPE');await owner.api.patch(hg+`/items/${i.id}`,{version:i.version,ownerId:owner.id,dueDate:date(7),applicable:true,referenceKind:'FILE',referenceId:foreign.versions[0].id},400)
pass('真实已发布文件关联、合同与成本密级隐藏、跨项目引用拒绝')
h=await owner.api.post(hg+'/submissions',{version:h.handover.version,note:'交付范围与验收目标已核对，请独立接收'})
await setRoles(owner.id,[...ownerRoles,'HANDOVER_REVIEWER','EARLY_AUTHORIZER'])
let review=h.reviews[0]
await owner.api.post(hg+`/reviews/${review.id}`,{version:review.version,decision:'APPROVED',comment:'同人自审应拒绝'},409)
let newer=await upload('验证·完整交付方案与验收计划修订','INTERNAL',general);newer=await publish(newer)
await receiver.api.post(hg+`/reviews/${review.id}`,{version:review.version,decision:'APPROVED',comment:'旧成果快照应拒绝'},409)
h=await receiver.api.post(hg+`/reviews/${review.id}`,{version:review.version,decision:'RETURNED',comment:'成果已更新，请关联当前版本后重提'})
for(const item of h.items.filter(i=>i.referenceId===general.document.currentVersionId))h=await owner.api.patch(hg+`/items/${item.id}`,{version:item.version,ownerId:owner.id,dueDate:date(7),applicable:true,referenceKind:'FILE',referenceId:newer.document.currentVersionId,note:'采用发布后的最新成果'})
async function approveHandover(){h=await owner.api.post(hg+'/submissions',{version:h.handover.version,note:'清单已核对，请接收本轮成果'});const r=h.reviews[0];h=await receiver.api.post(hg+`/reviews/${r.id}`,{version:r.version,decision:'APPROVED',comment:'核验适用性、范围与交付可接收性，通过 DG-01'});return h}
h=await approveHandover();const firstPackage=h.packages[0],first=await owner.api.get(hg+`/packages/${firstPackage.id}`)
assert.equal(firstPackage.current,true);assert.equal((await owner.api.get(base)).project.mainStage,'PRESALES')
h=await owner.api.post(hg+'/reopen',{version:h.handover.version,reason:'补充移交说明，旧包保留'})
i=h.items.find(i=>i.key==='SCOPE');h=await owner.api.patch(hg+`/items/${i.id}`,{version:i.version,ownerId:owner.id,dueDate:date(7),applicable:true,referenceKind:'FILE',referenceId:newer.document.currentVersionId,note:'新轮次明确维护边界'})
h=await approveHandover();const old=await owner.api.get(hg+`/packages/${firstPackage.id}`)
assert.equal(old.handoverPackage.snapshotHash,first.handoverPackage.snapshotHash);assert.equal(old.items.find(i=>i.key==='SCOPE').note,first.items.find(i=>i.key==='SCOPE').note);assert.equal(old.handoverPackage.current,false)
pass('独立接收、换版阻断、退回重提、不可变移交包与阶段隔离')
const request={title:'验证·有限范围提前开工',scope:'仅现场勘查与安全隔离，不包含批量采购及正式交付',scopeItems:['现场勘查','安全隔离'],requestedHours:100,requestedCost:10000,startsOn:day,endsOn:date(5),riskOwnerId:member.id,stopConditions:'到期、预算超限或客户停止指令时停止新增承诺',missingItems:'正式签署合同与完整设备清单待补齐',regularizationPlan:'补齐正常商务依据，完成 DG-01 后另行准备 DG-02'}
let e=await owner.api.post(es,request),a=e.applications[0],eid=a.id,ep=es+'/'+eid
const submission={requestId:randomUUID(),version:a.version}
e=await owner.api.post(ep+'/submissions',submission);assert.equal((await owner.api.post(ep+'/submissions',submission)).reviews.length,1)
let er=e.reviews.find(r=>r.applicationId===eid)
await owner.api.post(ep+`/reviews/${er.id}`,{version:er.version,decision:'APPROVED',comment:'禁止自审'},409)
await setRoles(owner.id,ownerRoles)
await receiver.api.post(ep+`/reviews/${er.id}`,{version:er.version,decision:'APPROVED',approvedHours:1000,approvedCost:9000,comment:'超申请批准应拒绝'},400)
e=await receiver.api.post(ep+`/reviews/${er.id}`,{version:er.version,decision:'APPROVED',approvedHours:90,approvedCost:9000,comment:'仅批准限定范围与期限'});a=e.applications.find(x=>x.id===eid)
assert.equal(a.effectiveStatus,'ACTIVE');assert.equal((await owner.api.get(base)).project.mainStage,'PRESALES')
await admin.post(base+'/members',{version:(await admin.get(base)).project.version,accountId:member.id,active:false,roleCodes:[],reason:'仍有风险责任，应拒绝'},409)
let overlapping=await owner.api.post(es,{...request,title:'验证·重叠申请'}),overlap=overlapping.applications[0];overlapping=await owner.api.post(es+`/${overlap.id}/submissions`,{version:overlap.version});let overlapReview=overlapping.reviews.find(r=>r.applicationId===overlap.id)
await receiver.api.post(es+`/${overlap.id}/reviews/${overlapReview.id}`,{version:overlapReview.version,decision:'APPROVED',comment:'禁止叠加批准绕过上限'},409)
h=await owner.api.post(hg+'/reopen',{version:h.handover.version,reason:'验证提前开工作为独立商务依据'})
h=await owner.api.post(hg+'/basis',{version:h.handover.version,kind:'EARLY_START',referenceId:eid,note:'有限批准依据，不代表正常商务条件已齐备'});h=await approveHandover()
await owner.api.post(hg+`/early-start/${eid}/regularize`,{version:a.version,reason:'不能用自身授权证明转正'},409)
h=await owner.api.post(hg+'/reopen',{version:h.handover.version,reason:'补齐正常商务依据'})
h=await owner.api.post(hg+'/basis',{version:h.handover.version,kind:'AWARD',referenceId:award.document.currentVersionId,note:'正常中标通知依据已齐备'});h=await approveHandover()
pass('提前开工独立审批、不可叠加、自审与责任移出拒绝、不能自证转正')
const commitment={kind:'COMMITTED',commitmentType:'LABOR',scopeItem:'现场勘查',ownerId:member.id,occurredOn:day,hours:50,cost:6000,evidence:'合成现场勘查承诺与依据'}
const outcomes=await Promise.allSettled([owner.api.post(ep+'/ledger',commitment),owner.api.post(ep+'/ledger',commitment)])
assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.ok(outcomes.some(r=>r.status==='rejected'&&r.reason.message.includes('409')))
e=await owner.api.get(es);let entry=e.ledger.find(l=>l.kind==='COMMITTED'),t=e.applications.find(x=>x.id===eid).totals;assert.equal(t.usedCost,6000)
const actual={requestId:randomUUID(),...commitment,kind:'ACTUAL',hours:10,cost:1500,commitmentId:entry.id,evidence:'合成第一笔实际投入，部分核销'}
e=await owner.api.post(ep+'/ledger',actual);const count=e.ledger.length;e=await owner.api.post(ep+'/ledger',actual);assert.equal(e.ledger.length,count);assert.equal(e.applications.find(x=>x.id===eid).totals.usedCost,6000)
await owner.api.post(ep+'/ledger',{...actual,requestId:randomUUID(),cost:5000,hours:0},400)
await owner.api.post(ep+'/ledger',{kind:'REVERSAL',reversesId:entry.id,evidence:'有实际核销不可先冲正承诺'},409)
const actualEntry=e.ledger.find(l=>l.kind==='ACTUAL');e=await owner.api.post(ep+'/ledger',{kind:'REVERSAL',reversesId:actualEntry.id,evidence:'核对后冲正合成实际记录'})
assert.equal(e.applications.find(x=>x.id===eid).totals.outstandingCost,6000)
e=await owner.api.post(ep+'/ledger',{kind:'REVERSAL',reversesId:entry.id,evidence:'原承诺未发生，正式冲正'})
assert.equal(e.applications.find(x=>x.id===eid).totals.usedCost,0)
await owner.api.post(ep+'/ledger',{...commitment,scopeItem:'未批准批量采购'},400)
await member.api.post(ep+'/ledger',commitment,403);assert.equal((await member.api.get(es)).ledger.length,0)
pass('并发承诺不穿透限额、幂等部分核销、冲正顺序、超范围与明细权限')
const unplanned={...commitment,kind:'ACTUAL',hours:0,cost:10000,evidence:'合成核查出的已发生实际费用'}
await owner.api.post(ep+'/ledger',unplanned,400)
e=await owner.api.post(ep+'/ledger',{...unplanned,overrunReason:'追加安全隔离费用已发生，提交管理处理并冻结新增承诺'})
assert.equal(e.applications.find(x=>x.id===eid).effectiveStatus,'OVER_LIMIT')
await owner.api.post(ep+'/ledger',{...commitment,hours:1,cost:0},409)
a=e.applications.find(x=>x.id===eid)
e=await receiver.api.post(ep+'/closure-allowances',{version:a.version,scopeItem:'安全隔离',hours:5,cost:500,startsOn:day,endsOn:date(1),reason:'仅完成现场安全隔离与撤场，独立限额收尾'})
const allowance=e.allowances[0],closure={...commitment,scopeItem:'安全隔离',hours:1,cost:400,allowanceId:allowance.id,evidence:'经授权的安全收尾承诺'}
await owner.api.post(ep+'/ledger',{...closure,cost:600},409)
e=await owner.api.post(ep+'/ledger',closure);a=e.applications.find(x=>x.id===eid)
e=await receiver.api.post(ep+'/close',{version:a.version,reason:'停止普通新增承诺，保留经授权安全收尾与历史核销'})
await owner.api.post(ep+'/ledger',{...commitment,hours:0,cost:1},409)
e=await owner.api.post(ep+'/ledger',{...closure,hours:0,cost:50})
a=e.applications.find(x=>x.id===eid);await owner.api.post(hg+`/early-start/${eid}/regularize`,{version:a.version,reason:'正常商务依据与 DG-01 已齐备，转正并保留全部临时记录'})
e=await owner.api.get(es);assert.equal(e.applications.find(x=>x.id===eid).status,'REGULARIZED');await owner.api.post(ep+'/ledger',{...closure,hours:0,cost:1},409)
assert.equal((await owner.api.get(base)).project.mainStage,'PRESALES')
pass('超额实际需说明且冻结普通承诺、安全收尾独立限额、停止与受控转正')
let future=await owner.api.post(es,{...request,title:'验证·未来生效申请',startsOn:date(1),endsOn:date(2)}),f=future.applications[0]
future=await owner.api.post(es+`/${f.id}/submissions`,{version:f.version});er=future.reviews.find(r=>r.applicationId===f.id)
future=await receiver.api.post(es+`/${f.id}/reviews/${er.id}`,{version:er.version,decision:'APPROVED',comment:'未来生效，不得提前记入新承诺'})
assert.equal(future.applications.find(x=>x.id===f.id).effectiveStatus,'NOT_YET_ACTIVE')
await owner.api.post(es+`/${f.id}/ledger`,commitment,400)
pass('未到批准开始日不能新增承诺，期限边界另由纯规则测试覆盖')
await mkdir('outputs/verification/wi-009-handover',{recursive:true});await mkdir('.local-data',{recursive:true})
const fixture={projectId:pid,ownerId:owner.id,receiverId:receiver.id,memberId:member.id,applicationId:eid,activeApplicationId:f.id,handoverId:h.handover.id,packageId:h.packages[0].id,generalDocumentId:newer.document.id,generalVersionId:newer.document.currentVersionId,awardVersionId:award.document.currentVersionId,costVersionId:cost.document.currentVersionId,run}
await writeFile('outputs/verification/wi-009-handover/fixture.json',JSON.stringify(fixture,null,2));await writeFile('outputs/verification/wi-009-handover/api-checks.json',JSON.stringify({timestamp:new Date().toISOString(),checks},null,2))
for(const [label,u]of[['owner',owner],['receiver',receiver],['member',member]])await writeFile(`.local-data/wi009-hg-${label}-session.json`,JSON.stringify({cookies:u.api.cookies(),origins:[]}),{mode:0o600})
console.log(`Saved ${checks.length} groups; all fixtures are synthetic.`)
