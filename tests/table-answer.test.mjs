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

async function answer(message) {
  let calls = 0;
  const server = http.createServer(async (request, response) => {
    for await (const chunk of request) { /* drain the actual SDK request */ }
    calls++;
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ id: 'fixture', object: 'chat.completion', created: 0, model: 'gpt-5-mini',
      choices: [{ index: 0, message: { role: 'assistant', ...message }, finish_reason: 'stop' }],
    }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const previous = process.env.OPENAI_BASE_URL;
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${server.address().port}/v1`;
  try {
    const result = await new OpenAIService('synthetic-local-fixture').answerFromTableData('Where is Acme based?', 'Acme: Paris');
    assert.equal(calls, 1);
    return result;
  } finally {
    if (previous === undefined) delete process.env.OPENAI_BASE_URL;
    else process.env.OPENAI_BASE_URL = previous;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

for (const [name, message] of [
  ['empty content', { content: '' }],
  ['whitespace content', { content: '  \n ' }],
  ['null content and refusal', { content: null, refusal: 'Controlled refusal fixture' }],
]) {
  test(`no table answer for ${name}`, async () => {
    assert.deepEqual(await answer(message), { found: false });
  });
}

test('NOT_FOUND still triggers research fallback', async () => {
  assert.deepEqual(await answer({ content: 'NOT_FOUND' }), { found: false });
});

test('a substantive answer still returns its text', async () => {
  assert.deepEqual(await answer({ content: 'Acme is based in Paris.' }), { found: true, answer: 'Acme is based in Paris.' });
});
