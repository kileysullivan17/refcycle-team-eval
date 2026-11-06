import { loadPacks } from './rules.ts';
import { createApp } from './server.ts';
import { loadEnv, readConfig } from './config.ts';
import { RemoteProvider } from './provider.ts';
await loadEnv();
try {
 const packs=await loadPacks();
 const provider=new RemoteProvider(readConfig());
 const app=createApp(packs,provider);
 app.listen(3000,'127.0.0.1',()=>console.log(`RefCycle: http://127.0.0.1:3000 (${packs.size} jurisdictions; ${provider.model})`));
}catch(error){console.error(error instanceof Error?error.message:'Startup failed');process.exitCode=1;}
