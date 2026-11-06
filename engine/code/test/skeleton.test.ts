import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPacks, PackSchema } from '../src/rules.ts';
import { createApp } from '../src/server.ts';
test('M1: loads three validated packs; serves jurisdictions',async()=>{
 const packs=await loadPacks(); assert.equal(packs.size,3);
 const app=createApp(packs);await new Promise<void>(r=>app.listen(0,'127.0.0.1',r));
 try {const address=app.address() as {port:number};const res=await fetch(`http://127.0.0.1:${address.port}/api/jurisdictions`);assert.equal(res.status,200);assert.deepEqual(await res.json(),[...packs.values()].map(p=>({id:p.jurisdiction.id,name:p.jurisdiction.name})));}finally{app.close();}
});
test('invalid source references and duplicate rules fail startup validation',async()=>{
 const p=structuredClone((await loadPacks()).get('seattle_wa')!);p.rules[0].source='missing'; assert.equal(PackSchema.safeParse(p).success,false);
 p.rules[0].source='src-02'; assert.equal(PackSchema.safeParse(p).success,false);
});
