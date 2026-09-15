import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { f, folder, manager, owner, verifier, item, stage, fact, decision, today, workspace } from './execution-fixture-actions.mjs'

const d = await item(f.equipmentItem)
assert.equal(d.item.totals.pending, 2, 'Submit the first two units from the owner browser before this check.')
assert.equal(d.item.totals.accepted, 0)
const pending = d.events.find(e => e.kind === 'ACCEPTED' && e.status === 'PENDING')
assert.equal(pending.submittedBy, f.people.successor.id)
await owner.post(f.base + '/events/' + pending.id + '/actions', { version: pending.version, objectVersion: d.object.version, action: 'VERIFY', note: '验证·提交人不能自验' }, 403)
assert.ok((await verifier.get(f.base)).reviewQueue.some(e => e.id === pending.id))
assert.ok(!(await owner.get(f.base)).reviewQueue.some(e => e.id === pending.id))
const payload = { version: d.item.profile.version, objectVersion: d.object.version, kind: 'RECEIVED', quantity: 2, occurredOn: today, evidence: '验证·第二批两套设备到货（并发容量校验）', fileVersionIds: [], verifierId: null }
const requestIds = [randomUUID(), randomUUID()]
await writeFile(folder + '/concurrent-input.json', JSON.stringify({ payload, requestIds }, null, 2), { flag: 'wx' })
const results = await Promise.allSettled(requestIds.map(key => owner.post(f.base + '/items/' + f.equipmentItem + '/events', payload, 200, key)))
assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
const rejected = results.find(r => r.status === 'rejected')
assert.match(rejected.reason.message, /: 409 /)
const after = await item(f.equipmentItem)
assert.equal(after.item.totals.received, 8)
assert.equal(after.events.length, d.events.length + 1)
const winningIndex = results.findIndex(r => r.status === 'fulfilled')
await owner.post(f.base + '/items/' + f.equipmentItem + '/events', payload, 200, requestIds[winningIndex])
assert.equal((await item(f.equipmentItem)).events.length, after.events.length)
await owner.post(f.base + '/items/' + f.equipmentItem + '/events', { ...payload, version: after.item.profile.version }, 409)
await manager.post(f.base + '/items/' + f.equipmentItem + '/profile', {
  version: after.item.profile.version, objectVersion: d.object.version, requiresReceipt: false, requiresInstallation: false, reason: '验证·不能改环节绕过有效数量',
}, 409)
const extra = after.events.find(e => e.evidence === payload.evidence)
await decision('错误的第二批到货记录明确冲回', f.equipmentItem, extra.id, 'REVERSE', owner)
await decision('错误的第二批到货记录明确冲回', f.equipmentItem, extra.id, 'REVERSE', owner)
let corrected = await item(f.equipmentItem)
assert.equal(corrected.events.filter(e => e.reversalOfId === extra.id).length, 1)
assert.equal(corrected.events.find(e => e.id === extra.id).quantity, 2)
assert.equal(corrected.item.totals.received, 6)
await fact('corrected-arrival', f.equipmentItem, 'RECEIVED', 2, '验证·补录已核对装箱单的第二批两套，保留原错误记录及冲回依据。')
await fact('equipment-next-pending', f.equipmentItem, 'ACCEPTED', 1, '验证·第三套调试完成待独立核验，尚不计入已验收。')
await stage('pause-integration-check', f.integrationStage, 'PAUSE', '验证·暂停阶段，核实暂停时不能继续登记新的实际。')
corrected = await item(f.equipmentItem)
await owner.post(f.base + '/items/' + f.equipmentItem + '/events', { ...payload, kind: 'INSTALLED', quantity: 1, version: corrected.item.profile.version }, 409)
assert.ok(!(await owner.get('/api/work-items/' + f.integrationWork)).allowedActions.includes('COMPLETE'))
await stage('resume-integration-check', f.integrationStage, 'RESUME', '验证·现场条件恢复，继续原阶段执行。')
assert.ok((await owner.get('/api/work-items/' + f.integrationWork)).allowedActions.includes('COMPLETE'))
const before = JSON.parse(await readFile(folder + '/before.json', 'utf8'))
assert.deepEqual((await manager.get('/api/delivery-initiation/' + f.projectId)).objects, before.baseline.objects)
assert.deepEqual(await owner.get('/api/work-items/' + f.designWork), before.completedWork)
await writeFile(folder + '/quantity-checks.json', JSON.stringify({ at: new Date().toISOString(), concurrent: ['one accepted', 'one rejected 409'],
  browserAcceptanceId: pending.id, equipment: (await item(f.equipmentItem)).item, checks: [
    'owner self verification forbidden', 'designated reviewer queue only', 'concurrent arrivals serialize without excess',
    'replay creates no duplicate', 'current version excess also rejected', 'active profile applicability immutable',
    'reversal retains original quantity and repeats once', 'pause blocks facts and package completion',
    'resume exposes valid package action', 'original approved objects and completed work unchanged',
  ], workspace: await workspace() }, null, 2))
console.log('PASS quantity, independence, replay, concurrency, correction, pause, original scope preservation')
