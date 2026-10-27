import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {generateVariableName} from '../lib/utils/field-utils.ts';
async function generate(fields,selectedFields=[]){
 const source=fs.readFileSync(new URL('../app/fire-enrich/unified-enrichment-view.tsx',import.meta.url),'utf8');const start=source.indexOf('  const handleGenerateFields = async () => {');const end=source.indexOf('  const handleAddCustomField',start);
 const callback=stripTypeScriptTypes(source.slice(start,end));let suggested;const noop=()=>{};
 await vm.runInNewContext(`(function(){${callback};return handleGenerateFields();})()`,{naturalLanguageInput:'Synthetic fields',selectedFields,generateVariableName,localStorage:{getItem:()=>null},fetch:async()=>({ok:true,json:async()=>({success:true,data:{fields}})}),setSuggestedFields:fields=>{suggested=fields;},setIsGenerating:noop,setShowNaturalLanguage:noop,setNaturalLanguageInput:noop,toast:{error:message=>assert.fail(message)},console:{error:noop}});
 return suggested;
}
test('generated batch reserves each new identifier before mapping the next field',async()=>{
 const selected=[{name:'team_size'}];const fields=await generate([{displayName:'Team Size',description:'Headcount',type:'number'},{displayName:'Team-Size',description:'Band',type:'string'},{displayName:'Team Size',description:'Historical count',type:'number'}],selected);
 assert.deepEqual(Array.from(fields,f=>f.name),['team_size_2','team_size_3','team_size_4']);assert.equal(selected.length,1);assert.equal(new Set(fields.map(f=>f.name)).size,3);
});
test('array fields preserve their requested schema through suggestion conversion',async()=>{
 const fields=await generate([{displayName:'Products',description:'Product names',type:'array'},{displayName:'Active',description:'Active status',type:'boolean'},{displayName:'Legacy Text',description:'Compatibility',type:'text'}]);
 assert.deepEqual(Array.from(fields,f=>f.type),['array','boolean','string']);assert.deepEqual(Array.from(fields,f=>f.required),[false,false,false]);
});
