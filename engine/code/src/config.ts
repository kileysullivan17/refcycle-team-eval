import { readFile } from 'node:fs/promises';
export async function loadEnv(path='.env'){
 let text:string;
 try{text=await readFile(path,'utf8');}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return;throw e;}
 for(const line of text.split(/\r?\n/)){
  const match=line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);if(!match)continue;
  let value=match[2];if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);else value=value.replace(/\s+#.*$/,'');
  if(process.env[match[1]]===undefined)process.env[match[1]]=value;
 }
}
export function readConfig(env:NodeJS.ProcessEnv=process.env){
 const provider=env.LLM_PROVIDER;const model=env.LLM_MODEL?.trim();
 if(provider!=='anthropic'&&provider!=='openai')throw new Error('Set LLM_PROVIDER to anthropic or openai in .env');
 if(!model)throw new Error('Set LLM_MODEL to the exact model ID in .env');
 const apiKey=env[provider==='anthropic'?'ANTHROPIC_API_KEY':'OPENAI_API_KEY'];
 if(!apiKey?.trim())throw new Error(`Set ${provider==='anthropic'?'ANTHROPIC_API_KEY':'OPENAI_API_KEY'} in .env`);
 return {provider,model,apiKey};
}
