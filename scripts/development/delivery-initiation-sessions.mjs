// Refresh only the exact synthetic accounts created by the WI-010 local fixture.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { localClient, storedClient } from './local-business-client.mjs'

const origin = 'http://127.0.0.1:8080'
const fixture = JSON.parse(await readFile('outputs/verification/wi-010-delivery/fixture.json', 'utf8'))
assert.match(fixture.run, /^[a-z0-9]+$/)
const selected = process.argv.slice(2)
const admin = localClient(origin)
await admin.login(process.env.APP_BOOTSTRAP_ADMIN_LOGIN ?? 'admin', process.env.APP_BOOTSTRAP_ADMIN_PASSWORD)
for (const [key, person] of Object.entries(fixture.people)) {
  if (selected.length && !selected.includes(key)) continue
  assert.equal(person.loginName, `wi010dg2-${key}-${fixture.run}`)
  assert.equal(person.stateFile, `.local-data/wi010-dg2-${key}-session.json`)
  const existing = await storedClient(origin, person.stateFile)
  try {
    const me = await existing.get('/api/auth/me')
    assert.equal(me.accountId, person.id)
    console.log('PASS synthetic session active: ' + key)
    continue
  } catch (error) {
    assert.match(error.message, /: 401 /, 'Only an expired local session permits fixture password renewal.')
  }
  const current = await admin.get('/api/iam/users/' + person.id)
  assert.equal(current.loginName, person.loginName)
  assert.ok(current.displayName.startsWith('验证·'))
  const temporaryPassword = 'Fixture!7-' + randomUUID(), password = 'Fixture!9-' + randomUUID()
  await admin.request('POST', `/api/iam/users/${person.id}/password-resets`, { version: current.version, temporaryPassword, reason: '验证·重启后恢复本次精确合成账号会话，不涉及真实账号。' })
  const api = localClient(origin)
  await api.login(person.loginName, temporaryPassword)
  await api.request('POST', '/api/auth/password/change', { currentPassword: temporaryPassword, newPassword: password })
  await api.save(person.stateFile)
  console.log('PASS synthetic session renewed: ' + key)
}
await admin.save('.local-data/wi010-dg2-admin-session.json')
