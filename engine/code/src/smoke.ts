import { mkdir, writeFile } from 'node:fs/promises';
import { loadEnv, readConfig } from './config.ts';
import { loadPacks } from './rules.ts';
import { RemoteProvider } from './provider.ts';
import { createApp } from './server.ts';
import { AnswerSchema } from './contract.ts';
await loadEnv();
const provider=new RemoteProvider(readConfig());const packs=await loadPacks();
const app=createApp(packs,provider);await new Promise<void>(r=>app.listen(0,'127.0.0.1',r));
const results=[];
try {for(const jurisdiction of packs.keys()){
 const r=await fetch(`http://127.0.0.1:${(app.address() as {port:number}).port}/api/ask`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jurisdiction,query:'clean corrugated cardboard shipping box'})});
 const answer=AnswerSchema.parse(await r.json());const pass=answer.behavior==='answer'&&answer.stream==='recycle_bin';
 results.push({jurisdiction,pass,answer});console.log(`${pass?'PASS':'FAIL'} ${jurisdiction}: ${answer.behavior}/${answer.stream}`);
}}finally{app.close();}
await mkdir('artifacts',{recursive:true});
await writeFile(`artifacts/smoke-${provider.model.replace(/[^a-zA-Z0-9.-]/g,'-')}.json`,JSON.stringify({timestamp:new Date().toISOString(),model:provider.model,results},null,2)+'\n');
if(results.some(r=>!r.pass))process.exitCode=1;
