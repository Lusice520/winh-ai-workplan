import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { storedClient } from './local-business-client.mjs'

const stage=process.argv[2], folder='outputs/verification/wi-010-delivery'
assert.ok(['submitted','returned','resubmitted','approved'].includes(stage))
const fixture=JSON.parse(await readFile(folder+'/fixture.json','utf8')), f=JSON.parse(await readFile(folder+'/scope-fixture.json','utf8'))
const before=JSON.parse(await readFile(folder+'/scope-before.json','utf8')), p=fixture.projects[0], origin='http://127.0.0.1:8080'
const manager=await storedClient(origin,fixture.people.manager.stateFile), committer=await storedClient(origin,fixture.people.committer.stateFile)
const successor=await storedClient(origin,fixture.people.successor.stateFile), outside=await storedClient(origin,fixture.people.outside.stateFile)
const base='/api/delivery-initiation/'+f.projectId, api=base+'/scope-changes/'+f.scopeId
const view=await manager.get(api), current=await manager.get(base), checks=[]
const pass=message=>{checks.push(message);console.log('PASS '+message)}
for(const b of before.baselines)assert.deepEqual(await manager.get(base+'/baselines/'+b.id),b.snapshot)
assert.deepEqual(await manager.get('/api/work-items/'+p.packageIds[0]),before.completedWork)
assert.deepEqual((await manager.get('/api/requirements/'+p.requirementId)).requirement,before.requirement)
assert.deepEqual((await manager.get(base+'/responsibility-transfers')).find(t=>t.id===before.transfer.id),before.transfer)
pass('原 V1–V3 快照、已完成工作包、原需求与已生效责任交接均未改写')
await outside.get(api,404)
const restricted=await successor.get(api);assert.ok(!JSON.stringify(restricted).includes('"amount"'));assert.equal(restricted.impact,null);assert.equal(restricted.basis,null)
pass('未参与项目者不可读取提案，普通参与者无法取得预算正文或含财务信息的变更说明')
for(const e of view.draft.resources){assert.equal(e.proposed.status,'COMMITTED');assert.equal(e.proposed.committedBy,fixture.people.committer.id);assert.equal(e.proposed.commitment.dailyCapacity,8)}
pass('浏览器两项资源均由指定部门人签认：并行合计 6 小时，可用容量 8 小时')
if(stage!=='approved'){
  assert.equal(current.preparation.baselineVersion,3);await manager.get('/api/work-items/'+f.packageId,404)
  assert.ok(!current.objects.some(o=>o.id===f.stageId));assert.ok(!current.resources.some(r=>f.resourceIds.includes(r.id)))
  pass('提案提交或退回过程中，当前执行基线仍为 V3，新工作包和新投入尚未生效')
}
if(['submitted','resubmitted'].includes(stage)){
  assert.equal(view.change.status,'SUBMITTED');assert.equal(view.rounds.length,stage==='submitted'?1:2)
  const r=view.rounds[0], snapshot=await manager.get(api+'/submissions/'+r.id)
  const name=folder+'/scope-round-'+r.number+'.json'
  try{await writeFile(name,JSON.stringify(snapshot,null,2),{flag:'wx'})}catch(error){if(error.code!=='EEXIST')throw error;assert.deepEqual(JSON.parse(await readFile(name,'utf8')),snapshot)}
  const object=view.candidate.objects.find(o=>o.id===f.packageId)
  await manager.patch(api+'/objects/'+f.packageId,{version:view.change.version,objectVersion:object.version,content:object.content,reason:'验证·冻结后写入不得成功'},409)
  const e=view.draft.resources[0].proposed
  await committer.post(api+'/resources/'+e.id+'/commit',{version:view.change.version,resourceVersion:e.version,decision:'COMMITTED',commitment:e.commitment,reason:'验证·冻结后不能重签'},409)
  await manager.post(api+'/actions',{version:view.change.version,action:'APPROVE',note:'验证·项目经理无公司批准权不得自批'},403)
  assert.ok(!JSON.stringify(await successor.get(api+'/submissions/'+r.id)).includes('"amount"'))
  pass('整份提案冻结后拒绝改对象、改签认和经理自批；当轮快照保留且按权限投影')
}
if(stage==='returned'){
  assert.equal(view.change.status,'RETURNED');assert.equal(view.rounds[0].status,'RETURNED')
  assert.deepEqual(await manager.get(api+'/submissions/'+view.rounds[0].id),JSON.parse(await readFile(folder+'/scope-round-1.json','utf8')))
  pass('独立批准人从浏览器退回补齐，第一轮原内容保持不可变')
}
if(stage==='resubmitted'){
  assert.deepEqual(await manager.get(api+'/submissions/'+view.rounds[1].id),JSON.parse(await readFile(folder+'/scope-round-1.json','utf8')))
  assert.notEqual(view.rounds[0].snapshotHash,view.rounds[1].snapshotHash)
  pass('经理在原拟工作包补充验收依据后重提第二轮；第一轮不覆盖且两轮哈希不同')
}
if(stage==='approved'){
  assert.equal(view.change.status,'APPROVED');assert.equal(current.preparation.baselineVersion,4);assert.equal(view.rounds[0].baselineVersion,4)
  assert.equal(view.rounds[0].decidedBy,fixture.people.approver.id)
  assert.equal(current.checks.filter(c=>c.status==='PASS').length,9)
  for(const id of [f.stageId,f.packageId,f.milestoneId,f.itemId,f.masterId,f.planId,f.budgetId])assert.equal(current.objects.find(o=>o.id===id).baselineVersion,4)
  for(const id of f.resourceIds){const r=current.resources.find(r=>r.id===id);assert.equal(r.status,'COMMITTED');assert.equal(r.committedBy,fixture.people.committer.id)}
  const work=await successor.get('/api/work-items/'+f.packageId);assert.equal(work.creationSource,'DELIVERY');assert.equal(work.deliveryState,'BASELINED');assert.equal(work.deliveryBaselineVersion,4);assert.equal(work.ownerAccountId,fixture.people.successor.id);assert.equal(work.verifierAccountId,fixture.people.verifier.id);assert.ok(work.allowedActions.includes('COMPLETE'))
  assert.equal(current.objects.find(o=>o.id===f.budgetId).content.budget.lines.reduce((sum,l)=>sum+Number(l.amount),0),499000)
  for(const r of view.rounds)assert.deepEqual(await manager.get(api+'/submissions/'+r.id),JSON.parse(await readFile(folder+'/scope-round-'+r.number+'.json','utf8')))
  pass('独立批准后原位形成 V4：七对象、两资源、499000 元候选预算一次生效，新工作包进入实际负责人执行入口')
  await writeFile(folder+'/scope-approved-workspace.json',JSON.stringify(current,null,2))
}
let log=[];try{log=JSON.parse(await readFile(folder+'/scope-readback.json','utf8'))}catch(error){if(error.code!=='ENOENT')throw error}
log.push({stage,time:new Date().toISOString(),checks});await writeFile(folder+'/scope-readback.json',JSON.stringify(log,null,2))
