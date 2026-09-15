import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'

const directory = 'outputs/verification/wi-010-configuration'
const fixture = JSON.parse(await readFile(`${directory}/fixture.json`, 'utf8'))
const phase = process.argv[2] ?? 'template'
const origin = new URL(fixture.origin)
assert.ok(['127.0.0.1', 'localhost'].includes(origin.hostname) && origin.protocol === 'http:')
const state = JSON.parse(await readFile('.local-data/wi010-editor-session.json', 'utf8'))
async function get(id) {
  const response = await fetch(`${origin.origin}/api/delivery-configurations/${id}`, { headers: { Cookie: state.cookies.map(({ name, value }) => `${name}=${value}`).join('; ') } })
  assert.equal(response.status, 200)
  return response.json()
}
const original = await get(fixture.templateId)
assert.equal(original.snapshotHash, fixture.templateHash)
assert.equal(original.template.stages[0].name, '方案设计')
const details = await get(phase === 'policy' ? fixture.browserPolicyId : fixture.browserTemplateId)
const record = { phase, checkedAt: new Date().toISOString(), id: details.configuration.id, status: details.configuration.status, edition: details.configuration.edition, originalTemplateUnchanged: true }
if (phase === 'template' || phase === 'retire') {
  assert.equal(details.configuration.status, phase === 'retire' ? 'RETIRED' : 'PUBLISHED')
  assert.equal(details.template.stages[0].name, '方案与验收边界设计')
  assert.deepEqual(details.template.stages[0].deliverables, ['控制方案设计稿', '接口与验收边界清单'])
  assert.equal(details.configuration.publishedByName, fixture.editor.name)
  assert.ok(details.history.some((event) => event.description.includes('浏览器确认阶段')))
  record.browserStageChangesPersisted = true
  record.publishedHash = details.snapshotHash
  if (phase === 'retire') {
    assert.equal(details.retirementReason, '验证·浏览器退役 v3，旧版和新草稿均保留。')
    const next = details.editions.find((edition) => edition.edition === 4)
    assert.ok(next && next.status === 'DRAFT' && next.id !== details.configuration.id)
    record.nextDraftId = next.id
  }
} else if (phase === 'policy') {
  assert.equal(details.configuration.status, 'PUBLISHED')
  assert.equal(details.configuration.publishedByName, fixture.publisher.name)
  assert.equal(details.policy.authorityBasis, '验证·浏览器确认本地公司授权与专业会签分工；适用范围保持不变。')
  assert.equal(details.policy.finalApproverId, fixture.approver.id)
  assert.ok(details.history.some((event) => event.description.includes('浏览器独立授权发布')))
  record.independentPublisherVerified = true
} else throw new Error('Unknown readback phase')
let records = []
try { records = JSON.parse(await readFile(`${directory}/browser-readback.json`, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
records.push(record)
await writeFile(`${directory}/browser-readback.json`, JSON.stringify(records, null, 2))
console.log(`PASS browser ${phase}: persisted state and unchanged original template verified`)
