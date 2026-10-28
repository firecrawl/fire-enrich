// Actual-browser regression: start an existing production Next build first.
// Requires existing Playwright Core and Chrome; this script installs nothing.
// NEXT_FIXTURE_ORIGIN=http://127.0.0.1:3000 node tests/browser/enrichment-lifetime.mjs
// PLAYWRIGHT_MODULE and CHROME_BINARY may specify existing local installations.
// Uses synthetic local HTTP/SSE fixture responses and a fresh browser context.
// No provider APIs are called; this does not prove server/provider cancellation.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import http from 'node:http';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const target = process.env.NEXT_FIXTURE_ORIGIN || 'http://127.0.0.1:3000';
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(target).hostname), 'Use a local Next server');
const checks = {}, runs = [], bodies = [];
let mode = 'early', current;
const server = http.createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/api/check-env') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ environmentStatus: { FIRECRAWL_API_KEY: true, OPENAI_API_KEY: true } }));
    }
    if (path === '/api/enrich' && req.method === 'POST') {
        let body = '';
        for await (const chunk of req)
            body += chunk;
        bodies.push(JSON.parse(body));
        current = { mode, closed: false, res };
        runs.push(current);
        const run = current;
        res.on('close', () => { run.closed = true; });
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
        res.write(`data: ${JSON.stringify({ type: 'pending', rowIndex: 0 })}\n\n`);
        if (mode !== 'early')
            res.write(`data: ${JSON.stringify({ type: 'session', sessionId: 'synthetic-session' })}\n\n`);
        if (mode === 'success')
            setTimeout(() => { res.write(`data: ${JSON.stringify({ type: 'result', result: { rowIndex: 0, originalData: JSON.parse(body).rows[0], status: 'completed', enrichments: { companyName: { value: 'Fixture Company', confidence: 0.9 } } } })}\n\n`); res.end(`data: ${JSON.stringify({ type: 'complete' })}\n\n`); }, 300);
        return;
    }
    if (path === '/api/enrich' && req.method === 'DELETE') {
        const run = current;
        setTimeout(() => res.end('{}'), 400);
        setTimeout(() => { if (!run.closed)
            run.res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`); }, 650);
        return;
    }
    if (path.startsWith('/api/')) {
        res.writeHead(500);
        return res.end('Unexpected fixture API call');
    }
    const upstream = http.request(new URL(req.url, target), { method: req.method, headers: { ...req.headers, host: new URL(target).host } }, reply => { res.writeHead(reply.statusCode, reply.headers); reply.pipe(res); });
    upstream.on('error', () => { res.writeHead(502); res.end(); });
    req.pipe(upstream);
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({ executablePath: process.env.CHROME_BINARY || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--disable-background-networking'] });
    try {
        const context = await browser.newContext();
        await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
        async function start(which) {
            mode = which;
            const page = await context.newPage();
            await page.goto(origin + '/fire-enrich');
            await page.locator('input[type=file]').setInputFiles({
                name: 'fixture.csv', mimeType: 'text/csv',
                buffer: Buffer.from('email,name\nalice@fixture.example,Alice\n'),
            });
            await page.getByRole('button', { name: 'Next', exact: true }).click();
            await page.getByRole('button', { name: 'Start Enrichment', exact: true }).click();
            await page.getByRole('button', { name: 'Cancel', exact: true }).waitFor();
            for (let i = 0; i < 50 && (!current || current.mode !== which); i++) {
                await page.waitForTimeout(20);
            }
            await page.waitForTimeout(100);
            return page;
        }
        let page = await start('early');
        let run = current;
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        await page.waitForTimeout(120);
        checks.cancel_before_session_is_terminal = (await page.locator('body').innerText()).includes('Enrichment Cancelled');
        checks.cancel_before_session_closes_stream = run.closed;
        await page.close();
        run.res.end();
        page = await start('late');
        run = current;
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        await page.waitForTimeout(120);
        checks.cancel_does_not_wait_for_delete = (await page.locator('body').innerText()).includes('Enrichment Cancelled');
        await page.waitForTimeout(750);
        checks.late_complete_cannot_replace_cancel = (await page.locator('body').innerText()).includes('Enrichment Cancelled');
        checks.cancel_closes_stream = run.closed;
        await page.close();
        run.res.end();
        page = await start('unmount');
        run = current;
        await page.getByRole('button', { name: 'Start New Enrichment', exact: true }).click();
        await page.locator('input[type=file]').waitFor();
        await page.waitForTimeout(120);
        checks.start_new_enrichment_closes_old_stream = run.closed;
        await page.close();
        run.res.end();
        page = await start('success');
        await page.getByText('Enrichment Complete', { exact: true }).waitFor();
        await page.getByText('Fixture Company', { exact: true }).waitFor();
        checks.successful_stream_still_completes = (await page.locator('body').innerText()).includes('Fixture Company');
        await page.close();
        console.log(JSON.stringify({ target, checks, passed: Object.values(checks).filter(Boolean).length, total: Object.keys(checks).length, actualEnrichmentRequests: bodies.length, syntheticRows: bodies.every(b => b.rows[0].email === 'alice@fixture.example'), paidCalls: 0 }, null, 2));
        assert.ok(Object.values(checks).every(Boolean), 'Client run lifetime invariant failed');
    }
    finally {
        await browser.close();
        for (const run of runs)
            run.res.destroy();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
