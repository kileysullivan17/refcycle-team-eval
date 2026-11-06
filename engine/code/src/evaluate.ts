import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { loadEnv, readConfig } from './config.ts';
import { loadPacks } from './rules.ts';
import { RemoteProvider } from './provider.ts';
import { createApp } from './server.ts';
import { AnswerSchema, type Answer } from './contract.ts';
export function score(row:Record<string,string>,a:Answer):string[]{
 const errors:string[]=[];
 if(!row.expected_behavior.split(';').includes(a.behavior))errors.push(`behavior ${a.behavior}, expected ${row.expected_behavior}`);
 if(a.behavior==='answer'&&row.acceptable_streams&&!row.acceptable_streams.split(';').includes(a.stream!))errors.push(`stream ${a.stream}`);
 const expected=row.rule_ids_expected.split(';').filter(Boolean);
 if(['answer','conditional'].includes(a.behavior)&&expected.length&&!expected.some(id=>a.rule_ids.includes(id)))errors.push('missing expected rule evidence');
 if(a.behavior==='conditional'&&row.conditions_expected){
  for(const condition of row.conditions_expected.split(';')){const [words,stream]=condition.split(':');if(!a.conditions?.some(c=>c.stream===stream&&words.toLowerCase().split('|').some(w=>c.if.toLowerCase().includes(w))))errors.push(`missing condition ${condition}`);}
 }
 return errors;
}
async function main(){
 await loadEnv();const provider=new RemoteProvider(readConfig());const packs=await loadPacks();
 const rows=parse(await readFile('eval/dev.csv','utf8'),{columns:true,skip_empty_lines:true}) as Record<string,string>[];
 const app=createApp(packs,provider);await new Promise<void>(r=>app.listen(0,'127.0.0.1',r));
 const results:unknown[]=[];const categories:Record<string,{passed:number,total:number}>={};let passed=0;
 try {for(const row of rows){
  const response=await fetch(`http://127.0.0.1:${(app.address() as {port:number}).port}/api/ask`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jurisdiction:row.jurisdiction,query:row.query})});
  const answer=AnswerSchema.parse(await response.json());const failures=score(row,answer);const pass=failures.length===0;
  if(pass)passed++;const category=categories[row.category]??={passed:0,total:0};category.total++;if(pass)category.passed++;
  console.log(`${pass?'PASS':'FAIL'} ${row.case_id} [${row.category}] ${answer.behavior}/${answer.stream??'-'} ${failures.join('; ')}`);
  results.push({case_id:row.case_id,category:row.category,query:row.query,pass,failures,answer});
 }}finally{app.close();}
 const report={timestamp:new Date().toISOString(),model:provider.model,passed,total:rows.length,categories,results};
 await mkdir('artifacts',{recursive:true});const filename=`artifacts/dev-${provider.model.replace(/[^a-zA-Z0-9.-]/g,'-')}.json`;await writeFile(filename,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({model:provider.model,passed,total:rows.length,categories,report:filename},null,2));if(passed!==rows.length)process.exitCode=1;
}
if(process.argv[1]?.endsWith('evaluate.ts'))main().catch(e=>{console.error(e.message);process.exitCode=1;});
