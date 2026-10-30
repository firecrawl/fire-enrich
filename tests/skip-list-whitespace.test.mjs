import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import net from 'node:net';
import fs from 'node:fs';
import ts from 'typescript';
registerHooks({ load(url, context, nextLoad) {
  if (url.startsWith('file:') && url.endsWith('.ts') && !url.includes('/node_modules/')) return { format: 'module', shortCircuit: true, source: ts.transpileModule(fs.readFileSync(new URL(url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText };
  return nextLoad(url, context);
}, resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) specifier = new URL('../' + specifier.slice(2), import.meta.url).href;
  if (specifier === 'next/server') specifier = 'next/server.js';
  try { return nextResolve(specifier, context); } catch(error) {
    if (['ERR_MODULE_NOT_FOUND', 'ERR_UNSUPPORTED_DIR_IMPORT'].includes(error.code) && (specifier.startsWith('.') || specifier.startsWith('file:'))) {
      for (const suffix of ['.ts', '/index.ts']) { try { return nextResolve(specifier + suffix, context); } catch {} }
    } throw error;
  }
}});
const { shouldSkipEmail, getSkipReason } = await import('../lib/utils/skip-list.ts');
const skipList = new Set(['gmail.com', 'blocked.invalid']);
for (const email of ['person@gmail.com ', ' person@GMAIL.COM\t', 'student@school.edu\r\n', 'person@blocked.invalid ']) {
  test(`skip-list ignores surrounding CSV whitespace: ${JSON.stringify(email)}`, () => {
    assert.equal(shouldSkipEmail(email, skipList), true);
    assert.equal(getSkipReason(email, skipList), getSkipReason(email.trim(), skipList));
  });
}
test('corporate domains and suffix lookalikes remain eligible', () => {
  for (const email of [' person@company.invalid ', 'person@gmail.com.company.invalid', 'person@school.edu.invalid']) assert.equal(shouldSkipEmail(email, skipList), false);
});
test('actual enrichment route skips padded provider emails and preserves original CSV data', async () => {
  const { POST } = await import('../app/api/enrich/route.ts');
  const { NextRequest } = await import('next/server.js');
  const originalConnect = net.Socket.prototype.connect;
  let providerConnections = 0;
  net.Socket.prototype.connect = function() { providerConnections++; throw new Error('Provider calls are forbidden in this fixture'); };
  const previous = { openai: process.env.OPENAI_API_KEY, firecrawl: process.env.FIRECRAWL_API_KEY };
  process.env.OPENAI_API_KEY = 'synthetic-local-key'; process.env.FIRECRAWL_API_KEY = 'synthetic-local-key';
  const email = 'person@gmail.com ';
  try {
    const response = await POST(new NextRequest('http://localhost/api/enrich', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({rows:[{email}],emailColumn:'email',fields:[{name:'company',displayName:'Company',description:'Company name',type:'string',required:false}]}) }));
    assert.equal(response.status, 200);
    const stream = await response.text();
    const events = stream.split('\n\n').filter(part => part.startsWith('data: ')).map(part => JSON.parse(part.slice(6)));
    const rowEvent = events.find(event => event.result?.status === 'skipped');
    assert.ok(rowEvent, 'route should emit a skipped row rather than research the provider');
    assert.equal(rowEvent.result.originalData.email, email);
    assert.equal(providerConnections, 0);
  } finally {
    net.Socket.prototype.connect = originalConnect;
    for (const [key,value] of [['OPENAI_API_KEY',previous.openai],['FIRECRAWL_API_KEY',previous.firecrawl]]) { if(value===undefined)delete process.env[key];else process.env[key]=value; }
  }
});
