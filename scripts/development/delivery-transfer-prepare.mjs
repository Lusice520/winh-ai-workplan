// Extends only the explicitly named synthetic WI-010 fixture, using normal IAM and project commands.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { localClient, storedClient } from './local-business-client.mjs'

const origin = 'http://127.0.0.1:8080', folder = 'outputs/verification/wi-010-delivery'
const fixture = JSON.parse(await readFile(folder + '/fixture.json', 'utf8'))
const projectId = fixture.projects[0].projectId, root = '/api/delivery-initiation/' + projectId
const admin = localClient(origin)
const adminMe = await admin.login(process.env.APP_BOOTSTRAP_ADMIN_LOGIN ?? 'admin', process.env.APP_BOOTSTRAP_ADMIN_PASSWORD)
const company = await storedClient(origin, fixture.people.company.stateFile)
const manager = await storedClient(origin, fixture.people.manager.stateFile)
const worker = await storedClient(origin, fixture.people.worker.stateFile)
assert.match(fixture.run, /^[a-z0-9]+$/)
assert.equal((await manager.get('/api/auth/me')).accountId, fixture.people.manager.id)
if (!fixture.people.successor) {
  const org = (await admin.get('/api/iam/users/' + adminMe.accountId)).organizationUnit.id
  const temporaryPassword = 'Aa!9-' + randomUUID(), password = 'Zz!8-' + randomUUID()
  const loginName = 'wi010dg2-successor-' + fixture.run
  const account = await admin.request('POST', '/api/iam/users', { loginName, displayName: '验证·接任专业负责人', organizationUnitId: org, temporaryPassword }, 201)
  fixture.people.successor = { id: account.id, name: account.displayName, loginName, stateFile: '.local-data/wi010-dg2-successor-session.json' }
  await writeFile(folder + '/fixture.json', JSON.stringify(fixture, null, 2))
  const roles = await admin.get('/api/access-control/roles')
  const role = roles.find(r => r.code === 'BUSINESS_USER'); assert.ok(role)
  const assignments = await admin.get('/api/access-control/accounts/' + account.id + '/system-role-assignments')
  await company.request('PUT', '/api/access-control/accounts/' + account.id + '/system-role-assignments', { version: assignments.version, roleIds: [role.id], reason: '验证·WI-010 接任人员基础业务身份，不授予公司批准或部门承诺权。' })
  const successor = localClient(origin); await successor.login(loginName, temporaryPassword)
  await successor.request('POST', '/api/auth/password/change', { currentPassword: temporaryPassword, newPassword: password })
  await successor.save(fixture.people.successor.stateFile)
}
const successor = fixture.people.successor
assert.equal(successor.loginName, 'wi010dg2-successor-' + fixture.run)
let project = await manager.get('/api/projects/' + projectId)
if (!project.members.some(m => m.accountId === successor.id && m.active))
  project = await manager.post('/api/projects/' + projectId + '/members', { version: project.project.version, accountId: successor.id, roleCodes: ['PROJECT_CONTRIBUTOR'], active: true, reason: '验证·接任前先加入原项目，所有实际职责等待独立接收与资源重签。' })
const data = await manager.get(root)
assert.equal(data.preparation.status, 'APPROVED')
assert.equal(data.preparation.baselineVersion, 3)
assert.equal(data.preparation.header.technicalLeadId, fixture.people.worker.id)
const preview = await manager.get(root + '/responsibility-transfers/preview?fromId=' + fixture.people.worker.id + '&toId=' + successor.id)
assert.equal(preview.mapping.resources.length, 3)
assert.equal(preview.mapping.related.filter(r => r.domain === 'WORK').length, 3)
assert.ok(preview.mapping.related.some(r => r.domain === 'REQUIREMENT' && r.objectId === fixture.projects[0].requirementId))
await manager.get(root + '/responsibility-transfers/preview?fromId=' + fixture.people.worker.id + '&toId=' + fixture.people.verifier.id, 400)
await worker.get(root + '/responsibility-transfers/preview?fromId=' + fixture.people.worker.id + '&toId=' + successor.id, 404)
const workId = fixture.projects[0].packageIds[0], work = await manager.get('/api/work-items/' + workId)
assert.equal(work.deliveryState, 'BASELINED'); assert.equal(work.creationSource, 'REQUIREMENT')
assert.ok(!work.allowedActions.includes('COMPLETE'))
assert.ok((await worker.get('/api/work-items/' + workId)).allowedActions.includes('COMPLETE'))
await manager.post('/api/work-items/' + workId + '/transition', { version: work.version, action: 'COMPLETE', evidence: '验证·项目经理不能代替实际负责人提交工作包完成' }, 409)
const baseline = data.baselines.find(b => b.number === 3)
const snapshot = await manager.get(root + '/baselines/' + baseline.id)
await writeFile(folder + '/baseline-3-before-transfer.json', JSON.stringify(snapshot, null, 2))
await writeFile(folder + '/transfer-preflight.json', JSON.stringify({ at: new Date().toISOString(), projectId, successor, preview,
  checks: ['真实正常授权接口创建接任成员，无新增公司审批或部门签认授权', '预览同时包含三工作包、三资源、技术与阶段责任及原需求', '拒绝独立验证冲突与非经理发起', '工作包区分基线和执行；经理不得冒充实际负责人提交完成', '原 V3 与当前责任均保持未交接状态'] }, null, 2))
console.log('PASS transfer preflight: prepared successor through normal IAM, mapped all live responsibilities, rejected invalid actors and preserved current V3.')
