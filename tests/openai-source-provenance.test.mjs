import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import test from 'node:test';
import './resolve-typescript.mjs';
const { OpenAIService } = await import('../lib/services/openai.ts');
const url='https://fixture.invalid/report';
const other='https://fixture.invalid/other';
const quote='The company operates in the Technology sector according to its published annual report.';
const entry=(source_url=url,exact_text=quote)=>({value:'Technology',source_url,exact_text,confidence:.95});
const document=(source,text)=>`URL: ${source}\n[PAGE TITLE - NOT CONTENT]: Fixture\n\n=== ACTUAL CONTENT BELOW ===\n${text}`;
const connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){const first=Array.isArray(args[0])?args[0][0]:args[0];const host=first&&typeof first==='object'?first.host:typeof args[1]==='string'?args[1]:undefined;if(host&&!['127.0.0.1','::1','localhost'].includes(host))throw new Error('External socket refused');return Reflect.apply(connect,this,args);};
async function extract(content,evidence){
 const calls=[];const payload={industry:{evidence,consensus_value:'Technology',consensus_confidence:.95,sources_agree:true}};
 const server=http.createServer(async(req,res)=>{let raw='';for await(const part of req)raw+=part;calls.push({path:req.url,body:JSON.parse(raw)});res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({id:'local',object:'chat.completion',created:0,model:'gpt-5',choices:[{index:0,message:{role:'assistant',content:JSON.stringify(payload)},finish_reason:'stop'}]}));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const previous={};for(const key of ['OPENAI_BASE_URL','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy']){previous[key]=process.env[key];delete process.env[key];}process.env.OPENAI_BASE_URL=`http://127.0.0.1:${server.address().port}/v1`;
 try{const result=await new OpenAIService('synthetic-local-fixture').extractStructuredDataWithCorroboration(content,[{name:'industry',displayName:'Industry',description:'Company industry',type:'string',required:false}],{});assert.equal(calls.length,1,'Unsupported provenance must not trigger fallback extraction');assert.equal(calls[0].path,'/v1/chat/completions');return result.industry;}finally{for(const[key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
for(const [name,content,evidence]of[
 ['unprovided URL',document(url,quote),[entry('https://invented.invalid/report')]],
 ['empty source URL',document(url,quote),[entry('')]],
 ['invented quotation',document(url,'The company publishes an annual report containing company facts.'),[entry()]],
 ['quotation attributed to the wrong document',document(url,'This report describes a company in the Retail sector.')+'\n\n---\n\n'+document(other,quote),[entry()]],
 ['page title presented as body evidence',`URL: ${url}\n[PAGE TITLE - NOT CONTENT]: ${quote}\n\n=== ACTUAL CONTENT BELOW ===\nNo industry information appears in this page body.`,[entry()]],
])test(`rejects ${name}`,async()=>assert.equal(await extract(content,evidence),undefined));
test('retains quotation from its provided document',async()=>assert.equal((await extract(document(url,quote),[entry()]))?.value,'Technology'));
test('retains whitespace and typographic quote variations',async()=>{
 const text='The company’s \"Technology\" sector\n  operations are documented in its published annual report.';
 const cited='The company\'s “Technology” sector operations are documented in its published annual report.';
 assert.equal((await extract(document(url,text),[entry(url,cited)]))?.value,'Technology');
});
test('keeps only grounded evidence when the response mixes grounded and invented citations',async()=>{
 const result=await extract(document(url,quote),[entry(),entry('https://invented.invalid/report')]);assert.equal(result?.source,url);assert.equal(result?.sourceContext?.length,1);assert.equal(result?.corroboration?.evidence.length,1);
});
test('supports repeated document URLs without losing later content',async()=>assert.equal((await extract(document(url,'This page gives general information about the company.')+'\n\n'+document(url,quote),[entry()]))?.value,'Technology'));
