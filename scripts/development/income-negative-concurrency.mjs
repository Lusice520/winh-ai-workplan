// Real PostgreSQL races and rejected commands, scoped to synthetic income records.
import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {storedClient} from './local-business-client.mjs'
import {folder,fixture,base,finance,pmo,marketing,reviewer,workspace,detail,once,act} from './income-fixture-client.mjs'
const records=JSON.parse(await readFile(folder+'/records.json','utf8')),files=JSON.parse(await readFile(folder+'/files.json','utf8')),results={at:new Date().toISOString(),checks:[]}
const pass=name=>{results.checks.push(name);console.log('PASS '+name)}
const body=(changes={})=>({kind:'INCOME',title:'验证·负向测试',amount:'1.00',currency:'CNY',occurredOn:'2026-09-13',sourceNote:'验证·明确收入依据',source:null,forecastRevisionId:null,forecastLineId:null,unplannedReason:'验证·补录依据',originalIncomeId:null,confirmerId:fixture.people.verifier.id,fileVersionIds:[],reason:'验证·拒绝不合规收入命令',...changes})
const before=await workspace()
for(const changes of [{amount:'0'},{amount:'1.001'},{amount:'1000000000000.00'},{currency:'XXX'},{occurredOn:'2026-09-14'},{confirmerId:fixture.people.successor.id}])await pmo.post(base+'/incomes',body(changes),400)
await pmo.post(base+'/incomes',body({currency:'USD',forecastRevisionId:records.forecastV1,forecastLineId:records.lineIds[0]}),400)
await pmo.post(base+'/incomes',body({kind:'REVERSAL',originalIncomeId:records.augustOriginal,currency:'USD',amount:null}),400)
await pmo.post(base+'/incomes',body({fileVersionIds:[files[1].versionId]}),409)
await pmo.post(base+'/incomes',body({fileVersionIds:[randomUUID()]}),404)
await marketing.post(base+'/incomes',body(),403)
const pending=(await detail(records.interfaceIncome)).income
await pmo.post(base+'/incomes/'+pending.id+'/commands',{version:pending.version,action:'CONFIRM',reason:'验证·提交人不能自验'},403)
await reviewer.post(base+'/incomes/'+pending.id+'/commands',{version:pending.version,action:'CONFIRM',reason:'验证·非指定营销人员不能确认'},409)
await pmo.patch(base+'/incomes/'+records.designIncome,{...body(),version:(await detail(records.designIncome)).income.version},409)
for(const key of ['outside','worker']){const api=await storedClient('http://127.0.0.1:8080',`.local-data/wi010-dg2-${key}-session.json`);await api.get(base+'/income-workspace?period=2026-09&currency=CNY',404);await api.get(base+'/incomes/'+records.designIncome,404)}
assert.deepEqual(await workspace(),before);pass('invalid amounts/currency/future dates, mixed references, stale/missing files, own/non-designated reviews and outside/removed readers reject without changed CNY facts')
async function create(key,value){const d=await once(key,pmo,base+'/incomes',value);records[key]=d.income.id;await writeFile(folder+'/records.json',JSON.stringify(records,null,2));return d.income.id}
async function confirm(key,id){await act(key+'-submit',pmo,id,'SUBMIT');await act(key+'-confirm',marketing,id,'CONFIRM')}
const original=await create('usdOriginal',body({title:'验证·8月美元收入',currency:'USD',amount:'75.25',occurredOn:'2026-08-10'}));await confirm('usd-original',original)
const first=await create('usdReversalA',body({kind:'REVERSAL',title:'验证·美元冲销申请A',currency:'USD',amount:null,originalIncomeId:original})),second=await create('usdReversalB',body({kind:'REVERSAL',title:'验证·美元冲销申请B',currency:'USD',amount:null,originalIncomeId:original}));await act('usd-reversal-a-submit',pmo,first,'SUBMIT');await act('usd-reversal-b-submit',pmo,second,'SUBMIT')
const inputs=await Promise.all([first,second].map(async id=>({id,body:{version:(await detail(id)).income.version,action:'CONFIRM',reason:'验证·并发整笔冲销防重'}})))
const races=await Promise.all(inputs.map(async input=>{try{const response=await marketing.post(base+'/incomes/'+input.id+'/commands',input.body);return {id:input.id,status:200,income:response.income}}catch(e){assert.match(e.message,/: 409 /);return {id:input.id,status:409}}}))
assert.deepEqual(races.map(r=>r.status).sort(),[200,409]);const loser=races.find(r=>r.status===409).id,winner=races.find(r=>r.status===200).id;records.usdReversalWinner=winner;records.usdReversalLoser=loser;await writeFile(folder+'/records.json',JSON.stringify(records,null,2));results.reversalRace=races
await act('usd-losing-reversal-withdraw',pmo,loser,'WITHDRAW');await act('usd-losing-reversal-cancel',pmo,loser,'CANCEL')
const positive=await create('usdIncome',body({title:'验证·美元本月收入',currency:'USD',amount:'100.00'}));await confirm('usd-positive',positive)
assert.equal((await workspace(finance,'2026-09','USD')).totals.confirmedNet,'24.75');assert.equal((await workspace(finance,'2026-08','USD')).totals.confirmedNet,'75.25');assert.deepEqual(await workspace(),before)
pass('two real concurrent reversal confirmations produced exactly one 200 and one 409; original month intact, USD net24.75 never mixed into CNY850000')
const planLineId=randomUUID(),plan=(amount)=>({id:planLineId,title:'验证·美元预测',amount,plannedOn:'2026-09-20',sourceType:'PROJECT',source:null,sourceNote:'验证·单独币种预测',fileVersionIds:[]})
let book=await once('usd-forecast-create',finance,base+'/income-forecasts',{period:'2026-09',currency:'USD',bookVersion:null,draftVersion:null,lines:[plan('100.01')],reason:'验证·美元独立预测'})
const draft=book.revisions.find(r=>r.id===book.draftRevisionId),saveBodies=['200.01','300.01'].map(amount=>({period:'2026-09',currency:'USD',bookVersion:book.version,draftVersion:draft.version,lines:[plan(amount)],reason:'验证·并发修订'+amount}))
const forecastRace=await Promise.all(saveBodies.map(async body=>{try{return {status:200,book:await finance.post(base+'/income-forecasts',body)}}catch(e){assert.match(e.message,/: 409 /);return {status:409}}}));assert.deepEqual(forecastRace.map(r=>r.status).sort(),[200,409]);book=forecastRace.find(r=>r.status===200).book;results.forecastRace=forecastRace.map(r=>({status:r.status,total:r.book?.revisions[0].total}))
let d=book.revisions.find(r=>r.id===book.draftRevisionId);const published=await once('usd-forecast-publish',finance,base+'/income-forecasts/'+book.id+'/commands',{bookVersion:book.version,draftVersion:d.version,action:'PUBLISH',reason:'验证·并发后核对并发布唯一有效版'})
book=await once('usd-discard-draft-create',finance,base+'/income-forecasts',{period:'2026-09',currency:'USD',bookVersion:published.version,draftVersion:null,lines:[plan('400.00')],reason:'验证·临时修订后放弃'});d=book.revisions.find(r=>r.id===book.draftRevisionId)
await once('usd-discard-draft',finance,base+'/income-forecasts/'+book.id+'/commands',{bookVersion:book.version,draftVersion:d.version,action:'DISCARD',reason:'验证·放弃草案，旧发布版继续有效'})
const after=await workspace(finance,'2026-09','USD');assert.equal(after.book.currentRevisionId,published.currentRevisionId);assert.equal(after.book.draftRevisionId,null);assert.equal(after.totals.planned,published.revisions[0].total);assert.deepEqual(await workspace(),before)
pass('concurrent forecast saves preserve one winner; draft discard keeps the published version and CNY ledger unchanged')
results.cnyTotals=(await workspace()).totals;results.usdWorkspace=after
await writeFile(folder+'/negative-concurrency.json',JSON.stringify(results,null,2),{flag:'wx'})
