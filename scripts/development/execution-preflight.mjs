// Read and negative-command checks against the exact synthetic WI-010 project. No state reset.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { storedClient } from './local-business-client.mjs'

const folder = 'outputs/verification/wi-011-execution'
const original = JSON.parse(await readFile('outputs/verification/wi-010-delivery/fixture.json', 'utf8'))
const projectId = original.projects[0].projectId
assert.equal(projectId, 'c2ebb10c-39e1-4cdb-bca0-00724ffa808e')
const client = async key => storedClient('http://127.0.0.1:8080', original.people[key].stateFile)
const manager = await client('manager'), owner = await client('successor')
const base = `/api/projects/${projectId}/execution`
const current = await manager.get(base)
assert.equal(current.baselineVersion, 4)
assert.ok(current.projectName.startsWith('验证·'))
assert.equal(current.stages.length, 4)
await mkdir(folder, { recursive: true })
const fixture = { projectId, people: original.people, base,
  designStage: current.objects.find(o => o.content.stage?.templateCode === 'DESIGN').id,
  integrationStage: current.objects.find(o => o.content.stage?.templateCode === 'INTEGRATION').id,
  siteStage: current.objects.find(o => o.content.stage?.templateCode === 'SITE').id,
  designItem: current.objects.find(o => o.content.item?.title === '控制与接口设计成果').id,
  equipmentItem: current.objects.find(o => o.content.item?.category === 'EQUIPMENT').id,
  startedAt: new Date().toISOString(),
}
for (const name of ['design', 'integration']) {
  fixture[name + 'Milestone'] = current.objects.find(o => o.content.milestone?.stageId === fixture[name + 'Stage']).id
  fixture[name + 'Work'] = current.objects.find(o => o.content.workPackage?.stageId === fixture[name + 'Stage']).id
}
try { await writeFile(folder + '/fixture.json', JSON.stringify(fixture, null, 2), { flag: 'wx' }) }
catch (e) { if (e.code !== 'EEXIST') throw e }
assert.equal(current.recentEvents.length, 0, 'Preflight is for the untouched execution fixture; do not reset an advanced project.')
const before = {
  execution: current,
  baseline: await manager.get('/api/delivery-initiation/' + projectId),
  completedWork: await owner.get('/api/work-items/' + fixture.designWork),
}
assert.equal(before.completedWork.status, 'DONE')
await writeFile(folder + '/before.json', JSON.stringify(before, null, 2), { flag: 'wx' })
for (const key of ['outside', 'worker']) await (await client(key)).get(base, 404)
assert.ok(!JSON.stringify(await owner.get(base)).includes('"amount"'))
const work = await owner.get('/api/work-items/' + fixture.integrationWork)
assert.ok(!work.allowedActions.includes('COMPLETE'))
await owner.post('/api/work-items/' + work.id + '/transition', { version: work.version, action: 'COMPLETE', evidence: '验证·阶段未开始不能完成工作包' }, 409)
const stage = current.objects.find(o => o.id === fixture.siteStage)
await manager.post(base + '/stages/' + stage.id + '/actions', {
  version: -1, objectVersion: stage.version, action: 'START', occurredOn: '2026-09-13', note: '验证·前置阶段未完成不得越过开始',
}, 409)
assert.equal((await manager.get(base)).recentEvents.length, 0)
await writeFile(folder + '/preflight.json', JSON.stringify({ at: new Date().toISOString(), checks: [
  'V4 original scope and four execution stages retained', 'removed and outside members receive 404',
  'ordinary project reader receives no budget data', 'unstarted package completion hidden and rejected',
  'stage predecessors checked and rejected writes leave no execution history',
] }, null, 2))
console.log('PASS execution preflight: current scope, privacy, stage prerequisites, rejected-write rollback')
