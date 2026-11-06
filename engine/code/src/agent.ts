import { AnswerSchema, SelectionSchema, type Answer } from './contract.ts';
import type { Pack, Rule } from './rules.ts';
import type { ModelProvider } from './provider.ts';
const unique=<T>(a:T[])=>[...new Set(a)];
export function abstain(jurisdiction:string,model:string,pack?:Pack,explanation='The local rules pack does not cover this item. Please check with the jurisdiction.'):Answer {
 return {jurisdiction,item_interpreted:null,behavior:'abstain',stream:null,conditions:null,clarifying_question:null,prep:[],explanation,rule_ids:[],source_urls:pack?[pack.jurisdiction.official_contact_url]:[],model};
}
export function assemble(pack:Pack,value:unknown,model:string):Answer {
 const s=SelectionSchema.parse(value);
 if(s.behavior==='abstain')return {...abstain(pack.jurisdiction.id,model,pack),item_interpreted:s.item_interpreted};
 const selected=s.selections.map(choice=>{
  const rule=pack.rules.find(r=>r.id===choice.rule_id);
  if(!rule)throw new Error('Unknown rule');
  if(choice.condition_index!==null && !rule.conditions?.[choice.condition_index])throw new Error('Invalid condition');
  return {rule,index:choice.condition_index};
 });
 if(s.behavior==='answer'&&selected.length!==1)throw new Error('Answer requires one rule');
 if(s.behavior==='conditional'&&!selected.length)throw new Error('Conditions require rules');
 if(s.behavior==='clarify'&&!s.clarifying_question)throw new Error('Missing question');
 let stream:Answer['stream']=null;
 let conditions:Answer['conditions']=null;
 if(s.behavior==='answer'){
  const {rule,index}=selected[0];stream=index===null?rule.stream:rule.conditions![index].stream;
  if(!stream)throw new Error('Unresolved condition');
 }
 if(s.behavior==='conditional'){
  conditions=selected.flatMap(({rule,index})=>{
   if(rule.conditions){if(index!==null)throw new Error('Conditional must include all branches');return rule.conditions;}
   if(!rule.stream)throw new Error('No stream');
   return [{if:rule.applies_to.join('; '),stream:rule.stream}];
  });
  if(conditions.length<2)throw new Error('Conditional needs multiple cases');
 }
 const cited:Rule[]=selected.map(x=>x.rule);
 // Follow pack-authored cross-references to include the destination and field provenance.
 for(const {rule,index} of selected){
  const branches=s.behavior==='answer'&&index!==null?[rule.conditions![index]]:(rule.conditions??[]);
  for(const branch of branches)for(const other of pack.rules){
   if(branch.if.includes(other.id)&&!cited.includes(other))cited.push(other);
  }
 }
 const sources=unique(cited.flatMap(r=>[r.source,...(r.destination_source?[r.destination_source]:[])])).map(id=>pack.sources.find(s=>s.id===id)!);
 if(sources.some(s=>!s||s.kind==='superseded'||s.kind==='business_page'))throw new Error('Disallowed source');
 const evidence=cited.map(r=>{
  const source=pack.sources.find(s=>s.id===r.source)!;
  const field=['field_observation','field_report'].includes(source.kind)?`${source.kind==='field_report'?'Field report':'Field observation'} dated ${source.observed??source.page_date}; not a published page. `:'';
  const inferred=r.destination_inferred?'The destination is the pack author’s inference, not an explicit disposal instruction in the source. ':'';
  return `${r.id}: ${field}${inferred}“${r.quote}”${r.destination_quote?` “${r.destination_quote}”`:''}${r.where?` Where: ${r.where}`:''}`;
 });
 const result:Answer={jurisdiction:pack.jurisdiction.id,item_interpreted:s.item_interpreted,behavior:s.behavior,stream,conditions,clarifying_question:s.behavior==='clarify'?s.clarifying_question:null,prep:s.behavior==='clarify'?[]:unique(cited.flatMap(r=>r.prep)),explanation:evidence.join('\n\n')||'More detail is needed to identify one item in the local rules.',rule_ids:unique(cited.map(r=>r.id)),source_urls:unique(sources.flatMap(s=>s.url?[s.url]:[])),model};
 if(!result.source_urls.length)result.source_urls=[pack.jurisdiction.official_contact_url];
 return AnswerSchema.parse(result);
}
export async function ask(packs:Map<string,Pack>,provider:ModelProvider,jurisdiction:string,query:string,diagnostic?:(value:unknown)=>void):Promise<Answer>{
 const pack=packs.get(jurisdiction);
 if(!pack)return abstain(jurisdiction,provider.model,undefined,`Unsupported jurisdiction. Supported jurisdictions: ${[...packs.values()].map(p=>`${p.jurisdiction.name} (${p.jurisdiction.id})`).join(', ')}.`);
 let model=provider.model;
 try {
  for(let attempt=0;attempt<2;attempt++){
   const result=await provider.select(pack,query,attempt>0);model=result.model;
   diagnostic?.({attempt,selection:result.value,model});
   try {return assemble(pack,result.value,model);}
   catch {diagnostic?.({attempt,failure:'selection_validation',model});}
  }
 }catch {diagnostic?.({failure:'provider_error',model});}
 return abstain(jurisdiction,model,pack,'We could not produce a verified answer from the local rules. Please try again or check the official source.');
}
