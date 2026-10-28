import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import test from 'node:test';
import { FirecrawlService } from '../lib/services/firecrawl.ts';

const sslError = { status: 500, error: 'SSL error: certificate verification failed' };
const success = { status: 200, markdown: 'Recovered fixture document' };

// Real SDK HTTP requests are allowed only to the owned loopback fixture.
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const host = first && typeof first === 'object'
    ? first.host
    : typeof args[1] === 'string' ? args[1] : undefined;
  if (host && !['127.0.0.1', '::1', 'localhost'].includes(host)) {
    throw new Error('External socket refused by test fixture');
  }
  return Reflect.apply(connect, this, args);
};

async function withFixture(replies, run) {
  const calls = [];
  const server = http.createServer(async (request, response) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    calls.push({ path: request.url, body: JSON.parse(raw) });
    const reply = replies.shift() ?? { status: 500, error: 'Unexpected extra request' };
    response.writeHead(reply.status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(reply.status === 200
      ? { success: true, data: { markdown: reply.markdown, metadata: { title: 'Fixture' } } }
      : { success: false, error: reply.error }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const previous = new Map();
  for (const key of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'FIRECRAWL_API_KEY', 'FIRECRAWL_API_URL']) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }
  process.env.FIRECRAWL_API_URL = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(new FirecrawlService('fc-synthetic-local-fixture'), calls);
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

const tlsFlags = calls => calls.map(call => call.body.skipTlsVerification ?? false);

for (const status of [429, 503]) {
  test(`recovers from HTTP ${status} during the TLS fallback`, async () => {
    await withFixture([sslError, { status, error: 'Temporary fixture failure' }, success], async (service, calls) => {
      const result = await service.scrapeUrl('https://fixture.example');
      assert.equal(result.data.markdown, success.markdown);
      assert.deepEqual(tlsFlags(calls), [false, true, true]);
      assert.ok(calls.every(call => call.path === '/v2/scrape'));
    });
  });
}

test('stops on the latest permanent fallback failure', async () => {
  await withFixture([sslError, { status: 401, error: 'Permanent fixture failure' }], async (service, calls) => {
    await assert.rejects(service.scrapeUrl('https://fixture.example'), error => error.status === 401);
    assert.deepEqual(tlsFlags(calls), [false, true]);
  });
});

test('preserves successful TLS fallback behavior', async () => {
  await withFixture([sslError, success], async (service, calls) => {
    const result = await service.scrapeUrl('https://fixture.example');
    assert.equal(result.data.markdown, success.markdown);
    assert.deepEqual(tlsFlags(calls), [false, true]);
  });
});

test('keeps the existing three-attempt retry budget after the one TLS fallback', async () => {
  const unavailable = { status: 503, error: 'Exhausted fixture failure' };
  await withFixture([sslError, unavailable, unavailable, unavailable], async (service, calls) => {
    await assert.rejects(service.scrapeUrl('https://fixture.example'), error => error.status === 503);
    assert.deepEqual(tlsFlags(calls), [false, true, true, true]);
  });
});

test('does not enable TLS fallback for an ordinary transient failure', async () => {
  await withFixture([{ status: 503, error: 'Temporary fixture failure' }, success], async (service, calls) => {
    const result = await service.scrapeUrl('https://fixture.example');
    assert.equal(result.data.markdown, success.markdown);
    assert.deepEqual(tlsFlags(calls), [false, false]);
  });
});

test('does not carry TLS fallback into another scrape call', async () => {
  await withFixture([sslError, success, success], async (service, calls) => {
    await service.scrapeUrl('https://first.fixture.example');
    await service.scrapeUrl('https://second.fixture.example');
    assert.deepEqual(tlsFlags(calls), [false, true, false]);
  });
});
