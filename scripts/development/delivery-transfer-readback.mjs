import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { storedClient } from './local-business-client.mjs'

const stage=process.argv[2], folder='outputs/verification/wi-010-delivery'
assert.ok(['proposed','accepted','signed','applied','completed','verified'].includes(stage))
const fixture=JSON.parse(await readFile(folder+'/fixture.json','utf8')), p=fixture.projects[0], origin='http://127.0.0.1:8080'
const manager=await storedClient(origin,fixture.people.manager.stateFile), worker=await storedClient(origin,fixture.people.worker.stateFile)
const successor=await storedClient(origin,fixture.people.successor.stateFile), verifier=await storedClient(origin,fixture.people.verifier.stateFile)
const outside=await storedClient(origin,fixture.people.outside.stateFile), base='/api/delivery-initiation/'+p.projectId
const data=await manager.get(base), list=await manager.get(base+'/responsibility-transfers')
const t=list.find(t=>t.fromId===fixture.people.worker.id&&t.toId===fixture.people.successor.id)
assert.ok(t);const api=base+'/responsibility-transfers/'+t.id, checks=[]
const pass=name=>{checks.push(name);console.log('PASS '+name)}
assert.equal(data.preparation.baselineVersion,3)
assert.deepEqual(await manager.get(base+'/baselines/'+data.baselines.find(b=>b.number===3).id),JSON.parse(await readFile(folder+'/baseline-3-before-transfer.json','utf8')))
await outside.get(base+'/responsibility-transfers',404)
if(['proposed','accepted','signed'].includes(stage)){
  assert.equal(data.preparation.header.technicalLeadId,fixture.people.worker.id)
  for(const id of p.packageIds){const w=await manager.get('/api/work-items/'+id);assert.equal(w.ownerAccountId,fixture.people.worker.id);assert.equal(w.status,'OPEN')}
  assert.equal((await manager.get('/api/requirements/'+p.requirementId)).requirement.ownerAccountId,fixture.people.worker.id)
  for(const r of data.resources)assert.equal(r.request.personId,fixture.people.worker.id)
  pass('接收与重签过程中，当前责任、原工作包和原需求均未提前切换，原 V3 快照不变')
}
if(stage==='proposed'){
  assert.equal(t.status,'PENDING');assert.equal(t.signatures.length,0)
  assert.equal(t.permissions.find(r=>r.accountId===fixture.people.worker.id).roleCodes.length,0)
  await manager.post(api+'/decision',{version:t.version,action:'ACCEPT',note:'验证·经理不能冒名接收'},409)
  await manager.post(api+'/decision',{version:t.version,action:'APPLY',note:'验证·接收前不能生效'},409)
  await successor.post(api+'/decision',{version:t.version+1,action:'ACCEPT',note:'验证·旧版本或伪造版本拒绝'},409)
  pass('交接由真实浏览器发起；拒绝冒名接收、提前生效和错误版本')
}
if(stage==='accepted'){
  assert.equal(t.status,'ACCEPTED');assert.equal(t.acceptedBy,fixture.people.successor.id)
  await manager.post(api+'/decision',{version:t.version,action:'APPLY',note:'验证·资源未重签不能生效'},409)
  await successor.post(api+'/resources/sign',{version:t.version,resourceId:p.resourceIds[0],decision:'COMMITTED',commitment:{dailyCapacity:8,conclusion:'验证·无部门授权不得签认'}},403)
  pass('新责任人通过浏览器确认接收；资源未重签时仍拒绝生效，接任角色不自动具备部门承诺权')
}
if(stage==='signed'){
  assert.equal(t.status,'ACCEPTED');assert.equal(t.signatures.length,3)
  for(const r of t.signatures){assert.equal(r.status,'COMMITTED');assert.equal(r.signedBy,fixture.people.committer.id)}
  pass('指定部门承诺人经浏览器逐项查看重叠并完成三项资源签认')
}
if(['applied','completed','verified'].includes(stage)){
  assert.equal(t.status,'APPLIED');assert.ok(t.effectiveAt);assert.equal(t.decidedBy,fixture.people.manager.id)
  assert.equal(data.preparation.header.technicalLeadId,fixture.people.successor.id)
  for(const id of p.stageIds)assert.equal(data.objects.find(o=>o.id===id).content.stage.ownerId,fixture.people.successor.id)
  for(const id of p.packageIds){const w=await successor.get('/api/work-items/'+id);assert.equal(w.ownerAccountId,fixture.people.successor.id);assert.equal(w.deliveryState,'BASELINED');assert.equal(w.deliveryBaselineVersion,1)}
  for(const r of data.resources){assert.equal(r.request.personId,fixture.people.successor.id);assert.equal(r.committedBy,fixture.people.committer.id)}
  const req=(await successor.get('/api/requirements/'+p.requirementId)).requirement
  assert.equal(req.ownerAccountId,fixture.people.successor.id);assert.equal(req.status,'IN_PROGRESS');assert.ok(req.originalText.startsWith('验证·客户原话'))
  const project=await manager.get('/api/projects/'+p.projectId)
  assert.equal(project.members.find(m=>m.accountId===fixture.people.worker.id).active,false)
  assert.equal(project.members.find(m=>m.accountId===fixture.people.successor.id).active,true)
  await worker.get('/api/projects/'+p.projectId,404);await worker.get('/api/work-items/'+p.packageIds[0],404)
  const snapshotText=JSON.stringify(await successor.get(base+'/baselines/'+data.baselines.find(b=>b.number===3).id))
  assert.ok(!snapshotText.includes('"amount"'));assert.ok(!snapshotText.includes('minimumBudget'))
  pass('责任、三个工作包、原需求、三资源与成员角色统一生效；旧成员权限即时收回，V3 仍不可变且预算继续按权限隔离')
}
if(stage==='applied'){
  const w=await successor.get('/api/work-items/'+p.packageIds[0]);assert.equal(w.status,'OPEN');assert.ok(w.allowedActions.includes('COMPLETE'))
  assert.ok(!w.allowedActions.includes('VERIFY'));assert.equal(w.sourceRequirementId,p.requirementId)
  pass('新负责人获得原包完成入口，原编号与源需求链接连续；交接不自动完成工作')
}
if(stage==='completed'){
  const w=await successor.get('/api/work-items/'+p.packageIds[0]);assert.equal(w.status,'PENDING_VERIFICATION')
  assert.ok(w.evidence.includes('验证·接任后完成接口范围复核'));assert.ok(!w.allowedActions.includes('VERIFY'))
  assert.ok((await verifier.get('/api/work-items/'+w.id)).allowedActions.includes('VERIFY'))
  await successor.post('/api/work-items/'+w.id+'/transition',{version:w.version,action:'VERIFY',evidence:'验证·负责人不能自行验证'},409)
  pass('接任负责人经浏览器提交原包完成证据，进入指定他人验证；拒绝自验')
}
if(stage==='verified'){
  const w=await verifier.get('/api/work-items/'+p.packageIds[0]);assert.equal(w.status,'DONE');assert.equal(w.verifiedByName,fixture.people.verifier.name)
  assert.ok(data.checks.every(c=>c.status==='PASS'))
  pass('指定验证人经浏览器完成原包独立验证；原需求仍处理，批准检查不会因正常执行完成误报失效')
}
let report=[];try{report=JSON.parse(await readFile(folder+'/transfer-readback.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
report.push({at:new Date().toISOString(),stage,projectId:p.projectId,transferId:t.id,transferVersion:t.version,checks})
await writeFile(folder+'/transfer-readback.json',JSON.stringify(report,null,2))
