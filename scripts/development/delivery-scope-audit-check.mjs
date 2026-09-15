import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { storedClient } from './local-business-client.mjs'
const folder='outputs/verification/wi-010-delivery', f=JSON.parse(await readFile(folder+'/fixture.json','utf8'))
const project=f.projects[0], base='/api/delivery-initiation/'+project.projectId
const manager=await storedClient('http://127.0.0.1:8080',f.people.manager.stateFile), observer=await storedClient('http://127.0.0.1:8080',f.people.successor.stateFile)
const original=await manager.get(base);assert.equal(original.preparation.baselineVersion,4)
assert.ok(original.project.projectName.startsWith('验证·'))
const marker='验证·未实施草案取消与说明留存', existing=(await manager.get(base+'/scope-changes')).find(d=>d.reason===marker)
let proposal=existing?await manager.get(base+'/scope-changes/'+existing.id):await manager.post(base+'/scope-changes',{version:original.preparation.version,reason:marker,impact:'验证·仅维护草案；不产生新实际投入或有效预算。',basis:'验证·审计记录回归检查',policyEditionId:null})
const api=base+'/scope-changes/'+proposal.change.id
if(proposal.change.status==='DRAFT'){
  const key=randomUUID(), body={version:proposal.change.version,action:'CANCEL',note:'验证·需求尚未确认，本次草案取消；保留说明，不改写 V4。'}
  proposal=await manager.post(api+'/actions',body,200,key)
  const replay=await manager.post(api+'/actions',body,200,key);assert.deepEqual(replay.events,proposal.events)
}
assert.equal(proposal.change.status,'CANCELLED');assert.equal(proposal.events.length,2)
assert.ok(proposal.events.some(e=>e.action==='CREATED'&&e.note===marker))
assert.ok(proposal.events.some(e=>e.action==='CANCEL'&&e.note==='验证·需求尚未确认，本次草案取消；保留说明，不改写 V4。'))
assert.ok((await observer.get(api)).events.every(e=>e.note===null))
const current=await manager.get(base);assert.equal(current.preparation.baselineVersion,4);assert.deepEqual(current.objects,original.objects);assert.deepEqual(current.resources,original.resources)
const result={scopeId:proposal.change.id,checks:['实际新建与取消说明均保留，命令重放不重复记录','普通参与者不能取得含财务信息的操作说明','取消未实施草案不改变 V4 当前对象、资源和原批准记录']}
await writeFile(folder+'/scope-audit-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
