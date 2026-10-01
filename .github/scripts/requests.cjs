// Server requests from an open page. Every request that runs a Pages Function counts toward the
// Cloudflare account's monthly requests (shared by every LSH site), so pages ask sparingly:
// - the lock/pause, the alert and new pings come in ONE request, /api/live, every 20 s (60 s in a
//   background tab), not three requests every 3 s; and what it returns is shown (lock screen, alert, ping);
// - the heartbeat every 30 s (the server allows 90 s), not every 2 s;
// - progress and the leaderboard once a minute, only on a page that shows them, only while it's in view.
// Usage: node .github/scripts/requests.cjs   (from the repository root; needs `npm i playwright`)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let f = path.join(ROOT, decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
(async () => {
    await new Promise(r => server.listen(0, r));
    const base = `http://localhost:${server.address().port}`;
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const failures = []; const fail = (m) => failures.push(m);
    const log = [];
    let live = { success: true, siteState: { success: true, locked: false, paused: false }, alert: { active: false }, pings: { success: true, pings: [] } };
    const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
    page.on('pageerror', e => fail(`page error: ${e.message}`));
    page.on('dialog', d => d.dismiss());
    await page.route('**/api/**', route => {
        const u = new URL(route.request().url());
        log.push({ at: Date.now(), path: u.pathname, q: u.search });
        if (u.pathname === '/api/live') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(live) });
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":false,"error":"offline test"}' });
    });
    await page.route(/cdn\.tailwindcss\.com/, r => r.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.addInitScript(() => sessionStorage.setItem('LSH_SESSION_V1', JSON.stringify({ username: 'trainer-ann', fullName: 'Ann Trainer', batchId: 'B1', userType: 'Admin' })));
    await page.goto(base + '/core.html', { waitUntil: 'load' });
    const t0 = Date.now();
    await page.waitForTimeout(24000);
    const count = (p, from = t0) => log.filter(x => x.path === p && x.at >= from - 1500).length;
    if (count('/api/live') < 1 || count('/api/live') > 2) fail(`/api/live was asked ${count('/api/live')} times in 24 s (expected 2: on load and at 20 s)`);
    if (!/pings=1/.test((log.find(x => x.path === '/api/live') || {}).q || '')) fail('signed in, /api/live doesn\'t ask for pings');
    for (const p of ['/api/site-state', '/api/alert', '/api/pings']) if (count(p)) fail(`${p} is still polled on its own (${count(p)} times in 24 s)`);
    if (count('/api/heartbeat') !== 1) fail(`${count('/api/heartbeat')} heartbeats in 24 s (expected 1: every 30 s)`);
    if (count('/api/progress') > 1 || count('/api/leaderboard') > 1) fail(`progress/leaderboard asked ${count('/api/progress')}/${count('/api/leaderboard')} times in 24 s (expected once a minute)`);
    const total = log.filter(x => x.at >= t0 + 3000).length;
    if (total > 3) fail(`${total} requests in the 21 s after loading: ${JSON.stringify(log.filter(x => x.at >= t0 + 3000).map(x => x.path))}`);

    // what /api/live returns is shown: a new ping, the alert (an Admin sees it in Master Control), the lock screen
    live = { success: true, siteState: { success: true, locked: true, paused: false }, alert: { active: true, id: 7, text: 'Fire drill', bgColor: '#b91c1c' },
        pings: { success: true, pings: [{ by: 'Trainer Ann', text: 'Check your email', fired_at: '2099-01-01 00:00:00' }] } };
    await page.evaluate(() => pollLive()); await page.waitForTimeout(800);
    const shown = await page.evaluate(() => ({
        lock: !!document.querySelector('#lock-overlay.open'),
        alert: /An alert is active/.test((document.getElementById('alert-status-line') || {}).textContent || '') || /Active/.test((document.getElementById('ov-alert-state') || {}).textContent || ''),
        ping: document.body.innerText.includes('Check your email')
    }));
    if (!shown.lock) fail('the lock from /api/live doesn\'t show the lock screen');
    if (!shown.alert) fail(`the alert from /api/live isn't shown: ${JSON.stringify(shown)}`);
    if (!shown.ping) fail('a new ping from /api/live isn\'t shown');
    const since = log.filter(x => x.path === '/api/live').pop();
    await page.evaluate(() => pollLive());
    const next = log.filter(x => x.path === '/api/live').pop();
    if (next === since || !/since=2099-01-01/.test(next.q)) fail(`the next /api/live doesn't ask for pings since the last one: ${next.q}`);

    live = { success: true, siteState: { success: true, locked: false, paused: false }, alert: { active: false }, pings: { success: true, pings: [] } };
    await page.evaluate(() => pollLive()); await page.waitForTimeout(500);

    // in a background tab: no /api/live for a minute; back in view: at once
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    const h0 = Date.now(); await page.waitForTimeout(22000);
    if (count('/api/live', h0 + 1500) || count('/api/progress', h0 + 1500)) fail(`a background tab still asked: ${JSON.stringify(log.filter(x => x.at >= h0).map(x => x.path))}`);
    const v0 = Date.now();
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(800);
    if (!count('/api/live', v0 + 1500) || !count('/api/heartbeat', v0 + 1500)) fail(`coming back to the tab didn't check /api/live and send a heartbeat: ${JSON.stringify(log.filter(x => x.at >= v0 - 2000).map(x => x.path))}`);

    // signed out: no pings asked
    const out = await browser.newPage();
    await out.route('**/api/**', route => { const u = new URL(route.request().url()); log.push({ at: Date.now(), path: u.pathname, q: u.search, out: true }); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, siteState: null, alert: null, pings: null }) }); });
    await out.route(/cdn\.tailwindcss\.com/, r => r.fulfill({ contentType: 'text/javascript', body: '' }));
    await out.goto(base + '/programs.html', { waitUntil: 'load' }); await out.waitForTimeout(1500);
    const o = log.filter(x => x.out && x.path === '/api/live');
    if (!o.length || o.some(x => /pings=1/.test(x.q))) fail(`signed out: /api/live ${o.length ? 'asks for pings' : 'isn\'t asked'}`);

    await browser.close(); server.close();
    if (failures.length) { console.log(`\n${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
    console.log('Requests test passed (one /api/live every 20 s and nothing in a background tab; heartbeat every 30 s; progress once a minute; the lock, alert and pings shown).');
})().catch(e => { console.error(e); process.exit(1); });
