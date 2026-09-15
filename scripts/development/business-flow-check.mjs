// Local, opt-in end-to-end verification. Creates only clearly marked synthetic records.
// Credentials remain in process memory / an ignored mode-0600 browser session file.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

const origin = process.env.BUSINESS_CHECK_ORIGIN ?? 'http://127.0.0.1:8080'
const artifactDir = process.env.BUSINESS_CHECK_ARTIFACT_DIR ?? 'outputs/verification/wi-008'
const sessionPrefix = new URL(origin).port === '8080' ? 'wi008' : 'wi008-isolated'
if (!['127.0.0.1','localhost'].includes(new URL(origin).hostname)) throw new Error('This check runs only against a local application.')
const run = Date.now().toString(36)
const evidence = []
const report = (name) => { evidence.push(name); console.log(`PASS ${name}`) }
const day = new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Shanghai'})
const end = new Date(Date.now()+30*86400000).toLocaleDateString('en-CA', {timeZone:'Asia/Shanghai'})
function client() {
  const cookies=new Map();let csrf
  async function request(method,path,body,expected=200) {
    if(method!=='GET')csrf=(await request('GET','/api/auth/csrf')).token
    const response=await fetch(origin+path,{method,headers:{'Content-Type':'application/json',Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),...(method==='GET'?{}:{'X-XSRF-TOKEN':csrf,'Idempotency-Key':randomUUID()})},body:body===undefined?undefined:JSON.stringify(body)})
    for(const header of response.headers.getSetCookie()){const pair=header.split(';')[0],at=pair.indexOf('=');cookies.set(pair.slice(0,at),pair.slice(at+1))}
    const data=await response.json().catch(()=>null)
    const expectedStatuses=Array.isArray(expected)?expected:[expected]
    assert.ok(expectedStatuses.includes(response.status),`${method} ${path}: HTTP ${response.status}, expected ${expectedStatuses.join('/')} — ${data?.code??'unexpected response'} ${data?.message??''} ${JSON.stringify(data?.fieldErrors??[])}`)
    if(Array.isArray(expected))return {status:response.status,data}
    return data
  }
  return {request,get:path=>request('GET',path),post:(path,body,status)=>request('POST',path,{requestId:randomUUID(),...body},status),patch:(path,body,status)=>request('PATCH',path,{requestId:randomUUID(),...body},status),login:async(name,password)=>{const s=await request('POST','/api/auth/login',{loginName:name,password});csrf=undefined;return s},browserCookies:()=>[...cookies].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/',httpOnly:name!=='XSRF-TOKEN',secure:false,sameSite:'Lax'}))}
}
const admin=client()
const me=await admin.login(process.env.APP_BOOTSTRAP_ADMIN_LOGIN??'admin',process.env.APP_BOOTSTRAP_ADMIN_PASSWORD)
assert.equal(me.mustChangePassword,false,'The local administrator must finish its normal password setup before this check.')
const adminUser=await admin.get(`/api/iam/users/${me.accountId}`)
const roles=await admin.get('/api/access-control/roles')
async function user(suffix,name,roleCode) {
  const temporaryPassword=`Aa!9-${randomUUID()}`,password=`Zz!8-${randomUUID()}`,loginName=`wi008-${suffix}-${run}`
  const u=await admin.request('POST','/api/iam/users',{loginName,displayName:name,organizationUnitId:adminUser.organizationUnit.id,temporaryPassword},201)
  if(roleCode){const set=await admin.get(`/api/access-control/accounts/${u.id}/system-role-assignments`);await admin.request('PUT',`/api/access-control/accounts/${u.id}/system-role-assignments`,{roleIds:[roles.find(r=>r.code===roleCode).id],version:set.version,reason:'WI-008 本地合成数据验证'})}
  const api=client();await api.login(loginName,temporaryPassword);await api.request('POST','/api/auth/password/change',{currentPassword:temporaryPassword,newPassword:password})
  return {id:u.id,api,loginName,password}
}
const sales=await user('sales','验证·营销负责人','BUSINESS_ADMIN')
const reviewer=await user('review','验证·独立评审人','BUSINESS_USER')
const outsider=await user('outside','验证·非项目成员','BUSINESS_USER')
const observer=await user('none','验证·未授权账号',null)
const owner=sales.id,api=sales.api
const customerInput={requestId:randomUUID(),name:`验证·星河制造 ${run}`,shortName:'星河制造（验证）',kind:'PROSPECT',identifier:`TEST-${run}`,industry:'智能制造',region:'华东',source:'本地验收用合成数据',ownerAccountId:owner,status:'ACTIVE'}
let customer=await api.post('/api/crm/customers',customerInput)
assert.equal((await api.post('/api/crm/customers',customerInput)).customer.id,customer.customer.id)
await api.post('/api/crm/customers',{...customerInput,requestId:randomUUID()},400)
report('客户唯一标识与重复提交保护')
await observer.api.get('/api/crm/customers').then(r=>assert.equal(r.total,0))
await observer.api.request('GET',`/api/crm/customers/${customer.customer.id}`,undefined,404)
report('未授权客户不可枚举或读取')
customer=await api.post(`/api/crm/customers/${customer.customer.id}/contacts`,{name:'验证·客户接口人',position:'数字化项目组',phone:'',email:'contact@example.test',status:'ACTIVE'})
const cid=customer.customer.id
const stale={...customerInput,version:0,requestId:randomUUID(),name:'旧版本覆盖尝试'}
await api.patch(`/api/crm/customers/${cid}`,stale,409)
report('旧版本更新被拒绝，联系人落库')
const concurrentInput={...customerInput,version:customer.customer.version}
const race=await Promise.all([
  api.patch(`/api/crm/customers/${cid}`,{...concurrentInput,requestId:randomUUID(),shortName:'并发验证 A'},[200,409]),
  admin.patch(`/api/crm/customers/${cid}`,{...concurrentInput,requestId:randomUUID(),shortName:'并发验证 B'},[200,409]),
])
assert.deepEqual(race.map(x=>x.status).sort(),[200,409])
report('两个真实会话并发更新仅一个成功，另一个收到版本冲突')
let opp=await api.post('/api/crm/opportunities',{customerId:cid,title:`验证·工厂数字化协同平台 ${run}`,eventKey:`DIGITAL-${run}`,ownerAccountId:owner,source:'客户需求沟通（合成）',procurementMethod:'TENDER',estimatedAmount:2860000,targetDate:end,background:'本地验证项目：覆盖生产现场调研、需求梳理、方案与报价评审。所有信息均为合成数据。'})
const oid=opp.opportunity.id
opp=await api.post(`/api/crm/opportunities/${oid}/classification`,{version:opp.opportunity.version,grade:'A',reason:'关键需求与预算窗口已在本地验证中明确。'})
assert.equal(opp.opportunity.progress,'LEAD')
opp=await api.post(`/api/crm/opportunities/${oid}/activities`,{version:opp.opportunity.version,fact:'已完成验证场景中的客户需求访谈。',nextAction:'安排联合调研，确认接口与验收边界。',assigneeId:owner,dueDate:end})
report('商机分级与销售进度独立，跟进行动持久化')
let project=await api.post('/api/projects',{opportunityId:oid,presalesOwnerId:owner})
const pid=project.project.id,projectPath=`/api/projects/${pid}`,ps=`${projectPath}/presales`
assert.equal((await api.post('/api/projects',{opportunityId:oid,presalesOwnerId:owner})).project.id,pid)
await outsider.api.request('GET',projectPath,undefined,404)
report('一商机一项目，非参与成员无法读取项目')
project=await api.post(`${projectPath}/members`,{version:project.project.version,accountId:reviewer.id,roleCodes:['PROJECT_REVIEWER'],active:true,reason:'加入独立评审与需求验证成员（合成）。'})
await reviewer.api.get(projectPath)
await reviewer.api.patch(projectPath,{version:project.project.version,name:'越权更名',focus:'SURVEY'},403)
report('项目角色即时生效，评审人不能越权编辑')
let workspace=await api.get(ps)
assert.equal(workspace.actions.length,7)
await api.post(`${ps}/investments`,{kind:'ACTUAL',hours:1,cost:0,occurredOn:day,description:'未批准投入应被拒绝'},409)
workspace=await api.post(`${ps}/initiations`,{purpose:'工厂数字化售前支撑',scope:'完成现场调研、需求清单、解决方案与报价；交付实施另行立项。',expectedOutputs:'调研纪要、需求边界清单、总体方案、工程量与报价表。',exitConditions:'合同转交付、客户取消或批准额度用尽时复核。',requestedHours:160,requestedCost:12000,startsOn:day,endsOn:end})
let sg=workspace.initiations[0]
workspace=await api.post(`${ps}/initiations/${sg.id}/submit`,{version:sg.version});sg=workspace.initiations[0]
await api.post(`${ps}/initiations/${sg.id}/review`,{version:sg.version,decision:'APPROVED',comment:'申请人自审应被拒绝',approvedHours:160,approvedCost:12000},409)
workspace=await reviewer.api.post(`${ps}/initiations/${sg.id}/review`,{version:sg.version,decision:'APPROVED',comment:'范围明确，按累计额度执行。',approvedHours:160,approvedCost:12000})
assert.equal((await api.get(projectPath)).project.status,'ACTIVE')
report('SG01 独立评审和未批准投入拦截')
workspace=await api.post(`${ps}/investments`,{kind:'COMMITTED',hours:32,cost:2400,occurredOn:day,description:'调研与接口梳理资源承诺'})
const commitment=workspace.investments[0]
workspace=await api.post(`${ps}/investments`,{kind:'ACTUAL',hours:16,cost:1200,commitmentId:commitment.id,occurredOn:day,description:'现场调研首批投入'})
assert.equal(workspace.actualHours,16);assert.equal(workspace.committedHours,16)
const reviewerSummary=await reviewer.api.get(ps)
assert.equal(reviewerSummary.investmentDetailsVisible,false)
assert.equal(reviewerSummary.investments.length,0)
assert.equal(reviewerSummary.actualCost,1200)
await reviewer.api.post(`${ps}/investments`,{kind:'ACTUAL',hours:1,cost:0,occurredOn:day,description:'评审角色不能直接登记投入'},403)
await api.post(`${ps}/investments`,{kind:'ACTUAL',hours:160,cost:0,occurredOn:day,description:'超过累计工时'},409)
await api.post(`${ps}/investments`,{kind:'REVERSAL',reversesId:commitment.id,occurredOn:day,description:'已兑付承诺不能直接冲销'},409)
report('承诺兑现不重复占额，超额与错误冲销被拒绝；明细与维护权限独立')
const titles=['生产现场调研纪要','业务需求与范围清单','数字化协同总体方案','工程量与采购估算','商务报价说明','投标文件检查表','技术交底准备记录']
for(let index=0;index<workspace.actions.length;index++){
  let a=workspace.actions[index]
  if(index<4){workspace=await api.post(`${ps}/actions/${a.id}/deliverables`,{version:a.version,title:titles[index],kind:a.actionKey,scope:'当前合成验证项目，限售前讨论与评审。',content:`${titles[index]}\n一、已确认内容\n完成业务访谈和资料核对，覆盖生产现场、系统接口、交付范围与验收边界。\n二、待确认事项\n接口字段、停机窗口与客户资源投入仍需在后续评审中核定。\n三、下一步\n由项目负责人组织联合评审，形成可追溯的结论。`,changeNote:'首次整理评审稿。',status:index===2?'IN_REVIEW':'DRAFT'});a=workspace.actions.find(x=>x.id===a.id)}
  workspace=await api.patch(`${ps}/actions/${a.id}`,{version:a.version,ownerAccountId:owner,dueDate:end,status:index<2?'COMPLETED':index<4?'IN_PROGRESS':index===4?'BLOCKED':'NOT_STARTED',note:index<2?'已形成可核对的成果版本。':index===4?'等待采购询价与价格授权依据。':'按已批准的售前计划推进。'})
}
let action=workspace.actions[2]
const quoteInput={feasibility:'技术路线具备实施可行性，接口方案待最终核定。',scope:'覆盖车间数据采集与协同管理，明确排除现场土建。',estimate:'按当前工程量清单估算，采购价格需有效报价。',priceAuthorization:'以商务审批结论为准，本地仅验证流程。',constraints:'客户需提供测试环境和访问窗口。',assumptionsRisks:'接口变更可能影响工期和费用。',finalVersion:'总体方案 V1 与估算 V1。',deliverableIds:workspace.actions.flatMap(a=>a.deliverables.map(d=>d.id))}
workspace=await api.post(`${ps}/quote-reviews`,quoteInput)
let quote=workspace.quoteReviews[0]
workspace=await api.patch(`${ps}/actions/${action.id}`,{version:action.version,ownerAccountId:owner,dueDate:end,status:'IN_PROGRESS',note:'评审提交后补充接口边界。'})
await reviewer.api.post(`${ps}/quote-reviews/${quote.id}/review`,{version:quote.version,decision:'APPROVED',comment:'旧快照不能批准'},409)
workspace=await reviewer.api.post(`${ps}/quote-reviews/${quote.id}/review`,{version:quote.version,decision:'RETURNED',comment:'请按更新后的接口边界重新提交。'})
workspace=await api.post(`${ps}/quote-reviews`,{...quoteInput,finalVersion:'按更新后的动作与成果重新确认。'})
quote=workspace.quoteReviews[0]
workspace=await reviewer.api.post(`${ps}/quote-reviews/${quote.id}/review`,{version:quote.version,decision:'APPROVED',comment:'当前范围与版本已核对，可用于对外沟通。'})
assert.equal(workspace.quoteReviews[0].current,true)
report('七类售前动作、成果版本及 SG02 过期快照拦截')
const reqInput={projectId:pid,title:'验证·客户追加追溯报表',originalText:'客户原话：希望能按生产批次追溯异常，并新增跨月对比报表。',source:'CUSTOMER',requester:'验证·客户项目组',ownerAccountId:owner,verifierAccountId:reviewer.id,priority:'HIGH',expectedOn:end,importantCustomer:true}
let req=await api.post('/api/requirements',reqInput)
const rid=req.requirement.id,rp=`/api/requirements/${rid}`
await api.post(`${rp}/route`,{version:req.requirement.version,disposition:'DIRECT',reason:'未评估不能分流'},409)
const assessment={clarification:'新增批次追溯和跨月报表，需补充验收场景。',category:'功能扩展',scopeImpact:'新增报表与查询范围。',technicalImpact:'需新增批次索引与汇总。',scheduleImpact:'预计增加验证工作。',costImpact:'追加开发工作待估算。',contractImpact:'涉及原合同范围。',acceptanceImpact:'需增加验收场景。',safetyImpact:'不涉及现场安全。',baselineImpact:true}
req=await api.post(`${rp}/assess`,{...assessment,version:req.requirement.version})
await api.post(`${rp}/route`,{version:req.requirement.version,disposition:'DIRECT',reason:'基线影响不能直接处理'},400)
req=await api.post(`${rp}/route`,{version:req.requirement.version,disposition:'CHANGE',reason:'影响范围及验收，需要正式变更审批。'})
assert.equal(req.requirement.originalText,reqInput.originalText)
const wid=req.links[0].workItemId,wp=`/api/work-items/${wid}`
await api.post(`${rp}/complete`,{version:req.requirement.version,evidence:'下游未完成不能提交'},409)
let w=await api.get(wp)
await api.post(`${wp}/transition`,{version:w.version,action:'COMPLETE',evidence:'变更未批准不能执行'},409)
w=await api.post(`${wp}/transition`,{version:w.version,action:'SUBMIT',evidence:'提交范围、成本及验收影响。'})
await api.post(`${wp}/transition`,{version:w.version,action:'APPROVE',evidence:'申请人自审应拒绝'},409)
w=await reviewer.api.post(`${wp}/transition`,{version:w.version,action:'APPROVE',evidence:'影响已确认，批准按变更范围执行。'})
w=await api.post(`${wp}/transition`,{version:w.version,action:'COMPLETE',evidence:'新增报表已完成，验证数据与验收说明已整理。'})
await api.post(`${wp}/transition`,{version:w.version,action:'VERIFY',evidence:'处理人自验证应拒绝'},409)
w=await reviewer.api.post(`${wp}/transition`,{version:w.version,action:'VERIFY',evidence:'已核对新增报表与验收场景。'})
assert.equal(w.status,'DONE');assert.equal((await api.get(rp)).requirement.status,'IN_PROGRESS')
report('需求原文不变，基线影响强制正式变更，下游完成不自动关闭原需求')
req=await api.post(`${rp}/complete`,{version:req.requirement.version,evidence:'报表变更已完成，关联工作已独立验证。'})
await api.post(`${rp}/verify`,{version:req.requirement.version,decision:'APPROVED',comment:'处理人不能关闭'},409)
await reviewer.api.post(`${rp}/verify`,{version:req.requirement.version,decision:'APPROVED',comment:'缺少重要客户确认'},400)
req=await reviewer.api.post(`${rp}/verify`,{version:req.requirement.version,decision:'APPROVED',comment:'结果符合原始诉求。',customerEvidence:'验证场景客户确认记录：报表场景符合预期。'})
assert.equal(req.requirement.status,'CLOSED')
report('独立验证、重要客户依据与原需求关闭闭环')
req=await api.post(`${rp}/reopen`,{version:req.requirement.version,reason:'验证重开仍保留历史。'})
assert.equal(req.requirement.originalText,reqInput.originalText);assert.ok(req.history.length>=6)
await api.patch(rp,{version:req.requirement.version,ownerAccountId:reviewer.id,verifierAccountId:owner,priority:'HIGH',reason:'换人后原处理人不能变成验证人'},400)
report('重开保留历史，防止通过责任交接自行验证')
for(const [index,title] of ['验证·接口字段映射需补充','验证·采购询价结果待确认','验证·客户调整上线窗口','验证·现场安全培训安排','验证·看板指标口径确认'].entries()) {
  await api.post('/api/requirements',{...reqInput,title,originalText:`本地合成需求：${title}，需澄清影响及处理安排。`,priority:['NORMAL','HIGH','URGENT','LOW','NORMAL'][index],source:['PRESALES','INTERNAL','CUSTOMER','DELIVERY','SALES'][index],importantCustomer:false})
}
project=await api.get(projectPath)
await api.post(`${projectPath}/members`,{version:project.project.version,accountId:reviewer.id,roleCodes:[],active:false,reason:'验证未完成责任移除限制'},409)
report('未完成需求的责任成员不能直接移除')
// Use a separate project for closure checks so the demonstration project stays usable.
let closedOpp=await api.post('/api/crm/opportunities',{customerId:cid,title:`验证·关闭保护 ${run}`,ownerAccountId:owner,source:'边界验收',procurementMethod:'DIRECT'})
let closedProject=await api.post('/api/projects',{opportunityId:closedOpp.opportunity.id,presalesOwnerId:owner})
closedOpp=await api.get(`/api/crm/opportunities/${closedOpp.opportunity.id}`)
closedOpp=await api.post(`/api/crm/opportunities/${closedOpp.opportunity.id}/result`,{version:closedOpp.opportunity.version,result:'FAILURE',status:'CLOSED',reasonCategory:'OTHER',reason:'验证关闭保护',evidence:'合成决策依据'})
assert.equal((await api.get(`/api/projects/${closedProject.project.id}`)).project.status,'CLOSED')
await api.patch(`/api/projects/${closedProject.project.id}`,{version:closedProject.project.version,name:'关闭后修改应失败',focus:'SURVEY'},409)
report('商机结果关闭项目并阻止后续写入')
const merged=await api.post('/api/crm/customers',{...customerInput,requestId:randomUUID(),identifier:`MERGE-${run}`,name:`验证·重复客户 ${run}`})
const preview=await api.post(`/api/crm/customers/${cid}/merge-preview`,{sourceId:merged.customer.id})
await api.post(`/api/crm/customers/${cid}/merge`,{sourceId:merged.customer.id,version:preview.target.version,sourceVersion:preview.source.version,fieldPolicy:'KEEP_TARGET',reason:'验证重复客户归并与历史保留。'})
assert.equal((await api.get(`/api/crm/customers/${merged.customer.id}`)).customer.status,'MERGED')
report('重复客户合并预览与来源档案保留')
await mkdir('.local-data',{recursive:true});await mkdir(artifactDir,{recursive:true})
await writeFile(`.local-data/${sessionPrefix}-browser-session.json`,JSON.stringify({cookies:api.browserCookies(),origins:[]}),{mode:0o600})
await writeFile(`.local-data/${sessionPrefix}-reviewer-session.json`,JSON.stringify({cookies:reviewer.api.browserCookies(),origins:[]}),{mode:0o600})
const fixture={run,projectId:pid,customerId:cid,opportunityId:oid,requirementId:rid,workItemId:wid,ownerId:owner,reviewerId:reviewer.id}
await writeFile(`${artifactDir}/fixture.json`,JSON.stringify(fixture,null,2))
await writeFile(`${artifactDir}/api-check.json`,JSON.stringify({checkedAt:new Date().toISOString(),origin,passed:evidence.length,checks:evidence,fixture},null,2))
console.log(`Completed ${evidence.length} business flow checks. Synthetic fixture: ${pid}`)
