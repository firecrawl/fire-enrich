import test from 'node:test';
import assert from 'node:assert/strict';
import {findRelevantSnippet, validateSnippetContainsValue} from '../lib/utils/source-context.ts';

test('numeric evidence does not match a different integer, decimal, or signed value', () => {
  for (const [snippet, value] of [['1000 employees', 100], ['110 employees', 10], ['1.5 million', 1], ['-5 employees', 5], ['3.14 percent', 3], ['3x14 percent', 3.14]]) {
    assert.equal(validateSnippetContainsValue(snippet, value), false, `${value} in ${snippet}`);
    assert.equal(findRelevantSnippet(snippet, value, 'metric'), '', `${value} in ${snippet}`);
  }
});
test('numeric evidence supports zero, signs, decimals, grouping and exact magnitude suffixes', () => {
  for (const [snippet, value] of [['0 employees', 0], ['-5 percent', -5], ['3.14 percent', 3.14], ['1,000 employees', 1000], ['1.5k employees', 1500], ['1m revenue', 1000000]]) {
    assert.equal(validateSnippetContainsValue(snippet, value), true, `${value} in ${snippet}`);
    assert.notEqual(findRelevantSnippet(snippet, value, 'metric'), '', `${value} in ${snippet}`);
  }
});
test('formatted numbers cannot match prefixes or suffixes of other numbers', () => {
  for (const [snippet, value] of [['11,000 employees', 1000], ['1.5k employees', 1], ['21k employees', 1000], ['1m employees', 1000]]) {
    assert.equal(validateSnippetContainsValue(snippet, value), false);
    assert.equal(findRelevantSnippet(snippet, value, 'metric'), '');
  }
});
