import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const source = fs.readFileSync(new URL('../app/fire-enrich/unified-enrichment-view.tsx', import.meta.url), 'utf8');
const addStart = source.indexOf('  const handleAddField =');
const addEnd = source.indexOf('  const handleRemoveField', addStart);
const add = stripTypeScriptTypes(source.slice(addStart, addEnd));
const suggestions = source.slice(source.indexOf('{/* Suggested fields */}'));
const accept = suggestions.match(/onClick=\{\(\) => \{([\s\S]*?)\}\}/)[1];
for (const count of [9, 10]) test(`accept with ${count} selected fields consumes only admitted suggestions`, () => {
  const field = {name: 'requested_signal', displayName: 'Requested signal'};
  const context = {selectedFields: Array.from({length: count}, (_, index) => ({name: `existing_${index}`})), suggestedFields: [field], field, idx: 0, toast: {error() {}}};
  context.setSelectedFields = value => {context.selectedFields = value;};
  context.setSuggestedFields = value => {context.suggestedFields = value;};
  const onAccept = vm.runInNewContext(`(function(){${add};return () => {${accept}};})()`, context);
  onAccept();
  assert.equal(context.selectedFields.length, 10);
  assert.equal(context.suggestedFields.length, count === 10 ? 1 : 0);
  if (count === 10) {
    context.selectedFields = context.selectedFields.slice(0, 9);
    onAccept();
    assert.equal(context.selectedFields.length, 10);
    assert.equal(context.selectedFields.at(-1).name, field.name);
    assert.equal(context.suggestedFields.length, 0, 'retry admits the retained definition after freeing a slot');
  }
});
