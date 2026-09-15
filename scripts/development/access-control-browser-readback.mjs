// Read-only evidence for real browser authorization writes, using private local synthetic sessions.
import { readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const fixture=JSON.parse(await readFile('outputs/verification/wi-007/fixture.json'))
async function get(label,path,status=200){
 const state=JSON.parse(await readFile(`.local-data/wi007-${label}-session.json`))
 const r=await fetch('http://127.0.0.1:8080'+path,{headers:{Cookie:state.cookies.map(c=>`${c.name}=${c.value}`).join('; ')}})
 assert.equal(r.status,status,`${path} returned unexpected status`)
 return r.json()
}
const phase=process.argv[2], file='outputs/verification/wi-007/browser-readback.json'
let evidence={};try{evidence=JSON.parse(await readFile(file))}catch{}
const grants=await get('admin','/api/access-control/temporary-grants')
const grant=grants.find(g=>g.id===fixture.pendingGrantId)
const contract=await get('recipient',`/api/contracts/${fixture.contractId}`)
const assignment=await get('admin',`/api/access-control/accounts/${fixture.browserUserId}/system-role-assignments`)
const nav=await get('browser-user','/api/access-control/navigation')
assert.ok(!nav.some(n=>n.children.some(c=>c.routeKey==='system.organization-users')))
await get('browser-user','/api/iam/users?page=1&pageSize=10',403)
assert.ok(assignment.assignments.some(a=>a.roleId===fixture.viewerRoleId&&a.status==='REVOKED'))
assert.ok(assignment.assignments.some(a=>a.roleId===fixture.baseRoleId&&a.status==='ACTIVE'))
if(phase==='pending'){assert.equal(grant.status,'PENDING_REVIEW');assert.equal(contract.sensitiveVisible,false)}
else if(phase==='approved'){
 assert.equal(grant.status,'ACTIVE');assert.equal(contract.sensitiveVisible,true)
 assert.equal(grant.reviewComment,'验证·浏览器独立复核：仅限此项目，保留原起止时间。')
 assert.equal(grant.reviewedByAccountId,fixture.reviewerId)
 assert.equal(grant.startsAt,evidence.pending.startsAt);assert.equal(grant.endsAt,evidence.pending.endsAt)
}else if(phase==='revoked'){assert.equal(grant.status,'REVOKED');assert.equal(contract.sensitiveVisible,false);assert.equal(grant.revokeReason,'验证·浏览器复核闭环结束，立即收回临时权限。')}
else if(phase==='menu'){
 const menus=await get('admin','/api/access-control/menu-resources'), menu=menus.find(m=>m.id===fixture.directoryId)
 assert.equal(menu.name,'验证·权限资源目录（浏览器验收）');assert.equal(menu.status,'DISABLED');assert.equal(menu.sortOrder,98)
 const impact=await get('admin',`/api/access-control/menu-resources/${fixture.directoryId}/impact`)
 assert.equal(impact.directChildCount,0);assert.equal(impact.permissionItemCount,0)
 evidence.menu={at:new Date().toISOString(),id:menu.id,name:menu.name,code:menu.code,status:menu.status,sortOrder:menu.sortOrder,version:menu.version,impact}
 await writeFile(file,JSON.stringify(evidence,null,2));console.log('PASS browser resource save/status and preserved identity');process.exit(0)
}else throw new Error('Expected pending / approved / revoked / menu')
evidence[phase]={at:new Date().toISOString(),status:grant.status,sensitiveVisible:contract.sensitiveVisible,startsAt:grant.startsAt,endsAt:grant.endsAt,
 roleRevoked:true,baseRolePreserved:true,directoryHttpStatus:403,navigationEntryRemoved:true,reviewComment:grant.reviewComment,reviewedByAccountId:grant.reviewedByAccountId,revokeReason:grant.revokeReason}
await writeFile(file,JSON.stringify(evidence,null,2));console.log(`PASS browser readback: ${phase}, status=${grant.status}, sensitiveVisible=${contract.sensitiveVisible}`)
