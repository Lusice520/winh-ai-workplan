import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {storedClient} from './local-business-client.mjs'
export const folder='outputs/verification/wi-013-income'
export const fixture=JSON.parse(await readFile(folder+'/fixture.json','utf8'))
export const projectId=fixture.projectId,base='/api/projects/'+projectId,period='2026-09',currency='CNY'
export const actor=key=>storedClient('http://127.0.0.1:8080',fixture.people[key].stateFile)
export const finance=await actor('manager'),pmo=await actor('successor'),marketing=await actor('verifier'),reviewer=await actor('reviewer')
export const workspace=(api=finance,month=period,money=currency)=>api.get(base+'/income-workspace?period='+month+'&currency='+money)
export const detail=(id,api=finance)=>api.get(base+'/incomes/'+id)
let journal={};try{journal=JSON.parse(await readFile(folder+'/commands.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
export async function once(key,api,path,body,method='POST'){
 if(!journal[key]){journal[key]={path,body,method,requestId:randomUUID()};await writeFile(folder+'/commands.json',JSON.stringify(journal,null,2))}
 const saved=journal[key];assert.equal(saved.path,path);assert.equal(saved.method,method)
 return (method==='PATCH'?api.patch:api.post)(path,saved.body,200,saved.requestId)
}
export async function act(key,api,id,action){const {income}=await detail(id);return once(key,api,base+'/incomes/'+id+'/commands',{version:income.version,action,reason:'验证·'+key})}
