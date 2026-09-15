// --capture saves the observed acceptance baseline; default only reads business data.
// Neither mode creates or repairs missing business facts.
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { folder, original, projectId, parentId, base, manager, owner, verifier, client, workspace, detail } from './task-fixture-client.mjs'

const f=JSON.parse(await readFile(folder+'/fixture.json','utf8'))
const before=JSON.parse(await readFile(folder+'/before.json','utf8'))
const files=JSON.parse(await readFile(folder+'/files.json','utf8'))
const current={workspace:await workspace(),tasks:{},reviewWorkspace:await workspace(verifier),sourceRequirement:await manager.get('/api/requirements/'+f.sourceRequirementId)}
for(const [key,id] of Object.entries(f.tasks))current.tasks[key]=await detail(id)
const source=current.tasks.source
assert.equal(source.task.id,f.sourceTaskId)
assert.equal(source.task.sourceRequirementId,f.sourceRequirementId)
assert.equal(source.task.status,'DONE')
assert.notEqual(source.submittedBy,source.verifiedBy)
assert.equal(source.history.filter(e=>e.action==='COMPLETE').length,2)
assert.equal(source.history.filter(e=>e.action==='RETURN').length,1)
assert.equal(source.history.filter(e=>e.action==='VERIFY').length,1)
const rounds=source.history.filter(e=>e.action==='COMPLETE').sort((a,b)=>a.at.localeCompare(b.at))
assert.equal(rounds[0].after.files.files[0].versionId,files['1'].versionId)
assert.equal(rounds[0].after.files.files[0].current,false)
assert.equal(rounds[1].after.files.files[0].versionId,files['2'].versionId)
assert.equal(source.files.files[0].versionId,files['2'].versionId)
const originalTask=await manager.get('/api/work-items/'+f.sourceTaskId)
assert.equal(originalTask.creationSource,'REQUIREMENT')
assert.equal(originalTask.taskWorkPackageId,parentId)
assert.equal(current.sourceRequirement.requirement.status,'IN_PROGRESS')
assert.equal(current.tasks.wiring.task.status,'DONE')
assert.equal(current.tasks.interlock.task.status,'PENDING_VERIFICATION')
assert.equal(current.tasks.points.task.progress,65)
assert.equal(current.tasks.documents.task.progress,30)
assert.equal(current.tasks.site.task.actualStartedOn,null)
assert.equal(current.tasks.mobile.task.status,'CANCELLED')
assert.ok(current.tasks.mobile.history.some(e=>e.action==='REOPEN'))
assert.equal(current.tasks.mobile.history.filter(e=>e.action==='CANCEL').length,2)
const active=current.workspace.tasks.filter(t=>t.status!=='CANCELLED')
assert.equal(active.length,6)
assert.equal(active.filter(t=>t.status==='DONE'&&!t.needsReview).length,2)
assert.equal(current.workspace.tasks.length,7)
const designated=current.reviewWorkspace.tasks.filter(t=>t.allowedActions.includes('VERIFY'))
assert.deepEqual(designated.map(t=>t.id),[f.tasks.interlock])
assert.equal((await workspace(owner)).tasks.filter(t=>t.allowedActions.includes('VERIFY')).length,0)
for(const key of ['outside','worker'])await (await client(key)).get(`${base}/tasks/${f.sourceTaskId}`,404)
assert.deepEqual(await manager.get(original.base),before.execution)
assert.deepEqual((await manager.get('/api/delivery-initiation/'+projectId)).objects,before.baseline.objects)
assert.deepEqual(await owner.get('/api/work-items/'+original.designWork),before.completedWork)
const parent=await owner.get('/api/work-items/'+parentId)
assert.equal(parent.status,'OPEN')
assert.equal(parent.version,before.parent.version)
assert.deepEqual(parent.history,before.parent.history)
assert.ok(!parent.allowedActions.includes('COMPLETE'))
const byteChecks=[]
for(const round of ['1','2']){
 const file=files[round],bytes=await manager.get(`/api/files/${file.documentId}/versions/${file.versionId}/download`)
 const sha256=createHash('sha256').update(bytes).digest('hex')
 assert.equal(sha256,file.sha256);assert.equal(bytes.toString(),file.content)
 byteChecks.push({round:Number(round),versionId:file.versionId,sizeBytes:bytes.length,sha256})
}
assert.equal((await readFile('.local-data/wi012-fresh20-before-tables.txt','utf8')).trim(),'0')
const databases=[]
for(const database of ['winh_workplan','winh_wi012_tasks_clean_20260913','winh_wi012_tasks_v20_fresh_20260913']){
 const result=execFileSync('.local-tools/postgresapp-2.9.6/Postgres.app/Contents/Versions/18/bin/psql',['-h','127.0.0.1','-p','54329','-U','winh','-d',database,'-Atc','SELECT count(*), bool_and(success), max(version::integer) FROM flyway_schema_history;'],{encoding:'utf8'}).trim()
 assert.equal(result,'20|t|20');databases.push({database,migrations:20,success:true})
}
for(const port of [8080,8082])assert.equal((await fetch(`http://127.0.0.1:${port}/actuator/health`).then(r=>r.json())).status,'UP')
if(process.argv.includes('--capture')){
 await writeFile(folder+'/final.json',JSON.stringify(current,null,2),{flag:'wx'})
 console.log('PASS capture seven real tasks, two result rounds, independent queue, unchanged source/baseline/execution and two original file byte streams')
}else{
 assert.deepEqual(current,JSON.parse(await readFile(folder+'/final.json','utf8')))
 await writeFile(folder+'/restart-readback.json',JSON.stringify({at:new Date().toISOString(),databases,byteChecks,checks:['all task and requirement facts equal after backend restart','six active tasks, two independently DONE, one pending, one separately cancelled','same original requirement/task identity, source requirement remains IN_PROGRESS','both result rounds, old file V1 and current V2 bytes retained','original V4 scope, stage/item/milestone execution and completed design work unchanged','parent completion unavailable while child work remains','outside and removed readers rejected','existing databases upgraded and zero-table database migrated through V20'],health:'8080 and 8082 UP'},null,2))
 console.log('PASS task restart readback, original files and identities, unchanged approved/execution facts, current roles, and zero-to-V20 PostgreSQL migration')
}
