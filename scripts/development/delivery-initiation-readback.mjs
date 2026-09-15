import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { storedClient } from './local-business-client.mjs'

const folder = 'outputs/verification/wi-010-delivery'
const fixture = JSON.parse(await readFile(folder + '/fixture.json', 'utf8')), project = fixture.projects[0]
const stage = process.argv[2], root = '/api/delivery-initiation/' + project.projectId
assert.ok(['frozen', 'returned', 'resubmitted', 'agreed', 'approved', 'finding-closed', 'budget-revised', 'scope-proposed', 'scope-confirmed'].includes(stage))
const manager = await storedClient('http://127.0.0.1:8080', fixture.people.manager.stateFile)
const approver = await storedClient('http://127.0.0.1:8080', fixture.people.approver.stateFile)
const worker = await storedClient('http://127.0.0.1:8080', fixture.people.worker.stateFile)
const data = await manager.get(root), round = data.rounds[0], checks = []
const pass = (name) => { checks.push(name); console.log('PASS ' + name) }
assert.ok(project.stageIds.every((id) => data.objects.some((o) => o.id === id)))
assert.ok(project.packageIds.every((id) => data.objects.some((o) => o.id === id)))
if (stage === 'frozen' || stage === 'resubmitted') {
  assert.equal(data.preparation.status, 'SUBMITTED')
  assert.equal(round.number, stage === 'frozen' ? 1 : 2)
  assert.ok(!data.allowedActions.includes('EDIT'))
  const object = data.objects.find((o) => o.kind === 'STAGE')
  await manager.patch(root + '/objects/' + object.id, { version: data.preparation.version, objectVersion: object.version, content: object.content, reason: '验证·冻结期间拒绝改稿' }, 409)
  await manager.post(root + '/rounds/' + round.id + '/decision', { version: data.preparation.version, roundVersion: round.version, decision: 'APPROVED', comment: '验证·提交人无批准权限' }, 403)
  await approver.post(root + '/rounds/' + round.id + '/decision', { version: data.preparation.version, roundVersion: round.version, decision: 'APPROVED', comment: '验证·必要会签未完成不可提前批准' }, 409)
  const snapshot = await manager.get(root + '/rounds/' + round.id)
  const partial = await worker.get(root + '/rounds/' + round.id)
  assert.ok(partial.objects.every((o) => o.kind !== 'BUDGET'))
  assert.ok(!JSON.stringify(partial).includes('minimumBudget'))
  const work = await manager.get(root + '/work-packages')
  for (const id of project.packageIds) assert.equal(work.find((w) => w.id === id).deliveryState, 'IN_REVIEW')
  await writeFile(`${folder}/round-${round.number}-snapshot.json`, JSON.stringify(snapshot, null, 2))
  await writeFile(`${folder}/round-${round.number}-reference.json`, JSON.stringify({ id: round.id, snapshotHash: round.snapshotHash }, null, 2))
  pass(`第 ${round.number} 轮通过浏览器提交并冻结；拒绝修改、提交人批准和提前批准；快照预算仍隔离`)
}
if (['returned', 'resubmitted', 'agreed', 'approved'].includes(stage)) {
  const original = JSON.parse(await readFile(folder + '/round-1-snapshot.json', 'utf8'))
  const ref = JSON.parse(await readFile(folder + '/round-1-reference.json', 'utf8'))
  assert.deepEqual(await manager.get(root + '/rounds/' + ref.id), original)
  assert.equal(data.rounds.find((r) => r.id === ref.id).snapshotHash, ref.snapshotHash)
  pass('第一轮冻结快照和内容指纹保持不变，原对象标识连续')
}
if (stage === 'returned') {
  assert.equal(data.preparation.status, 'RETURNED')
  assert.ok(round.reviews.some((r) => r.status === 'RETURNED' && r.reviewerId === fixture.people.reviewer.id))
  assert.ok(data.allowedActions.includes('EDIT'))
  assert.equal(data.project.mainStage, 'PRESALES')
  const work = await manager.get(root + '/work-packages')
  for (const id of project.packageIds) assert.equal(work.find((w) => w.id === id).deliveryState, 'PREPARING')
  pass('指定独立会签人退回，经理可补齐，原工作包恢复准备状态，项目保持售前')
}
if (stage === 'agreed') {
  assert.equal(data.preparation.status, 'IN_REVIEW')
  assert.equal(round.number, 2)
  assert.ok(round.reviews.every((r) => r.status === 'AGREED'))
  assert.equal(data.project.mainStage, 'PRESALES')
  pass('第二轮必要会签完成，尚未最终批准，不提前切换项目阶段')
}
if (stage === 'approved') {
  assert.equal(data.preparation.status, 'APPROVED')
  assert.equal(data.preparation.baselineVersion, 1)
  assert.equal(data.project.mainStage, 'DELIVERY')
  assert.equal((await manager.get('/api/projects/' + project.projectId)).project.mainStage, 'DELIVERY')
  assert.equal(data.baselines.length, 1)
  const work = await manager.get(root + '/work-packages')
  for (const id of project.packageIds) {
    const item = work.find((w) => w.id === id)
    assert.equal(item.deliveryState, 'BASELINED')
    assert.equal(item.deliveryBaselineVersion, 1)
    assert.equal(item.status, 'OPEN')
  }
  assert.equal(work.find((w) => w.id === project.packageIds[0]).sourceRequirementId, project.requirementId)
  const baseline = await manager.get(root + '/baselines/' + data.baselines[0].id)
  await writeFile(folder + '/baseline-1-snapshot.json', JSON.stringify(baseline, null, 2))
  pass('浏览器独立最终批准后，原项目进入交付，原工作包 V1 生效且仍待执行，需求来源不变')
}
if (stage === 'finding-closed') {
  const finding = data.findings.find((f) => f.finding.title === '验证·现场文档版式补齐')
  assert.equal(finding.status, 'CLOSED')
  assert.equal(finding.evidenceBy, fixture.people.worker.id)
  assert.equal(finding.verifiedBy, fixture.people.verifier.id)
  assert.notEqual(finding.evidenceBy, finding.verifiedBy)
  pass('遗留责任人经浏览器提交证据，指定的另一名验证人独立关闭并保留意见')
}
if (stage === 'budget-revised') {
  assert.equal(data.preparation.baselineVersion, 2)
  assert.equal(data.preparation.status, 'APPROVED')
  assert.equal(data.baselines.length, 2)
  const budget = data.objects.find((o) => o.id === project.budgetId)
  assert.equal(budget.content.budget.lines.reduce((sum, line) => sum + Math.round(Number(line.amount) * 100), 0), 48100000)
  const old = JSON.parse(await readFile(folder + '/baseline-1-snapshot.json', 'utf8'))
  assert.deepEqual(await manager.get(root + '/baselines/' + data.baselines.find((b) => b.number === 1).id), old)
  const second = JSON.parse(await readFile(folder + '/round-2-snapshot.json', 'utf8'))
  const ref = JSON.parse(await readFile(folder + '/round-2-reference.json', 'utf8'))
  assert.deepEqual(await manager.get(root + '/rounds/' + ref.id), second)
  assert.equal(data.project.mainStage, 'DELIVERY')
  pass('经理通过浏览器直接修订原预算为 481,000 元并形成 V2；V1 与第二轮提交快照保持不变')
}
if (stage === 'scope-proposed') {
  assert.equal(data.preparation.baselineVersion, 2)
  const change = data.changes.find((c) => c.objectId === project.stageIds[0] && c.status === 'PENDING')
  assert.ok(change)
  assert.ok(change.content.stage.completionCriteria.includes('补充跨专业接口会签记录'))
  assert.ok(!data.objects.find((o) => o.id === change.objectId).content.stage.completionCriteria.includes('补充跨专业接口会签记录'))
  await manager.post(root + '/changes/' + change.id + '/decision', { version: data.preparation.version, changeVersion: change.version, decision: 'APPROVED', comment: '验证·提出人不得自行批准范围变更' }, 403)
  const baseline = data.baselines.find((b) => b.number === 2)
  await writeFile(folder + '/baseline-2-snapshot.json', JSON.stringify(await manager.get(root + '/baselines/' + baseline.id), null, 2))
  pass('浏览器提出原阶段范围变更后当前 V2 未变化；提出人不能自行批准')
}
if (stage === 'scope-confirmed') {
  assert.equal(data.preparation.baselineVersion, 3)
  assert.equal(data.changes[0].status, 'APPROVED')
  assert.equal(data.changes[0].decidedBy, fixture.people.approver.id)
  assert.ok(data.objects.find((o) => o.id === project.stageIds[0]).content.stage.completionCriteria.includes('补充跨专业接口会签记录'))
  for (const number of [1, 2]) {
    const old = JSON.parse(await readFile(`${folder}/baseline-${number}-snapshot.json`, 'utf8'))
    assert.deepEqual(await manager.get(root + '/baselines/' + data.baselines.find((b) => b.number === number).id), old)
  }
  const view = (await manager.get('/api/projects/' + project.projectId)).project
  await manager.patch('/api/projects/' + project.projectId, { version: view.version, name: view.name, background: view.background, focus: 'SURVEY' }, 400)
  pass('独立授权人通过浏览器确认范围变更，原阶段形成 V3；V1/V2 不变，交付项目不能误设售前重点')
}
let report = []
try { report = JSON.parse(await readFile(folder + '/browser-readback.json', 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
report.push({ at: new Date().toISOString(), stage, projectId: project.projectId, caseVersion: data.preparation.version, checks })
await writeFile(folder + '/browser-readback.json', JSON.stringify(report, null, 2))
