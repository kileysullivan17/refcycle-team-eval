import { createServer } from 'node:http';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { Pack } from './rules.ts';
import { AskRequest } from './contract.ts';
import { ask } from './agent.ts';
import { StubProvider, type ModelProvider } from './provider.ts';
export function createApp(packs:Map<string,Pack>,provider:ModelProvider=new StubProvider({behavior:'abstain',item_interpreted:null,selections:[],clarifying_question:null}),logPath='logs/requests.jsonl'){
 return createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  const send=(status:number,body:unknown)=>{res.statusCode=status;res.end(JSON.stringify(body));};
  if(req.method==='GET'&&req.url==='/api/jurisdictions')return send(200,[...packs.values()].map(p=>({id:p.jurisdiction.id,name:p.jurisdiction.name})));
  if(req.method==='GET'&&['/','/app.js','/style.css'].includes(req.url??'')){
   try {const file=req.url==='/'?'index.html':req.url!.slice(1);const content=await readFile(`public/${file}`);res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");res.end(content);return;}catch{return send(404,{error:'Not found'});}
  }
  if(req.method!=='POST'||req.url!=='/api/ask')return send(404,{error:'Not found'});
  const diagnostics:unknown[]=[];
  const start=Date.now();let request:unknown=null;let response:unknown;let status=200;
  try {
   if(!req.headers['content-type']?.toLowerCase().startsWith('application/json'))throw new Error('Content-Type must be application/json');
   let bytes=0;const chunks:Buffer[]=[];
   for await(const chunk of req.iterator({destroyOnReturn:false})){bytes+=chunk.length;if(bytes>16384){req.resume();throw new Error('Request body too large');}chunks.push(Buffer.from(chunk));}
   try {request=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Error('Invalid JSON');}
   const parsed=AskRequest.safeParse(request);if(!parsed.success)throw new Error('Provide jurisdiction and query as non-empty strings (query at most 2000 characters), with no extra keys');
   response=await ask(packs,provider,parsed.data.jurisdiction,parsed.data.query,value=>diagnostics.push(value));
  }catch(error){status=400;response={error:error instanceof Error?error.message:'Invalid input'};}
  try {await mkdir(logPath.substring(0,logPath.lastIndexOf('/'))||'.',{recursive:true});await appendFile(logPath,JSON.stringify({id:randomUUID(),timestamp:new Date().toISOString(),duration_ms:Date.now()-start,status,request,response,diagnostics,model:(response as {model?:string}).model??provider.model})+'\n','utf8');}
  catch {console.error('Request log write failed');}
  send(status,response);
 });
}
