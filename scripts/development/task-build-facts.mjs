import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { folder, parentId, base, manager, owner, verifier, workspace, plan, once, act } from './task-fixture-client.mjs'
const f=JSON.parse(await readFile(folder+'/fixture.json','utf8')), initial=await workspace()
assert.ok(initial.tasks.some(t=>t.id===f.sourceTaskId),'Adopt the original task in the browser before preparing related facts.')
const definitions=[['wiring','验证·控制柜接线检查','2026-10-25',2],['interlock','验证·联锁模拟测试','2026-10-30',2],['points','验证·通信点表联调','2026-11-05',1.5],['documents','验证·设备到货资料整理','2026-11-10',1],['site','验证·现场联调准备','2026-11-15',0.5]]
f.tasks={source:f.sourceTaskId}
for(const [key,title,dueDate,estimatedDays] of definitions){
 const task=await once('create-'+key,manager,`${base}/work-packages/${parentId}/tasks`,plan(initial,title,{dueDate,estimatedDays}))
 f.tasks[key]=task.task.id
}
await writeFile(folder+'/fixture.json',JSON.stringify(f,null,2))
await act('接线检查实际完成',owner,f.tasks.wiring,'COMPLETE')
await act('接线检查独立核验通过',verifier,f.tasks.wiring,'VERIFY')
await act('联锁模拟测试提交成果',owner,f.tasks.interlock,'COMPLETE')
await act('通信点表联调报告65',owner,f.tasks.points,'PROGRESS',{progress:65})
await act('到货资料整理报告30',owner,f.tasks.documents,'PROGRESS',{progress:30})
await writeFile(folder+'/related-facts.json',JSON.stringify(await workspace(),null,2))
console.log('PASS five related tasks: independently verified, pending, actual progress and not-started facts')
