import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url);
// Unit harness compiles the full production component, controls hook state and
// child boundaries, and renders its JSX with React's real server renderer.
function table(statuses){
 const rows=statuses.map((_,i)=>({email:`row${i}@fixture.invalid`}));const results=new Map(statuses.flatMap((status,i)=>status?[[i,{rowIndex:i,originalData:rows[i],status,enrichments:{}}]]:[]));
 let maps=0,chat,request,blob;
 const hooks={...React,useState:initial=>[initial?.constructor?.name==='Map'&&maps++===0?results:initial==='idle'?'processing':initial,()=>{}],useEffect(){},useCallback:fn=>fn,useRef:value=>({current:value})};
 const source=fs.readFileSync(new URL('../app/fire-enrich/enrichment-table.tsx',import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;const exports={};
 const pass=({children})=>React.createElement('div',null,children);
 vm.runInNewContext(js,{exports,require:name=>{if(name==='react')return hooks;if(name==='react/jsx-runtime')return require(name);if(name==='./chat-panel')return{ChatPanel:props=>{chat=props;return null;}};if(name==='lucide-react')return new Proxy({},{get:()=>()=>null});if(name==='sonner')return{toast:{success(){}}};if(name.includes('/dialog'))return{Dialog:()=>null};return new Proxy({},{get:()=>pass});},localStorage:{getItem:()=>null},fetch:async(url,options)=>{request=JSON.parse(options.body);return new Response('');},URL:{createObjectURL:value=>{blob=value;return'blob:local-fixture';},revokeObjectURL(){}},document:{createElement:()=>({click(){}})},Blob,Response,TextDecoder,console,setTimeout:()=>0,clearTimeout(){}});
 const tree=exports.EnrichmentTable({rows,fields:[{name:'name',displayName:'Name',type:'string'}],emailColumn:'email'});
 const html=renderToStaticMarkup(tree);
 function button(node,label){if(!node||typeof node!=='object')return null;if(Array.isArray(node)){for(const child of node){const found=button(child,label);if(found)return found;}return null;}if(node.type==='button'&&React.Children.toArray(node.props.children).some(child=>typeof child==='string'&&child.trim()===label))return node;return button(node.props?.children,label);}
 return{html,json:async()=>{button(tree,'JSON').props.onClick();return JSON.parse(await blob.text());},chat:async()=>{await chat.onSendMessage('Read row progress');return request;}};
}
test('only completed, skipped and error rows count as processed',()=>{
 const{html}=table(['completed','skipped','error','processing','pending',null]);assert.ok(html.includes('3 of 6 rows processed'),html);
});
test('JSON preserves each row state and reports only terminal rows',async()=>{
 const data=await table(['completed','skipped','error','processing','pending',null]).json();assert.equal(data.metadata.processedRows,3);assert.deepEqual(data.data.map(row=>row._status),['enriched','skipped','error','processing','pending','pending']);
});
test('chat progress metadata excludes unfinished rows',async()=>{
 const request=await table(['completed','processing','pending']).chat();assert.equal(request.context.processedRows,1);
});
test('queued rows alone report zero processed',async()=>{
 const tableView=table(['pending','pending','processing']);assert.equal((await tableView.json()).metadata.processedRows,0);
});
