// Smoke test: opens every page of the portal (static files, API calls answered
// with empty data) at desktop and phone width, and fails on any page error or
// on a page that scrolls sideways on a phone.
// Usage: node tests/smoke.cjs   (from the repository root; needs `npm i playwright`)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = process.cwd();
const PAGES = ['/index.html', '/programs.html', '/simulators.html', '/kb.html', '/progress.html', '/registration.html', '/trainee-login.html', '/admin-login.html',
    '/simulators/call.html?program=CM', '/simulators/email.html?program=CM', '/simulators/email-replies.html?program=CM', '/simulators/calendar.html?program=CM',
    '/simulators/docket.html?program=CM', '/simulators/records.html?program=CM', '/simulators/efiling.html?program=CM'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.md': 'text/markdown' };
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/api/')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"success":false,"error":"offline test"}'); }
    let f = path.join(ROOT, decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
(async () => {
    await new Promise(r => server.listen(0, r));
    const base = `http://localhost:${server.address().port}`;
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const failures = [];
    for (const vp of [{ width: 1360, height: 900, name: 'desktop' }, { width: 390, height: 844, name: 'phone' }]) {
        for (const p of PAGES) {
            const page = await browser.newPage({ viewport: vp });
            page.on('pageerror', e => failures.push(`[${vp.name}] ${p}: page error: ${e.message}`));
            page.on('dialog', d => d.dismiss());
            try { await page.goto(base + p, { waitUntil: 'load', timeout: 20000 }); await page.waitForTimeout(700); }
            catch (e) { failures.push(`[${vp.name}] ${p}: did not load (${e.message.split('\n')[0]})`); }
            if (vp.name === 'phone' && await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1).catch(() => false)) failures.push(`[phone] ${p}: the page scrolls sideways`);
            await page.close();
        }
    }
    await browser.close(); server.close();
    console.log(`Opened ${PAGES.length} pages at desktop and phone width.`);
    if (failures.length) { console.log(`\n${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
    console.log('Smoke test passed.');
})().catch(e => { console.error(e); process.exit(1); });
