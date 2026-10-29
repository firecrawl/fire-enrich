import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function client(){
 const state=[],refs=[],cleanup=[],requests=[];let cursor=0,refCursor=0,chat,releaseDelete;
 const hooks={...React,useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];},useRef(initial){const i=refCursor++;return refs[i]??=( {current:initial});},useEffect(effect,deps){if(deps?.length===0){const fn=effect();if(fn)cleanup.push(fn);}},useCallback:fn=>fn};
 const source=fs.readFileSync(new URL('../app/fire-enrich/enrichment-table.tsx',import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;const exports={};const pass=({children})=>React.createElement('div',null,children);
 vm.runInNewContext(js,{exports,require:name=>{if(name==='react')return hooks;if(name==='react/jsx-runtime')return require(name);if(name==='@/lib/utils/sse')return require('../lib/utils/sse.ts');if(name==='./chat-panel')return{ChatPanel:props=>{chat=props;return null;}};if(name==='lucide-react')return new Proxy({},{get:()=>()=>null});if(name==='sonner')return{toast:{success(){}}};if(name.includes('/dialog'))return{Dialog:()=>null};return new Proxy({},{get:()=>pass});},AbortController,localStorage:{getItem:()=>null},fetch:async(url,options)=>{requests.push({url,...options});if(options.method==='DELETE')return new Promise(resolve=>{releaseDelete=()=>resolve(new Response('{}'));});let controller;const stream=new ReadableStream({start(value){controller=value;}});options.signal?.addEventListener('abort',()=>controller.error(new DOMException('Aborted','AbortError')),{once:true});requests.at(-1).complete=()=>{controller.enqueue(new TextEncoder().encode('data: {"type":"response","message":"Synthetic reply"}\n\n'));controller.close();};return new Response(stream);},console:{error(){}},TextDecoder,setTimeout:()=>0,clearTimeout(){}});
 const render=()=>{cursor=0;refCursor=0;cleanup.length=0;renderToStaticMarkup(React.createElement(exports.EnrichmentTable,{rows:[{email:'fixture@synthetic.invalid'}],fields:[],emailColumn:'email'}));return chat;};
 return{render,requests,unmount:()=>cleanup.forEach(fn=>fn()),releaseDelete:()=>releaseDelete?.()};
}
test('Stop aborts the chat request and clears processing before DELETE resolves',async()=>{const ui=client();const pending=ui.render().onSendMessage('Synthetic question');await new Promise(resolve=>setImmediate(resolve));const stop=ui.render().onStopQuery();assert.equal(ui.requests[0].signal?.aborted,true);assert.equal(ui.render().isProcessing,false);ui.releaseDelete();await stop;await pending;});
test('unmount aborts an in-flight chat request',async()=>{const ui=client();const pending=ui.render().onSendMessage('Synthetic question');await new Promise(resolve=>setImmediate(resolve));ui.unmount();assert.equal(ui.requests[0].signal?.aborted,true);await pending;});
test('a replaced request cannot clear processing state for the new request',async()=>{const ui=client();const first=ui.render().onSendMessage('First question');await new Promise(resolve=>setImmediate(resolve));const second=ui.render().onSendMessage('Second question');await new Promise(resolve=>setImmediate(resolve));assert.equal(ui.requests[0].signal?.aborted,true);await first;assert.equal(ui.render().isProcessing,true);ui.requests[1].complete();await second;assert.equal(ui.render().isProcessing,false);});
