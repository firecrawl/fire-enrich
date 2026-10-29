import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

const source = fs.readFileSync(new URL('../app/fire-enrich/page.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  const handleCSVUpload =');
const end = source.indexOf('  const handleStartEnrichment', start);
const callback = stripTypeScriptTypes(source.slice(start, end));
for (const configured of [false, true]) for (const reverse of [false, true]) test(`latest CSV wins with ${configured ? 'server credentials' : 'credential prompt'} and responses ${reverse ? 'out of order' : 'in order'}`, async () => {
  const responses = [];
  const uploadGeneration = {current: 0};
  let selected;
  const onUpload = vm.runInNewContext(`(function(){${callback};return handleCSVUpload;})()`, {
    uploadGeneration,
    fetch: () => new Promise(resolve => responses.push(resolve)),
    localStorage: {getItem: () => null},
    setCsvData: data => {selected = data;}, setStep: () => {},
    setPendingCSVData: data => {selected = data;}, setMissingKeys: () => {}, setShowApiKeyModal: () => {},
  });
  const requests = [onUpload([{email: 'first@example.test'}], ['email']), onUpload([{email: 'latest@example.test'}], ['email'])];
  for (const index of reverse ? [1, 0] : [0, 1]) {
    responses[index]({json: async () => ({environmentStatus: {FIRECRAWL_API_KEY: configured, OPENAI_API_KEY: configured}})});
    await requests[index];
  }
  assert.equal(selected.rows[0].email, 'latest@example.test');
});
