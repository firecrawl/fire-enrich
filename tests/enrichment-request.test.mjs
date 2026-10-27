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
const valid = {rows:[{email:'a@example.com'}],fields:[{name:'company',displayName:'Company',description:'Company name',type:'string',required:false}],emailColumn:'email'};
async function invoke(body) {
  let calls=0;const api=route(async()=>{calls++;return {enrichments:{},status:'completed'};});
  const response=await api.POST(new Request('http://localhost/api/enrich',{method:'POST',body:typeof body==='string'?body:JSON.stringify(body)}));
  await response.text();return {status:response.status,calls};
}
test('malformed payloads are rejected before any enrichment provider work',async()=>{
  const invalid=[null, [], {}, {...valid,rows:{}},{...valid,rows:[null]}, {...valid,rows:[{email:42}]}, {...valid,fields:[null]}, {...valid,fields:[{...valid.fields[0],type:'object'}]}, {...valid,fields:[valid.fields[0],valid.fields[0]]}, {...valid,emailColumn:42}, {...valid,nameColumn:42}];
  for(const body of invalid){const result=await invoke(body);assert.equal(result.status,400,JSON.stringify(body));assert.equal(result.calls,0);}
});
test('invalid JSON is a client error',async()=>{assert.deepEqual(await invoke('{'),{status:400,calls:0});});
test('body-size enforcement does not rely on a Content-Length header',async()=>{
  const body=JSON.stringify({...valid,rows:[{email:'a@example.com',notes:'x'.repeat(5*1024*1024)}]});
  assert.deepEqual(await invoke(body),{status:413,calls:0});
});
test('valid requests still enrich every row',async()=>{assert.deepEqual(await invoke(valid),{status:200,calls:1});});
