import assert from 'node:assert/strict';
import test from 'node:test';
import { getIP } from '../lib/client-ip.ts';

const request = (headers) => ({ headers: new Headers(headers) });

for (const forwarded of [
  '203.0.113.7,198.51.100.4',
  '203.0.113.7, 198.51.100.4',
  '203.0.113.7 , 198.51.100.4',
  '203.0.113.7,\t198.51.100.4',
]) {
  test(`one client key for proxy list ${JSON.stringify(forwarded)}`, () => {
    assert.equal(getIP(request({ 'x-forwarded-for': forwarded })), '203.0.113.7');
  });
}

test('proxy hops changing does not give a client a new allowance', () => {
  const a = getIP(request({ 'x-forwarded-for': '203.0.113.7,198.51.100.4' }));
  const b = getIP(request({ 'x-forwarded-for': '203.0.113.7,198.51.100.8' }));
  assert.equal(a, b);
});

test('IPv6 stays complete when reading the first comma-delimited item', () => {
  assert.equal(getIP(request({ 'x-forwarded-for': '2001:db8::7,2001:db8::4' })), '2001:db8::7');
});

test('empty first forwarded item falls back to real IP', () => {
  assert.equal(getIP(request({ 'x-forwarded-for': ',198.51.100.4', 'x-real-ip': '203.0.113.7' })), '203.0.113.7');
});

test('no usable forwarding headers retains the local fallback', () => {
  assert.equal(getIP(request({})), '127.0.0.1');
  assert.equal(getIP(request({ 'x-forwarded-for': ',198.51.100.4', 'x-real-ip': ' ' })), '127.0.0.1');
});

test('direct real IP and single forwarded clients keep existing behavior', () => {
  assert.equal(getIP(request({ 'x-real-ip': '203.0.113.7' })), '203.0.113.7');
  assert.equal(getIP(request({ 'x-forwarded-for': '203.0.113.7' })), '203.0.113.7');
});
