import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

function route(enrichRow) {
  let source = fs.readFileSync(new URL('../app/api/enrich/route.ts', import.meta.url), 'utf8');
  source = stripTypeScriptTypes(source).replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
  return vm.runInNewContext(`(function(){${source};return {POST,DELETE};})()`, {
    NextResponse: Response, AgentEnrichmentStrategy: class {enrichRow = enrichRow;},
    loadSkipList: async () => new Set(), shouldSkipEmail: () => false, getSkipReason: () => '',
    ENRICHMENT_CONFIG: {CONCURRENT_ROWS: 2}, AbortController, TextEncoder, ReadableStream, URL,
    process: {env: {OPENAI_API_KEY:'synthetic',FIRECRAWL_API_KEY:'synthetic'}}, console: {log(){},error(){}},
  });
}
function request(signal) { return new Request('http://localhost/api/enrich', {method:'POST',signal,body:JSON.stringify({rows:[{email:'a@example.com'},{email:'b@example.com'},{email:'c@example.com'}], fields:[{name:'name',displayName:'Name',description:'Company name',type:'string',required:false}], emailColumn:'email'})}); }
async function session(reader) {
  const first = new TextDecoder().decode((await reader.read()).value);
  return JSON.parse(first.slice(6)).sessionId;
}
test('DELETE cancellation is terminal and late worker progress cannot enqueue into a closed stream', async () => {
  let release;
  const gate = new Promise(resolve => { release=resolve; });
  let started=0;
  const api = route(async (row, fields, emailColumn, progress, agentProgress) => {
    started++; await gate; agentProgress('late progress','info');
    return {originalData:row,enrichments:{},status:'completed'};
  });
  const response = await api.POST(request());
  const reader = response.body.getReader();
  const id = await session(reader);
  await api.DELETE(new Request(`http://localhost/api/enrich?sessionId=${id}`, {method:'DELETE'}));
  release();
  let remaining='';
  while(true) {const {done,value}=await reader.read();if(done)break;remaining+=new TextDecoder().decode(value);}
  assert.match(remaining, /"type":"cancelled"/);
  assert.doesNotMatch(remaining, /"type":"complete"|late progress|"type":"result"/);
  assert.equal(started,2,'queued rows must never start after cancellation');
});
test('disconnecting response cancels queued work and rejects no background worker writes', async () => {
  let release; const gate=new Promise(resolve=>{release=resolve;});let started=0;
  const api=route(async (row,fields,emailColumn,progress,agentProgress)=>{started++;await gate;agentProgress('late','info');return {enrichments:{},status:'completed'};});
  const response=await api.POST(request());const reader=response.body.getReader();const id=await session(reader);
  await reader.cancel();release();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(started,2);
  assert.equal((await api.DELETE(new Request(`http://localhost/api/enrich?sessionId=${id}`,{method:'DELETE'}))).status,404);
});
test('request abort wakes the scheduler before in-flight work completes', {timeout:1000}, async () => {
  let release; const gate=new Promise(resolve=>{release=resolve;});
  const controller=new AbortController();let started=0;
  const api=route(async()=>{started++;await gate;return {enrichments:{},status:'completed'};});
  const response=await api.POST(request(controller.signal));const reader=response.body.getReader();await session(reader);
  controller.abort();
  try {
    let output='';while(true){const {done,value}=await reader.read();if(done)break;output+=new TextDecoder().decode(value);}
    assert.match(output,/"type":"cancelled"/);assert.doesNotMatch(output,/"type":"complete"/);assert.equal(started,2);
  } finally {release();}
});
test('ordinary completion still returns every row and one completion event', async () => {
  const api=route(async(row)=>({originalData:row,enrichments:{},status:'completed'}));
  const response=await api.POST(request());const output=await response.text();
  assert.equal((output.match(/"type":"result"/g)||[]).length,3);
  assert.equal((output.match(/"type":"complete"/g)||[]).length,1);
  assert.doesNotMatch(output,/"type":"cancelled"/);
});
