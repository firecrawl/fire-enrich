import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
function route(env, calls) {
 let source=fs.readFileSync(new URL('../app/api/generate-fields/route.ts',import.meta.url),'utf8');
 source=stripTypeScriptTypes(source).replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
 return vm.runInNewContext(`(function(){${source};return POST;})()`,{
  NextResponse:Response,process:{env},console:{error(){}},FieldGenerationResponse:{},zodResponseFormat:()=>({json_schema:{schema:{}}}),
  OpenAI:class{constructor(options){calls.push(options);this.chat={completions:{create:async()=>({choices:[{message:{content:JSON.stringify({fields:[],interpretation:'Synthetic'})}}]})}};}}
 });
}
const request=(key)=>new Request('http://localhost/api/generate-fields',{method:'POST',headers:key?{'X-OpenAI-API-Key':key}:{},body:JSON.stringify({prompt:'Company size'})});
test('browser-only OpenAI key can generate fields without server credentials',async()=>{
 const calls=[];const response=await route({},calls)(request('synthetic-browser-key'));
 assert.equal(response.status,200);assert.equal(calls[0].apiKey,'synthetic-browser-key');assert.equal((await response.json()).success,true);
});
test('server credential retains precedence and missing credentials never invoke provider',async()=>{
 const calls=[];assert.equal((await route({OPENAI_API_KEY:'synthetic-server-key'},calls)(request('synthetic-browser-key'))).status,200);assert.equal(calls[0].apiKey,'synthetic-server-key');
 const absent=[];assert.equal((await route({},absent)(request())).status,500);assert.equal(absent.length,0);
});
for(const [file,name,next,prompt] of [['unified-enrichment-view.tsx','handleGenerateFields','handleAddCustomField','naturalLanguageInput'],['field-mapper.tsx','generateFieldsFromNL','acceptSuggestedFields','nlPrompt']]){
 for (const storageBlocked of [false, true]) {
 test(`${file} ${storageBlocked ? 'still requests fields when storage is blocked' : 'forwards the locally configured key'}`,async()=>{
  const source=fs.readFileSync(new URL(`../app/fire-enrich/${file}`,import.meta.url),'utf8');const start=source.indexOf(`  const ${name} = async () => {`);const end=source.indexOf(`  const ${next}`,start);
  const callback=stripTypeScriptTypes(source.slice(start,end));let sent;
  const noop=()=>{};
  const result=vm.runInNewContext(`(function(){${callback};return ${name}();})()`,{[prompt]:'Company size',localStorage:{getItem:k=>{if(storageBlocked) throw new Error('Storage blocked');return k==='openai_api_key'?'synthetic-browser-key':null;}},fetch:async(url,options)=>{sent=options;return{ok:true,json:async()=>({success:true,data:{fields:[]}})}},setIsGenerating:noop,setSuggestedFields:noop,setShowSuggestions:noop,setShowNaturalLanguage:noop,setNaturalLanguageInput:noop,generateVariableName:()=>'',selectedFields:[],toast:{error:noop},console:{error:noop}});
  await result;assert.equal(sent.headers['X-OpenAI-API-Key'],storageBlocked?undefined:'synthetic-browser-key');assert.equal(JSON.parse(sent.body).prompt,'Company size');assert.equal(Object.hasOwn(JSON.parse(sent.body),'apiKey'),false);
 });
 }
}
