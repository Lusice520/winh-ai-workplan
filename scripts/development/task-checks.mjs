// Stateful local synthetic verification; retain every original intent and history.
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { folder, original, base, parentId, manager, owner, verifier, client, workspace, detail, today, act } from './task-fixture-client.mjs'

const f = JSON.parse(await readFile(folder + '/fixture.json', 'utf8'))
const before = await detail(f.tasks.points), pending = await detail(f.tasks.interlock)
const command = (d, extra = {}) => ({version:d.task.version,workVersion:d.task.workVersion,action:'PROGRESS',progress:65,occurredOn:today,note:'验证·反例不能改写当前事实',...extra})
const rejects = []
async function reject(label, actor, path, input, status) {
  const result = await actor.post(path, input, status)
  rejects.push({label, status, code:result.code, message:result.message})
}
for (const key of ['outside','worker']) await (await client(key)).get(`${base}/tasks/${f.tasks.points}`,404)
await reject('经理不能代填个人实际',manager,`${base}/tasks/${f.tasks.points}/commands`,command(before),409)
await reject('实际不能早于阶段开始',owner,`${base}/tasks/${f.tasks.points}/commands`,command(before,{occurredOn:'2026-09-12'}),400)
await reject('实际不能是未来日期',owner,`${base}/tasks/${f.tasks.points}/commands`,command(before,{occurredOn:'2099-01-01'}),400)
await reject('JSON 小数进度不能被截断为整数',owner,`${base}/tasks/${f.tasks.points}/commands`,command(before,{progress:12.25}),400)
await reject('提交人不能自验',owner,`${base}/tasks/${f.tasks.interlock}/commands`,command(pending,{action:'VERIFY'}),409)
await reject('原泛用入口不能绕过任务成果规则',owner,`/api/work-items/${f.tasks.points}/transition`,{version:before.task.workVersion,action:'COMPLETE',evidence:'验证·禁止绕过'},409)
const parent = await owner.get('/api/work-items/' + parentId)
assert.ok(!parent.allowedActions.includes('COMPLETE'))
await reject('父包存在未结任务时不能提交完成',owner,`/api/work-items/${parentId}/transition`,{version:parent.version,action:'COMPLETE',evidence:'验证·父包必须等待任务独立完成'},409)
assert.deepEqual(await detail(f.tasks.points),before)
assert.deepEqual(await detail(f.tasks.interlock),pending)
assert.deepEqual(await owner.get('/api/work-items/' + parentId),parent)
await writeFile(folder + '/negative-checks.json', JSON.stringify(rejects,null,2))

let concurrent
try { concurrent=JSON.parse(await readFile(folder+'/concurrency.json','utf8')) } catch(e) { if(e.code!=='ENOENT')throw e }
if (!concurrent) {
  assert.equal(before.task.progress,65)
  concurrent={path:`${base}/tasks/${f.tasks.points}/commands`,before,commands:[66,67].map(progress=>({requestId:randomUUID(),input:command(before,{progress,note:`验证·并发提交 ${progress}，仅一个当前版本可以写入`})}))}
  await writeFile(folder+'/concurrency.json',JSON.stringify(concurrent,null,2),{flag:'wx'})
  const results=await Promise.allSettled(concurrent.commands.map(c=>owner.post(concurrent.path,c.input,200,c.requestId)))
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
  const rejected=results.find(r=>r.status==='rejected');assert.match(rejected.reason.message,/409/)
  const current=await detail(f.tasks.points)
  assert.equal(current.history.length,before.history.length+1)
  concurrent.winner=results.findIndex(r=>r.status==='fulfilled')
  concurrent.after=current
  await writeFile(folder+'/concurrency.json',JSON.stringify(concurrent,null,2))
}
assert.ok(Number.isInteger(concurrent.winner),'Inspect an interrupted concurrency attempt before continuing.')
const winner=concurrent.commands[concurrent.winner]
const priorReplay=await detail(f.tasks.points)
await owner.post(concurrent.path,winner.input,200,winner.requestId)
assert.deepEqual(await detail(f.tasks.points),priorReplay)
await act('并发核对后保留65进展',owner,f.tasks.points,'PROGRESS',{progress:65})
const afterRestore=await detail(f.tasks.points)
await owner.post(concurrent.path,winner.input,200,winner.requestId)
assert.deepEqual(await detail(f.tasks.points),afterRestore)
await writeFile(folder+'/checks.json',JSON.stringify({at:new Date().toISOString(),negativeChecks:rejects.length,concurrency:'one accepted, one 409, one event',replay:'same original key/body before and after a later command, no added event or stale overwrite',pointsProgress:afterRestore.task.progress,originalSource:f.sourceTaskId},null,2))
console.log('PASS role/date/fraction/bypass/parent rollback checks and real PostgreSQL concurrent version + original-key replay')
