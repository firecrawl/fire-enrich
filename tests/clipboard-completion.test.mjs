import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const source = fs.readFileSync(new URL('../app/fire-enrich/enrichment-table.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  const copyToClipboard =');
const end = source.indexOf('  const openDetailSidebar', start);
const callbacks = stripTypeScriptTypes(source.slice(start, end));
for (const denied of [false, true]) test(`row copy reports completion only after clipboard ${denied ? 'rejects' : 'resolves'}`, async () => {
  let settle, copied = null;
  const feedback = [];
  const rows = [{email: 'person@example.test'}];
  const result = {enrichments: {company: {value: 'Verified Company'}}};
  const copy = vm.runInNewContext(`(function(){${callbacks};return copyRowData;})()`, {
    rows, results: new Map([[0, result]]), emailColumn: 'email', fields: [{name: 'company', displayName: 'Company'}],
    navigator: {clipboard: {writeText: text => {
      assert.match(text, /Verified Company/);
      return new Promise((resolve, reject) => {settle = {resolve, reject};});
    }}},
    setCopiedRow: value => {copied = value;},
    toast: {success: message => feedback.push(['success', message]), error: message => feedback.push(['error', message])},
    console: {error() {}}, setTimeout: () => {},
  });
  const pending = copy(0);
  assert.equal(feedback.length, 0, 'pending writes must not claim success');
  assert.equal(copied, null);
  if (denied) settle.reject(new Error('Clipboard permission denied'));
  else settle.resolve();
  await pending;
  assert.equal(feedback.length, 1);
  assert.equal(feedback[0][0], denied ? 'error' : 'success');
  assert.equal(copied, denied ? null : 0);
});
