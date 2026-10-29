import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import test from 'node:test';
import './resolve-typescript.mjs';
const { OpenAIService } = await import('../lib/services/openai.ts');

const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const host = first && typeof first === 'object' ? first.host : typeof args[1] === 'string' ? args[1] : undefined;
  if (host && !['127.0.0.1', '::1', 'localhost'].includes(host)) throw new Error('External socket refused');
  return Reflect.apply(connect, this, args);
};

async function select(index) {
  let calls = 0;
  const server = http.createServer(async (request, response) => {
    for await (const chunk of request) { /* drain the actual SDK request */ }
    calls++;
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ id: 'fixture', object: 'chat.completion', created: 0, model: 'gpt-5-mini',
      choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify({ index }) }, finish_reason: 'stop' }],
    }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const previous = process.env.OPENAI_BASE_URL;
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${server.address().port}/v1`;
  try {
    const result = await new OpenAIService('synthetic-local-fixture').selectBestSource(sources, 'Where is Acme based?');
    assert.equal(calls, 1);
    return result;
  } finally {
    if (previous === undefined) delete process.env.OPENAI_BASE_URL;
    else process.env.OPENAI_BASE_URL = previous;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

const sources = [
  { url: 'https://acme.test/about', title: 'About Acme' },
  { url: 'https://news.test/acme', title: 'Acme news' },
];

for (const index of ['constructor', '__proto__', 'length', 'map']) {
  test(`inherited array property ${index} cannot become a source`, async () => {
    assert.deepEqual(await select(index), sources[0]);
  });
}
for (const index of [-1, 99, 0.5, null, '1']) {
  test(`invalid index ${JSON.stringify(index)} uses the actual first source`, async () => {
    assert.deepEqual(await select(index), sources[0]);
  });
}
test('a valid selected index returns that source', async () => {
  assert.deepEqual(await select(1), sources[1]);
});
