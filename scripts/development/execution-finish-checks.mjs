import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { f, folder, manager, owner, verifier, workspace, item, stage, once, today } from './execution-fixture-actions.mjs'

let w = await workspace()
assert.equal(w.milestones.find(m => m.id === f.designMilestone).status, 'VERIFIED', 'Verify the design milestone from the other-account browser first.')
assert.equal((await item(f.equipmentItem)).item.totals.accepted, 2)
await stage('design-complete-round-1', f.designStage, 'COMPLETE', '验证·原工作包、清单和里程碑均已独立完成，确认本阶段完成。')
w = await workspace()
let milestone = w.milestones.find(m => m.id === f.designMilestone)
const ref = w.objects.find(o => o.id === f.designMilestone)
await manager.post(f.base + '/milestones/' + milestone.id + '/actions', { version: milestone.version, objectVersion: ref.version, action: 'REOPEN', note: '验证·不能绕过已完成阶段直接重开下游' }, 409)
const designAcceptance = (await item(f.designItem)).events.find(e => e.kind === 'ACCEPTED' && e.status === 'VERIFIED')
await verifier.post(f.base + '/events/' + designAcceptance.id + '/actions', { version: designAcceptance.version, objectVersion: (await item(f.designItem)).object.version, action: 'REVERSE', note: '验证·下游阶段完成后不能直接冲回原验收' }, 409)
await stage('design-reopen-round-2', f.designStage, 'REOPEN', '验证·补充接口会签核对，明确重开阶段并保留第一轮完成事实。')
await once('design-milestone-reopen', manager, f.base + '/milestones/' + milestone.id + '/actions', { version: milestone.version, objectVersion: ref.version, action: 'REOPEN', note: '验证·重新核对方案设计成果，原独立结论和附件保留。' })
w = await workspace(); milestone = w.milestones.find(m => m.id === f.designMilestone)
await once('design-milestone-resubmit', manager, f.base + '/milestones/' + milestone.id + '/submit', {
  version: milestone.version, objectVersion: ref.version, occurredOn: today,
  evidence: '验证·补充接口会签复核说明后重提，沿用本轮已发布的交付范围依据，原提交记录保持可追溯。',
  verifierId: f.people.verifier.id, fileVersionIds: milestone.files.map(f => f.versionId),
})
w = await workspace(); milestone = w.milestones.find(m => m.id === f.designMilestone)
await once('design-milestone-reverify', verifier, f.base + '/milestones/' + milestone.id + '/actions', { version: milestone.version, objectVersion: ref.version, action: 'VERIFY', note: '验证·补充记录经独立复核，本轮成果通过。' })
await stage('design-complete-round-2', f.designStage, 'COMPLETE', '验证·补充核对完成，按现行批准条件确认阶段再次完成。')
const history = await manager.get(f.base + '/history/' + f.designMilestone)
const rounds = history.filter(e => e.action === 'MILESTONE_SUBMIT')
assert.equal(rounds.length, 2)
assert.notEqual(rounds[0].afterJson, rounds[1].afterJson)
assert.equal(rounds[0].afterFiles.files.length, 1)
assert.equal(rounds[1].afterFiles.files[0].versionId, rounds[0].afterFiles.files[0].versionId)
assert.ok(history.some(e => e.action === 'MILESTONE_REOPEN'))
w = await workspace()
assert.equal(w.stages.find(s => s.id === f.designStage).status, 'COMPLETED')
const integration = w.stages.find(s => s.id === f.integrationStage), integrationRef = w.objects.find(o => o.id === integration.id)
assert.equal(integration.status, 'IN_PROGRESS')
assert.equal(integration.progress, 55)
await manager.post(f.base + '/stages/' + integration.id + '/actions', { version: integration.version, objectVersion: integrationRef.version, action: 'COMPLETE', occurredOn: today, note: '验证·剩余清单及工作包尚未完成不能确认阶段完成' }, 409)
const before = JSON.parse(await readFile(folder + '/before.json', 'utf8'))
assert.deepEqual((await manager.get('/api/delivery-initiation/' + f.projectId)).objects, before.baseline.objects)
assert.deepEqual(await owner.get('/api/work-items/' + f.designWork), before.completedWork)
await writeFile(folder + '/finish-checks.json', JSON.stringify({ at: new Date().toISOString(), checks: [
  'independent milestone required before stage completion', 'closed downstream rejects direct reverse and reopen',
  'explicit stage and milestone reopening retains both completion rounds', 'each round retains exact file versions',
  'incomplete second stage cannot complete', 'approved objects and earlier work unchanged',
] }, null, 2))
await writeFile(folder + '/final-workspace.json', JSON.stringify(await workspace(), null, 2))
await writeFile(folder + '/final-equipment.json', JSON.stringify(await item(f.equipmentItem), null, 2))
await writeFile(folder + '/milestone-history.json', JSON.stringify(history, null, 2))
console.log('PASS stage completion, explicit reopening, two milestone rounds, attachment history and unchanged baseline')
