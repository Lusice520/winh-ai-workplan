// Formal existing project handoff; only the newly created USD income responsibility may move.
import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
import {folder,fixture,projectId,base,finance,pmo,marketing,reviewer,workspace,detail,once,act} from './income-fixture-client.mjs'
const records=JSON.parse(await readFile(folder+'/records.json','utf8')),before=await workspace()
let row=await once('handoff-income-create',pmo,base+'/incomes',{kind:'INCOME',title:'验证·美元收入责任交接',amount:'20.25',currency:'USD',occurredOn:'2026-09-13',sourceNote:'验证·只交接本条新收入的待确认职责，不转移原交付或任务',source:null,forecastRevisionId:null,forecastLineId:null,unplannedReason:'验证·按实际发生补记收入',originalIncomeId:null,confirmerId:fixture.people.reviewer.id,fileVersionIds:[],reason:'验证·建立独立收入交接场景'})
const id=row.income.id;records.handoffIncome=id;await writeFile(folder+'/records.json',JSON.stringify(records,null,2));await act('handoff-income-submit',pmo,id,'SUBMIT')
const project=await finance.get(base),fromId=fixture.people.reviewer.id,toId=fixture.people.verifier.id
const denied=await finance.post(base+'/members',{version:project.project.version,accountId:fromId,roleCodes:[],active:false,reason:'验证·不能移除尚有待确认收入的成员'},409);assert.match(denied.message,/收入/)
const path='/api/delivery-initiation/'+projectId+'/responsibility-transfers'
const preview=await finance.get(path+'/preview?fromId='+fromId+'&toId='+toId)
assert.equal(preview.mapping.objects.length,0);assert.equal(preview.mapping.resources.length,0);assert.equal(preview.mapping.findings.length,0);assert.equal(preview.mapping.related.length,1);assert.equal(preview.mapping.related[0].domain,'INCOME');assert.equal(preview.mapping.related[0].objectId,id)
assert.deepEqual(preview.mapping.beforeHeader,preview.mapping.afterHeader)
const dg2=await finance.get('/api/delivery-initiation/'+projectId)
let transfer=await once('income-transfer-create',finance,path,{version:dg2.preparation.version,fromId,toId,mappingHash:preview.hash,fromRoles:preview.mapping.from.roleCodes,toRoles:preview.mapping.to.roleCodes,basis:'验证·由当前营销确认人交接此条待确认收入，保留原提交人，不改既有交付范围与任务'})
assert.equal(transfer.mapping.related[0].title,'验证·美元收入责任交接')
transfer=await once('income-transfer-accept',marketing,path+'/'+transfer.id+'/decision',{version:transfer.version,action:'ACCEPT',note:'验证·接任者核对原收入与未结确认职责后接收'})
transfer=await once('income-transfer-apply',finance,path+'/'+transfer.id+'/decision',{version:transfer.version,action:'APPLY',note:'验证·正式生效本条收入责任，原提交事实保持不变'})
row=await detail(id);assert.equal(row.income.submittedBy,fixture.people.successor.id);assert.equal(row.income.confirmerId,toId);assert.equal(row.income.status,'SUBMITTED')
await reviewer.post(base+'/incomes/'+id+'/commands',{version:row.income.version,action:'CONFIRM',reason:'验证·原指定人交接后不能再确认'},409)
await act('handoff-income-confirm',marketing,id,'CONFIRM');row=await detail(id);assert.equal(row.income.confirmedBy,toId);assert.ok(row.history.some(e=>e.action==='RESPONSIBILITY_TRANSFER'))
assert.deepEqual(await workspace(),before);assert.equal((await workspace(finance,'2026-09','USD')).totals.confirmedNet,'45.00')
await writeFile(folder+'/handoff.json',JSON.stringify({at:new Date().toISOString(),preview,transfer,income:row,blockedRemoval:denied.code,checks:['only one new income responsibility moved','existing scope/header/resources/findings unchanged','recipient acceptance precedes apply','old submitter preserved, former reviewer cannot confirm','current member removal blocked while income awaits confirmation','CNY forecast and actual facts unchanged']},null,2),{flag:'wx'})
console.log('PASS formal income-only handoff with independent recipient acceptance and unchanged original project work')
