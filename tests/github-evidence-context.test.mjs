import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import test from 'node:test';
import './resolve-typescript.mjs';
const { OpenAIService } = await import('../lib/services/openai.ts');

const github = 'https://github.com/fixture/product';
const secondGithub = 'https://github.com/fixture/second-product';
const unknownGithub = 'https://github.com/unprovided/project';
const website = 'https://fixture.invalid/engineering';
const quote = 'Our frontend uses React to render the customer dashboard according to the project documentation.';
const evidence = source_url => ({ value: ['React'], source_url, exact_text: quote, confidence: .95 });
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const host = first && typeof first === 'object' ? first.host : typeof args[1] === 'string' ? args[1] : undefined;
  if (host && !['127.0.0.1', '::1', 'localhost'].includes(host)) throw new Error('External socket refused');
  return Reflect.apply(connect, this, args);
};

async function extract(entries, context, name = 'techStack') {
  const calls = [], messages = [];
  const payload = { [name]: { evidence: entries, consensus_value: ['React'], consensus_confidence: .95, sources_agree: true } };
  const server = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    calls.push({ path: req.url, body: JSON.parse(raw) });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: 'local-fixture', object: 'chat.completion', created: 0, model: 'gpt-5',
      choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(payload) }, finish_reason: 'stop' }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const prior = {};
  for (const key of ['OPENAI_BASE_URL', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) {
    prior[key] = process.env[key]; delete process.env[key];
  }
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${server.address().port}/v1`;
  try {
    const content = entries.map(e => `URL: ${e.source_url}\n[PAGE TITLE - NOT CONTENT]: Project documentation\n\n=== ACTUAL CONTENT BELOW ===\n${e.exact_text}`).join('\n\n---\n\n');
    const result = await new OpenAIService('synthetic-local-fixture').extractStructuredDataWithCorroboration(
      content, [{ name, displayName: name, description: 'Technology libraries used by the company', type: 'array', required: false }], context,
      (...args) => messages.push(args));
    assert.equal(calls.length, 1, 'Evidence rejection must not trigger fallback model work');
    assert.equal(calls[0].path, '/v1/chat/completions');
    return { result: result[name], messages };
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
}

function assertSources(result, urls) {
  assert.deepEqual(result?.corroboration?.evidence.map(e => e.source_url), urls);
  assert.deepEqual(result?.sourceContext?.map(e => e.url), urls);
  assert.equal(result?.source, urls.join(', '));
}

test('retains GitHub evidence with the string context produced by the orchestrator', async () => {
  const context = { validGithubUrls: [github].join(', ') };
  const { result } = await extract([evidence(github)], context);
  assert.deepEqual(result?.value, ['React']); assertSources(result, [github]);
});
test('retains every provided URL from a comma-separated context with whitespace', async () => {
  const { result } = await extract([evidence(github), evidence(secondGithub)], { validGithubUrls: ` ${github}, ${secondGithub} ` });
  assertSources(result, [github, secondGithub]);
});
test('retains legacy array contexts', async () => {
  assertSources((await extract([evidence(github)], { validGithubUrls: [github] })).result, [github]);
});
test('rejects GitHub evidence absent from the whitelist before projecting sources', async () => {
  assert.equal((await extract([evidence(unknownGithub)], { validGithubUrls: github })).result, undefined);
});
test('missing or empty context cannot authenticate a GitHub source', async () => {
  for (const context of [{}, { validGithubUrls: '' }]) assert.equal((await extract([evidence(github)], context)).result, undefined);
});
test('an allowed URL prefix does not authenticate a different URL', async () => {
  assert.equal((await extract([evidence(github + '-other')], { validGithubUrls: github })).result, undefined);
});
test('mixed evidence exposes only whitelisted GitHub sources in every projection', async () => {
  const { result, messages } = await extract([evidence(github), evidence(unknownGithub)], { validGithubUrls: github });
  assertSources(result, [github]); assert.ok(messages.every(args => args[2] !== unknownGithub));
});
test('non-GitHub technology evidence does not require a GitHub whitelist', async () => {
  assertSources((await extract([evidence(website)], {})).result, [website]);
});
test('the existing GitHub restriction remains specific to technology fields', async () => {
  assertSources((await extract([evidence(github)], {}, 'libraries')).result, [github]);
});
