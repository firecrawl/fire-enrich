import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const fields = [
  { name: 'employeeCount', displayName: 'Employee Count', type: 'number', required: false },
  { name: 'profitable', displayName: 'Profitable', type: 'boolean', required: false },
];
const rows = [{ email: 'fixture@synthetic.example' }];

// Component unit harness: control hook state and child boundaries, while compiling
// the complete production module and rendering its JSX with React's real renderer.
function renderTable(values, status = 'completed') {
  const enrichments = Object.fromEntries(Object.entries(values).map(([name, value]) => [name, { field: name, value, confidence: 0.95 }]));
  const results = new Map([[0, { rowIndex: 0, originalData: rows[0], status, enrichments }]]);
  let mapStates = 0;
  let chatProps;
  let sent;
  const hooks = {
    ...React,
    useState(initial) {
      if (initial?.constructor?.name === 'Map' && mapStates++ === 0) return [results, () => {}];
      return [initial === 'idle' ? 'completed' : initial, () => {}];
    },
    useEffect() {},
    useCallback: callback => callback,
    useRef: value => ({ current: value }),
  };
  const passthrough = ({ children }) => React.createElement('div', null, children);
  const source = fs.readFileSync(new URL('../app/fire-enrich/enrichment-table.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return require(name);
      if (name === './chat-panel') return { ChatPanel: props => { chatProps = props; return null; } };
      if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
      if (name === 'sonner') return { toast: { success() {} } };
      if (name.includes('/dialog')) return { Dialog: () => null };
      return new Proxy({}, { get: () => passthrough });
    },
    localStorage: { getItem: () => null },
    fetch: async (url, options) => { sent = { url, body: JSON.parse(options.body) }; return new Response(''); },
    TextDecoder, Response, console, setTimeout: () => 0, clearTimeout() {},
  });
  const html = renderToStaticMarkup(React.createElement(exports.EnrichmentTable, { rows, fields, emailColumn: 'email' }));
  return { html, chat: async () => { await chatProps.onSendMessage('Read the existing values'); return sent; } };
}

test('table renders zero as a numeric result, preserving nonzero values', () => {
  for (const value of [0, -1, 12.5]) {
    const { html } = renderTable({ employeeCount: value, profitable: false });
    assert.ok(html.includes(`title="${value}">${value}</div>`), `numeric ${value} must be visible`);
  }
});

test('chat includes known zero and false together with ordinary values', async () => {
  const sent = await renderTable({ employeeCount: 0, profitable: false, label: 'Fixture', textualZero: '0' }).chat();
  assert.equal(sent.url, '/api/chat');
  assert.ok(sent.body.context.tableData.includes('employeeCount: 0'));
  assert.ok(sent.body.context.tableData.includes('profitable: false'));
  assert.ok(sent.body.context.tableData.includes('label: "Fixture"'));
  assert.ok(sent.body.context.tableData.includes('textualZero: "0"'));
});

test('chat keeps missing values and pending rows out of context', async () => {
  const missing = await renderTable({ employeeCount: null, profitable: undefined, empty: '' }).chat();
  assert.ok(missing.body.context.tableData.includes('No data enriched yet'));
  assert.ok(!missing.body.context.tableData.includes('employeeCount:'));
  const pending = await renderTable({ employeeCount: 0, profitable: false }, 'pending').chat();
  assert.equal(pending.body.context.tableData, '');
});
