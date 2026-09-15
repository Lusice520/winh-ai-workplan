// Opt-in, synthetic local fixture only. No real account receives new approval or resource authority.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { localClient } from './local-business-client.mjs'

const origin = 'http://127.0.0.1:8080'
assert.equal(process.env.BUSINESS_CHECK_SYNTHETIC_AUTHORITY_FIXTURE, '1', 'Synthetic pre-authorized company fixture must be explicitly enabled.')
assert.ok(process.env.APP_BOOTSTRAP_ADMIN_PASSWORD)
const out = 'outputs/verification/wi-010-delivery'
await mkdir(out, { recursive: true })
const run = Date.now().toString(36), people = {}, checks = []
const pass = (name) => { checks.push(name); console.log('PASS ' + name) }
const admin = localClient(origin)
const me = await admin.login(process.env.APP_BOOTSTRAP_ADMIN_LOGIN ?? 'admin', process.env.APP_BOOTSTRAP_ADMIN_PASSWORD)
const org = (await admin.get('/api/iam/users/' + me.accountId)).organizationUnit.id
const roles = await admin.get('/api/access-control/roles')
const roleId = (code) => { const role = roles.find((r) => r.code === code); assert.ok(role, 'Registered role required: ' + code); return role.id }
let grantor = admin
async function assign(id, codes) {
  const current = await admin.get('/api/access-control/accounts/' + id + '/system-role-assignments')
  await grantor.request('PUT', '/api/access-control/accounts/' + id + '/system-role-assignments', {
    roleIds: codes.map(roleId), version: current.version, reason: '验证·WI-010 合成业务职责分配',
  })
}
async function person(key, name, codes) {
  const temporaryPassword = 'Aa!9-' + randomUUID(), password = 'Zz!8-' + randomUUID(), loginName = 'wi010dg2-' + key + '-' + run
  const account = await admin.request('POST', '/api/iam/users', { loginName, displayName: '验证·' + name, organizationUnitId: org, temporaryPassword }, 201)
  if (codes.length) await assign(account.id, codes)
  const api = localClient(origin); await api.login(loginName, temporaryPassword)
  await api.request('POST', '/api/auth/password/change', { currentPassword: temporaryPassword, newPassword: password })
  const stateFile = '.local-data/wi010-dg2-' + key + '-session.json'
  await api.save(stateFile)
  people[key] = { id: account.id, name: account.displayName, loginName, stateFile }
  await writeFile(out + '/setup-progress.json', JSON.stringify({ run, people, checks }, null, 2))
  return { ...people[key], api }
}
const company = await person('company', '已有业务授权的测试管理者', ['BUSINESS_ADMIN', 'SYSTEM_SECURITY_ADMIN'])
assert.match(company.id, /^[a-f0-9-]{36}$/)
assert.match(company.loginName, /^wi010dg2-company-[a-z0-9]+$/)
// Isolated fixture establishes the already-authorized starting actor; application delegation ceilings stay unchanged.
const result = execFileSync('.local-tools/postgresapp-2.9.6/Postgres.app/Contents/Versions/18/bin/psql',
  ['-X', '-h', '127.0.0.1', '-p', '54329', '-U', 'winh', '-d', 'winh_workplan', '-v', 'ON_ERROR_STOP=1', '-t', '-A'], {
    input: ['DELIVERY_AUTHORIZER', 'DELIVERY_RESOURCE_MANAGER'].map((code) =>
      "INSERT INTO system_role_assignment(id,account_id,role_id,status,assigned_by_account_id) SELECT '" + randomUUID() + "',u.id,r.id,'ACTIVE',NULL FROM user_account u,access_role r WHERE u.id='" + company.id + "' AND u.login_name='" + company.loginName + "' AND r.code='" + code + "' RETURNING account_id;").join('\n'),
    encoding: 'utf8',
  })
assert.ok(result.includes(company.id))
grantor = company.api
const manager = await person('manager', '项目经理', ['BUSINESS_USER', 'HANDOVER_COORDINATOR'])
const reviewer = await person('reviewer', '专业会签人', ['BUSINESS_USER', 'DELIVERY_REVIEWER'])
const approver = await person('approver', '公司最终批准人', ['BUSINESS_USER', 'DELIVERY_AUTHORIZER', 'HANDOVER_REVIEWER'])
const worker = await person('worker', '专业工作包负责人', ['BUSINESS_USER'])
const verifier = await person('verifier', '工作包验证人', ['BUSINESS_USER'])
const committer = await person('committer', '部门资源承诺人', ['BUSINESS_USER', 'DELIVERY_RESOURCE_MANAGER'])
const outsider = await person('outside', '未参与项目人员', ['BUSINESS_USER'])
pass('建立独立合成业务人员；实际职责经现行授权接口分配，未更改真实账号')

const customer = await admin.post('/api/crm/customers', { name: '验证·启明智能制造 ' + run, kind: 'CUSTOMER', source: '本地合成验证', ownerAccountId: manager.id, status: 'ACTIVE' })
const templates = {
  projectTypes: ['SYSTEM_INTEGRATION'],
  stages: [
    ['DESIGN', '方案设计', [], ['INTEGRATION']],
    ['INTEGRATION', '采购集成', [], ['DESIGN']],
    ['SITE', '现场实施', ['DESIGN', 'INTEGRATION'], []],
  ].map(([code, name, predecessorCodes, parallelCodes]) => ({
    code, name, applicability: 'REQUIRED', condition: null, ownerRoleHint: '专业负责人', predecessorCodes, parallelCodes,
    milestones: [name + '成果确认'], actions: ['核对范围与接口', '组织成果复核'], deliverables: [name + '成果资料', '验收依据清单'], completionCriteria: '成果通过指定人员独立验证，范围与验收依据完整。',
  })),
}
let template = await company.api.post('/api/delivery-configurations', { kind: 'STAGE_TEMPLATE', name: '验证·自动化项目交付阶段 ' + run, versionNote: '本地合成模板，非正式公司制度。', template: templates })
template = await company.api.post('/api/delivery-configurations/' + template.configuration.id + '/publish', { version: template.configuration.version, reason: '验证·发布用于原项目基线的阶段模板' })
let policy = await company.api.post('/api/delivery-configurations', { kind: 'REVIEW_POLICY', name: '验证·交付立项授权分工 ' + run, versionNote: '本地合成规则，须独立会签与最终批准。', policy: {
  projectTypes: ['SYSTEM_INTEGRATION'], minimumBudget: 0, maximumBudget: 1000000, riskLevels: ['LOW', 'MEDIUM'],
  reviewers: [{ accountId: reviewer.id, scope: 'TECHNICAL' }], finalApproverId: approver.id, authorityBasis: '验证·本地授权路径，不能作为公司正式审批制度。',
} })
policy = await company.api.post('/api/delivery-configurations/' + policy.configuration.id + '/publish', { version: policy.configuration.version, reason: '验证·公司授权人明确发布独立评审分工' })
const fixture = { run, people, companyAuthorityFixture: 'Only the exact new synthetic company account was seeded with pre-existing authority; application delegation rules remain unchanged.', templateId: template.configuration.id, policyId: policy.configuration.id, projects: [] }
const checkpoint = async () => writeFile(out + '/fixture.json', JSON.stringify(fixture, null, 2))
await checkpoint()

async function prepareProject(suffix) {
  const title = '验证·启明产线自动化改造' + (suffix === 'api' ? '（接口验证）' : '')
  const opportunity = await admin.post('/api/crm/opportunities', { customerId: customer.customer.id, title, ownerAccountId: manager.id, source: '本地合成验证', procurementMethod: 'TENDER', background: '生产数据采集、产线控制集成与现场实施，按原项目接续交付。' })
  let project = await admin.post('/api/projects', { opportunityId: opportunity.opportunity.id, presalesOwnerId: manager.id })
  const pid = project.project.id, projectApi = '/api/projects/' + pid, base = '/api/delivery-initiation/' + pid
  const result = { suffix, projectId: pid, stageIds: [], packageIds: [], milestoneIds: [], itemIds: [], resourceIds: [], planIds: [] }
  fixture.projects.push(result); await checkpoint()
  for (const [person, roleCodes] of [[reviewer, ['PROJECT_REVIEWER']], [approver, ['PROJECT_REVIEWER']], [worker, ['PROJECT_CONTRIBUTOR']], [verifier, ['PROJECT_REVIEWER']], [committer, ['PROJECT_CONTRIBUTOR']]]) {
    project = await admin.post(projectApi + '/members', { version: project.project.version, accountId: person.id, active: true, roleCodes, reason: '验证·加入原项目并明确协作权限' })
  }
  let sg = await manager.api.post(projectApi + '/presales/initiations', { purpose: '验证·原项目售前投入', scope: '完成方案和移交资料', expectedOutputs: '可核验的交付范围与验收依据', exitConditions: '完成交付移交与立项', requestedHours: 80, requestedCost: 5000, startsOn: '2026-09-13', endsOn: '2026-10-11' })
  let initiation = sg.initiations[0]
  sg = await manager.api.post(projectApi + '/presales/initiations/' + initiation.id + '/submit', { version: initiation.version })
  initiation = sg.initiations[0]
  await approver.api.post(projectApi + '/presales/initiations/' + initiation.id + '/review', { version: initiation.version, decision: 'APPROVED', comment: '验证·独立核验售前投入', approvedHours: 80, approvedCost: 5000 })
  async function publishedFile(name, classification) {
    const data = new FormData()
    data.append('metadata', new Blob([JSON.stringify({ requestId: randomUUID(), title: name, kind: 'HANDOVER', classification, changeNote: '仅本地合成资料' })], { type: 'application/json' }))
    data.append('file', new Blob([name + '\n本地合成内容：交付范围、验收边界、责任、时间与移交要求。']), '验证交付依据.txt')
    let file = await manager.api.request('POST', projectApi + '/files', data)
    const fileApi = '/api/files/' + file.document.id + '/versions/' + file.versions[0].id + '/transition'
    file = await manager.api.post(fileApi, { version: file.versions[0].version, decision: 'IN_REVIEW', comment: '验证·提交独立发布' })
    return approver.api.post(fileApi, { version: file.versions[0].version, decision: 'PUBLISHED', comment: '验证·核验文件后发布' })
  }
  const general = await publishedFile('验证·交付范围与验收目标', 'INTERNAL')
  const cost = await publishedFile('验证·售前投入与估算依据', 'COST')
  const award = await publishedFile('验证·中标通知商务依据', 'CONTRACT')
  let hg = await manager.api.post(projectApi + '/handover', { projectType: 'SYSTEM_INTEGRATION', receiverId: approver.id, dueDate: '2026-10-11' })
  hg = await manager.api.post(projectApi + '/handover/basis', { version: hg.handover.version, kind: 'AWARD', referenceId: award.document.currentVersionId, note: '验证·中标通知作为商务依据，不伪造合同归档。' })
  for (const item of hg.items.filter((i) => !['BASE', 'COMMERCIAL'].includes(i.key))) {
    hg = await manager.api.patch(projectApi + '/handover/items/' + item.id, { version: item.version, ownerId: manager.id, dueDate: '2026-10-11', applicable: true, referenceKind: 'FILE', referenceId: item.key === 'INVESTMENT' ? cost.document.currentVersionId : general.document.currentVersionId, note: '验证·明确接收本项交付范围和依据。' })
  }
  hg = await manager.api.post(projectApi + '/handover/submissions', { version: hg.handover.version, note: '验证·移交资料齐备，请独立接收' })
  hg = await approver.api.post(projectApi + '/handover/reviews/' + hg.reviews[0].id, { version: hg.reviews[0].version, decision: 'APPROVED', comment: '验证·DG-01 独立接收通过' })
  result.packageId = hg.packages[0].id; result.generalDocumentId = general.document.id
  await outsider.api.get(base, 404)
  let workspace = await manager.api.post(base + '/initialize', { header: { projectManagerId: manager.id, technicalLeadId: worker.id, projectType: 'SYSTEM_INTEGRATION', riskLevel: 'MEDIUM', scopeAcceptance: '已接收产线控制、设备集成和现场实施范围。', acceptanceCriteria: '按成果清单、接口校验和现场联调结果验收。', timeConstraints: '方案与采购并行，前置成果确认后进入现场实施。', handoverFollowups: '移交资料已逐项接收，首段人员承诺在立项中继续确认。' } })
  workspace = await manager.api.post(base + '/configuration', { version: workspace.preparation.version, kind: 'STAGE_TEMPLATE', editionId: fixture.templateId, reason: '验证·明确沿用发布模板快照' })
  workspace = await manager.api.post(base + '/configuration', { version: workspace.preparation.version, kind: 'REVIEW_POLICY', editionId: fixture.policyId, reason: '验证·选择适用的公司评审分工' })
  const stages = workspace.objects.filter((o) => o.kind === 'STAGE')
  result.stageIds = stages.map((o) => o.id)
  async function save(id, content, existingWorkItemId) {
    const before = new Set(workspace.objects.map((o) => o.id)), previous = id ? workspace.objects.find((o) => o.id === id) : null
    const body = { version: workspace.preparation.version, objectVersion: previous?.version, existingWorkItemId, content, reason: '验证·维护原项目交付准备' }
    workspace = id ? await manager.api.patch(base + '/objects/' + id, body) : await manager.api.post(base + '/objects', body)
    return id ?? workspace.objects.find((o) => !before.has(o.id)).id
  }
  const windows = [['2026-10-12', '2026-11-08'], ['2026-10-12', '2026-11-15'], ['2026-11-16', '2026-12-20']]
  for (const [index, original] of stages.entries()) {
    const [startsOn, endsOn] = windows[index], title = templates.stages[index].name
    await save(original.id, { stage: { ...original.content.stage, ownerId: worker.id, applicable: true, focus: index === 0, startsOn, endsOn } })
    let existing
    if (index === 0) {
      const rp = '/api/requirements'
      let req = await manager.api.post(rp, { projectId: pid, title: '验证·产线接口与验收范围细化', originalText: '验证·客户原话：请明确产线接口、设备范围和验收标准。', source: 'CUSTOMER', requester: '验证·客户项目组', ownerAccountId: worker.id, verifierAccountId: verifier.id, priority: 'HIGH', expectedOn: endsOn, importantCustomer: false })
      result.requirementId = req.requirement.id
      req = await manager.api.post(rp + '/' + result.requirementId + '/assess', { version: req.requirement.version, clarification: '明确本项目专业范围', category: '交付范围细化', scopeImpact: '明确已知范围', technicalImpact: '核对接口', scheduleImpact: '纳入初始计划', costImpact: '纳入初始预算', contractImpact: '不变更商务约定', acceptanceImpact: '落实验收标准', safetyImpact: '按既定要求', baselineImpact: false })
      req = await manager.api.post(rp + '/' + result.requirementId + '/route', { version: req.requirement.version, disposition: 'WORK_PACKAGE', reason: '验证·派生专业工作包并接续 DG-02' })
      existing = req.links[0].workItemId
      const prior = await manager.api.get('/api/work-items/' + existing)
      await worker.api.post('/api/work-items/' + existing + '/transition', { version: prior.version, action: 'COMPLETE', evidence: '验证·尚未 DG-02 应拒绝正式完成' }, 409)
    }
    const workContent = { title: title + '专业工作包', scope: title + '范围与接口边界已明确，限定本项目交付内容。', deliverables: title + '成果资料、接口与验收清单', acceptanceCriteria: '成果齐备且经指定人员独立确认。', ownerId: worker.id, verifierId: verifier.id, stageId: original.id, startsOn, endsOn, resourceNotes: '按本包资源申请进行部门承诺，冲突需明确协调。', itemIds: [], milestoneIds: [] }
    const wid = await save(null, { workPackage: workContent }, existing);result.packageIds.push(wid)
    if (existing) assert.equal(wid, existing)
    const mid = await save(null, { milestone: { title: title + '成果验收', kind: 'ACCEPTANCE', dueDate: endsOn, ownerId: manager.id, stageId: original.id, sourceNote: 'DG-01 中标通知与交付方案约定的验收边界。', acceptanceCriteria: '工作包全部成果通过独立核验。' } });result.milestoneIds.push(mid)
    const iid = await save(null, { item: { title: ['控制与接口设计成果', '自动化控制设备', '现场联调交付成果'][index], category: index === 1 ? 'EQUIPMENT' : 'DELIVERABLE', specification: '按已明确范围交付，接口与数量可核验。', quantity: index === 1 ? 8 : 1, unit: index === 1 ? '套' : '项', acceptanceScope: '关联本阶段成果验收节点。', stageId: original.id, workPackageId: wid, milestoneId: mid, procurementNeeded: index === 1, procurementNote: index === 1 ? '需采购控制设备与安装附件。' : null } });result.itemIds.push(iid)
    await save(wid, { workPackage: { ...workContent, itemIds: [iid], milestoneIds: [mid] } })
    const plan = { title: title + '主计划', kind: 'MASTER', stageId: original.id, startsOn, endsOn, deliveryWindowStart: startsOn, deliveryWindowEnd: endsOn, dependsOnIds: [], resourceConstraints: '以已确认的人员资源与采购窗口为准。' }
    result.planIds.push(await save(null, { plan }))
    result.planIds.push(await save(null, { plan: { ...plan, title: title + '工作包计划', kind: 'WORK_PACKAGE', workPackageId: wid } }))
    workspace = await manager.api.post(base + '/resources', { version: workspace.preparation.version, request: { workPackageId: wid, personId: worker.id, committerId: committer.id, startsOn, endsOn, dailyHours: index === 2 ? 6 : 3, requestNote: '验证·申请本工作包专业人员投入。' }, reason: '验证·明确人员和投入窗口' })
    const resource = workspace.resources.at(-1);result.resourceIds.push(resource.id)
    if (index !== 2) {
      workspace = await committer.api.post(base + '/resources/' + resource.id + '/commit', { version: workspace.preparation.version, resourceVersion: resource.version, decision: 'COMMITTED', commitment: { dailyCapacity: 8, conclusion: '验证·部门核对窗口与当前占用，确认承诺。' }, reason: '验证·部门资源签认' })
      workspace = await manager.api.get(base)
    }
    await checkpoint()
  }
  const lines = result.packageIds.map((wid, index) => ({ title: templates.stages[index].name + '人员预算', category: 'PERSONNEL', amount: 30000, stageId: result.stageIds[index], workPackageId: wid, resourceRequestId: result.resourceIds[index], basis: '已知专业人员投入范围与资源申请。' }))
  lines.push({ title: '控制设备采购', category: 'PROCUREMENT', amount: 200000, stageId: result.stageIds[1], workPackageId: result.packageIds[1], itemId: result.itemIds[1], basis: '已知控制设备数量与采购估算。' },
    { title: '现场专业分包', category: 'SUBCONTRACT', amount: 120000, stageId: result.stageIds[2], workPackageId: result.packageIds[2], basis: '现场专业实施范围估算。' },
    { title: '现场差旅', category: 'TRAVEL', amount: 40000, stageId: result.stageIds[2], workPackageId: result.packageIds[2], basis: '现场投入窗口与出差计划。' },
    { title: '其他交付费用', category: 'OTHER', amount: 30000, stageId: result.stageIds[0], workPackageId: result.packageIds[0], basis: '其他已知交付辅助费用。' })
  result.budgetId = await save(null, { budget: { mode: 'FULL', scope: '覆盖三个适用阶段、专业人员、设备采购与现场分包实施。', authorizedStageIds: [], lines } })
  assert.equal(workspace.checks.filter((c) => c.status === 'PASS').length, 8, JSON.stringify(workspace.checks))
  assert.equal(workspace.project.mainStage, 'PRESALES')
  result.caseId = workspace.preparation.id;result.caseVersion = workspace.preparation.version
  await checkpoint();pass(suffix + '：真实 SG-01 → 文件发布 → DG-01 → 原对象准备完成，8 / 9 项通过，保留资源待办')
}
await prepareProject('api')
// Browser project is created after API validation, so shared resource windows do not silently create conflicts.
fixture.checks = checks
await checkpoint()
await writeFile(out + '/prepare-checks.json', JSON.stringify({ at: new Date().toISOString(), checks }, null, 2))
for (const [key, person] of Object.entries({ company, manager, reviewer, approver, worker, verifier, committer, outside: outsider })) await person.api.save(people[key].stateFile)
await admin.save('.local-data/wi010-dg2-admin-session.json')
console.log('Prepared local DG-02 fixture; no approval or execution completion was invented.')
