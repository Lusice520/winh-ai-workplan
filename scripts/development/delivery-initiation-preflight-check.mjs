import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { storedClient } from './local-business-client.mjs'

const fixture = JSON.parse(await readFile('outputs/verification/wi-010-delivery/fixture.json', 'utf8'))
const project = fixture.projects[0], root = '/api/delivery-initiation/' + project.projectId
const people = fixture.people, clients = {}, checks = []
for (const key of ['manager', 'worker', 'outside', 'committer']) clients[key] = await storedClient('http://127.0.0.1:8080', people[key].stateFile)
const pass = (message) => { checks.push(message); console.log('PASS ' + message) }
const { manager, worker, outside } = clients
const start = await manager.get(root)
assert.equal(start.preparation.status, 'PREPARING')
assert.equal(start.checks.filter((c) => c.status === 'PASS').length, 8)
assert.deepEqual(start.checks.filter((c) => c.status !== 'PASS').map((c) => c.code), ['TEAM'])
assert.equal(start.project.mainStage, 'PRESALES')
assert.ok(start.findings.some((f) => f.finding.title === '验证·现场文档版式补齐' && !f.blocking))
pass('重启后保存真实准备内容与浏览器登记的遗留，主阶段仍为售前，8 / 9 检查通过')
const partial = await worker.get(root), partialJson = JSON.stringify(partial)
assert.equal(partial.preparation.budgetReadable, false)
assert.ok(partial.objects.every((o) => o.kind !== 'BUDGET'))
assert.ok(!partialJson.includes('"amount"') && !partialJson.includes('minimumBudget') && !partialJson.includes('maximumBudget'))
assert.equal(partial.preparation.finalApproverId, people.approver.id)
assert.ok(partial.preparation.reviewAssignments.some((r) => r.accountId === people.reviewer.id))
assert.deepEqual(await worker.get(root + '/objects/' + project.budgetId + '/history'), [])
pass('预算对象、金额与历史受限，协作成员仍能核对指定会签与最终批准人')
await outside.get(root, 404)
const outsideQueue = await outside.get('/api/delivery-initiation')
assert.ok(outsideQueue.items.every((p) => p.projectId !== project.projectId))
const projectView = await manager.get('/api/projects/' + project.projectId)
assert.ok(projectView.allowedActions.includes('DG2_READ') && projectView.allowedActions.includes('DELIVERY_BUDGET_READ'))
pass('项目成员边界与项目空间入口权限一致，未参与人员无法查看本项目')
const old = start.objects.find((o) => o.kind === 'STAGE')
await manager.patch(root + '/objects/' + old.id, { version: start.preparation.version - 1, objectVersion: old.version, content: old.content, reason: '验证·过期版本应拒绝' }, 409)
await manager.post(root + '/findings', { version: start.preparation.version, finding: { ...start.findings[0].finding, blocking: false }, reason: '验证·禁止自行关闭阻断属性' }, 400)
const milestone = start.objects.find((o) => o.kind === 'MILESTONE')
await manager.patch(root + '/objects/' + milestone.id, { version: start.preparation.version, objectVersion: milestone.version, content: { ...milestone.content, milestone: { ...milestone.content.milestone, stageId: randomUUID() } }, reason: '验证·不可引用未登记的外部阶段' }, 400)
pass('过期版本、伪造阻断字段和不存在的关联阶段均拒绝写入')
await manager.post(root + '/submit', { version: start.preparation.version, note: '验证·资源未承诺不得提前提交' }, 409)
const resource = start.resources.find((r) => r.status === 'REQUESTED')
await worker.post(root + '/resources/' + resource.id + '/commit', { version: start.preparation.version, resourceVersion: resource.version, decision: 'COMMITTED', commitment: { dailyCapacity: 8, conclusion: '验证·无权人不可承诺' }, reason: '验证·权限边界' }, 403)
const work = await manager.get('/api/work-items/' + project.packageIds[0])
await worker.post('/api/work-items/' + project.packageIds[0] + '/transition', { version: work.version, action: 'COMPLETE', evidence: '验证·批准前不可完成工作包' }, 409)
pass('资源条件不齐不能提交、无权人员不能承诺，未批准工作包不能提前完成')
const after = await manager.get(root)
assert.equal(after.preparation.version, start.preparation.version)
assert.deepEqual(after.objects, start.objects)
pass('全部拒绝请求未改变原对象和准备版本')
await writeFile('outputs/verification/wi-010-delivery/preflight-checks.json', JSON.stringify({ at: new Date().toISOString(), projectId: project.projectId, checks }, null, 2))
