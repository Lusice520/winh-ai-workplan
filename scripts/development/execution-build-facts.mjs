import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { f, folder, manager, owner, workspace, item, stage, profile, fact, today } from './execution-fixture-actions.mjs'

const w = await workspace()
assert.equal(w.stages.find(s => s.id === f.designStage).status, 'IN_PROGRESS', 'Start the design stage in the browser first.')
await stage('start-integration', f.integrationStage, 'START', '验证·启动采购集成阶段，按批准的八套设备范围登记执行。')
await profile('design-profile', f.designItem, false)
await profile('equipment-profile', f.equipmentItem, true)
const file = (await manager.get('/api/projects/' + f.projectId + '/files')).items.find(d => d.classification === 'INTERNAL' && d.latestVersion.status === 'PUBLISHED').currentVersionId
await fact('design-acceptance', f.designItem, 'ACCEPTED', 1, '验证·控制与接口成果已齐备，按项目已发布的交付范围提交独立验收。', [file])
await fact('equipment-first-arrival', f.equipmentItem, 'RECEIVED', 6, '验证·第一批六套控制设备到货，型号、装箱与外观已经逐台核对。')
await fact('equipment-installation', f.equipmentItem, 'INSTALLED', 4, '验证·首批四套完成接线、安装与现场联调，记录待独立核验。')
await stage('integration-progress', f.integrationStage, 'PROGRESS', '验证·八套设备中六套到货、四套安装；报告进度依据现场任务完成情况。', 55)
const d = await item(f.equipmentItem), eventsBefore = d.events.length
const payload = { version: d.item.profile.version, objectVersion: d.object.version, kind: 'INSTALLED', quantity: 2, occurredOn: '2026-09-12', evidence: '验证·不能把安装日期补到阶段开始之前', fileVersionIds: [], verifierId: null }
await owner.post(f.base + '/items/' + f.equipmentItem + '/events', payload, 400)
await owner.post(f.base + '/items/' + f.equipmentItem + '/events', { ...payload, kind: 'ACCEPTED', quantity: 5, occurredOn: today, verifierId: f.people.verifier.id }, 409)
assert.equal((await item(f.equipmentItem)).events.length, eventsBefore)
await writeFile(folder + '/facts-prepared.json', JSON.stringify({ at: new Date().toISOString(), fileVersionId: file, checks: ['prior-day date rejected', 'acceptance above installation rejected', 'failed facts do not append history'] }, null, 2))
console.log('PASS facts prepared for browser submission: 6 received, 4 installed, no equipment acceptance yet')
