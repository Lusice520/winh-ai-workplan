// Continue only the explicit synthetic project and browser-created WI-010 scope proposal.
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { storedClient } from './local-business-client.mjs'

const folder='outputs/verification/wi-010-delivery', fixture=JSON.parse(await readFile(folder+'/fixture.json','utf8'))
const p=fixture.projects[0], origin='http://127.0.0.1:8080', base='/api/delivery-initiation/'+p.projectId
const manager=await storedClient(origin,fixture.people.manager.stateFile), verifier=await storedClient(origin,fixture.people.verifier.stateFile)
const successor=await storedClient(origin,fixture.people.successor.stateFile), outside=await storedClient(origin,fixture.people.outside.stateFile)
const proposal=(await manager.get(base+'/scope-changes')).find(d=>d.reason==='验证·增加操作培训与交付资料整理范围')
assert.ok(proposal);assert.equal(proposal.status,'DRAFT');assert.equal(proposal.baseBaselineVersion,3)
const api=base+'/scope-changes/'+proposal.id
let scope=await manager.get(api)
const before=await manager.get(base)
assert.equal(before.preparation.baselineVersion,3)
assert.ok(before.project.projectName.startsWith('验证·'))
const done=await manager.get('/api/work-items/'+p.packageIds[0]);assert.equal(done.status,'DONE')
const source=(await manager.get('/api/requirements/'+p.requirementId)).requirement
const baselineSnapshots=[]
for(const b of before.baselines)baselineSnapshots.push({id:b.id,number:b.number,snapshot:await manager.get(base+'/baselines/'+b.id)})
const preserve={baselines:baselineSnapshots,completedWork:done,requirement:source,transfer:(await manager.get(base+'/responsibility-transfers')).find(t=>t.status==='APPLIED')}
try{await writeFile(folder+'/scope-before.json',JSON.stringify(preserve,null,2),{flag:'wx'})}catch(error){if(error.code!=='EEXIST')throw error;assert.deepEqual(JSON.parse(await readFile(folder+'/scope-before.json','utf8')),preserve)}
const stage=scope.draft.objects.find(e=>e.proposed.content.stage?.title==='验证·培训与资料移交').proposed
assert.equal(stage.content.stage.startsOn,'2026-12-21');assert.equal(stage.content.stage.endsOn,'2026-12-28')
assert.ok(stage.content.stage.predecessorIds.includes(p.stageIds[2]))
const owner=fixture.people.successor.id, validator=fixture.people.verifier.id, committer=fixture.people.committer.id
const content=(kind,value)=>({stage:null,milestone:null,item:null,workPackage:null,plan:null,budget:null,[kind]:value})
async function save(kind,value,id){
  scope=await manager.get(api)
  const old=id?scope.candidate.objects.find(o=>o.id===id):scope.draft.objects.find(e=>e.proposed.content[kind]?.title===value.title)?.proposed
  const body={version:scope.change.version,objectVersion:old?.version??null,existingWorkItemId:null,content:content(kind,value),reason:'验证·补齐培训与资料范围的关联对象',impact:null,basis:null}
  scope=old?await manager.patch(api+'/objects/'+old.id,body):await manager.post(api+'/objects',body)
  return scope.draft.objects.find(e=>e.proposed.content[kind]?.title===value.title)?.proposed.id??id
}
const work={title:'验证·操作培训与资料包',scope:'编制培训讲义、组织操作培训并整理移交资料；验收沿用原项目。',deliverables:'培训讲义、签到及考核记录、资料移交清单',acceptanceCriteria:'培训记录完整，资料核对无遗漏，由指定独立验证人确认。',ownerId:owner,verifierId:validator,stageId:stage.id,startsOn:'2026-12-21',endsOn:'2026-12-28',resourceNotes:'培训与资料并行准备，指定部门统一核实人员容量。',itemIds:[],milestoneIds:[]}
const packageId=await save('workPackage',work)
const milestoneId=await save('milestone',{title:'验证·培训与资料验收',kind:'ACCEPTANCE',dueDate:'2026-12-28',ownerId:fixture.people.manager.id,stageId:stage.id,contractNodeId:null,sourceNote:'验证·补充交付范围确认记录',acceptanceCriteria:'培训和资料均由独立验证人核对。'})
const itemId=await save('item',{title:'验证·培训资料与考核记录',category:'DELIVERABLE',specification:'培训材料、操作签到及考核结果合并成册',quantity:1,unit:'套',acceptanceScope:'确认培训完成与资料完整性',stageId:stage.id,workPackageId:packageId,milestoneId,procurementNeeded:false,procurementNote:null})
await save('workPackage',{...work,itemIds:[itemId],milestoneIds:[milestoneId]},packageId)
const plan={stageId:stage.id,startsOn:'2026-12-21',endsOn:'2026-12-28',deliveryWindowStart:'2026-12-27',deliveryWindowEnd:'2026-12-28',dependsOnIds:[],resourceConstraints:'培训资料与考核准备并行，指定部门确认每日合计容量。'}
const masterId=await save('plan',{...plan,title:'验证·培训资料主计划',kind:'MASTER',workPackageId:null})
const planId=await save('plan',{...plan,title:'验证·操作培训包计划',kind:'WORK_PACKAGE',workPackageId:packageId})
const resources=[]
for(const note of ['验证·培训讲义与资料准备','验证·操作培训与考核安排']){
  scope=await manager.get(api)
  const old=scope.draft.resources.find(e=>e.proposed.request.requestNote===note)?.proposed
  if(old){resources.push(old.id);continue}
  scope=await manager.post(api+'/resources',{version:scope.change.version,resourceVersion:null,releaseRequested:false,reason:'验证·将并行安排提交部门签认',request:{workPackageId:packageId,personId:owner,committerId:committer,startsOn:'2026-12-21',endsOn:'2026-12-28',dailyHours:3,requestNote:note}})
  resources.push(scope.draft.resources.find(e=>e.proposed.request.requestNote===note).proposed.id)
}
const originalBudget=before.objects.find(o=>o.id===p.budgetId).content.budget
await save('budget',{...originalBudget,scope:'原交付范围及培训资料补充范围',lines:[...originalBudget.lines,...resources.map((id,index)=>({title:['验证·培训资料人工','验证·培训实施人工'][index],category:'PERSONNEL',amount:'9000.00',stageId:stage.id,workPackageId:packageId,resourceRequestId:id,itemId:null,basis:'验证·合成人工预算，非真实财务数据'}))]},p.budgetId)
scope=await manager.get(api)
assert.equal(scope.change.objectCount,7);assert.equal(scope.change.resourceCount,2)
assert.ok(scope.problems.length>0&&scope.problems.every(message=>message.includes('资源')||message.includes('签认')))
await outside.get(api,404)
await verifier.post(api+'/objects',{version:scope.change.version,content:content('workPackage',work),reason:'验证·无维护权限不得写入'},403)
await successor.post(api+'/actions',{version:scope.change.version,action:'SUBMIT',note:'验证·实际经理之外不得提交'},409)
await manager.post(api+'/actions',{version:scope.change.version,action:'SUBMIT',note:'验证·未签认不得提交'},409)
await manager.post(api+'/actions',{version:scope.change.version+1,action:'CANCEL',note:'验证·伪造版本不得取消'},409)
await manager.post(api+'/actions',{version:scope.change.version,action:'CANCEL',note:'验证·未知字段拒绝',bypassChecks:true},400)
await manager.get('/api/work-items/'+packageId,404)
const restricted=await successor.get(api)
assert.ok(!JSON.stringify(restricted).includes('"amount"'));assert.equal(restricted.impact,null);assert.equal(restricted.basis,null)
assert.equal((await manager.get(base)).preparation.baselineVersion,3)
assert.deepEqual(await manager.get('/api/work-items/'+p.packageIds[0]),done)
const result={projectId:p.projectId,scopeId:proposal.id,stageId:stage.id,packageId,milestoneId,itemId,masterId,planId,resourceIds:resources,budgetId:p.budgetId,
  checks:['浏览器建立范围草案与新增阶段；同一项目 V3 保持有效','七项关联对象与两项资源逐步补齐，新增工作包未提前创建','未参与者读取、无权写入、非经理提交、未签认提交、错误版本、未知字段均拒绝','预算正文与财务说明按当前权限投影，已完成工作包及旧基线保持不变']}
await writeFile(folder+'/scope-fixture.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
