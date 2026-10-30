import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import test from 'node:test';
import './resolve-typescript.mjs';
const { OpenAIService } = await import('../lib/services/openai.ts');
const url = 'https://fixture.invalid/report';
const quote = 'The company reports revenue of 100 from Subscriptions and Services in its published annual report.';
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const host = first && typeof first === 'object' ? first.host : typeof args[1] === 'string' ? args[1] : undefined;
  if (host && !['127.0.0.1', '::1', 'localhost'].includes(host)) throw new Error('External socket refused');
  return Reflect.apply(connect, this, args);
};

// The fixture obeys the actual requested JSON schema. A metadata collision must
// not change the requested user field's type even when the model follows it.
function compliantValue(schema, requested) {
  if (schema.anyOf) schema = schema.anyOf.find(s => s.type !== 'null');
  const type = Array.isArray(schema.type) ? schema.type.find(t => t !== 'null') : schema.type;
  if (schema.minimum === 0 && schema.maximum === 1) return .95;
  if (type === 'array' && schema.items?.properties?.url && schema.items?.properties?.quote) return [{ url, quote }];
  if (type === 'array') return requested ?? [];
  if (type === 'string') return typeof requested === 'string' ? requested : 'Fixture';
  if (type === 'number') return typeof requested === 'number' ? requested : .95;
  if (type === 'boolean') return requested ?? false;
  throw new Error(`Unexpected fixture schema ${JSON.stringify(schema)}`);
}

async function extract(requested, types, overrides = {}, extraDocuments = []) {
  const fields = Object.keys(requested).map(name => ({ name, displayName: name, description: `Requested ${name}`, type: types[name], required: false }));
  const service = new OpenAIService('synthetic-local-fixture');
  const calls = [];
  const server = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    const properties = body.response_format.json_schema.schema.properties;
    const payload = Object.fromEntries(Object.entries(properties).map(([key, schema]) => [key,
      Object.hasOwn(overrides, key) ? overrides[key] : compliantValue(schema, requested[key])]));
    assert.ok(service.createEnrichmentSchema(fields).safeParse(payload).success, 'Fixture must conform to the actual schema');
    calls.push({ path: req.url, body, payload });
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
    // Construct after selecting the actual SDK HTTP origin.
    const content = [[url, quote], ...extraDocuments].map(([source, text]) =>
      `URL: ${source}\n[PAGE TITLE - NOT CONTENT]: Annual report\n\n=== ACTUAL CONTENT BELOW ===\n${text}`).join('\n\n---\n\n');
    const result = await new OpenAIService('synthetic-local-fixture').extractStructuredDataOriginal(content, fields, {});
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, '/v1/chat/completions');
    return { result, call: calls[0] };
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
}

for (const [name, requested, types] of [
  ['source metadata', { revenue: 100, revenue_sources: ['Subscriptions', 'Services'] }, { revenue: 'number', revenue_sources: 'array' }],
  ['confidence metadata', { revenue: 100, revenue_confidence: 'Verified' }, { revenue: 'number', revenue_confidence: 'string' }],
  ['nested collision candidates', { revenue: 100, revenue_sources: ['Subscriptions'], revenue_sources_1: false, revenue_confidence: 'Verified', revenue_confidence_1: 'Annual report' }, { revenue: 'number', revenue_sources: 'array', revenue_sources_1: 'boolean', revenue_confidence: 'string', revenue_confidence_1: 'string' }],
  ['reordered fields', { revenue_sources_1: false, revenue_sources: ['Subscriptions'], revenue: 100, revenue_confidence_1: 'Annual report', revenue_confidence: 'Verified' }, { revenue_sources_1: 'boolean', revenue_sources: 'array', revenue: 'number', revenue_confidence_1: 'string', revenue_confidence: 'string' }],
]) {
  test(`requested values survive a collision with ${name}`, async () => {
    const { result, call } = await extract(requested, types);
    assert.deepEqual(Object.fromEntries(Object.entries(result).map(([key, value]) => [key, value.value])), requested);
    assert.ok(Object.values(result).every(value => value.confidence === .95));
    assert.ok(Object.values(result).every(value => value.sourceContext?.[0]?.url === url));
    const ordinaryKeys = new Set(Object.keys(requested).flatMap(key => [key, `${key}_confidence`, `${key}_sources`]));
    const allocatedKeys = Object.keys(call.payload).filter(key => !ordinaryKeys.has(key));
    assert.ok(allocatedKeys.every(key => call.body.messages[0].content.includes(JSON.stringify(key))),
      'The prompt must identify metadata properties that moved because of a collision');
  });
}

test('ordinary names keep their legacy metadata keys and values', async () => {
  const { result, call } = await extract({ revenue: 100, profitable: false }, { revenue: 'number', profitable: 'boolean' });
  assert.equal(result.revenue.value, 100);
  assert.equal(result.profitable.value, false);
  assert.deepEqual(Object.keys(call.body.response_format.json_schema.schema.properties).sort(),
    ['revenue', 'profitable', 'revenue_confidence', 'profitable_confidence', 'revenue_sources', 'profitable_sources'].sort());
  assert.ok(!call.body.messages[0].content.includes('avoid overwriting requested values'));
});

test('moved metadata stays attached to its own field', async () => {
  const revenueUrl = 'https://fixture.invalid/revenue';
  const categoriesUrl = 'https://fixture.invalid/categories';
  const revenueQuote = 'The company reported revenue of 100 during the financial reporting period.';
  const categoriesQuote = 'The company derives revenue from Subscriptions and Services for its customers.';
  const { result } = await extract({ revenue: 100, revenue_sources: ['Subscriptions', 'Services'] },
    { revenue: 'number', revenue_sources: 'array' }, {
      revenue_confidence: .91,
      revenue_sources_1: [{ url: revenueUrl, quote: revenueQuote }],
      revenue_sources_confidence: .72,
      revenue_sources_sources: [{ url: categoriesUrl, quote: categoriesQuote }],
    }, [[revenueUrl, revenueQuote], [categoriesUrl, categoriesQuote]]);
  assert.equal(result.revenue.confidence, .91);
  assert.equal(result.revenue.source, revenueUrl);
  assert.equal(result.revenue.sourceContext[0].snippet, revenueQuote);
  assert.equal(result.revenue_sources.confidence, .72);
  assert.equal(result.revenue_sources.source, categoriesUrl);
  assert.deepEqual(result.revenue_sources.value, ['Subscriptions', 'Services']);
});
