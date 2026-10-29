import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { isGroundedEvidence } from '../lib/utils/source-evidence.ts';
import { validateSnippetContainsValue } from '../lib/utils/source-context.ts';

const quote = 'Our headquarters are in Paris beside the historic riverfront.';
const source = (url, body, title = 'Company information') => `URL: ${url}\n[PAGE TITLE - NOT CONTENT]: ${title}\n\n=== ACTUAL CONTENT BELOW ===\n${body}`;
const content = source('https://acme.test/about', quote) + '\n\n---\n\n' + source('https://news.test/story', 'The company announced a new distribution office in Berlin.');

function service(evidence, legacy = false) {
  let code = stripTypeScriptTypes(readFileSync(new URL('../lib/services/openai.ts', import.meta.url), 'utf8'), { mode: 'transform' });
  code = code.replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
  code = code.replace(/const \{ validateSnippetContainsValue \} = await import\('\.\.\/utils\/source-context'\);/g, '');
  const OpenAIService = vm.runInNewContext(`(function(){${code};return OpenAIService;})()`, {
    OpenAI: class { chat = { completions: { create: async () => ({ choices: [{ message: { content: JSON.stringify(legacy ? { location: 'Paris', location_confidence: 0.9, location_sources: [{ url: evidence.source_url, quote: evidence.exact_text }] } : { location: {
      evidence: [evidence], consensus_value: 'Paris', consensus_confidence: 0.9, sources_agree: true,
    } }) } }] }) } }; },
    zodResponseFormat: () => ({}), isGroundedEvidence, validateSnippetContainsValue, URL,
    console: { log() {}, error() {}, warn() {} },
  });
  const instance = new OpenAIService('synthetic');
  instance.createCorroboratedEnrichmentSchema = () => ({});
  instance.createEnrichmentSchema = () => ({});
  return instance;
}
const fields = [{ name: 'location', displayName: 'Location', type: 'string', description: 'Office location', required: false }];
const evidence = (source_url, exact_text = quote) => ({ value: 'Paris', confidence: 0.9, source_url, exact_text });

for (const [name, value] of [
  ['invented source URL', evidence('https://invented.test/about')],
  ['quote assigned to a different retrieved page', evidence('https://news.test/story')],
  ['invented sentence', evidence('https://acme.test/about', 'Our offices are in Paris and employ more than fifty specialists.')],
  ['empty URL', evidence('')],
  ['non-HTTP URL', evidence('file:///tmp/research')],
]) {
  test(`legacy extraction excludes ${name}`, async () => {
    const result = await service(value, true).extractStructuredDataOriginal(content, fields, {});
    assert.equal(Object.keys(result).length, 0);
  });
  test(`corroboration excludes ${name}`, async () => {
    const result = await service(value).extractStructuredDataWithCorroboration(content, fields, {});
    assert.equal(Object.keys(result).length, 0);
  });
}

test('grounded source quote remains in the returned result', async () => {
  const result = await service(evidence('https://acme.test/about')).extractStructuredDataWithCorroboration(content, fields, {});
  assert.equal(result.location.value, 'Paris');
  assert.equal(result.location.sourceContext[0].snippet, quote);
});

test('body whitespace normalization preserves multiline quotes', () => {
  assert.equal(isGroundedEvidence(source('https://acme.test/about', quote.replace('in Paris', 'in\n  Paris')), 'https://acme.test/about', quote), true);
});

test('a title and a quote beyond the submitted content cannot support evidence', () => {
  assert.equal(isGroundedEvidence(source('https://acme.test/about', 'No location was supplied.', quote), 'https://acme.test/about', quote), false);
  assert.equal(isGroundedEvidence(content.slice(0, content.indexOf('Paris')), 'https://acme.test/about', quote), false);
});

test('legacy extraction retains a grounded quote', async () => {
  const result = await service(evidence('https://acme.test/about'), true).extractStructuredDataOriginal(content, fields, {});
  assert.equal(result.location.value, 'Paris');
});

test('corroboration fallback cannot bypass source grounding', async () => {
  const instance = service(evidence('https://invented.test/about'), true);
  instance.createCorroboratedEnrichmentSchema = () => { throw new Error('controlled schema failure'); };
  const result = await instance.extractStructuredDataWithCorroboration(content, fields, {});
  assert.equal(Object.keys(result).length, 0);
});
