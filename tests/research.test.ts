import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { AgentEnrichmentStrategy } from '../lib/strategies/agent-enrichment-strategy';
import { AgentOrchestrator } from '../lib/agent-architecture/orchestrator';
import { OpenAIService } from '../lib/services/openai';
import { FirecrawlService } from '../lib/services/firecrawl';
import { resolveResearchProvider } from '../lib/services/research';
import type { EnrichmentField } from '../lib/types';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/enrich/route';
import { GET as checkEnvironment } from '../app/api/check-env/route';

const originalEnvironment = { ...process.env };
const source = 'https://example.org/company';
const excerpt = 'Research Co builds developer software. Its industry is Software. Its CEO is Alex Example. '.repeat(5);
let requests: Array<{ url: string; headers: Headers; body: any }>;
let synthesis: string[];
let failure: 'http' | 'tool' | 'malformed' | 'quota' | 'timeout' | undefined;
let onCall: (() => void) | undefined;

function field(name: string): EnrichmentField { return { name, description: `Find ${name}` }; }
function response(id: number, result: unknown) {
  return Response.json({ jsonrpc: '2.0', id, result });
}

beforeEach(() => {
  delete process.env.WEB_SEARCH_PROVIDER;
  delete process.env.FIRECRAWL_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.PARALLEL_API_KEY;
  requests = []; synthesis = []; failure = undefined; onCall = undefined;
  mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    assert.equal(url, 'https://search.parallel.ai/mcp');
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('user-agent'), 'fire-enrich/0.1.0 (+https://github.com/firecrawl/fire-enrich)');
    assert.equal(headers.get('authorization'), null);
    if (init?.method === 'GET') return new Response(null, { status: 405 });
    const body = JSON.parse(init?.body as string);
    requests.push({ url, headers, body });
    if (!('id' in body)) return new Response(null, { status: 202 });
    if (body.method === 'initialize') return response(body.id, {
      protocolVersion: '2025-03-26', capabilities: { tools: {} },
      serverInfo: { name: 'research-fixture', version: '1' },
    });
    if (body.method === 'tools/list') return response(body.id, {
      tools: ['web_search', 'web_fetch'].map(name => ({ name, inputSchema: { type: 'object' } })),
    });
    if (body.method === 'tools/call') {
      onCall?.();
      if (failure === 'http') return new Response('Unavailable', { status: 503 });
      if (failure === 'quota') return response(body.id, { isError: true, content: [{ type: 'text', text: 'Anonymous quota exceeded' }] });
      if (failure === 'tool') return response(body.id, { isError: true, content: [{ type: 'text', text: 'Fetch failed' }] });
      if (failure === 'timeout') return new Promise(resolve => {
        init?.signal?.addEventListener('abort', () => resolve(new Response(null, { status: 408 })), { once: true });
      });
      const result = failure === 'malformed' ? { results: [{ url: 'javascript:alert(1)' }] } : {
        results: [{ url: source, title: 'Research Co', excerpts: [excerpt] }],
      };
      return response(body.id, { content: [{ type: 'text', text: JSON.stringify(result) }] });
    }
    throw new Error(`Unexpected MCP method: ${body.method}`);
  });
  mock.method(OpenAIService.prototype, 'extractStructuredDataWithCorroboration', async (content: string, fields: EnrichmentField[]) => {
    synthesis.push(content);
    return Object.fromEntries(fields.map(f => [f.name, {
      field: f.name, value: 'Software', confidence: 0.9,
      sourceContext: [{ url: source, snippet: excerpt }],
    }]));
  });
});

afterEach(() => {
  mock.restoreAll();
  for (const key of Object.keys(process.env)) if (!(key in originalEnvironment)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
});

const calls = () => requests.filter(r => r.body.method === 'tools/call').map(r => r.body.params);

test('fresh no-key enrichment uses MCP and consumes content and source URLs', async () => {
  const strategy = new AgentEnrichmentStrategy('fixture-openai-key', undefined);
  const result = await strategy.enrichRow({ email: 'researcher@research-co.test' }, [field('industry')], 'email');
  assert.equal(result.status, 'completed');
  assert.equal(result.enrichments.industry.value, 'Software');
  assert.equal(result.enrichments.industry.source, source);
  assert.ok(synthesis[0].includes(excerpt));
  assert.ok(synthesis[0].includes(`URL: ${source}`));
  assert.deepEqual(calls().map(c => c.name), ['web_search']);
  assert.ok(requests.some(r => r.body.method === 'tools/list'));
});

function enrichmentRequest(firecrawlKey?: string) {
  return new NextRequest('http://localhost/api/enrich', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'X-OpenAI-API-Key': 'fixture-openai-key',
      ...(firecrawlKey ? { 'X-Firecrawl-API-Key': firecrawlKey } : {}),
    },
    body: JSON.stringify({ rows: [{ email: 'a@research-co.test' }], fields: [field('industry')], emailColumn: 'email' }),
  });
}

test('the API accepts OpenAI alone and streams enriched source citations', async () => {
  const response = await POST(enrichmentRequest());
  assert.equal(response.status, 200);
  const events = (await response.text()).split('\n\n').filter(Boolean).map(line => JSON.parse(line.slice(6)));
  const result = events.find(event => event.type === 'result').result;
  assert.equal(result.status, 'completed');
  assert.equal(result.enrichments.industry.source, source);
  assert.ok(synthesis[0].includes(excerpt));
});

test('API keeps browser Firecrawl choices and server key precedence', async () => {
  const keys: string[] = [];
  mock.method(FirecrawlService.prototype, 'search', async function(this: any) {
    keys.push(this.app.apiKey);
    return [{ url: source, markdown: excerpt }];
  });
  await (await POST(enrichmentRequest('browser-key'))).text();
  process.env.FIRECRAWL_API_KEY = 'server-key';
  await (await POST(enrichmentRequest('browser-key'))).text();
  assert.deepEqual(keys, ['browser-key', 'server-key']);
  assert.equal(requests.length, 0);
  process.env.WEB_SEARCH_PROVIDER = 'parallel';
  await (await POST(enrichmentRequest('browser-key'))).text();
  assert.equal(calls().length, 1);
});

test('environment status tells the UI when Firecrawl is explicitly required', async () => {
  assert.equal((await (await checkEnvironment()).json()).environmentStatus.REQUIRES_FIRECRAWL_KEY, false);
  process.env.WEB_SEARCH_PROVIDER = 'firecrawl';
  assert.equal((await (await checkEnvironment()).json()).environmentStatus.REQUIRES_FIRECRAWL_KEY, true);
  const response = await POST(enrichmentRequest());
  assert.equal(response.status, 500);
  assert.equal(requests.length, 0);
});

test('the same orchestrator isolates interleaved rows and a later new run', async () => {
  const orchestrator = new AgentOrchestrator(undefined, 'fixture-openai-key');
  const run = () => orchestrator.enrichRow({ email: 'a@research-co.test' }, [field('tech stack')], 'email');
  await Promise.all([run(), run()]);
  const first = calls();
  const ids = [...new Set(first.map(c => c.arguments.session_id))];
  assert.equal(ids.length, 2);
  for (const id of ids) {
    assert.match(id, /^[0-9a-f-]{36}$/);
    assert.deepEqual(first.filter(c => c.arguments.session_id === id).map(c => c.name), ['web_search', 'web_fetch', 'web_search']);
  }
  await run();
  assert.equal(new Set(calls().map(c => c.arguments.session_id)).size, 3);
});

test('configured keys and explicit overrides preserve selection, including disabled search', async () => {
  assert.equal(resolveResearchProvider(), 'parallel');
  assert.equal(resolveResearchProvider('saved-browser-key'), 'firecrawl');
  process.env.WEB_SEARCH_PROVIDER = 'parallel';
  assert.equal(resolveResearchProvider('configured-server-key'), 'parallel');
  process.env.WEB_SEARCH_PROVIDER = 'firecrawl';
  assert.throws(() => resolveResearchProvider(), /Firecrawl API key/);
  process.env.WEB_SEARCH_PROVIDER = 'invalid';
  assert.throws(() => resolveResearchProvider('key'), /WEB_SEARCH_PROVIDER/);
  process.env.WEB_SEARCH_PROVIDER = 'disabled';
  await new AgentOrchestrator(undefined, 'fixture-openai-key').enrichRow({ email: 'a@research-co.test' }, [field('industry')], 'email');
  assert.equal(requests.length, 0);
});

test('a configured Firecrawl failure never switches to Parallel', async () => {
  const firecrawl = mock.method(FirecrawlService.prototype, 'search', async () => { throw new Error('Configured provider failed'); });
  const result = await new AgentEnrichmentStrategy('fixture-openai-key', 'saved-browser-key')
    .enrichRow({ email: 'a@research-co.test' }, [field('industry')], 'email');
  assert.equal(result.status, 'error');
  assert.equal(firecrawl.mock.callCount(), 1);
  assert.equal(requests.length, 0);
});

test('a quota retry within one row keeps its research identity', async () => {
  failure = 'quota';
  let count = 0;
  onCall = () => { if (++count > 1) failure = undefined; };
  await new AgentEnrichmentStrategy('fixture-openai-key', undefined)
    .enrichRow({ email: 'a@research-co.test' }, [field('CEO')], 'email');
  assert.ok(calls().length > 2);
  assert.equal(new Set(calls().map(c => c.arguments.session_id)).size, 1);
  assert.ok(calls().some(c => c.name === 'web_fetch'));
});

for (const mode of ['http', 'tool', 'malformed', 'quota'] as const) {
  test(`MCP ${mode} errors do not reach synthesis or change providers`, async () => {
    failure = mode;
    const result = await new AgentEnrichmentStrategy('fixture-openai-key', undefined)
      .enrichRow({ email: 'a@research-co.test' }, [field('industry')], 'email');
    assert.equal(result.status, 'error');
    assert.equal(synthesis.length, 0);
    assert.equal(new Set(calls().map(c => c.arguments.session_id)).size, 1);
  });
}

test('cancellation reaches an in-flight MCP request without successful synthesis', async () => {
  const controller = new AbortController();
  failure = 'timeout';
  onCall = () => controller.abort();
  const result = await new AgentEnrichmentStrategy('fixture-openai-key', undefined)
    .enrichRow({ email: 'a@research-co.test' }, [field('industry')], 'email', undefined, undefined, controller.signal);
  assert.equal(result.status, 'error');
  assert.equal(synthesis.length, 0);
});

test('request timeout reaches the caller without synthesizing fabricated content', async () => {
  failure = 'timeout';
  // Shorten only the SDK's 30-second request timer; production still supplies 30,000 ms.
  const originalTimeout = globalThis.setTimeout;
  mock.method(globalThis, 'setTimeout', (callback: (...args: any[]) => void, delay?: number, ...args: any[]) =>
    originalTimeout(callback, delay === 30_000 ? 20 : delay, ...args));
  const result = await new AgentEnrichmentStrategy('fixture-openai-key', undefined)
    .enrichRow({ email: 'a@research-co.test' }, [field('industry')], 'email');
  assert.equal(result.status, 'error');
  assert.equal(synthesis.length, 0);
});
