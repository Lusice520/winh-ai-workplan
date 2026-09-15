// Stateful synthetic business scenario. Run once; commands retain actor-scoped retry identities.
import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
import {randomUUID,createHash} from 'node:crypto'
import {folder,fixture,base,finance,pmo,marketing,workspace,detail,once,act} from './income-fixture-client.mjs'
let records={};try{records=JSON.parse(await readFile(folder+'/records.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
const checkpoint=()=>writeFile(folder+'/records.json',JSON.stringify(records,null,2))
const pass=name=>console.log('PASS '+name)
let files={};try{files=JSON.parse(await readFile(folder+'/files.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
async function fileRound(round){
 if(!files[round]){const prior=round===2?await finance.get('/api/files/'+files[1].documentId):null;files[round]={path:prior?'/api/files/'+prior.document.id+'/versions':base+'/files',metadata:{requestId:randomUUID(),version:prior?.document.version,title:'验证·收入确认依据',kind:'OTHER',classification:'INTERNAL',changeNote:round===1?'验证·收入第一轮依据':'验证·按退回意见补齐金额与验收依据'},filename:'验证收入确认依据.txt',content:round===1?'验证·方案设计实际收入400000.00元。第一轮待补齐验收与收入来源说明。仅为本地合成数据。':'验证·方案设计实际收入400000.00元。已按独立确认人的退回意见补齐验收、实际日期和金额依据。保留第一轮原稿。仅为本地合成数据。'};await writeFile(folder+'/files.json',JSON.stringify(files,null,2))}
 const item=files[round],data=new FormData();data.append('metadata',new Blob([JSON.stringify(item.metadata)],{type:'application/json'}));data.append('file',new Blob([item.content]),item.filename)
 let doc=await pmo.request('POST',item.path,data,200,item.metadata.requestId),v=doc.versions.find(v=>v.versionNumber===round);assert.ok(v);item.documentId=doc.document.id;item.versionId=v.id;await writeFile(folder+'/files.json',JSON.stringify(files,null,2))
 const path='/api/files/'+doc.document.id+'/versions/'+v.id+'/transition';doc=await once('income-file-v'+round+'-submit',pmo,path,{version:v.version,decision:'IN_REVIEW',comment:'验证·收入原始资料独立发布'});v=doc.versions.find(v=>v.id===item.versionId)
 doc=await once('income-file-v'+round+'-publish',marketing,path,{version:v.version,decision:'PUBLISHED',comment:'验证·资料发布与收入确认分开办理'});assert.equal(doc.document.currentVersionId,item.versionId)
 const bytes=await finance.get('/api/files/'+item.documentId+'/versions/'+item.versionId+'/download');assert.equal(bytes.toString(),item.content);item.sha256=createHash('sha256').update(bytes).digest('hex');await writeFile(folder+'/files.json',JSON.stringify(files,null,2));return item
}
const line=(id,title,amount,date,extra={})=>({id,title,amount,plannedOn:date,sourceType:'PROJECT',source:null,sourceNote:'验证·按项目交付与经营安排制定计划',fileVersionIds:[],...extra})
if(!records.lineIds){records.lineIds=[randomUUID(),randomUUID(),randomUUID(),randomUUID()];await checkpoint()}
const [designLine,integrationLine,interfaceLine,siteLine]=records.lineIds
async function saveForecast(name,lines){const {book}=await workspace(),draft=book?.revisions.find(r=>r.id===book.draftRevisionId);return once(name,finance,base+'/income-forecasts',{period:'2026-09',currency:'CNY',bookVersion:book?.version??null,draftVersion:draft?.version??null,lines,reason:'验证·'+name})}
async function publish(name,book){const draft=book.revisions.find(r=>r.id===book.draftRevisionId);assert.ok(draft);return once(name,finance,base+'/income-forecasts/'+book.id+'/commands',{bookVersion:book.version,draftVersion:draft.version,action:'PUBLISH',reason:'验证·'+name})}
const v1=await publish('forecast-v1-publish',await saveForecast('forecast-v1-save',[line(designLine,'方案设计计划收入','400000.00','2026-09-05'),line(integrationLine,'采购与集成计划收入','600000.00','2026-09-10')]))
records.bookId=v1.id;records.forecastV1=v1.currentRevisionId;await checkpoint()
const file1=await fileRound(1)
function income(title,amount,date,extra={}){return {kind:'INCOME',title,amount,currency:'CNY',occurredOn:date,sourceNote:'验证·已发生的项目收入，有独立确认依据；不代表现金回款或开票',source:null,forecastRevisionId:null,forecastLineId:null,unplannedReason:'验证·按实际业务补记，并单独核对预测差异',originalIncomeId:null,confirmerId:fixture.people.verifier.id,fileVersionIds:[],reason:'验证·填报实际收入',...extra}}
async function create(key,body){const d=await once(key,pmo,base+'/incomes',body);records[key]=d.income.id;await checkpoint();return d.income.id}
async function confirm(key,id){await act(key+'-submit',pmo,id,'SUBMIT');await act(key+'-confirm',marketing,id,'CONFIRM')}
const old=await create('augustOriginal',income('验证·8月设备调试收入','50000.00','2026-08-20'));await confirm('august',old)
const design=await create('designIncome',income('验证·方案设计成果收入','400000.00','2026-09-05',{forecastRevisionId:records.forecastV1,forecastLineId:designLine,fileVersionIds:[file1.versionId]}))
await act('design-first-submit',pmo,design,'SUBMIT');assert.equal((await workspace()).totals.confirmedNet,'0');await act('design-return-for-evidence',marketing,design,'RETURN')
const file2=await fileRound(2),returned=(await detail(design)).income
await once('design-second-draft',pmo,base+'/incomes/'+design,{...income('验证·方案设计成果收入','400000.00','2026-09-05',{forecastRevisionId:records.forecastV1,forecastLineId:designLine,fileVersionIds:[file2.versionId]}),version:returned.version,sourceNote:'验证·已按退回意见补齐方案成果、验收日期和收入金额依据'},'PATCH')
await confirm('design-second',design)
const rounds=(await detail(design)).history.filter(e=>e.action==='SUBMIT');assert.equal(rounds.length,2);assert.equal(rounds[0].after.files.files[0].versionId,file1.versionId);assert.equal(rounds[1].after.files.files[0].versionId,file2.versionId)
pass('two real PMO→marketing rounds retain both original file versions; publication alone created no confirmed income')
const integration=await create('integrationIncome',income('验证·采购集成阶段收入','500000.00','2026-09-10',{forecastRevisionId:records.forecastV1,forecastLineId:integrationLine,fileVersionIds:[file2.versionId]}));await confirm('integration',integration)
const reversal=await create('augustReversal',income('验证·原设备调试收入冲销',null,'2026-09-11',{kind:'REVERSAL',originalIncomeId:old,fileVersionIds:[file2.versionId],sourceNote:'验证·按复核结果整笔冲销8月误记设备调试收入'}));await confirm('reversal',reversal)
const pending=await create('interfaceIncome',income('验证·设备接口确认收入','100000.00','2026-09-11',{forecastRevisionId:records.forecastV1,forecastLineId:integrationLine,fileVersionIds:[file2.versionId]}));await act('interface-submit',pmo,pending,'SUBMIT')
const site=await create('siteIncome',income('验证·现场准备收入','50000.00','2026-09-12',{fileVersionIds:[file2.versionId]}));await act('site-submit',pmo,site,'SUBMIT')
const extra=await create('returnedService',income('验证·补充技术服务收入','120000.00','2026-09-12'));await act('service-submit',pmo,extra,'SUBMIT');await act('service-return',marketing,extra,'RETURN')
let book=await saveForecast('forecast-v2-save',[line(designLine,'方案设计计划收入','450000.00','2026-09-05'),line(integrationLine,'采购与集成计划收入','600000.00','2026-09-10'),line(interfaceLine,'设备接口计划收入','50000.00','2026-09-20',{incomeReference:{id:pending,version:(await detail(pending)).income.version}})])
assert.equal((await workspace()).totals.planned,'1000000.00');book=await publish('forecast-v2-publish',book)
book=await saveForecast('forecast-v3-save',[line(designLine,'方案设计计划收入','450000.00','2026-09-05'),line(integrationLine,'采购与集成计划收入','600000.00','2026-09-10'),line(interfaceLine,'设备接口计划收入','100000.00','2026-09-20',{incomeReference:{id:pending,version:(await detail(pending)).income.version}}),line(siteLine,'现场准备计划收入','50000.00','2026-09-22',{incomeReference:{id:site,version:(await detail(site)).income.version}})])
assert.equal((await workspace()).totals.planned,'1100000.00');book=await publish('forecast-v3-publish',book)
const final=await workspace();assert.equal(final.totals.planned,'1200000.00');assert.equal(final.totals.confirmedNet,'850000.00');assert.equal(final.totals.pendingIncome,'150000.00');assert.equal(final.totals.pendingReversal,'0');assert.equal(final.incomes.length,6);assert.equal(final.book.revisions.length,3)
assert.equal((await workspace(finance,'2026-08')).totals.confirmedNet,'50000.00');assert.equal((await detail(old)).income.reversed,true)
await writeFile(folder+'/cny-business-flow.json',JSON.stringify({at:new Date().toISOString(),workspace:final,designDetail:await detail(design)},null,2),{flag:'wx'})
pass('published forecasts V1/V2/V3 and six real September rows: planned1200000 / confirmedNet850000 / pending150000, August original retained')
