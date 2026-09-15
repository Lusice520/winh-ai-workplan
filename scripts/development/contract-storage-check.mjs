// Tests the existing synthetic WI-009 fixture only. Does not expose session cookies.
import assert from 'node:assert/strict'
import { readFile,writeFile,mkdir } from 'node:fs/promises'
import { randomUUID,createHash } from 'node:crypto'
const fixture=JSON.parse(await readFile('outputs/verification/wi-009/fixture.json','utf8'))
const session=JSON.parse(await readFile('.local-data/wi009-sales-session.json','utf8'))
const cookies=new Map(session.cookies.map(c=>[c.name,c.value]))
const origin='http://127.0.0.1:8080',root=`/api/projects/${fixture.projectId}/files`
async function request(method,path,body,status=200){
 const csrf=method==='GET'?null:(await request('GET','/api/auth/csrf')).token
 const response=await fetch(origin+path,{method,headers:{Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),...(csrf?{'X-XSRF-TOKEN':csrf}:{})},body})
 for(const h of response.headers.getSetCookie()){const p=h.split(';')[0],i=p.indexOf('=');cookies.set(p.slice(0,i),p.slice(i+1))}
 const data=response.headers.get('content-type')?.includes('application/json')?await response.json():Buffer.from(await response.arrayBuffer())
 assert.equal(response.status,status,`${method} ${path}: ${response.status} ${data?.code??''} ${data?.message??''}`)
 return data
}
function body(content,filename='验证文件.txt',id=randomUUID()){
 const data=new FormData();data.append('metadata',new Blob([JSON.stringify({requestId:id,title:'验证·上传边界',kind:'CONTRACT',classification:'CONTRACT',changeNote:'真实上传失败恢复与边界验证'})],{type:'application/json'}));data.append('file',new Blob([content]),filename);return data
}
const results=[]
if(process.env.WI009_STORAGE_OFFLINE==='true'){
 const before=await request('GET',root)
 await request('POST',root,body('文件服务离线时不应产生可用资料记录'),503)
 assert.equal((await request('GET',root)).items.length,before.items.length)
 results.push('文件服务离线返回明确 503，未新增资料元数据')
}else{
 await request('POST',root,body(''),400)
 await request('POST',root,body('拒绝路径文件名','../../path.txt'),400)
 await request('POST',root,body(new Uint8Array(21*1048576),'超限文件.bin'),413)
 results.push('空文件、路径文件名、超过上限文件均拒绝')
 const key=randomUUID(), first=await request('POST',root,body('幂等内容 A','同名文件.txt',key))
 await request('POST',root,body('幂等内容 B','同名文件.txt',key),409)
 results.push('同一上传意图的二进制变化不会覆盖已保存文件')
 const original=await request('GET',`/api/files/${fixture.documentId}/versions/${fixture.originalFileVersionId}/download`)
 const detail=await request('GET',`/api/files/${fixture.documentId}`)
 assert.equal(createHash('sha256').update(original).digest('hex'),detail.versions.find(v=>v.id===fixture.originalFileVersionId).sha256)
 const doc=(await request('GET',root)).items.find(d=>d.title==='验证·浏览器签署技术附件')
 assert.ok(doc?.currentVersionId)
 const browserFile=await request('GET',`/api/files/${doc.id}/versions/${doc.currentVersionId}/download`)
 assert.deepEqual(browserFile,await readFile('.local-data/wi009-browser-file.txt'))
 results.push('文件服务重启后，原签署件与浏览器上传附件仍可按原校验读取')
 assert.equal((await request('GET',`/api/contracts/${fixture.contractId}`)).contract.archiveStatus,'ARCHIVED')
 results.push('服务恢复后合同归档事实与引用保留')
}
await mkdir('outputs/verification/wi-009',{recursive:true})
const mode=process.env.WI009_STORAGE_OFFLINE==='true'?'offline':'recovery'
await writeFile(`outputs/verification/wi-009/storage-${mode}.json`,JSON.stringify({timestamp:new Date().toISOString(),checks:results},null,2))
for(const result of results)console.log('PASS '+result)
