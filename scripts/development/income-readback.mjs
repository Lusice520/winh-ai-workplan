// --capture records an observed baseline; default compares it after service restart.
// Both modes only read business data. They never create or repair missing facts.
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { folder, fixture, projectId, base, finance, pmo, workspace, detail } from './income-fixture-client.mjs'
import { storedClient } from './local-business-client.mjs'
const read = async path => JSON.parse(await readFile(path, 'utf8'))
const records = await read(folder + '/records.json')
const browser = await read(folder + '/browser-eur.json')
const beforeTasks = await read(folder + '/before-task-facts.json')
const oldFixture = await read('outputs/verification/wi-012-tasks/fixture.json')
const oldBefore = await read('outputs/verification/wi-012-tasks/before.json')
const oldFinal = await read('outputs/verification/wi-012-tasks/final.json')
const executionFixture = await read('outputs/verification/wi-011-execution/fixture.json')
const sql = (query, database = 'winh_workplan') => execFileSync('.local-tools/postgresapp-2.9.6/Postgres.app/Contents/Versions/18/bin/psql', ['-h','127.0.0.1','-p','54329','-U','winh','-d',database,'-Atc',query], {encoding:'utf8'}).trim()
const current = { windows: {}, incomes: {}, forecastHistory: {} }
for (const [month, currency] of [['2026-09','CNY'],['2026-08','CNY'],['2026-09','USD'],['2026-08','USD'],['2026-09','EUR']]) {
  const key = month + '/' + currency, data = await workspace(finance, month, currency)
  current.windows[key] = data
  for (const row of data.incomes) current.incomes[row.id] = await detail(row.id)
  if (data.book) current.forecastHistory[data.book.id] = await finance.get(base + '/income-forecasts/' + data.book.id + '/history')
}
const cny = current.windows['2026-09/CNY'], usd = current.windows['2026-09/USD'], eur = current.windows['2026-09/EUR']
assert.equal(cny.totals.planned, '1200000.00')
assert.equal(cny.totals.confirmedNet, '850000.00')
assert.equal(cny.totals.pendingIncome, '150000.00')
assert.equal(cny.totals.count, 6)
assert.equal(current.windows['2026-08/CNY'].totals.confirmedNet, '50000.00')
assert.equal(current.windows['2026-08/USD'].totals.confirmedNet, '75.25')
assert.equal(usd.totals.confirmedNet, '45.00')
assert.equal(eur.totals.planned, '100.01')
assert.equal(eur.totals.confirmedNet, '123.45')
assert.equal(eur.book.draftRevisionId, null)
assert.equal(eur.book.revisions.find(r => r.number === 2).status, 'DISCARDED')
const incomeFiles = await read(folder + '/files.json'), design = current.incomes[records.designIncome]
const rounds = design.history.filter(h => h.action === 'SUBMIT')
assert.equal(rounds.length, 2)
assert.equal(rounds[0].after.files.files[0].versionId, incomeFiles['1'].versionId)
assert.equal(rounds[0].after.files.files[0].current, false)
assert.equal(rounds[1].after.files.files[0].versionId, incomeFiles['2'].versionId)
assert.equal(design.income.files.files[0].versionId, incomeFiles['2'].versionId)
for (const id of [records.designIncome, browser.id]) {
  const d = current.incomes[id]
  assert.equal(d.income.status, 'CONFIRMED')
  assert.notEqual(d.income.submittedBy, d.income.confirmedBy)
  assert.equal(d.history.filter(h => h.action === 'SUBMIT').length, 2)
  assert.equal(d.history.filter(h => h.action === 'RETURN').length, 1)
}
const handoff = current.incomes[records.handoffIncome]
assert.equal(handoff.income.submittedBy, fixture.people.successor.id)
assert.equal(handoff.income.confirmerId, fixture.people.verifier.id)
assert.ok(handoff.history.some(h => h.action === 'RESPONSIBILITY_TRANSFER'))
assert.equal(usd.incomes.filter(i => i.kind === 'REVERSAL' && i.status === 'CONFIRMED').length, 1)
for (const who of ['outside','worker']) await (await storedClient('http://127.0.0.1:8080', executionFixture.people[who].stateFile)).get(base + '/incomes/' + records.designIncome, 404)
const rawTasks = JSON.parse(sql(`SELECT jsonb_build_object('tasks', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM project_work_item t WHERE project_id='${projectId}'), 'taskProfiles', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM delivery_task_profile t WHERE project_id='${projectId}'));`))
assert.deepEqual(rawTasks.tasks, beforeTasks.tasks)
assert.deepEqual(rawTasks.taskProfiles, beforeTasks.taskProfiles)
assert.deepEqual(await finance.get(executionFixture.base), oldBefore.execution)
assert.deepEqual((await finance.get('/api/delivery-initiation/' + projectId)).objects, oldBefore.baseline.objects)
assert.deepEqual(await pmo.get('/api/work-items/' + executionFixture.designWork), oldBefore.completedWork)
assert.deepEqual(await finance.get(base + '/tasks/' + oldFixture.sourceTaskId), oldFinal.tasks.source)
const sourceRequirement = await finance.get('/api/requirements/' + oldFixture.sourceRequirementId)
assert.equal(sourceRequirement.requirement.status, 'IN_PROGRESS')
const byteChecks = []
for (const [domain, files] of [['income', incomeFiles], ['tasks', await read('outputs/verification/wi-012-tasks/files.json')]]) {
  for (const round of ['1','2']) {
    const file = files[round], bytes = await finance.get(`/api/files/${file.documentId}/versions/${file.versionId}/download`)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    assert.equal(sha256, file.sha256); assert.equal(bytes.toString(), file.content)
    byteChecks.push({domain,round:Number(round),versionId:file.versionId,sizeBytes:bytes.length,sha256})
  }
}
assert.equal((await readFile('.local-data/wi013-fresh-before-tables.txt','utf8')).trim(), '0')
const databases = []
for (const database of ['winh_workplan','winh_wi013_income_v21_fresh_20260913']) {
  assert.equal(sql('SELECT count(*), bool_and(success), max(version::integer) FROM flyway_schema_history;', database), '21|t|21')
  databases.push({database,migrations:21,success:true})
}
for (const port of [8080,8082]) assert.equal((await fetch(`http://127.0.0.1:${port}/actuator/health`).then(r=>r.json())).status,'UP')
if (process.argv.includes('--capture')) {
  await writeFile(folder + '/final.json', JSON.stringify(current,null,2), {flag:'wx'})
  await writeFile(folder + '/capture-checks.json', JSON.stringify({at:new Date().toISOString(),databases,byteChecks,oldTasksUnchanged:rawTasks.tasks.length,oldTaskProfilesUnchanged:rawTasks.taskProfiles.length},null,2))
  console.log('PASS income baseline captured: exact currency/month totals, two independent rounds, old file versions, unchanged task/execution/scope facts')
} else {
  assert.deepEqual(current, await read(folder + '/final.json'))
  await writeFile(folder + '/restart-readback.json', JSON.stringify({at:new Date().toISOString(),databases,byteChecks,oldTasksUnchanged:rawTasks.tasks.length,oldTaskProfilesUnchanged:rawTasks.taskProfiles.length,checks:['all income/forecast/history JSON unchanged after backend and object-store restart','CNY 1200000.00 planned / 850000.00 confirmed / 150000.00 pending; original August income retained','USD 45.00 and EUR 123.45 confirmed without mixed-currency aggregation','independent two-round confirmation, full reversal uniqueness and formal responsibility handoff retained','old income and task file V1/V2 byte hashes equal','11 original work items, 7 task profiles, original execution, approved scope and source requirement unchanged','outside and removed readers rejected; V20-to-V21 and zero-to-V21 migrations successful'],health:'8080 and 8082 UP'},null,2))
  console.log('PASS income restart readback: five monthly currency windows, every income/history, four original file byte streams, original task/execution facts and V21 migration')
}
