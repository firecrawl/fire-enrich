import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import test from 'node:test';
import './resolve-typescript.mjs';
const { OpenAIService } = await import('../lib/services/openai.ts');

const source = 'https://fixture.invalid/annual-report';
const evidence = (value, extra = {}) => ({
  value, source_url: source,
  exact_text: `The company's recorded metric is ${value} according to its published annual report.`,
  confidence: .95, ...extra
});
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const host = first && typeof first === 'object' ? first.host : typeof args[1] === 'string' ? args[1] : undefined;
  if (host && !['127.0.0.1', '::1', 'localhost'].includes(host)) throw new Error('External socket refused');
  return Reflect.apply(originalConnect, this, args);
};

async function extract(value, entries, type = 'number') {
  let requests = 0;
  const payload = { metric: { evidence: entries, consensus_value: value, consensus_confidence: .98, sources_agree: false } };
  const server = http.createServer(async (req, res) => {
    for await (const _ of req) { /* drain actual SDK request */ }
    requests++;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: 'chatcmpl-fixture', object: 'chat.completion', created: 0,
      model: 'gpt-5', choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(payload) }, finish_reason: 'stop' }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const previous = process.env.OPENAI_BASE_URL;
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${server.address().port}/v1`;
  try {
    const fields = [{ name: 'metric', displayName: 'Metric', description: 'Recorded metric', type, required: false }];
    const content = `URL: ${source}\n${entries.map(entry => entry.exact_text).join('\n')}`;
    const result = await new OpenAIService('local-fixture').extractStructuredDataWithCorroboration(content, fields, {});
    assert.equal(requests, 1, 'Rejecting a field must not silently rerun original extraction');
    return result.metric;
  } finally {
    if (previous === undefined) delete process.env.OPENAI_BASE_URL;
    else process.env.OPENAI_BASE_URL = previous;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

for (const [name, type, consensus, entries] of [
 ['text absent from evidence', 'string', 'Berlin', [evidence('Paris')]],
 ['opposite boolean', 'boolean', true, [evidence(false)]],
 ['unsupported list member', 'array', ['React', 'Vue'], [evidence(['React'])]],
 ['unsupported empty list', 'array', [], [evidence(['React'])]],
 ['wrong consensus type', 'boolean', 'false', [evidence(false)]],
]) test(`rejects ${name}`, async () => assert.equal(await extract(consensus, entries, type), undefined));

test('retains supported text with capitalization changes', async () => {
 assert.equal((await extract('PARIS', [evidence('Paris')], 'string'))?.value, 'PARIS');
});
test('retains text with normalized whitespace', async () => {
 assert.equal((await extract('New York', [evidence('New   York')], 'string'))?.value, 'New York');
});
test('retains a supported false boolean', async () => {
 assert.equal((await extract(false, [evidence(false)], 'boolean'))?.value, false);
});
test('retains a list supported across several sources', async () => {
 assert.deepEqual((await extract(['React', 'Vue'], [evidence(['React']), evidence(['Vue'])], 'array'))?.value, ['React', 'Vue']);
});
test('numeric consensus guard remains intact', async () => {
 assert.equal(await extract(200, [evidence(100)], 'number'), undefined);
 assert.equal((await extract(100, [evidence(100)], 'number'))?.value, 100);
});
