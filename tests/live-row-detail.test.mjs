import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const source = fs.readFileSync(new URL('../app/fire-enrich/enrichment-table.tsx', import.meta.url), 'utf8');
const stateStart = source.indexOf('  const [selection, setSelectedRow]') >= 0
  ? source.indexOf('  const [selection, setSelectedRow]')
  : source.indexOf('  const [selectedRow, setSelectedRow]');
const stateEnd = source.indexOf('  const [copiedRow', stateStart);
const openStart = source.indexOf('  const openDetailSidebar =');
const openEnd = source.indexOf('  const handleChatMessage', openStart);
const componentSelection = stripTypeScriptTypes(source.slice(stateStart, stateEnd) + source.slice(openStart, openEnd));
for (const initial of [undefined, 'processing']) test(`open detail follows streamed completion from ${initial ?? 'not-yet-queued'} row`, () => {
  const rows = [{email: 'person@example.test'}];
  const results = new Map(initial ? [[0, {status: initial, enrichments: {}}]] : []);
  let state;
  const useState = initialState => {
    if (state === undefined) state = initialState;
    return [state, value => {state = typeof value === 'function' ? value(state) : value;}];
  };
  const render = () => vm.runInNewContext(`(function(){${componentSelection};return {selectedRow, openDetailSidebar};})()`, {rows, results, useState});
  render().openDetailSidebar(0);
  assert.equal(render().selectedRow.isOpen, true);
  const completed = {status: 'completed', enrichments: {company: {value: 'Verified Company'}}};
  results.set(0, completed);
  assert.equal(render().selectedRow.result, completed, 'selection uses current streamed result without reopening');
  render().openDetailSidebar(-1);
  assert.equal(render().selectedRow.result, undefined, 'a different selection does not retain the old result');
});
