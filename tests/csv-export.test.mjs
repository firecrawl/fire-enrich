import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Read the actual UI export callbacks, replacing only TypeScript annotations.
async function download(name, context) {
  const source = fs.readFileSync(new URL('../app/fire-enrich/enrichment-table.tsx', import.meta.url), 'utf8');
  const start = source.indexOf(`  const ${name} = () => {`);
  const end = source.indexOf('\n  };', start) + 5;
  const callback = source.slice(start, end).replace('const values: string[]', 'const values');
  let blob;
  let helpers = {};
  if (source.includes('buildEnrichmentCSV')) helpers = await import('../lib/utils/csv-export.ts');
  vm.runInNewContext(`${callback}; ${name}();`, {...helpers, ...context, Blob, URL: {createObjectURL(b) {blob = b; return 'blob:test';}, revokeObjectURL() {}}, document: {createElement() {return {click() {}};}}});
  return blob.text();
}
// An independent RFC 4180 reader checks cell boundaries and quote round trips.
function parse(csv) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let i=0; i<csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') { if (quoted && csv[i+1] === '"') {cell += '"'; i++;} else quoted = !quoted; }
    else if (!quoted && ch === ',') {row.push(cell); cell='';}
    else if (!quoted && (ch === '\r' || ch === '\n')) {if(ch === '\r' && csv[i+1] === '\n') i++; row.push(cell); rows.push(row);row=[];cell='';}
    else cell += ch;
  }
  assert.equal(quoted, false, 'all quoted fields must close');
  if(cell || row.length) {row.push(cell); rows.push(row);}
  return rows;
}
const fields = [{name:'metric',displayName:'Team "Size", total'}];
const rows = [{email:'"quoted"@example.com', note:'comma, quote " and\rcarriage return'}];
const results = new Map([[0,{status:'completed',enrichments:{metric:{value:['a"b', '東京, Japan'],confidence:0,source:'https://example.com/?q="quoted"'}}}]]);
test('enrichment CSV round trips headers, quoted emails, arrays, sources and zero confidence', async () => {
  const output = parse(await download('downloadCSV', {rows, fields, results, emailColumn:'email'}));
  assert.deepEqual(output, [['email',fields[0].displayName,`${fields[0].displayName}_confidence`,`${fields[0].displayName}_source`], [rows[0].email,'a"b; 東京, Japan','0.00','https://example.com/?q="quoted"']]);
});
test('skipped CSV round trips every input column and reason', async () => {
  const skipped = new Map([[0,{status:'skipped',error:'Blocked, "personal"',enrichments:{}}]]);
  const output = parse(await download('downloadSkippedEmails', {rows, results:skipped}));
  assert.deepEqual(output, [['email','note','Skip Reason'],[rows[0].email,rows[0].note,'Blocked, "personal"']]);
});
