import type { Pack } from './rules.ts';
export interface ModelResult { value:unknown; model:string; }
export interface ModelProvider { readonly model:string; select(pack:Pack,query:string,repair?:boolean):Promise<ModelResult>; }
// Dependency injection for tests only; runtime never selects a stub from configuration.
export class StubProvider implements ModelProvider {
 readonly model='stub/contract-v1';
 constructor(private value:unknown){}
 async select():Promise<ModelResult>{return {value:this.value,model:this.model};}
}

import { readConfig } from './config.ts';
import { instructions } from './prompt.ts';
type Config=ReturnType<typeof readConfig>;
export class RemoteProvider implements ModelProvider {
 readonly model:string;
 private useTemperature=true;
 constructor(private config:Config,private request:typeof fetch=fetch){this.model=`${config.provider}/${config.model}`;}
 async select(pack:Pack,query:string,repair?:boolean):Promise<ModelResult>{
  const {provider,model,apiKey}=this.config;
  const system=instructions(pack)+(repair?'\nYour previous output failed schema or evidence validation. Return exactly the five required keys. An answer must select EXACTLY ONE rule that supplies the destination, with its zero-based condition_index when applicable. Do not include rejected alternatives as supporting rules. If no valid selection is possible, abstain.':'');
  const anthropic=provider==='anthropic';
  const endpoint=anthropic?'https://api.anthropic.com/v1/messages':'https://api.openai.com/v1/chat/completions';
  const body:Record<string,unknown>=anthropic?{model,max_tokens:4096,temperature:0,system,messages:[{role:'user',content:query}]}:{model,temperature:0,max_completion_tokens:4096,response_format:{type:'json_object'},messages:[{role:'system',content:system},{role:'user',content:query}]};
  if(!this.useTemperature)delete body.temperature;
  const headers:Record<string,string>=anthropic?{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'}:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`};
  // Only retry a rejected temperature setting, for model families that do not support it.
  let response=await this.request(endpoint,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(60000),redirect:'error'});
  if(response.status===400){
   const error=await response.json() as {error?:{param?:string;message?:string}};
   if(error.error?.param==='temperature'||/temperature.*(not support|unsupported|deprecated|only.*default)/i.test(error.error?.message??'')){
    this.useTemperature=false;
    delete body.temperature;
    response=await this.request(endpoint,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(60000),redirect:'error'});
   }else throw new Error('Provider rejected request');
  }
  if(!response.ok)throw new Error(`Provider HTTP ${response.status}`);
  const data=await response.json() as any;
  const exact=`${provider}/${typeof data.model==='string'?data.model:model}`;
  const content=anthropic?data.content?.filter((b:any)=>b.type==='text').map((b:any)=>b.text).join(''):data.choices?.[0]?.message?.content;
  if(typeof content!=='string')return {model:exact,value:null};
  try{return {model:exact,value:JSON.parse(content.replace(/^\s*```(?:json)?\s*/,'').replace(/\s*```\s*$/,''))};}
  catch{return {model:exact,value:null};}
 }
}
