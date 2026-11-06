import { readFile, readdir } from 'node:fs/promises';
import { parse } from 'yaml';
import { z } from 'zod';
export const Stream = z.enum(['recycle_bin','compost_bin','garbage','drop_off_special','deposit_return']);
export const Condition = z.object({if:z.string().min(1),stream:Stream});
const Source = z.object({id:z.string(),kind:z.enum(['official_page','field_observation','field_report','business_page','superseded']),title:z.string(),url:z.string().url().nullable(),publisher:z.string(),page_date:z.string().nullable().optional(),retrieved:z.string(),observed:z.string().optional()}).passthrough();
const Rule = z.object({id:z.string(),applies_to:z.array(z.string()).min(1),stream:Stream.nullable(),conditions:z.array(Condition).min(1).nullable().optional(),prep:z.array(z.string()),where:z.string().nullable(),source:z.string(),quote:z.string(),destination_source:z.string().optional(),destination_quote:z.string().optional(),destination_inferred:z.boolean().optional(),location_limited:z.boolean().optional(),also_acceptable:z.array(Stream).optional(),also_acceptable_source:z.string().optional(),also_acceptable_quote:z.string().optional(),verified_by_ks:z.boolean()});
export const PackSchema = z.object({jurisdiction:z.object({id:z.string(),name:z.string(),system_summary:z.string(),official_contact_url:z.string().url()}),sources:z.array(Source),rules:z.array(Rule).min(1)}).superRefine((p,c)=>{
 const fail=(message:string)=>c.addIssue({code:'custom',message});
 if(new Set(p.rules.map(r=>r.id)).size!==p.rules.length) fail('Duplicate rule id');
 if(new Set(p.sources.map(s=>s.id)).size!==p.sources.length) fail('Duplicate source id');
 for(const r of p.rules){
  for(const id of [r.source,r.destination_source,r.also_acceptable_source].filter(Boolean)){
   const s=p.sources.find(s=>s.id===id);
   if(!s || s.kind==='superseded') fail(`Invalid source for ${r.id}: ${id}`);
   if(id===r.source && s?.kind==='business_page') fail('Business page cannot be main source');
   if(s && ['field_observation','field_report'].includes(s.kind) && !s.observed && !s.page_date) fail('Field source needs a date');
  }
  if(r.location_limited&&!r.where) fail('Location-limited rule needs where');
 }
});
export type Pack = z.infer<typeof PackSchema>;
export type Rule = z.infer<typeof Rule>;
export async function loadPacks(directory='rules'):Promise<Map<string,Pack>> {
 const packs=new Map<string,Pack>();
 for(const file of (await readdir(directory)).filter(f=>f.endsWith('.yaml')).sort()){
  const p=PackSchema.parse(parse(await readFile(`${directory}/${file}`,'utf8')));
  if(packs.has(p.jurisdiction.id)) throw new Error('Duplicate jurisdiction');
  packs.set(p.jurisdiction.id,p);
 }
 if(!packs.size) throw new Error('No rule packs');
 return packs;
}
