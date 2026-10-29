import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import test from 'node:test';
import './chat-route-loader.mjs';
const {POST,DELETE}=await import('../app/api/chat/route.ts');
const connect=net.Socket.prototype.connect;net.Socket.prototype.connect=function(...args){const first=Array.isArray(args[0])?args[0][0]:args[0];const host=first&&typeof first==='object'?first.host:typeof args[1]==='string'?args[1]:undefined;if(host&&!['127.0.0.1','::1','localhost'].includes(host))throw new Error('External socket refused');return Reflect.apply(connect,this,args);};
let sequence=0;
async function withProvider(run){
 const calls=[];let held,received;const requestReceived=new Promise(resolve=>received=resolve);
 const complete=(res,answer)=>{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({id:'local',object:'chat.completion',created:0,model:'gpt-5-mini',choices:[{index:0,message:{role:'assistant',content:answer},finish_reason:'stop'}]}));};
 const server=http.createServer(async(req,res)=>{let raw='';for await(const part of req)raw+=part;calls.push({path:req.url,body:JSON.parse(raw)});if(calls.length===1){held=res;received();}else if(req.url==='/v2/search'){res.writeHead(200,{'content-type':'application/json'});res.end('{"success":true,"data":{"web":[]}}');}else complete(res,'synthetic company information');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const prior={};for(const key of ['OPENAI_BASE_URL','FIRECRAWL_API_URL','OPENAI_API_KEY','FIRECRAWL_API_KEY','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy']){prior[key]=process.env[key];delete process.env[key];}const origin=`http://127.0.0.1:${server.address().port}`;process.env.OPENAI_BASE_URL=origin+'/v1';process.env.FIRECRAWL_API_URL=origin;
 const queryId=`owned-chat-${sequence++}`;const controller=new AbortController();
 const response=await POST(new Request('http://localhost/api/chat',{method:'POST',signal:controller.signal,headers:{'content-type':'application/json','X-OpenAI-API-Key':'synthetic-local','X-Firecrawl-API-Key':'synthetic-local'},body:JSON.stringify({question:'What is the existing company name?',context:{tableData:'companyName: Synthetic Company'},sessionId:queryId})}));
 try{await requestReceived;await run({response,calls,abort:()=>controller.abort(),stop:()=>DELETE(new Request(`http://localhost/api/chat?queryId=${queryId}`,{method:'DELETE'})),release:answer=>{complete(held,answer);held=null;}});}finally{if(held)complete(held,'Synthetic final answer.');server.closeAllConnections();await new Promise(resolve=>server.close(resolve));for(const[key,value]of Object.entries(prior)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
}
test('DELETE suppresses a late SDK answer and completion',async()=>withProvider(async({response,stop,release})=>{assert.equal((await stop()).status,200);release('Synthetic answer after Stop.');const text=await response.text();assert.ok(!text.includes('Synthetic answer after Stop.'));assert.ok(!text.includes('"type":"complete"'));}));
test('DELETE prevents future provider steps after a held table miss',async()=>withProvider(async({response,stop,release,calls})=>{await stop();release('NOT_FOUND');try{await response.text();}catch{}assert.equal(calls.length,1,'A stopped query must not start web query generation or search');}));
test('request abort suppresses a late SDK answer',async()=>withProvider(async({response,abort,release})=>{abort();release('Synthetic answer after disconnect.');assert.ok(!(await response.text()).includes('Synthetic answer after disconnect.'));}));
test('ordinary successful table answers still stream and complete',async()=>withProvider(async({response,release})=>{release('Synthetic successful answer.');const text=await response.text();assert.ok(text.includes('Synthetic successful answer.'));assert.ok(text.includes('"type":"complete"'));}));
test('missing query IDs remain a client error',async()=>assert.equal((await DELETE(new Request('http://localhost/api/chat',{method:'DELETE'}))).status,400));

test('DELETE closes the stream while a provider request is still pending',async()=>withProvider(async({response,stop,release})=>{await stop();const text=await Promise.race([response.text(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Stopped stream remained open')),100))]);assert.ok(!text.includes('"type":"response"'));release('Synthetic late answer.');}));
test('consumer cancellation prevents later provider work',async()=>withProvider(async({response,release,calls})=>{await Promise.race([response.body.cancel(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Consumer cancellation remained pending')),100))]);release('NOT_FOUND');await new Promise(resolve=>setTimeout(resolve,30));assert.equal(calls.length,1);}));
