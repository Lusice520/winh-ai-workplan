// Read-only and repeatable: verify persisted facts after a restart, never manufacture missing data.
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { f, folder, manager, owner, verifier, client, workspace, item } from './execution-fixture-actions.mjs'

const final = JSON.parse(await readFile(folder + '/final-workspace.json', 'utf8'))
const equipment = JSON.parse(await readFile(folder + '/final-equipment.json', 'utf8'))
assert.deepEqual(await workspace(), final)
assert.deepEqual(await item(f.equipmentItem), equipment)
assert.deepEqual(await manager.get(f.base + '/history/' + f.designMilestone), JSON.parse(await readFile(folder + '/milestone-history.json', 'utf8')))
assert.deepEqual(equipment.item.totals, { received: 8, installed: 4, accepted: 2, pending: 1, needsReview: 0 })
const queue = (await verifier.get(f.base)).reviewQueue
assert.equal(queue.length, 1)
assert.equal(queue[0].quantity, 1)
assert.equal((await owner.get(f.base)).reviewQueue.length, 0)
for (const key of ['outside', 'worker']) await (await client(key)).get(f.base, 404)
const before = JSON.parse(await readFile(folder + '/before.json', 'utf8'))
assert.deepEqual((await manager.get('/api/delivery-initiation/' + f.projectId)).objects, before.baseline.objects)
assert.deepEqual(await owner.get('/api/work-items/' + f.designWork), before.completedWork)
assert.equal((await readFile('.local-data/wi011-clean-empty-count.log', 'utf8')).trim(), '0')
const databases = []
for (const database of ['winh_workplan', 'winh_wi011_execution_clean_20260913']) {
  const value = execFileSync('.local-tools/postgresapp-2.9.6/Postgres.app/Contents/Versions/18/bin/psql', ['-h', '127.0.0.1', '-p', '54329', '-U', 'winh', '-d', database, '-Atc', 'select count(*),bool_and(success),max(version::integer) from flyway_schema_history;'], { encoding: 'utf8' }).trim()
  assert.equal(value, '18|t|18')
  databases.push({ database, migrations: 18, success: true })
}
for (const port of [8080, 8082]) assert.equal((await fetch(`http://127.0.0.1:${port}/actuator/health`).then(r => r.json())).status, 'UP')
await writeFile(folder + '/restart-readback.json', JSON.stringify({ at: new Date().toISOString(), databases, health: 'both UP', checks: [
  'all execution workspace and item facts byte-for-byte equal after restart', 'both milestone rounds and exact file references retained',
  'verified totals 8 received / 4 installed / 2 accepted / 1 pending', 'designated remaining queue only',
  'outside and removed members still rejected', 'original approved scope and completed work unchanged',
  'clean database started at zero public tables and migrated through V18',
] }, null, 2))
console.log('PASS restart persistence, original scope, current permissions and zero-to-V18 clean migration')
