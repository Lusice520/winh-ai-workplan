import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { storedClient } from './local-business-client.mjs'

export const folder = 'outputs/verification/wi-011-execution'
export const f = JSON.parse(await readFile(folder + '/fixture.json', 'utf8'))
assert.equal(f.projectId, 'c2ebb10c-39e1-4cdb-bca0-00724ffa808e')
export const client = key => storedClient('http://127.0.0.1:8080', f.people[key].stateFile)
export const manager = await client('manager'), owner = await client('successor'), verifier = await client('verifier')
export const today = '2026-09-13'
export const workspace = () => manager.get(f.base)
export const item = id => owner.get(f.base + '/items/' + id)
let commands = {}
try { commands = JSON.parse(await readFile(folder + '/commands.json', 'utf8')) } catch (e) { if (e.code !== 'ENOENT') throw e }
// Persist the original command before a write, so a retry uses the same payload and request ID.
export async function once(key, actor, path, input) {
  if (!commands[key]) {
    commands[key] = { path, input, requestId: randomUUID() }
    await writeFile(folder + '/commands.json', JSON.stringify(commands, null, 2))
  }
  const command = commands[key]
  assert.equal(command.path, path)
  return actor.post(path, command.input, 200, command.requestId)
}
export async function stage(key, id, action, note, progress, occurredOn = today) {
  const w = await workspace(), ref = w.objects.find(o => o.id === id), current = w.stages.find(o => o.id === id)
  return once(key, manager, f.base + '/stages/' + id + '/actions', { version: current.version, objectVersion: ref.version, action, occurredOn, note, progress })
}
export async function profile(key, id, equipment) {
  const d = await item(id)
  return once(key, manager, f.base + '/items/' + id + '/profile', {
    version: d.item.profile?.version ?? -1, objectVersion: d.object.version,
    requiresReceipt: equipment, requiresInstallation: equipment,
    brand: equipment ? '验证·工业控制系列' : '', model: equipment ? 'CTRL-08' : '', supplier: equipment ? '验证·设备供货单位' : '',
    reason: equipment ? '验证·八套控制设备按批次到货、安装后独立验收。' : '验证·设计资料直接按成果验收，不适用实物到货和安装。',
  })
}
export async function fact(key, id, kind, quantity, evidence, fileVersionIds = [], occurredOn = today) {
  const d = await item(id)
  return once(key, owner, f.base + '/items/' + id + '/events', {
    version: d.item.profile.version, objectVersion: d.object.version, kind, quantity, occurredOn, evidence, fileVersionIds,
    verifierId: kind === 'ACCEPTED' ? f.people.verifier.id : null,
  })
}
export async function decision(key, itemId, eventId, action, actor = verifier) {
  const d = await item(itemId), row = d.events.find(e => e.id === eventId)
  return once(key, actor, f.base + '/events/' + eventId + '/actions', {
    version: row.version, objectVersion: d.object.version, action, note: '验证·' + key,
  })
}
