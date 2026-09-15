import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { storedClient } from './local-business-client.mjs'

export const folder = 'outputs/verification/wi-012-tasks'
export const original = JSON.parse(await readFile('outputs/verification/wi-011-execution/fixture.json', 'utf8'))
export const projectId = original.projectId, parentId = original.integrationWork
assert.equal(projectId, 'c2ebb10c-39e1-4cdb-bca0-00724ffa808e')
export const base = `/api/projects/${projectId}`
export const client = key => storedClient('http://127.0.0.1:8080', original.people[key].stateFile)
export const manager = await client('manager'), owner = await client('successor'), verifier = await client('verifier')
export const workspace = (actor = manager) => actor.get(`${base}/work-packages/${parentId}/tasks`)
export const detail = (id, actor = manager) => actor.get(`${base}/tasks/${id}`)
export const today = '2026-09-13'
await mkdir(folder, { recursive: true })
let commands = {}
try { commands = JSON.parse(await readFile(folder + '/commands.json', 'utf8')) } catch (e) { if (e.code !== 'ENOENT') throw e }
export async function once(key, actor, path, input, method = 'POST') {
  if (!commands[key]) {
    commands[key] = { method, path, input, requestId: randomUUID() }
    await writeFile(folder + '/commands.json', JSON.stringify(commands, null, 2))
  }
  const command = commands[key]; assert.equal(command.path, path); assert.equal(command.method, method)
  return (method === 'POST' ? actor.post : actor.patch)(path, command.input, 200, command.requestId)
}
export async function act(key, actor, id, action, extra = {}) {
  const d = await detail(id)
  return once(key, actor, `${base}/tasks/${id}/commands`, { version:d.task.version,workVersion:d.task.workVersion,action,note:'验证·'+key,occurredOn:today,...extra })
}
export const plan = (scope, title, extra = {}) => ({parentVersion:scope.workPackage.version,title,
  description:'验证·在采购集成包范围内核对设备、接口和资料，保留逐项实际结果。',
  acceptanceCriteria:'验证·逐项核对本任务成果，由指定其他人独立确认，问题补齐后重新验证。',
  ownerId:original.people.successor.id,verifierId:original.people.verifier.id,startsOn:'2026-10-12',dueDate:'2026-11-05',
  estimatedDays:1.5,itemIds:[original.equipmentItem],reason:'验证·原批准工作包内进行任务细化，不改合同、清单数量或已批准预算。',...extra})
