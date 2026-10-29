import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import test from 'node:test';
import vm from 'node:vm';

// Only provider boundaries are replaced. The real orchestrator, email parser,
// classification, HTML analysis and output-formatting code run unchanged.
async function enrichHtml(html) {
  const calls = [];
  const context = vm.createContext({ console: { log() {}, warn() {}, error() {} }, URL, setTimeout });
  const firecrawl = new vm.SyntheticModule(['FirecrawlService'], function () {
    this.setExport('FirecrawlService', class {
      async search() { return []; }
      async scrapeUrl() { return { data: { html, markdown: '' } }; }
    });
  }, { context });
  const openai = new vm.SyntheticModule(['OpenAIService'], function () {
    this.setExport('OpenAIService', class {
      async extractStructuredDataWithCorroboration(_content, _fields, extractionContext) {
        calls.push(extractionContext);
        return { techStack: { field: 'techStack', value: extractionContext.detectedTechnologies.split(', '), confidence: 1 } };
      }
    });
  }, { context });
  const load = async (path) => new vm.SourceTextModule(ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText, { context });
  const parser = await load('../lib/strategies/email-parser.ts');
  await parser.link(() => { throw new Error('The real email parser must have no external dependencies'); });
  const orchestratorModule = await load('../lib/agent-architecture/orchestrator.ts');
  await orchestratorModule.link((specifier) => {
    if (specifier === '../strategies/email-parser') return parser;
    if (specifier === '../services/firecrawl') return firecrawl;
    if (specifier === '../services/openai') return openai;
    throw new Error(`Unexpected production dependency: ${specifier}`);
  });
  await orchestratorModule.evaluate();
  const orchestrator = new orchestratorModule.namespace.AgentOrchestrator('fixture', 'fixture');
  const result = await orchestrator.enrichRow({ email: 'person@example.invalid' }, [{ name: 'techStack', displayName: 'Tech stack', description: 'Technologies used by the company', type: 'array', required: false }], 'email');
  return { result: JSON.parse(JSON.stringify(result)), calls };
}

for (const [name, source, expected] of [
  ['Next.js', '/_next/static/chunks/app/page.js', ['Next.js']],
  ['jQuery', '/jquery-3.7.1.min.js', ['jQuery']],
  ['React', '/react.min.js', ['React']],
  ['Vue', '/vue.min.js', ['Vue.js']],
  ['Zone.js', '/zone.js', ['Zone.js']],
  ['Webpack', '/webpack.runtime.js', ['Webpack']],
  ['Materialize', '/materialize.min.js', ['Materialize']],
  ['Google Analytics', 'https://www.google-analytics.com/analytics.js', ['Google Analytics']],
  ['Google Tag Manager', 'https://www.googletagmanager.com/gtm.js', ['Google Tag Manager']],
]) {
  test(`the public enrichment path passes canonical ${name} evidence instead of regex syntax`, async () => {
    const { result, calls } = await enrichHtml(`<html><script src="${source}"></script></html>`);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].detectedTechnologies.split(', '), expected);
    assert.deepEqual(result.enrichments.techStack.value, expected);
  });
}

test('a generic bundle filename does not manufacture a detected technology', async () => {
  const { result, calls } = await enrichHtml('<script src="/assets/bundle.abc123.js"></script>');
  assert.equal(calls.length, 0);
  assert.deepEqual(result.enrichments, {});
});

test('an unrecognized script does not manufacture a detected technology', async () => {
  const { result, calls } = await enrichHtml('<script src="/assets/application.js"></script>');
  assert.equal(calls.length, 0);
  assert.deepEqual(result.enrichments, {});
});
