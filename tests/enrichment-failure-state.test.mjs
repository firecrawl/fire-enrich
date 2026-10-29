import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url);
// Full-module component unit harness; hook state/children are controlled.
// Production-browser HTTP verification is recorded separately.
async function run(response){
 let status='idle',start;const errors=[];
 const hooks={...React,useState:initial=>initial==='idle'?[status,value=>{status=value;}]:[initial,()=>{}],useEffect(){},useCallback:fn=>{if(!start&&fn.constructor.name==='AsyncFunction')start=fn;return fn;},useRef:value=>({current:value})};
 const pass=({children})=>React.createElement('div',null,children);
 const source=fs.readFileSync(new URL('../app/fire-enrich/enrichment-table.tsx',import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;const exports={};
 vm.runInNewContext(js,{exports,require:name=>{if(name==='react')return hooks;if(name==='react/jsx-runtime')return require(name);if(name==='@/lib/utils/sse')return require('../lib/utils/sse.ts');if(name==='lucide-react')return new Proxy({},{get:()=>()=>null});if(name==='sonner')return{toast:{success(){},error:message=>errors.push(message)}};if(name.includes('/dialog'))return{Dialog:()=>null};return new Proxy({},{get:()=>pass});},localStorage:{getItem:()=>null},fetch:async()=>{if(response instanceof Error)throw response;return response;},console:{error(){}},AbortController,TextDecoder,setTimeout:()=>0,clearTimeout(){}});
 const props={rows:[{email:'synthetic@fixture.invalid'}],fields:[{name:'companyName',displayName:'Name',type:'string'}],emailColumn:'email'};
 exports.EnrichmentTable(props);await start();const html=renderToStaticMarkup(React.createElement(exports.EnrichmentTable,props));return{status,html,errors};
}
for(const code of [401,500])test(`HTTP ${code} displays failed state and notifies the user`,async()=>{const result=await run(new Response('{}',{status:code}));assert.equal(result.status,'error');assert.ok(result.html.includes('Enrichment Failed'));assert.ok(!result.html.includes('Enrichment Complete'));assert.equal(result.errors.length,1);});
test('network rejection displays failed state',async()=>assert.equal((await run(new Error('Synthetic transport failure'))).status,'error'));
test('missing response body displays failed state',async()=>assert.equal((await run({ok:true,body:null})).status,'error'));
test('server error event displays failed state',async()=>{const result=await run(new Response('data: {"type":"error","error":"Synthetic service failure"}\n\n'));assert.equal(result.status,'error');assert.equal(result.errors.length,1);});
test('a genuine complete event still completes successfully',async()=>{const result=await run(new Response('data: {"type":"complete"}\n\n'));assert.equal(result.status,'completed');assert.ok(result.html.includes('Enrichment Complete'));assert.equal(result.errors.length,0);});
test('a cancelled event retains cancelled status',async()=>assert.equal((await run(new Response('data: {"type":"cancelled"}\n\n'))).status,'cancelled'));
