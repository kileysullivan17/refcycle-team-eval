import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPacks } from '../src/rules.ts';
import { assemble, ask } from '../src/agent.ts';
import { AnswerSchema } from '../src/contract.ts';
import { StubProvider } from '../src/provider.ts';
import { createApp } from '../src/server.ts';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
const packs=await loadPacks();
export const choice=(behavior:string,ids:string[]=[],index:number|null=null)=>({behavior,item_interpreted:'test item',selections:ids.map(rule_id=>({rule_id,condition_index:index})),clarifying_question:behavior==='clarify'?'What kind of container is it?':null});
for(const [behavior,ids] of [['answer',['hc-paper-001']],['abstain',[]],['clarify',['hc-plastic-006']],['conditional',['hc-plastic-006']]] as const){
 test(`M2: ${behavior} schema via stub`,async()=>{const a=await ask(packs,new StubProvider(choice(behavior,[...ids])),'hawaii_county_hi','an item');assert.equal(a.behavior,behavior);AnswerSchema.parse(a);});
}
test('every stream enum can be grounded',()=>{
 for(const [id,stream] of [['hc-paper-001','recycle_bin'],['hc-green-008','compost_bin'],['hc-paper-003','garbage'],['hc-plastic-011','drop_off_special'],['hc-deposit-005','deposit_return']])assert.equal(assemble(packs.get('hawaii_county_hi')!,choice('answer',[id]),'stub').stream,stream);
});
test('HTTP invalid inputs return 400; valid response and exact model logged',async()=>{
 const log=`${await mkdtemp(`${tmpdir()}/refcycle-`)}/requests.jsonl`;
 const app=createApp(packs,new StubProvider(choice('answer',['sea-paper-002'])),log);await new Promise<void>(r=>app.listen(0,'127.0.0.1',r));
 try {const url=`http://127.0.0.1:${(app.address() as {port:number}).port}/api/ask`;
 for(const body of ['{','null','{}',JSON.stringify({jurisdiction:'seattle_wa',query:' '}),JSON.stringify({jurisdiction:123,query:'hi'}),JSON.stringify({jurisdiction:'seattle_wa',query:'x'.repeat(20000)})]){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body});assert.equal(r.status,400);assert.ok((await r.json() as any).error);}
 const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jurisdiction:'seattle_wa',query:'cardboard'})});assert.equal(r.status,200);AnswerSchema.parse(await r.json());
 const lines=(await readFile(log,'utf8')).trim().split('\n').map(l=>JSON.parse(l));assert.equal(lines.length,7);assert.equal(lines.at(-1).model,'stub/contract-v1');assert.equal(lines.at(-1).request.query,'cardboard');
 }finally{app.close();}
});
