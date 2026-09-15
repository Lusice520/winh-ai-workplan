// Independent private-storage publication for the two task-result rounds. Synthetic text only.
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { folder, owner, manager, verifier, base, once, detail } from './task-fixture-client.mjs'

const round=Number(process.argv[2]);assert.ok([1,2].includes(round))
const f=JSON.parse(await readFile(folder+'/fixture.json','utf8'))
let record={}
try{record=JSON.parse(await readFile(folder+'/files.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
if(round===2){assert.ok(record['1']);const task=await detail(f.sourceTaskId);assert.equal(task.task.status,'OPEN');assert.ok(task.history.some(e=>e.action==='RETURN'))}
if(!record[round]){
  const prior=round===2?await manager.get('/api/files/'+record['1'].documentId):null
  record[round]={path:prior?`/api/files/${prior.document.id}/versions`:base+'/files',metadata:{requestId:randomUUID(),version:prior?.document.version,title:'验证·设备接口核对报告',kind:'OTHER',classification:'INTERNAL',changeNote:round===1?'验证·第一轮接口核对结果':'验证·按任务退回要求补齐异常点位和逐项确认'},filename:'验证设备接口核对报告.txt',content:round===1?'验证·第一轮接口核对报告\n已核对原八套设备的接口与点表，异常点位的逐项确认需要补充。\n仅用于本地合成流程验证。':'验证·第二轮接口核对报告\n原八套设备接口与点表逐项核对，异常点位的确认记录已补齐，保留第一轮原稿。\n仅用于本地合成流程验证。'}
  await writeFile(folder+'/files.json',JSON.stringify(record,null,2))
}
const intent=record[round],data=new FormData()
data.append('metadata',new Blob([JSON.stringify(intent.metadata)],{type:'application/json'}));data.append('file',new Blob([intent.content]),intent.filename)
let doc=await owner.request('POST',intent.path,data,200,intent.metadata.requestId)
let v=doc.versions.find(v=>v.versionNumber===round);assert.ok(v)
intent.documentId=doc.document.id;intent.versionId=v.id
await writeFile(folder+'/files.json',JSON.stringify(record,null,2))
const path=`/api/files/${doc.document.id}/versions/${v.id}/transition`
doc=await once(`file-v${round}-submit`,owner,path,{version:v.version,decision:'IN_REVIEW',comment:`验证·第 ${round} 轮成果资料提交独立发布`})
v=doc.versions.find(v=>v.id===intent.versionId)
doc=await once(`file-v${round}-publish`,verifier,path,{version:v.version,decision:'PUBLISHED',comment:`验证·独立核对第 ${round} 轮资料并发布；任务完成仍另行核验`})
assert.equal(doc.document.currentVersionId,intent.versionId)
const bytes=await manager.get(`/api/files/${doc.document.id}/versions/${intent.versionId}/download`)
assert.equal(bytes.toString(),intent.content)
intent.sha256=createHash('sha256').update(bytes).digest('hex');intent.sizeBytes=bytes.length
await writeFile(folder+'/files.json',JSON.stringify(record,null,2));await writeFile(folder+`/published-file-v${round}.json`,JSON.stringify(doc,null,2))
console.log(`PASS task file V${round}: independent publication and exact private-storage bytes`)
