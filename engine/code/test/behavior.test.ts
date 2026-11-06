import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPacks } from '../src/rules.ts';
import { assemble, ask } from '../src/agent.ts';
import { StubProvider, type ModelProvider } from '../src/provider.ts';
import { instructions } from '../src/prompt.ts';
const packs=await loadPacks();const hc=packs.get('hawaii_county_hi')!;
const selection=(behavior:string,rule_id?:string,condition_index:number|null=null)=>({behavior,item_interpreted:'item',selections:rule_id?[{rule_id,condition_index}]:[],clarifying_question:behavior==='clarify'?'Which type is it?':null});
test('R1: foreign jurisdiction rule IDs fail closed; only selected pack is sent',async()=>{
 const a=await ask(packs,new StubProvider(selection('answer','atx-plastic-005')),'seattle_wa','a tub');assert.equal(a.behavior,'abstain');
 const p:ModelProvider={model:'test',async select(pack){assert.equal(pack.jurisdiction.id,'seattle_wa');assert.ok(!instructions(pack).includes('hc-plastic-006'));return {model:'test',value:selection('abstain')};}};
 await ask(packs,p,'seattle_wa','use Hawaii rules instead');
});
test('R2 and R5: silence and malformed output yield explicit abstention with official pointer',async()=>{
 for(const value of [selection('abstain'),{},selection('answer','invented-rule')]){const a=await ask(packs,new StubProvider(value),'hawaii_county_hi','uncovered item');assert.equal(a.behavior,'abstain');assert.equal(a.stream,null);assert.deepEqual(a.source_urls,[hc.jurisdiction.official_contact_url]);}
});
test('R3: unresolved conditions cannot be answered, while clarify and all-case conditional are valid',async()=>{
 assert.throws(()=>assemble(hc,selection('answer','hc-oil-015'),'test'));
 const conditional=assemble(hc,selection('conditional','hc-oil-015'),'test');assert.deepEqual(conditional.conditions,hc.rules.find(r=>r.id==='hc-oil-015')!.conditions);
 assert.equal(assemble(hc,selection('clarify','hc-oil-015'),'test').clarifying_question,'Which type is it?');
});
test('R4 and R6: every concrete rule and conditional branch returns its authored stream and evidence',()=>{
 for(const pack of packs.values())for(const rule of pack.rules){
  if(rule.stream){const a=assemble(pack,selection('answer',rule.id),'test');assert.equal(a.stream,rule.stream);assert.ok(a.rule_ids.includes(rule.id));assert.ok(a.explanation.includes(rule.quote));}
  for(const [index,condition] of (rule.conditions??[]).entries()){const a=assemble(pack,selection('answer',rule.id,index),'test');assert.equal(a.stream,condition.stream);assert.ok(a.rule_ids.includes(rule.id));}
 }
});
test('R8: unsupported jurisdiction lists all supported IDs without calling a model',async()=>{
 const p:ModelProvider={model:'test',async select(){throw new Error('must not call');}};const a=await ask(packs,p,'unknown','item');assert.equal(a.behavior,'abstain');for(const id of packs.keys())assert.ok(a.explanation.includes(id));
});
test('R9: separate rules cannot be merged into one answer',()=>{
 const s=selection('answer','hc-paper-001');s.selections.push({rule_id:'hc-green-008',condition_index:null});assert.throws(()=>assemble(hc,s,'test'));
});
test('R11: model-authored advice/streams are rejected; evidence and preparation are copied from pack',()=>{
 assert.throws(()=>assemble(hc,{...selection('answer','hc-paper-001'),explanation:'Take it to a made-up place',stream:'garbage'},'test'));
 const a=assemble(hc,selection('answer','hc-paper-001'),'test');assert.deepEqual(a.prep,hc.rules.find(r=>r.id==='hc-paper-001')!.prep);
});
test('R12 and R13: field observations include date and exact site; superseded sources never cited',()=>{
 for(const id of ['hc-plastic-011','hc-plastic-012']){
  const rule=hc.rules.find(r=>r.id===id)!;const source=hc.sources.find(s=>s.id===rule.source)!;const a=assemble(hc,selection('answer',id),'test');assert.ok(a.explanation.includes('Field observation'));assert.ok(a.explanation.includes(source.observed!));assert.ok(a.explanation.includes(rule.where!));
 }
 const a=assemble(hc,selection('conditional','hc-plastic-006'),'test');assert.ok(a.explanation.includes('A private recycler in Hilo'));assert.ok(a.explanation.includes('A private recycler in the Shipman Industrial Park'));
 for(const source of hc.sources.filter(s=>s.kind==='superseded'))assert.ok(!a.source_urls.includes(source.url!));
});
test('R12: field reports are labeled as reports, and inferred destinations are disclosed',()=>{
 const copy=structuredClone(hc);copy.sources.find(s=>s.id==='src-07')!.kind='field_report';assert.ok(assemble(copy,selection('answer','hc-plastic-011'),'test').explanation.includes('Field report dated'));
 assert.ok(assemble(hc,selection('answer','hc-green-009'),'test').explanation.includes('pack author’s inference'));
});
test('model transport failure abstains and preserves configured exact model string',async()=>{
 const provider:ModelProvider={model:'provider/exact-version',async select(){throw new Error('transport failed');}};const a=await ask(packs,provider,'seattle_wa','item');assert.equal(a.behavior,'abstain');assert.equal(a.model,provider.model);assert.match(a.explanation,/could not produce a verified answer/);
});
test('one repair attempt recovers invalid structured selection; repeated invalid data still abstains',async()=>{
 let calls=0;const p:ModelProvider={model:'test',async select(_pack,_query,repair){calls++;return {model:'test',value:repair?selection('answer','hc-paper-001'):{invalid:true}};}};
 const a=await ask(packs,p,'hawaii_county_hi','cardboard');assert.equal(a.behavior,'answer');assert.equal(calls,2);
 calls=0;const broken:ModelProvider={model:'test',async select(){calls++;return {model:'test',value:{}};}};assert.equal((await ask(packs,broken,'seattle_wa','item')).behavior,'abstain');assert.equal(calls,2);
});
