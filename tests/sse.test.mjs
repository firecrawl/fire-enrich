import test from 'node:test';
import assert from 'node:assert/strict';

import {readSSEData} from '../lib/utils/sse.ts';
async function consume(chunks) {
  const stream = new ReadableStream({start(c) { for (const chunk of chunks) c.enqueue(chunk); c.close(); }});
  const events = [];
  for await (const data of readSSEData(stream.getReader())) events.push(JSON.parse(data));
  assert.equal(stream.locked, false);
  return events;
}
const encoder = new TextEncoder();
const expected = [{type:'result',value:'Café 東京 🚒'}, {type:'complete'}];
const bytes = encoder.encode(expected.map(e => `data: ${JSON.stringify(e)}\n\n`).join(''));
test('every byte boundary preserves JSON and UTF-8', async () => {
  for (let split = 1; split < bytes.length; split++) {
    assert.deepEqual(await consume([bytes.slice(0,split), bytes.slice(split)]), expected, `split ${split}`);
  }
});
test('one byte chunks and coalesced frames give identical events', async () => {
  assert.deepEqual(await consume(Array.from(bytes, byte => Uint8Array.of(byte))), expected);
  assert.deepEqual(await consume([bytes]), expected);
});
test('CRLF, comments and multiline data are supported', async () => {
  assert.deepEqual(await consume([encoder.encode(':heartbeat\r\ndata: {"type":\r\ndata: "complete"}\r\n\r\n')]), [{type:'complete'}]);
});
test('reader lock is released when the transport fails', async () => {
  const stream = new ReadableStream({start(controller) {controller.error(new Error('transport failed'));}});
  await assert.rejects(async()=>{for await(const data of readSSEData(stream.getReader())) JSON.parse(data);},/transport failed/);
  assert.equal(stream.locked,false);
});

test('CR and CRLF separators survive every chunk boundary', async()=>{
  for (const separator of ['\r','\r\n']) {
    const framed=encoder.encode(expected.map(e=>`data: ${JSON.stringify(e)}${separator}${separator}`).join(''));
    for(let split=1;split<framed.length;split++) assert.deepEqual(await consume([framed.slice(0,split),framed.slice(split)]),expected);
  }
});
