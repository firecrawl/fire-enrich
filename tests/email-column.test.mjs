import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const source=stripTypeScriptTypes(fs.readFileSync(new URL('../lib/utils/email-detection.ts',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const detectEmailColumn=vm.runInNewContext(`(function(){${source};return detectEmailColumn;})()`);
test('observed email values outrank a misleading email header',()=>{
 const rows=Array.from({length:10},(_,i)=>({email:i===0?'one@example.com':'unknown',value:`person${i}@example.org`}));
 const result=detectEmailColumn(rows,['email','value']);assert.equal(result.columnName,'value');assert.equal(result.columnIndex,1);assert.equal(result.confidence,100);
});
test('header hints break ties only between columns containing email values',()=>{
 const result=detectEmailColumn([{value:'a@example.com',email:'b@example.com'}],['value','email']);assert.equal(result.columnName,'email');assert.equal(result.confidence,100);
});
test('no observed email means no inferred column or confidence',()=>{
 const result=detectEmailColumn([{email:'unknown',contact:'Main office'}],['email','contact']);assert.equal(result.columnName,null);assert.equal(result.columnIndex,-1);assert.equal(result.confidence,0);
});
test('sparse email evidence never becomes high confidence from a header bonus',()=>{
 const rows=Array.from({length:10},(_,i)=>({email:i===0?'a@example.com':''}));assert.equal(detectEmailColumn(rows,['email']).confidence,10);
});
for(const file of ['unified-enrichment-view.tsx','csv-preview.tsx']){
 test(`${file} clears inferred selection when replacement CSV has no matching column`,()=>{
  const component=fs.readFileSync(new URL(`../app/fire-enrich/${file}`,import.meta.url),'utf8');const anchor=file.startsWith('unified')?component.indexOf('// Auto-detect email column'):0;const start=component.indexOf('  useEffect(() => {',anchor);const end=component.indexOf('}, [rows, columns]);',start)+'}, [rows, columns]);'.length;const effect=stripTypeScriptTypes(component.slice(start,end));let selected='previous_email';
  vm.runInNewContext(effect,{useEffect:fn=>fn(),rows:[{name:'Example'}],columns:['name'],detectEmailColumn,setEmailColumn:value=>{selected=value;},setSelectedColumn:value=>{selected=value;},setDetectedColumn:()=>{}});
  assert.equal(selected,'');
 });
}
