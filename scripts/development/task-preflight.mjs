// Run once against the untouched task fixture; never reset an advanced project to rerun.
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { folder, original, projectId, parentId, base, manager, owner, client, workspace, plan, once } from './task-fixture-client.mjs'

const initial = await workspace()
assert.equal(initial.tasks.length,0,'Task preflight must start with no task profiles; do not erase advanced state.')
assert.equal(initial.stage.status,'IN_PROGRESS');assert.equal(initial.packageStatus,'OPEN')
await writeFile(folder+'/before.json',JSON.stringify({workspace:initial,execution:await manager.get(original.base),baseline:await manager.get('/api/delivery-initiation/'+projectId),completedWork:await owner.get('/api/work-items/'+original.designWork),parent:await owner.get('/api/work-items/'+parentId)},null,2),{flag:'wx'})
for(const key of ['outside','worker']) await (await client(key)).get(`${base}/work-packages/${parentId}/tasks`,404)
await manager.post(`${base}/work-packages/${parentId}/tasks`,plan(initial,'验证·无效人天',{estimatedDays:0.25}),400)
await manager.post(`${base}/work-packages/${parentId}/tasks`,plan(initial,'验证·超出原窗口',{startsOn:'2026-09-01'}),400)
await manager.post(`${base}/work-packages/${parentId}/tasks`,plan(initial,'验证·跨工作包清单',{itemIds:[original.designItem]}),400)
await manager.post(`${base}/work-packages/${original.designWork}/tasks`,plan(initial,'验证·已完成包禁止新任务'),409)
assert.equal((await workspace()).tasks.length,0)
let source = await once('source-requirement-create',manager,'/api/requirements',{projectId,title:'验证·设备接口核对',originalText:'验证·请核对原采购集成工作包内八套控制设备的接口和点表，逐项记录一致性；不新增合同、数量或预算范围。',source:'INTERNAL',requester:'验证·接口联调团队',ownerAccountId:original.people.successor.id,verifierAccountId:original.people.verifier.id,priority:'NORMAL',expectedOn:'2026-10-18',importantCustomer:false})
source = await once('source-requirement-assess',manager,`/api/requirements/${source.requirement.id}/assess`,{version:source.requirement.version,clarification:'验证·按原八套设备的既定接口资料逐项核对，留存对照记录和遗留项。',category:'执行细化',scopeImpact:'验证·原批准范围内',technicalImpact:'验证·按既定接口',scheduleImpact:'验证·在原工作包窗口内安排',costImpact:'验证·本项不调整预算',contractImpact:'验证·不改变合同',acceptanceImpact:'验证·按原验收要求逐项记录',safetyImpact:'验证·按现有安全措施执行',baselineImpact:false})
source = await once('source-requirement-route',manager,`/api/requirements/${source.requirement.id}/route`,{version:source.requirement.version,disposition:'TASK',reason:'验证·明确派生原任务，随后原位接纳至已有采购集成专业工作包。'})
const link = source.links.find(l=>l.active && l.kind==='TASK')
assert.ok(link,'Source requirement must link to the original TASK.')
await writeFile(folder+'/fixture.json',JSON.stringify({projectId,parentId,people:original.people,stageId:original.integrationStage,itemId:original.equipmentItem,sourceRequirementId:source.requirement.id,sourceTaskId:link.workItemId,startedAt:new Date().toISOString()},null,2),{flag:'wx'})
await writeFile(folder+'/preflight.json',JSON.stringify({at:new Date().toISOString(),checks:['Original V4 scope and running integration stage retained','Outside and removed readers rejected','Fractional days, wrong dates, foreign package items and completed parent rejected without tasks','Original requirement manually assessed and routed to TASK, ready for same-ID adoption']},null,2))
console.log('PASS task preflight and original requirement TASK prepared')
