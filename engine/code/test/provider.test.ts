import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RemoteProvider } from '../src/provider.ts';
import { loadPacks } from '../src/rules.ts';
import { readConfig } from '../src/config.ts';
const pack=(await loadPacks()).get('austin_tx')!;
for(const provider of ['anthropic','openai'] as const){
 test(`${provider} adapter sends selected pack, deterministic settings, parses exact response model`,async()=>{
  let call=0;
  const mock:typeof fetch=async(url,init)=>{call++;assert.equal(new URL(String(url)).hostname,provider==='openai'?'api.openai.com':'api.anthropic.com');const b=JSON.parse(init!.body as string);assert.equal(b.temperature,0);assert.equal(b.model,'test-model');assert.ok(JSON.stringify(b).includes('atx-paper-001'));assert.ok(!JSON.stringify(b).includes('sea-paper-001'));const value=JSON.stringify({behavior:'abstain',item_interpreted:null,selections:[],clarifying_question:null});return Response.json(provider==='anthropic'?{model:'exact-version',content:[{type:'text',text:value}]}:{model:'exact-version',choices:[{message:{content:value}}]});};
  const result=await new RemoteProvider({provider,model:'test-model',apiKey:'test'},mock).select(pack,'an item');assert.equal(call,1);assert.equal(result.model,`${provider}/exact-version`);assert.equal((result.value as any).behavior,'abstain');
 });
}
test('temperature unsupported: retry without it, preserve exact requested model',async()=>{
 let n=0;const mock:typeof fetch=async(_,init)=>{n++;const b=JSON.parse(init!.body as string);assert.equal(b.model,'reasoner');if(n===1)return Response.json({error:{param:'temperature'}},{status:400});assert.equal(b.temperature,undefined);return Response.json({model:'reasoner',choices:[{message:{content:'{}'}}]});};
 await new RemoteProvider({provider:'openai',model:'reasoner',apiKey:'test'},mock).select(pack,'item');assert.equal(n,2);
});
test('configuration requires explicit provider, model and matching key',()=>{
 assert.throws(()=>readConfig({}));assert.throws(()=>readConfig({LLM_PROVIDER:'stub',LLM_MODEL:'test'}));assert.throws(()=>readConfig({LLM_PROVIDER:'openai',LLM_MODEL:'test',ANTHROPIC_API_KEY:'x'}));assert.equal(readConfig({LLM_PROVIDER:'openai',LLM_MODEL:'test',OPENAI_API_KEY:'x'}).model,'test');
});
test('Anthropic deprecated temperature is removed only after explicit rejection',async()=>{
 let calls=0;const mock:typeof fetch=async(_,init)=>{calls++;const body=JSON.parse(init!.body as string);if(calls===1){assert.equal(body.temperature,0);return Response.json({error:{type:'invalid_request_error',message:'`temperature` is deprecated for this model.'}},{status:400});}assert.equal(body.temperature,undefined);return Response.json({model:'exact',content:[{type:'text',text:'{}'}]});};
 await new RemoteProvider({provider:'anthropic',model:'configured',apiKey:'test'},mock).select(pack,'item');assert.equal(calls,2);
});
