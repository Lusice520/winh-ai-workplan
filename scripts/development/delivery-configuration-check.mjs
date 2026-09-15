import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'

const origin = process.env.BUSINESS_CHECK_ORIGIN ?? 'http://127.0.0.1:8080'
const url = new URL(origin)
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname), 'This check only supports a loopback development server.')
assert.ok(process.env.APP_BOOTSTRAP_ADMIN_PASSWORD, 'Local bootstrap credentials are required through the runtime wrapper.')
assert.equal(process.env.BUSINESS_CHECK_SYNTHETIC_AUTHORITY_FIXTURE, '1', 'Explicit local synthetic authority fixture setup is required; application delegation rules remain unchanged.')
const run = Date.now().toString(36)
const out = process.env.BUSINESS_CHECK_ARTIFACT_DIR ?? 'outputs/verification/wi-010-configuration'
const checks = []
const pass = (name) => { checks.push(name); console.log(`PASS ${name}`) }

function client() {
  const cookies = new Map()
  async function request(method, path, body, expected = 200, key = randomUUID()) {
    const csrf = method === 'GET' ? null : (await request('GET', '/api/auth/csrf')).token
    const response = await fetch(origin + path, {
      method, headers: {
        'Content-Type': 'application/json',
        Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
        ...(csrf ? { 'X-XSRF-TOKEN': csrf, 'Idempotency-Key': key } : {}),
      }, body: body === undefined ? undefined : JSON.stringify(body),
    })
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0], index = pair.indexOf('=')
      cookies.set(pair.slice(0, index), pair.slice(index + 1))
    }
    const bodyText = await response.text()
    const data = bodyText ? JSON.parse(bodyText) : undefined
    assert.equal(response.status, expected, `${method} ${path}: ${data?.code ?? 'unexpected status'} ${data?.message ?? ''}`)
    return data
  }
  return {
    request,
    get: (path, expected) => request('GET', path, undefined, expected),
    post: (path, body, expected = 200, key = randomUUID()) => request('POST', path, { ...body, requestId: key }, expected, key),
    patch: (path, body, expected = 200, key = randomUUID()) => request('PATCH', path, { ...body, requestId: key }, expected, key),
    login: (loginName, password) => request('POST', '/api/auth/login', { loginName, password }),
    state: () => ({ cookies: [...cookies].map(([name, value]) => ({ name, value, domain: url.hostname, path: '/', httpOnly: name !== 'XSRF-TOKEN', secure: false, sameSite: 'Lax' })), origins: [] }),
  }
}

const admin = client()
const me = await admin.login(process.env.APP_BOOTSTRAP_ADMIN_LOGIN ?? 'admin', process.env.APP_BOOTSTRAP_ADMIN_PASSWORD)
const organizationId = (await admin.get(`/api/iam/users/${me.accountId}`)).organizationUnit.id
const roles = await admin.get('/api/access-control/roles')
let grantingClient = admin
const role = (code) => { const result = roles.find((r) => r.code === code); assert.ok(result, `Missing local role ${code}`); return result.id }
async function assign(id, roleIds) {
  const current = await admin.get(`/api/access-control/accounts/${id}/system-role-assignments`)
  return grantingClient.request('PUT', `/api/access-control/accounts/${id}/system-role-assignments`, { roleIds, version: current.version, reason: '验证·WI-010 合成账号职责授权' })
}
async function user(suffix, label, code) {
  const temporaryPassword = `Aa!9-${randomUUID()}`, password = `Zz!8-${randomUUID()}`, loginName = `wi010-${suffix}-${run}`
  const created = await admin.request('POST', '/api/iam/users', { loginName, displayName: `验证·${label} ${run}`, organizationUnitId: organizationId, temporaryPassword }, 201)
  await assign(created.id, [role(code)])
  const api = client(); await api.login(loginName, temporaryPassword)
  await api.request('POST', '/api/auth/password/change', { currentPassword: temporaryPassword, newPassword: password })
  return { id: created.id, name: created.displayName, loginName, api }
}
// An already-authorized company administrator is a test fixture, not a new application delegation exception.
// Only this newly created synthetic account is seeded; no existing user's authorization is changed.
const grantor = await user('grantor', '已具备公司授权的测试管理员', 'BUSINESS_ADMIN')
await assign(grantor.id, [role('BUSINESS_ADMIN'), role('SYSTEM_SECURITY_ADMIN')])
assert.match(grantor.id, /^[0-9a-f-]{36}$/)
assert.match(grantor.loginName, /^wi010-grantor-[a-z0-9]+$/)
assert.equal(url.port, '8080', 'The synthetic authority fixture is restricted to the known main local database.')
const psql = '.local-tools/postgresapp-2.9.6/Postgres.app/Contents/Versions/18/bin/psql'
const result = execFileSync(psql, ['-X', '-h', '127.0.0.1', '-p', '54329', '-U', 'winh', '-d', 'winh_workplan', '-v', 'ON_ERROR_STOP=1', '-t', '-A'], {
  input: `INSERT INTO system_role_assignment(id,account_id,role_id,status,assigned_by_account_id) SELECT '${randomUUID()}',u.id,r.id,'ACTIVE',NULL FROM user_account u,access_role r WHERE u.id='${grantor.id}' AND u.login_name='${grantor.loginName}' AND r.code='DELIVERY_AUTHORIZER' RETURNING account_id;`,
  encoding: 'utf8',
})
assert.ok(result.includes(grantor.id), 'Synthetic company authority setup must affect its exact new account.')
grantingClient = grantor.api
const editor = await user('editor', '交付配置人', 'DELIVERY_GOVERNANCE_ADMIN')
const publisher = await user('publisher', '公司授权发布人', 'DELIVERY_AUTHORIZER')
const reviewer = await user('reviewer', '专业会签人', 'BUSINESS_USER')
const approver = await user('approver', '最终批准人', 'BUSINESS_USER')
const api = '/api/delivery-configurations'
assert.ok((await editor.api.get(`${api}/capabilities`)).includes('DELIVERY_TEMPLATE_MANAGE'))
assert.ok(!(await editor.api.get(`${api}/capabilities`)).includes('DELIVERY_POLICY_PUBLISH'))
await reviewer.api.get(api, 403)
await reviewer.api.post(api, { kind: 'STAGE_TEMPLATE', name: '不应创建', versionNote: '无权' }, 403)
await editor.api.post(api, { kind: 'REVIEW_POLICY', name: '未知字段', versionNote: '拒绝', policy: { autoApprove: true } }, 400)
pass('真实配置角色与公司发布权分离；普通账号和未知字段被拒绝')

const stage = (code, name, predecessors = [], parallel = []) => ({ code, name, applicability: 'REQUIRED', condition: null, ownerRoleHint: '阶段负责人', predecessorCodes: predecessors, parallelCodes: parallel, milestones: [`${name}成果确认`], actions: ['专业方案复核', '接口与风险核对'], deliverables: [`${name}交付资料`], completionCriteria: '成果完整，由指定责任人独立确认并留存依据。' })
const definition = { projectTypes: ['SYSTEM_INTEGRATION'], stages: [stage('DESIGN', '方案设计', [], ['INTEGRATION']), stage('INTEGRATION', '采购集成', [], ['DESIGN']), stage('SITE', '现场实施', ['DESIGN', 'INTEGRATION'])] }
const createBody = { kind: 'STAGE_TEMPLATE', name: `验证·紧凑交付阶段模板 ${run}`, versionNote: '本地合成模板，用于验证阶段发布和原版本保留。', template: { projectTypes: [], stages: [] } }
const createKey = randomUUID()
let draft = await editor.api.post(api, createBody, 200, createKey)
assert.equal((await editor.api.post(api, createBody, 200, createKey)).configuration.id, draft.configuration.id)
await editor.api.post(api, { ...createBody, name: '同键不同正文' }, 409, createKey)
assert.equal(draft.problems.length, 2)
await editor.api.post(`${api}/${draft.configuration.id}/publish`, { version: draft.configuration.version, reason: '缺项不能发布' }, 400)
const cycle = structuredClone(definition); cycle.stages[0].predecessorCodes = ['SITE']
draft = await editor.api.patch(`${api}/${draft.configuration.id}`, { version: draft.configuration.version, name: createBody.name, versionNote: createBody.versionNote, template: cycle })
assert.ok(draft.problems.some((p) => p.message.includes('循环')))
await editor.api.post(`${api}/${draft.configuration.id}/publish`, { version: draft.configuration.version, reason: '循环不能发布' }, 400)
const stale = draft.configuration.version
draft = await editor.api.patch(`${api}/${draft.configuration.id}`, { version: stale, name: createBody.name, versionNote: createBody.versionNote, template: definition })
await editor.api.patch(`${api}/${draft.configuration.id}`, { version: stale, name: '旧版本覆盖', versionNote: '拒绝', template: definition }, 409)
assert.equal(draft.problems.length, 0)
pass('缺项与循环依赖阻断发布；幂等冲突和过时版本不覆盖草稿')

const publishKey = randomUUID(), publishBody = { version: draft.configuration.version, reason: '验证·发布可用的合成阶段模板' }
const first = await editor.api.post(`${api}/${draft.configuration.id}/publish`, publishBody, 200, publishKey)
assert.equal((await editor.api.post(`${api}/${draft.configuration.id}/publish`, publishBody, 200, publishKey)).snapshotHash, first.snapshotHash)
await editor.api.patch(`${api}/${first.configuration.id}`, { version: first.configuration.version, name: '覆盖已发布', versionNote: '拒绝', template: definition }, 409)
let second = await editor.api.post(`${api}/${first.configuration.id}/next-version`, { version: first.configuration.version, reason: '验证·下一版阶段名称细化' })
const v2definition = structuredClone(definition); v2definition.stages[0].name = '方案与接口设计'
second = await editor.api.patch(`${api}/${second.configuration.id}`, { version: second.configuration.version, name: createBody.name, versionNote: '验证·第二版，旧版不变', template: v2definition })
second = await editor.api.post(`${api}/${second.configuration.id}/publish`, { version: second.configuration.version, reason: '验证·第二版发布' })
const retained = await editor.api.get(`${api}/${first.configuration.id}`)
assert.deepEqual(retained.template, first.template); assert.equal(retained.snapshotHash, first.snapshotHash)
second = await editor.api.post(`${api}/${second.configuration.id}/retire`, { version: second.configuration.version, reason: '验证·停止新引用，保留已发布正文' })
assert.equal(second.configuration.status, 'RETIRED'); assert.deepEqual(second.template, v2definition)
pass('发布版本锁定；新版本与退役保留旧正文、身份和校验值')

const policyDefinition = { projectTypes: ['SYSTEM_INTEGRATION'], minimumBudget: 0, maximumBudget: 480000, riskLevels: ['LOW', 'MEDIUM'], reviewers: [{ accountId: reviewer.id, scope: 'TECHNICAL' }], finalApproverId: approver.id, authorityBasis: '验证·合成公司授权规则，仅用于本地流程检查，不作为正式制度。' }
let policy = await editor.api.post(api, { kind: 'REVIEW_POLICY', name: `验证·交付独立评审规则 ${run}`, versionNote: '本地合成规则，人员业务权限仍须在项目中核验。', policy: policyDefinition })
await editor.api.post(`${api}/${policy.configuration.id}/publish`, { version: policy.configuration.version, reason: '配置权不能代替公司授权发布' }, 403)
await publisher.api.patch(`${api}/${policy.configuration.id}`, { version: policy.configuration.version, name: '发布人不能代编', versionNote: '拒绝', policy: policyDefinition }, 403)
policy = await publisher.api.post(`${api}/${policy.configuration.id}/publish`, { version: policy.configuration.version, reason: '验证·独立业务授权发布' })
assert.equal(policy.configuration.status, 'PUBLISHED')
assert.equal((await admin.get(`/api/access-control/accounts/${approver.id}/system-role-assignments`)).assignments.filter((r) => r.status === 'ACTIVE').length, 1)
const browserPolicy = await editor.api.post(`${api}/${policy.configuration.id}/next-version`, { version: policy.configuration.version, reason: '验证·浏览器确认适用条件后发布' })
await assign(publisher.id, [role('BUSINESS_USER')])
await publisher.api.post(`${api}/${browserPolicy.configuration.id}/publish`, { version: browserPolicy.configuration.version, reason: '撤销授权后应立即拒绝' }, 403)
await assign(publisher.id, [role('DELIVERY_AUTHORIZER')])
pass('真实独立账号发布规则；发布不授予项目审批权，撤销发布权限立即生效')

const browserTemplate = await editor.api.post(`${api}/${first.configuration.id}/next-version`, { version: first.configuration.version, reason: '验证·浏览器阶段维护与发布' })
const fixture = {
  run, origin, authoritySetup: 'A new synthetic company grantor was explicitly initialized in the local test database; application delegation rules were preserved.',
  grantorId: grantor.id, templateId: first.configuration.id, templateHash: first.snapshotHash, policyId: policy.configuration.id,
  browserTemplateId: browserTemplate.configuration.id, browserPolicyId: browserPolicy.configuration.id,
  editor: { id: editor.id, name: editor.name, loginName: editor.loginName }, publisher: { id: publisher.id, name: publisher.name, loginName: publisher.loginName },
  reviewer: { id: reviewer.id, name: reviewer.name }, approver: { id: approver.id, name: approver.name },
}
await mkdir(out, { recursive: true })
await writeFile(`${out}/api-checks.json`, JSON.stringify({ timestamp: new Date().toISOString(), checks }, null, 2))
await writeFile(`${out}/fixture.json`, JSON.stringify(fixture, null, 2))
await mkdir('.local-data', { recursive: true })
for (const [label, account] of [['admin', { api: admin }], ['grantor', grantor], ['editor', editor], ['publisher', publisher], ['reviewer', reviewer], ['approver', approver]]) {
  await writeFile(`.local-data/wi010-${label}-session.json`, JSON.stringify(account.api.state()), { mode: 0o600 })
}
console.log('Configuration API verification complete; private browser state saved separately.')
